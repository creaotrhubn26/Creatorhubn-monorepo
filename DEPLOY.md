# Deploy Guide

Quick reference for hvordan deploye The Role Room til produksjon, hvordan
verifisere, og hvordan håndtere kjente issues.

## Arkitektur

```
GitHub (creaotrhubn26/Creatorhubn-monorepo, main-branch)
       │
       ├─► Render (creatorhub-backend-rtbl)
       │     └─► Backend (Node + Postgres)
       │         URL: https://creatorhub-backend-rtbl.onrender.com
       │         Trigger: auto fra main-push (Git-integrasjon)
       │
       └─► Vercel (creatorhub-frontend)
             └─► Frontend (Vite SSG)
                 Aliases:
                   - https://creatorhubn.com
                   - https://theroleroom.com
                   - https://www.theroleroom.com
                 Trigger: SKULLE være auto fra main-push,
                          MEN webhook er pt brutt — bruk manuell force-deploy
```

## Vanlige kommandoer

### Force-deploy Vercel til prod (når auto-deploy henger)

```bash
cd /Users/danielqazi/Creatorhubn-monorepo
npx vercel --prod --force --yes
```

`--force` skipper bygg-cache, `--yes` skipper bekreftelse. Tar ~3-5 min.
Etter SUCCESS er deploymentet automatisk aliased til creatorhubn.com + theroleroom.com.

### Sjekk Vercel-status

```bash
npx vercel ls                # Liste over siste deploys
npx vercel inspect <url>     # Detaljer + aliases
```

### Render-deploy

Render auto-deployer fortsatt fungerende fra main-push.
Tar typisk 3-5 min (Docker-build + migrasjoner + restart).

Manuell trigger (uten CLI): logg inn på dashboard.render.com → service → "Manual Deploy" → "Deploy latest commit".

### Backend health-check

```bash
curl -sS https://creatorhub-backend-rtbl.onrender.com/api/health | jq .
# {"status":"ok", "commit":"...", "branch":"main", ...}
```

### Full smoke-test mot prod

```bash
bash scripts/smoke-production.sh
```

41 curl-assertions mot backend + frontend. Exit-kode = antall feilende.
Forventet etter en sunn deploy: `RESULTAT: 41 bestått, 0 feilet`.

### Playwright E2E mot prod

```bash
# Engangs-setup
npx playwright install chromium

# Kjør
E2E_BASE_URL=https://theroleroom.com \
  npx playwright test \
  --config=frontend/playwright.smoke.config.ts \
  frontend/e2e/role-room-live-set.spec.ts
```

## Kjente issues

### 1. Vercel Git-integrasjon trigger ikke auto-deploy ⚠️

**Symptom:** Du pusher til main, Render deployer, men Vercel henger på en gammel
deployment (kan være dager gamle).

**Diagnostikk:**
```bash
npx vercel ls | head -3   # sjekk timestamp på siste prod-deploy
curl -sS -I "https://theroleroom.com/" | grep age:  # cache-alder
```

**Fix:** Manuell force-deploy (se over). For permanent fix:
1. Logg inn vercel.com → creatorhub-frontend
2. Settings → Git → bekreft at `creaotrhubn26/Creatorhubn-monorepo` er linket
3. Settings → Git → Production Branch: `main`
4. Disconnect + reconnect Git-repo om webhook er løs

### 2. CMS endpoint 500 etter ny migrasjon

**Symptom:** `/api/cms/pages/:slug` returnerer 500 istedenfor 404.

**Årsak:** migrate.sh tracker migrasjoner per FILNAVN, ikke innhold. Hvis vi
ALTER en eksisterende tabell i en migrasjon som allerede er "applied",
kjører ikke ALTER-en.

**Fix:** Lag NY migrasjon-fil med høyere nummer (f.eks. 145, 146). Bruk
`IF NOT EXISTS` så ALTERs er idempotente.

### 3. Frontend node_modules mangler lokalt

**Symptom:** `npx tsc --project tsconfig.json` viser massevis av "Cannot find module".

**Årsak:** `frontend/node_modules` finnes ikke — utviklet vanligvis via
backend-fokuserte sessions uten å kjøre `npm install` i frontend.

**Fix:** Kjør `cd frontend && npm install --legacy-peer-deps` for lokal
type-sjekking. Trengs IKKE for Vercel-build (Vercel installerer egen).

### 4. Backend package-lock går ut av sync

**Symptom:** Render-build feiler på `npm ci` med help-text-output.

**Årsak:** Repo har root-level workspace-config som dro lock-fila til root
istedenfor backend. Dockerfile kopierer kun backend-mappa standalone.

