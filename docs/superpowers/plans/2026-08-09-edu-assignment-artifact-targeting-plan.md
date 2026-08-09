# Oppgave-artefakt-targeting + LMS-autorering — implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steg bruker checkbox (`- [ ]`).

**Goal:** Faglærer kan gi en oppgave som lander studenten rett i et spesifikt verktøy-view (f.eks. Story Logic), og publisere slike oppgaver med full autorering rett fra Canvas/Moodle.

**Architecture:** Ny `artifact_view`-kolonne (fane-nøkkel `artifact_kind` uendret). Frontend `artifactToTab`-helper + `?view=`-param. Deep-link-flyten utvides fra produksjons-lenke til full oppgave-autorering (lager `role_room_education_assignments`-rad + custom bærer artefakt). Bygger på #1975/#1982-broen.

**Tech Stack:** TS/Express backend + Neon PG (migrasjoner auto-run på Render), React/MUI frontend, LTI 1.3 Deep Linking. Vitest.

## Global Constraints
- **UI-design er bindende:** `docs/superpowers/specs/2026-08-09-edu-artifact-ui-design.md` (inkl. Impeccable-pass) er sannheten for layout/states/copy/motion på alle frontend-flater. Følg den; ikke finn opp egen stil. MUI + `_eduUi.tsx`-tokens (dark `#0a0a0a`, accent lila `#8B5CF6`). Norsk Bokmål-microcopy fra design-docen.
- **`artifact_kind` forblir uendret fane-nøkkel** (RBAC/EDU_TAB_ACCESS/sammenligninger urørt). Nytt sub-view lagres i `artifact_view`.
- **Fane-slug-mapping:** SPA leser `?tab=<slug>` og matcher `tabpanel-<slug>`. Story Arc Studio sin slug er `story-arc-studio`, men `artifact_kind`='story-arc'. All artifact→tab-oversettelse skjer i ÉN `artifactToTab`-helper. Story Logic view-nøkkel = `story-logic` (`?view=story-logic`; SPA hydrerer `CastingPlannerPanel.tsx:1152`).
- Fail-closed/additivt: manglende `artifact_view` → åpne fanen uten view (dagens oppførsel). Aldri feil.
- Mobil (iPad/iPhone) førsteklasses; `prefers-reduced-motion` respekteres.
- Commit-trailer på hver task: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Ikke push/PR fra task-agenter.

---

### Task 1: Backend — `artifact_view` datamodell (migrasjon + routes + student-view)

**Files:**
- Create: `backend/migrations/0448_role_room_education_assignment_view.sql`
- Modify: `backend/server/role-room-education-assignments-routes.ts` (create + PATCH + list)
- Modify: `backend/server/role-room-education-student-view-routes.ts` (student assignment-liste SELECT)
- Test: `backend/server/role-room-education-assignments-routes.test.ts` (eller ny hvis mangler)

**Interfaces:**
- Produces: `role_room_education_assignments.artifact_view TEXT` (nullable). API create/PATCH aksepterer `artifactView?: string`; alle assignment-responsobjekter (faglærer-liste + student-view) inkluderer `artifactView: string | null`.

- [ ] **Step 1: Migrasjon**
```sql
-- 0448_role_room_education_assignment_view.sql
-- Sub-view innenfor artifact_kind sin fane (f.eks. artifact_kind='story-arc' + artifact_view='story-logic').
ALTER TABLE role_room_education_assignments ADD COLUMN IF NOT EXISTS artifact_view TEXT;
```

- [ ] **Step 2: Failing test** — create m/ `artifactView:'story-logic'` lagrer + returnerer den; list + student-view returnerer `artifactView`. (Bruk fila sin eksisterende fake-pool-mock-stil.)

- [ ] **Step 3: Backend create/PATCH** — i `role-room-education-assignments-routes.ts`: speil `artifact_kind`-håndteringen for `artifact_view` (INSERT-kolonne + verdi `(typeof body.artifactView==='string' && body.artifactView.trim()) ? body.artifactView.trim() : null`; PATCH `artifact_view = COALESCE($n, artifact_view)`; SELECT/rowToItem returnerer `artifactView: r.artifact_view ?? null`). VERIFISER faktiske linjenr for artifact_kind og speil nøyaktig.

