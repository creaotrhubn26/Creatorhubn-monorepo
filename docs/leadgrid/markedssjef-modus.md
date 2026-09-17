# Leadgrid Markedssjef-modus — Role Room-agentens markedsplan i Leadgrid-skall

**Status:** Fase 0 + fase 1 (chat-agent) + UX-rework + fase 1b (LinkedIn-publisering) levert. **Modul:** `leadgrid:marketing` (opt-in).
**Eier:** Leadgrid. **Sist oppdatert:** 2026-09-16.

## Hva det er

En **vertikal oppå Leadgrid**: en markedssjef i en Leadgrid-organisasjon kan lage
markedsstrategi, innholdspilarer og 30 dagers kanalplan (LinkedIn, Instagram, TikTok)
for sin *egen* bedrift — generert av The Role Room-agentens markedsplan-motor, i
Leadgrid-skall på `/leadgrid/markedsforing`.

Strategien formes av **beslutningspsykologi** (Kahneman, *Tenke, fort og langsomt*):
kognitiv letthet, tapsaversjon, forankring, utside-blikk/base rates, peak-end og loven
om små tall. Hver pilar oppgir prinsippet den bruker («Prinsipp: … —» i begrunnelsen).
Ingen falsk knapphet, ingen oppdiktede tall.

## Hva som IKKE endres

- Ingen eksisterende Leadgrid-side, rute, tabell eller flyt er endret. Det eneste nye
  i eksisterende Leadgrid-kode er rutegrenen `/leadgrid/markedsforing` i
  `casting-main.tsx` og modul-nøkkelen `leadgrid:marketing` (default `locked`).
- Role Room-oppførsel er uendret: broen aktiveres kun for prosjekt-nøkler med prefiks
  `lg-`; alle andre nøkler går gjennom nøyaktig samme admin-sesjon-, medlemskaps- og
  entitlement-sjekker som før.
- Orger uten entitlement-raden ser en låst-kort-side, ingenting annet.

## Arkitektur

```
Leadgrid-side (/leadgrid/markedsforing)
   │  1. POST /api/leadgrid/marketing/bootstrap   ── leadgrid-marketing-routes.ts
   │     → runOrchestratedBootstrap for ORGEN (organizations.website/org_number/nace)
   │       under nøkkelen lg-<leadgrid_projects.id>, persistert i role_room_research_versions
   │  2. POST /api/role-room/marketing-plan/generate { projectId: "lg-…", bootstrap }
   │     POST /api/role-room/marketing-plan/:planId/activate → 30 poster i bakgrunnen
   │  3. <MarketingPlanWorkspace projectId="lg-…"/>   (gjenbrukt uendret)
   ▼
app.use("/api/role-room/marketing-plan", createLeadgridMarketingBridge)   ── leadgrid-marketing-bridge.ts
   • finner lg-nøkkelen i body/query/sti (plan-/post-/pillar-id slås opp i DB)
   • autoriserer via Leadgrid: sesjon → loadAccessibleLeadgridProject → RBAC
     marketing.content.brief (mig 302) → module_feature_entitlements leadgrid:marketing
   • legger LeadgridMarketingAccess på requesten; no-op for alle andre nøkler
role-room-marketing-plan-routes.ts
   • requireAdminSession erstattes av bro-resultatet for lg-nøkler
   • userCanAccessProject / userIsProjectMember / resolvePostEditor / eier-sjekker
     aksepterer lg-nøkkelen som er autorisert for akkurat denne requesten
   • feature-flag role-room-agent-producer + checkAgentEntitlement hoppes over for lg
     (modulen + Leadgrids AI-kvote erstatter dem); strategyLens = beslutningspsykologi
role-room-plan-versions-routes.ts / role-room-marketing-activity-feed-routes.ts
   • viewerCanAccessProject har lg-gren via resolveLeadgridMarketingAccess
```

### Nøkkel-konvensjon

