# Story Graph ↔ spillrepoet (campfire-games)

Mål: manus, replikker og leveransestatus vedlikeholdes ett sted — Story Graph — mens spillet leser derfra og
rapporterer tilbake. For et ett-personsstudio fjerner det dobbeltføring mellom manusdokumenter, kode og status.

## De tre koblingene

| Retning | Hva | Verktøy |
|---|---|---|
| Story Graph → spill | Scener, replikker (cue-ID, EN/NB, opptaksstatus), gate-status som JSON | `pull-scene-manifest.sh` → `Resources/StoryGraph/wfu-manifest.json` |
| Spill (CI) → Story Graph | Test-resultat per scene setter gater med bevis | CI-hook + `post-gate-evidence.sh` / `story-graph-gate-evidence.yml` |
| Utvikler (Claude) ↔ Story Graph | Les scenekortet, oppdater felt, gater, oppgaver, åpne spørsmål | MCP: `rr_get_scene_card`, `rr_update_scene_fields`, `rr_set_scene_gate`, `rr_complete_scene_task`, `rr_add_open_question` |

## Oppsett (én gang)

1. **API-nøkkel for skript og CI:** en admin oppretter en Role Room-nøkkel (`rri_…`) med `projects.write` for
   eierbrukeren (`POST /api/role-room/api-keys`, admin-only). Legg den som secret `STORY_GRAPH_API_KEY` i campfire-games
   og i lokal `.env` (aldri i repoet).
2. **CI-hook:** Story Graph → Integrasjoner → «Ny CI-hook». Hemmeligheten vises én gang → secret
   `STORY_GRAPH_HOOK_SECRET`, hook-id → variabel `STORY_GRAPH_HOOK_ID`.
3. **Manifest i bygget:** kopier `packages/story-graph-runtime/ci/pull-scene-manifest.sh` til `scripts/` i campfire-games
   og kjør den før Xcode-bygget (lokalt og i CI). Fila committes, så bygget er reproduserbart uten nett.
4. **Gater fra tester:** gi test-metodene scene-prefiks (`test_P03_…`). Etter test-jobben kaller CI
   `story-graph-gate-evidence.yml` med scene, gate (`greybox`/`playthrough`) og et xcresult-sammendrag som bevis.
5. **Claude Code i campfire-games:** koble MCP-serveren `https://theroleroom.com/api/role-room/mcp`. Claude Code bruker
   OAuth-flyten (`/.well-known/oauth-authorization-server`, du logger inn som deg selv — ingen nøkkel i fila); alternativt
   Bearer-nøkkelen fra steg 1. Legg
   en `CLAUDE.md`-regel: «Før du implementerer en scene: `rr_get_scene_card`. Etter grønne tester: `rr_set_scene_gate` med
   bevis og `rr_complete_scene_task`. Motsigelser i manus → `rr_add_open_question`, aldri stille endring av replikker.»

## Arbeidsflyt per scene

1. Story Graph Hjem → «Neste scene å bygge» (første uferdige scene uten bestått gråboks).
2. Claude i campfire-games: hent scenekortet, bygg gråboks, kjør tester.
3. CI setter `greybox` til bestått med bevis; Claude lukker oppgavene.
4. Replikker endres i Story Graph → neste `pull-scene-manifest.sh` oppdaterer spillet.

## Lokal utvikling

`scripts/dev/story-graph-local/setup.sh` setter opp Postgres, skjema, QA-brukere og WFU-seeden på én kommando
(passord i `~/.cache/story-graph-local/users.json`). Pull-skriptet kan pekes mot lokal backend med
`STORY_GRAPH_BASE_URL=http://localhost:3003`.

## Status

Monorepo-siden (manifest, MCP-skriv, pull-skript, «neste scene») er levert. Koblingen i campfire-games venter på at
Claude GitHub-appen får tilgang til repoet.
