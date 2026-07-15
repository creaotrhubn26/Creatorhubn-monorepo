# CH-ARCH — Arkitekturregelregister

> **Kilde til sannhet for CreatorHub-frontendens arkitektoniske invarianter.**
> Hver `CH-ARCH-00x` er født av en konkret produksjonshendelse (whitescreen,
> feilet deploy, shippet UI-bug). Registeret gjør taus stammekunnskap —
> spredt i kode-kommentarer, PR-er og `memory.md` — til en oppdagbar,
> vedlikeholdbar katalog med stabile ID-er.

## Hvorfor et register?

Kodebasen har akkumulert **feilklasser** over mange arbeidsrunder: samme type
feil dukker opp i ny fil, blanker en flate eller bryter en deploy, blir fikset,
og glemmes — helt til neste forekomst. Mønsteret som faktisk fungerer er
**incident → rule**: når en feilklasse har truffet ≥2 ganger, kodifiseres den
til en regel som en maskin håndhever (ESLint, git-hook, tsconfig eller CI-gate),
og regelen får en `CH-ARCH`-ID her. Da stopper klassen å gjenta seg, og en ny
utvikler (eller agent) kan slå opp *hvorfor* invarianten finnes uten å grave i
git-historikk.

`CH-ARCH` = **C**reator**H**ub **Arch**itecture. ID-er er stabile og
gjenbrukes aldri; en pensjonert regel markeres «Utgått», ikke slettet.

## Status- og mekanismenøkkel

| Status | Betydning |
| --- | --- |
| 🟢 **Håndhevet** | En maskin blokkerer eller flagger brudd automatisk. |
| 🟡 **Kandidat** | Dokumentert feilklasse, ennå ikke mekanisert. Fanges kun av manuell review. Har et konkret mekaniserings-forslag. |
| ⚪ **Utgått** | Ikke lenger relevant (arkitektur endret). Beholdt for historikk. |

| Mekanisme | Hvor | Blokkerer? |
| --- | --- | --- |
| **ESLint** | `frontend/eslint.config.js` + `frontend/eslint-rules/` | Nei (IDE/`npm run lint`-signal; ikke i required CI) |
| **Pre-push** | `.githooks/pre-push` | Ja lokalt (omgås med `--no-verify`) |
| **CI-gate** | GitHub Actions «Frontend tsc --noEmit» | Ja (eneste *required* check) |
| **tsconfig** | `frontend/tsconfig.json` paths | Ja (via CI-gaten — feil oppstår i tsc) |

---

## Registeret

