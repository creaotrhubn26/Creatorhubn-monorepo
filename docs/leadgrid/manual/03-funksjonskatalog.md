# Komplett funksjonskatalog for Leadgrid

**Snapshot:** 29. august 2026  
**Dekningsnivå:** brukerobserverbare funksjoner på alle Leadgrid-plattformer,
pluss produktspesifikke serverflater uten bekreftet UI. Individuelle HTTP-ruter
er gruppert i [teknisk referanse](./06-teknisk-referanse.md).

Katalogen er laget fra aktiv navigasjon, klientkall, monterte servermoduler,
permissions, entitlements, lagring og tester. «Aktiv» betyr ikke at produksjons-
migrasjoner eller alle tredjepartsnøkler er verifisert i kjøremiljøet.

## Kolonner

- **Inngang/plattform:** hvor brukeren eller integrasjonen finner funksjonen.
- **Data:** `server` betyr varig backendlagring eller en reell ekstern tjeneste;
  `lokal` betyr enheten; `snapshot` betyr avledet kopi; `ingen` betyr presentasjon.
- **Gate:** viktigste rolle, permission, entitlement eller teknisk forutsetning.
- **Status:** felles status fra [manualens forside](./README.md).

## A. Tilgang, organisasjon og grunnsystem

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| ACC-01 | Native pairing/innlogging | Appstart, iPhone/iPad/Mac | Server + Keychain/session | Gyldig pairing/auth | Aktiv | `App/PairingFlow.swift`, `App/AuthClient.swift` |
| ACC-02 | Google Sign-In | Web og native auth | Server/Google | OAuth-konfigurasjon | Aktiv · betinget | `leadgrid-google-auth-routes.ts`, `GoogleSignInService.swift` |
| ACC-03 | Session-utløp og ny innlogging | Global native modal | Lokal state + serverstatus | HTTP 401 | Aktiv | `App/LeadMapApp.swift`, `Core/APIClient.swift` |
| ACC-04 | Organisasjonsvelger | Header og delte dashboard | Server | Medlemskap i flere org-er | Aktiv | `OrgPickerToolbarMenu.swift`, `user-org-routes.ts` |
| ACC-05 | Aktiv org-override | Superadmin | Server | `super_admin` | Aktiv · betinget | `leadgrid-org-override-routes.ts` |
| ACC-06 | Org-status pause/suspend | Middleware etter første Leadgrid-ruteblokk | Server | Org-status; admin-bypass | Hybrid; registreringsrekkefølge gjør at tidligere ruter ikke treffes | `org-status-enforcement.ts`, `backend/server/index.ts` |
| ACC-07 | Rolledefault | Team/Tilganger | Klientmodell | Salgssjef, Teamleder, Selger, Spectator | Aktiv · betinget | `TeamAccessControl.swift` |
| ACC-08 | Per-bruker permission override | Lead Map/admin | Server | `permissions.manage` | Aktiv · betinget | `lead-map-permission-routes.ts` |
| ACC-09 | Native tilgangsmatrise per medlem | Team/Leadbook-preview | Delvis lokal/live teammapping | Backend-RBAC er ikke fullt samme modell | Hybrid | `TeamAccessControl.swift` |
| ACC-10 | Org-entitlements | Native gate + utvalgte serverruter | Server | `included/trial/add_on/locked`; vanlig gate fail-open | Hybrid; serverhåndheves bare for en del moduler | `GatedView.swift`, `leadgrid-entitlement-guard.ts` |
| ACC-11 | Plan og bruksgrenser | Header/Verktøy/web | Server | Aktiv plan/org | Aktiv | `LeadgridPlanUsageBar.swift`, `plan-routes.ts` |
| ACC-12 | Demo-modus | Native globalt | Lokal/demodata | Debug/demo-konfigurasjon | Aktiv som demo-verktøy | `DemoModeManager`, `MockDataBanner` |
| ACC-13 | APNs-enhetsregistrering | Appstart | Server/APNs | Varseltillatelse | Aktiv · betinget | `NotificationAppDelegate`, `lead-map-notification-routes.ts` |
| ACC-14 | Profilredigering | Profilmeny | Server | Innlogget medlem | Aktiv | `MyProfileEditView.swift`, `lead-map-me-profile-routes.ts` |
| ACC-15 | Org-profil og logo | Organisasjonsinnstillinger | Server + nettsted | Org-permission | Aktiv · betinget | `OrgSettingsView.swift`, `lead-map-profile-routes.ts`, `lead-map-logo-routes.ts` |

## B. Oversikt og personlig arbeidsdag

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| OVR-01 | Oversikt-landingsside | Hovedfane | Server i live; demo ellers | Innlogget | Aktiv | `Views/Tabs/Oversikt/OversiktView.swift` |
| OVR-02 | KPI-kort | Oversikt | Server/avledet | Datatilgang | Aktiv | `OversiktView.swift`, `leadgrid-oversikt-routes.ts` |
| OVR-03 | KPI-statistikkmodal | Oversikt header | Blandet avledet/live | Innlogget | Hybrid | `OversiktView.swift`, `QASweepTests.swift` |
| OVR-04 | Dagens møter | Oversikt/widget | Server + snapshot | Kalender/møtedata | Aktiv | `AppState.swift`, `WidgetSnapshot.swift` |
| OVR-05 | Forfalte oppfølginger | Oversikt/widget/varsler | Server + snapshot | Lead-tilgang | Aktiv | `lead-map-followup-cron.ts`, `LeadMapWidget.swift` |
| OVR-06 | Momentumscore | Oversikt | Server | `momentum.view` | Aktiv · betinget | `LeadgridMomentumCard.swift`, `leadgrid-momentum-routes.ts` |
| OVR-07 | Momentumtrend | Oversikt | Server | `momentum.view` | Aktiv · betinget | `LeadgridMomentumTrendChart.swift` |
| OVR-08 | Sett salgsmål | Oversikt | Server | `momentum.set_goal` | Aktiv · betinget | `LeadgridSetGoalSheet.swift`, `leadgrid-momentum-routes.ts` |
| OVR-09 | Next Best Action | Oversikt/Verktøy | Server/AI | Intelligence-permission | Aktiv · betinget | `NextBestActionFAB.swift`, `leadgrid-intelligence-routes.ts` |
| OVR-10 | Team-performance-banner | Oversikt/delte flater | Demo eller delvis avledet live | Teamdata | Hybrid | `TeamPerformanceBanner.swift` |
| OVR-11 | Salgsledelsesark fra Oversikt | Oversikt CTA | Server | `admin`/`salgssjef` | Aktiv · betinget | `OversiktView.swift`, `SalgsledelseView.swift` |
| OVR-12 | Offline-køindikator | Verktøy/globalt | Lokal kø | Kø har elementer | Aktiv | `OfflineQueueBadge.swift`, `OfflineActionQueue.swift` |

