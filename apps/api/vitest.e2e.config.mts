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
    include: ['src/**/*.e2e.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    hookTimeout: 20000,
    testTimeout: 20000,
  },
});
