# 3. Google Trends Access Assessment + Strategy

## Nå-situasjon (verifisert)

- **Ingen Trends-integrasjon eksisterer.** `google-trends-api@4.9.2` ligger i
  `backend/package.json:206` med null call-sites. Denne pakken er en
  *uoffisiell* klient som scraper Trends-nettsiden — den skal **ikke** tas i
  bruk (ToS-brudd + notorisk ustabil, 429-blokkering). Anbefaling: fjern.
- Ingen BigQuery-tilgang finnes (ingen GCP-prosjekt-infra i bruk).
- Ingen manuell import-mekanisme finnes ennå.

## Tilgangsvurdering

| Vei | Status | Vurdering |
|---|---|---|
| Offisiell Google Trends API (alpha) | `awaitingApproval` er ikke engang startet — søknad må sendes (**manuell eier-handling**) | Gir interest-over-time, interest-by-region, related topics/queries med konsistent skalering; gratis; kvoter ukjent til tilgang gis |
| Trends BigQuery-datasett (`bigquery-public-data.google_trends`) | Tilgjengelig i dag med GCP-prosjekt | Dekker kun top terms/rising queries (primært US-fokusert DMA-nivå; internasjonal tabell finnes men begrenset) — supplement, ikke erstatning |
| Manuell CSV-eksport fra trends.google.com | Tilgjengelig i dag | Lovlig for intern bruk; perfekt match for import-flyten; skaleres ikke, men dekker MVP-demo og pilot-kunder |
| Google Ads Keyword Planner | Tilgjengelig (krever developer-token-avklaring) | Absolutt volum-proxy — komplementær, ikke Trends-ekvivalent |
| Uoffisielle scrapere / tredjeparts «Trends API»-SaaS (SerpApi o.l.) | `rejected` (scraper) / `requiresLicensedProvider` (SaaS) | Scraping av Trends bryter ToS; SaaS-mellomledd flytter men fjerner ikke risikoen — krever bevisst leverandørvurdering |

## Adapterarkitektur (implementert som kontrakt i denne leveransen)

`backend/server/integrations/search-trend-provider.ts` definerer:

```ts
interface SearchTrendProvider {
  providerId: string;
  getInterestOverTime(req): Promise<NormalizedTrendSeries>;
  getInterestByRegion(req): Promise<NormalizedRegionalInterest>;
  getRelatedQueries(req): Promise<NormalizedRelatedQueries>;
  getProviderCapabilities(): Promise<ProviderCapabilities>;
  healthCheck(): Promise<IntegrationHealth>;
}
```

Planlagte implementasjoner (i prioritert rekkefølge):

1. `ManualTrendImportProvider` — leser normaliserte rader fra import-flyten
   (første som bygges; gjør UI-et ekte uten API-tilgang).
2. `GoogleAdsKeywordProvider` — volum-proxy fra Keyword Planner
   (metricType `search_volume_avg`, aldri presentert som «trend-interesse»).
3. `GoogleTrendsAlphaProvider` — når/hvis alpha-tilgang innvilges.
4. `GoogleTrendsBigQueryProvider` — kun hvis BigQuery-veien viser seg å dekke
   norske behov (verifiser dekning før bygging).

Frontend/analyse avhenger kun av kontrakten + `NormalizedSignal` — aldri av én
provider.

## Availability-tilstander (krav fra oppdraget → hvordan de realiseres)

| Tilstand | Systematferd |
|---|---|
| API access granted | `GoogleTrendsAlphaProvider` aktiv i registeret; øvrige som fallback |
| Awaiting approval | Registry-status `awaitingApproval`; Admin Center viser hvilke funksjoner som mangler + hvilken alternativ kilde som serverer widgeten |
| No API access | Fallback-kjede: BigQuery-provider (hvis dekkende) → Ads-provider (volum) → manuell import; hver widget merker kilden |
| Provider failure | Server cached data hvis `freshnessScore` er innenfor terskel; ellers `Unavailable`-tilstand i widgeten — aldri krasj (jf. PanelStateContainer + widget-kontraktens errorState) |

Hver Trends-respons/widget viser alltid: siste vellykkede oppdatering,
datakilde (providerId), dataalder, og status-merke
`Live / Cached / Imported / Estimated / Demo / Stale / Unavailable`
(feltene finnes i `NormalizedTrendSeries.meta` i kontrakten).

**Semantisk vakt:** Trends-tall er relative (0–100 per query-sett) og skal
aldri regnes om til absolutt volum eller blandes med Keyword Planner-tall i
samme serie. Kontrakten skiller dem på `unit: 'relative_index'` vs.
`'searches_per_month'`, og `NormalizedSignal`-validatoren krever `unit`.
