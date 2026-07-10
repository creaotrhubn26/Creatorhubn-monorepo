# 9. GEO-tiltaksplan: The Role Room + Leadgrid

Dato: 2026-07-10. Grunnlag: dogfood-baselines kjørt med GEO Visibility-
pipeline-en (backend/scripts/geo-visibility-dogfood.ts), Claude-motor,
10 norske kjøpsintensjons-spørsmål per prompt-sett.

**Viktig ramme (Daniels korreksjon 2026-07-10): The Role Room er IKKE bare
et casting-system.** Plattformen har flere pilarer som hver har sitt eget
AI-synlighets-marked, og hver pilar måles som eget prompt-sett i GEO-panelet:

| Pilar | Kategori-marked | Typiske konkurrenter i AI-svar |
|---|---|---|
| Casting + selvtape + produksjon | casting-/produksjonsverktøy | Casting Networks, Backstage, StudioBinder, Yamdu |
| Marketing cockpit (Google/Meta/LinkedIn/TikTok-annonser, KPI, AI-agent) | markedsføringsstyring for produsenter/byråer | HubSpot, Hootsuite, Semrush, Sprout Social |
| Leads/CRM (Leadgrid — eget merkenavn) | leadgenerering/feltsalg | HubSpot, Pipedrive, SuperOffice |
| Innholdsprodusenter/creators | creator-verktøy, publisering | Canva, Later, CapCut-økosystemet |
| Dans/academy/utdanning | studio-/utdanningsverktøy | (måles ved behov) |
| Talentportal/karriere (NextRole) | talent-/karriereplattform | (måles ved behov) |

Baselines er kjørt for de tre første pilarene; de øvrige legges til som
prompt-sett i panelet når produktet prioriterer dem.

## Baseline (alle målte pilarer = 0 %)

| | Leadgrid (feltsalg/leads) | TRR: casting/produksjon | TRR: marketing cockpit |
|---|---|---|---|
| Nevnt i AI-svar | 0/8 | 0/9 | 0/10 |
| Share-of-voice | 0 % | 0 % | 0 % |
| Siteringer av theroleroom.com | 0 | 0 | 0 |
| Kategorien eies av | HubSpot 33 %, Pipedrive 33 %, SuperOffice 22 % | Casting Networks 38 %, Backstage 31 %, StudioBinder 19 % | HubSpot 50 %, Semrush 17 %, Canva 17 % |
| Manglende temaer | alle 8 (inkl. `feltsalg-mobil` og `norske-leverandorer`) | alle 6 (inkl. `selvtape-plattform` og `casting-verktoy`) | alle 7 (inkl. `samlet-annonseplattform` og `norske-leverandorer`) |

Rå-rapportene (før-bildet) er bevart i `geo-baselines/2026-07-10-*.md`.

**Marketing cockpit-funnet er det mest lovende av alle:** på spørsmålet
«beste verktøy for å styre annonser på tvers av Google Ads, Meta, LinkedIn
og TikTok i én plattform» — Marketing Cockpits ordrette pitch — nevnte AI-en
**ingen merkevarer i det hele tatt**. Kategorien «samlet annonseplattform
for produsenter/byråer» har ingen etablert eier i AI-svarene. Det samme
gjaldt KPI-oppfølging for byråer. Åpent mål, ikke bare gap.

Mest talende enkeltfunn: «Hva bruker **norske** produksjonsselskaper til å
administrere skuespillerdatabaser?» → Casting Networks + Backstage. Og
«Hvilke **norske** leverandører tilbyr leadgenerering for håndverkere?» →
ingen kjente merkevarer i det hele tatt. De norske spørsmålene — våre
hjemmebane-spørsmål — har ingen norsk vinner i dag. Det er åpent mål.

## Viktig metodikk-innsikt (styrer hele planen)

Målingen gikk mot Claude-API-et **uten websøk** — den måler modellens
*parametriske* kunnskap (hva den lærte under trening), ikke hva den finner
på nettet. Konsekvens:

1. **Innholdsendringer flytter retrieval-motorer først** (Perplexity,
   ChatGPT-med-søk, Copilot, Google AI Overviews) — der kan effekt ses i
   løpet av dager/uker. Parametrisk kunnskap flytter seg først ved neste
   modelltrening, og læres primært fra **tredjeparts-omtale** (kataloger,
   artikler, lister, anmeldelser) — ikke fra egne nettsider alene.