## C. Kart, feltarbeid, territorier og ruter

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| MAP-01 | Kartflate | Kart-fane | Server + MapKit | Kart-/leadtilgang | Aktiv | `Views/Tabs/Kart/KartView.swift` |
| MAP-02 | Lead-pins og statusvarianter | Kart | Server | Lead-tilgang | Aktiv | `LeadPinView.swift`, `StatusPin.swift` |
| MAP-03 | Ny-lead-puls fra realtime | Kart | WebSocket/server | Org-kanal | Aktiv | `LeadgridRealtimeClient.swift`, `LeadMapApp.swift` |
| MAP-04 | Kart-/bedriftssøk | Kart | Klient + kart/leaddata | Innlogget | Aktiv | `MapSearchBar.swift`, `KartView.swift` |
| MAP-05 | Kartfiltre | Kart | Klientfilter | Innlogget | Aktiv | `Views/Tabs/Kart/FilterViews.swift` |
| MAP-06 | Egen posisjon | Kart | CoreLocation | Lokasjonstillatelse | Aktiv · betinget | `KartLocationManager.swift`, `LocationService.swift` |
| MAP-07 | Sentrer på meg | Kart | Enhet | Gyldig posisjon | Aktiv · betinget | `CenterOnMeFAB.swift` |
| MAP-08 | Opprett lead | Kart/⌘N/Leads | Server i live | `createLeadAtPosition`/leads write | Aktiv · betinget | `AddLeadSheet.swift`, `lead-map-routes.ts` |
| MAP-09 | Slipp pin og velg posisjon | Kart | Klient + server ved lagring | Lead write | Aktiv · betinget | `LeadgridDropPinSheet.swift` |
| MAP-10 | Pin-forklaring | Kart/verktøy | Ingen | Innlogget | Aktiv | `PinGuideView.swift` |
| MAP-11 | Lead-hurtigstatus | Pin/detalj | Server | Statuspermission | Aktiv · betinget | `LeadQuickStatusSheet.swift`, `lead-status-routes.ts` |
| MAP-12 | Full lead-detalj fra kart | Pin | Server + enkelte syntetiske felt | Lead-tilgang | Hybrid; hardkodet kontakt/notat finnes utenfor demo | `LeadDetailFullSheet.swift` |
| MAP-13 | Ring, e-post og OS-handlinger | Lead-detalj | Ekstern app; ikke egen aktivitetslogg automatisk | Gyldig kontaktdata | Aktiv · betinget | `LeadActionSheets.swift` |
| MAP-14 | Start/avslutt besøk | Kart/lead | Server | Visit permission | Aktiv · betinget | `ActiveVisitActivity.swift`, `VisitModel.swift` |
| MAP-15 | Live Activity for besøk | Låseskjerm/Dynamic Island | ActivityKit-state | Støttet iPhone/OS | Aktiv · betinget | `LeadMapWidget/ActiveVisitLiveActivity.swift` |
| MAP-16 | Besøksnotat/transkript | Etter besøk | Server/AI | Transcript/AI-permission | Aktiv · betinget | `lead-map-transcript-routes.ts`, `TranscriptIntelligence.swift` |
| MAP-17 | Åpne navigasjon | Kart/møte | Apple Maps/MapKit | Gyldige koordinater | Aktiv · betinget | `NavigateSheet.swift`, `NavRoutePOI.swift` |
| MAP-18 | Enkel dagsrute | Verktøy/Kart | Server + karttjeneste | `routes.create/view/execute` | Aktiv · betinget | `LeadgridRoutePlannerView.swift`, `leadgrid-route-routes.ts` |
| MAP-19 | Flerstopps besøksrute | Kart/Ruter | Server | `leadgridRuteplanlegger` | Aktiv · betinget | `APIClient+Ruter.swift`, `leadgrid-rute-routes.ts` |
| MAP-20 | Leder tildeler rute | Team/Ruter | Server + push | Lederrolle/rutegate | Aktiv · betinget | `leadgrid-rute-routes.ts` |
| MAP-21 | Møteankere og stoppkjeding | Ruteplanlegger | Server | Rutegate | Aktiv · betinget | `LeadgridRoutePlannerView.swift` |
| MAP-22 | Live rutesporing | Kart/Team | Server/posisjon | `routeTracking` + lokasjon | Aktiv · betinget | `RouteTracker.swift`, `routes-adherence-routes.ts` |
| MAP-23 | Rute-adherence | Team | Server | `routeAdherenceReports` | Aktiv · betinget | `RouteAdherenceView`, `routes-adherence-routes.ts` |
| MAP-24 | Team i nærheten | Team/Kart | Backend finnes; klient har mockfallback | Team/lokasjon | Hybrid | `TeamOnMap.swift`, `routes-adherence-routes.ts` |
| MAP-25 | Territorie CRUD | Web/native Team | Server | `territories.manage` | Aktiv · betinget | `leadgrid-territory-routes.ts`, `TerritoryGridManager.tsx` |
| MAP-26 | Overlapp, coverage og orphan leads | Web territoriepanel | Server | Territoriepermissions | Aktiv · betinget | `TerritoryCoveragePanel.tsx`, `leadgrid-territory-service.ts` |
| MAP-27 | Tettsted-tildeling | Team | Server/SSB | `omradeTildeling` | Aktiv · betinget | `AssignAreaSheet.swift`, `leadgrid-kartverket-routes.ts` |
| MAP-28 | Konkurrentpins | Lead Map web/native | Server | Competitor permission | Aktiv · betinget | `CompetitorPin.swift`, `lead-map-competitor-routes.ts` |
| MAP-29 | Konkurrentvurdering/motkampanje | Lead Map web | Server/AI | AI + campaign-permissions | Aktiv · betinget | `CompetitorDetailSheet.swift`, `lead-map-campaign-routes.ts` |
| MAP-30 | Pencil-kartannotasjoner | Kart | Server + PencilKit | Annotationpermission | Aktiv · betinget | `AnnotationToolbar.swift`, `lead-map-annotation-routes.ts` |
| MAP-31 | Måleverktøy | Kart | Lokal beregning | Enhet/kart | Hybrid | `MeasureToolModels.swift`, `MeasureRouteSheets.swift` |
| MAP-32 | Dørsalg husstandsmodus | Kart | Ekstern adresse + serverutfall | `dorsalgModus` eksplisitt | Aktiv · betinget | `leadgrid-dorsalg-routes.ts`, `leadgrid-kartverket-routes.ts` |
| MAP-33 | Dørsalg adressesøk | Kart | Kartverket proxy | `dorsalgAdresseSok` | Aktiv · betinget | `leadgrid-kartverket-routes.ts` |
| MAP-34 | Dørsalg vunnet/avslått | Kart | Server | Dørsalgmodus | Aktiv · betinget | `leadgrid-dorsalg-routes.ts` |
| MAP-35 | Brief-møte før felt | Kart/Team | Server + varsler | Leder/permission | Aktiv · betinget | `leadgrid-brief-routes.ts` |
| MAP-36 | Kartverket reverse geocode/kommune | Kart/Team | Ekstern proxy/cache | Nett | Aktiv · betinget | `leadgrid-kartverket-routes.ts` |
| MAP-37 | Entur mobilitetsalternativ | Navigasjon | Ekstern Entur | `ENTUR_CLIENT_NAME` | Aktiv · betinget | `EnturService.swift`, `leadgrid-entur-routes.ts` |
| MAP-38 | Nærmeste parkering | Navigasjon | Offentlig parkering | Nett/data coverage | Aktiv · betinget | `ParkingService.swift`, `leadgrid-parking-routes.ts` |
| MAP-39 | Fartsgrense og bom | Navigasjon/kjørebok | NVDB | `NVDB_CLIENT` | Aktiv · betinget | `NvdbService.swift`, `leadgrid-nvdb-routes.ts` |
| MAP-40 | Kjøretøyoppslag | Kart/Go | Statens vegvesen | API-nøkkel + reg.nr. | Aktiv · betinget | `VehicleService.swift`, `leadgrid-vehicle-routes.ts` |
| MAP-41 | Offline kart-/leadcache | Native | Lokal cache | Tidligere synk | Aktiv for støttede data | `OfflineCache.swift` |
| MAP-42 | Offline handlingskø | Native | Lokal kø → server | Handling må bruke køadapter | Aktiv for støttede handlinger | `OfflineActionQueue.swift`, `OfflineResilientActions.swift` |

