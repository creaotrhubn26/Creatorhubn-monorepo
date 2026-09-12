# Admin Oversikt — UX/UI · Stabilitet · Kommunikasjon (oppfølgingsnotat)

Status pr. PR `claude/admin-dashboard-ux-ui-tofaae` (#922). Dette notatet
samler **gjenstående arbeid** som krever backend + live QA, og som derfor ikke
ble fullført i sandkassen (ingen Postgres/kjørende server der).

## ✅ Ferdig i PR #922
- KPI-stripe på oversikten + progressiv visning (Sammendrag / Statistikk / Aktivitet)
  for å unngå scroll-overload.
- Mørkt, konsistent tema på hele Oversikt-gruppen (delt `adminDarkTheme`,
  inkl. opake dialoger/menyer). Fontfarger sikret mot mørk-på-mørk.
- Skalering: roligere polling-kadens i `AdminStats` (navngitte konstanter),
  `staleTime` på SEO/Billing-feeds, tunge paneler montert bak segmenter.
- Virtualisering (react-virtuoso `TableVirtuoso`): `LeadMapEntitlementsAdminPanel`
  og invitasjonstabellen i `InviteManagementDashboard`.
  - Merk: `UserManagementPanel` er allerede paginert (8/side) → ikke virtualisert med vilje.
- Pålogget-status (ekte) i Kommunikasjon-panelet: `/api/admin/communication/users`
  beriket via `user_presence`-JOIN; grønn prikk + «Pålogget nå»/«Frakoblet».

## ✅ Implementert i etterkant (commit på samme branch) — må fortsatt live-QA-es

### 1. Presence for ALLE brukere — GJORT (kode), trenger live verifisering
Implementert:
- **Nytt endepunkt:** `GET /api/admin/presence/online` i `backend/server/index.ts`
  (rett etter `requireAdminSession`-definisjonen). Admin-guardet via
  `requireAdminSession(req, res)` (guard-i-handler-stilen), bruker `pool`.
  Returnerer `{ online: [{ userId, email, name, lastSeenAt, isIdle, currentRoute }],
  onlineCount, generatedAt }`. Degraderer trygt (tom liste) hvis `user_presence`
  mangler. SQL bruker det utprøvde 90-sek/ikke-idle-mønsteret.
- **Frontend:** delt hook `useAdminPresence()` + `<OnlineStatusDot/>` i
  `components/admin/shared/useAdminPresence.tsx` (poller 30s, `apiRequest`).
- **UserManagementPanel:** grønn prikk som badge på hver bruker-avatar
  (`presence.isOnline(user.id) || presence.isOnline(user.email)`) + et nytt
  «Pålogget nå»-statuskort øverst med `onlineCount`.
- [ ] **LIVE-QA:** verifiser SQL mot prod-skjema, at admin-guard blokkerer
  ikke-admin, og at prikkene faktisk reflekterer reell heartbeat-status.

### 2. «Send melding» til en bruker — BLOKKERT på personvern-prerequisitt
**IKKE implementert end-to-end** fordi det ville lekke DM-er. Funnet under
utforskningen:
- Selve sende-endepunktet finnes (`POST /api/admin/communication/send` i
  `admin-communication-extras-routes.ts`, admin-guardet, tar `{ chatId, message }`)
  og kan trivielt utvides med Alt. A (`{ userId, message }` → get-or-create
  `dm-admin-<userId>`-kanal).
- **MEN** `GET /api/communication/conversations` (`communication-routes.ts:2527`)
  **filtrerer ikke på deltaker** — den returnerer ALLE aktive kanaler (limit 50)
  til ALLE brukere (`userEmail` leses men brukes aldri i spørringen). Å
  auto-opprette en admin↔bruker-DM ville derfor vises i ALLE brukeres CreatorHub-
  fane = en personvernlekkasje.
- **Prerequisitt før denne kan bygges:** legg deltaker-filtrering på
  `/api/communication/conversations` (JOIN mot `communication_participants` der
  `user_id`/e-post matcher innlogget bruker). Dette rører den bruker-vendte
  widgeten for ALLE brukere → må gjøres + QA-es mot live backend, ikke blindt.
- Etter at filtreringen finnes: Alt. A + «Send melding»-knapp per rad i
  `UserManagementPanel` (composer-dialog, gjenbruk mønster fra
  `AdminCommunicationPanel`). Bekreft at brukerens **CreatorHub/Direktemelding**-
  fane er riktig leveringskanal.

### 3. QA-sjekkliste før merge av backend-bitene
- [ ] Røyktest `user_presence`-JOIN mot prod-skjema (kolonnenavn bekreftet i
      `presence-heartbeat-routes.ts` + `admin-room-platform-status-routes.ts`).
- [ ] Verifiser at admin-guard faktisk blokkerer ikke-admin (presence er
      personvern-sensitivt).
- [ ] End-to-end: admin sender melding → dukker opp i brukerens widget i sanntid.
- [ ] Bekreft `sender_id`-semantikk (ID vs e-post) i `communication_messages`.

### 4. Mulige videre UX/stabilitets-runder
- Harmoniser under-dashboardene (GA / SEO / Billing) visuelt om de ser lyse ut live.
- Vurder virtualisering av andre voksende admin-tabeller etter samme mønster.
