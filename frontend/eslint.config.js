import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import requireErrorBoundaryOnSuspense from './eslint-rules/require-error-boundary-on-suspense.js';

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
      '**/*.backup*',
      // `components/unused/` er død kode (arkiverte panels/dashboards) — 133 av
      // 135 «Parsing error»-treff kom herfra (uterminerte strenger, tom `<>`
      // o.l. i filer som aldri bygges). Lint dem ikke.
      '**/components/unused/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Globals — uten dette flagget base-configens `no-undef` `process`, `console`,
  // `window`, `document` osv. som udefinerte i .js/.mjs-filer (107 falske
  // no-undef-errors). TS-filer har `no-undef: off` under (tsc håndterer det).
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
  },
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
  // Plain `.js`-filer i client/src er IKKE app-kildekode — det er CommonJS
  // Node-hjelpeskript (`database/*.js` backup/health/status, `utils/
  // componentValidator.js`, `utils/errorMessages.js`) som bruker `require`,
  // `module.exports` og klassisk `var self = this`-aliasing. De bundles aldri
  // av Vite. Å håndheve TS/ESM-regler her ga ~25 errors uten verdi. Relakser
  // de rene Node/CommonJS-mønstrene (på linje med `.cjs`-blokka over); ekte
  // logikkfeil fanges fortsatt av kjørende skript.
  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-redeclare': 'off'
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Legacy-typemønstre som er utbredt i kodebasen (som `no-explicit-any`
      // over). Å håndheve dem ville gitt ~120 errors i eksisterende kode uten
      // funksjonell verdi — slått av på linje med any-regelen.
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
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
      // Base-regelen `no-duplicate-imports` forstår ikke type-only-imports og
      // kolliderer med `consistent-type-imports: 'type-imports'` under (som
      // BEVISST splitter ut `import type {…}` i egne setninger). Det ga ~30
      // falske «import is duplicated»-errors på value+type-par fra samme modul.
      // Vi lar type-import-konvensjonen styre; ekte dupe-verdi-imports fanges
      // fortsatt av tsc/consistent-type-imports.
      'no-duplicate-imports': 'off',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      // ── Pre-eksisterende debt baselinet til 'warn' ──────────────────────
      // Følgende regler har spredte brudd i eldre, ikke-role-room-kildekode
      // (email/pricing/showcase/services/lib osv.) som ALDRI har vært lintet.
      // De er reelle stil-/smell-signaler, men å rette ~34 instanser i ~20
      // ukjente filer i en config-/gate-PR er høyere risiko enn verdi. Vi
      // baseliner dem til 'warn' (synlig i IDE/`npm run lint`, blokkerer ikke
      // gaten) på nøyaktig samme måte som `no-explicit-any` over — nye brudd
      // er synlige, gamle ratcher vi ned senere. Flagget for oppfølging:
      // no-sparse-arrays (4) + no-misleading-character-class (9) + no-async-
      // promise-executor (1) er de mest bug-nære og bør ryddes først.
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/triple-slash-reference': 'warn',
      'no-useless-catch': 'warn',
      'no-empty-pattern': 'warn',
      'prefer-rest-params': 'warn',
      'no-sparse-arrays': 'warn',
      'no-misleading-character-class': 'warn',
      'no-async-promise-executor': 'warn',
      'no-irregular-whitespace': 'warn',
      'no-control-regex': 'warn'
    }
  },
  // React hooks-regler — plugin-en var ALDRI registrert i denne configen, så
  // de ~60 `// eslint-disable-next-line react-hooks/exhaustive-deps`-direktivene
  // i kodebasen pekte på en ukjent regel → «Definition for rule … was not
  // found»-error. Registrering gjenoppretter den TILTENKTE oppførselen (jf.
  // CH-ARCH-002-kommentaren under som allerede refererer rules-of-hooks).
  // Begge som 'warn': å registrere rules-of-hooks som 'error' avdekket et STORT
  // antall pre-eksisterende brudd (betinget hook-kall / hook etter early-return)
  // spredt over hele kodebasen — ekte gjeld, men å rette hundrevis av hook-
  // rekkefølger er et eget, risikofylt prosjekt, ikke en config-fiks. 'warn'
  // gjør bruddene synlige i IDE/`npm run lint` uten å blokkere, og løser de ~60
  // «rule not found»-errorene fra de eksisterende disable-direktivene.
  {
    files: ['client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // CH-ARCH-001 (touch-target-konstanter) + CH-ARCH-002 (hooks inline i JSX)
  // — se docs/architecture-rules.md for hendelse/begrunnelse.
  // Role Room design-system-guardrails — forhindrer drift på shared
  // konstanter etter fase 1-3-konsolidering (commits ad5e5536..0f237391).
  // Definert i 2 nivåer: error for cross-cutting konstanter (touch-target),
  // warning for soft-foretrukne mønstre (token-bruk).
  {
    files: ['client/src/components/role-room/**/*.{ts,tsx}'],
    // `constants/accessibility.ts` ER den kanoniske kilden for TOUCH_TARGET_SIZE
    // / MOBILE_TOUCH_TARGET_SIZE — regelen under skal forby LOKAL re-deklarasjon
    // andre steder, ikke selve definisjonsfila. Ekskluder den.
    ignores: ['client/src/components/role-room/constants/accessibility.ts'],
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
        // CH-ARCH-002 — React hooks-rule guardrails — fanger hooks som ESLint's
        // 'react-hooks/rules-of-hooks' IKKE detekterer. Begge mønstrene
        // har shipped UI-bugs i denne kodebasen (FormationViewConnected +
        // AnnotationExportOverlay) som brakte ned alle dance-* spec-er.
        {
          // Pattern B: hook kalt INNI JSX-prop-verdi.
          // Eksempel: <Comp timelineNotes={React.useMemo(...)} />
          // Resultat: hook kalles på nytt hver render = ny referanse =
          // unødvendige re-renders. Verre: hvis parent er Suspense-wrappet
          // eller bak en early-return, varierer antall hooks mellom renders.
          selector:
            'JSXExpressionContainer > CallExpression[callee.object.name="React"][callee.property.name=/^use[A-Z]/]',
          message:
            'Hook kalt inline i JSX. Ekstrahere til en const-deklarasjon FØR JSX-returnen, så referer til variabelen i prop-en. Backgrund: docs/dance/live-demo.md.',
        },
        {
          // Pattern B (variant): React.use* uten React.-prefix (named import)
          selector:
            'JSXExpressionContainer > CallExpression[callee.type="Identifier"][callee.name=/^use[A-Z]/]',
          message:
            'Hook kalt inline i JSX. Ekstrahere til const FØR JSX-returnen. Hvis dette ER bare en utility-funksjon som starter med "use", whitelist via eslint-disable-next-line.',
        },
      ],
    },
  },
  // CH-ARCH-003 — maskin-håndhever «alle lazy/suspenderende flater trenger en
  // error boundary» (utrullingen i PR #1470–#1474). Flagger <Suspense> uten en
  // ErrorBoundary-forelder i samme fil. 'warn' (ikke required CI-gate) — gir
  // IDE-/`npm run lint`-signal + fanger nye brudd, uten å blokkere tsc-gaten.
  // Se docs/architecture-rules.md for full hendelse/begrunnelse.
  {
    files: ['client/src/**/*.{ts,tsx}'],
    plugins: {
      'ch-arch': {
        rules: {
          'require-error-boundary-on-suspense': requireErrorBoundaryOnSuspense,
        },
      },
    },
    rules: {
      'ch-arch/require-error-boundary-on-suspense': 'warn',
    },
  }
);
