# CaptureApp Native — Robustness & Scaling Roadmap

_Status: 2026-06-23. Branch `feat/capture-native-surfaces` (25 commits). Audited across three subsystems (Redigering/photo-enhancer, editor-handoff/sync, native surfaces). This document is the single source of truth for hardening + scaling the native iPad CaptureApp toward a real production load (a photographer running **hundreds–thousands of RAW files per shoot**, and **thousands of photographers** concurrently)._

Guiding principle: **always design for scale.** Every surface that touches files, network, or a queue must answer: "what happens at 500 images / 10k users / a flaky 4G uplink?"

---

## 1. What shipped this session

- **Native admin surfaces** (Galleri, Tilbud, Pris, Admin, Meldinger), rich **I dag**, **project loop** (request→project→timeline→worklog), all CreatorHub-dark, e2e vs prod.
- **External-editor handoff**: send-to-editor (Partner Program discovery) → source-file upload → **cull theater** → **job tracking** (status/messages/approve/revision/pay).
- **Redigering** photo-enhancer tab: RAW (CIRAWFilter) Før/Etter, Smart Edit (exposure/contrast/sharpness/saturation/warmth/auto-straighten + presets), AI-retusj (detect+inpaint), crop, masks, reflection, batch persist, **"AI-forbedring (sky)"** (full server enhancer: GFPGAN face restore, Real-ESRGAN upscale, denoise, LUT, EXIF copyright, AI recipe, feedback).
- **Infra**: gfpgan-runner deployed + **AI models live on prod** (weights in R2 `ml-models`, backend `CLOUDFLARE_R2_MODELS_BUCKETS` set, runner timeout 120s). Verified `modelUsed=gfpgan` e2e on a real CR2.

---

## 2. Pre-merge hardening (done now)

These cheap, high-value fixes landed before merge:

- **DashboardClient**: per-request `timeoutInterval=30s`; **bounded retry + exponential backoff w/ jitter** for transient failures (network / 429 / 5xx), **GET-only** (never retries POST/PATCH → no double-submit); clearer 429 / 5xx user messages.
- **PhotoEnhancerClient**: removed force-unwrapped `URL(...)!` (guard/throw) → no crash on a malformed path.
- Verified build green; the DEBUG sample-CR2 seeder + Debug tab are correctly `#if DEBUG`-gated; no secrets in code.

**Recommended before tagging a TestFlight build** (small, not yet done): run `/code-review ultra` on the branch, and add `.accessibilityIdentifier`s to list rows/key buttons for E2E.

---

## 3. The scaling spine (highest leverage)

Three architectural changes unlock everything else. Prioritize in this order.

### 3.1 Async enhance job queue (replaces synchronous `/enhance`)
**Today:** the iPad blocks ~40s on a synchronous `POST /enhance`; the runner is **single-worker CPU** with a global model lock → head-of-line blocking; a 500-image batch would take 2–4h and blow timeouts.
**Target:**
- `POST /enhance` returns a **jobId in <200ms**; client polls `GET /jobs/:id` (progress %, ETA) over a **background URLSession** (survives app suspend).
- Runner moves to **GPU** (Render GPU / Replicate / Modal / RunPod) — 5–10× faster — and **horizontal autoscale** (N replicas, each `--workers 1` to keep the warm model cache; queue depth drives replica count).
- **Warm model pool** + preload on startup so the first call isn't a cold load.
- Offline enhance queue on device (Core Data) that drains on reconnect.

### 3.2 Streaming, concurrent file transfer (uploads + staging→BYO)
**Today:** source files upload **sequentially**, full bytes in RAM; the backend `transferStagingToPhotographer` **buffers each whole file** (`streamToBuffer`) → OOM on large RAW; no retry/resume.
**Target:**
- Client: `TaskGroup` concurrency cap (3–4), retry+backoff, **background upload session**, aggregate progress/ETA, file-size guard.
- Backend: **stream** GET→PUT via `PassThrough` (no full-file buffer), parallel per-file, per-file retry, heartbeat; or hand off to a transfer worker/queue.
- **Idempotency**: `ON CONFLICT (job_id, file_name)` upsert on the upload-URL endpoint so retries don't duplicate staging files; batch-commit semantics.