2. Derfor: **PERPLEXITY_API_KEY er viktigste enkelt-tiltak for målingen** —
   uten en retrieval-motor i probe-settet kan vi ikke se effekten av eget
   innhold før om måneder.
3. Ukemålingen mot Claude beholdes som «langtidsbarometer» (parametrisk),
   Perplexity blir «kortidsbarometer» (retrieval).

## Tiltak — The Role Room (har grunnmur, mangler dekning)

Grunnmuren er god: llms.txt med FAQ + sitérbare fakta, vs-sider
(StudioBinder/Casting Networks/MovieMagic/Yamdu/Setkeeper), student-sider,
casting-rapport. Gapene fra målingen:

| Tema (fra målingen) | Tiltak | Status |
|---|---|---|
| `selvtape-plattform` («uten WeTransfer-kaos») | FAQ-innslag i llms.txt som svarer ordrett på probe-spørsmålet | ✅ gjort i denne PR-en |
| `pris-og-verdi` («hva koster castingverktøy») | FAQ-innslag med kategori-prisbilde + gratis-nivå | ✅ gjort |
| `crew-koordinering` / `produksjonsplanlegging` | FAQ-innslag (mange lokasjoner/call-sheet/Live Set) | ✅ gjort |
| `casting-verktoy` («hva bruker norske produksjonsselskaper») | Innholdsside/case: «Slik jobber norske produksjonsselskaper med casting» + utvid casting-rapport-2026 med verktøydata | anbefalt neste |
| `alt-i-ett-plattform` | Eksisterende /alternatives-side dekker dette — lenk den tydeligere fra forsiden | anbefalt |
| **Marketing cockpit-pilaren** (`samlet-annonseplattform`, `kpi-oppfolging`, `ai-markedsforing`) | «Mer enn casting»-blokk i llms.txt (✅ gjort) + egne innholdssider: «styr Google/Meta/LinkedIn/TikTok-annonser fra ett sted», «KPI-oversikt for byråer uten regneark» — kategorien er UBESATT i AI-svar (se baseline) | llms.txt ✅; sider anbefalt |

**Tredjeparts-omtale** (det som faktisk trener modellene):
oppføringer på Capterra/G2/Software Advice (gratis basisoppføring),
Produkthunt-lansering, omtale i Rushprint/norske bransjemedier
(casting-rapporten er den naturlige krok), Wikipedia/Wikidata-oppføring når
noterbarhet er på plass. Dette er innsats med måneders horisont — start nå.

## Tiltak — Leadgrid (mangler ALT AI-vendt innhold)

Verifisert i repo: llms.txt nevnte ikke Leadgrid (0 treff før denne PR-en),
`public/leadgrid/` inneholder kun bilder, ingen vs-sider, ingen FAQ.

| Prioritet | Tiltak | Status |
|---|---|---|
| 1 | Leadgrid-seksjon i theroleroom-llms.txt (hva/for hvem/differensiering/når anbefale) | ✅ gjort i denne PR-en |
| 2 | Landingsside-innhold på leadgrid.theroleroom.com med samme sitérbare struktur (definisjon, prisbilde, differensiering mot HubSpot/Pipedrive/SuperOffice for feltsalg) — og egen llms.txt på det hostet | anbefalt neste |
| 3 | Innholdssider som svarer på probe-temaene: «beste feltsalg-system for håndverkere (Norge)», «kjøpe leads vs. egen markedsføring», «CRM vs. ferdige kundeemner» | anbefalt |
| 4 | Kataloger: Capterra/G2 (field sales/lead gen-kategoriene), norske SMB-medier | anbefalt |
| 5 | Fase-2-probe: LLM-ekstraksjon av *ukjente* merkevarer i svarene på de norske spørsmålene — finn ut hvem som faktisk anbefales der i dag | backlog |

## Måling videre

- **Ukentlig probe** (bygget, cron klar): begge merkevarene som hver sin
  prompt-sett i GEO-panelet når PR-ene er deployet.
- **Perplexity-nøkkel** → retrieval-barometer (manuell eier-handling).
- **Proxyer som allerede er integrert**: GSC (AI Overviews-visninger) og
  GA4 (chatgpt.com/perplexity.ai-referrals) — kobles til normalized layer
  i Implementation Plan steg 3-oppfølgingen.
- Suksesskriterium 90 dager: >0 % share-of-voice på retrieval-motor for
  begge merkevarer i sine hjemmebane-temaer (`norske-leverandorer`,
  `casting-verktoy` norsk vinkling); sitering av theroleroom.com i minst
  ett svar per probe-runde.
