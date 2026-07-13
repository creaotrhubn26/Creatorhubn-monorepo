# Dataoppbevaring og sletting

## Bokføringslovens oppbevaringskrav

Hovedregelen etter **bokføringsloven § 13** (LOV-2004-11-19-73, kilde
`lovdata-bokforingsloven` i `src/rules/no/sources.ts`) er at primærdokumentasjon —
bilag, bokførte opplysninger, spesifikasjoner — skal oppbevares i **5 år** etter
regnskapsårets slutt.

**Merk:** kravet er **kildeavhengig** — enkelte dokumenttyper og bransjer har andre
frister (sekundærdokumentasjon har kortere frist; enkelte områder har lengre). De
konkrete fristene per dokumenttype **skal verifiseres mot loven og
bokføringsforskriften før produksjonsbruk**, på samme måte som satsene i
`docs/compliance-source-register.md`. Ingen automatisk slette-/oppbevaringspolicy er
implementert i koden i dag.

## Append-only-design støtter oppbevaringsplikten

Designet gjør det teknisk vanskelig å slette regnskapsdata ved et uhell eller med vilje:

- `journal_entries`, `journal_lines` og `audit_events` er append-only, håndhevet med
  DB-triggere (`migrations/0001_foundation.sql`) — UPDATE/DELETE feiler også for
  direkte SQL.
- Feil rettes med reversering, ikke endring (`src/ledger/engine.ts`); historikken
  beholdes komplett.
- Dokumenters sha256 lagres ved mottak, så innholdsintegritet kan kontrolleres.
- Revisjonsloggen skrives i samme transaksjon som endringen den beskriver.

Merk at selve dokument**innholdet** ikke lagres i MVP (kun hash + metadata, se
`docs/known-limitations.md`) — reell oppfyllelse av oppbevaringsplikten for bilag
krever objektlagring, som ikke er bygget ennå.

## GDPR: sletteforespørsler vs. oppbevaringsplikt

Regnskapsdata inneholder personopplysninger (navn i leverandør-/kundedata, e-post,
bruker-ID-er i revisjonsloggen). Avveiningen er:

- **Retten til sletting (GDPR art. 17) er ikke absolutt.** Art. 17 nr. 3 bokstav b
  unntar behandling som er nødvendig for å oppfylle en **rettslig forpliktelse** —
  som bokføringslovens oppbevaringsplikt. Så lenge oppbevaringsplikten løper, går den
  foran en sletteforespørsel for opplysninger som inngår i regnskapsmaterialet.
- **Systemet skal forklare dette**, ikke bare avslå: en sletteforespørsel som treffer
  bokføringspliktig materiale besvares med hvilken plikt som gjelder, hvilket
  regnskapsår materialet tilhører og når oppbevaringsfristen utløper — deretter kan
  sletting gjennomføres.
- Opplysninger **utenfor** oppbevaringsplikten (f.eks. en brukerkonto uten
  regnskapsspor, karantenerte/avviste dokumenter som aldri ble bokført) kan slettes
  eller anonymiseres uten konflikt. Vurderingen er per datatype, ikke per person.

## Status i koden

Implementert i dag: append-only-vernet, revisjonslogg og hash-basert integritet.
**Ikke implementert:** automatiske oppbevaringsfrister, slette-/anonymiseringsflyt for
GDPR-forespørsler, og objektlagring av selve bilagene. Dette må bygges og fristene
juridisk verifiseres før produksjon.