## D. Leads, CRM, pipeline og tilbud

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| LEAD-01 | Leads-tabell | Leads-fane | Server i live; demo ellers | `leads` entitlement | Aktiv | `Views/Tabs/Leads/LeadsView.swift` |
| LEAD-02 | Søk | Leads/⌘K/⌘F | Klient over lastede leads | Leads visible | Aktiv | `LeadsView.swift` |
| LEAD-03 | Område-, status- og scorefilter | Leads | Klient | Leads visible | Aktiv | `LeadsFilterPopovers.swift` |
| LEAD-04 | Flere filtre | Leads | Klient | Leads visible | Aktiv | `LeadsMoreFiltersSheet.swift` |
| LEAD-05 | Lagrede visninger | Leads | UI-state uten bekreftet teamsynk | Leads visible | Hybrid | `LeadsView.swift` |
| LEAD-06 | Sideinndeling | Leads | Klient over lastet liste | Leads visible | Aktiv | `LeadsView.swift` |
| LEAD-07 | KPI-kort og drilldown | Leads | Live tellinger; trend kan være demo | Leads visible | Hybrid | `LeadsView.swift`, `LeadsKPIDetail.swift` |
| LEAD-08 | Multi-select/bulkmarkering | Leads | Klient; bare koblede bulkhandlinger persisterer | Permission per handling | Hybrid | `LeadsView.swift` |
| LEAD-09 | Nytt lead | Leads/Kart | Server i live | Lead write | Aktiv · betinget | `LeadsAddLeadSheet.swift`, `lead-map-routes.ts` |
| LEAD-10 | Visittkortskanning | Leads/Leadbook | Enhet → leadutkast | Kamera/Vision; lagring krever API | Aktiv · betinget | `BusinessCardScanner.swift`, `BusinessCardScannerView.swift` |
| LEAD-11 | CSV/Excel preview | Web `/import` | Server | `leads.import_csv` | Aktiv · betinget | `leadgrid-import-routes.ts`, `leadgrid-import.tsx` |
| LEAD-12 | CSV/Excel commit og batchhistorikk | Web `/import` | Server | `leads.import_csv` | Aktiv · betinget | `leadgrid-import-routes.ts` |
| LEAD-13 | Enkelt URL Research | Import/Verktøy | Server/AI/BRREG/web | `leads.import_url` | Aktiv · betinget | `leadgrid-url-research-routes.ts` |
| LEAD-14 | Bulk URL Research | Import/Verktøy | Server/worker | `leads.import_url` | Aktiv · betinget | `leadgrid-url-batch-processor.ts` |
| LEAD-15 | Retry/cancel/commit-all | Bulk URL | Server | Importpermission | Aktiv · betinget | `LeadgridBulkUrl*`, `leadgrid-url-research-routes.ts` |
| LEAD-16 | Lead-detaljer | Leads/Kart/Verktøy | Server | Lead view | Aktiv | `LeadgridCustomerDetailView.swift`, `LeadDetailFullSheet.swift` |
| LEAD-17 | Detaljfanen Aktivitet i native Leads | Lead-sidepanel | Demo; tom live uten egen feedbinding | Demo | Demo/prototype i denne flaten | `LeadsData.activities` |
| LEAD-18 | Lead-notater i native Leads | Detalj > Notater | `UserDefaults` per enhet | Innlogget lokalt | Hybrid · lokal-only | `LeadLocalNotes` i `LeadsView.swift` |
| LEAD-19 | Filer i native lead-detalj | Detalj > Filer | Demo uten komplett upload/download | Demo | Demo/prototype | `LeadsData.files`, `UploadFileSheet.swift` |
| LEAD-20 | Statusendring | Lead-detalj/meny | Server | Statuspermission | Aktiv · betinget | `LeadgridStatusChangerView.swift`, `lead-status-routes.ts` |
| LEAD-21 | Vunnet med beløp/recurring/notat | Statusflyt | Server | Statuspermission | Aktiv · betinget | `LeadStatusChanger.tsx`, `lead-status-routes.ts` |
| LEAD-22 | Tapt med årsak | Statusflyt | Server | Statuspermission | Aktiv · betinget | Samme som LEAD-21 |
| LEAD-23 | Statushistorikk | Lead-detalj | Server | Lead view | Aktiv | `LeadgridStatusHistoryView.swift`, `lead-status-routes.ts` |
| LEAD-24 | Hierarkisk tildeling | Lead-detalj | Server | Leder/assignment permission | Aktiv · betinget | `LeadgridAssignSheet.swift`, `lead-assignment-routes.ts` |
| LEAD-25 | Mine tildelte leads | Verktøy > CRM | Server | Innlogget | Aktiv | `LeadgridLeadInboxView.swift`, `lead-assignment-routes.ts` |
| LEAD-26 | Markert som sett | Lead-detalj/inbox | Server | Mottaker | Aktiv | `lead-assignment-routes.ts` |
| LEAD-27 | Assignment-status og historikk | Lead-detalj | Server | Lead/team view | Aktiv · betinget | `LeadgridAssignmentStatusView.swift`, `LeadgridAssignmentHistoryView.swift` |
| LEAD-28 | Neste oppfølging | Lead-/møteflyter | Server i koblede fagsheets; globalt headerark er lokalt varsel | Lead write | Hybrid | `MoteOppfolging.swift`, `NewFollowUpSheet.swift`, `lead-map-followup-cron.ts` |
| LEAD-29 | Snooze-hurtighandlinger | Enkelte native oppfølgingsflater | Ingen komplett API | — | Demo/prototype/utelatt | `FollowUpDetailSheet.swift` |
| LEAD-30 | Stille leads | Widget/eldre Mer | Server/snapshot | Lead view | Aktiv; eldre inngang legacy | `StaleLeadsList.swift`, `LeadMapWidget.swift` |
| LEAD-31 | Opprett og send tilbud | Lead-detalj | Server + e-post/PDF | Lead/proposal write | Aktiv · betinget | `APIClient+Proposals.swift`, `leadgrid-proposals-routes.ts` |
| LEAD-32 | Offentlig tilbudslenke/open tracking | `/p/:token` | Server | Token | Offentlig flate | `leadgrid-proposals-routes.ts` |
| LEAD-33 | Deal-beløp, sannsynlighet og sluttdato | Deals/lead-detalj | Server | `deals.edit/view_amount` | Aktiv · betinget | `leadgrid-deals-routes.ts`, `LeadgridDealSection.swift` |
| LEAD-34 | Weighted forecast og at-risk | Deals/Verktøy | Server | `deals.view_forecast` | Aktiv · betinget | `leadgrid-deals-service.ts` |
| LEAD-35 | Pipeline-kanban native | Verktøy | Server | Pipeline/lead view | Aktiv · betinget | `LeadgridPipelineKanbanView.swift` |
| LEAD-36 | Web deals-kolonner | `/deals` | Server | Innlogget org | Hybrid; ingen drag/drop | `pages/leadgrid-deals.tsx` |
| LEAD-37 | Lead-eksport CSV | Leads/Verktøy/web | Server + share/download | Exportpermission | Aktiv · betinget | `LeadgridExportShareView.swift`, `lead-export-routes.ts` |
| LEAD-38 | Lead-eksport PDF | Web/API | Server | Exportpermission | Aktiv · betinget | `lead-export-routes.ts` |
| LEAD-39 | Per-lead research | Lead/Verktøy | Server/AI | `lead_research.run` | Aktiv · betinget | `LeadgridResearchView.swift`, `leadgrid-research-routes.ts` |
| LEAD-40 | Full intelligence-rapport | Lead-detalj | Server/agentbro | Researchpermission | Aktiv · betinget | `LeadgridFullIntelligenceSheet.swift`, `leadgrid-agent-bridge-routes.ts` |
| LEAD-41 | Voice memo/møtenotat | Lead-detalj | Server/Whisper/AI | `meeting_notes.*` | Aktiv · betinget | `LeadgridVoiceMemoSheet.swift`, `leadgrid-meeting-notes-routes.ts` |
| LEAD-42 | Lead inbox for innkommende leads | Web superadmin/Verktøy | Server | Superadmin/assignment | Aktiv · betinget | `LeadInboxSection.tsx`, `lead-acceptance-routes.ts` |
| LEAD-43 | Aksepter som prosjekt og tildel | Lead inbox | Server | Superadmin/permission | Aktiv · betinget | `lead-acceptance-routes.ts` |
| LEAD-44 | Arkivering | Lead-menyer der backend-ID finnes | Server når koblet | Lead write | Aktiv · betinget | `LeadsView.swift`, Lead Map API |
| LEAD-45 | Slett lead fra native detalj | Ikke eksponert | Ingen | — | Bevisst ikke implementert | `LeadsView.swift` |
| LEAD-46 | Import-preview-token | Webimport | Prosesslokal Map, 15 min | Samme serverinstans | Hybrid; tapes ved restart/annen instans | `leadgrid-import-routes.ts` |
| LEAD-47 | Import commit/rollback | Webimport | Sekvensielle inserts uten samlet transaction | Importpermission | Hybrid; delvis import mulig, rollback mangler | `leadgrid-import-routes.ts` |
| LEAD-48 | Importerte ekstrafelt | Webimport | Mapping viser flere felt enn `insertLead` lagrer | Importpermission | Hybrid; notes/social/industry m.fl. kan bare ligge i rå-JSON | `leadgrid-import-routes.ts` |

## E. Møter, forberedelse og etterarbeid

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| MEET-01 | Møtehovedfane | Møter | Server i live; demo fallback | Innlogget | Aktiv | `Views/Tabs/Moeter/MeetingsView.swift` |
| MEET-02 | Kalender og agenda/dag/uke/måned | Møter | Server/datoer | Møtetilgang | Aktiv | `CalendarViews.swift`, `MeetingsView.swift` |
| MEET-03 | Kommende møter | Møter/Oversikt/widget | Server + snapshot | Møtetilgang | Aktiv | `UpcomingMeetingsSheets.swift`, `WidgetSnapshot.swift` |
| MEET-04 | «Book/planlegg møte»-ark | Møter/kart | Ingen write; dismiss-only | — | Demo/prototype | `BookMeetingSheet.swift`, `ScheduleMeetingSheet.swift` |
| MEET-05 | Møtedetalj og menyhandlinger | Møter | Lesing live; flere menyark dismiss-only | Meeting view | Hybrid | `MeetingSheets.swift`, `MenuActionSheets.swift` |
| MEET-06 | Møteforberedelse | Møter | Server/leadkontekst | Meeting/lead view | Aktiv | `PrepCards.swift` |
| MEET-07 | Pitch pre-meeting brief | Pitch/lead | Server | Pitch permission | Aktiv · betinget | `PitchPreMeetingBriefView.swift`, `pitch-deck-brief-routes.ts` |
| MEET-08 | AI-møtebrief | Møter/lead | Server/AI/BRREG/Doffin/case | `moteBrief` eksplisitt | Aktiv · betinget | `MeetingBriefSheet.swift`, `leadgrid-motebrief-routes.ts` |
| MEET-09 | Naviger til møte | Møter → Kart | Appstate/MapKit | Koordinater | Aktiv · betinget | `LeadMapApp.swift`, `NavigateSheet.swift` |
| MEET-10 | Etter-møte-flyt | Møter | Server for koblede felter | Meeting write | Aktiv · betinget | `EtterMoteSheet.swift` |
| MEET-11 | Møteutfall og neste handling | Etter møte | Server i etter-møte-flyt | Meeting/lead write | Aktiv · betinget | `EtterMoteSheet.swift`, `MoteOppfolging.swift` |
| MEET-12 | Lokal etter-møte-påminnelse | iOS-varsel | Lokal notification | Varseltillatelse | Aktiv · betinget | `NotificationAppDelegate`, møteviews |
| MEET-13 | Smart transkriptanalyse | Besøk/møte/Watch | On-device eller backend | OS/modell/AI | Aktiv · betinget | `TranscriptIntelligence.swift`, tester |
| MEET-14 | Handlings- og datoforslag fra transkript | Etter møte/Watch | AI-resultat; Watch lagrer ikke resultatet | AI tilgjengelig | Hybrid | `SmartTranscriptActionsSheet.swift`, `WatchQuickNoteView.swift` |
| MEET-15 | Lydopptak av kundesamtale | Leadbook/møte | Server/media | `leadbookLydopptak`, compliance fail-closed | Aktiv · strengt betinget | `APIClient+LeadbookRecording.swift`, `leadbook-recording-consent-routes.ts` |
| MEET-16 | Samtykkeversjon og retention | Lydopptak | Server | Compliance bekreftet | Aktiv · strengt betinget | `RecordingConsentView.swift`, GDPR-dokumentet |

