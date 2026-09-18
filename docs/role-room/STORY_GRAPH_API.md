# Story Graph — API-referanse (integrasjonsflater)

Base: `/api/role-room/narrative`. Autentisering: samme Role Room-sesjon som resten av appen
(`Authorization: Bearer <token>`); alle `/projects/:projectId/...`-ruter krever prosjekttilgang
(eier, medlem, utdanningsbro eller aktivt spillstudio-teammedlem). Svar: `{ success: true, data }`;
feil: `{ error: <kode> }` med 400/402/403/404/409/413/429/503. Plan-gating svarer 402
`{ error: 'plan_required', feature, planSlug }` eller `{ error: 'plan_limit', limit, max }`.

## Graf (Fase 1–5)
`GET /projects/:id/graph` · `PUT /projects/:id/settings` · `POST|PATCH|DELETE /projects/:id/{boards,elements,connections,components,attributes,variables,assets}` ·
`POST /projects/:id/connections/batch` · `GET /projects/:id/validate` · `GET /projects/:id/export.{json,md,csv,pdf}?locale=` ·
`POST /projects/:id/import` (`format: arcweave|twee|ink`) · `POST /projects/:id/translate` · `GET/POST /projects/:id/share-links`, `POST …/:id/revoke` ·
`GET /public/:token` (offentlig, 120/min per token) · `GET/POST /projects/:id/revisions`, `POST …/:id/restore`.

## Scener og produksjon (Fase 6–7)
`GET/POST /projects/:id/scenes`, `GET/PATCH/DELETE /scenes/:sceneId`, `PUT …/links`, `POST|PATCH|DELETE …/frames`, `PUT …/frames/order`,
`POST|PATCH|DELETE …/tasks`, `GET/POST …/reviews`, `POST …/reviews/:reviewId/decision`, `PUT …/gates/:gateKey`, `…/lines` CRUD + `PUT …/lines/order` ·
`/episodes`, `/open-questions`, `/sources`, `/milestones` (+ `PUT …/scenes`), `/platform-targets` · `GET /projects/:id/overview` · `GET /projects/:id/inbox`, `POST …/:id/read`, `POST …/read-all` ·
`GET /projects/:id/members-lite` · gjeste-review: `/review/:token` (offentlig), `…/reviews/:reviewId/share-links` (Studio).

## Fase 8
| Rute | Hva | Plan |
|---|---|---|
| `POST /projects/:id/import-document` (multipart `file` ≤ 15 MB) → `{ diff, stats, sourceSha256 }`; `POST /projects/:id/scenes/import-document/apply` | Manusimport, dry-run + apply | alle |
| `GET/POST /projects/:id/ci-hooks`, `POST …/:hookId/revoke`, `GET …/:hookId/deliveries`, `GET /projects/:id/ci-deliveries` | CI-bevis-hooks (hemmelighet vist én gang) | Studio (`ci_evidence`) |
| `POST /api/role-room/narrative/hooks/ci/:hookId` (HMAC `X-StoryGraph-Signature-256`), `POST …/evidence` (multipart, `X-StoryGraph-Hook`) | Webhook fra CI → `setSceneGate` | (hook-hemmelighet) |
| `GET /projects/:id/assets/:assetId/download` | Kortlevd signert URL for objektlager-assets | alle |
| `POST /api/role-room/projects/:id/ai-suggestions/generate` `{ agentName: 'script-guardian-agent', sourceType: 'project', sourceId, payload: { mode: 'deterministic'|'full' } }` | Manusvakt (regler gratis; `full` = KI) | `ai_assist` for `full` |
| `GET/POST /projects/:id/playtest-tokens`, `POST …/:tokenId/revoke` | Spilltest-tokens (råtoken vist én gang) | Studio (`playtest_telemetry`) |
| `POST /api/role-room/narrative/playtest/events` (`Authorization: Bearer sgp_…`) | Telemetri-inntak, alltid 204 (413 > 500, 429 > 600/min) | (token) |
| `GET /projects/:id/playtest/summary?build=&days=` | Aggregat per scene | alle |
| `POST /projects/:id/scenes/:sceneId/frames/from-base64` | KI-referansebilde → objektlager → ramme (10/dag) | `ai_assist` |
| `POST /projects/:id/apply-template` `{ template: 'blank'|'demo-adventure'|'wfu-sample' }` | Prosjektmal (revisjon «Før mal» først) | alle (teller mot `maxProjects`) |

## MCP-verktøy (spillmodus)
Lese: `rr_get_story_graph`, `rr_list_story_components`, `rr_validate_story_graph`, `rr_export_story_graph` (json/md/csv), `rr_list_game_scenes`,
`rr_game_scene_review_status`, `rr_get_scene_card`, `rr_project_overview`, `rr_script_guardian_check`. Skrive: `rr_draft_element` (utkast-brett, aldri koblet inn i flyten).

## Eksportformater
`export.json` = Arcweave `project.json` 1:1 (Arcweaves MIT-plugins for Unity/Unreal/Godot leser den direkte); `export.md`, `export.csv`
(norsk Excel-profil), `export.pdf` (Pro/Studio); standalone HTML fra Eksport-fanen. Runtime-pakker: `packages/story-graph-runtime/{js,unity,godot,swift}`.

## Hardening (Fase 8a/8g)
Av-bryter `ROLE_ROOM_GAME_STUDIO_ENABLED=false` → 503 `game_studio_disabled` på `/api/role-room/narrative` og `/api/game/*` ·
rate-limit 300 mutasjoner/min per bruker (429 + `Retry-After`) og 120/min per offentlig token · revisjons-retensjon (siste 50 + én per dag i 90 dager) ·
`maxProjects` håndheves ved første Story Graph-skriving i et nytt prosjekt (402 `plan_limit`) · Sentry på alle rutefeil · Neon-branch-tørrkjøring av migrasjoner før prod.
