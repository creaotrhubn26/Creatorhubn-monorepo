# Lead Map iPad-app

Native iPad-app for feltsalg + markeds­analyse. Bruker samme backend som
web-versjonen i Marketing Cockpit (Admin Room → Lead Map).

## Status

**Skeleton (2026-06-16).** Backend live i prod (Render).
Web-versjonen er moden med ~60 features merget i PR #569–#591.
iPad-appen er et tynt SwiftUI-lag over samme REST-endepunkter.

## Hva web-versjonen kan i dag (relevant for iPad-scope)

| Område | Web-feature | iPad MVP? |
|---|---|---|
| **Kart** | Leaflet med droppin-pins per status, diamant-pins for konkurrenter, radius-circle for by-filter | ✅ |
| **Lead-detail** | Navn, kontakt-info (phone/email/IG/website), googleRating, AI Opportunity Score | ✅ |
| **Status-bytte** | 11 statuser (unvisited/visited/return/not_present/declined/interested/meeting_booked/proposal_sent/won/lost/do_not_contact) m/ PATCH `/leads/:id/status` | ✅ |
| **Visit-log** | POST `/leads/:id/visits` m/ type (physical/phone/email/online/research), kontaktperson, sammendrag, notes, neste-handling, follow-up-dato | ✅ |
| **BRREG-berikkelse** | Firma-data (org-nr, NACE, ansatte, daglig leder, konkurs-status) auto-fetch ved valg | ✅ |
| **SSB demografi** | Befolkning + markedspotensial-score 0-100 per by | ✅ |
| **Konkurrenter** | Diamant-pins fra Role Room Agent's Market Scan, threat-level fargekodet | ✅ (lese-only) |
| **Claude-strategi** | "Anbefal outreach-strategi" → primær kanal + sekvens + opening-line | ✅ |
| **AI Pitch** | Generer Claude-pitch per lead | ✅ |
| **Kalender** | Kommende møter + follow-ups innen 60 dager | ✅ |
| **Reminders** | Stille leads (7+/14+/30+ dager uten aktivitet) | ✅ |
| **Status-rapport** | 7-dagers oppsummering m/ Claude-anbefalinger | ✅ |
| **Søk + by-radius** | Live-søk over leads/konkurrenter, by-Select + radius-slider | ✅ |
| **Leaderboard** | Per-bruker stats (totalLeads/won/meetings/conversion-%) | ✅ |
| **CSV import** | Drag-drop CSV (norske + engelske kolonner) | ⏭ Web-only (iPad importerer fra Files) |
| **CSV eksport** | Last ned leads-YYYY-MM-DD.csv | ✅ via Share-sheet |
| **Counter-campaign** | Claude → Marketing Cockpit-bro | ⏭ Web-only |
| **Konkurrent-add/threat-edit** | Manuell add, Claude-vurdering | ⏭ Web-only (iPad er for feltsalg) |
| **Google Ads conversion** | Auto-fyrer på won/meeting_booked | ✅ (gjøres backend-side ved status-PATCH) |

## Hva iPad-versjonen tilbyr utover web

- **MapKit** native dark mode (iOS 17+ `mapMode = .imagery` med dark overlay)
- **Live GPS** — viser eget sted, "leads i nærheten av meg" sortering,
  auto-zoom til nåværende posisjon ved oppstart
- **CoreLocation** for å auto-fylle `visit_latitude/longitude` ved
  fysiske besøk (`POST /visits` med GPS-coordinates)
- **Offline-cache** — siste fetched leads tilgjengelig uten dekning
  (GRDB SQLite)
- **Apple Pencil**-notater i visit-loggen + signatur-felt
- **Siri Shortcuts** "Logg besøk på \<lead-navn\>"
- **Push-notifikasjoner** for follow-up-påminnelser (basert på
  `next_follow_up_at` < 1 t)
- **Quick Actions** fra Home Screen (3D Touch): "Vis stille leads",
  "Logg besøk her"
- **Widgets** (medium/large): kalender-events + reminders-count
- **Native action sheet** for status-bytte (større tap-targets enn web)

## Backend-endepunkter brukt

