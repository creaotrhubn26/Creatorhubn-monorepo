# 10. Innsiktsmotoren — dataanalyse som operativ funksjon

Dato: 2026-07-12. Bakgrunn: Daniels retning — plattformen skal *svare* på
tre spørsmål i alle markeder, ikke vise rapporter:

1. **Hva skjer i markedet?** (deskriptivt)
2. **Hvorfor skjer det?** (diagnostisk)
3. **Hva bør virksomheten gjøre nå?** (preskriptivt)

Analyse bygges inn som operativ funksjon: innsikter bor der beslutninger
tas (feed i MI, varsler, inline-anbefalinger) — rapporten er biproduktet.

## Arkitektur

```
normalized_signals (+ geo-tabeller) ──► DETEKTORER ──► insights (0380) ──► Feed/varsler
   fem kilder, felles skjema             rene stat-      førsteklasses      MI-panelet,
                                         funksjoner      entiteter m/       fremtidig
                                         m/ konfidens    evidens-refs       push/e-post
```

**Detektor-kontrakten**: en detektor er en ren funksjon over signaler/
probe-data som produserer innsikts-kandidater med `severity`, `confidence`,
`evidence` (referanser til radene påstanden bygger på) og en deterministisk
`dedupeKey` — samme funn to dager på rad blir ÉN innsikt, ikke to.

**Analytisk redelighet (No Fake Insights)**:
- **Min-utvalg-vakter**: GEO-utvalg er små (n≈25/sett) — endringer under
  minimums-n eller under støyterskel produserer INGEN innsikt. Heller
  stillhet enn falsk alarm.
- **Konfidens er data, ikke pynt**: beregnes fra utvalgsstørrelse og
  endringsmagnitude; vises i UI.
- **Evidens-plikt**: hver innsikt refererer radene den bygger på. Fase 2
  (diagnostikk-narrativ via LLM) får KUN uttale seg om evidensen.

## Fasene

| Fase | Innhold | Status |
|---|---|---|
| 1 | insights-tabell (0380), detektor-rammeverk, 4 detektorer, dedup, cron, feed i MI | **live i prod** |
| 2 | Diagnostikk: kryss-kilde-kobling per topic, driver-dekomponering, evidens-grunnet LLM-narrativ («hvorfor») | **bygget** — narrativ m/ siterings-validering i kode (insight-diagnostics.ts), min. 2 uavhengige kilder, kostnadstak 10/kjøring |
| 3 | Score-modeller (P2): konfigurerbare faktormodeller erstatter LLM-frihånd i opportunity-scoring — **faktorer/vekter er Daniels produktbeslutning** | maskineri bygget (doc 11) — vekter venter på Daniel |
| 4 | Lukket løkke: anbefaling → handling (content-generator/kampanje/Leadgrid) → måling → modell-justering; Leadgrid won/lost som fasit | etter 3 |

## Fase 1-detektorene

| Detektor | Kilde | Sier ifra når |
|---|---|---|
| `geo-sov-change` | geo-probe-signaler (ai_mention per merke/motor) | Et merkes omtaler endres ≥ terskel mellom to kjøringer (min-n-vakt) — «Spotlight 3→7 i casting-settet» |
| `ai-referral-change` | ga4 ai_referral_sessions | AI-trafikk endres vesentlig, ELLER en ny kilde dukker opp (0→N: «første besøk fra Perplexity») |
| `gsc-position-drop` | gsc owned_position per søkeord | Snittposisjon faller ≥ terskel på søkeord med visninger over gulv |
| `new-discovered-competitor` | geo_probe_results.discovered_brands | Et ukjent merke når ≥ N omtaler i siste kjøring uten å stå i konkurrentlisten — «kandidat til listen» |

Nye detektorer legges til ved å implementere kontrakten — rammeverket,
dedup, lagring og visning er felles.

## Grensesnitt

- `POST /api/integrations/insights/run` (CRON_TRIGGER_TOKEN) — kjøres av
  daglig-synk-workflowen etter datainnhenting
- `GET /api/integrations/insights?status=` (admin, org-scopet)
- `PATCH /api/integrations/insights/:id` — status: seen/dismissed/actioned
- **InsightsFeedPanel** øverst i MI-seksjonen: severity-chips, konfidens,
  utvidbar evidens, avvis-knapp. Tom-tilstand er ærlig («ingen vesentlige
  endringer siden sist»).

## Daniels rolle (dataanalytikeren som produkt)

Terskler, minimums-n, severity-grenser og (i fase 3) faktormodellene er
domenebeslutninger — de ligger som navngitte konstanter i detektorene med
begrunnelse i kommentar, klare til å strammes/løsnes når virkelige data
viser støynivået. Motoren operasjonaliserer; analytikeren definerer.
