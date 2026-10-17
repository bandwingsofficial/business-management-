import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.e2e.spec.ts'],
    exclude: ['src/**/*.integration.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    hookTimeout: 20000,
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.e2e.spec.ts',
        'src/**/*.integration.spec.ts',
        'src/generated/**',
      ],
      thresholds: {
        statements: 68,
        branches: 65,
        functions: 64,
        lines: 68,
      },
    },
  },
});
