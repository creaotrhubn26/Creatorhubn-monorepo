# QA-matrise

**113 tester i 12 filer, alle grønne per siste kjøring (også under TZ=Europe/Oslo). I tillegg kjøres en browserbasert UI-røyktest (`scripts/ui-smoke.mjs`, Playwright/Chromium) som dekker login → org → Gmail-import → forklaring → godkjenning → rapporter/MVA.**

## Kjøring

```
npm run migrate:test   # migrer testdatabasen (TEST_DATABASE_URL)
npm test               # vitest run (vitest.config.ts)
```

Testene deles i to klasser:

- **Rene enhetstester** (money, rules, vat, sanitize/suggest) — ingen database,
  deterministiske, med property-based testing (fast-check) for de matematiske
  invariantene.
- **pg-integrasjonstester** (ledger, pipeline, api) — kjører mot **ekte PostgreSQL**,
  ikke mocks, fordi invariantene som testes (DB-triggere, unike constraints, radlåser,
  transaksjoner) bare finnes i databasen. API-testene bruker supertest mot hele
  Express-appen.

## Dekning per område

| Område | Testfil | Antall | Dekker |
|---|---|:-:|---|
| Penger | `test/money.test.ts` | 9 | Eksakt desimalparsing (norsk/engelsk format), avvisning av for mange desimaler, valutablanding nektes, deterministisk half-up-avrunding, EUR→NOK med eksakt kurs, JPY (0 desimaler). **Property-based** (fast-check): parse ∘ format = identitet; addisjon assosiativ med invers. |
| Regelregister | `test/rules.test.ts` | 8 | Riktig sats per dato; versjonsskifter (aktiveringsgrense 2023→2024, trygdeavgift 2024→2025); tydelig feil uten gyldig versjon; avvisning av overlappende versjoner og ukjente kilder; alle regler har offisiell kilde + kontrolldato; filtrering på org.form/MVA-status. |
| MVA | `test/vat.test.ts` | 8 | Brutto-splitt for 25/15/12 %, nullsats-koder, `vatOfNet` (omvendt avgiftsplikt), `vatAmountMatches`-toleranse. **Property-based**: netto + mva = brutto, mva aldri negativ; split ∘ vatOfNet konsistent innenfor ±1 øre. |
| Bokføringsmotor (pg-integrasjon) | `test/ledger.pg.test.ts` | 11 | MOD11-orgnr; balansert postering med løpende bilagsnummer; avvisning av ubalanse/ukjent konto/ukjent MVA-kode; **idempotens** (samme nøkkel = én postering); **DB-triggere** nekter UPDATE/DELETE; **periodelås**; **reversering** (nuller ut, bevarer historikk, krever begrunnelse); property: vilkårlige balanserte posteringer holder saldobalansen; eiendeler = gjeld + EK + resultat. |
| Pipeline (pg-integrasjon) | `test/pipeline.pg.test.ts` | 12 | **Gmail-import (sandbox)**: kun valgt etikett, private e-poster eksponeres aldri; uttrekk (leverandør, org.nr, beløp, KID) med sumvalidering; idempotent re-import; **duplikat** på forretningsnøkkel (andre bytes, samme fakturanr); godkjenning → korrekt MVA-splitt + reskontro; **valuta** (EUR krever kurs, omvendt avgiftsplikt); MVA-rapport med kode 86; **kontrollspor** postering → Gmail-melding; skatteestimat med regelversjoner; revoked/expired token stopper kontrollert; tomme etiketter skanner ingenting. Karantene (prompt-injection-fixture) dekkes via inntaksflyten. |
| API (pg-integrasjon) | `test/api.pg.test.ts` | 12 | Auth avvises uten/med manipulert token; **tenant-isolasjon** (utenforstående får 404, ikke 403); **RBAC** (ansatt kan laste opp, ikke bokføre/låse); ugyldig org-ID → 400; vertikal flyt over HTTP (opplasting → forslag m/forklaring → bokføring → rapporter); **Scenario 9**: feil i låst periode rettes med kontrollert korrigering; skatteestimat med forbehold; ærlig integrasjonsstatus (Gmail = sandbox); kodebibliotek på vanlig norsk; **karantene** av ikke-tillatte filtyper. |
| Sanitering + forslag | `test/sanitize-suggest.test.ts` | 11 | Injeksjonsmønstre flagges (engelsk + norsk), vanlig fakturatekst slipper gjennom, kontrolltegn/RTL fjernes, ubetrodd tekst pakkes som data; forslagsmotor: kamerautstyr → 6551/kode 1, utenlandsk SaaS → 6810/kode 86, ikke MVA-registrert → kode 0 m/regelreferanse, over aktiveringsgrensen → asset/uncertain m/alternativ, **versjonert grense** (2023 = 15 000), ukjent → 7790 med lav confidence og menneskelig kontroll. |

| `test/invoicing.pg.test.ts` | 10 | KID MOD10 (generering/manipulasjon), eksakt linjeberegning inkl. brøkantall, utstedelse med nummerserie/KID/balansert bokføring, idempotent re-utstedelse, DB-vern mot endring/sletting, utgående MVA i rapporten, KID-innbetalingsmatching → betalt + reskontro, kreditnota med dobbel-vern. |
| `test/dimensions.pg.test.ts` | 8 | Dimensjonsregister (normalisering, duplikat-/formatvern), ukjent kode avvises ved bokføring og faktura, lønnsomhet per prosjekt (inntekt − kostnad), kreditnota reverserer prosjektinntekt, avdelingsrapport adskilt. |
| `test/ocr.pg.test.ts` | 4 | Tesseract-OCR på ekte PNG-fixtures (piksler, ikke tekstlag): leverandør/org.nr/beløp leses korrekt, mobilbilde går hele veien til bokføring, manipulasjonstekst i piksler karanteneres, rawText persisteres aldri. |
| `test/saft.pg.test.ts` | 4 | Velformet XML + validering mot Skatteetatens offisielle XSD (vendored), totaler mot hovedbok, inngående/utgående saldo per periode, escaping av spesialtegn, kunde-/leverandør-master og mva-koder med sats fra regelregisteret. |
| `test/bank.pg.test.ts` | 9 | Objektlagring (innhold + hash, ukjent nøkkel), CSV-parsing (desimalkomma, negative beløp), idempotent import, KID-treff med forklaring, godkjenning som lukker reskontro, ingen falske treff, avvisning med begrunnelse og audit. |

**Sum: 113 tester** (api-filen har nå 18: +journal-endepunkter, +faktura-RBAC).

## Kjente hull i testdekningen

- **Ingen UI-tester** — det finnes ikke noe UI.
- **Ingen ytelses-/lasttester** — ingen målinger av gjennomstrømming eller
  samtidighetsgrenser utover radlås-logikken.
- **Ingen ekte OCR-tester** — uttrekket testes kun mot tekstbærende sandbox-fixtures
  (`pdfLike` i `src/ingestion/gmail/sandbox.ts`), ikke skannede bilder/ekte PDF-er.
- Ingen tester mot ekte Gmail API (finnes ingen produksjonsadapter), ingen
  migrasjons-/rollback-tester, ingen fuzzing av HTTP-laget utover zod-validering.
