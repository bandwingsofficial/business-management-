import nextPlugin from '@next/eslint-plugin-next';

import { createConfig } from './create-config.js';

export default createConfig({
  ignores: ['.next/**', 'coverage/**', 'next-env.d.ts'],
  files: ['**/*.{js,mjs,ts,mts,tsx}'],
  browser: true,
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs['core-web-vitals'].rules,
    '@next/next/no-html-link-for-pages': 'off',
  },
}).map((config) => {
  if (!config.files) {
    return config;
  }

  return {
    ...config,
    plugins: {
      ...config.plugins,
      '@next/next': nextPlugin,
    },
  };
});
