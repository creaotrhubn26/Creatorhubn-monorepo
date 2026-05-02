# Role Room Agent — Information Architecture + Workflow

The Role Room Agent er Brandwatch-style: vi analyserer en bedrift, setter sammen en komplett markedsføringsløsning, publiserer på tvers av plattformer, lytter til reaksjoner, og itererer.

## Producer-reisen

```
Step 1: ANALYZE
  └─ Hvem er bedriften? Hva sier websiden, Brreg, Google Places?
  └─ Hvilke kontoer eksisterer på sosiale medier?
  └─ Output: Brand snapshot, target audience, tone of voice, content categories

Step 2: PLAN
  └─ Bygg pillar strategy (5 content pillars med KPIs)
  └─ Generer 30-dagers post-plan med hooks, captions, formats
  └─ Lock posts du er fornøyd med, juster resten

Step 3: PUBLISH
  └─ Koble Instagram + Facebook Page + (kommer: TikTok, LinkedIn, X)
  └─ Approve hver post (review-flyt — kommer i Phase 6)
  └─ Schedule via job queue (kommer: pg-boss i Phase 1.2)
  └─ Auto-fire på riktig tidspunkt

Step 4: LISTEN
  └─ Webhook fra Meta/TikTok/etc → social_events
  └─ Sentiment-scoring via Claude Haiku
  └─ Unified inbox: comments, mentions, DMs, reactions across all platforms
  └─ Mark read / actioned / hidden

Step 5: MEASURE
  └─ Periodic insights-fetch → social_metrics
  └─ Cross-platform dashboard: impressions, reach, engagement per pillar
  └─ Sentiment trends, share-of-voice
  └─ Iterate: feed metrics tilbake til ANALYZE i agent-prompts
```

## Tab-reorganisering

| Fase | Tabs (eksisterende → ny gruppering) |
| --- | --- |
| **Analyze** | Research, Meta Page (diagnostic) |
| **Plan** | Markedsplan, Feed-planner |
| **Publish** | Feed-planner publish-actions (i samme tab), FB Publish (one-off video), Page Mentions, Page Content (alle samlet under "Publish > Tools" hvis behov) |
| **Listen** | Inbox (ny) |
| **Measure** | Analytics dashboard (kommer) |
| **Tools** (utility) | IG Hashtags, Ads Attribution |
| **Chat** | Persistent agent-konversasjon |

## UX-prinsipper for Role Room Agent

1. **Workflow visible**: Bruker skal alltid se hvor i 5-fase-flyten de er. Stepper øverst i dialogen, ikke bare en tab-rad.

2. **Progressive disclosure**: De fem fasene er alltid synlige. Power-user-tools (hashtags, attribution) ligger under "Verktøy"-meny / sidekolonne, ikke som primære tabs.

3. **One source of truth per surface**:
   - Inbox er ENESTE sted for inbound events. Ikke duplikat i FB Mentions-tab.
   - Feed-planner er ENESTE sted for outbound content. Ikke duplikat i FB Publish.
   - Insights/Analytics er ENESTE sted for metrics.

4. **Cross-platform-first**: All UI viser plattform-agnostisk info som default, med plattform-filter for drill-down. Ikke separate IG-, FB-, TikTok-paneler som kunden må navigere mellom.

5. **State-aware actions**: Knapper og handlinger reflekterer connection-state. "Publiser"-knapp er disabled inntil minst én konto er koblet. Tom state forklarer hva neste steg er.

6. **Agent som rød tråd**: Chat-tab er alltid tilgjengelig på siden, ikke skjult bak en tab. Agent vet hvor i flyten brukeren er og kan foreslå neste handling.

## Implementeringsfaser for UX-restruktureringen

| Steg | Hva | Innsats |
| --- | --- | --- |
| 1 | Workflow stepper øverst (5 faser) — visuell veiledning | 1-2 t |
| 2 | Tab-gruppering med subtile dividers/labels | 2-3 t |
| 3 | Flytt utility-tabs (Hashtags, Attribution) til sekundær menu | 2-3 t |
| 4 | Empty-states på hver fase som forklarer "neste steg" | 3-4 t |
| 5 | Persistent chat-knapp/sidebar i hele dialogen | 4-6 t |
| 6 | Cross-platform analytics-dashboard for fase 5 | 8-12 t |
| 7 | Approval-flyt mellom fase 2 (Plan) og fase 3 (Publish) | 6-8 t |

Steg 1-2 implementeres nå — gir umiddelbar UX-gevinst uten å breake eksisterende tabs.
