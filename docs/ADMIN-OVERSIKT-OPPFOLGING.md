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

## ⏳ Gjenstår — gjøres i Claude Code med live QA

### 1. Presence for ALLE brukere (ikke bare de som har sendt melding)
`/api/admin/communication/users` dekker kun distinkte *sendere*. For online-status
i `UserManagementPanel` (og en helhetlig «hvem er pålogget»-oversikt) trengs et
eget, **admin-guardet** endepunkt.

- **Nytt endepunkt:** `GET /api/admin/presence/online`
- **Guard:** Bruk `requireAdminSession` (se `backend/server/index.ts:2068`).
  OBS: helperen brukes inkonsistent i kodebasen (noen steder som middleware
  `app.get(path, requireAdminSession, handler)`, andre som guard-i-handler som
  returnerer `session|null`). Verifiser kallekonvensjonen før implementasjon.
- **SQL (utprøvd mønster, jf. `admin-room-platform-status-routes.ts:275`):**
  ```sql
  SELECT u.id, u.email, u.first_name, u.last_name,
         p.last_seen_at, p.is_idle, p.current_route,
         (p.last_seen_at > NOW() - INTERVAL '90 seconds'
           AND COALESCE(p.is_idle, FALSE) = FALSE) AS is_online
    FROM users u
    LEFT JOIN user_presence p ON p.user_id = u.id
   WHERE u.is_active = TRUE;
  ```
- **Respons:** `{ online: [{ userId, lastSeenAt, isIdle, currentRoute }], generatedAt }`
- **Frontend:** delt hook `useAdminPresence()` (poll ~30s) + `<OnlineStatusDot/>`,
  brukt i BÅDE `UserManagementPanel` (per rad) og Kommunikasjon-panelet.

### 2. «Send melding» til en bruker fra brukerlisten
`POST /api/admin/communication/send` krever en `chatId` (KANAL), ikke en bruker-ID.
For å sende fra `UserManagementPanel` trengs ett av:

- **Alt. A (anbefalt):** Utvid `/api/admin/communication/send` til å akseptere
  `{ userId, message }` og resolve/opprette brukerens DM-kanal server-side
  (get-or-create i `communication_channels` + delta i `communication_channel_members`).
- **Alt. B:** Nytt `POST /api/admin/communication/dm/:userId/ensure-channel`
  som returnerer `chatId`, deretter eksisterende `/send`.
- **Leveranse til bruker:** lander i brukerens **Direktemelding**-fane (CreatorHub-
  native chat) via eksisterende polling/WS i `UniversalChatWidget`. Bekreft at det
  er denne fanen Daniel mener med «Creatorhub-fanen».
- **Frontend:** «Send melding»-knapp per rad i `UserManagementPanel` som åpner en
  enkel composer-dialog (gjenbruk mønster fra `AdminCommunicationPanel`).

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