Samme som web (under `/api/admin-room/lead-map/`):

### Leads (kjernen)
- `GET    /leads?minLat&maxLat&minLng&maxLng&status` — bounds-filter
- `GET    /leads/:id` — detalj
- `PATCH  /leads/:id/status` — endre status (fyrer Google Ads conversion)
- `PATCH  /leads/:id/geo` — sett geo manuelt
- `POST   /leads/:id/visits` — logg besøk (m/ visit_latitude/longitude)
- `GET    /leads/:id/visits` — visit-historikk

### Markedslandskap
- `GET    /competitors` — alle konkurrenter (sortert threat+priority)
- `GET    /market-points?include=both|leads|competitors` — kombinert

### AI-tjenester (Claude)
- `POST   /leads/:id/strategy` — anbefalt outreach-strategi
- `POST   /leads/:id/generate-pitch` — Claude-pitch
- `POST   /leads/rank-all` — Claude ranker alle leads (Admin-actions-meny)

### Berikkelse
- `GET    /leads/:id/enrichment` — lagret BRREG-data
- `POST   /leads/:id/enrich` — trigger BRREG-oppslag
- `GET    /leads/:id/demographics` — SSB markedspotensial

### Oversikter
- `GET    /metrics` — KPI-stripe + trends + sparklines
- `GET    /calendar` — kommende møter + follow-ups (60d)
- `GET    /reminders` — stille leads (bøtter 7+/14+/30+) + dueToday
- `GET    /status-report` — 7-dagers oppsummering m/ Claude-anbefalinger
- `GET    /leaderboard` — per-bruker stats
- `GET    /activities?limit=N` — aktivitets-feed

Auth: bearer-token i Authorization-header (samme som CaptureApp's
pairing-flow — se `ipad/CaptureApp/CaptureApp/App/`).

## Skjerm-flyt

1. **Pairing** — vis QR i web Admin Room → scan med iPad-kamera →
   bearer-token i Keychain (gjenbruker CaptureApp-pattern)
2. **Map View** (hovedskjerm)
   - MapKit fullscreen, status-fargede pins for leads, diamant-pins for konkurrenter
   - Bottom sheet: KPI-stripe (4 metrics) m/ kollapsbar
   - Floating: filter-knapp (status + by-radius), søk-knapp, "Mitt sted"-knapp
   - Reminder-banner øverst hvis stille leads > 0
3. **Lead Detail Sheet** (presentation sheet)
   - Brand-monogram + navn + status-chip
   - Meta: adresse, telefon, email, website, IG (alle tap-able)
   - BRREG-firma-kort (kun lese)
   - SSB markedspotensial-kort
   - 6 status-knapper (sirkel m/ ikon)
   - 4 CTAs: Log Visit, Schedule Meeting, Strategi, Send Message
   - Claude rec-rank-strip når satt
4. **Visit Log Modal** (full-screen modal)
   - visit_type-picker (segmented)
   - Kontaktperson-text
   - Conversation summary (Apple Pencil OK)
   - GPS auto-fylt (vis verifisering: "Du er X meter unna lead")
   - Status-endring + next_follow_up_at-date-picker
5. **Outreach Strategy Sheet**
   - Refleksjons-banner (tenk selv først — 5 spørsmål)
   - Claude-strategi m/ primær kanal + sekvens
   - Kopier-knapp per draft
6. **Follow-up Queue / Calendar**
   - Liste sortert dato. Klikk → åpne lead detail
7. **Stille leads-dialog**
   - Sortert eldst først. Tap → lead detail

## Tech-stack

- **SwiftUI** + iOS 17 minimum
- **Swift 6** + complete strict concurrency (samme som CaptureApp)
- **MapKit** for kart (innebygd `Map`-view)
- **CoreLocation** for GPS
- **GRDB.swift** for offline-cache (`models.sqlite` i App Documents)
- **Keychain** for bearer-token
- **URLSession** + `async/await` for API-kall

## Filstruktur

