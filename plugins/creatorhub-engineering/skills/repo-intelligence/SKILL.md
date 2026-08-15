---
name: repo-intelligence
description: Orient in the Creatorhubn monorepo — which product lives where, what docs/registries the repo already knows, and where to start a task. Use at the start of any task, when asked "where does X live", or before answering portfolio/product questions.
---

# Repo-intelligence — Creatorhubn-monorepo

Kartet over CreatorHubs portefølje og hvor kunnskapen allerede bor. Les dette
FØR du graver — repoet har registre som gjør de fleste «hvor/hvorfor»-spørsmål
til oppslag, ikke arkeologi.

## Produkt → katalog

| Produkt | Hvor | Hva |
|---|---|---|
| **The Role Room** (theroleroom.com) | `frontend/` + `backend/` (casting-/produksjonsflater), `docs/role-room/`, rot-dokumenter `THE-ROLE-ROOM-*.md` | Casting-/produksjonsplattform; hovedmerkevaren |
| **Leadgrid** | `backend/server/leadgrid-*.ts` (~50+ rutefiler), `frontend/client/src/components/leadgrid/`, `docs/leadgrid/` | B2B lead/CRM + Intelligence Engine (NBA-system) |
| **Pondus** | `backend/server/pondus-routes.ts`, `leadgrid-pondus-quiz-routes.ts`, watch/vision i `ipad/LeadMapApp/` | Quiz/templates-feature inne i Leadgrid |
| **Education/LMS (Academy)** | `backend/server/academy-*.ts`, LTI-ruter | LMS med Moodle/LTI 1.3-integrasjon |
| **Post Agent** | `apps/post-agent-photoshop-plugin/`, `docs/post-agent/` | UXP Photoshop-plugin |
| **Capture** | `ipad/CaptureApp/` (+ `CAPTURE_NATIVE_ROADMAP.md`, `TESTFLIGHT.md`), `docs/capture/` | Native iPad fotograf-/RAW-app |
| **Lead Map** | `ipad/LeadMapApp/` (+ Widget/Watch/Vision) | Native iPad felt-salgs-app for Leadgrid |
| **One Desk** | `apps/creatorhub-one-desk/` | Tauri 2 desktop, leveranse/showcase + B2-arkiv |
| **Resolve Script Manager** | `apps/resolve-script-manager/` (egen Playwright-config, RELEASE.md, SIGNING.md) | Tauri desktop for DaVinci Resolve-scripts |
| **Pro Tools Companion** | `apps/creatorhub-protools-companion/` | Tauri companion-app |
| **Blender Bridge** | `apps/blender-bridge/` (extension + MCP :7717), design i `docs/specs/2026-08-10-blender-bridge-fase1-design.md` | Claude×Blender semantisk bro |
| **Sentinel** | `crates/sentinel-core/` (std-only Rust) | Deterministisk kodeanalyse; `sentinel-ci` i CI-gate |
| **Showcase CDN** | `workers/showcase-cdn/` | Cloudflare Worker, signerte B2-URL-er |
| **Story Arc Studio / Visual Editor / Photo-flater** | `frontend/client/src/components/{story-arc-studio,visual-editor,photo-editing,photo-enhancer,photographer}/` | Web-flater med egne hardened E2E-gates |
| **Reknaren** | Nevnt i portefølje-ruting (CLAUDE.md), ingen egen katalog i repoet | Flagg som «ikke i dette repoet» ved spørsmål |

Stack: npm-workspaces (`frontend`, `backend`), Node ≥20; Vite+React+TS+MUI
frontend (dev-port 5001); Express-stil backend med Drizzle/Postgres (Neon) og
Python ML-sidecars (`backend/python-services/`, `gfpgan-runner/`); Tauri 2-apper;
Swift/XcodeGen/fastlane på iPad; Rust i crates.

## Kunnskapsregistrene (sjekk alltid først)

1. **`memory.md`** (rot) — levende status, kø, KRITISKE LÆRDOMMER,
   beslutninger som venter på produkteier.
2. **`docs/architecture-rules.md`** — CH-ARCH-registeret: arkitektoniske
   invarianter født av produksjonshendelser, med håndhevelsesmekanisme.
3. **`docs/evidence/`** — beslutninger med kilder/livssyklus.
   Spørring: `sh .claude/skills/documentation-intelligence/scripts/evidence-query.sh <vendor>`
4. **`docs/impact-reports/`** — ukentlig versjons-/impact-tracker med
   `## Produktmuligheter` (konkrete forslag med fil-pekere).
5. **`docs/baselines/`** — maskingenerert ekstern-API-bruk per app.
6. **`.claude/skills/documentation-intelligence/`** — obligatorisk ruting for
   alle eksterne leverandør-/versjons-/API-spørsmål (Freshness Rule i
   `shared/SOURCE_POLICY.md` i skill-pakken: aldri svar fra hukommelse).
7. **`docs/specs/`**, `docs/cto-audit/`, `docs/security/`, per-produkt-docs.

## Startprosedyre for en ny oppgave

1. Identifiser produkt(er) fra tabellen; ved åpne forbedringsspørsmål i
   interaktive økter: still 1–3 fokus-spørsmål først (system, vendor-flate,
   risiko- vs. mulighetsfokus) — CLAUDE.md-regelen.
2. Slå opp i registrene over før du leser kode.
3. Merk kjente feller for området (se `regression-check`-skillen) og
   gates som må bestås (se `e2e-verify` og `release-readiness`).

## Output-kontrakt

Svar med fakta + fil-pekere, verdikt/plassering først. Rot-katalogen har
committede skjermbilder og engangs-scripts — ikke tolk dem som produktflater.
