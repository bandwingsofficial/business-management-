import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export function createConfig({ ignores, rules = {}, files, browser = false }) {
  return tseslint.config(
    { ignores },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files,
      languageOptions: {
        globals: {
          ...globals.node,
          ...(browser ? globals.browser : {}),
        },
        sourceType: 'module',
      },
      plugins: {
        'simple-import-sort': simpleImportSort,
      },
      rules: {
        'no-console': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
        ...rules,
      },
    },
    prettier,
  );
}