```
ipad/LeadMapApp/
├── LeadMapApp/
│   ├── App/
│   │   ├── LeadMapApp.swift              # @main
│   │   ├── AppState.swift                # @MainActor observable state
│   │   ├── PairingFlow.swift             # QR-scan → token
│   │   └── AuthClient.swift              # Keychain + bearer-håndtering
│   ├── Core/
│   │   ├── APIClient.swift               # Wrapper over URLSession
│   │   ├── LeadModel.swift               # Codable, matcher backend
│   │   ├── CompetitorModel.swift
│   │   ├── VisitModel.swift
│   │   ├── ActivityModel.swift
│   │   ├── EnrichmentModel.swift         # BRREG-data
│   │   ├── DemographicsModel.swift       # SSB-data
│   │   ├── StrategyModel.swift           # Claude outreach-strategi
│   │   ├── MetricsModel.swift            # KPI + trends + sparklines
│   │   └── OfflineCache.swift            # GRDB lag for leads + activities
│   ├── Views/
│   │   ├── MapScreen.swift               # Hoved-MapKit-view
│   │   ├── LeadDetailSheet.swift
│   │   ├── VisitLogModal.swift
│   │   ├── StrategySheet.swift
│   │   ├── CalendarView.swift
│   │   ├── RemindersBanner.swift
│   │   ├── StatusReportSheet.swift
│   │   ├── LeaderboardView.swift
│   │   ├── BrandKitMonogram.swift
│   │   ├── StatusPin.swift               # Droppin-form pin
│   │   └── CompetitorPin.swift           # Diamant-pin
│   ├── Assets.xcassets/
│   └── Generated/
│       └── Info.plist                    # auto-generert av XcodeGen
├── LeadMapApp.xcodeproj/                 # auto-generert (kjør xcodegen)
├── project.yml                           # XcodeGen-spec
└── README.md (denne fila)
```

## Bygge lokalt

```bash
# Krever XcodeGen installert: brew install xcodegen
cd ipad/LeadMapApp
xcodegen generate
open LeadMapApp.xcodeproj
```

## Implementasjons-plan

| Fase | Hva | Estimat |
|---|---|---|
| **0** | **Skeleton** (denne PR-en): project.yml + Swift-stubs + README | ½ dag |
| 1 | Pairing-flow + Keychain + AuthClient | ½ dag |
| 2 | APIClient + Codable-models for alle endepunkter | 1 dag |
| 3 | MapKit-view + lead-pins + bounds-filter | 1 dag |
| 4 | Lead Detail Sheet + status-PATCH | ½ dag |
| 5 | Visit Log Modal + GPS-integrasjon | 1 dag |
| 6 | BRREG + SSB-kort i lead-detail | ½ dag |
| 7 | Konkurrent-pins + detail-switch | ½ dag |
| 8 | Strategi-sheet + AI Pitch-modal | 1 dag |
| 9 | Reminder-banner + status-rapport | ½ dag |
| 10 | Kalender + Leaderboard | ½ dag |
| 11 | Offline-cache (GRDB) | 1-2 dager |
| 12 | Siri Shortcuts + Push-notifikasjoner | 1 dag |
| 13 | Widget (medium/large) | 1 dag |
| 14 | TestFlight + iPad-only QA | ½ dag |

## Auth-flow (samme som CaptureApp)

1. Admin Room (web) → "iPad-paring" → genererer kort token + QR
2. iPad LeadMapApp → første gang → Camera scanner QR
3. Backend `POST /api/auth/ipad-pair` med scan-data → returnerer
   permanent `Bearer`-token + brukernavn
4. Lagres i Keychain (service: `com.creatorhubn.LeadMapApp.auth`)
5. Alle API-kall: `Authorization: Bearer <token>`

## Bemerkninger

- iPad-appen er en CONSUMER av backenden, ikke en uavhengig kilde.
  Skriving (status-bytte, visits) går rett til DB — samme transaksjoner
  som web. Leaderboard oppdateres automatisk.
- BRREG/SSB/Claude-kall caches på backend → iPad kan trygt re-trigge
  uten å spille de eksterne API-ene full pris.
- Offline-køen (visit-logs uten dekning) flushes når dekning er
  tilbake — duplikat-deteksjon via lokalt UUID.
