# 2. Integration Capability Matrix + Missing Integration Matrix

Produktbehovene er Market Intelligence-visjonens capabilities (jf.
`docs/cto-audit/07-proposed-generic-architecture.md`). «Existing source» er
verifisert mot kode — se `01-integration-inventory.md`.

## §1 Capability Matrix

| Capability | Required data | Existing source | Status | Gap | Recommended action |
|---|---|---|---|---|---|
| Search interest | Relative søketrender, sesong, rising queries | **Ingen** (`google-trends-api` er død dep) | Missing | Ja | Søk Trends API alpha; adapter + manuell import først (`03-google-trends-assessment.md`) |
| Keyword demand | Månedlig søkevolum, konkurranse, bud | Google Ads API finnes, men **ingen KeywordPlan*-kall** | Partial | Ja | Implementér KeywordPlanIdeaService bak kø+cache — token avklart 2026-07-10 (Basic Access), ublokkert |
| Owned search performance | Clicks/impressions/CTR/position | Search Console API | Existing | Nei | Valider dimensjoner + koble til normalized layer; kun egne domener |
| Website behavior | Sessions/conversions | GA4 Data API (REST) | Existing | Nei | Valider dimensjoner; fjern død SDK-dep |
| Geographic demand | Lokasjonsbasert interesse | Places (delvis), SSB (demografi), Kartverket (geo) | Partial | Ja | Normaliser geografi (kommune-nr som nøkkel — SSB-tjenesten har allerede kommune-mapping) |
| Competitor changes | Nettsted-/produktendringer | `market-scan-service.ts` henter konkurrent-HTML (engangs); ingen change-tracking | Partial | Ja | Bygg compliant collector med robots.txt-sjekk + diffing; se lisensvurdering før utvidelse |
| Public statistics | Marked/befolkning | SSB (aktiv!), Brreg (aktiv) | Existing (NO) / Missing (EU) | Delvis | Eurostat/OECD-adaptere kun hvis ikke-norske markeder prioriteres |
| Company profiles | Org-data, ansatte, økonomi | Brreg (aktiv, inkl. enrichment i Leadgrid intelligence) | Existing (NO) | Nei | Regnskapstall: vurder Brreg regnskapsregister-API før kommersiell leverandør |
| Reviews / user problems | App-/produktanmeldelser | **Ingen** (Trustpilot nevnes kun i prompt-tekst) | Missing | Ja | Offisielle APIer krever avtale/lisens — `requiresLicensedProvider`; bruk brukerimport + egne CRM-data først |
| Job postings / funding | Stillinger, funding-signaler | **Ingen** | Missing | Ja | Lavt MVP-behov; postpone |
| Ad performance (owned) | Kampanjedata | Google Ads + Meta + TikTok + LinkedIn | Existing | Nei | Koble til normalized layer |
| Social/owned channels | Innhold + engasjement | Meta/TikTok/LinkedIn/YouTube/Reddit | Existing | Nei | Koble til normalized layer |
| Lead conversion | Faktiske salgsutfall | Leadgrid (won/lost, aktiv) | Existing | Nei | Feedback-pipeline til scoring (P2-punktet i cto-audit-planen) |
| Weather context | Værdata (Evendi-vertikal) | MET/Yr | Existing | Nei | — |

## §2 Missing Integration Matrix (leveranse 2)

Kun kilder som *ikke* finnes i kode i dag, med anbefaling etter oppdragets
Recommendation Rules:

| Manglende integrasjon | Anbefaling | Begrunnelse (verdi/tilgang/juss/kost) |
|---|---|---|
| Google Trends (offisiell API) | **apply for access** + prepare adapter only | Høy produktverdi for search interest; tilgang er alpha-gated; gratis; juridisk uproblematisk via offisiell API |
| Google Trends BigQuery-datasett | prepare adapter only | Dekker kun top/rising terms (US-vektet); krever GCP-prosjekt + BigQuery-kost; sekundær til alpha-API |
| Google Ads Keyword Planner | **implement now** (bak kø/cache) | Eneste lovlige kilde til søkevolum; koden har allerede Ads-OAuth; rate-limits krever kø + caching + kontrollert sync |
| Bing Webmaster API | postpone | Marginal trafikk i norsk marked; lav produktverdi nå |
| Eurostat / OECD / World Bank | prepare adapter only / postpone | Verdi først ved ikke-norske markeder; åpne lisenser (CC BY-aktig); lav kost |
| Brreg regnskapsregister (utvidelse) | implement now (utvidelse av eksisterende brreg-adapter) | Åpne data, høy verdi for company health-scoring; allerede halvveis (enrichment bruker ansatte-tall) |
| App Store / Google Play reviews | requires user credentials / postpone | App Store Connect API krever app-eierens nøkler (kun egne apper); tredjeparts app-data krever lisensiert leverandør |
| G2 / Capterra / Trustpilot | **requiresLicensedProvider** | Ingen fri API for tredjepartsdata; scraping bryter ToS/database-rettigheter → `unavailable` uten lisens |
| Reddit som *markedsdata* (utover engasjement) | use alternative source / reject for scraping | Offisiell Data API er priset og ToS-begrenset for bulk; eksisterende script-app er kun for eget engasjement |
| Kommunale åpne data / geodata utover Geonorge | use manual import initially | Heterogene formater; importflyten (§`05`) håndterer dem bedre enn N små adaptere |
| Web-change collectors (konkurrent-overvåking) | prepare adapter only + juridisk sjekkliste per domene | Se `04-provider-strategy-licensing-cost.md` §2 — robots.txt/ToS-dokumentasjon FØR aktivering, per kilde |

## §3 Vurdering av integrasjonsgruppene A–E (oppdragets krav)

**A. Search Demand and Trends** — Trends ≠ absolutt volum (kun relativ
interesse/geo/related/rising); Keyword Planner = volum/konkurranse/bud men
ratebegrenset (kø+cache+kontrollert sync er et *krav*, se testplanen);
Search Console kun for egne verifiserte domener — aldri konkurrentdata.
Skillet håndheves i adapter-laget: tre ulike `metricType`-familier i
`NormalizedSignal` (`relative_interest`, `search_volume_avg`,
`owned_clicks`/`owned_impressions`), aldri blandet i samme widget uten merking.

**B. Market and Public Data** — SSB/Brreg/Kartverket/MET er aktive og har
åpne lisenser (NLOD/CC-aktige) som tillater kommersiell bruk med kildeangivelse.
Eurostat/OECD/World Bank: åpne, stabile, men lav norsk-markedsverdi nå.
Personvern: alle disse er aggregerte/registerdata — lav risiko; unntaket er
Brreg-enkeltpersonforetak (navn = persondata) som allerede håndteres i CRM-laget.

**C. Business and Competitor Intelligence** — se §2-radene og
lisensrapporten. Hovedregel vedtatt her: **ingen scraping aktiveres
automatisk**; hver kilde får en dokumentert juridisk sjekkliste
(robots.txt, ToS, opphavsrett/databasevern, auth-restriksjoner, rate,
personvern) som artefakt i registeret før `enabled=true`.

**D. Reviews and User Problems** — kildeopprinnelse bevares via
`sourceType` i `NormalizedSignal` (`official_api / licensed_provider /
user_imported / manual_upload / public_data`). Ikke-godkjent scraping er ikke
en gyldig `sourceType` — validatoren avviser den.

**E. Marketing and Owned Channels** — alle hovedkilder finnes (GA4, GSC,
Ads, Meta, LinkedIn, YouTube, TikTok, CRM/Leadgrid, e-post via Resend/Gmail).
Dette er *brukerens egne data*: i normalized layer skilles de fra
markedsdata med `subjectType='own_property'` vs. `'market'`/`'competitor'`,
og tenant-scoping (`organizationId`) er obligatorisk på hver rad.