## F. Team, områder, KPI og utstyr

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| TEAM-01 | Teamhovedfane | Team/sidebar/Mer | Server i live; demo fallback | Team view | Aktiv | `Views/Tabs/Team/TeamView.swift` |
| TEAM-02 | Medlemsliste | Team | Server | Org/team view | Aktiv | `TeamLiveData.swift`, `leadgrid-sales-teams-routes.ts` |
| TEAM-03 | Teamstruktur | Team | Server | Leder/admin | Aktiv · betinget | `APIClient+SalesTeams.swift`, `leadgrid-sales-teams-routes.ts` |
| TEAM-04 | Send oppdrag/lead til medlem | Team/lead | Server | Assignmentpermission | Aktiv · betinget | `AssignToTeamMemberSheet`, `leadgrid-sales-teams-routes.ts` |
| TEAM-05 | Inviter selger fra native Team | Team | Ingen; toast-only | — | Demo/prototype | `TeamCards.swift` |
| TEAM-06 | Område-/territorietildeling | Team | Server | `territories.manage` | Aktiv · betinget | `AssignAreaSheet.swift`, `leadgrid-territory-routes.ts` |
| TEAM-07 | Tettstedstildeling | Team | Server/SSB | `omradeTildeling` | Aktiv · betinget | `AssignAreaSheet.swift` |
| TEAM-08 | Områdefilterknapp | Team | Ingen; toast-only | — | Demo/prototype | `AssignAreaSheet.swift` |
| TEAM-09 | Pipeline per medlem/team | Team | Server | Team/lead view | Aktiv | `TeamLiveData.swift` |
| TEAM-10 | Aktivitetsoversikt | Team | Server | Team view | Aktiv | `TeamLiveData.swift` |
| TEAM-11 | Team-KPI-er | Team | Live basis; enkelte avledede mockformler | Team view | Hybrid | `TeamKPIDetail.swift` |
| TEAM-12 | Egendefinert KPI | Team | Opprett-arket lukker uten write | `teamCustomDashboard`/leder | Demo/prototype | `CreateCustomKPISheet.swift` |
| TEAM-13 | AI-foreslå KPI-formel | Team | Toast; ingen AI-write | `teamAIFormulaSuggest` | Demo/prototype | `CreateCustomKPISheet.swift` |
| TEAM-14 | Sett KPI-mål/alert/ukerapport | Team KPI | Ingen varig lagring | Leder | Demo/prototype | `TeamKPIDetail.swift` |
| TEAM-15 | CSV-eksport fra Team | Team | Tom default-handler med suksessfeedback | `teamExportCSV` | Demo/prototype | `TeamStubActions.swift` |
| TEAM-16 | PDF-eksport fra Team | Team | Ikke bekreftet write i native Team | `teamExportPDF` | Demo/prototype | `TeamStubActions.swift` |
| TEAM-17 | Excel-import fra Team | Team | Tom default-handler | `teamImportExcel` | Demo/prototype | `TeamStubActions.swift` |
| TEAM-18 | Del/send rapport | Team | Tom default-handler | `teamShareReport` | Demo/prototype | `TeamStubActions.swift` |
| TEAM-19 | Marker alle lest | Team | Tom default-handler | `teamMarkAllRead` | Demo/prototype | `TeamStubActions.swift` |
| TEAM-20 | Sammenlign forrige periode | Team | Tom default-handler | `teamCompareToPrevious` | Demo/prototype | `TeamStubActions.swift` |
| TEAM-21 | Forecast 30 dager | Team | Tom default-handler i denne flaten | `teamForecast30d` | Demo/prototype | `TeamStubActions.swift` |
| TEAM-22 | Pipelinehelse-rapport | Team | Tom default-handler i denne flaten | `teamPipelineHealth` | Demo/prototype | `TeamStubActions.swift` |
| TEAM-23 | Tilpass dashboard | Team | Tom default-handler | `teamCustomDashboard` | Demo/prototype | `TeamStubActions.swift` |
| TEAM-24 | Rute-adherence dashboard | Team | Server | `routeAdherenceReports` | Aktiv · betinget | `RouteAdherenceDashboardView.swift`, `routes-adherence-routes.ts` |
| TEAM-25 | Teamkart/live lokasjon | Team | Delvis live, mockfallback | Lokasjon/team gate | Hybrid | `TeamOnMap.swift` |
| TEAM-26 | Team i nærheten | Kart/Team | Serverrute + klientfallback | `teamNearbyView` | Hybrid | `routes-adherence-routes.ts`, `TeamOnMap.swift` |
| TEAM-27 | Workload og kvote | Lead Map/Team | Server | Leder/rep | Aktiv · betinget | `lead-map-workload-routes.ts` |
| TEAM-28 | Leaderboard | Team/Lead Map | Server | Team view | Aktiv · betinget | `LeaderboardView.swift`, `lead-map-leaderboard-routes.ts` |
| TEAM-29 | Forfremmelseswizard | Admin/Lead Map | Servertransaction + audit | Leder/admin | Aktiv · betinget | `LeadMapPromoteDialog.tsx`, `lead-map-promotion-routes.ts` |
| TEAM-30 | Per-medlem rolle/override i native | Tilganger | Medlemmer live; roller defaultes og edits er preview | Leder/admin | Hybrid | `TeamAccessControl.swift` |
| TEAM-31 | Utstyrsregister | Team | Server + audit | `utstyrsregister` | Aktiv · betinget | `UtstyrsregisterSheet.swift`, `leadgrid-equipment-routes.ts` |
| TEAM-32 | Presence/check-in for utstyr | Appaktivering | Server; posisjon bare ved eksisterende fix | Innlogget | Aktiv · betinget | `LeadMapApp.swift`, `leadgrid-equipment-routes.ts` |

## G. Salgsledelse, coaching, provisjon og godkjenning

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| MGR-01 | Salgsledelse-suite | Sidebar/Mer/Oversikt | Blandet live og statisk | `admin`/`salgssjef` | Hybrid | `SalgsledelseView.swift` |
| MGR-02 | Provisjonsmodeller | Salgsledelse | Server | Leder/admin | Aktiv · betinget | `APIClient+SalesLeadership.swift`, `sales-leadership-routes.ts` |
| MGR-03 | Konkurranser og maler | Salgsledelse | Server | Leder/admin | Aktiv · betinget | `sales-leadership-routes.ts` |
| MGR-04 | Premiekatalog | Salgsledelse | Server | Leder/admin | Aktiv · betinget | `sales-leadership-routes.ts` |
| MGR-05 | Fulfillment | Salgsledelse | Server | Leder/admin | Aktiv · betinget | `sales-leadership-routes.ts` |
| MGR-06 | Godkjenningskø for deal/rabatt | Salgssjef-cockpit | Server | Leder/admin | Aktiv · betinget | `SalgssjefCockpit.swift`, `leadgrid-cockpit-routes.ts` |
| MGR-07 | Coaching 1-til-1 | Salgssjef-cockpit | Server | Leder/admin | Aktiv · betinget | `SalgssjefCockpit.swift`, `leadgrid-cockpit-routes.ts` |
| MGR-08 | Kjøregodtgjørelse – innsendt krav | Go/Salgsledelse | Server | Selger | Aktiv · betinget | `APIClient+LeadgridMileage.swift`, `leadgrid-mileage-approval-routes.ts` |
| MGR-09 | Godkjenn/eksporter kjøregodtgjørelse | Salgsledelse | Server/export | Salgssjef/admin | Aktiv · betinget | `leadgrid-mileage-approval-routes.ts` |
| MGR-10 | Pipelineforecast p10/p50/p90 | Verktøy/Salgsledelse | Server/cache/AI | `forecasting.view` | Aktiv · betinget | `LeadgridForecastCard.swift`, `leadgrid-forecasting-routes.ts` |
| MGR-11 | NBA-attribusjon | Forecast/analytics | Server | Forecastpermission | Aktiv · betinget | `leadgrid-forecasting-routes.ts` |
| MGR-12 | Salgsleder-topplister/forecastkort | Salgsledelse | Enkelte statiske eller tomme datasett | Leder | Hybrid | `SalgsledelseView.swift`, `SalgssjefCockpit.swift` |
| MGR-13 | Manuell faktura | Superadmin | Server + e-post/PDF | Superadmin | Aktiv · betinget | `APIClient+LeadgridManualInvoice.swift`, `leadgrid-manual-invoice-routes.ts` |
| MGR-14 | Native planvelger i SuperAdmin | Org-detalj | Ingen lagring | Superadmin | Demo/prototype | `Views/Tabs/Leadbook/SuperAdmin.swift` |
| MGR-15 | Entitlement-matrise i SuperAdmin | Org-detalj | Server + audit | Superadmin | Aktiv · betinget | `SuperAdmin.swift`, `superadmin-routes.ts` |

