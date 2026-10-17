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
    include: ['src/**/*.integration.spec.ts'],
    setupFiles: ['./vitest.integration.setup.ts'],
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