Alle agent-/markedsplan-tabeller har `project_id` som fri tekst (TEXT/VARCHAR uten FK),
så `lg-<leadgrid_projects.id>` er skjema-kompatibel — samme mønster som
`lead-<id>` i `leadgrid-url-research-routes.ts`. Unntak: `role_room_marketing_plans_versions`
har FK til `casting_projects`; `snapshotPlanVersion` hopper derfor stille over lg-nøkler
(versjonshistorikk kommer i fase 2).

### Gating (tre lag, alle må passere)

| Lag | Hvor | Regel |
|---|---|---|
| Prosjekt | `loadAccessibleLeadgridProject` | Eier, prosjekt-medlem eller org-medlem med `projects.view_all` |
| RBAC | `resolveEffectivePermissions` | `marketing.content.brief` — gis til `markedssjef`, `markedskoordinator`, `content_ansvarlig` (mig 302); `admin` har alt |
| Modul | `isModuleFeatureEnabled` | `module_feature_entitlements` (`leadgrid`, `marketing`) i `included`/`trial`; default `locked` |

## Aktivering per org

```sql
INSERT INTO module_feature_entitlements
  (organization_id, workspace_id, module_key, feature_key, state, environment)
VALUES ('<org-uuid>', NULL, 'leadgrid', 'marketing', 'included', 'production');
```

Brukeren må ha org-rolle `markedssjef` (eller `admin`), og organisasjonen må ha
`website` eller `org_number` satt (brukes av bootstrap).

Miljø: `ANTHROPIC_API_KEY` (bootstrap + plan), valgfritt `ROLE_ROOM_BOOTSTRAP_ORCHESTRATOR=claude`.

## Verifisering

- `cd backend && npm run test:unit -- server/leadgrid-marketing-bridge.test.ts server/leadgrid-marketing-routes.stream.test.ts`
- `cd frontend && npx vitest run client/src/components/leadgrid/marketingFlowState.test.ts`
- Manuelt: sett entitlement-raden; logg inn som markedssjef; åpne
  `/leadgrid/markedsforing`; kjør «Kartlegg organisasjonen» → rad i
  `role_room_research_versions` med `project_id = 'lg-…'`; «Generer markedsplan» →
  plan i `role_room_marketing_plans` med pilarer merket «Prinsipp: …»; som `selger` →
  403 `mangler_tillatelse`; uten entitlement → 403 `module_locked`; Role Room-produsent
  på casting-prosjekt → uendret.

## Fase 1 — chat-agent i Leadgrid-skall

Role Room-agentens chat-runtime (tråder, SSE-stream, samtykke, pseudonymisering, audit) er
åpnet for Leadgrid-prosjekter via `backend/server/leadgrid-agent-access.ts`. Casting-
oppførsel er uendret: fallbacken kjører kun når casting-sjekken feiler, og bare i agent-
inngangene (ikke i den generelle `canAccessRoleRoomProject`).

| Prosjekt-nøkkel | Modus | Tilgang | Persona | Flate |
|---|---|---|---|---|
| `lg-<leadgrid_projects.id>` | `leadgrid_marketing` | prosjekt + `marketing.content.brief` + modul `leadgrid:marketing` | Markedssjef-agent (Kahneman-linse, kanaler, plan) | `/leadgrid/markedsforing` steg 4 (web) |
| `<leadgrid_projects.id>` (ren id) | `leadgrid_sales` | `loadAccessibleLeadgridProject` + modul `leadgrid:core` | Leadgrid-assistent (pipeline, oppfølging) | iPad `LeadgridAgentChatView` (sender ren id) |
| alt annet | `casting` | som før | The Role Room Agent | Role Room |

Gating per endepunkt (Leadgrid-gren = «casting feiler → `resolveLeadgridAgentProject`»):
- `POST /api/role-room/agent/threads` og `handleAgentStream` (`/threads/:id/messages`,
  `/projects/:id/agent/stream`): `role-room-agent-threads-routes.ts`, `role-room-agent-stream.ts`.
- `/projects/:id/agent/query|stream|tool-result` og `/projects/:id/ai-consent*`:
  `canAccessAgentProject` i `role-room-routes.ts`.
- Agent-entitlement (`checkAgentEntitlement`, userId-/abonnementsbasert) hoppes over for
  Leadgrid-moduser — modul-entitlementen erstatter den. Samtykke (`role_room_ai_consent`,
  nøklet på prosjekt-streng) og rate limit gjelder som før.