## H. Leadbook, Pondus, Academy og eksempler

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| LB-01 | Leadbook hovedflate | Sidebar/Mer | Blandet live/demo | Leadbook entitlement | Aktiv · betinget | `LeadbookView.swift` |
| LB-02 | Leadbook Oversikt | Underfane | Server/brukstall | `leadbookOversikt` | Aktiv · betinget | `LeadbookCards.swift` |
| LB-03 | Publiserte salgs-/kommunikasjonsmaler | Maler | Server | `leadbookMaler` | Aktiv · betinget | `LeadbookMalerTab.swift`, `pondus-routes.ts` |
| LB-04 | Leder/superadmin malredigering | Maler/SuperAdmin | Server | Leder/admin | Aktiv · betinget | `APIClient+Pondus.swift`, `pondus-routes.ts` |
| LB-05 | Ikke-leder lokal malredigering | Maler | `UserDefaults` på enheten | Ikke-leder | Hybrid · lokal-only | `LeadbookMalerTab.swift` |
| LB-06 | Pondus steg og toneanalyse | Pondus | Servermaler; klientrender | `leadbookPondus` | Aktiv · betinget | `PondusTab.swift`, `PondusStore.swift` |
| LB-07 | Pondus publisering/versjon/rollback | Leder/admin | Server i ny flyt; legacyark lokale | Leder/admin | Hybrid | `APIClient+Pondus.swift`, `PondusTab.swift` |
| LB-08 | «Bruk mal»-tracking | Pondus | Server | Leadbooktilgang | Aktiv | `pondus-routes.ts` |
| LB-09 | Pondus KPI/bruk | Leadbook | Server/aggregat | Leadbook insights | Aktiv · betinget | `pondus-routes.ts` |
| LB-10 | Pondus baseline-quiz | Leadbook | Server | Innlogget/entitlement | Aktiv · betinget | `PondusQuiz.swift`, `leadgrid-pondus-quiz-routes.ts` |
| LB-11 | Leder ser Pondus-profiler | Leadbook/Salgsledelse | Server | Leder/admin | Aktiv · betinget | `leadgrid-pondus-quiz-routes.ts` |
| LB-12 | Academy kurskatalog | Akademi | Server | Academy/Leadbook gate | Aktiv · betinget | `AcademyTab.swift`, `leadgrid-academy-routes.ts` |
| LB-13 | Kursprogresjon | Akademi | Server per bruker | Innlogget | Aktiv | `AcademyLiveStore.swift`, `leadgrid-academy-routes.ts` |
| LB-14 | Kursvideo via signed URL | Akademi | Objektlagring | Mediatilgang | Aktiv · betinget | `APIClient+Academy.swift` |
| LB-15 | Org-eget kursinnhold | Academy admin | Server/media | Org-admin | Aktiv · betinget | `leadgrid-academy-routes.ts` |
| LB-16 | Salgseksempler/case | Eksempler | Server | `leadbookEksempler` | Aktiv · betinget | `LeadbookExamples.swift`, `leadgrid-leadbook-examples-routes.ts` |
| LB-17 | Lederfeedback og dialog | Eksempler | Server | Leder/tilgang | Aktiv · betinget | `leadgrid-leadbook-examples-routes.ts` |
| LB-18 | Visningstall | Eksempler | Server | Eksempeltilgang | Aktiv | `leadgrid-leadbook-examples-routes.ts` |
| LB-19 | Fra Kvalitet til eksempel | Kvalitet/Eksempler | Server | Kvalitet/leder | Aktiv · betinget | `QualityService.swift`, examples-routes |
| LB-20 | AI-strukturering av case | Eksempler | Server/AI | `leadbookAIStrukturering` eksplisitt | Aktiv · betinget | `LeadbookExamples.swift`, entitlement guard |
| LB-21 | Innsikt | Leadbook | Server/aggregater | `leadbookInnsikt` | Aktiv · betinget | `LeadbookInsights.swift` |
| LB-22 | Eksporter/del Leadbook-ytelse | Ytelse-dialog | Tomme closures | Export/share-keys | Demo/prototype | `LeadbookCards.swift` |
| LB-23 | Leadbook KPI sett mål/varsel/rapport | KPI-detalj | Toast/dismiss-only | Leder | Demo/prototype | `LeadbookCards.swift` |
| LB-24 | Leadbook-intern kortskanner | Leadbook | OCR lokalt; «Lagre lead» toast-only | Kamera | Demo/prototype | `Views/Tabs/Leadbook/BusinessCardScanner.swift` |
| LB-25 | Lydopptak compliance-gate | Leadbook | Server | `leadbookLydopptak`, fail-closed | Aktiv · strengt betinget | `RecordingConsentView.swift`, `leadbook-recording-consent-routes.ts` |
| LB-26 | Live transkripsjon | Leadbook | On-device/backend | Lydopptak + mic/speech | Aktiv · strengt betinget | `LiveTranscription.swift`, `VoiceTranscriber.swift` |
| LB-27 | Anonymisering | Eksempel/opptak | On-device/serverprosess | Compliance | Aktiv · betinget | `LeadbookAnonymizer.swift` |
| LB-28 | Opptaksretention og sletting | Backend/cron | Server/media | Compliance | Aktiv · betinget | recording consent/service routes |
| LB-29 | Watch Pondus-lynkort | Watch | iPhone-snapshot + Watch-local | Paret iPhone/entitlement | Aktiv · betinget | `LeadgridWatchApp/.../PondusLynkortView.swift` |
| LB-30 | Pondus ecosystem-mock i hovedappen | Leadbook | Ingen plattformkobling | — | Demo/prototype | `PondusEcosystem.swift` |
| LB-31 | visionOS Pondus-vindu/spatial coach | Separat Vision-app | To seedmaler, session-only | Ingen auth/gate | Demo/prototype | `LeadgridVisionApp/` |

## I. Leadgrid Go, kjøretøy og kjøregodtgjørelse

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| GO-01 | Leadgrid Go dashboard | Sidebar/Mer | Lokal + server | `leadgridGoKjorebok` | Aktiv · betinget | `LeadgridGoDashboardView.swift` |
| GO-02 | Automatisk turdeteksjon | Bakgrunn/native | Lokal først | `leadgridGoAuto`, lokasjon/motion/samtykke | Aktiv · betinget | `TripDetector.swift` |
| GO-03 | Manuell tur | Kjørebok | Lokal + sync | Go gate | Aktiv · betinget | `KjorebokView.swift`, `TripLog.swift` |
| GO-04 | Turformål og redigering | Kjørebok | Lokal/server ved sync | Eier av tur | Aktiv · betinget | `TripService.swift` |
| GO-05 | Turhistorikk | Kjørebok | Lokal + server | Eier av tur | Aktiv · betinget | `leadgrid-trips-routes.ts` |
| GO-06 | Auto-tur bakgrunnssync | Bakgrunn | Lagrer lokalt til Kjørebok åpner bulk-sync | Go gate | Hybrid | `TripDetector.swift`, `KjorebokView.swift` |
| GO-07 | Enkeltur push etter navigasjon | Kart/kjørebok | Server | Nett/Go gate | Aktiv · betinget | `TripService.swift` |
| GO-08 | PDF-kjørebok | Native | Lokal PDF | Go gate | Aktiv · betinget | `KjorebokPDF.swift` |
| GO-09 | CSV/Skatteetaten-eksport | Go | Server/export | Go gate | Aktiv · betinget | `leadgrid-trips-routes.ts` |
| GO-10 | Min bil/kjøretøyprofil | Go/Kart | Ekstern kjøretøydata | API-nøkkel/reg.nr. | Aktiv · betinget | `VehicleProfileSheet.swift`, `leadgrid-vehicle-routes.ts` |
| GO-11 | Kjøretøybooking/fleet | Go | Server | Admin/salgssjef | Aktiv · betinget | `VehicleBookingView.swift`, Go API |
| GO-12 | Teamdashboard | Go | Server | `leadgridGoDashboard` + leder | Aktiv · betinget | `LeadgridGoDashboardView.swift` |
| GO-13 | Kjøregodtgjørelseskrav | Go/Salgsledelse | Server | Selger | Aktiv · betinget | `leadgrid-mileage-approval-routes.ts` |
| GO-14 | Bom/fart/parkering i turkontekst | Go/Kart | Eksterne offentlige tjenester | Nett/konfig | Aktiv · betinget | `NvdbService.swift`, `ParkingService.swift` |

## J. Kvalitet

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| QA-01 | Kvalitetshovedflate | Sidebar/Mer | Server; eksplisitt in-memory-demo | `leadgridKvalitet` | Aktiv · betinget | `KvalitetView.swift` |
| QA-02 | Verifiseringskø for vunnet salg | Kvalitet | Server | Kvalitet/admin/salgssjef | Aktiv · betinget | `QualityService.swift`, `leadgrid-quality-routes.ts` |
| QA-03 | Samtalemal/sjekkliste | Kvalitet | Server | Kvalitetsrolle | Aktiv · betinget | `KvalitetView.swift` |
| QA-04 | Verdikt/godkjenn/avvis | Kvalitet | Server | Kvalitetsrolle | Aktiv · betinget | `leadgrid-quality-routes.ts` |
| QA-05 | Send til oppfølging | Kvalitet | Server | Kvalitetsrolle | Aktiv · betinget | `leadgrid-quality-routes.ts` |
| QA-06 | Flagge til Leadbook-eksempel | Kvalitet | Server | Kvalitetsrolle/Leadbook | Aktiv · betinget | `QualityService.swift` |
| QA-07 | Administrere kvalitetsmaler | Kvalitet | Server | Admin/kvalitet | Aktiv · betinget | `leadgrid-quality-routes.ts` |

