# Session-handoff — 2026-06-26

Kompakt oppsummering av alt som ble gjort + hva som gjenstår (dine handlinger).

---

## 1. Google OAuth-verifisering ✅ (klar til innsending)

**Rotårsak fikset:** Google Ads API `v18` var utgått (juni 2026) → demo-rutens `listAccessibleCustomers` ga HTTP 404. **PR #977** (merget + live på Render) prøver nå v21→v18 inline → treffer **v21**. Alle 4 markedsførings-scopene returnerer ekte data: Ads (2 konti), GA4 (1), Search Console (6), Tag Manager (3).

**Verifiserings-video (ferdig):**
`output/google-verification/videos/google-oauth-verification-FULL-20260626.mp4` (56s)
- 0–11s: consent-skjermen «theroleroom.com wants to access…» med alle 6 scopene (PII/2FA trimmet bort)
- 11–56s: scope-bruk i appen med ekte data

**Viktig om consent-opptaket:** brukte den dedikerte «Role Room Ads OAuth»-klienten `256648631702-c1ghdnobjroa489pbd8qrfeue28ioibt` med registrert redirect `https://theroleroom.com/api/role-room/ads/google/oauth/callback` (admin-room-redirecten er IKKE registrert → ga `redirect_uri_mismatch`).

**Recorder-scripts (committet/klare):**
- `frontend/scripts/google-verification/record-demo.mjs` (scope-bruk)
- `frontend/scripts/google-verification/record-consent.mjs` (consent-skjerm, direkte OAuth-URL)

**DINE NESTE STEG:**
- [ ] Last opp MP4-en til YouTube (Unlisted) → lim inn i Verification Center
- [ ] Port 1-tekster ligger klare i `docs/GOOGLE_OAUTH_VERIFICATION.md`
- [ ] Port 2: Google Ads dev-token Basic-tilgang er allerede gjort (bekreftet) + `GOOGLE_ADS_DEVELOPER_TOKEN` satt på Render

---

## 2. Admin-krasj: `testingAreas.slice is not a function` ✅ FIKSET + LIVE

**PR #981** (merget, frontend force-deployet til prod). `/api/prototype-tester-requests` returnerte `testing_areas` rått; en skadet ikke-array-rad krasjet `admin-invite-system.tsx:747` → tok ned hele AdminDashboard via error-boundary.
- Backend (`index.ts`): normaliserer `testing_areas` → alltid `string[]`
- Frontend (`admin-invite-system.tsx`): defensiv query-`select`

---

## 3. Admin-krasj-herding (workflow) ⏳ KJØRER / SJEKK STATUS

Det finnes FLERE samme-type krasj i admin-bundelen (f.eks. `xe?.filter is not a function` fra `/api/enterprise/inquiries` + `/api/admin/academy/enrollments` som 404-er → ikke-array → `.filter` krasjer).

**Workflow startet:** `admin-crash-hardening` — auditerer + fikser alle 176 admin-filer som gjør API-kall + array-ops, legger inn `Array.isArray`-vakter.
- Worktree: `/tmp/wt-adminhardening` (fra origin/main)
- Script: `~/.claude/projects/.../workflows/scripts/admin-crash-hardening-wf_1f79dacc-021.js`
- Run ID: `wf_1f79dacc-021` (resume m/ `resumeFromRunId` hvis avbrutt)
- Status ved handoff: kjørte i bølger på 6 (første forsøk throttlet på server-rate-limit)

**NESTE:** når workflow er ferdig → review diff i worktreet → build/typecheck → commit → PR → merge → force-deploy frontend. Kjente konkrete syndere å verifisere: `EnterpriseInquiriesPanel.tsx`, `AcademyAdminPanel.tsx`.

---

## 4. Slette test-brukere ⏳ KLAR — DU KJØRER SISTE KOMMANDO

66 brukere i `public.users`; **61 er test/E2E/smoke** (aldri logget inn, `@example.com`/`@*.test`/timestamp-navn/codex/probe/smoke). Review: `docs/USERS_REVIEW_2026-06-26.md`.

**5 BEHOLD:** `daniel@creatorhubn.com`, `danielqazi89@gmail.com`, `qazifotoreel@gmail.com`, `info@orbitgraphics.com`, `goldweddingmediaus@gmail.com`.

**Slette-script (transaksjonelt, FK-trygt, DRY-RUN VERIFISERT):** `/tmp/delete_test_users.sql`
Dry-run bekreftet: 61 slettet, 5 igjen, kun 4 test-relaterte barn-rader (CASCADE/SET NULL tar resten).

Den ekte slettingen ble blokkert av sikkerhetsvakten (masse-prod-delete), så **du kjører den selv** (lim inn med `!`):
```
! psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f /tmp/delete_test_users.sql
```
(`/tmp/`-filen overlever ikke reboot — be meg regenerere den hvis batteriet dør først.)

---

## 5. 🔴 STÅENDE SIKKERHET — ROTÉR

Eksponert i chat, må roteres:
- **Neon DB-passord** (`npg_…` i DATABASE_URL)
- **Render API-nøkkel** (`rnd_…ReK`)

---

## Deploy-topologi (huskeregel)
- Frontend → Vercel `creatorhub-frontend`, IKKE auto-deploy fra main → `vercel deploy --prod --force` fra ren origin/main-worktree
- Backend → Render `creatorhub-backend-rtbl.onrender.com`, auto-deploy fra main
- theroleroom.com = casting-main; creatorhubn.com = App.tsx/AdminRoom