**Fix:** Regenerer lock-fil workspace-fri:
```bash
cd backend
rm package-lock.json
npm install --workspaces=false --legacy-peer-deps --package-lock-only
```

## Sjekk-liste etter hver deploy

1. **Render-commit matcher main**: `curl https://creatorhub-backend-rtbl.onrender.com/api/health | grep commit`
2. **Vercel-cache er bustet**: `curl -I https://theroleroom.com/ | grep age:` (skal være lav, < 60 sek hvis nylig)
3. **Smoke-test**: `bash scripts/smoke-production.sh` (forventer 41/41)
4. **Manuell sjekk** av key flows:
   - `https://theroleroom.com/vs-studiobinder` — renderer comparison-page
   - `https://theroleroom.com/for-studenter` — renderer student-page
   - `https://theroleroom.com/llms.txt` — server kanonisk LLM-content
   - `https://creatorhubn.com/admin-room` → Presence-tab → Mentions

## Miljø-variabler

### Backend (Render → creatorhub-backend-rtbl → Environment)

Påkrevd:
- `DATABASE_URL` — Postgres connection string
- `ANTHROPIC_API_KEY` — Claude API for Role Room Agent
- `OPENAI_API_KEY` — GPT-fallback
- `SESSION_SECRET` — crypto-random ≥32 tegn

Valgfri (forbedrer features):
- `REDDIT_CLIENT_ID` — OAuth for høyere rate-limits på Reddit-engagement
- `REDDIT_CLIENT_SECRET` — sammen med over
- `REDDIT_USER_AGENT` — default: `TheRoleRoom:engagement-monitor:v1.0 (by /u/theroleroom-app)`

### Frontend (Vercel → Settings → Environment Variables)

Påkrevd (build-time):
- `VITE_API_BASE_URL` — peker til backend-host
- `VITE_ROLE_ROOM_GA_MEASUREMENT_ID` — default brukes hvis tom
- `VITE_CREATORHUB_GA_MEASUREMENT_ID` — samme

Ikke trengs:
- Clarity Project IDs — hardkodet i HTML

## Roll-back

Hvis en deploy ødelegger noe:

### Vercel
```bash
npx vercel ls                      # finn forrige READY deployment
npx vercel rollback <url>          # rull tilbake aliases
```

### Render
Render UI → service → "Events" tab → finn forrige deploy → "Rollback"

### Git
```bash
git revert <commit-sha>            # opprett ny commit som reverter
git push origin main                # trigger Render-rebuild
npx vercel --prod --force --yes    # trigger Vercel-rebuild
```

## Troubleshooting flow

```
Endpoint returnerer 500
        │
        ▼
Sjekk Render-health: hvilken commit kjører?
        │
        ▼
Hvis foreldet → vent på auto-deploy ELLER trigger manuelt fra Render UI
        │
        ▼
Hvis ny commit men 500 → sjekk Render Logs for stack trace
        │
        ▼
Vanlig: ny migrasjon nødvendig for å legge til DB-kolonne (lag fil 14X)


Frontend viser ikke nye sider
        │
        ▼
Sjekk Vercel siste deploy-alder: npx vercel ls
        │
        ▼
Hvis > 1 dag gammel → trigger force-deploy
        │
        ▼
Hvis ny deploy men cache-issue → curl -I siden, sjekk x-vercel-cache + age
        │
        ▼
Vanlig: --force flagg skipper cache, ofte tilstrekkelig
```

## Backend migrasjoner

Migrasjonsfiler ligger i `backend/migrations/`. Format: `<nummer>_<beskrivelse>.sql`.

Migrate.sh kjører automatisk ved Render-start. Tracker per FILNAVN i
`_migrations_applied`-tabellen. Idempotent — kjører hver fil maks én gang.

**Viktig:** Hvis du modifiserer en eksisterende migrasjon-fil etter den er
deployd, kjører den ikke på nytt. Lag ALLTID ny fil med høyere nummer.

Siste migrasjoner i denne sessionen:
- `140_auditions.sql` — auditions-tabell + schedules.audition_id FK
- `141_cms_pages.sql` — cms_pages + cms_page_revisions
- `142_production_graphs.sql` — scene-assembly (foreløpig kun skjema)
- `143_community_presence.sql` — channels + posts + contacts (med seed-data)
- `144_dit_backup_tracking.sql` — DIT-system (destinations + tokens + jobs + events)
- `145_cms_pages_schedule_columns.sql` — fix for publish_at/unpublish_at
