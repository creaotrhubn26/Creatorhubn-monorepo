import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Backend never had an ESLint 9 flat config (only .ts run before was via
// `--ext .ts`, which needs this file to exist at all — `npm run lint` was
// hard-failing repo-wide). Never linted before, so — same approach as
// frontend/eslint.config.js — baseline the noisy pre-existing-violation
// rules to 'warn' (visible, doesn't block the gate) and keep real bug-risk
// rules at 'error'. Ratchet down over time.
export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'build', 'coverage', '**/*.bak*', '**/*.backup*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node-scripts (backend/scripts/**) og noen .mjs kjører delvis i en
    // Playwright page.evaluate()-kontekst (document/window) — browser-globals
    // dekker begge. no-undef er uansett av under (redundant med tsc for .ts,
    // og upålitelig på tvers av Node/browser-kontekst for .js/.mjs/.cjs).
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.es2021 },
    },
  },
  {
    // Aldri lintet før — samme tilnærming som frontend/eslint.config.js:
    // baselin de støyende pre-eksisterende bruddene til 'warn' (synlig,
    // blokkerer ikke gaten), behold ekte bug-nære regler på 'error'.
    files: ['**/*.{ts,js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-unused-vars': 'off',
      'no-undef': 'off', // tsc håndterer .ts; Node/browser-kontekst er upålitelig for .js/.mjs/.cjs
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-case-declarations': 'warn',
      'no-empty': 'warn',
      'no-empty-pattern': 'warn',
      'no-useless-escape': 'warn',
      'no-useless-catch': 'warn',
      'no-extra-boolean-cast': 'warn',
      'prefer-const': 'warn',
      'prefer-rest-params': 'warn',
      'no-irregular-whitespace': 'warn',
      'no-control-regex': 'warn',
      'no-constant-binary-expression': 'warn',
      // Bug-nære — håndhevet.
      'no-sparse-arrays': 'error',
      'no-misleading-character-class': 'error',
      'no-async-promise-executor': 'error',
    },
  },
);
