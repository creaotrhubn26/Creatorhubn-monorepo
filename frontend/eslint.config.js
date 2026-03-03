import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'dist',
      'build',
      'coverage',
      'rendered_videos',
      'generated-tutorials',
      '**/*.bak*',
      '**/*.backup*'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off'
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      'no-unused-vars': 'off', // Use TypeScript's version instead
      'prefer-const': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'no-case-declarations': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'no-undef': 'off', // TypeScript handles this
      'no-constant-binary-expression': 'warn',
      'no-duplicate-imports': 'error',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }]
    }
  }
);