## K. Anbud, Doffin og CPV

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| BID-01 | Anbud-hovedflate | Sidebar/Mer | Server; demo mulig | `leadgridAnbud` | Aktiv · betinget | `AnbudView.swift` |
| BID-02 | Doffin-søk | Anbud | Ekstern/server | Anbud gate | Aktiv · betinget | `APIClient+Doffin.swift`, `leadgrid-doffin-routes.ts` |
| BID-03 | Filter og anbudsdetalj | Anbud | Server | Anbud gate | Aktiv · betinget | `AnbudView.swift` |
| BID-04 | CPV-katalog | Anbud | Server | Anbud gate | Aktiv · betinget | `leadgrid-cpv-routes.ts` |
| BID-05 | Overvåkning | Anbud | Server | Anbud gate | Aktiv · betinget | `leadgrid-doffin-routes.ts` |
| BID-06 | AI-score/sammendrag | Anbud | Server/AI | Anbud + AI | Aktiv · betinget | `AnbudView.swift` |
| BID-07 | AI-utkast | Anbud | Server/AI | Anbud + AI | Aktiv · betinget | `AnbudView.swift` |
| BID-08 | Pipeline/tildeling | Anbud | Server | Leder/permission | Aktiv · betinget | `leadgrid-doffin-routes.ts` |
| BID-09 | Oppdragsgiver til CRM-lead | Anbud | Server | Lead write | Aktiv · betinget | `leadgrid-doffin-routes.ts` |
| BID-10 | Doffin-signal i møtebrief | Møter | Server/AI | `moteBrief` | Aktiv · betinget | `leadgrid-motebrief-routes.ts` |

## L. Canvas

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| CAN-01 | Canvas-hovedflate | Sidebar/Mer | Server + lokal editorstate | `leadgridCanvas` | Aktiv · betinget | `CanvasView.swift`, `APIClient+Canvas.swift` |
| CAN-02 | Ark, mapper og dokumenter | Canvas | Server | Canvas gate | Aktiv · betinget | `CanvasArk.swift`, `leadgrid-canvas-routes.ts` |
| CAN-03 | PencilKit/håndskrift | Canvas | Lokal redigering + serverlagring | Canvas gate | Aktiv · betinget | `CanvasView.swift` |
| CAN-04 | Tekst, stempler, figurer og noder | Canvas | Serverdokument | Canvas gate | Aktiv · betinget | `CanvasKomponenter.swift` |
| CAN-05 | Flere sider | Canvas | Server | Canvas gate | Aktiv · betinget | `CanvasModeller.swift` |
| CAN-06 | Bilder | Canvas | Server/media | `canvasBilder` | Aktiv · betinget | `APIClient+Canvas.swift` |
| CAN-07 | PDF-annotering | Canvas | Server/media | `canvasPdf` | Aktiv · betinget | Canvas-kilder |
| CAN-08 | Levende CRM/KPI/kart-kort | Canvas | Server | `canvasLiveKort` | Aktiv · betinget | Canvas stores/API |
| CAN-09 | Elementbibliotek | Canvas | Server | `canvasBibliotek` | Aktiv · betinget | Canvas-kilder |
| CAN-10 | Teamdeling/samarbeid | Canvas | Server/realtime | `canvasDeling` | Aktiv · betinget | `CanvasRealtime.swift`, `leadgrid-canvas-routes.ts` |
| CAN-11 | Historikk/tidsreise | Canvas | Server | `canvasTidsreise` | Aktiv · betinget | Canvas API |
| CAN-12 | Papirkurv/gjenoppretting | Canvas | Server | Canvas write | Aktiv · betinget | `leadgrid-canvas-routes.ts` |
| CAN-13 | Kundeminne | Canvas | Server | `canvasKundeminne` | Aktiv · betinget | Canvas API |
| CAN-14 | AI-analyse av håndskrift | Canvas | Server/AI | `canvasAnalyse` eller `moteBrief` | Aktiv · betinget | `CanvasIntelligence.swift`, entitlement guard |
| CAN-15 | Runtime-verifisering av komplett editor | Canvas | Statisk kildebevis, ikke E2E | — | Krever verifisering | Ingen dedikert Canvas-E2E |

## M. Research, intelligence, analyse og rapporter

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| INT-01 | Per-lead researchliste | Verktøy | Server | Researchpermission | Aktiv · betinget | `LeadgridResearchListView.swift` |
| INT-02 | Research-kjøring/progresjon/resultat | Lead/Verktøy | Server/AI/BRREG/web | `lead_research.run` | Aktiv · betinget | `leadgrid-research-routes.ts` |
| INT-03 | Market Scan-liste og skjema | Verktøy | Server/AI/Places/BRREG | `leadgrid.market_scan.run` | Aktiv · betinget | `LeadgridMarketScan*.swift` |
| INT-04 | Auto-opprett leads/pins fra scan | Market Scan | Server | Lead write/scan permission | Aktiv · betinget | `leadgrid-market-scan-routes.ts` |
| INT-05 | Prosjektbasert lead discovery | Prosjekt/Backend | Server/worker | `lead_research.run` | Backend/API | `leadgrid-project-lead-discovery-routes.ts` |
| INT-06 | Kontinuerlig discovery-konfig | Backend/native modeller | Server/cron | Prosjekt/permission | Backend/API | `leadgrid-discovery-config-routes.ts` |
| INT-07 | Kontinuerlig discovery-worker | Server | Server/cron | Aktiv config | Backend/API | `leadgrid-continuous-discovery.ts` |
| INT-08 | Bransjekatalog | Innstillinger/backend | Server | `industries.view/manage` | Aktiv · betinget | `IndustryManagementView.swift`, `leadgrid-industries-routes.ts` |
| INT-09 | Selgers bransjespesialisering | Team/innstillinger | Server | `industries.assign` | Aktiv · betinget | `leadgrid-industries-routes.ts` |
| INT-10 | Composite lead score | Lead/Verktøy | Server | Intelligencepermission | Aktiv · betinget | `leadgrid-intelligence-routes.ts` |
| INT-11 | Next Best Action-kø | Verktøy/Oversikt | Server | Intelligencepermission | Aktiv · betinget | `LeadgridAllRecommendationsView.swift` |
| INT-12 | NBA accept/dismiss/execute offline | Native | Lokal kø → server | Støttet NBA-action | Aktiv for disse handlingene | `OfflineResilientActions.swift` |
| INT-13 | Analytics overview | Verktøy/web | Server | `analytics.view_overview` | Aktiv · betinget | `LeadgridAnalyticsDashboardView.swift`, analytics-routes |
| INT-14 | Kanal-/kildeanalyse | Analytics | Server | Channels/sources permission | Aktiv · betinget | `leadgrid-analytics-routes.ts` |
| INT-15 | Segment-/territorieanalyse | Analytics | Server | Segment/territory permission | Aktiv · betinget | `leadgrid-analytics-routes.ts` |
| INT-16 | Velocity og konverteringsfunnel | Analytics | Server | Analyticspermission | Aktiv · betinget | `leadgrid-analytics-routes.ts` |
| INT-17 | Won/lost-dashboard | Verktøy/Admin Room | Server | Lead/analytics view | Aktiv · betinget | `LeadgridWonLostDashboardView.swift`, `WonLostDashboard.tsx` |
| INT-18 | AI-bruk og kost | Verktøy/Superadmin | Servertabell, men sentral tracker har ingen kallesteder | `billing.view_ai_usage` | Hybrid; dashboard kan være tomt | `LeadgridAIUsageView.swift`, `leadgrid-ai-usage-tracker.ts` |
| INT-19 | Agent-chat | Native verktøy | Role Room agent backend | Agent/AI entitlement | Aktiv · betinget | `LeadgridAgentChatView.swift`, agent-thread routes |
| INT-20 | Full agentbro-intelligence | Lead | Server/AI-tjenester | Researchpermission | Aktiv · betinget | `leadgrid-agent-bridge-routes.ts` |
| INT-21 | Lead Scout needs/signals | Lead Map | Server/crawl/AI | Scoutpermissions | Aktiv · betinget | `lead-scout-routes.ts` |
| INT-22 | Presets og custom fields | Lead Map | Server | Admin/permission | Aktiv · betinget | `lead-preset-routes.ts` |
| INT-23 | IF/THEN leadregler | Lead Map | Server/engine/audit | Rule permission | Aktiv · betinget | `lead-rules-routes.ts` |
| INT-24 | Prosjektportefølje | Legacy Mer/Lead Map | Server | `leads.view` | Legacy inngang; server aktiv | `ProjectsPortfolioView.swift`, `lead-portfolio-routes.ts` |
| INT-25 | Pitch Deck Studio | Profil/Lead Map med permission | Server/AI/media/PDF | `pitch_deck.*` | Aktiv · betinget | `PitchDeckStudioView.swift`, pitch-deck routes |
| INT-26 | Brand Kit | Admin Room/Market Intelligence | Server/webanalyse | Permission/admin shell | Aktiv · betinget | `brand-kit-routes.ts` |
| INT-27 | Markedskampanje fra Lead Map | Admin Room | Server | Campaignpermission | Aktiv · betinget | `lead-map-campaign-routes.ts` |
| INT-28 | Planlagte rapporter | Verktøy/Admin Room | Server/cron/e-post | Report permission | Aktiv · betinget | `LeadgridScheduledReportsView.swift`, scheduled-routes |
| INT-29 | Send rapport nå | Rapportpanel | Server/e-post | Report permission | Aktiv · betinget | scheduled-routes |

