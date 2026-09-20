import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/{unit,integration}/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/shared/utils/{collision,elevation,geometry,openings,snapping,utilities}.ts',
        'src/modules/validation/rules.ts',
        'src/shared/store.ts',
      ],
      exclude: ['tests/**'],
      thresholds: {
        statements: 70,
        branches: 50,
        functions: 50,
        lines: 75,
      },
    },
  },
})
