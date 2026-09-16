# Leadgrid Markedssjef-modus — Role Room-agentens markedsplan i Leadgrid-skall

**Status:** Fase 0 + fase 1 (chat-agent) levert. **Modul:** `leadgrid:marketing` (opt-in).
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

- `cd backend && npm run test:unit -- server/leadgrid-marketing-bridge.test.ts`
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

## Kjente hull (fase 1b–2)

1. **iPad-verktøy** (`leadgrid_find_duplicates`, `_enrich_company`, `_log_visit`, …) mangler
   Anthropic-verktøyskjema og server-side kjøring; `context.leads` rendres ikke i prompten.
2. **Feed-planner + LinkedIn-publisering** (`RoleRoomFeedPlannerPanel`,
   `/api/role-room/agent/feed-plan/*`): trenger bootstrap-objektet fra fase 0 og lg-gren i
   `role-room-agent-feed-plan-routes.ts`. LinkedIn-tilkoblinger er `user_id`-nøklet og
   virker allerede for markedssjefen.
3. **Versjonshistorikk** for lg-planer (FK på versjonstabellen).
4. **Tenant-hardening**: `organization_id` på `brand_kits`, `role_room_marketing_plans`,
   `role_room_feed_plans`, `role_room_ai_consent` (0530-presedens) i stedet for syntetisk
   nøkkel; slå sammen agent-entitlement med `module_feature_entitlements` (cto-audit steg 7).
5. `role-room-marketing-cockpit-routes.ts` er hardkodet til Role Rooms egen Meta-side —
   må skrives om per org før scorecard/cockpit kan vises i Leadgrid.
6. Frontend-rollelisten i `pages/admin-room/usePermissions.ts` kjenner ikke `markedssjef`
   (kun view-as-forhåndsvisning påvirkes); siden her bruker backend-svarene direkte.
7. Admin-UI for å skru på modulen (i dag: SQL-raden over).
