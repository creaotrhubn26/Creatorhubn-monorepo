# CreatorHub Capture — Status & Remaining Work

Living status document. Last updated 2026-04-16. Update this file when status changes.

## What this is

iPad-first capture, review, and handoff for professional photographers. Images flow from Canon R-series bodies (CCAPI over Wi-Fi) into a SwiftUI iPad app, sync to the CreatorHub backend, then hand off to the existing photo enhancer for retouching. Client review mode lets photographers hand the iPad to clients for live selects during or after a shoot.

Target MVP body: Canon R5 / R5 Mark II / R6 Mark II. Compatible with all CCAPI-enabled R cameras via capability negotiation — validated matrix extends to R6, R7 through beta.

## Architecture

```
Canon R5 ──Wi-Fi CCAPI──▶ iPad app ──HTTPS──▶ CreatorHub backend ──▶ Photo enhancer
                              │                  (Node + Express)         (existing)
                              ├── GRDB local cache                              │
                              └── Core ML on-device signals                     ▼
                                                                              R2 bucket
```

## Status summary

### Shipped to `feat/capture-ipad-backend-mvp` (branch pushed, awaiting PR)

**Backend** — tsc clean, all 5 migrations applied to Neon:
- REST API at `/api/capture/*`: sessions, assets, events, reviews, uploads, handoff, client tokens
- WebSocket at `/api/capture/ws/sessions/:id` — broadcasts every persisted event
- R2 multipart upload (start/parts/complete/abort) with per-user key prefix isolation
- Handoff endpoint that submits each capture_asset to `POST /api/photo-enhancer/jobs`
- Client Review Mode: SHA-256-hashed scoped tokens + optional PIN (timing-safe compare)
- Ownership checks on every endpoint

**iPad scaffold** — cannot compile until Xcode.app installed:
- XcodeGen `project.yml` with GRDB 6.29+ SPM dep, Swift 6 complete strict concurrency
- Domain models + `IngestAdapter` protocol
- `AppDatabase` + migrator (WAL, foreign keys, ISO-8601 dates, JSON-column bridges)
- `SessionStore` actor with CRUD + append-only event log + AsyncStream observers
- 15 unit tests (JSON round-trip, state transitions, concurrent append ordering, crash recovery)

**GitHub Actions** — `ipad-capture-ci.yml` on macos-14 runner with xcodegen + SwiftLint + iOS simulator test.

### In flight (blocked on Xcode.app install)

- #3 Xcode project bootstrap
- #4 Domain models + contracts (written, unverified)
- #5 SessionStore + GRDB (written, unverified)

## File map

### Backend
| Path | Purpose |
|---|---|
| `backend/migrations/110_capture_sessions.sql` | DDL |
| `backend/migrations/111_capture_assets.sql` | DDL |
| `backend/migrations/112_capture_reviews.sql` | DDL |
| `backend/migrations/113_capture_events.sql` | DDL |
| `backend/migrations/114_capture_client_tokens.sql` | DDL |
| `backend/migrations/capture-schema.ts` | Drizzle schema + relations + inferred types |
| `backend/server/capture-routes.ts` | HTTP entry point, Zod validation, auth middlewares |
| `backend/server/capture-sessions-service.ts` | Session CRUD |
| `backend/server/capture-assets-service.ts` | Asset CRUD + signals + labels |
| `backend/server/capture-events-service.ts` | Append-only event log |
| `backend/server/capture-reviews-service.ts` | Photographer + client reviews |
| `backend/server/capture-upload-service.ts` | R2 multipart + signed read URLs |
| `backend/server/capture-client-tokens-service.ts` | PIN-scoped client token lifecycle |
| `backend/server/capture-handoff-service.ts` | POSTs to photo-enhancer for each asset |
| `backend/server/capture-websocket.ts` | Per-session client set + broadcast |

### iPad
| Path | Purpose |
|---|---|
| `ipad/CaptureApp/project.yml` | XcodeGen config |
| `ipad/CaptureApp/CaptureApp/App/CaptureAppMain.swift` | `@main` entry |
| `ipad/CaptureApp/CaptureApp/Core/Models/*.swift` | Domain types (force-tracked; see gotchas) |
| `ipad/CaptureApp/CaptureApp/Core/Store/*.swift` | GRDB + SessionStore actor |
| `ipad/CaptureApp/CaptureApp/Core/Capture/IngestAdapter.swift` | Protocol + event types |
| `ipad/CaptureApp/CaptureAppTests/*.swift` | Unit tests |

### Shared contracts
| Path | Purpose |
|---|---|
| `frontend/shared/capture-contracts.ts` | Zod schemas (shared intent, not yet code-genned to Swift) |

### Canon (local only, gitignored)
```
canon/
  CCAPI 1.4.0d.zip                 # Canon Developer Program download
  EDSDKv132010M/                   # bonus USB SDK
  Camera Agreement 2018.pdf        # NDA
  Document/ReleaseNote.txt
  Document/CameraControlAPI_OperationGuide_EN.pdf
```

## Remaining work (by phase)

### P0 — blocking next step

1. **Install Xcode.app** from App Store. Current machine only has Command Line Tools; `xcodebuild` and SwiftUI simulator both need the full app (~20 GB).
   ```sh
   # After install:
   brew install xcodegen swiftlint
   cd ipad/CaptureApp && xcodegen
   open CaptureApp.xcodeproj
   # Cmd+U runs tests
   ```
