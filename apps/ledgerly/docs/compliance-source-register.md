# Kilde- og regelregister (compliance)

> **VIKTIG ADVARSEL — UVERIFISERTE 2026-SATSER**
> Alle satser og grenser er lagt inn per kunnskapsdato **2026-01** med
> `verifiedBy: 'system-bootstrap'` — det vil si uten menneskelig fagkontroll.
> Satsene for inntektsåret 2026 — **særlig trygdeavgift for næringsinntekt** — er
> **IKKE verifisert mot Skatteetaten** og **MÅ kontrolleres mot offisielle kilder før
> produksjonsbruk**. Registeret (`src/rules/no/`) er bygget nettopp for at slike
> kontroller gjøres ett sted, med gyldighetsperiode og revisjonshistorikk.

## Kilder (`src/rules/no/sources.ts`)

Alle har `lastVerified: 2026-01-01` og `verifiedBy: system-bootstrap`.

| sourceId | Tittel | Type | URL |
|---|---|---|---|
| lovdata-mval | Merverdiavgiftsloven (LOV-2009-06-19-58) | lov | https://lovdata.no/dokument/NL/lov/2009-06-19-58 |
| stortinget-mva-vedtak | Stortingets årlige vedtak om merverdiavgift (satser) | lov | https://lovdata.no/dokument/STV/forskrift/2024-12-12-3572 |
| skatteetaten-mva-satser | Skatteetaten: Merverdiavgiftssatser | skatteetaten | https://www.skatteetaten.no/satser/merverdiavgift/ |
| lovdata-sktl | Skatteloven (LOV-1999-03-26-14) | lov | https://lovdata.no/dokument/NL/lov/1999-03-26-14 |
| skatteetaten-selskapsskatt | Skatteetaten: Skattesats for selskaper (alminnelig inntekt) | skatteetaten | https://www.skatteetaten.no/satser/ |
| skatteetaten-saldoavskrivning | Skatteetaten: Saldogrupper og avskrivningssatser (sktl. § 14-41 og § 14-43) | skatteetaten | https://www.skatteetaten.no/satser/avskrivningssatser/ |
| skatteetaten-direkte-kostnadsforing | Skatteetaten: Grense for direkte utgiftsføring av driftsmidler (sktl. § 14-40) | skatteetaten | https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/kjop-og-salg/avskrivninger/ |
| skatteetaten-mva-registrering | Skatteetaten: Registrering i Merverdiavgiftsregisteret (mval. § 2-1) | skatteetaten | https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/registrere/ |
| skatteetaten-saf-t | Skatteetaten: SAF-T Regnskap — teknisk dokumentasjon og standard mva-koder | saf-t-dokumentasjon | https://www.skatteetaten.no/bedrift-og-organisasjon/starte-og-drive/rutiner-regnskap-og-kassasystem/saf-t-regnskap/ |
| skatteetaten-trygdeavgift | Skatteetaten: Trygdeavgift (satser for lønn og næringsinntekt) | skatteetaten | https://www.skatteetaten.no/satser/trygdeavgift/ |
| lovdata-bokforingsloven | Bokføringsloven (LOV-2004-11-19-73) | lov | https://lovdata.no/dokument/NL/lov/2004-11-19-73 |
| lovdata-api | Lovdata API — maskinlesbare lover/forskrifter (NLOD 2.0) | lov | https://api.lovdata.no/ |
| skatteetaten-datadeling | Skatteetaten datadeling — API-er for satser og skattedata | skatteetaten | https://skatteetaten.github.io/api-dokumentasjon/en/ |
| skatteetaten-fradrag-fagforening | Skatteetaten: Fradrag for fagforeningskontingent (satser) | skatteetaten | https://www.skatteetaten.no/en/rates/deduction-for-trade-union-fees/ |
| google-gmail-api | Google: Gmail API — offisiell dokumentasjon (scopes, OAuth 2.0) | google-dokumentasjon | https://developers.google.com/gmail/api/auth/scopes |

### Offisielle innhentingskanaler (lovlig alternativ til skraping)

Registeret skiller nå menneskelesbar kilde-URL fra maskinlesbart **`apiUrl`** med
**`license`** og **`apiAccess`**. Det gjør at satser og lovtekst kan hentes fra
offisielle kanaler i stedet for å skrapes eller legges inn fra hukommelse:

| Kanal | apiUrl | Lisens | Tilgang | Dekker |
|---|---|---|---|---|
| Lovdata API | https://api.lovdata.no/ | NLOD 2.0 | åpen (ingen nøkkel) | Lovtekst: skatteloven, mval., bokføringsloven — kapittel/paragraf-struktur, oppdatert nattlig |
| Skatteetaten datadeling | https://skatteetaten.github.io/api-dokumentasjon/en/ | — | innvilget (Maskinporten) | **Katalog over transaksjons-/innrapporterings-API-er — IKKE en satsfeed** |

