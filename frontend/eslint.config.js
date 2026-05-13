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
  },
  // Role Room design-system-guardrails — forhindrer drift på shared
  // konstanter etter fase 1-3-konsolidering (commits ad5e5536..0f237391).
  // Definert i 2 nivåer: error for cross-cutting konstanter (touch-target),
  // warning for soft-foretrukne mønstre (token-bruk).
  {
    files: ['frontend/client/src/components/role-room/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Forbyr lokal re-deklarasjon av TOUCH_TARGET_SIZE — bruk shared
          // import fra `constants/accessibility.ts` istedenfor. Etter
          // fase 2a/2b-migrasjonen er det 0 duplikater igjen i kodebasen
          // og denne regelen sikrer at neste panel ikke re-introduserer
          // gjelden.
          selector: 'VariableDeclarator[id.name="TOUCH_TARGET_SIZE"]',
          message:
            'Bruk `import { TOUCH_TARGET_SIZE } from "../constants/accessibility"` istedenfor å re-deklarere lokalt. Se design-system-audit i memory.md.',
        },
        {
          // Forbyr lokal re-deklarasjon av MOBILE_TOUCH_TARGET_SIZE
          selector: 'VariableDeclarator[id.name="MOBILE_TOUCH_TARGET_SIZE"]',
          message: 'Bruk shared import fra `constants/accessibility.ts`.',
        },
      ],
    },
  }
);
