# Google OAuth Login Bounce — Postmortem

**Dato:** 2026-05-19
**Slices:** 9X.55, 9X.59, 9X.60 (iter 1-3), 9X.61, 9X.62
**Status:** Løst
**Tid brukt:** ~6 timer aktiv debug

## Sammendrag

Brukere som logget inn med Google nådde dashboard kortvarig og ble deretter
omdirigert tilbake til `/login` med beskjeden `redirect_uri_mismatch`.
Symptomet stammet fra **to uavhengige backend-bugs** som ble maskert av en
**aggressiv frontend session-wipe** — denne kombinasjonen gjorde rot-årsaken
nesten umulig å diagnostisere fra symptomet alene.

## Tidslinje

| Tidspunkt | Hendelse |
|---|---|
| ~16:30 | Daniel ferdig deployer prototype-tester-program + Stripe webhook |
| ~17:10 | Stine anbefalte tester prøver login, får `redirect_uri_mismatch` |
| ~17:30 | Antok det var Google Cloud Console-config — sjekket og fikset URI-er |
| ~17:50 | Fortsatt feil. Antok stale frontend-state. Bygde session-storage TTL-fix (Slice 9X.59) |
| ~18:00 | Fortsatt bouncer. Begynte å lete etter andre clear-paths |
| ~19:00 | Fant `apiRequest` wipe-on-any-401 (Slice 9X.60). Fikset 3 lag |
| ~19:30 | Brukeren fortsatt bouncer. Spurte etter Console-output gjentatte ganger |
| ~21:00 | **Skiftet til Playwright headed-mode** for å fange flyten programmatisk |
| ~21:30 | Playwright avslørte `chGoogleStatus=error&chGoogleMessage=redirect_uri_mismatch` i navigasjons-log |
| ~21:45 | Fant rot-årsak 1: backend brukte Referer-header til å derive redirect_uri (Slice 9X.61) |
| ~22:00 | Etter fix: ny feil `column "profession" does not exist` (Slice 9X.62) |
| ~22:15 | Fikset siste lag. Brukeren logger inn vellykket |

## Rot-årsaker

### Bug 1 — Backend `redirect_uri_mismatch` (Slice 9X.61)

**Hvor:** `backend/server/creatorhub-google-routes.ts` linje 681-720
(`/oauth/callback`-handler)

**Hva som skjedde:**

1. Frontend kaller `POST /api/creatorhub/google/oauth/start` med
   `browserOrigin: "https://creatorhubn.com"`
2. Backend genererer auth-URL med `redirect_uri=https://creatorhubn.com/api/creatorhub/google/oauth/callback`
3. Bruker logger inn på Google. Google redirecter browseren tilbake til
   `https://creatorhubn.com/api/creatorhub/google/oauth/callback?code=...`
4. Vercel rewriter `/api/*` til Render-backend
5. På Render arriverer requesten med:
   - `Origin`: undefined (top-level navigasjon sender ikke Origin)
   - `Referer`: `https://accounts.google.com/...` (Google var forrige side)
   - `Host`: `creatorhub-backend-rtbl.onrender.com`
6. Backend kaller `getGoogleWorkspaceOauthConfig(req)` →
   `resolveGoogleWorkspaceRequestOrigin`:
   - Origin: ikke satt → skip
   - Referer: `accounts.google.com` — IKKE Render-hostname → returnerer `https://accounts.google.com`
   - `redirect_uri` blir `https://accounts.google.com/api/creatorhub/google/oauth/callback`
7. Backend sender dette `redirect_uri` til Google sin token-endpoint
8. Google: "Dette matcher hverken registrerte URI-er ELLER det som ble sendt
   ved auth-start" → returns `redirect_uri_mismatch`
9. Backend redirecter brukeren til
   `/dashboard?chGoogleStatus=error&chGoogleMessage=redirect_uri_mismatch`

**Fix:** Bruk `oauthState.browserOrigin` (lagret ved auth-start) for å bygge
`redirect_uri` i token-exchange. Den verdien er kanonisk og uavhengig av
request-headere på callback-tid.

**Hvorfor det skjedde:** `resolveGoogleWorkspaceRequestOrigin` ble designet for å
håndtere flere domener (creatorhubn.com, theroleroom.com, lokalhost) dynamisk
basert på request-konteksten. Det fungerte for `/oauth/start` (som har Origin
fra fetch) men brøt for `/oauth/callback` (top-level nav fra Google).
Funksjonen burde aldri brukes når en autoritativ verdi er lagret.

### Bug 2 — `column "profession" does not exist` (Slice 9X.62)

**Hvor:** `backend/server/creatorhub-google-routes.ts` linje 377-442
(`resolveCreatorHubGoogleLoginUser`)

**Hva som skjedde:** Etter at OAuth-token-exchange lyktes, prøver backend å
slå opp brukeren i `users`-tabellen med:

```sql
SELECT id, email, username, first_name, last_name, role, profession, company_name
FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1
```

Prod-databasen har ikke `profession`-kolonnen. PG returnerer feilkode `42703`.
Hele callback-handleren feiler → bruker bouncer.

**Fix:** Try/catch på SELECT. Hvis feilkode er `42703`, fall tilbake til
minimal SELECT uten de manglende kolonnene.

**Hvorfor det skjedde:** Migrasjonene som la til `profession`-kolonnen ble
aldri kjørt på prod (eller ble rullet tilbake). Manuell SQL-tilstand drifter
fra forventet schema. Kritisk auth-kode hadde ingen defensiv håndtering.

### Bug 3 — Frontend `apiRequest` session-wipe-on-401 (Slice 9X.60)

