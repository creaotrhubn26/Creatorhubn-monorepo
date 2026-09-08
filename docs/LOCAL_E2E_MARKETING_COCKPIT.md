# Lokal e2e for Marketing Cockpit

Suiten `frontend/e2e/marketing-cockpit-e2e.spec.ts` kjører mot en levende
stack. Alt unntatt Metas egne servere er ekte kode: ekte Express, ekte
Postgres, ekte React. Uten oppsettet under hopper suiten over seg selv i
stedet for å gi falskt grønt.

## 1. Database

```bash
pg_ctlcluster 16 main start
su postgres -c "psql -c \"CREATE ROLE creatorhub LOGIN SUPERUSER PASSWORD 'creatorhub'\""
su postgres -c "psql -c 'CREATE DATABASE creatorhub OWNER creatorhub'"
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
```

Skjemaet bygges i to trinn, og rekkefølgen er ikke valgfri:

1. **Basen** fra drizzle-skjemaet (`frontend/shared/schema.ts` er en barrel
   over ~200 skjemafiler):
   `drizzle-kit push --force --config=backend/drizzle.config.ts`
2. **Migrasjonene oppå**, i `sort -V`-rekkefølge — samme rekkefølge som
   `backend/scripts/run-production-migrations.mjs` bruker.

Kjører du dem i motsatt rekkefølge tolker `drizzle-kit push --force`
differansen som *table renames* og døper om eksisterende tabeller. Da må
databasen slippes og bygges på nytt.

Produksjonskjøreren selv (`migrate.sh`) kan ikke brukes lokalt: den krever
`sslmode=require` og Neon-rollene `creatorhub_migration_login` /
`creatorhub_schema_owner`, som ikke finnes på en lokal cluster.

Migrasjon `0350_admin_workspace_modules.sql` inngår i trinn 2 og gir
teamchat-, HR- og innstillingstabellene.

## 2. Backend

`backend/.env` (gitignorert):

```
DATABASE_URL=postgresql://creatorhub:creatorhub@127.0.0.1:5432/creatorhub
NODE_ENV=development
PORT=3003
META_GRAPH_BASE_URL=http://127.0.0.1:4010
THEROLERROOM_PAGE_ID=page-1
THEROLERROOM_PAGE_ACCESS_TOKEN=local-e2e-page-token
THEROLERROOM_IG_USER_ID=ig-1
```

**PORT=3003 er ikke fritt valgt** — `vite.config.ts:19` proxyer `/api` dit.
Vite-serveren selv bruker 5001.

Start: `cd backend && ../node_modules/.bin/tsx server/index.ts`
(vent på `🚀 Backend server running on port 3003`).

Auth: bearer-tokenet `dev-admin-local-session` gir en admin-sesjon
(`server/index.ts:2289`) uten at det finnes noen bruker i databasen.

`DEV_LOCAL_ADMIN_EMAIL=daniel@creatorhubn.com` er nødvendig for
AdminWorkspace-rutene: `requireAdminRoomAccess` låser hele
`/api/admin-room/*` til produkteierens e-post, så med standard
`admin@local.dev` svarer samtlige 403 og backenden er utestbar lokalt.
Overstyringen er kun aktiv utenfor produksjon.

## 3. Graph-stand-in

`META_GRAPH_BASE_URL` peker på en lokal server som svarer med Metas egne
feltnavn (`fan_count`, `followers_count`, …) og logger skrivekall, slik at
`set-cta` og `publish-event` kan bevises å faktisk sende riktige felter.
Uten denne er de to handlingene som endrer Facebook-siden i praksis
uverifiserbare. Se `docs/evidence/2026-09-marketing-cockpit-e2e-graph-base.yaml`.

## 4. Kjør

```bash
cd frontend
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  npx playwright test e2e/marketing-cockpit-e2e.spec.ts --project=chromium
```

## AdminWorkspace-modulene (migrasjon 0350)

Verifisert mot samme stack, som eier:

| Endepunkt | Resultat |
|---|---|
| `GET /workspace/{projects,documents,files,settings}` | 200 |
| `GET /workspace/{channels,team,client-projects}` | 200 |
| `POST /workspace/channels` → `/:id/messages` → `GET` | full rundtur |
| Tom meldingstekst | 400 (CHECK `length(body) BETWEEN 1 AND 8000`) |
| `POST /workspace/team` → `PATCH` → `/:id/absences` | 200/201 |
| Fravær med sluttdato før startdato | 400 (CHECK `absences_range`) |
| `PATCH /workspace/settings` → `GET` | verdien leses tilbake |

`GET /workspace/channels` oppretter default-kanalen `general` ved første
kall; den partielle unike indeksen fra 0350 hindrer duplikater når to
samtidige kall prøver det samme.

`GET /workspace/projects` svarer `unavailable: ["casting_projects"]` når
tabellen mangler — rutene er skjemadrift-tolerante og faller ikke over.

## Hva suiten beviser

- Topp-metrikkene viser tall fra Graph, ikke plassholdere («?»).
- Alle sju faner bytter innhold, og ingen `panel-crashed-*` dukker opp.
- Facebook/Instagram står som «Konfigurert» — regresjonsvern for feilen der
  `configured` ble lest fra seksjonene i stedet for toppnivå.
- `set-cta` og `publish-event` sender faktisk til Graph.

## Hva den ikke beviser

Metas faktiske oppførsel. Stand-in-en svarer alltid 200 med gyldige svar;
rate limiting, permission-feil og at et CTA-felt faktisk dukker opp på siden
kan bare verifiseres mot ekte credentials.
