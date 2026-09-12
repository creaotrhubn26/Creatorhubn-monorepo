# iPad LeadMapApp ↔ Web Leadgrid — Gap-rapport

**Dato**: 2026-06-19
**Status**: Web Leadgrid har 30+ PR-er bygget bare denne uken. iPad LeadMapApp har vokst parallelt, men feature-paritet er ikke gjennomført.

## Hva iPad har i dag

iPad bruker `/api/admin-room/lead-map/*`-stien — den **opprinnelige** Lead Map for selgere i felt:

- Lead-pin på kart + lead-detalj-view
- Basis status-endring (`updateStatus(leadId, status)`)
- Basis tildeling (`assignLead(leadId, toUserId)`) — kun 1 nivå
- Notifikasjoner inkl. APNS device-token
- Heartbeat for online-status
- Onboarding-playbooks, focus-requests, pitch-deck-studio
- Lead-research (gated på `lead_research.run`)
- Lead Scout (needs/signals/scores)
- Portefølje, calendar, reminders
- Google Sign-In, paring til web-konto

## Hva web Leadgrid har bygget (siste uke) som iPad mangler

### 🔥 P1 — Kritisk for selgers daglig bruk (felten)

| Funksjon | Web-PR | Web-endepunkt |
|---|---|---|
| **Won-dialog m/ beløp + recurring + note** | #751 | `PUT /api/leadgrid/customers/:id/status` (m/ won-felter) |
| **Lost-dialog m/ påkrevd årsak fra enum** | #751 | samme — m/ lost_reason |
| **Status-history-timeline** | #751 | `GET /api/leadgrid/customers/:id/status-history` |
| **Hierarkisk tildeling (TL→rep)** | #746 | `POST /assign-team-leader` + `/assign-rep` |
| **Sett-tracking (mark-seen)** | #746 | `POST /api/leadgrid/customers/:id/mark-seen` |
| **Mine tildelinger-liste** | #746 | `GET /api/leadgrid/my-assignments` |
| **Assignment-status (hvem har sett)** | #746 | `GET /api/leadgrid/customers/:id/assignment-status` |
| **In-app notifications-inbox** | #748 | `GET /api/leadgrid/my-notifications` |
| **Push på Leadgrid-events** | #748 | (APNS finnes — må kobles til nye event-typer) |

### 🟡 P2 — Verdt å ha for komplett opplevelse

| Funksjon | Web-PR | Web-endepunkt |
|---|---|---|
| **Notification-prefs UI (kanaler + events)** | #748 | `GET/PUT /api/leadgrid/my-notification-prefs` |
| **Lead-inbox m/ Claude-research (HOT/WARM)** | #744 #745 | `GET /api/superadmin/leads/inbox` |
| **Accept-as-project m/ tildeling** | #744 | `POST /api/superadmin/leads/:id/accept-as-project` |
| **CRM detail-drawer (status + tildeling + history)** | #752 | (`GET /api/leadgrid/customers/:id` + andre) |
| **Won/Lost KPI-dashboard** | #752 | `GET /api/leadgrid/won-lost-stats` |
| **CSV-eksport via iOS Share** | #754 | `GET /api/leadgrid/leads/export?format=csv` |
| **Klient-portal org-tydeliggjøring** | #741 | (portal-data har nye felter) |
| **Klient-onboarding-wizard (5-stegs)** | #737 | `/api/leadgrid/onboarding/channels/*` |
| **Auto-research consent + visning** | #744 | (på lead-detail-view) |

### 🟢 P3 — Nice-to-have

| Funksjon | Web-PR | iPad-relevans |
|---|---|---|
| Schedulerte rapporter | #756 #757 #759 | Visning + send-nå (oppretts via web) |
| Scope-velger på rapporter | #759 | Visning av scope-chips |
| PDF-eksport (deling) | #754 | Via iOS Share-meny |
| WhatsApp-templates admin | #735 | Sannsynligvis web-only |
| E-post-branding admin | #735 | Sannsynligvis web-only |
| Stripe overage-billing | #730 | Sannsynligvis web-only |
| API rate-limiting | #729 | Web-only (admin) |
| Onboarding-tour (in-app) | #729 | Web-only flate |
| Schedulert PDF-cron | #756 | Server-only |

