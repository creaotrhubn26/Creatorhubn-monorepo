# Bokføringsmotoren

Kilde: `src/ledger/engine.ts`, `src/ledger/reports.ts`, `migrations/0001_foundation.sql`.

## Invarianter

Håndheves i applikasjonskoden, med databasen som forsvar i dybden der det er mulig
(linjenivå-CHECKs og append-only-triggere; selve balansesummen per postering
kontrolleres i applikasjonslaget):

1. **Debet = kredit.** Hver postering må ha minst to linjer, hver linje har nøyaktig
   ett av debet/kredit > 0, og summene må være like i øre (bigint). Ubalanserte
   posteringer kastes med `UnbalancedEntryError`. Nullposteringer avvises.
   (Håndheves i `validateLines` før insert; databasen håndhever linjenivå-reglene.)
2. **Append-only.** Bokførte posteringer endres eller slettes aldri. DB-triggere
   (`forbid_mutation`, `journal_entries_guard` — skjerpet i
   `migrations/0002_harden_journal_guard.sql`) nekter UPDATE/DELETE på
   `journal_entries`/`journal_lines` — eneste tillatte endring er statusovergangen
   `posted → reversed`. Dette gjelder også ved direkte SQL utenom applikasjonen.
3. **Periodelås.** Hver postering knyttes til en `accounting_periods`-rad (år/måned).
   Låst periode avviser nye posteringer med `PeriodLockedError`; feil rettes med
   korrigeringspostering i en åpen periode. `lockPeriod` krever begrunnelse og logges.
4. **Reversering, ikke sletting.** `reverseJournalEntry` bokfører en ny postering med
   debet/kredit byttet, merker originalen `reversed`, krever begrunnelse
   (revisjonsspor) og bruker idempotensnøkkel `reversal:<entryId>` — en postering kan
   bare reverseres én gang.
5. **Idempotensnøkkel.** `idempotencyKey` er påkrevd for all bokføring og unik per
   organisasjon (DB-constraint). Gjentatt kall med samme nøkkel returnerer den
   eksisterende posteringen med `alreadyExisted: true` — aldri dobbel bokføring.
   Pipeline bruker `document:<documentId>`, så samme bilag kan aldri bokføres to ganger.
6. **Valuta.** Alt bokføres i NOK, men linjer i utenlandsk valuta lagrer
   `original_currency`, `original_amount_minor`, `exchange_rate` (desimalstreng, parses
   eksakt uten flyttall — `convertToNok` i `src/shared/money.ts`) og
   `exchange_rate_source`. Alle fire feltene kreves sammen (validering + bokføring
   avviser dokument i utenlandsk valuta uten oppgitt kurs med kilde).

I tillegg: løpende bilagsnummer per organisasjon uten hull (radlås på
`organization_counters`), kontoer må finnes aktive i organisasjonens kontoplan,
MVA-koder må finnes i `src/coa/vat-codes.ts`, og revisjonshendelsen skrives i **samme
databasetransaksjon** som posteringen.

## Rapporter

Alle rapporter i `src/ledger/reports.ts` avledes **deterministisk fra `journal_lines`**
(joinet med `journal_entries` for dato/status). Ingen mellomlagrede saldoer, ingen
AI-genererte tall.

- **Saldobalanse** (`trialBalance`): SUM(debet), SUM(kredit) og saldo per konto,
  med dato-/prosjekt-/avdelingsfilter.
- **Resultat** (`incomeStatement`): avledet av saldobalansen — kreditsaldo på
  inntektskontoer = inntekt, debetsaldo på kostnadskontoer = kostnad.
- **Balanse** (`balanceSheet`): eiendeler, gjeld, egenkapital og udisponert
  periode-resultat, slik at eiendeler = gjeld + EK + resultat kan kontrolleres.
- **Hovedbok** (`generalLedger`): alle bevegelser per konto med toveis spor til bilag
  (`entry_id`) og kildedokument (`source_document_id`).
- **Reskontro** (`subledger`): saldo per leverandør (2400) / kunde (1500) via
  `vendor_id`/`customer_id` på linjene.

Reverserte bilag tas med i rapportene — reverseringslinjene nuller dem ut, og
historikken forblir synlig. MVA-rapporten (`src/vat/engine.ts`) og skatteestimatet
(`src/tax/estimate.ts`) bygger på samme prinsipp: hver krone kan følges tilbake til
posteringslinjer.
