import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'logic', environment: 'node', include: ['tests/{unit,architecture}/**/*.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'dom', environment: 'jsdom', include: ['tests/{integration,ui}/**/*.test.{ts,tsx}'] },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**/*.ts', 'src/application/project/**/*.ts', 'src/shared/lib/*.ts'],
      exclude: ['tests/**', '**/index.ts', '**/types.ts'],
      thresholds: {
        statements: 70,
        branches: 50,
        functions: 50,
        lines: 75,
      },
    },
  },
})
