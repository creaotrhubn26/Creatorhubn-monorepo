# Student → Produksjonsmodus-sløyfe (LTI-studenter)

**Dato:** 2026-08-09
**Status:** Godkjent design → klar for implementeringsplan
**Kontekst:** Fullfører sløyfen «student ser oppgave (utdannings-workspace) → gjør arbeidet i produksjonsmodus (ekte `casting_project` via bro) → leverer → lærer vurderer → ser resultat». Følger code review (artifact ec51e54b) + RBAC-arg-bug-fiks (PR #1973, merget). Se [[project_role_room_education_production_bridge]] og [[project_role_room_education_moodle_lti]].

## Problem

En student launcher fra Moodle (LTI) og lander i dag i den **lærer-vendte** `EducationWorkspace` (`mode=education`) — ikke en student-opplevelse. `educationRole` (student/faglærer) beregnes serverside men leses aldri av frontend. Og selv om studenten kom til `StudentWorkspace`, krever dagens student-vei en isolert `x-student-token`; en LTI-student har en **ekte Bearer-sesjon** (auto-provisjonert `users`-konto), ikke det tokenet, så de faller til en tom placeholder. Til slutt: student-innlevering skriver kun en link/note til `role_room_education_submissions`, frakoblet produksjonens ekte Levering-fane.

## Nøkkel-innsikt: to slags student

- **LTI-student (Moodle/Noroff):** `mintLtiEducationSession` lager en ekte `users`-konto (e-post fra LMS) + Bearer-sesjon. Bro-en (`resolveEducationProductionRole`, matcher `users.email = education_students.email`) gjenkjenner dem → produksjonstilgang virker (RBAC-bugen er fikset).
- **Manuelt invitert student:** kun isolert `x-student-token` (egen tabell), bevisst holdt ute av casting-planner-API-et.

**Denne sløyfen er scopet til LTI-studenter (ekte konto).** Manuelt inviterte forblir i den isolerte les-only-huben til en senere konto-provisjonerings-feature.

## Mål

- En LTI-launchet **student** lander i `StudentWorkspace` (mine oppgaver), ikke lærer-konsollet.
- Student med ekte konto ser sine oppgaver/produksjoner via sin **Bearer-sesjon** (ikke bare x-student-token).
- «Åpne produksjon» tar studenten inn i **produksjonsmodus** på det ekte prosjektet, med `EDU_TAB_ACCESS`-fane-RBAC.
- «Lever» oppretter/oppdaterer en ekte **leveranse** (`role_room_deliverables`) i produksjonen og kobler den til innleveringen; læreren ser + åpner den fra Vurdering og gir karakter.
- Verifiseres ende-til-ende mot Moodle-sandkassen.

## Ikke-mål (YAGNI)

- Manuelt inviterte (x-student-token) studenter i produksjonsmodus — utsatt til konto-provisjonering.
- Fil-opplasting/versjonering utover å sette leveransen til `internal_review` — bruk eksisterende Levering-verktøy i produksjonsmodus.
- Endring av lærer-flyten (opprett oppgave, tildel produksjon, vurder) — uendret.

## Arkitektur

Fire avgrensede endringer. Ingen endring i launch-krypto, AGS/NRPS, eller lærer-flyten.

### 1. LTI-ruting (backend) — `role-room-lti-routes.ts`
Launch-handlerens landing-logikk (bygger `mode=…`-redirect) leser `identity.educationRole`:
- `educationRole === "student"` → redirect `mode=student` (StudentWorkspace).
- `educationRole === "faglærer"` (default) → `mode=education` (uendret).
- Deep-linket produksjon (`custom.production_id`) → uendret (`mode=production`).
Alle beholder `rr_session=<token>`.

### 2. Ekte-sesjon student-datavei (backend) — kjernen
Student-«Min side»-data (oppgaver + produksjoner) må kunne hentes av en **ekte bruker** som ER en education-student, ikke bare via x-student-token. Endepunktene i `role-room-education-student-view-routes.ts` som i dag har to auth-veier (x-student-token = studentens egen; Bearer = faglærer-preview via `?studentId=`) får en **tredje case**: en Bearer-authed bruker som selv er en education-student.

- Ny hjelper `resolveEducationStudentByUser(pool, userId)`: slår opp `role_room_education_students` via `lower(email) = lower((SELECT email FROM users WHERE id = userId))`, returnerer `student_id` (eller null).
- Auth-oppløsning i `GET /education/student/view`, `GET /education/student/production/:productionId`, og `PUT /education/student/assignment/:id/submit` blir: (a) x-student-token → studentId (uendret); ellers (b) Bearer + `resolveEducationStudentByUser` → studentId; ellers 401.
- Ingen data-lekkasje: en Bearer-bruker får KUN sin egen student-rad (email-match), aldri andres.

### 3. StudentWorkspace samkjøring (frontend) — `StudentWorkspace.tsx` + `educationStudentViewService.ts`
- I dag: `hasStudentSession()` (x-student-token) avgjør real-student-visning; ellers super-admin-preview eller placeholder.
- Nytt: en ekte-konto-education-student (ekte sesjon, og backend bekrefter at de er en education-student) vises `MyStudentView` med sine data + **produksjon-åpne aktivert**.
- `educationStudentViewService` sender x-student-token når det finnes; ellers faller det tilbake til vanlig Bearer (`authSessionService`) — så samme service betjener begge.
- «Åpne produksjon»-samkjøring: gate på «har rolle i produksjonen» (bro-en) i stedet for `studentMode`-token-typen. En ekte-konto-student → `openProductionInRoleRoom(projectId)` (mode=production). Isolert x-student-token-student → uendret les-only detalj (de har ikke bro-tilgang).

### 4. Innlevering → ekte leveranse (backend + frontend)
- Migrasjon: `ALTER TABLE role_room_education_submissions ADD COLUMN IF NOT EXISTS deliverable_id UUID`.
- `PUT /education/student/assignment/:id/submit` utvides: hvis oppgaven har en tilknyttet produksjon (`assignment.production_id → production.project_id`) og studenten har bro-rolle der, opprett/oppdater en leveranse via eksisterende `createDeliverable(pool, { projectId, title: assignment.title, assigneeUserId: <studentens users.id>, assigneeLabel: <navn>, status: "internal_review", phase: "postproduction" })`, og lagre `deliverable_id` på submission-raden. Oppgave uten produksjon → dagens link/note-oppførsel (uendret, `deliverable_id` = null).
- Idempotens: re-lever oppdaterer eksisterende leveranse (via lagret `deliverable_id`) i stedet for å lage duplikat.
- Vurdering (`AssessmentTab.tsx` / assessment-queue): når en submission har `deliverable_id`, vis en «Åpne leveranse i produksjon»-lenke (`openProductionInRoleRoom(projectId, "delivery")`) ved siden av karakter-feltene, så læreren vurderer det ekte arbeidet.

## Dataflyt

```
LTI student-launch → mode=student → StudentWorkspace (ekte-sesjon-data: mine oppgaver)
  → «Åpne produksjon» → mode=production (EDU_TAB_ACCESS-faner, RBAC fikset) → jobber
  → «Lever» → createDeliverable(assignee=student, status=internal_review) i produksjonen
            + role_room_education_submissions.deliverable_id = <id>
Lærer (Vurdering) → ser submission m/ koblet leveranse → «Åpne leveranse» → gir karakter
Student (StudentWorkspace) → ser karakter + tilbakemelding
```

## Feilhåndtering

- E-post-mismatch (users.email ≠ education_students.email) → studenten authes, men `resolveEducationStudentByUser` = null → de ser en tydelig «ingen student-profil koblet til denne kontoen»-melding, ikke en tom placeholder.
- Oppgave uten tilknyttet produksjon → «Lever» faller tilbake til link/note (`deliverable_id` null); ingen feil.
- Student uten bro-rolle i produksjonen → «Åpne produksjon» / deliverable-opprettelse fail-closed (bro returnerer null); «ikke tildelt denne produksjonen».
- `createDeliverable` returnerer null (manglende felt) → innleveringen lykkes fortsatt (link/note), leveranse-kobling hoppes over + logges.

## Testing

- **Enhet (backend):** LTI-routing (student→mode=student, faglærer→mode=education); `resolveEducationStudentByUser` (email-match, ingen kryss-lekkasje); submit oppretter deliverable + lagrer `deliverable_id`; submit uten produksjon → link/note-fallback, `deliverable_id` null; re-lever oppdaterer samme leveranse.
- **Frontend:** StudentWorkspace viser MyStudentView for ekte-konto-student (mock ekte sesjon + student-data); «Åpne produksjon» kaller `openProductionInRoleRoom`.
- **E2E mot `sandbox.moodledemo.net`:** launch som `student`/`sandbox24` → lander i StudentWorkspace → åpne tildelt produksjon → gjør en endring i et verktøy → «Lever» → (launch/preview som teacher) se leveransen i Vurdering → gi karakter → (som student) se karakteren. Forutsetning: faglærer har opprettet en studentproduksjon + tildelt student-medlemskap + en oppgave koblet til produksjonen, og student-e-posten matcher LMS-e-posten.

## Gjenbruk (uendret)

`resolveEducationProductionRole` + `EDU_TAB_ACCESS` (bro + fane-RBAC), `canAccessRoleRoomProject`, `createDeliverable`, `openProductionInRoleRoom`, `mintLtiEducationSession`, hele produksjonsmodus (Story Arc Studio), lærer-vurderings-flyten.

## Åpne punkter / risiko

- **Assignee = studentens `users.id`:** submit-veien må ha studentens `users.id` (ikke bare education `student_id`). Ved Bearer-vei er det `req.userId`; ved x-student-token-vei finnes ingen users.id (isolert) — men denne sløyfen er scopet til ekte-konto/LTI-studenter, så submit-deliverable-koblingen gjelder kun når det finnes en `users.id`. x-student-token-submit beholder dagens link/note (ingen deliverable).
- **E-post som koblingsnøkkel:** hele broen (og #2) hviler på at `education_students.email` settes til LMS-e-posten ved NRPS-roster-synk. Verifiseres i E2E; hvis mismatch, er koblingen tom (håndtert som feiltilfelle over).
