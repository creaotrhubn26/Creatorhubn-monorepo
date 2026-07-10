# 8. GEO Visibility Service — produkt-/arkitekturspec

Dato: 2026-07-10. Bakgrunn: Daniels spørsmål «prompter noen etter en løsning
som Leadgrid / hvordan skaffe leads — og hvordan kommer vi i førersetet med å
tilby markedet dette?»

## Produktidé

**«AI-synlighet» som modul i Market Intelligence**: for en kunde (eller for
Leadgrid selv) svarer tjenesten på to spørsmål, per bransje og region:

1. **Blir du anbefalt?** Når noen spør AI-assistenter kjøpsintensjons-spørsmål
   («beste leadgenerering-verktøy for håndverkere i Norge», «hvordan skaffe
   flere B2B-leads»), hvilke merkevarer nevnes/siteres — og er kunden blant dem?
2. **Hva bør du gjøre?** Gap-analyse → konkret innholdsplan (GEO-optimalisert
   innhold, llms.txt, strukturerte data) → mål på nytt neste uke.

Differensieringen mot Profound/Otterly/Semrush: **norskspråklig, SMB-priset,
og lukket løkke** — vi måler ikke bare synlighet, vi *fikser* den med
innholds-/agent-maskineriet som allerede finnes (content-pack-generator,
marketing cockpit, market-scan-konkurrentlister), og kobler den til faktiske
leads i Leadgrid. Ingen av de globale verktøyene har den løkka, og ingen er
gode på norsk.

## Hvorfor vi kan bygge svarsiden selv

Answer-tracking er syntetisk prompt-probing — definerte prompts kjøres jevnlig
mot AI-motorene og svarene analyseres for merkevare-omtale. Vi har allerede:

- Anthropic + OpenAI API-nøkler (registry: `anthropic`, `openai`)
- En orkestrator som gjør nøyaktig dette mønsteret (market-scan: Claude-drevet
  discovery → strukturert ekstraksjon → lagring → paneler)
- Bransjekatalog (NACE/`industries`) å generere prompt-sett fra
- Konkurrentlister per kunde (market_scan_competitors) å måle share-of-voice mot
- `normalized_signals`-laget (0376) å lagre resultatene i

Nytt som trengs: Perplexity API-konto (rimelig, offisiell — nærmest «ekte»
AI-søk), og ev. en SERP-leverandør for Google AI Overviews (lisensiert,
fase 2).

## Ærlighetsregler (No Fake Integrations — ufravikelige)

- Alle GEO-signaler lagres med `isEstimated: true` og
  `metadata.synthetic: true` — dette er *probing via offisielle APIer*, ikke
  reelle brukerlogger, og UI-et skal si det («Basert på N testspørsmål mot
  ChatGPT/Claude/Perplexity, uke X»).
- API-modellene svarer ikke identisk med forbruker-appene (chatgpt.com har
  søk/memory) — merkes i metodikk-teksten i widgeten.
- Scraping av forbruker-UI-ene er forbudt (`rejected`). Google AI Overviews
  kun via lisensiert SERP-API eller ikke i det hele tatt.
- Prompt-volum (etterspørselssiden) kjøpes lisensiert (Semrush Prompt
  Research el.l.) eller merkes fraværende — aldri gjettes av egne modeller.

## Datamodell (gjenbruker NormalizedSignal)

| metricType | unit | subjectType | Eksempel |
|---|---|---|---|
| `ai_mention` | count | competitor/own_property | Leadgrid nevnt i 7 av 50 svar |
| `ai_mention_share` | percent | competitor/own_property | 14 % share-of-voice i bransje-prompt-settet |
| `ai_citation` | count | own_property | theroleroom.com sitert som kilde 3 ganger |
| `ai_recommendation_rank` | score | competitor | Gjennomsnittlig posisjon når nevnt |

`provider` = `geo-probe-anthropic` / `geo-probe-openai` / `geo-probe-perplexity`
(egne registry-oppføringer, syncMode `scheduled`), `topic` = prompt-tema,
geografi = NO + ev. region fra prompt-settet.

## MVP (forslag, ~1 PR-serie)

1. **Prompt-sett-generator**: 30–50 norske kjøpsintensjons-prompts per bransje,
   generert fra industries-katalogen + kundens market-scan (godkjennes av
   kunden før kjøring — prompts er produktinnhold, ikke tilfeldig LLM-utskrift).
2. **Probe-runner** (cron, ukentlig): kjør settet mot Claude + GPT + Perplexity;
   ekstraher merkevarer/URL-er per svar (strukturert ekstraksjon — samme
   mønster som opportunity-recommendation-service).
3. **Lagring**: NormalizedSignals per (merkevare × prompt-tema × uke × motor).
4. **Panel i MI**: share-of-voice-trend + «du mangler i disse temaene» +
   konkurranse-sammenlikning. PanelStateContainer + Estimated-merke.
5. **Løkke-lukking (fase 2)**: gap → content-pack-generator lager GEO-innhold →
   neste ukes måling viser effekt. Dette er salgsargumentet.

Kostnad: ~50 prompts × 3 motorer × 4 uker ≈ 600 LLM-kall/mnd per kunde —
neglisjerbart mot dagens AI-forbruk; spores av AI-usage-trackeren.

## Dogfooding = go-to-market

Første kunde er oss selv: mål Leadgrid/The Role Room i prompt-settet
«leadgenerering Norge», optimalisér (llms.txt finnes allerede i repoet,
utvid + case-innhold), og bruk før/etter-tallene som salgsmateriale.
«Vi brukte dette på oss selv — her er grafen» er lanseringshistorien.

## Registry-konsekvenser

Nye oppføringer når MVP bygges: `geo-probe-*` (implementationStatus følger
byggingen), `perplexity-api` (missingCredentials til konto finnes),
`semrush-prompt-research` (requires paid license — kun hvis
etterspørsels-siden skal inn), `serpapi-ai-overviews` (fase 2, lisensiert).
