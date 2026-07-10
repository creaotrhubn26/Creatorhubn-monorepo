# External Integration Discovery and Gap Analysis

Dato: 2026-07-10
Branch: `feat/cto-audit-p1` (bygger på `claude/cto-audit-market-intelligence-re6cy3`)
Forfatter: Claude (på oppdrag, integrasjonsanalyse-spesifikasjonen av 2026-07-10)

Denne pakken er integrasjonsanalysen som følger opp CTO-auditen i
`docs/cto-audit/`. Ingenting her antar at en integrasjon finnes — hver rad i
inventaret er verifisert mot faktisk kode (filreferanser oppgitt), og hver
manglende integrasjon er eksplisitt merket som manglende.

## Hovedfunn (les dette først)

1. **Plattformen har langt flere levende integrasjoner enn CTO-auditens
   Google-kart viste.** Utover Google-flatene finnes aktive integrasjoner mot
   Brønnøysundregistrene, SSB, Kartverket/Geonorge, MET/Yr, Meta Graph API,
   TikTok Business, LinkedIn, Reddit, YouTube, Anthropic, OpenAI, HuggingFace,
   ElevenLabs, Cohere, Twilio, Resend m.fl. Se `01-integration-inventory.md`.
2. **To døde avhengigheter gir falsk trygghet:** `google-trends-api` (uoffisiell
   scraper-basert lib, null call-sites) og `@google-analytics/data` (null
   call-sites — GA4 brukes i praksis via REST i `client-insights-service.ts`).
   Begge bør fjernes fra `package.json` slik at inventaret speiler virkeligheten.
3. **Credential-kartet er verifisert mot faktisk Render-tjeneste (2026-07-10):**
   `ANTHROPIC_API_KEY`, komplett Google Ads-sett (inkl. developer token),
   TikTok- og LinkedIn-credentials **finnes** i Render men er udeklarert i
   `render.yaml` (bør deklareres `sync:false`). Reelt manglende:
   `REDDIT_*` (missingCredentials bekreftet), `COHERE_API_KEY` og
   `ROLE_ROOM_LINKEDIN_*` på hovedbackenden. I tillegg finnes en
   legacy-backend (`backend-djm5`) med divergerende credential-sett. Se
   `01-integration-inventory.md` §4.
4. **Google Trends finnes ikke som integrasjon i dag** — verken offisiell API
   (krever alpha-tilgang), BigQuery-datasettet eller manuell import. Keyword
   Planner er heller ikke implementert (ingen `KeywordPlan*`-kall). Search
   demand er dermed det største datagapet mot Market Intelligence-visjonen. Se
   `03-google-trends-assessment.md`.
5. **Ingen native GCP-tjenester er i bruk** (bekreftet på nytt — samme funn som
   `docs/cto-audit/02`): ingen Secret Manager, ingen service accounts, ingen
   Cloud Run/Functions/Scheduler/Tasks/PubSub/BigQuery/Firestore. Spec-ens
   sjekkliste-punkter for disse er derfor «Not used», ikke «ukjent».

## Leveranser

| # | Leveranse (fra oppdraget) | Hvor |
|---|---|---|
| 1 | Existing Integration Inventory | `01-integration-inventory.md` §1–2 |
| 2 | Missing Integration Matrix | `02-capability-matrix.md` §2 |
| 3 | Google Cloud API Inventory | `01-integration-inventory.md` §3 (+ `docs/cto-audit/02`) |
| 4 | Google Trends Access Assessment | `03-google-trends-assessment.md` |
| 5 | Recommended Provider Strategy | `04-provider-strategy-licensing-cost.md` §1 |
| 6 | Licensing and Terms Risk Report | `04-provider-strategy-licensing-cost.md` §2 |
| 7 | Authentication and Credential Map | `01-integration-inventory.md` §4 |
| 8 | Integration Adapter Architecture | `05-adapter-architecture-normalized-data.md` §1 + kode |
| 9 | Normalized Data Schema | `05-adapter-architecture-normalized-data.md` §2 + kode |
| 10 | Data Lineage Strategy | `05-adapter-architecture-normalized-data.md` §3 |
| 11 | Cost and Quota Assessment | `04-provider-strategy-licensing-cost.md` §3 |
| 12 | MVP Integration Priorities | `06-mvp-plan-and-testplan.md` §1 |
| 13 | Implementation Plan | `06-mvp-plan-and-testplan.md` §2 |
| 14 | Test Plan (inkl. 20 QA-scenarioene) | `06-mvp-plan-and-testplan.md` §3 |
| 15 | Admin Integration Center Specification | `07-admin-integration-center-spec.md` |
| 16 | Integrasjoner som krever manuell handling fra eier | Under |

## Kode i denne leveransen (additiv, testet)

- `backend/server/integrations/integration-registry-schema.ts` — Integration
  Registry-kontrakten fra oppdraget §1 (alle felter + statusverdier) som
  Zod-skjema med validator og enhetstester. Registeret starter som
  konfig-/kodedrevet (én fil per integrasjon kan valideres mot skjemaet);
  DB-tabellen kommer når Admin Integration Center bygges (se plan).
- `backend/server/integrations/search-trend-provider.ts` —
  `SearchTrendProvider`-kontrakten (interface + normaliserte respons-typer +
  `ProviderCapabilities`/`IntegrationHealth`), slik at frontend og
  analysemodeller aldri avhenger av én Trends-implementasjon.
- `backend/server/integrations/normalized-signal-schema.ts` —
  `NormalizedSignal`-skjemaet fra oppdraget (Zod + typer + validator + tester).
  Dashboard/AI skal lese fra dette laget, ikke leverandør-responser.

Ingen ny integrasjon later som den er aktiv: denne leveransen inneholder
kontrakter, skjemaer og analyse — ingen mock-data, ingen «demo-providere» som
utgir seg for å være live.

## Leveranse 16 — krever manuell handling fra eier (Daniel)

Disse kan ikke automatiseres fra kodebasen:

1. **Google Trends API alpha**: ~~søk om tilgang~~ **søknad sendt 2026-07-10**
   (`awaitingApproval`). Inntil svar: bruk Ads-data + manuell CSV-import
   (se `03-google-trends-assessment.md`).
2. **Google Ads developer token**: tokenet FINNES i Render (verifisert
   2026-07-10) — gjenstår kun å bekrefte tilgangsklassen (test/basic/standard)
   i ads.google.com → API-senter, siden klassen ikke kan leses via API.
3. **OAuth-verifisering/scopes**: Google OAuth-appens scope-liste bør
   revideres mot faktisk bruk (jf. `docs/cto-audit/02` — ingen samlet
   scopes-manifest finnes).
4. **API-nøkkel-restriksjoner i Google Cloud Console**: bekreft
   referrer-/IP-restriksjoner på Places/Maps-nøklene (repo-et kan ikke
   verifisere dette — samme punkt som Security-rapporten).
5. **Vercel env-vars**: legg inn VITE_-analytics-variablene (P1.4-renamen,
   se `frontend/client/.env.production.example`).
6. **Leverandørvilkår/lisenskjøp** ved valg av kommersiell datakilde for
   konkurrent-/review-data (G2/Capterra/Trustpilot har ikke fri API-tilgang —
   se `04-provider-strategy-licensing-cost.md`).
7. **Deklarere manuelt satte Render-secrets** i `render.yaml` (`sync: false`)
   så credential-kartet blir komplett og reproduserbart.