## N. Varsler, kanaler, workflows og integrasjoner

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| AUTO-01 | Leadgrid varselinnboks | Header/Verktøy/Role Room dashboard | Server | Innlogget | Aktiv | `LeadgridNotificationInboxView`, notification routes |
| AUTO-02 | Ulest-badge | Tabs/header | Appstate/server | Innlogget | Aktiv | `AppState.swift` |
| AUTO-03 | Marker varsler lest | Innboks | Server | Innlogget | Aktiv | notification routes |
| AUTO-04 | Varselpreferanser | Verktøy | Server | Innlogget | Aktiv | `LeadgridNotificationPrefsView.swift` |
| AUTO-05 | Push deep-linking | APNs-tap | Lokal routing/serverpayload | Varseltillatelse | Aktiv · betinget | `NotificationAppDelegate` |
| AUTO-06 | E-postbranding per org | Superadmin/web | Server | Org/admin | Aktiv · betinget | `EmailBrandingTab.tsx`, branding-routes |
| AUTO-07 | Delt WhatsApp-avsender | Kanalonboarding | Server/Meta | Org/admin + provider | Aktiv · betinget | `customer-onboarding.md`, channel routes |
| AUTO-08 | Egen WABA | Kanalonboarding | Server/Meta | Org/admin + credentials | Aktiv · betinget | `NotificationChannelsOnboardingWizard` native, channel routes |
| AUTO-09 | WhatsApp-maladministrasjon | Superadmin | Server/Meta | Superadmin | Aktiv · betinget | `WhatsAppTemplatesTab.tsx`, WA routes |
| AUTO-10 | Native kanal-onboarding | Verktøy | Server | Org/admin | Aktiv · betinget | `LeadgridChannelOnboardingWizardView.swift` |
| AUTO-11 | Web kanal-onboarding-komponent | Umontert | Serverkomponent finnes | — | Legacy/ikke nåbar | `NotificationChannelsOnboardingWizard.tsx` |
| AUTO-12 | Workflow-liste og builder | Web `/workflows`, native legacy inngang | Server | `workflows.view/create` | Hybrid | `leadgrid-workflows.tsx`, `LeadgridWorkflowsView.swift` |
| AUTO-13 | Workflow-triggers | Builder/backend | Server | Workflowpermission | Aktiv · betinget | `leadgrid-workflow-types.ts` |
| AUTO-14 | Workflow-actions | Builder/backend | Blandet reelle og deferred handlinger | `workflows.execute` | Hybrid | workflow engine/routes |
| AUTO-15 | Workflow conditions | Backend | Server | Workflowpermission | Backend/API; web sender tom liste | workflow engine, `leadgrid-workflows.tsx` |
| AUTO-16 | Manuell workflow-run | Backend/native | Server | `workflows.execute` | Backend/API; ingen web execute-knapp | workflow routes |
| AUTO-17 | Rediger eksisterende workflow i web | `/workflows` | Begrenset UI | Workflowpermission | Hybrid; activate/delete, ikke full edit | `leadgrid-workflows.tsx` |
| AUTO-18 | Wait/resume-action | Server | Worker/DB | Aktiv workflow | Aktiv backend | `workflow-resume-cron.ts` |
| AUTO-19 | Webhook destinations | `/workflows/webhooks` | Server | Workflow/integration permission | Aktiv · betinget | `leadgrid-workflow-webhooks.tsx` |
| AUTO-20 | Webhook secret rotation/grace | Admin/API | Server/cron | API-key/webhook admin | Aktiv · betinget | `leadgrid-webhook-rotation-routes.ts` |
| AUTO-21 | Public API v1 | `/api/v1/*` | Server | `lgk_` API-nøkkel | Aktiv · betinget | `leadgrid-public-api-v1.ts` |
| AUTO-22 | API key-management | Superadmin/API | Server | `api_keys.*` | Aktiv · betinget | `leadgrid-api-key-mgmt-routes.ts` |
| AUTO-23 | OpenAPI 3.1/Swagger | `/api/v1/openapi.json`, `/api/v1/docs` | Server | Offentlig docs/policy | Aktiv | `leadgrid-openapi-routes.ts` |
| AUTO-24 | Partner API | `/api/v1/partner/*` | Server | `lg_live_` partnernøkkel | Aktiv · betinget | `partner-api-routes.ts` |
| AUTO-25 | Connector-katalog | Web `/connectors` | Primært statisk | Offentlig | Offentlig flate; claims krever verifisering | `leadgrid-connectors.tsx` |
| AUTO-26 | Dedikert Salesforce/HubSpot/Pipedrive UI | Lenker/claims | Ingen bekreftet webroute | — | Ikke implementert som egen flate | Web router-audit |
| AUTO-27 | SMS/WhatsApp/channel/AI-pitch workflow-actions | Workflow engine | Returnerer `deferred`, utfører ikke leverandørhandling | Workflowpermission | Backend-stub | `leadgrid-workflow-engine.ts` |
| AUTO-28 | `book_meeting` workflow-action | Workflow engine | Lokal møtepost, ingen Google Meet/invitasjon | Workflowpermission | Hybrid | `leadgrid-workflow-engine.ts` |
| AUTO-29 | Workflow event-ingress | Seks eventruter | Body kan publisere org-event uten håndhevet auth/HMAC | Ingen effektiv gate | Aktiv med kritisk sikkerhetsgap | `leadgrid-workflow-triggers-routes.ts` |
| AUTO-30 | Legacy lead rules cron-triggere | Lead rules | Bare manuelt evaluate-kall funnet | Rule permission | Backend/API uten scheduler | `lead-rules-engine.ts` |

## O. Web, offentlige portaler og kommersielle flater

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| WEB-01 | Leadgrid landing | `/` på Leadgrid-host, `/leadgrid` | Dynamisk pris/partnere/testimonials | Offentlig | Offentlig flate | `leadgrid-landing.tsx` |
| WEB-02 | Self-onboarding | «Start gratis» | Server | Offentlig skjema | Offentlig flate | `org-self-onboard-routes.ts` |
| WEB-03 | Demoforespørsel | «Book demo» | Server | Offentlig skjema | Offentlig flate | `leadgrid-demo-request-routes.ts` |
| WEB-04 | «Logg inn»/appventeliste | Landing modal | API-filen er ikke registrert | Offentlig | Hybrid/WIP; ikke innlogging | `leadgrid-landing.tsx`, waitlist-routes |
| WEB-05 | Dynamisk landingpris | Landing | Server config | Offentlig | Aktiv | `leadgrid-pricing-config-routes.ts` |
| WEB-06 | Full prisside | `/priser`, `/pricing` | Hardkodet | Offentlig | Offentlig flate; kan drive fra landing | `leadgrid-pricing.tsx` |
| WEB-07 | Personvern og research-samtykke | `/personvern*` | Statisk | Offentlig | Offentlig flate | privacy pages |
| WEB-08 | Leads-/feltsalgsguider | Offentlige slugs | Statisk | Offentlig | Offentlig flate | guide pages |
| WEB-09 | Akademi og artikler | `/akademi*` | Statisk | Offentlig | Offentlig flate | academy pages |
| WEB-10 | Marketplace | `/marketplace` | Server | Offentlig | Offentlig flate; direct route | `leadgrid-marketplace.tsx` |
| WEB-11 | Utviklerportal | `/utviklere` | Terms/OpenAPI | Offentlig | Offentlig flate | `leadgrid-developers.tsx` |
| WEB-12 | Utviklersøknad | `/utviklere/soknad` | Server | Offentlig skjema | Offentlig flate | developer application routes |
| WEB-13 | Webimport | `/import` | Server | Innlogget org | Aktiv, hovednav | `leadgrid-import.tsx` |
| WEB-14 | Web deals | `/deals` | Server | Innlogget org | Hybrid, deep-link uten felles shell | `leadgrid-deals.tsx` |
| WEB-15 | Web workflows | `/workflows` | Server | Innlogget org | Hybrid, deep-link uten felles shell | `leadgrid-workflows.tsx` |
| WEB-16 | Partner-verifisering | `/innstillinger/partnerskap` | Server | Org-admin | Aktiv · betinget, direct route | `leadgrid-partner-wizard.tsx` |
| WEB-17 | Partnerdashboard | `/partner-dashboard` | Server | Partner/org-admin | Aktiv · betinget | `leadgrid-partner-dashboard.tsx` |
| WEB-18 | Eldre partnersøknad | Ingen aktiv render | Eldre API-kontrakt | — | Legacy/ikke nåbar | `leadgrid-partner-application.tsx` |
| WEB-19 | Klientportal | `/c/{token}` | Server | Offentlig token | Offentlig flate | `leadgrid-client-portal.tsx` |
| WEB-20 | Portalvarselpreferanser | Klientportal | Server | Token | Hybrid; e-post/WA UI, SMS mangler | portal prefs-komponent |
| WEB-21 | Org-invitasjon | `/lead-map/accept` | Server | Invite token/auth | Offentlig/innlogget flate | `LeadMapAccept.tsx` |
| WEB-22 | Lead Map webhovedflate | Admin Room marketing cockpit | Server | Hardkodet Daniel-owner + permissions | Aktiv · betinget; ikke ordinær Leadgrid-app | `LeadMapPanel.tsx`, `AdminRoom.tsx` |
| WEB-23 | Web territorier/leaderboard/My Day | Admin Room Lead Map | Server | Owner-shell + permissions | Aktiv · betinget | Lead Map panels |
| WEB-24 | Web Superadmin | `/superadmin` | Server | `super_admin` | Aktiv · betinget | `leadgrid-superadmin.tsx` |
| WEB-25 | Landing/pris/testimonial-admin | `/admin` Leadgrid-seksjon | Server | Admin | Aktiv · betinget | `LeadgridAdminSection.tsx` |
| WEB-26 | Appventeliste-admin | Admin Workspace Marketing | API uregistrert | Admin | Hybrid/WIP | `LeadgridAppWaitlistTab.tsx` |
| WEB-27 | `/leadgrid/map` | Importens CTA | Ingen route | — | Broken/ikke nåbar | Router-audit |
| WEB-28 | `/leadgrid/api-keys` og `/leadgrid/partners` | Connector-lenker | Ingen routes | — | Broken/ikke nåbar | Router-audit |
| WEB-29 | Connector docs-slugs | `/leadgrid/docs/*` | Ingen routes | — | Broken/ikke nåbar | Router-audit |
| WEB-30 | `/leadgrid/developers` | Footer | Aktiv slug er `/utviklere` | — | Broken lenke | Router-audit |
| WEB-31 | Ukjent Leadgrid-path | Host router | Faller tilbake til landing | Offentlig | Hybrid; skjuler 404/broken links | `casting-main.tsx` |
| WEB-32 | Felles webapp-shell for produktflater | Ikke finnes | — | — | Ikke implementert | Router-audit |