## Eldre Leadgrid-features som også mangler iPad-paritet

Disse ble bygget tidligere, før denne sesjonen, men mangler iPad-paritet:

| Funksjon | Tidligere PR | Iværende web-modul |
|---|---|---|
| Lead Map → markedslandskap m/ konkurrenter | #569 #572 #576 | Konkurrent-pins, threat-vurdering |
| Lead Map org+RBAC+profiler+selger-pins | #611 #612 | Multi-tenant, 45-key RBAC, 4-felt-profiler |
| Lead-gen-service | #307 #309 #310 | Meta Lead Ads-leads + ROI-funnel |
| Klient-portal /c/{token} | #705 | Klient ser score + leveranser |
| Leadgrid drips + grace | #707 #708 | E-post-drypp dag 1/3/7/14 |
| Plan/limits/upgrade | (forskjellige) | Solo Free / Solo Pro / Agency |
| Partner-applications system | #723-#727 | Multi-step wizard + verifisering |
| Partner-marketplace | #727 | Listed/Verified-tier |

## Status på fase 1 (akkurat startet)

I dag begynte jeg på iPad-paritet (fase 1 = APIClient-utvidelse) men stoppet ved 50% pga din observasjon. Det jeg rakk:

✅ Lagt til `updateLeadgridStatus`, `markLeadSeen`, `assignTeamLeader`, `assignRep`, `fetchAssignableUsers`, `fetchAssignmentStatus`, `fetchMyAssignments`, `fetchWonLostStats`, `fetchScheduledReports`, `createScheduledReport`, `autoCreateReportsPerPerson`, `exportLeadsCsv`, `fetchMyLeadgridNotifications`, `markLeadgridNotificationsRead`, `fetchMyLeadgridNotificationPrefs`, `updateMyLeadgridNotificationPrefs`, `fetchLeadgridStatusHistory`, `fetchLeadgridCustomer`

❌ Ikke gjort: Swift-modeller for response-typene (StatusHistoryResponse, AssignableUsersResponse, etc.) — kompilerer ikke ennå
❌ Ikke gjort: SwiftUI-view-er som bruker disse
❌ Ikke gjort: AppState-integrasjon
❌ Ikke gjort: APNS-push-handling for Leadgrid-events

## Realistisk omfang

Full paritet for **bare P1** = ~6-8 timer fokusert arbeid:
- APIClient (50% gjort) + response-modeller — 1t
- Won-/lost-dialoger m/ valutaformat — 1t
- Hierarkisk tildelings-sheet — 1.5t
- Status-history timeline-view — 1t
- Sett-tracking auto-trigger — 0.5t
- APNS-event-handling — 1t
- AppState-integrasjon + tester — 1.5t

**P1 + P2** = ~12-15 timer
**P1 + P2 + P3** = ~20+ timer

## Anbefalt strategi

1. **Denne sesjonen** — fullføre P1 (kritisk for at iPad er funksjonelt likeverdig)
2. **Neste sesjon** — P2 (CRM-drawer, dashboard, eksport)
3. **Iterativt etter behov** — P3 + eldre gap

Eller — bygg API-client-fullføring + Swift-modeller nå, så lager du SwiftUI-views selv etter behov (siden du kjenner UX-en best).

## Konkrete neste steg (om P1 fullføres)

1. Definer alle response-Decodable-strukter i `LeadgridModels.swift`:
   - `StatusHistoryResponse`, `AssignableUsersResponse`, `MyAssignmentsResponse`,
     `AssignmentStatusResponse`, `WonLostStatsResponse`, `LeadgridCustomerDetail`,
     `LeadgridNotificationsResponse`, `LeadgridNotificationPrefs`,
     `ScheduledReportsResponse`, `AutoCreateReportsResponse`
2. SwiftUI-view: `WonDialogSheet`, `LostDialogSheet`, `StatusHistoryView`
3. SwiftUI-view: `AssignLeadSheet` m/ 2-step picker (TL → rep)
4. Auto-mark-seen i `LeadDetailView.onAppear`
5. APNS-handler: route nye `event_type` til Leadgrid-flow
