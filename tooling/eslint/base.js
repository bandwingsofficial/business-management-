import { createConfig } from './create-config.js';

export default createConfig({
  ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  files: ['**/*.{js,mjs,cjs,ts}'],
});