**Viktig avklaring om Skatteetatens API-er:** katalogen er transaksjons- og
innrapporterings-API-er (Beregnet skatt, MVA-melding, Mva-register, a-melding),
alle bak Maskinporten med innvilget tilgang per virksomhet. De gir **ikke** en
maskinlesbar satstabell — satser/fradragsbeløp må fortsatt komme fra satssidene/
Skatte-ABC (manuelt, fagkontrollert) eller Lovdata API (lovtekst). De konkrete
API-ene som kobler på Ledgerly-funksjoner:

| sourceId | API | Kobler på |
|---|---|---|
| skatteetaten-mva-melding-innsending | MVA-melding validering + innsending | Lukker innsendings-gapet (MVA-rapport er i dag alltid kladd); rettigheten `vat.submit` |
| skatteetaten-mva-register-api | Mva-register avgiftssubjekt | Autoritativ variant av MVA-kontrollen som i MVP gjøres mot Brønnøysund |

Merk: i dette utviklingsmiljøet blokkeres direkte henting av alle primærkildene
(HTTP 403 på WebFetch, uansett domene), så oppføringene over er kartlagt via søk,
ikke direkte lesing. Faktisk API-integrasjon (klient + innhenting) gjenstår.

## Regler (`src/rules/no/rules.ts`)

| ruleId | Kortnavn | Versjoner | Merknad |
|---|---|---|---|
| no.vat.rate.standard | MVA ordinær sats | v1: 25 % fra 2005-01-01 | |
| no.vat.rate.food | MVA næringsmidler | v1: 15 % fra 2012-01-01 | |
| no.vat.rate.low | MVA lav sats | v1: 12 % fra 2018-01-01 | Midlertidig 6 % (2020–2021) er ikke lagt inn i MVP |
| no.vat.registration-threshold | MVA-registreringsgrense | v1: 50 000 kr fra 2004-01-01 | |
| no.tax.corporate-rate | Skattesats alminnelig inntekt (selskap) | v1: 22 % fra 2019-01-01 | AS/NUF/SA |
| no.tax.personal-base-rate | Skattesats alminnelig inntekt (person/ENK) | v1: 22 % fra 2019-01-01 | ENK/ANS/DA; trinnskatt/trygdeavgift kommer i tillegg |
| no.tax.social-security-self-employed | Trygdeavgift næringsinntekt | v1: 11,0 % (2024); v2: 10,9 % fra 2025-01-01 | **2026-sats ikke verifisert** — kontroller mot Skatteetaten |
| no.asset.expense-threshold | Grense for direkte kostnadsføring | v1: 15 000 kr (1992–2023); v2: 30 000 kr fra 2024-01-01 | |
| no.asset.depreciation-groups | Saldogrupper og avskrivningssatser | v1 fra 2017-01-01: a 30 %, b 20 %, c 24 %, d 20 %, e 14 %, f 12 %, g 5 %, h 4 %, i 2 %, j 10 % | Kun regelgrunnlag — ingen avskrivningsautomatikk i MVP |
| no.deduction.union-fee | Fradrag for fagforeningskontingent | v1: 8 250 kr (2025); v2: 8 700 kr fra 2026-01-01 | **Fradragskatalog, målgruppe C. `needsProfessionalVerification: true`** — hjemmel (antatt sktl. § 6-20) og beløp må fagkontrolleres; bekreftet kun via websearch |

### Fradragskatalog (ny struktur)

`TaxRule` bærer nå valgfrie felt for en fradragskatalog: **`taxpayerGroups`**
(A=ENK/`sole-proprietor`, B=AS/`company`, C=privatperson/`personal`),
**`legalReference`** (hjemmelsparagraf), **`deductionTreatment`**
(`direct-expense` / `capitalize-depreciate` / `personal-deduction` / `not-deductible`),
og **`needsProfessionalVerification`** + **`verificationNote`** («må-fagkontrolleres»-flagg).
`no.deduction.union-fee` er første oppføring — lagt inn som fungerende eksempel.
Regler med flagget skal aldri presenteres som endelige; `RuleRegister.rulesNeedingVerification()`
lister dem samlet. Den fulle katalogen (§ 6-1 hovedregel, bil, hjemmekontor,
representasjon, minstefradrag, pendlerfradrag m.m.) gjenstår og må forfattes/kontrolleres
av statsautorisert regnskapsfører mot Lovdata/Skatte-ABC.

## Kontrollrutine

Før produksjon: verifiser hver regel mot kilden, oppdater `lastVerified`/`verifiedBy`
med et reelt navn/rolle, og legg inn nye versjoner etter oppskriften i
`docs/rule-engine.md`. Testene i `test/rules.test.ts` krever at alle regler har
offisiell kilde og kontrolldato.

## Teknisk skjemakilde (SAF-T)

| Kilde | URL | Hentet | Brukes til |
|---|---|---|---|
| Skatteetatens SAF-T Financial XSD v1.10 | https://github.com/Skatteetaten/saf-t | 2026-07-13 | Skjemavalidering av eksporten i `test/saft.pg.test.ts` (vendored i `vendor/saft/`) |
