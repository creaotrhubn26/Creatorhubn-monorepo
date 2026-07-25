# SAF-T Financial XSD + kodelister (offisielle)

Hentet uendret fra Skatteetatens offisielle repo:
https://github.com/Skatteetaten/saf-t

- `Norwegian_SAF-T_Financial_Schema_v_1.40.xsd` — **gjeldende skjema, obligatorisk
  fra første regnskapsperiode som starter 1. januar 2027 eller senere** (frivillig
  før det). Brukes av `test/saft.pg.test.ts` til å skjemavalidere eksporten.
- `Norwegian_SAF-T_Financial_Schema_v_1.10.xsd` — forrige versjon, beholdt for referanse.
- `naeringsspesifikasjon_grouping_2025-2026.csv` — offisiell kodeliste (Grouping
  Category Code 2025-2026) som mapper standard kontokode → GroupingCategory. Generert
  til `src/saft/grouping-data.ts` (brukes for `GroupingCategory`/`GroupingCode` i 1.40).

1.40 er bakoverkompatibel med 1.10 bortsett fra: `TaxAmount` → `Debit/CreditTaxAmount`,
kontoens `StandardAccountID` → `GroupingCategory`+`GroupingCode`, reskontrosaldo flyttet
inn i `BalanceAccount`, samt nye valgfrie valuta-/NOK-avgiftsfelt.

Hentet: 2026-07-13 (1.10), 2026-07-25 (1.40 + kodeliste). Ved ny skjemaversjon:
last ned ny fil, oppdater testene, `grouping-data.ts` og
`docs/compliance-source-register.md`.
