---
name: release-readiness
description: Pre-deploy/release checklist for the Creatorhubn monorepo — Render backend, Vercel frontend, migrations, TestFlight, Tauri releases, env vars, rollback. Use before merging to main, deploying, cutting an app release, or when asked "are we ready to ship".
---

# Release-readiness — Creatorhubn-monorepo

Deploy-topologien og sjekklisten som faktisk gjelder. Verdikt-format:
**GO / NO-GO / GO-med-vilkår**, med hvert vilkår som konkret handling.

## Live-topologi (per 2026-08)

| Tjeneste | Hvor | Detaljer |
|---|---|---|
| Backend | **Render** `creatorhub-backend-rtbl`, docker (`Dockerfile`), auto-deploy fra `main` | `render.yaml`; plan **standard** — IKKE nedgrader (RAW-enhance/RawTherapee OOM-er på 512 MB); health `/api/health` |
| Frontend | **Vercel** `creatorhub-frontend` — aliaser `creatorhubn.com`, `theroleroom.com` | Webhook er brutt → manuell `npx vercel --prod --force --yes` (DEPLOY.md) |
| Netlify | `netlify.toml` er en PÅBEGYNT migrering, ikke live host | DNS-cutover ikke gjort; verifiser kun på deploy-preview |
| Cron | Render cron via `Dockerfile.cron` (alpine+curl) | `scripts/cron/nextrole-trial-expiry.sh`, daglig 09:00 UTC |
| CDN | Cloudflare Worker `workers/showcase-cdn/` + R2-proxy i frontend-config | signerte B2-URL-er, 30-dagers cache |
| iPad | TestFlight via fastlane-workflows | `capture-testflight.yml`, `leadmap-testflight.yml` |
| Desktop-apper | Tauri-release-workflows | `release-creatorhub-one-desk.yml`, `protools-companion-release.yml`, RELEASE.md/SIGNING.md i `apps/resolve-script-manager/` |

Rolle Room-spesifikk deploy-orkestrering: `npm run deploy:role-room:prod`
(`scripts/deploy-role-room-prod.mjs`).

## Sjekkliste før merge til main

1. **Gates:** required check «Frontend tsc --noEmit» grønn + relevante
   hardened-gates for flaten (se `e2e-verify`). Sentinel-gate uten NYE funn.
2. **Pre-push-fellene** (verifiser manuelt i cloud-økter):
   `backend/package-lock.json` i sync (CH-ARCH-004); ingen
   `await import('@/…')` (CH-ARCH-005).
3. **Migrasjoner:** nye `0NNN_*.sql` er idempotente; husk at
   `auto-migrate-on-push.yml` venter på stabil deploy av riktig commit før
   den trigger migrering — planlegg for vinduet der ny kode kjører mot
   gammelt skjema (lazy self-heal ved behov). Verifiser etterpå mot
   `_migrations_applied`.
4. **Env-vars:** nye variabler inn i `render.yaml` (`sync: false` for
   secrets) OG satt i Render før koden som leser dem deployes. Stille
   degradering (à la manglende `SENTRY_DSN`) skal være dokumentert.
5. **Docker:** endringer i native deps (darktable, ffmpeg, imagemagick,
   libheif, chromium) må inn i `Dockerfile` — lokal «det virker» dekker ikke
   imaget.
6. **Regresjonsklasser** sjekket (`regression-check`) og sikkerhetsverdikt
   ved berørte auth-/org-/integrasjonsflater (`security-review`).

## Etter deploy

- Vent på `/api/version` == deployet commit, deretter live-smokes:
  `smoke:role-room:live` / `smoke-production.sh` / Leadgrid
  post-deploy-smoketest. Overvåkning: `canary-monitor.yml`,
  `anomaly-scan.yml`, Sentry (hvis DSN satt).
- Frontend: manuell Vercel-deploy til webhooken er fikset — glem den ikke;
  «backend deployet, frontend gammel» er en kjent forvirringskilde.

## App-releaser

- iPad: ny funksjonalitet når ikke felt-brukere før TestFlight-build er
  skjøvet (memory.md-fellen: backend-features levert, iPad-build manglet).
- Tauri: kjør faktisk bundle før release (CH-ARCH-007); signering per
  `SIGNING.md`; desktop-origins i CORS-allowlist (CH-ARCH-008).

## Rullback/beredskap

- Backend: Render re-deploy av forrige image; migrasjoner er
  forward-only/idempotente — skriv kompenserende migrasjon fremfor å rulle
  tilbake skjema.
- Beslutninger med lang hale rundt en release («vi holder igjen X pga. Y») →
  `docs/evidence/`-fil i samme PR.
