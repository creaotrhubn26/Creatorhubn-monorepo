# 4. Provider Strategy, Licensing Risk, Cost & Quota Assessment

## §1 Recommended Provider Strategy (leveranse 5)

Prinsipper (utledet av inventaret + oppdragets regler):

1. **Offisiell API > lisensiert leverandør > brukerimport > offentlig data.
   Scraping er siste utvei og krever dokumentert juridisk sjekkliste per
   kilde.** `sourceType` i normalized layer bevarer opprinnelsen for alltid.
2. **Egne data vs. markedsdata er to ulike produkter.** GSC/GA4/Ads/Meta/
   LinkedIn/CRM er brukerens egne (OAuth per org, tenant-scopet); Trends/SSB/
   Brreg er markedsdata (delt, cachebar på tvers av tenants der lisensen
   tillater). Blandes aldri uten merking.
3. **Én adapter per provider, én kontrakt per capability** (SearchTrendProvider
   er første; ReviewSignalProvider/CompanyDataProvider følger samme mal).
   Fallback-kjeder konfigureres i registeret (`fallbackIntegrationId`), ikke i
   widget-kode.
4. **Norske åpne kilder er undervurdert gull:** Brreg + SSB + Kartverket er
   allerede integrert, gratis, stabile og lisens-rene — MVP-en bør lene seg på
   dem før betalte kilder vurderes.
5. **Alle eksterne kall via `external-api.ts`** (timeout/catch/typed result —
   levert i P1) + per-org kostnads-tellere (P2-punktet i cto-audit-planen).

## §2 Licensing and Terms Risk Report (leveranse 6)

| Kilde | Lisens/vilkår | Kommersiell bruk | Risiko | Konklusjon |
|---|---|---|---|---|
| SSB | NLOD/CC BY 4.0 | Ja, med kildeangivelse | Lav | OK — legg kildeangivelse i widget-footer |
| Brreg | NLOD | Ja | Lav (ENK-navn = persondata → håndteres i CRM-laget) | OK |
| Kartverket/Geonorge | NLOD/CC BY | Ja | Lav | OK |
| MET/Yr | NLOD/CC BY + User-Agent-krav | Ja | Lav | OK (User-Agent settes) |
| Eurostat/OECD/World Bank | Åpne (CC BY-aktige) | Ja | Lav | OK når behovet kommer |
| Google Trends (offisiell/alpha) | Google APIs ToS | Ja innenfor ToS | Middels (alpha-vilkår kan endres) | OK via offisiell API; **scraping = rejected** |
| Google Ads/GSC/GA4 | Google APIs ToS + produktvilkår | Ja (brukerens egne kontoer) | Lav-middels (Ads-token-klasse begrenser) | OK |
| Meta/TikTok/LinkedIn | Plattform-ToS, app-review-krav | Ja med godkjente scopes | Middels (scope-godkjenninger, deprecations) | OK — overvåk API-versjoner (registry `apiVersion`) |
| Reddit Data API | Priset + strenge vilkår for bulk | Begrenset | Middels-høy for markedsdata | Eget engasjement OK (dagens bruk); markedsanalyse-bulk: nei |
| G2/Capterra/Trustpilot | Ingen fri API for tredjepartsdata; database-rettigheter | Nei uten avtale | Høy | `requiresLicensedProvider` / `unavailable` |
| App Store/Play (tredjeparts apper) | ToS forbyr systematisk innhøsting | Nei uten leverandør | Høy | `requiresLicensedProvider`; egne apper: OK via egne nøkler |
| Konkurrenters nettsteder (collector) | robots.txt + ToS + åndsverk/databasevern per domene | Varierer | Middels-høy | Per-kilde sjekkliste som registry-artefakt FØR aktivering; respekter robots.txt maskinelt (sjekk finnes allerede i `client-google-suite.ts`-mønsteret) |

## §3 Cost and Quota Assessment (leveranse 11)

Det som kan sies fra repo + offentlig priskunnskap (tall som endres er merket
«verifiser i konsoll»):

| Kilde | Kostmodell | Kvote-/ratefare | Tiltak |
|---|---|---|---|
| Places API (New) | Betalt per kall, ulik pris per SKU (Text Search vs. Details) | Høy — lead-discovery-løkker kan løpe | **Per-org tellere (P2)**; cache place-details; budsjettalarm i Google-konsoll (manuell) |
| Google Ads API | Gratis, men developer-token-klasse styrer kvote (test≈15k ops/dag, basic/standard mer — verifiser) | Middels | Kø + cache (allerede krav for Keyword Planner); token-klasse må avklares (leveranse 16) |
| GSC API | Gratis; ~1 200 QPM per prosjekt (verifiser) | Lav | Cache 24t (searchanalytics er dags-granulær) |
| GA4 Data API | Gratis; token-kvoter per property/time | Lav-middels | Cache + batch runReport |
| Trends alpha | Gratis (antatt); kvoter ukjent | Ukjent | Design for kø fra dag én |
| BigQuery (Trends-datasett) | Betalt per skannet TB (~$5/TB on-demand, verifiser) | Lav ved partisjonerte spørringer | Kun hvis datasettet dekker behovet; partisjonsfilter obligatorisk |
| SSB/Brreg/Kartverket/MET | Gratis | Lav (soft rate limits) | Dagens cache (7d SSB) beholdes |
| Meta/TikTok/LinkedIn | Gratis API; rate per app/bruker | Middels (app-nivå-throttling) | Eksisterende cron-synk; registry `rateLimits`-felt fylles per app |
| Anthropic/OpenAI | Betalt per token | Høy (størst reell kostpost) | Egen AI-usage-tracker finnes for Leadgrid (`leadgrid-ai-usage-tracker.ts`) — generaliser til per-org AI-kost i registeret |
| Twilio/Resend/ElevenLabs | Betalt per melding/tegn | Lav-middels | Volum er produktstyrt; overvåk i leverandør-dashboards |

**Hull:** ingen per-org kost-attribusjon for noen metered API (samme funn som
cto-auditens P2-punkt 6). Registry-feltet `estimatedCost` skal fylles av
tellerne når de bygges — ikke av statiske gjetninger.
