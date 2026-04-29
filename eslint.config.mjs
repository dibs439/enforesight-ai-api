import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        // Note: project omitted intentionally — type-aware rules not required
        // and including it causes parse errors for files outside tsconfig.json
      },
      globals: {
        // Node.js
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Web / fetch APIs (available in Node 18+)
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        crypto: 'readonly',
        // TypeScript / Express ambient type namespaces
        NodeJS: 'readonly',
        Express: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Dynamic require() is used intentionally as a module-resolution fallback
      // for Convex generated files which have different paths in dev vs prod.
      '@typescript-eslint/no-require-imports': 'off',
      // Convex generated files use @ts-ignore; allow both forms.
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-console': 'off',
    },
  },
  {
    // Test files and mock files — add Jest globals
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/__mocks__/**/*.ts',
      '**/__tests__/**/*.ts',
    ],
    languageOptions: {
      globals: {
        jest: 'readonly',
        expect: 'readonly',
        test: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.js', '*.cjs', 'coverage/'],
  },
];
