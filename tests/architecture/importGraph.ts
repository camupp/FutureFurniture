import { parse } from '@babel/parser'
import path from 'node:path'

/** Parse TypeScript/TSX, including type imports, re-exports and dynamic imports. */
export function importedModules(source: string): string[] {
  const result: string[] = []
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'], createImportExpressions: true })
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return
    const node = value as Record<string, unknown>
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(
        String(node.type),
      )
    ) {
      const source = node.source as { type?: string; value?: string } | undefined
      if (source?.type === 'StringLiteral' && source.value) result.push(source.value)
      else if (node.type === 'ImportExpression') throw new Error('Dynamic imports must use a literal module path')
    }
    if (node.type === 'TSImportType') {
      const argument = node.argument as { type?: string; value?: string }
      if (argument?.type === 'StringLiteral' && argument.value) result.push(argument.value)
    }
    if (node.type === 'TSImportEqualsDeclaration') throw new Error('Use ES module imports, not import = require')
    if (node.type === 'CallExpression' && (node.callee as { name?: string })?.name === 'require') {
      throw new Error('Use ES module imports, not require')
    }
    for (const [key, child] of Object.entries(node)) {
      if (['loc', 'start', 'end', 'comments', 'tokens'].includes(key)) continue
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child === 'object') visit(child)
    }
  }
  visit(ast.program)
  return [...new Set(result)]
}

export function resolveLocalImport(file: string, specifier: string, files: Set<string>): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null
  const base = specifier.startsWith('@/')
    ? `src/${specifier.slice(2)}`
    : path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
  const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((p) => files.has(p))
  if (!target) throw new Error(`${file}: unresolved import ${specifier}`)
  return target
}

export function boundaryViolation(file: string, target: string): string | null {
  const [, layer, module] = file.split('/')
  const [, targetLayer, targetModule] = target.split('/')
  const allowed: Record<string, string[]> = {
    app: ['app', 'features', 'application', 'domain', 'shared'],
    features: ['features', 'application', 'domain', 'shared'],
    application: ['application', 'domain', 'shared'],
    domain: ['domain', 'shared'],
    shared: ['shared'],
  }
  if (file === 'src/main.tsx') {
    return targetLayer === 'app' ? null : 'The entrypoint must compose only app modules'
  }
  if (!allowed[layer]?.includes(targetLayer)) return `${layer} must not depend on ${targetLayer}`
  if ((layer === 'domain' || layer === 'application') && targetLayer === 'shared' && targetModule !== 'lib') {
    return `${layer} may use only framework-free shared/lib`
  }
  if (layer === 'shared' && module === 'lib' && targetModule !== 'lib') return 'shared/lib must remain framework-free'
  if (layer === 'features' && targetLayer === 'features' && module !== targetModule) return 'Features must be isolated'
  if (targetLayer === 'features' && layer !== 'features' && target !== `src/features/${targetModule}/index.ts`) {
    return 'Use the feature public API'
  }
  if (
    targetLayer === 'application' &&
    layer !== 'application' &&
    target !== `src/application/${targetModule}/index.ts`
  ) {
    return 'Use the application public API'
  }
  if (
    target.startsWith('src/domain/model/') &&
    !file.startsWith('src/domain/model/') &&
    target !== 'src/domain/model/index.ts'
  ) {
    return 'Use the domain model public API'
  }
  return null
}

export function dependencyCycles(graph: Map<string, string[]>): string[][] {
  const visited = new Set<string>()
  const stack: string[] = []
  const cycles: string[][] = []
  function visit(file: string) {
    const index = stack.indexOf(file)
    if (index >= 0) {
      cycles.push([...stack.slice(index), file])
      return
    }
    if (visited.has(file)) return
    visited.add(file)
    stack.push(file)
    for (const target of graph.get(file) ?? []) visit(target)
    stack.pop()
  }
  for (const file of graph.keys()) visit(file)
  return cycles
}