**Hvor:** `frontend/client/src/lib/queryClient.ts` linje ~240

**Hva som skjedde:** Den globale `apiRequest`-helperen hadde:

```ts
if (response.status === 401) {
  clearClientAuthState();  // wiper localStorage
}
```

Det betyr at ENHVER 401-respons fra HVILKEN SOM HELST endpoint logget brukeren
ut. Dashboard fyrer 10+ parallelle queries ved mount; én av dem (typisk
`/api/onboarding/status`) returnerte 401 fordi brukeren ikke har onboarding-
tilgang → hele sesjonen ble wipet → useAuth sa `isAuthenticated=false` →
dashboard bouncet til /login.

**Dette var skyldig i at debugging tok 6 timer.** Det ekte symptomet
(`chGoogleStatus=error&chGoogleMessage=redirect_uri_mismatch` i navigasjons-
loggen) var bokstavelig synlig i hver Network-tab, men maskert av at
brukeren havnet på `/login` med en clear session — det så ut som "auth-bug",
ikke "Google OAuth feilet". Hver gang brukeren prøvde igjen, samme syklus.

**Fix:** Clear KUN på 401 fra auth-spesifikke endepunkter:
`/auth/(user|me|status|validate|refresh)` eller `/session/...`. Andre 401-er
er permission-issues og skal IKKE trigge logout.

## Lessons Learned

### 1. Lagre kanoniske verdier ved start av OAuth-flyten

`redirect_uri` er en kanonisk verdi som BEGGE sider (auth-start + token-
exchange) må enes om. Den må lagres ved start og leses ved exchange — aldri
re-deriveres fra request-konteksten.

**Mer generelt:** Hvis to ulike requests må enes om en verdi (state, nonce,
redirect_uri), så STORE den ved første request. Aldri re-derive.

### 2. Defensiv SQL på kritiske auth-veier

Auth-flyten kan ikke krasje hardt på schema-drift. Hver SELECT som er på
kritisk path bør:
- Bruke try/catch med PG-feilkode-håndtering, ELLER
- Validere schema ved oppstart og feile fast hvis nøkkel-kolonner mangler, ELLER
- Bruke en column-check (`information_schema.columns`) før query

I dette tilfellet hadde vi alternativ 1 — som lar appen fungere selv om
migrasjoner ikke har kjørt ennå.

### 3. Skille auth-failure fra permission-failure

En 401 fra `/api/auth/user` betyr "session er ugyldig — logg ut".
En 401 fra `/api/onboarding/status` betyr "denne rollen har ikke onboarding-
tilgang — bare ignorer".

Frontend må aldri behandle dem likt. Whitelist hvilke endepunkter som faktisk
representerer session-død.

### 4. Bruk Playwright for OAuth E2E fra dag 1

Backend-smoke + frontend-smoke fanger ikke OAuth-callback-flyten, fordi den
krever:
- Ekte browser-navigasjon
- Tredjeparts redirect (Google)
- Token-exchange med ekstern API
- Bootstrap-handler som leser query-params

`scripts/debug-login-headed.mjs` er et regresjons-script vi nå har — den
åpner browser, lar bruker logge inn manuelt, og fanger alt. Burde kjøres
før hver release som rører auth-kode.

### 5. Never silent-swallow auth errors

Backend redirecter til `chGoogleStatus=error&chGoogleMessage=<klartekst>`.
Frontend leste denne en gang og clearet sessionStorage. Det var feil for
debug-formål.

Vi burde:
- Logge alle OAuth-errors på server-siden (med full kontekst: hvilken
  redirect_uri ble sendt, hva Google sa, hvilken state-id)
- Frontend bør vise feilen i LoginModal i stedet for å bare clear-and-bounce
- Aldri stille konsumere feilmeldinger uten å vise dem

## Tiltak vi har implementert

| Tiltak | Status |
|---|---|
| Fix Slice 9X.61 (oauthState.browserOrigin i token-exchange) | ✅ Live |
| Fix Slice 9X.62 (defensiv SELECT med PG-error-fallback) | ✅ Live |
| Fix Slice 9X.60 (apiRequest clearer KUN auth-endpoint-401-er) | ✅ Live |
| `scripts/debug-login-headed.mjs` for regresjon | ✅ Committed |
| Postmortem-dokumentasjon (denne filen) | ✅ Committed |

## Foreslåtte oppfølginger (ikke utført)

1. **Backend: legg til `profession`-kolonnen via migrasjon** så `users`-tabellen
   matcher det koden forventer.
2. **Backend: logg alle OAuth-callback-errors med full kontekst** i Render-loggen,
   inkludert hvilken `redirect_uri` ble sendt vs. forventet.
3. **Backend: gjør `resolveGoogleWorkspaceRequestOrigin` smartere** — den bør
   gjenkjenne at `accounts.google.com` aldri er en gyldig request-origin og
   alltid faller tilbake til `getDefaultPublicOrigin(app)` for OAuth-providers.
4. **Frontend: vis ekte feilmelding i LoginModal** når
   `chGoogleStatus=error` mottas — ikke bare clear-and-ignore.
5. **CI: kjør `debug-login-headed.mjs` mot staging** før hver prod-release
   som rører `creatorhub-google-routes.ts` eller `useAuth.ts`.

## Kilder

- Backend OAuth-handler: `backend/server/creatorhub-google-routes.ts`
- Frontend apiRequest: `frontend/client/src/lib/queryClient.ts`
- Frontend useAuth: `frontend/client/src/hooks/useAuth.ts`
- Frontend session-helpers: `frontend/client/src/lib/creatorhubGoogleAuth.ts`
- Playwright debug-scripts: `scripts/debug-login-*.mjs`
