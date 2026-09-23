# Story Graph — lokal full stack

```bash
scripts/dev/story-graph-local/setup.sh          # Postgres + skjema + QA-brukere + What Follows Us-seed
scripts/dev/story-graph-local/setup.sh --reset  # slett lokal database og start på nytt
```

Hva skriptet gjør (idempotent):

1. Postgres 16 i `~/.cache/story-graph-local/pgdata` (som root: `/var/lib/postgresql/story-graph-local`), port 5432, trust-auth.
2. `drizzle-kit push --force` for baseline-tabellene (`users` m.fl.).
3. Alle `backend/migrations/*.sql` i prod-rekkefølge via `migrate.mjs`, med nye forsøk så lenge noe lykkes.
   Rundt 200 filer for andre produkter feiler lokalt og listes i `migrate-failed.json`; skriptet stopper bare hvis en
   Story Graph-migrasjon (`narrative*`, `game_*`) feiler.
4. Lokale skjema-lapper som prod allerede har (`users.password`, `username`, `auth_session_version`, id-default).
5. Brukerne `qa-owner` (Studio-plan), `qa-solo` (Solo) og `qa-member` (teammedlem hos eieren), prosjektene
   `what-follows-us-local` og `solo-tomt-prosjekt`. Passord genereres og lagres i `users.json` (mode 600, utenfor repoet).
6. `seed:story-graph` for WFU (34 scener, 84 replikker, 12 episoder).

Miljøvariabler: `STORY_GRAPH_LOCAL_DIR`, `STORY_GRAPH_PGDATA`, `STORY_GRAPH_PG_PORT`, `PG_BIN`.

Start deretter backend og frontend som skriptet skriver ut. Innlogging: `POST /api/auth/login` med
`loginAs: "game_studio"`, eller i UI-et via `theroleroom.html?mode=game_studio`.
