# Regelmotoren

Kilde: `src/rules/types.ts`, `src/rules/register.ts`, `src/rules/no/rules.ts`,
`src/rules/no/sources.ts`.

## Prinsipp

Satser, grenser og frister hardkodes **aldri** i applikasjonslogikken. De ligger i et
versjonert register med gyldighetsperiode, kilde og revisjonshistorikk, og slås opp
per transaksjonsdato. Juridisk/matematisk sannhet ligger i deterministisk kode + disse
tabellene — aldri i en språkmodellprompt.

Eksempler på forbrukere: MVA-motoren henter sats per kode og dato
(`src/vat/engine.ts`), skatteestimatet henter skattesats og trygdeavgift per dato
(`src/tax/estimate.ts`), forslagsmotoren henter aktiveringsgrensen
(`no.asset.expense-threshold`) i stedet for et hardkodet beløp (`src/pipeline/suggest.ts`).

## Datamodell

- **`RuleSource`** — offisiell kilde: `sourceId`, `title`, `type` (lov, forskrift,
  skatteetaten, altinn, bronnoysund, regnskapsstandard, saf-t-dokumentasjon,
  google-dokumentasjon), `url`, `lastVerified` (dato innholdet sist ble kontrollert),
  `verifiedBy`. Blogginnlegg og konkurrenters hjelpesider brukes aldri som kilde.
- **`TaxRule`** — regelen: `ruleId`, `shortName`, `plainExplanation` (vanlig norsk),
  `technicalExplanation` (med lovhjemmel), `sourceIds`, anvendelsesområde
  (`appliesToOrgForms`, `appliesToVatStatus`, `appliesToSituations`),
  `calculationMethod`, `documentationRequirements`, `riskLevel`, `lastReviewed`,
  `reviewedBy` og en liste `versions`.
- **`TaxRuleVersion`** — én verdi-periode: `version`, `validFrom`/`validTo`
  (ISO-datoer, inklusiv; åpen `validTo` = fortsatt gyldig), `parameters`, `changeNote`.

**Parametre er rasjonale tall** — `{ numerator, denominator }` som strenger (f.eks.
25/100 for 25 %) eller heltallsstrenger (f.eks. ørebeløp) — aldri flyttall.
`parseRationalParam` konverterer til `bigint`-brøk for eksakt aritmetikk med
`multiplyRational` i `src/shared/money.ts`.

## Oppslag per dato

`RuleRegister` (`src/rules/register.ts`) er et rent oppslagsverk:

- `getVersionAt(ruleId, isoDate)` — finner versjonen som gjaldt på datoen; feiler
  tydelig hvis ingen versjon dekker datoen (ingen stille fallback).
- `getRationalParamAt(ruleId, param, isoDate)` — henter en sats/grense som brøk.
- `appliesTo(ruleId, orgForm, vatStatus)` — filtrerer på anvendelsesområde.

Registeret validerer ved registrering: ingen duplikate regel-/kilde-ID-er, alle
`sourceIds` må finnes, og **versjoner kan ikke overlappe i tid**
(`assertNonOverlappingVersions`).

## Slik legges en ny regelversjon inn

1. Kontroller den nye verdien mot offisiell kilde (Skatteetaten/Lovdata). Legg til
   eller oppdater kilden i `src/rules/no/sources.ts` med ny `lastVerified` og
   `verifiedBy`.
2. Sett `validTo` på gjeldende versjon i `src/rules/no/rules.ts` (siste dag den gjelder).
3. Legg til en ny `TaxRuleVersion` med `version + 1`, `validFrom` (første gyldighetsdag),
   nye `parameters` og en `changeNote` som forklarer endringen.
4. Oppdater regelens `lastReviewed`/`reviewedBy`.
5. Kjør testene — `test/rules.test.ts` verifiserer versjonering, ikke-overlapp og at
   alle regler har kilde og kontrolldato. Legg til en test for den nye datogrensen
   (mønster: trygdeavgift 2024→2025 og aktiveringsgrensen 2023→2024).

Eksisterende beregninger for gamle datoer endres ikke — oppslaget er alltid per dato.

## Kjente forbehold

Verdiene er lagt inn per kunnskapsdato 2026-01 og `verifiedBy: 'system-bootstrap'`
betyr at ingen menneskelig fagkontroll er gjort. Se advarselen i
`docs/compliance-source-register.md` før produksjonsbruk.