Modus styrer (`role-room-agent-definition.ts`): system-prompt (`agentSystemPromptForMode`) og
verktøy (`agentToolsForMode`: kun produktnøytrale — nettsted-audit, analytics, GEO, brand-scan,
community-post; aldri casting-verktøyene). Kontekst (`leadgrid-agent-context.ts`, env-gate
`LEADGRID_AGENT_CONTEXT=off`): markedssjef får org-profil + kartlegging + aktiv plan; salg får
antall leads per status og forfalte oppfølginger. Kun aggregater, ingen navn.

iPad: `/threads/:id/messages` sender nå klientens `context` og `surface` videre (ble kastet
før). `context.leads` tas imot men rendres ikke i prompten ennå, og `leadgrid_*`-verktøyene
appen forventer har ingen server-side skjema — begge er fase 1b.

## UX-kontrakt for siden (brukersentrert)

Siden `pages/leadgrid-markedsforing.tsx` er en **tilstandsmaskin**
(`components/leadgrid/marketingFlowState.ts`, ren og testet): rå input (modul, prosjekt,
status, kjørende mutasjoner, postfremdrift) → én tilstand med **én primærhandling**.
Sekundære handlinger ligger i en overflow-meny. Oppsett er en vertikal stepper
Kartlegg → Plan → Poster der bare aktivt steg er utfoldet; steady-state (aktiv plan
med poster) viser arbeidsflaten øverst, oppsettet som én linje og chatten kollapsbar.

| Tilstand | Når | Primærhandling | Sekundært |
|---|---|---|---|
| `locked` | modul av / `module_locked` | — (salgskort med CTA `/leadgrid/priser`) | — |
| `no_project` | ingen prosjekt valgt | — | — |
| `loading` | modul/prosjekter/status hentes | — | — |
| `access_denied` | `mangler_tillatelse` / `ikke_medlem_av_org` / annet | — | — |
| `org_incomplete` | org uten nettsted og org.nr. | `edit_org_profile` (inline-skjema når `can_edit_profile`; ellers «kopier forespørsel») | — |
| `ready_to_map` | ingen kartlegging | `map` | — |
| `mapping` | SSE-stream kjører (ekte steg) | — | — |
| `map_failed` | handshake-/streamfeil | `retry_map` | — |
| `mapped_incomplete` | `readiness.ready = false` | `remap` (+ `extraContext`-felt) | — |
| `ready_to_plan` | kartlagt, ingen plan | `generate_plan` | `remap` |
| `planning` | generate/activate kjører | — | — |
| `plan_failed` | generate feilet | `retry_plan` | `remap` |
| `plan_draft` | plan i `draft` | `activate_plan` | `new_plan`, `remap` |
| `generating_posts` | aktiv plan, poster ikke `complete` | — («n av 30», polles hvert 4. s) | `open_chat` |
| `active` | aktiv plan med poster (steady-state) | `open_chat` | `new_plan`, `remap` |

Ærlig fremdrift: kartlegging via `POST /api/leadgrid/marketing/bootstrap/stream` (SSE
`start`/`stage`/`done`/`error`, samme kontrakt som Role Rooms producer-bootstrap-stream;
`useResearchProgress({ endpoint, persistSnapshot: false })`), plan/poster via
`MarketingGenerationProgress`, poster via `GET /marketing-plan/:planId/posts/progress`
(lg-eier-erstatning i `role-room-marketing-plan-routes.ts`). Toast på hver ferdig/feilet
operasjon, `aria-live="polite"` på fremdriftsområdene.

Forebygg feil: status gir `organization.can_edit_profile` (rolle `admin`) og
`org_number_editable` (admin **og** org-eier) så inline-skjemaet bare vises når
`PATCH /api/admin-room/lead-map/organizations/:id/profile` faktisk vil lykkes; lagring
starter kartleggingen direkte. Manglende readiness-felter oversettes
(`MISSING_FIELD_LABELS`) og kan fylles i et tekstfelt som sendes som `extraContext`.
«Ny plan» krever bekreftelse (ny plan = utkast ved siden av den aktive; poster slettes ikke).