| ID | Tittel | Status | Mekanisme |
| --- | --- | --- | --- |
| [CH-ARCH-001](#ch-arch-001) | Delte a11y-konstanter (touch-target) | 🟢 Håndhevet | ESLint (error) |
| [CH-ARCH-002](#ch-arch-002) | Ingen React-hooks kalt inline i JSX | 🟢 Håndhevet | ESLint (error) |
| [CH-ARCH-003](#ch-arch-003) | `<ErrorBoundary>` over hver `<Suspense>` | 🟢 Håndhevet | ESLint (warn) |
| [CH-ARCH-004](#ch-arch-004) | `backend/package-lock.json` i sync | 🟢 Håndhevet | Pre-push |
| [CH-ARCH-005](#ch-arch-005) | Ingen `await import('@/…')` (rollup) | 🟢 Håndhevet | Pre-push |
| [CH-ARCH-006](#ch-arch-006) | Én zod-kopi i frontend-treet | 🟢 Håndhevet | tsconfig + CI-gate |
| [CH-ARCH-007](#ch-arch-007) | Ingen dyp `@mui/icons-material/*Outline`-import | 🟡 Kandidat | (foreslått ESLint) |
| [CH-ARCH-008](#ch-arch-008) | Desktop/Tauri-origin i backend CORS-allowlist | 🟡 Kandidat | (foreslått test) |

---

### CH-ARCH-001

**Delte a11y-konstanter (touch-target) — ikke re-deklarer lokalt.** · 🟢 Håndhevet · ESLint (error)

- **Hendelse:** Design-system-audit fant duplikate `TOUCH_TARGET_SIZE` /
  `MOBILE_TOUCH_TARGET_SIZE`-deklarasjoner spredt over Role Room-paneler →
  inkonsistente touch-mål på tvers av flater. Konsolidert i fase 1–3
  (commits `ad5e5536..0f237391`) til én delt `constants/accessibility.ts`.
- **Regel:** I `client/src/components/role-room/**` er lokal re-deklarasjon av
  disse konstantene forbudt. Bruk
  `import { TOUCH_TARGET_SIZE } from "../constants/accessibility"`.
- **Håndhevelse:** `no-restricted-syntax` (`error`) i `eslint.config.js`, selector
  `VariableDeclarator[id.name="TOUCH_TARGET_SIZE"]` (+ `MOBILE_…`).
- **Slik retter du:** Slett den lokale `const`, importer fra den delte modulen.

### CH-ARCH-002

**Ingen React-hooks kalt inline i JSX.** · 🟢 Håndhevet · ESLint (error)

- **Hendelse:** `FormationViewConnected` + `AnnotationExportOverlay` shippet
  UI-bugs der en hook ble kalt inne i en JSX-prop-verdi
  (`<Comp notes={React.useMemo(...)} />`). Resultat: hooken kjører på nytt hver
  render (ny referanse → unødvendige re-renders), og — verre — hvis foreldren er
  Suspense-wrappet eller bak en early-return, *varierer antall hooks mellom
  renders* → «rendered fewer/more hooks than expected» → brakte ned alle
  `dance-*` spec-er. ESLints `react-hooks/rules-of-hooks` fanger IKKE dette.
- **Regel:** Kall aldri en `use*`-hook inne i JSX. Ekstrahere til en
  `const` FØR `return (`, referer så variabelen i prop-en.
- **Håndhevelse:** `no-restricted-syntax` (`error`), 2 selectors (både `React.use*`
  og named `use*` i `JSXExpressionContainer > CallExpression`), Role Room-scope.
- **Slik retter du:** Løft hook-kallet ut av JSX. Er det en ren utility som
  tilfeldigvis starter med «use», whitelist med `// eslint-disable-next-line`.
- **Se:** `docs/dance/live-demo.md`.

### CH-ARCH-003

**`<ErrorBoundary>` over hver `<Suspense>`-grense.** · 🟢 Håndhevet · ESLint (warn)

- **Hendelse:** En `React.lazy`-komponent som suspenderer under en **synkron**
  state-oppdatering (fane-bytte fra klikk/⌘K/input) kaster React **#426**; uten
  en ErrorBoundary over grensen propagerer kastet forbi og **blanker hele flaten**
  (whitescreen). Samme gjelder om lazy-chunken feiler å laste.
- **Regel:** Enhver `<Suspense>` / `<React.Suspense>` skal ha en
  `*ErrorBoundary`-forelder i **samme fil** (konvensjonen er å co-lokalisere
  boundaryen med Suspense-/fane-innholdet, helst keyet på fane/rute for
  auto-recovery). Ligger boundaryen bevisst i en komponerende foreldre-fil,
  silence med `// eslint-disable-next-line ch-arch/require-error-boundary-on-suspense`
  + kort begrunnelse.
- **Håndhevelse:** Egen regel `eslint-rules/require-error-boundary-on-suspense.js`
  (`warn`), matcher på element-NAVN så alias (`RealErrorBoundary`) teller.
- **Utrulling:** PR #1470–#1474 (fikser + regel), PR #1475 tømte backloggen
  (76 treff / 33 filer → 0). R3F-særtilfelle: wrap `<Canvas>` på DOM-nivå, ikke
  Suspense inne i r3f-treet (DOM-fallback der krasjer reconcileren).
- **Slik retter du:** `import ErrorBoundary from '@/components/common/ErrorBoundary'`,
  wrap `<Suspense>` i `<ErrorBoundary componentName="<kebab>">`, `key={…}` der en
  åpenbar fane-/rute-/id-variabel er i scope.

### CH-ARCH-004

**`backend/package-lock.json` skal være i sync med `package.json`.** · 🟢 Håndhevet · Pre-push

- **Hendelse:** Dockerfilen kjører `npm ci` frittstående i `/app/backend`. En
  usynket lockfil får `npm ci` til å feile → Render-deploy dør. Denne fella har
  kostet ~3 uker med feilede deploys.
- **Regel:** Push aldri en `backend/package.json`-endring uten å regenerere
  lockfilen.
- **Håndhevelse:** `.githooks/pre-push` Check 1 — kjører
  `npm install --package-lock-only` og avviser push hvis lockfilen drifter.
- **Slik retter du:**
  `cd backend && npm install --workspaces=false --package-lock-only`, commit
  `backend/package-lock.json`.

### CH-ARCH-005

**Ingen `await import('@/…')` — rollup kan ikke resolve `@`-alias i dynamiske imports.** · 🟢 Håndhevet · Pre-push

- **Hendelse:** Lokal tsc passerer, men Vercels prod-build (rollup) klarer ikke
  `@`-aliaset inne i en dynamisk `await import(...)` → build feiler først i
  prod. Traff bl.a. `linkedin-prep-routes` (fikset i #1330).
- **Regel:** Bruk relativ sti i dynamiske imports (`await import('../services/foo')`),
  ikke `@/`-aliaset. (Statiske top-level imports med `@/` er OK.)
- **Håndhevelse:** `.githooks/pre-push` Check 2 — grep-scan av
  `frontend/client/src` avviser push ved treff.
- **Slik retter du:** Bytt `@/<path>` → relativ sti i det dynamiske import-kallet.

### CH-ARCH-006

**Én zod-kopi i frontend-treet.** · 🟢 Håndhevet · tsconfig + CI-gate

- **Hendelse:** `npm ci` i workspace hoistet to zod-kopier (frontendens 4.4.3 +
  en rot-hoistet via en transitiv kjede som `drizzle-zod` traff som `zod/v4`).
  Inkompatible interne typer → 27 tsc-feil uten en eneste kildeendring
  (PR #1319). Lockfile-pin i `frontend/package-lock.json` er NO-OP — workspace
  leser rot-lockfilen.
- **Regel:** zod skal alltid resolve til frontendens ene kopi.
- **Håndhevelse:** `tsconfig.json` `paths` tvinger `zod` → frontendens kopi;
  brudd manifesterer som type-feil i CI-gaten «Frontend tsc --noEmit».
- **Slik retter du:** Verifiser `paths`-mappingen; ikke stol på lockfile-pin i
  frontend-mappa. «0 feil lokalt» er falskt ved ufullstendig `node_modules`.

### CH-ARCH-007

**Ingen dyp `@mui/icons-material/*Outline`-import.** · 🟡 Kandidat · (foreslått ESLint)

- **Hendelse:** `@mui/icons-material` v9 path-import av et `*Outline`-ikon (uten
  rot-`.js`) bryter Rollup ved bundling av Tauri-appen
  (`apps/resolve-script-manager`). CI typesjekker den appen men **bundler den
  aldri** → build-brytende feil passerer grønt (PR #1242). «tsc + CI grønt» ≠
  «appen bygger».
- **Regel:** Bruk `*Outlined`-varianten eller barrel-importen
  (`import { FooOutlined } from '@mui/icons-material'`), aldri en dyp
  `@mui/icons-material/FooOutline`-sti.
- **Mekaniseringsforslag:** `no-restricted-imports` med pattern
  `@mui/icons-material/*Outline` (error), scoped `apps/resolve-script-manager` +
  `client/src`. Alternativt en CI-jobb som faktisk kjører `vite build` på
  Tauri-appen.
- **Slik retter du:** Bytt til `*Outlined` eller barrel-import.

### CH-ARCH-008

**Desktop/Tauri-origin må stå i backend CORS-allowlist.** · 🟡 Kandidat · (foreslått test)

- **Hendelse:** Innlogging i desktop-appen bruker webview-`fetch` (CORS).
  `KNOWN_ORIGINS` i `backend/server/index.ts` manglet `tauri://localhost` →
  dev-bygg virket (localhost tillatt) men signert release feilet med «TypeError:
  Load failed» ved login (PR #1250). Diagnose:
  `curl -H "Origin: tauri://localhost" -D -` → manglende `Access-Control-Allow-Origin`.
- **Regel:** Enhver origin en klient faktisk sender fra (`tauri://localhost`,
  signerte desktop-schemes) må finnes i `KNOWN_ORIGINS`.
- **Mekaniseringsforslag:** En backend-test som asserterer at
  `tauri://localhost` (og andre kjente desktop-origins) er i allowlisten, så
  fjerning fanges i CI.
- **Slik retter du:** Legg origin i `KNOWN_ORIGINS`; verifiser med `curl`-ACAO-probe.

---

## Slik legger du til en regel (incident → rule-pipeline)

1. **Vent på klasse, ikke enkeltfeil.** Én forekomst = fiks den. ≥2 forekomster
   av *samme feilklasse* = kandidat for en regel.
2. **Velg letteste maskin som fanger klassen:**
   - Syntaktisk mønster i frontend-kildekode → **ESLint** (`no-restricted-syntax`
     for AST-selectors, eller en egen regel i `eslint-rules/` når du trenger
     kontekst på tvers av noder — se `require-error-boundary-on-suspense.js` som
     mal).
   - Deploy-/build-felle som lokal tsc ikke ser → **pre-push hook**.
   - Type-invariant → **tsconfig** + den required CI-gaten.
3. **Tildel neste ledige `CH-ARCH`-ID** (aldri gjenbruk) og legg en rad i
   registeret over + en full seksjon med *Hendelse / Regel / Håndhevelse /
   Slik retter du*.
4. **Backlink fra koden:** sett `// CH-ARCH-00x — se docs/architecture-rules.md`
   der regelen håndheves, så kode og register peker på hverandre.
5. **Rydd eksisterende brudd** i samme eller oppfølgende PR (som PR #1475 for
   003), slik at regelen starter fra 0 treff.

Hold ESLint-regler på `warn` med mindre klassen har brakt ned CI/prod — da er
`error` eller en pre-push-blokkering riktig. Den eneste *required* CI-gaten er
«Frontend tsc --noEmit»; ESLint-signalet er bevisst ikke-blokkerende for å ikke
innføre en andre rød gate for stilistiske ting.

## Referanser

- Regelimplementasjoner: `frontend/eslint.config.js`,
  `frontend/eslint-rules/require-error-boundary-on-suspense.js`,
  `.githooks/pre-push`, `frontend/tsconfig.json`.
- Hendelseshistorikk: PR #1242 (007), #1250 (008), #1319 (006), #1330 (005),
  #1470–#1475 (003).
