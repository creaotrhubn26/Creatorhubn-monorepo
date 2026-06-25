# Admin UX/UI — ærlig status + E2E/tidiness-verifisering (for Claude Code)

Dette notatet er **ærlig** om hva PR #922 (branch
`claude/admin-dashboard-ux-ui-tofaae`) faktisk inneholder, og hva som
GJENSTÅR å verifisere/forbedre — slik at det kan tas videre i Claude Code med
et kjørende miljø (sandkassen kunne hverken kjøre app eller backend).

## Hva som FAKTISk er gjort
- **Oversikt-gruppen:** reell UX/IA-opprydding — KPI-stripe, progressiv visning
  (Sammendrag/Statistikk/Aktivitet) mot scroll-overload, ekte pålogget-status i
  kommunikasjonspanelet, virtualiserte tabeller.
- **Forretning + Plattform:** i hovedsak **tema-/konsistens-harmonisering**
  (mørkt `adminDarkTheme`, lyse farger → mørke, `themeColors.primary` → #ff8c00,
  opake dialoger/menyer/tabell-headere) + **virtualisering** av de store
  tabellene (LeadMap, invitasjoner, UserCost, Tidum) + roligere polling.

## ⚠️ Hva som IKKE er gjort (verifiseringsgap)
1. **Ingen E2E-/runtime-verifisering.** Alt er kun bekreftet med `tsc --noEmit`
   + Vite-transform = koden **kompilerer**. Det er IKKE bevist at panelene
   *fungerer* (klikk, lagring, dialoger, datalasting) etter endringene.
2. **Ingen dyp layout-/tidiness-opprydding** på Forretning/Plattform utover tema
   (spacing, informasjonshierarki, tomme-tilstander, lastetilstander,
   responsivt, tastatur/fokus er ikke gjennomgått per panel).
3. **Visuell QA mangler** — fargekontrast og at ingenting ble «mørk-på-mørk»
   eller «lys øy» er ikke sett i nettleser, kun resonnert fra koden.

## STEG 1 — Kjør eksisterende E2E-tester (raskeste trygghet)
Det finnes allerede Playwright-specs som dekker admin-fanene. Kjør dem mot en
lokal dev-server (`npm run dev` på :5001) i `frontend/`:
```
npx playwright test e2e/admin-tabs-smoke.spec.ts --project=chromium
npx playwright test e2e/admin-dashboard-functional.spec.ts --project=chromium
npx playwright test e2e/admin-oversikt-forretning-functional.spec.ts --project=chromium
npx playwright test e2e/admin-plattform-lab-functional.spec.ts --project=chromium
npx playwright test e2e/admin-chat.spec.ts --project=chromium
```
- `admin-tabs-smoke` tar full-screenshot av HVER fane → bruk skjermbildene til
  visuell QA av mørkt tema + kontrast (se etter lyse «øyer», uleselig tekst,
  gjennomsiktige dialog-/tabell-headere).
- De `-functional`-spec-ene verifiserer at fanene rendrer uten 5xx/console-
  errors. Sjekk at ingen av tema-endringene har brutt rendering.

## STEG 2 — UX-tidiness-gjennomgang per gruppe (gjøres i Claude Code)
For hvert panel i Forretning + Plattform, vurder utover tema:
- [ ] **Lastetilstand:** vises skeleton/spinner, eller «hopper» layouten?
- [ ] **Tom tilstand:** egen melding når lister/tabeller er tomme?
- [ ] **Feiltilstand:** vises en lesbar feil (ikke bare blank) ved API-feil?
- [ ] **Hierarki/spacing:** konsistent overskrift→innhold-rytme; ikke vegg av
      kort uten gruppering.
- [ ] **Responsivt:** fungerer på smal bredde (tabeller, knapperader)?
- [ ] **Tastatur/fokus + kontrast:** WCAG AA på tekst mot mørk flate.
- [ ] **Virtualiserte tabeller:** verifiser at sticky header er opak, at
      sortering/handlinger fungerer, og at høyden (600/560px) ser riktig ut.

## STEG 3 — Funksjonelt arbeid allerede dokumentert separat
- `docs/ADMIN-OVERSIKT-OPPFOLGING.md` — presence-for-alle-brukere + send-melding
  fra brukerlisten (backend + auth, kunne ikke kjøres i sandkassen).
- `docs/ADMIN-PRICE-MANAGEMENT-OPPFOLGING.md` — React Query-datalasting,
  validering av `saveEnterprisePricing`, Stripe-drift-statuskort.

## STEG 4 — Valgfri skalering (ikke kritisk)
- IntegrationsManagementPanel har 3 admin-config-tabeller (API-nøkler, webhooks,
  OAuth-klienter) som i praksis er bounded. Virtualiser med `TableVirtuoso`
  (samme mønster som RefundRequestsTable) hvis de vokser.

## Anbefalt rekkefølge i Claude Code
1. Kjør STEG 1 (e2e + screenshots) → fang evt. regresjoner fra tema-runden.
2. Gå gjennom STEG 2 panel for panel der screenshots ser «rotete» ut.
3. Ta funksjonsarbeidet i STEG 3 med live backend.
