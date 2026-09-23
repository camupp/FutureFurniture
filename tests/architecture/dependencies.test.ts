// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { boundaryViolation, dependencyCycles, importedModules, resolveLocalImport } from './importGraph'

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
  )
}

describe('architecture fitness checks', () => {
  const files = new Set(walk('src'))
  const graph = new Map<string, string[]>()
  const violations: string[] = []
  for (const file of files) {
    if (!/\.tsx?$/.test(file)) continue
    const dependencies: string[] = []
    for (const specifier of importedModules(readFileSync(file, 'utf8'))) {
      const target = resolveLocalImport(file, specifier, files)
      if (target) {
        dependencies.push(target)
        const error = boundaryViolation(file, target)
        if (error) violations.push(`${file} → ${target}: ${error}`)
      } else {
        // Domain algorithms can run in Node without React, a canvas, a store or a browser.
        if (file.startsWith('src/domain/') && specifier !== 'zod')
          violations.push(`${file}: forbidden dependency ${specifier}`)
        if (file.startsWith('src/application/') && !['zustand', 'zustand/middleware', 'zod'].includes(specifier)) {
          violations.push(`${file}: forbidden dependency ${specifier}`)
        }
        if (file.startsWith('src/shared/lib/')) violations.push(`${file}: shared math must not depend on ${specifier}`)
      }
    }
    graph.set(file, dependencies)
  }

  it('respects layers, feature isolation and public APIs', () => expect(violations).toEqual([]))
  it('has no dependency cycles, including type-only imports', () => expect(dependencyCycles(graph)).toEqual([]))
})

describe('architecture checker regression tests', () => {
  it('extracts imports, types, re-exports and lazy imports from TSX without matching comments', () => {
    expect(
      importedModules(`
      import type { Room } from '@/domain/model'
      export { App } from './App'
      const View = () => <div />
      const lazy = () => import('./Scene')
      type Model = import('./model').Model
      // import ignored from './not-a-dependency'
    `),
    ).toEqual(['@/domain/model', './App', './Scene', './model'])
  })
  it('rejects dependency mechanisms the checker cannot resolve statically', () => {
    expect(() => importedModules('import(target)')).toThrow('literal')
    expect(() => importedModules("require('./hidden')")).toThrow('ES module')
  })
  it('resolves aliases and relative public APIs identically', () => {
    const files = new Set(['src/application/project/index.ts'])
    expect(resolveLocalImport('src/app/App.tsx', '@/application/project', files)).toBe(
      'src/application/project/index.ts',
    )
    expect(resolveLocalImport('src/app/App.tsx', '../application/project', files)).toBe(
      'src/application/project/index.ts',
    )
    expect(() => resolveLocalImport('src/app/App.tsx', './missing', files)).toThrow('unresolved')
  })
  it('rejects reverse dependencies, cross-feature imports and bypassed APIs', () => {
    expect(boundaryViolation('src/domain/a.ts', 'src/application/project/index.ts')).not.toBeNull()
    expect(boundaryViolation('src/features/plan/a.ts', 'src/features/scene/index.ts')).not.toBeNull()
    expect(boundaryViolation('src/app/App.tsx', 'src/features/scene/Scene.tsx')).not.toBeNull()
    expect(boundaryViolation('src/domain/a.ts', 'src/shared/hooks/useSize.ts')).not.toBeNull()
    expect(boundaryViolation('src/shared/lib/math.ts', 'src/domain/model/index.ts')).not.toBeNull()
    expect(boundaryViolation('src/features/plan/a.ts', 'src/application/project/store.ts')).not.toBeNull()
    expect(boundaryViolation('src/features/plan/a.ts', 'src/application/project/index.ts')).toBeNull()
  })
  it('detects cycles and accepts a diamond dependency', () => {
    expect(
      dependencyCycles(
        new Map([
          ['a', ['b']],
          ['b', ['a']],
        ]),
      ),
    ).toEqual([['a', 'b', 'a']])
    expect(
      dependencyCycles(
        new Map([
          ['a', ['b', 'c']],
          ['b', ['d']],
          ['c', ['d']],
          ['d', []],
        ]),
      ),
    ).toEqual([])
  })
})