- [ ] **Step 4: Student-view SELECT** — i `role-room-education-student-view-routes.ts` oppgave-liste-spørringen (den med `a.status='published'`): legg `a.artifact_view` i SELECT + `artifactView` i item-mappingen (ved siden av `artifactKind`). (Fila kan alt returnere `artifactKind` — bekreft; speil.)

- [ ] **Step 5: Kjør test grønt + tsc rene berørte filer. Commit.**
`feat(education): artifact_view-kolonne (mig 0448) — view-nivå oppgave-targeting`

---

### Task 2: Frontend — `artifactToTab`-helper + `openProductionInRoleRoom` view-param

**Files:**
- Modify: `frontend/client/src/components/role-room/education/educationProductionsService.ts`
- Test: `frontend/client/src/components/role-room/education/educationProductionsService.test.ts`

**Interfaces:**
- Consumes: `openProductionInRoleRoom(projectId, tab?, opts?)` (opts fra #1982: `{ asStudent?: boolean }`).
- Produces: `artifactToTab(artifactKind): string` (mapper artifact_kind → SPA-tab-slug; kjent: `story-arc`→`story-arc-studio`, ellers identity). `openProductionInRoleRoom` godtar `opts.view?: string` → setter `?view=`.

- [ ] **Step 1: Failing test** — `openProductionInRoleRoom(pid, 'story-arc', { asStudent:true, view:'story-logic' })` gir URL med `tab=story-arc-studio&view=story-logic&edu=1` + samme-tab (`location.assign`); default (faglærer, ingen opts) → `window.open`, ingen `view`.

- [ ] **Step 2: Implementer** — legg `artifactToTab` (les `CastingPlannerPanel.tsx` `tabpanel-`-slugs for å bekrefte mappingen; minst `story-arc→story-arc-studio`). I `openProductionInRoleRoom`: `const slug = tab ? artifactToTab(tab) : undefined;` sett `?tab=slug`; hvis `opts?.view` → `?view=`. Behold #1982 same-tab/edu=1-oppførsel for `asStudent`.

- [ ] **Step 3: Test grønt + scoped tsc. Commit.**
`feat(role-room/education): artifactToTab + view-param i openProductionInRoleRoom`

---

### Task 3: Frontend — AssignmentsTab «Steg»-velger (faglærer)

**Files:**
- Modify: `frontend/client/src/components/role-room/education/AssignmentsTab.tsx`
- Test: (om harness finnes) samme mappe

**Interfaces:**
- Consumes: `artifactView`-feltet (Task 1), design-docen (Flate 1 / «artifact → Steg progressive disclosure»).
- Produces: create-payload inkluderer `artifactView` når Artefakt=`story-arc` og et Steg er valgt.

- [ ] **Step 1: Implementer per design-doc** — legg `artifactView` i form-state. Når `f.artifactKind==='story-arc'`, vis «Steg»-velger (horisontal `Collapse`, delt accent-ring med Artefakt per design): `{ '':'Hele Story Arc', 'story-logic':'Story Logic', 'story-writer':'Story Writer' }`. Ellers skjul + nullstill `artifactView`. Følg design-docen for layout/states/copy/motion nøyaktig.
- [ ] **Step 2: Submit** — send `artifactView: (f.artifactKind==='story-arc' && f.artifactView) ? f.artifactView : undefined` i `createAssignment`-kallet (utvid `educationAssignmentsService` type om nødvendig).
- [ ] **Step 3: Faglærer-«Åpne» (om den finnes i AssignmentsTab)** — send `view: a.artifactView` til `openProductionInRoleRoom` (faglærer beholder ny-tab).
- [ ] **Step 4: scoped tsc rent. Commit.**
`feat(role-room/education): AssignmentsTab Steg-velger (view-nivå artefakt)`

---

### Task 4: Frontend — StudentWorkspace «Åpne» deep-linker til tab+view (student)

**Files:**
- Modify: `frontend/client/src/components/role-room/education/StudentWorkspace.tsx`

**Interfaces:**
- Consumes: `openProductionInRoleRoom` (Task 2), `view.canOpenProduction`, oppgavens `artifactKind`+`artifactView` (Task 1 student-view).

- [ ] **Step 1: Implementer** — per-oppgave-«Åpne» (`StudentWorkspace.tsx:~275`): `openProductionInRoleRoom(a.productionProjectId, a.artifactKind || undefined, { asStudent: true, view: a.artifactView || undefined })` (samme-tab, edu=1). Kort/«Åpne produksjon» uendret (#1982). Gate på `view.canOpenProduction` som i dag.
- [ ] **Step 2: scoped tsc rent. Commit.**
`fix(role-room/education): student-«Åpne» deep-linker til oppgavens artefakt-view`

---

### Task 5: Frontend — student ankomst-stripe i produksjons-modus

**Files:**
- Modify: `frontend/client/src/components/role-room/components/CastingPlannerPanel.tsx` (eller ny liten komponent importert der)

**Interfaces:**
- Consumes: `?edu=1` + (nytt) oppgave-kontekst i URL/param eller henting; design-docen (Flate 3 «student arrival stripe»). Gjenbruk `AssignmentSubmit` i bunn-`Drawer` for «Lever».
- Produces: en tynn, ikke-blokkerende kontekst-stripe (oppgavetittel/brief/frist + «Min side» + «Lever») over produksjonsverktøyet for bro-studenter.

- [ ] **Step 1: Kontekst-signal** — når student launcher til en artefakt-oppgave, bær oppgave-id i URL (`&assignment=<id>`) fra `openProductionInRoleRoom` (utvid opts m/ `assignmentId?`; Task 2/4 sender den). Ankomst-stripa henter oppgave-detalj (tittel/brief/frist) via student-view-servicen.
- [ ] **Step 2: Implementer stripa per design-doc** — sticky, 3px lila venstrekant, «Min side»-knapp (gjenbruk #1982-navigasjon) + «Lever» (åpner `AssignmentSubmit` i bunn-`Drawer`). Scroll-minimerer til én-linjes pill. Kun når `edu=1` + `assignment`-param. `prefers-reduced-motion`.
- [ ] **Step 3: scoped tsc rent. Commit.**
`feat(role-room/education): student ankomst-stripe (oppgavekontekst + Min side/Lever) i produksjons-modus`

---

### Task 6: Backend — Deep Link-response lager oppgave + rik custom

**Files:**
- Modify: `backend/server/role-room-lti-routes.ts` (`POST /lti/launches/:id/deep-link-response`)
- Test: `backend/server/role-room-lti-routes.test.ts`

**Interfaces:**
- Consumes: rikt payload fra DeepLinkPicker (Task 7): `{ title, cohortId, productionId?, createProduction?, artifactKind?, artifactView?, brief?, learningGoals?, dueAt?, isArbeidskrav?, isExam?, vurderingsform? }`.
- Produces: (a) `role_room_education_assignments`-rad (gjenbruk create-logikk / kall assignments-service), (b) content item `custom: { production_id, artifact_kind, artifact_view, assignment_id }`. Behold `{ returnUrl, jwt }`.

- [ ] **Step 1: Failing test** — deep-link-response m/ rikt payload → oppretter assignment-rad + JWT-content-item custom bærer production_id+artifact_kind+artifact_view+assignment_id. Uten artefakt → kun production_id (dagens).
- [ ] **Step 2: Implementer** — utvid handleren: valider påkrevd (title, cohortId, produksjon), opprett produksjon om `createProduction` (gjenbruk `/education/productions`-server-create), opprett assignment (`status:'published'`), bygg content item m/ full custom. Faglærer-sesjon = deep-link-mintet (`requireSession`); verifiser eierskap på kull/produksjon. Fail: tydelig 400, ikke halvt content item.
- [ ] **Step 3: Test grønt + tsc berørt fil rent. Commit.**
`feat(role-room/lti): Deep Link-response authorer full oppgave + rik custom`

---

### Task 7: Frontend — DeepLinkPicker full oppgave-autorering (flaggskip)

**Files:**
- Modify: `frontend/client/src/components/role-room/education/DeepLinkPicker.tsx`

**Interfaces:**
- Consumes: design-docen (Flate 2, flaggskip), `artifactToTab`/Steg-velger (Task 2/3, gjenbruk `<ArtifactStegFields>` om design-docen anbefaler delt komponent), deep-link-response (Task 6).
- Produces: POST rikt oppgave-payload → auto-submit JWT til Canvas/Moodle.

- [ ] **Step 1: Implementer per design-doc** — utvid fra «velg/opprett produksjon» til full oppgave-form: produksjon+kull + Artefakt+Steg + tittel + brief + frist + læringsmål + arbeidskrav/eksamen/vurderingsform, med design-docens synlighets-tiers (påkrevd/valgfritt/foldet avansert), sticky «Publiser til Canvas/Moodle», dynamisk konsekvens-hint («Studenten lander rett i Story Logic»), tydelig feil-copy ved trust-grense. Følg design-docen nøyaktig.
- [ ] **Step 2: Submit** — POST det rike payloadet til `deep-link-response`, behold `submitToCanvas`-JWT-auto-submit.
- [ ] **Step 3: scoped tsc rent. Commit.**
`feat(role-room/education): DeepLinkPicker full oppgave-autorering fra Canvas/Moodle`

---

### Task 8: Backend — launch-handler åpner artefakt-view fra custom

**Files:**
- Modify: `backend/server/role-room-lti-routes.ts` (`POST /lti/launch`, `custom.production_id`-grenen ~:562)
- Test: `backend/server/role-room-lti-routes.test.ts`

**Interfaces:**
- Consumes: `custom.artifact_kind` + `custom.artifact_view` (Task 6-content item). `artifactToTab` (backend-side liten kopi eller inline mapping — hold ÉN sannhet-kommentar som peker på frontend-helperen).

- [ ] **Step 1: Failing test** — launch m/ custom.production_id+artifact_kind='story-arc'+artifact_view='story-logic' → redirect `mode=production&project=<id>&tab=story-arc-studio&view=story-logic` (+ rr_session). Uten artefakt-custom → dagens `mode=production&project=<id>`.
- [ ] **Step 2: Implementer** — i produksjon-grenen: les `custom.artifact_kind`/`artifact_view`; om satt, legg `tab=artifactToTab(kind)` + `view` i redirect-URLen. Bevar rr_session. Manglende → uendret.
- [ ] **Step 3: Test grønt + tsc rent. Commit.**
`feat(role-room/lti): launch åpner artefakt-view fra deep-link-custom`

---

## E2E-verifisering (etter merge + deploy)
Mot `sandbox.moodledemo.net` (godkjenn plattform på nytt; student-e-post=LMS-e-post; lukk faglærer-admin-tab):
1. **In-app:** faglærer lager «Skriv en Story Logic»-oppgave (Artefakt Story Arc → Story Logic) → student launcher → Min side → «Åpne» → lander i **Story Logic-viewet** m/ ankomst-stripe → redigerer → «Lever» → Vurdering → karakter.
2. **Deep Link:** faglærer i Moodle → Deep Link → DeepLinkPicker authorer full Story-Logic-oppgave → LMS-lenke → student klikker → lander rett i Story Logic.

## Self-review (utført)
Spec-dekning: alle 3 spec-endringer + 3 UI-flater dekket (T1 data, T2 helper, T3 faglærer-UI, T4 student-link, T5 ankomst-stripe, T6 deep-link-backend, T7 deep-link-UI, T8 launch). Ingen placeholders. Type-konsistens: `artifactView`/`artifactToTab`/opts.view/assignmentId gjennomgående. Fane-slug-mapping sentralisert.
