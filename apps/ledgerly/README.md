# Ledgerly (arbeidsnavn) — norsk regnskapsplattform

Modulær monolitt i TypeScript for regnskap i norske virksomheter (ENK, AS m.fl.):
ekte dobbelt bokholderi, versjonert regelregister for MVA/skatt, bilagspipeline med
duplikatkontroll og forklarbare forslag, Gmail-inntak bak port (sandbox i MVP),
RBAC og komplett revisjonslogg — alt mot PostgreSQL.

Produktnavnet er konfigurasjon (`PRODUCT_NAME`), ikke en del av domenemodellen.

## Kom i gang

Krever Node ≥ 20 og PostgreSQL ≥ 14.

```bash
cd apps/ledgerly
npm install

# Opprett databaser (eksempel)
createdb ledgerly_dev && createdb ledgerly_test

# Kjør migrasjoner
DATABASE_URL=postgres://<bruker>@localhost:5432/ledgerly_dev npm run migrate

# Kjør testene (bruker TEST_DATABASE_URL, default ledgerly_test lokalt)
npm test

# Start API-et (dev)
npm run dev
```

## Struktur

```
migrations/          SQL-migrasjoner (append-only, sha256-låst)
scripts/migrate.ts   Migrasjonsrunner
src/
  shared/            Money (bigint-ører — aldri flyttall), id-er, feiltyper
  rules/             Versjonert regel- og kilderegister (norske satser m/ kilder)
  coa/               Kontoplan (NS 4102-basert) og SAF-T MVA-koder m/ forklaringer
  ledger/            Bokføringsmotor (debet=kredit, periodelås, reversering,
                     idempotens, append-only) og rapporter
  vat/               Deterministisk MVA-beregning og MVA-spesifikasjon
  tax/               Skatteestimat med regelversjoner og eksplisitt usikkerhet
  documents/         Bilagsmottak, sha256-integritet, duplikatkontroll, validering
  pipeline/          Uttrekk → validering → forslag → godkjenning → bokføring
  ingestion/gmail/   GmailPort + sandbox-adapter + prompt-injection-vern
  orgs/, access/     Organisasjoner, medlemskap, RBAC
  api/               Express-API med autorisasjon per endepunkt
test/                Unit-, property-based- og pg-integrasjonstester
docs/                Produkt-, arkitektur-, sikkerhets- og compliance-dokumentasjon
```

## Viktige prinsipper

- **Penger er bigint-ører.** Flyttall forekommer aldri i beløpslogikk.
- **Bokført er bokført.** UPDATE/DELETE på journalen stoppes både i kode og av
  database-triggere; feil rettes med reverseringsbilag.
- **Regler er data.** Satser/grenser ligger i `src/rules/no/` med gyldighetsperiode,
  offisiell kilde og versjon — aldri hardkodet i logikken.
- **AI foreslår, mennesker godkjenner.** Forslag følger et validert zod-skjema med
  `requiresHumanReview: true`; rapporterte tall kommer alltid fra hovedboken.
- **Ærlig integrasjonsstatus.** Gmail kjører mot sandbox-adapter til ekte
  OAuth-nøkler finnes; API-et rapporterer `mode: 'sandbox', active: false`.

Se `docs/known-limitations.md` for hva som bevisst ikke er bygget ennå.