2. **Confirm R5 variant.** R5 Mark II has CCAPI built-in. R5 original requires running `canon/CCAPI Activation Tool/Macintosh/Macintosh.dmg.zip → .dmg → tool` once per body (task #29).
3. **Dev hardware** (task #2): 1× iPad Pro M2/M4 1TB, 1× Canon R5 body, 2× CFexpress cards, travel router. Budget ~$6k. Additional bodies (R6 Mark II, R6, R7) via beg/borrow for compatibility matrix.

### P1 — iPad Phase 1 (6–8 weeks)

- **#6 CCAPIClient** — typed Swift HTTP client. Blocked by #29 (activation).
- **#7 CCAPIAdapter** — wraps CCAPIClient as `IngestAdapter`.
- **#8 CameraSession actor** with connection state machine (Disconnected → Discovering → Pairing → Ready → Shooting → Downloading → Reconnecting).
- **#9 FTPFallbackAdapter** — Option C fallback.
- **#10 Session Dashboard** screen.
- **#11 Live Capture** screen (hero + filmstrip, 1-second-from-shutter perf budget).
- **#12 Image Grid** with filters + multi-select.
- **#13 Image Detail** with EXIF + AI signals rail.
- **#30 CCAPI capability negotiation** — query `GET /ccapi` on connect, store capability flags, degrade gracefully per body.
- **#14 Phase 1 exit** — one photographer completes one real shoot entirely offline on iPad. Multi-body smoke test against R5 / R5 Mark II / R6 Mark II / R6 / R7 where accessible.

### P2 — iPad ↔ backend glue (4 weeks)

- **#18 iPad SyncEngine** with resumable chunked uploads, background URLSession transfers.
- **#22 Phase 2 exit** — end-to-end client review demo.

### P3 — on-device AI + hardening (3–4 weeks)

- **#23** Blink (Vision framework) + blur (Accelerate Laplacian) + face count.
- **#24** Duplicate clustering (pHash + DBSCAN), collapse toggle in Grid.
- **#25** Chaos tests: kill Wi-Fi mid-download, swap cards, background app, thermal throttle, storage full.
- **#26** Beta program — 5–10 photographers, ≥4 body variants, telemetry + crash reporting.

### P4 — deferred

- **#27 Multi-brand bridge** (RPi5 + gphoto2) — only trigger if Canon NDA stalls >6 weeks or Nikon/Sony/Fuji demand forces it before MVP ships.

### Separate track (not in capture scope)

- **#28 Web enhancer UI/backend cleanup** — remove dead UI for CodeFormer/SwinIR/BSRGAN/DiffBIR/LaMa/Real-ESRGAN until backend exists, or wire through a Replicate adapter.

## How to resume

When you come back after a break:

1. `cd /Users/usmanqazi/Creatorhubn-monorepo`
2. `git fetch && git log --oneline -10` — see what moved.
3. Open Claude Code in this directory. The task list and memory files reload automatically.
4. Read this file. Then ask Claude "status?" — it will reconstruct detail from git + memory + this doc.

Memory lives at `~/.claude/projects/-Users-usmanqazi-Creatorhubn-monorepo/memory/`. Three entries today:
- `product_direction.md` — Evoto parity + full multi-brand tether as north stars
- `feedback_check_first.md` — audit wired vs. declared code before recommending anything
- `capture_body_scope.md` — "compatible with all CCAPI R cameras" via capability negotiation

## Known gotchas

- **Neon DDL on the pooler endpoint silently no-ops.** First migration attempt via `ep-weathered-grass-abixeqb0-pooler.eu-west-2…` printed `CREATE TABLE` five times but zero tables existed afterwards. Use the DIRECT endpoint (hostname without `-pooler`) for any DDL. Runtime app queries on the pooler are fine. Use `--single-transaction -v ON_ERROR_STOP=1` for migrations so a partial failure halts everything.
- **Case-insensitive macOS filesystem + `models/` in gitignore.** The root `models/` ignore rule matches `ipad/**/Models/` on macOS. New files under `ipad/CaptureApp/CaptureApp/Core/Models/` need `git add -f`. Already-tracked files stay tracked.
- **Xcode.app required, not just Command Line Tools.** `swift -parse` against the CLT modulemap produces spurious "redefinition of module SwiftBridging" errors. Full Xcode resolves.
- **Canon materials are under NDA.** Never commit anything under `canon/`. Gitignore covers it. Don't paste full CCAPI reference into chat when asking Claude questions — paste only the specific endpoint signature needed.
- **Credential hygiene.** The Neon DATABASE_URL was pasted into chat on 2026-04-16 to run the initial migration. Rotate the `neondb_owner` password before this chat log leaves secure storage.

## Deployment checklist (when ready to ship)

- [ ] Run migrations 110–114 on production Neon via **direct** endpoint.
- [ ] Set env vars on backend: `CAPTURE_R2_ENDPOINT`, `CAPTURE_R2_BUCKET`, `CAPTURE_R2_ACCESS_KEY_ID`, `CAPTURE_R2_SECRET_ACCESS_KEY` (or fall back to shared `CLOUDFLARE_R2_*`).
- [ ] Set `CAPTURE_HANDOFF_ENHANCER_URL` if the enhancer moves off localhost.
- [ ] Configure R2 bucket CORS to allow PUT from iPad app origin.
- [ ] App Store Connect: privacy disclosures for camera/network usage strings in `project.yml`.
- [ ] TestFlight distribution group for beta photographers.

## Open decisions

- **Handoff source of truth.** Currently same-bucket assumption between capture and enhancer. If they diverge in prod, add a cross-bucket S3 copy step OR refactor enhancer to accept capture's bucket in the job source.
- **Reconnect resume on WebSocket.** MVP relies on `GET /sessions/:id/events` after reconnect to backfill. If that proves laggy, add `{type:'resume', afterEventId:X}` handshake.
- **Rate limiting on write endpoints.** Deferred during #16. Worth a dedicated small task before public beta.
