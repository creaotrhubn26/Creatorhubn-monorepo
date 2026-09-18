# Story Graph — CI-bevis for leveransegater (Fase 8c)

Spillbygget setter leveransegater i Story Graph selv, med bevis, i stedet for at «bestått»
settes for hånd. Regelen «ingen gate er bestått fordi dokumentet finnes» gjelder også for CI:
`passed` uten `evidence` avvises og logges.

## Flyt

1. **Integrasjoner-fanen** (`?tab=integrations`) → «Opprett hook». Hemmeligheten (`sgh_…`)
   vises **én gang**; legg den og webhook-URL-en i spill-repoets secrets
   (`STORYGRAPH_HOOK_SECRET`, `STORYGRAPH_HOOK_URL`).
2. CI kjører tester/bygg, og kaller `packages/story-graph-runtime/ci/post-gate-evidence.sh`
   (eller den gjenbrukbare workflowen `.github/workflows/story-graph-gate-evidence.yml`):
   ```bash
   STORYGRAPH_HOOK_URL=https://<backend>/api/role-room/narrative/hooks/ci/<hookId> \
   STORYGRAPH_HOOK_SECRET=sgh_… \
   post-gate-evidence.sh --scene P01 --gate greybox --status passed \
     --evidence "68 bestått, 0 feil" --artifact build/Prologue-P01-Final.xcresult.zip \
     --commit "$GITHUB_SHA" --run-url "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
   ```
3. Gaten på scenekortet får status, bevis-tekst, `commit:`/`run:`-refs og «Satt av CI».
   Artefakten ligger som `asset:<id>` og lastes ned via «Last ned bevis» (kortlevd signert URL).
4. Leveringsloggen i Integrasjoner-fanen viser anvendt/avvist med årsak
   (`unknown_scene`, `gate_evidence_required`, `invalid_payload`).

## Protokoll

- `POST /api/role-room/narrative/hooks/ci/:hookId` — `Content-Type: application/json`,
  header `X-StoryGraph-Signature-256: sha256=<hex HMAC-SHA256 over rå body>`.
  Body: `{ scene, gate, status, evidence?, evidenceRefs?, commitSha?, runUrl?, build? }` der
  `scene` er arbeids-ID (`P01`, `G03A`) eller scenekode, `gate` ∈ `script_coverage | greybox |
  characters_animation | playthrough | picture | audio`, `status` ∈ `passed | failed | in_progress`.
  Svar: 200 `{ ok, status: 'applied', gate }`, 422 `{ status: 'rejected', error }`, 400 `invalid_payload`,
  401 ved feil signatur/ukjent/tilbakekalt hook (samme svar — ingen enumerering), 429 over 120/min.
- `POST /api/role-room/narrative/hooks/ci/:hookId/evidence` — multipart `file` (≤ 50 MB) +
  felt `scene`, `gate`; header `X-StoryGraph-Hook: <hookId>:<hemmelighet>`. Svar 201
  `{ assetId, ref: 'asset:<id>', storageKey, name, sizeBytes }`. Krever objektlager
  (`CREATORHUB_*`-S3-oppsett); uten det 503 `storage_unavailable`.
- Begge er montert i `backend/server/index.ts` **før** den globale `express.json()`, fordi
  body-parser hopper over når `req._body` alt er satt — rå body til HMAC finnes bare der
  (samme grunn som Stripe-webhookene).
- Gaten skrives gjennom `setSceneGate(...)` med `checked_by = 'ci:<hookId>'`, så CHECK-en
  «bestått krever bevis» gjelder. Sanntid: `narrative:graph_changed { kind: 'scene' }`.

## Sikkerhet

- Hemmeligheten lagres i klartekst i `narrative_ci_hooks.secret` (HMAC trenger råhemmeligheten;
  samme valg som Leadgrid-webhooks). Tilbakekall gir 401 umiddelbart. Roter ved å opprette ny hook.
- Sammenligning med `timingSafeEqual`; ukjent hook og feil signatur svarer likt.
- Per-hook rate-limit (120/min) i minnet. Ingen PII i payload.

Kode: `backend/server/role-room-narrative-ci-hooks.ts` (+ test), migrasjon
`0643_narrative_ci_hooks.sql`, ruter for hooks/leveringer/nedlasting i `role-room-narrative-routes.ts`,
UI `narrative/integrations/IntegrationsPanel.tsx`, gate-fanen `scenes/SceneGatesTab.tsx`.
