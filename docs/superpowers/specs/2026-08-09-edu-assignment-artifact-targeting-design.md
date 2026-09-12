# Oppgave-artefakt-targeting + LMS-autorering — design

**Dato:** 2026-08-09
**Status:** Godkjent konsept (Daniel: «alle 3») → detaljert design til review
**Kontekst:** Fortsettelse av student→produksjonsmodus-sløyfen ([[project_role_room_education_production_bridge]], PR #1975 + #1982). Faglærer skal enkelt kunne gi en oppgave som lander studenten rett i et **spesifikt verktøy-view** (f.eks. «Skriv en Story Logic i dag»), og få **full kontroll** til å publisere slike oppgaver rett fra Canvas/Moodle. Alt grunnet i kode-audit (Story Logic = sub-view `view=story-logic` i `story-arc-studio`-fanen; `artifact_kind` er i dag fane-nivå TEXT som mappes 1:1 til `?tab=`; Deep Linking lager i dag KUN en produksjons-lenke, ingen oppgave-rad).

## Problem (tre hull, verifisert i kode)
1. **Fane-nivå, ikke view-nivå.** `artifact_kind` (`role_room_education_assignments`) mappes identity til `?tab=`. «Story Arc» lander på studio-hubben, ikke `view=story-logic`. Kan ikke targete et view.
2. **Student-deep-link mangler artefakten.** `StudentWorkspace` per-oppgave-«Åpne» kaller `openProductionInRoleRoom(projectId)` UTEN artifactKind → student havner på default-fane, ikke oppgavens artefakt. (Faglærer-`AssignmentsTab`-knappen sender den; student gjør ikke.)
3. **Deep Linking publiserer kun produksjon.** `DeepLinkPicker` + `/lti/launches/:id/deep-link-response` lager en `ltiResourceLink` m/ `custom.production_id` — INGEN `role_room_education_assignments`-rad, ingen artefakt/brief/frist/læringsmål. Rik oppgave-autorering finnes bare in-app.

## Mål
- Faglærer kan lage en oppgave som targeter et **view** i et verktøy (minst Story Logic i Story Arc Studio), og studenten lander rett der.
- Studenten åpner oppgaven → deep-linkes til riktig fane **+ view** (samme-tab, `edu=1`, per #1982).
- Faglærer kan authore en **full oppgave** (produksjon + artefakt + brief + frist + læringsmål + arbeidskrav/eksamen/vurderingsform) rett fra Canvas/Moodle via Deep Linking, som lager en ekte `role_room_education_assignments`-rad, og LMS-lenken deep-linker studenten til artefakt-viewet.

## Ikke-mål (YAGNI)
- Ikke view-nivå for ALLE faner — kun der det gir mening nå (Story Arc-stegene: Story Logic, Story Writer; hele Story Arc). Shot list/Storyboard forblir egne fane-artefakter.
- Ikke endre Story Logic-verktøyet selv, EDU_TAB_ACCESS-modellen, eller RBAC (artifact_kind forblir fane-nøkkelen → RBAC/sammenligninger uendret).
- Ikke AGS/NRPS-endringer.

## Arkitektur — tre avgrensede endringer

### 1. View-nivå artefakt (backend + frontend)
- **Migrasjon:** `ALTER TABLE role_room_education_assignments ADD COLUMN IF NOT EXISTS artifact_view TEXT;`. `artifact_kind` forblir uendret fane-nøkkel (RBAC/eksisterende sammenligninger urørt); `artifact_view` navngir valgfritt et sub-view (f.eks. `story-logic`).
- **Backend** (`role-room-education-assignments-routes.ts`): create + PATCH aksepterer + lagrer `artifact_view` (samme validerings-stil som `artifact_kind` — trimmet string eller null). GET-lister returnerer `artifactView`.
- **Frontend `AssignmentsTab.tsx`:** når Artefakt = `story-arc`, vis en andre velger «Steg» med `{ '': 'Hele Story Arc', 'story-logic': 'Story Logic', 'story-writer': 'Story Writer' }` → setter `artifactView`. Andre artefakter: ingen view-velger.
- **`openProductionInRoleRoom(projectId, tab?, opts?)`** (`educationProductionsService.ts`): utvid `opts` med `view?: string`. Når satt: `url.searchParams.set('view', view)`. SPA-en hydrerer alt `?view=` (`CastingPlannerPanel.tsx:1152`). **Implementer MÅ verifisere den eksakte `?tab=`-verdien SPA-en forventer for Story Arc Studio** (fane-nøkkel `story-arc` vs URL-param `story-arc-studio`) og at Story Logic-view-nøkkelen er `story-logic` — les `CastingPlannerPanel.tsx` tab/view-hydrering før kobling.

### 2. Fiks student-deep-link (frontend)
- **Student-view-data:** bekreft/utvid at `GET /education/student/view`-oppgavelista returnerer `artifactKind` + `artifactView` per oppgave (`role-room-education-student-view-routes.ts`-spørringen — legg til `a.artifact_view` om den mangler).
- **`StudentWorkspace.tsx` per-oppgave-«Åpne»:** send oppgavens `artifactKind` som `tab` + `artifactView` som `view`, samme-tab + `edu=1` (bruk samme student-sti som #1982: `openProductionInRoleRoom(projectId, tab, { asStudent: true, view })`). Faglærer-sti uendret (ny-tab).
- **Fane-nøkkel-mapping:** hvis `artifact_kind` (`story-arc`) ≠ SPA-ens `?tab=`-verdi, gjør oversettelsen ETT sted (i `openProductionInRoleRoom` eller en liten `artifactToTab`-helper) så både faglærer- og student-sti bruker samme kobling.

### 3. Rik Deep Link-autorering fra Canvas/Moodle (backend + frontend)
- **Frontend `DeepLinkPicker.tsx`:** utvid skjemaet til full oppgave-autorering: velg/opprett produksjon (finnes) + kull (finnes) + **Artefakt + view-velger** (gjenbruk fra #1) + tittel + brief + frist + læringsmål + arbeidskrav/eksamen/vurderingsform. På submit: POST til `deep-link-response` med det rike payloadet.
- **Backend `/lti/launches/:id/deep-link-response`** (`role-room-lti-routes.ts`): aksepter rikt payload → (a) opprett `role_room_education_assignments`-rad (gjenbruk education-assignments-create-logikken; faglærer-sesjonen er den mintede deep-link-sesjonen, `requireSession`), (b) bygg innholdselementet med `custom.production_id` + `custom.artifact_kind` + `custom.artifact_view` (+ `custom.assignment_id`). Behold retur `{ returnUrl, jwt }`.
- **Launch-handler** (`role-room-lti-routes.ts`, `custom.production_id`-grenen ~:562): les også `custom.artifact_kind` + `custom.artifact_view` → redirect `mode=production&project=<id>&tab=<artifactToTab(kind)>&view=<view>` (bevar `rr_session`). Uten artefakt-custom → dagens oppførsel (default-fane).

## Dataflyt (ny)
```
Faglærer i Canvas/Moodle → Deep Link → DeepLinkPicker (full oppgave: produksjon+kull+artefakt/view+brief+frist+...)
  → deep-link-response: oppretter education_assignment-rad + content item custom{production_id, artifact_kind, artifact_view, assignment_id}
  → LMS lagrer ressurs-lenke
Student klikker lenken → /lti/launch (custom.production_id+artifact) → mode=production&project=&tab=&view=story-logic → lander i Story Logic
  (eller: student i Min side → oppgave-«Åpne» → samme deep-link til tab+view)
Lever → leveranse (per #1975/#1982) → Vurdering → karakter
```

## Feilhåndtering
- Ukjent/tom `artifact_view` → åpne fanen uten view (dagens oppførsel). Aldri feil.
- Deep-link-oppgave-opprettelse feiler (manglende kull/produksjon) → returner tydelig feil i picker, IKKE et halvt innholdselement.
- `artifactToTab`-mapping mangler nøkkel → fall tilbake til å sende `artifact_kind` verbatim som `tab` (dagens oppførsel).

## Testing
- **Backend vitest:** assignments create/PATCH lagrer+returnerer `artifact_view`; deep-link-response oppretter assignment-rad + custom bærer artifact_kind/view; launch-handler bygger `tab`+`view`-redirect fra custom; uten custom-artefakt → default (ingen view).
- **Frontend:** `AssignmentsTab` view-velger vises kun for story-arc; `openProductionInRoleRoom` setter `view`-param; student-«Åpne» sender tab+view+asStudent; DeepLinkPicker POSTer rikt payload.
- **E2E mot Moodle:** (a) in-app: faglærer lager «Skriv en Story Logic»-oppgave (artefakt Story Arc → Story Logic) → student launcher → Min side → «Åpne» → lander i Story Logic-viewet → redigerer → Lever → Vurdering → karakter. (b) Deep Link: faglærer i Moodle → Deep Link → authorer full oppgave → LMS-lenke → student klikker → lander i Story Logic. Forutsetning: plattform godkjent (godkjennings-gate), student-e-post = LMS-e-post, lukk faglærer-admin-tab (localStorage-kontaminasjon).

## Gjenbruk (uendret)
`resolveEducationProductionRole` + `EDU_TAB_ACCESS` (RBAC), `listEducationProductionProjectIds` (#1982), student→produksjon-broen, `createDeliverable`/Lever-loopen, Story Logic-verktøyet, deep-link-JWT-signering (`signDeepLinkingResponse`), godkjennings-gaten.

## Åpne punkter / risiko
- **Fane-nøkkel vs URL-param:** `artifact_kind='story-arc'` vs SPA `?tab=story-arc-studio` må avklares i implementering (les hydrering). Løses med `artifactToTab`-helper ett sted.
- **Deep-link-sesjonens rettigheter:** oppgave-opprettelse i deep-link-flyten bruker faglærerens mintede sesjon — verifiser at `requireSession` + eierskap holder (faglærer eier kull/produksjon).
- **Story Logic edit-gating:** contributor har `manage` på `story-arc`-fanen; view-nivå gates ikke separat (bekreftet). Ingen ekstra RBAC nødvendig.
