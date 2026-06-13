# Lead Map iPad-app

Native iPad-app for feltsalg med samme backend som web-versjonen i Marketing Cockpit.

## Status

**Skeleton — ikke implementert ennå.** Backend (REST på Render) er live etter PR #487+. Web-versjonen ligger i Marketing Cockpit (PR med denne filen).

## Hva iPad-versjonen tilbyr utover web

- **MapKit** native dark mode (iOS 17+ `mapMode = .imagery` med dark overlay)
- **Live GPS** — viser eget sted, "leads i nærheten av meg" sortering
- **CoreLocation** for å auto-fylle visit_latitude/longitude ved fysiske besøk
- **Offline-cache** — siste fetched leads tilgjengelig uten dekning (Core Data)
- **Apple Pencil**-notater i visit-loggen
- **Siri Shortcuts** "Logg besøk på X"
- **Push-notifikasjoner** for follow-up-påminnelser

## Backend-endepunkter brukt

Samme som web (alle under `/api/admin-room/lead-map/`):

- `GET    /leads?minLat&maxLat&minLng&maxLng&status` — list med bounds-filter
- `GET    /leads/:id` — detalj
- `PATCH  /leads/:id/status` — endre status
- `PATCH  /leads/:id/geo` — sett geo manuelt
- `POST   /leads/:id/visits` — logg besøk (inkl. visit_latitude/longitude fra GPS)
- `GET    /leads/:id/visits` — visit-historikk
- `GET    /activities` — feed
- `GET    /metrics` — KPI-tall

Auth: bearer-token i Authorization-header (samme som CaptureApp's pairing-flow).

## Skjerm-flyt (planlagt)

1. **Login** — bruker eksisterende pairing-mønster fra `ipad/CaptureApp` (vis QR i web Admin Room, scan med iPad-kamera, oppretter bearer-token)
2. **Map View** — MapKit fullscreen, status-fargede annoteringer, current-location-knapp
3. **Lead Detail** — sheet-presentasjon med kontaktinfo, status-buttons, "Log Visit"-knapp
4. **Visit Log** — modal med visit_type-picker, contact_person, conversation_summary, next_action, next_follow_up_at, GPS auto-fylt
5. **Follow-up Queue** — liste av forfallne follow-ups (filtrert fra `/metrics`)

## Implementasjons-plan

| Fase | Hva | Estimat |
|---|---|---|
| 1 | Xcode-prosjekt + SwiftUI shell + login/pairing | 1-2 dager |
| 2 | MapKit + leads-fetch + status-pin-styling | 1 dag |
| 3 | Lead detail-sheet + status-PATCH | ½ dag |
| 4 | Visit-log-modal + GPS-integrasjon | 1 dag |
| 5 | Offline-cache via Core Data | 1-2 dager |
| 6 | TestFlight + iPad-only spec-test | ½ dag |

Gjenbruker pairing-flow + bearer-auth fra `ipad/CaptureApp/` for å unngå å implementere en ny auth-mekanisme.

## Filstruktur (planlagt)

```
ipad/LeadMapApp/
├── LeadMapApp/
│   ├── LeadMapApp.swift              # @main
│   ├── App/
│   │   ├── AppState.swift            # @MainActor state
│   │   ├── PairingFlow.swift         # Gjenbruker mønster fra CaptureApp
│   │   └── AuthClient.swift
│   ├── Core/
│   │   ├── APIClient.swift           # GET/PATCH/POST mot /api/admin-room/lead-map/
│   │   ├── LeadModel.swift
│   │   ├── VisitModel.swift
│   │   └── ActivityModel.swift
│   ├── Views/
│   │   ├── MapView.swift             # MapKit
│   │   ├── LeadDetailSheet.swift
│   │   ├── VisitLogModal.swift
│   │   ├── FollowUpQueueView.swift
│   │   └── StatusPin.swift
│   └── Assets.xcassets/
├── LeadMapApp.xcodeproj/
└── README.md (denne fila)
```

## Neste steg

Bygges i egen sesjon med riktig Xcode + Apple Developer-tilgang.
Web-versjonen er funksjonell og backend-API klar — iPad-appen er
ren UI-laget over samme REST-endepunkter.
