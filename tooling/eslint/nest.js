import { createConfig } from './create-config.js';

export default createConfig({
  ignores: [
    'dist/**',
    'src/generated/**',
    'coverage/**',
    '.generator-tmp/**',
    '**/*.cjs',
    '**/*.mjs',
  ],
  files: ['**/*.{ts,mts}'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
  },
});