Konsistens: `LeadgridProjectSelect` (delt prosjektvelger, `rr_lead_map_active_project`),
`AiConsentGate` `copy`-prop og `RoleRoomAgentChatPanel` `consentCopy`/`emptyStateText`
(markedssjef-kopi; Role Room-default uendret), `--role-cyan: #a78bfa` på wrapperen.

### Måling: tid til første aktive plan

Ingen ny instrumentering — måles fra eksisterende tidsstempler per `lg-`-nøkkel:

```sql
WITH first_map AS (
  SELECT project_id, MIN(generated_at) AS mapped_at
    FROM role_room_research_versions
   WHERE project_id LIKE 'lg-%'
   GROUP BY project_id
), first_plan AS (
  SELECT p.project_id, MIN(p.generated_at) AS planned_at,
         MIN(po.created_at) AS first_post_at
    FROM role_room_marketing_plans p
    LEFT JOIN role_room_marketing_plan_posts po ON po.plan_id = p.id
   WHERE p.project_id LIKE 'lg-%' AND p.status IN ('active', 'draft')
   GROUP BY p.project_id
)
SELECT lp.organization_id,
       m.project_id,
       m.mapped_at,
       f.planned_at,
       f.first_post_at,
       f.planned_at   - m.mapped_at AS map_to_plan,
       f.first_post_at - m.mapped_at AS map_to_first_post
  FROM first_map m
  JOIN first_plan f USING (project_id)
  JOIN leadgrid_projects lp ON lp.id = substr(m.project_id, 4)
 ORDER BY m.mapped_at DESC;
```

Ukentlig aktive orger (planer eller poster rørt siste 7 dager):

```sql
SELECT lp.organization_id, COUNT(DISTINCT p.id) AS plans_touched
  FROM role_room_marketing_plans p
  JOIN leadgrid_projects lp ON lp.id = substr(p.project_id, 4)
 WHERE p.project_id LIKE 'lg-%' AND p.updated_at > now() - interval '7 days'
 GROUP BY lp.organization_id;
```

Mål for demoen: kartlegging + plan under 3 minutter (`map_to_plan`), uten at brukeren
må forlate siden for å rette org-profilen.

### Oppfølginger fra UX-reworken

- De fire andre Leadgrid-sidene (deals, workflows, import, connectors) kopierer fortsatt
  prosjektvelgeren; bytt til `LeadgridProjectSelect` når de likevel røres.
- `RoleRoomAgentChatPanel` har ~78 hardkodede farger; kun de tre `var(--role-cyan)`-
  stedene følger Leadgrid-paletten. Egen refaktor.
- Kanban-PATCH i Leadgrid går utenom `applyStageChange` (observert, ikke rørt).

## Fase 1b — LinkedIn-publisering og resultat-løkken

Lukker det femte verdikriteriet («blir mer verdifull over tid»): en plan-post kan publiseres
til LinkedIn fra `/leadgrid/markedsforing`, resultatet (likes/kommentarer) hentes som KPI-
snapshots, og neste «Ny plan» får dem som `previousPlanKpiContext` — uten at brukeren gjør noe.

**Flyt:** aktiv plan → kortet «Neste post på LinkedIn» (`components/leadgrid/LinkedInPublishCard.tsx`)
viser posten som står for tur (`nextPostToPublish.ts`: LinkedIn-poster, ikke publisert/hoppet
over, sortert på dag) med redigerbar tekst → ikke koblet: «Koble til LinkedIn» (popup mot
`POST /api/role-room/linkedin/oauth/start` **uten** `projectId`, så raden blir brukerens globale
tilkobling som publisher-en leser) → «Publiser på LinkedIn» → toast med «Åpne posten» → neste.
Sekundært: «Hopp over». Resultatlinjen (`MarketingResultsLine.tsx`) kjører `kpi-sync` én gang
per sidelast og viser «likes · kommentarer siste 30 dager» når det finnes tall; ellers skjult.

**Ruter** (under `/api/role-room/marketing-plan`, så broen autoriserer `lg-`-nøkler):