## P. Apple Watch, widgets, Vision og plattformtjenester

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| PLAT-01 | Watch lead-snapshot | Watch Leads | iPhone application context + UserDefaults | Paret iPhone | Aktiv · betinget | Watch `PhoneSession.swift` |
| PLAT-02 | Watch GPS-sortering | Watch Leads | Enhetslokasjon | Watch location permission | Aktiv · betinget | `NearbyLeadsView.swift` |
| PLAT-03 | Watch lead-hurtighandlinger | Watch lead | Køes til iPhone; receiver callback er ikke registrert | Paret iPhone | Hybrid; ingen backend-write | Watch `QuickActionView.swift`, main `WatchSession.swift` |
| PLAT-04 | Watch hurtignotat-analyse | Watch | iPhone on-device/backend analyse | Paret iPhone/AI | Hybrid; resultat lagres ikke | `WatchQuickNoteView.swift` |
| PLAT-05 | Watch Pondus-sync/aktiv mal | Watch | iPhone → Watch cache; valg kan signaliseres tilbake | Paret iPhone/entitlement | Aktiv · betinget | `PondusLynkortView.swift` |
| PLAT-06 | Watch complication | Watch face | Ingen target/source | — | Ikke implementert | Prosjektinventar |
| PLAT-07 | Widget liten/middels/stor | iOS widget | App Group snapshot | Hovedappen må ha synket | Aktiv read-only | `LeadMapWidget.swift` |
| PLAT-08 | Widget deeplink/handling | Widget | Ingen | — | Ikke implementert | `LeadMapWidget.swift` |
| PLAT-09 | Live Activity/Dynamic Island | iPhone | ActivityKit | Aktivt besøk/støttet OS | Aktiv · betinget | `ActiveVisitLiveActivity.swift` |
| PLAT-10 | visionOS Pondus-vindu | Vision app | Seeddata | Ingen auth/org | Demo/prototype | `PondusVisionWindow.swift` |
| PLAT-11 | visionOS spatial coach | ImmersiveSpace | Seed/sessionstate | Ingen auth/org | Demo/prototype | `PondusCoachSpace.swift` |
| PLAT-12 | CaptureApp-integrasjon | Separat app | Ingen delt runtimekobling | — | Ikke implementert | `ipad/CaptureApp/project.yml` |
| PLAT-13 | Mac Catalyst | Samme hovedtarget | Server/cache | Samme auth/gates | Aktiv · betinget | `project.yml`, `MacCatalystAdapters.swift` |
| PLAT-14 | Kortskanner på Mac | Lead scanner | Utilgjengelig-fallback | Catalyst | Ikke tilgjengelig på Mac | `BusinessCardScannerView.swift` |
| PLAT-15 | Widget/appgruppe | iOS | App Group-fil | Signering/entitlement | Aktiv · betinget | `WidgetSnapshot.swift` |
| PLAT-16 | WebSocket org-realtime | Native | Server | Token + org | Aktiv · betinget | `LeadgridRealtimeClient.swift` |
| PLAT-17 | Polling som fallback | Native | Server | Innlogget | Aktiv | `AppState.swift` |
| PLAT-18 | Crashdiagnostikk | Native/MetricKit | Server | Innlogget + MetricKit-leveranse | Aktiv · betinget | `CrashReporterService.swift`, `leadgrid-crash-routes.ts` |
| PLAT-19 | APNs faktisk utsending | Backend | APNs-klient | `APNS_MODE=live` + nøkler | Aktiv · betinget; ellers stub | Lead Map APNs-klient |
| PLAT-20 | Realtime flerinstans | WebSocket | Prosesslokale clients/subscriptions | Én Node-prosess | Hybrid; ingen Redis/pub-sub | `leadgrid-realtime.ts` |
| PLAT-21 | Native API-base | Alle native kall | Hardkodet produksjons-URL | Nett | Aktiv, men miljøbinding | `Core/APIClient.swift` |

## Q. Serverfunksjoner uten direkte sluttbrukerhandling

| ID | Funksjon | Inngang/plattform | Data | Gate | Status | Primærbevis |
|---|---|---|---|---|---|---|
| SYS-01 | Intelligence rescore cron | Cron-endepunkt | Server | Cron-token | Backend/API | `leadgrid-intelligence-cron.ts` |
| SYS-02 | Retention cleanup | Daglig cron | Server | Cron-token | Backend/API | `leadgrid-retention-cron.ts` |
| SYS-03 | Org-ID backfill | Daglig/manuell cron | Server | Cron/admin | Backend/API | `leadgrid-backfill-cron.ts` |
| SYS-04 | URL-batch resume-sweeper | Boot/timeplan | Server | Serverprosess | Backend/API | `leadgrid-url-batch-processor.ts` |
| SYS-05 | Workflow wait-resume | Worker | Server | Serverprosess | Backend/API | workflow resume cron |
| SYS-06 | Follow-up deadline sweep | Cron | Server/varsler | Cron-token | Backend/API | `lead-map-followup-cron.ts` |
| SYS-07 | API overage-metering | Backend/Stripe | Server | Plan/Stripe | Backend/API | `leadgrid-overage-billing.ts` |
| SYS-08 | E-postdrip dag 1/3/7/14 | Cron | Server/e-post | Org/onboarding | Backend/API | `leadgrid-drips-routes.ts` |
| SYS-09 | Webhook event triggerbro | Backendhendelser | Server | Aktiv workflow | Backend/API | `leadgrid-workflow-triggers-routes.ts` |
| SYS-10 | Realtime eventbus | Backend | Server/WebSocket | Org/user channel | Backend/API | `leadgrid-realtime.ts` |
| SYS-11 | Trips månedsrapport | GitHub Action → backend | Server/export | Cron-token | Hybrid; workflow/backend leser ulike tokennavn | trips workflow + `leadgrid-trips-routes.ts` |
| SYS-12 | Re-engagement og webhook-expiry cron | Eksponerte cronruter | Server | Cron-token | Backend/API uten funnet scheduler | cron route-audit |
| SYS-13 | Schema health check | Serverboot | 15 eldre tabell/kolonnechecks | `LEADGRID_STRICT_SCHEMA` valgfri | Hybrid; dekker ikke senere skjema | `leadgrid-schema-check.ts` |
| SYS-14 | Runtime DDL | Canvas/Doffin/Go/Quality m.fl. | CREATE/ALTER ved request/startup | DB-bruker med DDL | Aktiv med reproduksjonsrisiko | respektive routefiler |
| SYS-15 | Public API lead-scope | `/api/v1/leads` | Legacy membership/owner-query | API-key scope | Hybrid; kan utelate leads etter eierskifte | `leadgrid-public-api-v1.ts` |
| SYS-16 | Parking API-duplikat | `/api/leadgrid/parking/*` | Første registrering skygger den andre | Innlogget | Legacy/overlapp; én implementasjon død | `leadgrid-parking-routes.ts`, `leadgrid-parkering-routes.ts` |

## Hvordan bruke katalogen i prioritering

Prioriter i denne rekkefølgen:

1. Synlige **Demo/prototype**-handlinger som gir suksessfeedback uten write.
2. **Hybrid**-data som kan forveksles med delt eller autoritativ kundedata.
3. Broken web-ruter og owner-only shell som blokkerer reelle roller.
4. Klient-only gates uten tilsvarende serverhåndhevelse.
5. Backend/API-funksjoner som er verdifulle, men mangler en tydelig inngang.
6. Manglende ende-til-ende-test for aktive kjerneflyter.
