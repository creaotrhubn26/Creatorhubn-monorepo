# PriceManagement — robusthets-oppfølging (spec for Claude Code)

Gjelder `frontend/client/src/components/admin/PriceManagementDashboard.tsx`
(~2940 linjer). Tema-harmoniseringen er gjort i PR #922. Dette er de
**robusthets-/stabilitets-forbedringene** Daniel valgte (#1, #2/#3, #5) som
IKKE ble implementert i sandkassen fordi de rører **betalings-kritisk** logikk
og krever live verifisering mot backend/Stripe (ikke tilgjengelig i sandkassen).

## ⚠️ Viktig korreksjon fra utforskningen
Et tidligere antatt «risikabelt auto-save på priser» **finnes ikke**:
- `setTimeout` i `useEffect` ~linje 896 er en **debounced lagrings-kost-
  forhåndsvisning** (`GET /api/admin/storage-cost/preview`), ikke lagring.
- `savePlanEdit` (~923) er **eksplisitt** lagring og har allerede grundig
  validering (måneds-/årspris ≥ 0, storage-cap 0–100 000 GB, overforbruk ≥ 0).

Konklusjon: «fjern auto-save» (#2) er i praksis **N/A** – lagring er allerede
eksplisitt og knappestyrt. Fokuser i stedet på #1, validering av de
gjenværende lagre-funksjonene, Stripe-drift-status og en dirty-vakt for
enterprise-seksjonen.

## #1 — Migrer datalasting til React Query (robusthet)
I dag laster `loadData()` (useEffect ~614–717) via **rå `fetch`** uten retry/
cache/bakgrunns-refresh. Fire kilder:
- `GET /api/platform/admin/subscription-plans` → `setPlans`
- `GET /api/platform/admin/email-settings` → `setCreatorHubEmailSettings`
- `GET /api/admin/analytics/dashboard?period=30d` → `setAnalytics`
- `GET /api/admin/enterprise-pricing` → `setEnterprisePricing`

Gjør hver til `useQuery` (retry, `staleTime` ~60s, graceful error). Behold
lokale **redigerbare** kopier (`plans`, `enterprisePricing`, …) som seedes fra
query-data (f.eks. `useEffect(() => setPlans(seed), [query.data])`), siden
lagre-funksjonene muterer lokalt før POST.

## #4 — Lagring via React Query-mutasjoner
Gjør `saveFeature` (~815), `savePlanEdit` (~923), `saveEnterprisePricing`
(~1164), `saveEmailTemplate` (~1136), `saveCreatorHubEmailSettings` (~1088) til
`useMutation` med `onSuccess: invalidateQueries(...)` + optimistisk oppdatering
og rollback ved feil. Behold eksisterende snackbar-feedback.

## #5a — Validering (hull funnet)
`savePlanEdit` er allerede validert. `saveEnterprisePricing` (~1164) POSTer
`enterprisePricing` **uten validering**. Legg til validering før POST:
- alle beløp er endelige tall ≥ 0, påkrevde felter ikke tomme.
- avvis NaN/negative og vis feil-snackbar (samme mønster som `savePlanEdit`).
Sjekk også `saveFeature`/`saveEmailTemplate` for tomme påkrevde felter.

## #5b — Stripe-sync / drift-status (read-only, verdifull)
Backend har allerede drift-deteksjon:
- `GET /api/admin/marketplace/stripe-price-drift/history` (admin-guardet) →
  siste `stripe_price_drift`-varsler (id, title, message, severity, created_at, status).
- `POST /api/admin/marketplace/stripe-price-drift/...` (~linje 238) kjører sjekk.
- Cron: `GET|POST /api/cron/stripe-price-drift`.

Vis et lite «Stripe-sync»-kort i prispanelet: hent drift-history, og hvis det
finnes åpne drift-varsler → vis advarsel («Publisert pris matcher ikke Stripe»)
med lenke/CTA til å kjøre ny sjekk. Lar admin oppdage at CreatorHub-pris og
Stripe-pris har kommet ut av sync.

## #3 — Dirty-indikator + forlat-vakt
Plan-redigering skjer i dialog (lav risiko). Enterprise-prisene redigeres
derimot **inline** i `enterprisePricing`-state med eksplisitt «Lagre». Legg til:
- `dirty`-flagg (sett true ved endring, false etter vellykket lagring),
- synlig «ulagrede endringer»-chip ved enterprise-seksjonen,
- `beforeunload`-guard når `dirty` er true.

## QA-sjekkliste (må kjøres live – ikke mulig i sandkassen)
- [ ] Verifiser at alle fire GET-endepunkter svarer som antatt, og at React
      Query-seedingen ikke overskriver pågående redigering.
- [ ] Lagre-mutasjoner: optimistisk oppdatering + rollback ved 4xx/5xx.
- [ ] `saveEnterprisePricing` avviser ugyldige tall før POST.
- [ ] Stripe-drift-kortet viser ekte `stripe-price-drift/history`-data og at
      «kjør sjekk»-CTA fungerer.
- [ ] Ingen regresjon i publiserings-flyten (betalt-plan-publisering,
      Stripe-priser, årspriser).
