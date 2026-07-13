# Arkitektur

## Overordnet

Modulær monolitt i TypeScript på Node.js, med Express som HTTP-lag og PostgreSQL som
eneste database. Én prosess (`src/api/main.ts`), tydelige moduler med eksplisitte
avhengigheter — ingen mikroservices, ingen meldingskø.

## Domenegrenser (mappestruktur)

| Mappe | Ansvar |
|---|---|
| `src/shared/` | Penger (bigint-ører), feiltyper, ID-generering |
| `src/rules/` | Versjonert regel- og kilderegister (satser, grenser) |
| `src/coa/` | Kontoplan (NS 4102-basert) og SAF-T MVA-koder med brukervennlig metadata |
| `src/ledger/` | Bokføringsmotor (postering, reversering, periodelås) og rapporter |
| `src/vat/` | MVA-beregning og MVA-rapport |
| `src/tax/` | Skatteestimat |
| `src/documents/` | Dokumentmottak, sha256, duplikat, uttrekkslagring, validering |
| `src/pipeline/` | Vertikal flyt: inntak → uttrekk → validering → forslag → bokføring |
| `src/ingestion/gmail/` | Gmail-port, sandbox-adapter, sanitering av ubetrodd tekst |
| `src/access/` | RBAC (roller × rettigheter) |
| `src/orgs/` | Organisasjoner, brukere, medlemskap |
| `src/audit/` | Revisjonslogg |
| `src/api/` | Express-server, autentisering, feiloversettelse ved systemgrensen |
| `migrations/` | Rå SQL-migrasjoner (`0001_foundation.sql`) |

## Bærende beslutninger

- **Beløp er BIGINT-ører.** Aldri flyttall — verken i beregning, lagring eller transport.
  `src/shared/money.ts` gjør all aritmetikk med `bigint` og rasjonale faktorer;
  API-et serialiserer bigint som strenger (`toJson` i `src/api/server.ts`).
- **Append-only-journal med DB-triggere.** Applikasjonen gjør aldri UPDATE/DELETE på
  `journal_entries`/`journal_lines`/`audit_events`, og databasen håndhever det med
  triggere som forsvar i dybden (`migrations/0001_foundation.sql`). Feil rettes med
  reversering, ikke endring.
- **Idempotens.** All bokføring krever `idempotency_key` med unik constraint per
  organisasjon; Gmail-import og dokumentmottak er idempotente på melding-/innholdsnivå.
- **AI bak port med zod-validering.** Uttrekk (`DocumentExtractor`) og forslag
  (`SuggestionEngine`) er grensesnitt. MVP bruker deterministiske implementasjoner;
  en AI-motor kan plugges inn, men output MÅ validere mot `postingSuggestionSchema`
  (zod) og satser hentes alltid fra regelregisteret — aldri fra modelltekst.
- **Rapporter avledes fra hovedboken.** Aldri fra AI eller cache (`src/ledger/reports.ts`).

## Hvorfor ikke mikroservices

- Regnskap krever transaksjonell konsistens: postering, bilagsnummer, periodelås og
  revisjonslogg skrives i samme databasetransaksjon. Det er trivielt i én prosess og
  vanskelig/dyrt distribuert.
- Teamet og domenet er lite; nettverksgrenser mellom moduler gir kostnad uten gevinst nå.
- Modulgrensene i mappestrukturen er de fremtidige tjenestegrensene hvis skalering
  en gang krever det.

## Plassering i monorepoet

Ledgerly ligger som **selvstendig app** under `apps/ledgerly` med egen `package.json`,
egne migrasjoner, egen database og egne tester. Den deler ikke kode, skjema eller
runtime med Creatorhub-backenden. Begrunnelse og forkastede alternativer:
`docs/decision-log.md`.
