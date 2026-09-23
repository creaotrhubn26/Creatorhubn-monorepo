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

## Konto og prosjekt (UX QA 2026-09)

- `POST /api/auth/login` med `{ email, password, loginAs: 'game_studio', role, signup: true }` oppretter en Solo-konto
  hvis e-posten ikke finnes (passord ≥ 8 tegn → ellers 400). Uten `signup` er oppførselen uendret (401 for ukjent e-post).
- E-posten må være bekreftet først: `POST /api/auth/email-code/send` `{ email, purpose: 'game_studio_signup' }` →
  `POST /api/auth/email-code/verify` `{ email, purpose, code }`. Uten en kode verifisert de siste 30 minuttene svarer
  login-kallet 403 `{ error: 'email_verification_required' }` og oppretter ingenting (ingen kan registrere andres adresse).
  Ingen kommersiell gate for Spillstudio; Stripe skjer inne i workspacet («Pris»).
- `POST /api/role-room/projects` `{ name, projectType: 'game' }` brukes av prosjektvelgeren i spillstudio-modus
  («Nytt prosjekt»); plan-kvoten (`maxProjects`) håndheves ved første Story Graph-skriving, ikke ved opprettelse.
- `GET /api/game/teams/me`: en bruker uten team-medlemskap får teamet bootstrappet (fire standardroller + Eier-medlemskap)
  første gang, slik at Team-fanen viser «Inviter»/«Ny rolle».

## MCP-verktøy (spillmodus)
Lese: `rr_get_story_graph`, `rr_list_story_components`, `rr_validate_story_graph`, `rr_export_story_graph` (json/md/csv), `rr_list_game_scenes`,
`rr_game_scene_review_status`, `rr_get_scene_card`, `rr_project_overview` (inkl. `nextScene`), `rr_script_guardian_check`,
`rr_export_scene_manifest`. Skrive: `rr_draft_element` (utkast-brett, aldri koblet inn i flyten).

Fase 9 — skriveverktøy for solo-flyten (Claude i spillrepoet oppdaterer Story Graph direkte, krever `projects.write`).
`scene` kan være id (`nsc_…`), kode (`S12`) eller arbeids-ID (`P03`, `G03A`):
- `rr_update_scene_fields` `{ projectId, scene, fields }` — manusfelt (`beforeState`, `action`, `control`, `afterState`, `audio`,
  `changeNote`, `bridge`, `timeNote`), gameplay (`challenge`, `gameplayMechanic`, `environment`), `title`/`subtitle`/`location`
  og `status`. Ukjente felt avvises; kode, ansvarlig og datoer endres ikke herfra.
- `rr_set_scene_gate` `{ projectId, scene, gate, status, evidence }` — samme regel som UI-et: `passed` krever bevis.
  `evidence_refs` får `mcp:<nøkkel-id>` så gaten kan spores til nøkkelen.
- `rr_complete_scene_task` `{ projectId, scene, taskId, status? }` — standard `done`.
- `rr_add_open_question` `{ projectId, question, context? }` — koden settes til neste ledige `DEV-nn`.

## Scene-manifest for spillbygget (Fase 9)

`GET /api/role-room/narrative/projects/:projectId/scenes/export.json` (ugatet, som JSON-eksport) og MCP
`rr_export_scene_manifest` gir samme dokument:

```json
{ "schema": "story-graph.scene-manifest", "version": 1, "projectId": "…", "projectName": "…",
  "generatedAt": "…", "contentHash": "<sha256>",
  "episodes": [{ "code": "E01", "title": "…" }],
  "scenes": [{ "id": "nsc_…", "code": "P03", "workingId": "P03", "title": "…", "status": "in_progress", "era": "1797",
    "episodeCode": "E01", "location": "…",
    "fields": { "before": "…", "action": "…", "control": "…", "after": "…", "audio": "…", "changeNote": "…", "bridge": "…", "timeNote": "…" },
    "gameplay": { "challenge": "…", "mechanic": "…", "environment": "…" },
    "lines": [{ "cueId": "W03.01", "speaker": "ELISE", "speakerComponentId": null, "perspective": "", "sourceType": "E",
                "textEn": "…", "textNb": "…", "recordingStatus": "none" }],
    "gates": { "script_coverage": "passed", "greybox": "not_started", "…": "…" } }] }
```

- Scener og replikker er stabilt sortert; `contentHash` dekker alt unntatt `generatedAt`.
- HTTP-ruten svarer med `ETag: "<contentHash>"` og `304` på `If-None-Match`.
- `version` økes bare ved brytende endring; nye felt legges til uten versjonsbump.
- Spillrepoet henter fila med `packages/story-graph-runtime/ci/pull-scene-manifest.sh` (API-nøkkel, skriver bare ved endret hash).

## Eksportformater
`export.json` = Arcweave `project.json` 1:1 (Arcweaves MIT-plugins for Unity/Unreal/Godot leser den direkte); `export.md`, `export.csv`
(norsk Excel-profil), `export.pdf` (Pro/Studio); standalone HTML fra Eksport-fanen. Runtime-pakker: `packages/story-graph-runtime/{js,unity,godot,swift}`.

- `GET /projects/:id/scenes/export.pdf` (Pro/Studio, `export_pdf`): **manus-PDF av scenekortene** — én seksjon per scene
  med Før/Handling/Kontroll/Etter/Lyd (+ Endring/Bro/Tid, gameplay-felt), kildemerker, replikker og leveransegater,
  pluss sceneliste. Uavhengig av brett; filnavn `<prosjekt>-manus.pdf`. Ikke i MCP (binært).

## Hardening (Fase 8a/8g)
Av-bryter `ROLE_ROOM_GAME_STUDIO_ENABLED=false` → 503 `game_studio_disabled` på `/api/role-room/narrative` og `/api/game/*` ·
rate-limit 300 mutasjoner/min per bruker (429 + `Retry-After`) og 120/min per offentlig token · revisjons-retensjon (siste 50 + én per dag i 90 dager) ·
`maxProjects` håndheves ved første Story Graph-skriving i et nytt prosjekt (402 `plan_limit`) · Sentry på alle rutefeil · Neon-branch-tørrkjøring av migrasjoner før prod.