| Rute | Gjør | Autorisasjon |
|---|---|---|
| `POST /posts/:postId/publish` `{ projectId, platform:'linkedin', caption?, organizationUrn? }` | `dispatchPublish('linkedin', …)` som tekstpost; skriver `status='published'`, `published_at`, `external_post_id`, `external_permalink`, `published_by_user_id`, `published_platform`; ved feil `publish_error` + 502 med norsk `reason`-tekst | plan-eier eller `leadgridMarketingAuthorizedFor`; 403 ved prosjekt-mismatch; 409 hvis allerede publisert; 400 ved feil kanal/tom tekst/>3000 tegn; 10 per minutt per bruker |
| `GET /linkedin/publish-options?projectId=` | `{ connected, state, memberName, companies, scopeMissing, captionMax }` | som over |
| `POST /:planId/kpi-sync`, `GET /:planId/kpi-summary`, `POST /posts/:postId/kpi-snapshot` | uendret kontrakt; `kpi-sync` tar nå også poster med `external_post_id` | eier **eller** `leadgridMarketingAuthorizedFor` (var kun eier) |

Migrasjon `0616_marketing_plan_posts_publish_state.sql` (additiv). `fetchLinkedInKpisForPosts`
(`role-room-kpi-connectors.ts`) er ekte: likes/kommentarer/engagement via
`social-linkedin-social-actions.ts` (delt med `social-linkedin-insights-worker.ts`), token fra
`published_by_user_id` (fallback plan-eier). Role Room-flyten accept → feed-planner er urørt.

**Avsender:** profil som standard. Bedriftsside vises i velgeren bare når tilkoblingen har
`w_organization_social`. Dagens OAuth-app ber om `openid profile email w_member_social`
(`role-room-linkedin-oauth-scopes.ts`), så bedriftsside blir tilgjengelig først når LinkedIn-appen
får Community Management-godkjenning og scopet legges til der. Koden trenger ingen endring da.

**Begrensninger (ærlig):** kun tekstposter (bilde/video er fase 2); ingen planlagt publisering
(LinkedIn UGC støtter det ikke; `scheduled_for` er informativ); ingen impressions (krever Page-
stats); lesing av likes/kommentarer på egne poster forutsetter at LinkedIn gir `r_member_social`
til appen — inntil da skriver `kpi-sync` ingenting for LinkedIn og resultatlinjen forblir skjult.

Tester: `role-room-marketing-plan-routes.publish.test.ts`, `role-room-kpi-connectors.linkedin.test.ts`,
`components/leadgrid/nextPostToPublish.test.ts`.

## Kjente hull (fase 2)

1. **iPad-verktøy** (`leadgrid_find_duplicates`, `_enrich_company`, `_log_visit`, …) mangler
   Anthropic-verktøyskjema og server-side kjøring; `context.leads` rendres ikke i prompten.
2. **LinkedIn: media, planlagt publisering og impressions.** Publisering er tekst-only og
   umiddelbar; en kø-worker (mønster: `role-room-instagram-publish.ts`) trengs for
   `scheduled_for`, og bilde/video krever media-generering per post. Impressions og
   bedriftsside krever nye LinkedIn-scopes (`r_member_social`, `w_organization_social`).
3. **Versjonshistorikk** for lg-planer (FK på versjonstabellen).
4. **Tenant-hardening**: `organization_id` på `brand_kits`, `role_room_marketing_plans`,
   `role_room_feed_plans`, `role_room_ai_consent` (0530-presedens) i stedet for syntetisk
   nøkkel; slå sammen agent-entitlement med `module_feature_entitlements` (cto-audit steg 7).
5. `role-room-marketing-cockpit-routes.ts` er hardkodet til Role Rooms egen Meta-side —
   må skrives om per org før scorecard/cockpit kan vises i Leadgrid.
6. Frontend-rollelisten i `pages/admin-room/usePermissions.ts` kjenner ikke `markedssjef`
   (kun view-as-forhåndsvisning påvirkes); siden her bruker backend-svarene direkte.
7. Admin-UI for å skru på modulen (i dag: SQL-raden over).