### 3.3 Push instead of poll (SSE), with backoff everywhere
**Today:** Meldinger + job detail + CRM panels poll on fixed 5–6s timers; many tabs × many users = request storms; Outbox polls every 5s even when idle.
**Target:**
- **SSE** (`/api/.../stream`) for job status, messages, gallery activity; fall back to polling with **exponential backoff + jitter** and pause-when-backgrounded (scenePhase already wired).
- Outbox: back off on empty queue (5s→30s→60s) and wake on `NWPathMonitor` connectivity.
- Server: ETag/304 + `?since=` cursors so polls are cheap.

---

## 4. Phased roadmap

### Phase 1 — Production-blocking (before scaling past ~100 concurrent photographers)
| Area | Item |
|---|---|
| Enhance | Async job queue + background polling (3.1) |
| Enhance | GPU runner + horizontal autoscale (3.1) |
| Transfer | Streaming staging→BYO copy; client concurrency+retry (3.2) |
| Integrity | Idempotent upload-URL (`ON CONFLICT`); atomic status transitions (`UPDATE … WHERE status=expected`) |
| On-device | Persist Redigering recipe/crop + cull selections to SQLite (survive crash/teardown); cancel in-flight renders |
| Reliability | Surface batch failures (RAW decode fails are silent today); collect+report failed assets |

### Phase 2 — High value (1–2 weeks)
- SSE for jobs/messages + polling backoff (3.3); message pagination (`?limit&before`).
- Parallel batch persist (semaphore-gated renders + serial writes + resumable progress).
- Token-refresh on 401 (retry original request); adaptive polling on 429/503.
- Staging-file cleanup on cancel/decline/expiry (GDPR + cost); revoke token on decline.
- Memory: downsample images for thumbnails (avoid full `UIImage(contentsOfFile:)` in grids); debounce slider renders; adaptive `targetMaxDimension` by available RAM.

### Phase 3 — Scaling polish & feature parity
- Pagination/virtualization across Galleri/Meldinger/Tilbud/Pris (cursor + lazy load).
- Per-face retouch UI (`/faces` → per-face overrides); batch Sky-enhance (apply one result/preset to a selection); custom **LUT upload** from iPad.
- Feedback on every enhance run (not just "Bruk") incl. failures → better personalisation.
- Decode telemetry: log missing **required** fields (catch silent backend renames); converge snake_case/camelCase to one canonical shape per endpoint.
- Fee snapshotting on job creation (audit trail); rate-limit upload-URL + a max files/job.

### Phase 4 — Quality & differentiation
- Undo across Sky-enhance / AI-retusj (recipe lineage); "clear Sky enhance".
- Exposure auto-balance wizard (histogram trend across a series); color-profile picker + fallback warning; export checksum validation.
- Editor **portal (web)** side so the handoff loop is bidirectional (accept job / download source / upload delivery) — the real blocker for that feature in production.
- Observability: client + runner metrics (latency, queue depth, failure rates), structured logs, alerting.

---

## 5. Security & correctness notes
- **Admin/channel gating** (`ChannelEntitlements` email-suffix) is client-side UX only — keep, but ensure the **backend enforces** channel/data access per token (defense-in-depth; never trust the client's `isAdmin`).
- Don't log emails/auth headers in release; redact sensitive fields.
- GDPR: staging source files must be purged reliably (currently best-effort on approve/cancel) — make purge a retried job; add a retention sweep (>7d).
- Concurrency (Swift 6 strict) is clean in the new actors/services; keep `PhotoEnhancerClient.make()` `@MainActor` (reads `SignInService.shared`).

---

## 6. Merge readiness
- Build: **green**. Tests: `RedigeringRawPipelineTests` 8/8 (local CR2 fixture, XCTSkips without it).
- Branch is **iPad-only** (backend changes landed separately on main via #847/#852/#853).
- Gate: DEBUG seeder + Debug tab `#if DEBUG`; no secrets; no leftover test mirrors.
- **Recommendation:** merge after `/code-review ultra` + the Phase-1 on-device persistence + batch-failure-surfacing items (cheap, prevent silent data loss). The big scaling items (3.1–3.3) can follow as fast-followers behind a feature flag, since the synchronous paths work for single-image and small batches today.
