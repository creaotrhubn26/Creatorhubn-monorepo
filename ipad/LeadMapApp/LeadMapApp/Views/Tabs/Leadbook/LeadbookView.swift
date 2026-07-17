// LeadbookView.swift — pixel-perfect Leadbook-fane fra mockup (2026-06-30)
//
// Daniel ba om at fanen heter Leadbook, ikke Playbook.
// Layout (1366×1024 iPad landscape):
//   Header + dato-picker + "+ Ny mal"-CTA
//   4 KPI-cards: Aktive maler / Bruk i dag / Booket møte-rate / Team-adopsjon
//   Hovedrad: Maler i biblioteket (tabell)  |  Valgt Leadbook (sidebar + steg)
//   Bunnrad: Innvendinger | Ytelse per mal | Godkjenning og versjoner

import SwiftUI

enum LBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.06)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let pink = Color(red: 0.98, green: 0.35, blue: 0.65)
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.45)
}

// MARK: - Models

struct LeadbookTemplate: Identifiable, Hashable {
    /// Mock-rader får tilfeldig UUID; backend-rader (Pondus) får malens
    /// uuid slik at seleksjon overlever re-fetch.
    var id = UUID()
    let name: String
    let channel: Channel
    let step: Int            // current
    let stepTotal: Int       // total
    let used: Int            // brukt
    let conversion: Double   // 0-1
    let status: Status
    /// pondus_templates.id (lowercase uuid-streng). Nil for mock-rader.
    var backendId: String? = nil

    enum Channel: String, CaseIterable, Hashable {
        case field = "Felt"
        case phone = "Telefon"
        case email = "E-post"
        case video = "Video"
        var icon: String {
            switch self {
            case .field: return "person.crop.circle.fill"
            case .phone: return "phone.fill"
            case .email: return "envelope.fill"
            case .video: return "video.fill"
            }
        }
        var color: Color {
            switch self {
            case .field: return LBrand.purpleLight
            case .phone: return LBrand.green
            case .email: return LBrand.blue
            case .video: return LBrand.orange
            }
        }
    }

    enum Status: String, CaseIterable, Hashable {
        case highPerf = "Høy ytelse"
        case active = "Aktiv"
        case underReview = "Under review"
        case draft = "Utkast"
        var color: Color {
            switch self {
            case .highPerf: return LBrand.orange
            case .active: return LBrand.green
            case .underReview: return LBrand.yellow
            case .draft: return LBrand.textSecondary
            }
        }
    }
}

struct LeadbookStep: Identifiable, Hashable {
    let id = UUID()
    let number: Int
    let title: String
}

struct LeadbookContent: Identifiable, Hashable {
    let id = UUID()
    let icon: String
    let iconColor: Color
    let title: String
    let body: String
}

struct Objection: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let response: String
    let icon: String
    let iconColor: Color
}

struct PerformanceRow: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let responseRate: Double
    let conversion: Double
}

struct VersionEntry: Identifiable, Hashable {
    let id = UUID()
    let version: String
    let date: String
    let author: String
    let summary: String
    let status: VersionStatus

    enum VersionStatus: String, Hashable {
        case current = "Gjeldende"
        case approved = "Godkjent"
        case pending = "Venter"
        var color: Color {
            switch self {
            case .current: return LBrand.purple
            case .approved: return LBrand.green
            case .pending: return LBrand.orange
            }
        }
    }
}

// MARK: - Mock data

enum LeadbookData {
    /// Pakke 10.1 — demo-mode-gated
    private static let _templates: [LeadbookTemplate] = [
        LeadbookTemplate(name: "Første kontakt – feltbesøk", channel: .field, step: 1, stepTotal: 4, used: 52, conversion: 0.32, status: .highPerf),
        LeadbookTemplate(name: "Oppfølging etter interesse", channel: .phone, step: 2, stepTotal: 4, used: 38, conversion: 0.26, status: .active),
        LeadbookTemplate(name: "Møtebooking – telefon",       channel: .phone, step: 1, stepTotal: 4, used: 47, conversion: 0.41, status: .highPerf),
        LeadbookTemplate(name: "Tilbudsoppfølging",            channel: .email, step: 3, stepTotal: 4, used: 31, conversion: 0.27, status: .active),
        LeadbookTemplate(name: "Ikke til stede / return",      channel: .field, step: 1, stepTotal: 4, used: 19, conversion: 0.18, status: .underReview),
    ]

    /// Demo PÅ → mock; ellers EKTE Pondus-maler m/ usage-tall fra
    /// LeadbookLiveStore (backenden fantes hele tiden — mig 0355/0364).
    @MainActor static var templates: [LeadbookTemplate] {
        DemoModeManager.isActiveNonisolated ? _templates : LeadbookLiveStore.shared.templates
    }

    /// Krasj-safe fallback for `@State`-init.
    static var firstOrPlaceholder: LeadbookTemplate {
        _templates[0]
    }

    static let steps: [LeadbookStep] = [
        LeadbookStep(number: 1, title: "Åpning"),
        LeadbookStep(number: 2, title: "Behov"),
        LeadbookStep(number: 3, title: "Pitch"),
        LeadbookStep(number: 4, title: "Neste steg"),
    ]

    // Step-spesifikt innhold — 4 steg × innholds-rader
    static let contentByStep: [Int: [LeadbookContent]] = [
        1: [   // Åpning
            LeadbookContent(icon: "target",                   iconColor: LBrand.purpleLight, title: "Formål",
                            body: "Skape kontakt, bygge tillit og avdekke behov."),
            LeadbookContent(icon: "bubble.left.fill",         iconColor: LBrand.blue, title: "Åpningsreplikk",
                            body: "Hei! Jeg heter [navn] og kommer fra [selskap]. Vi hjelper [type kunder] med [hovedverdi]. Har du et par minutter?"),
            LeadbookContent(icon: "questionmark.bubble.fill", iconColor: LBrand.green, title: "Spørsmål å stille",
                            body: "Hva er viktigst for dere når dere velger leverandør?\nHva fungerer bra – og hva kunne vært bedre i dag?"),
            LeadbookContent(icon: "shield.lefthalf.filled",   iconColor: LBrand.orange, title: "Vanlige innvendinger",
                            body: "Vi har allerede leverandør, Det er ikke aktuelt nå,\nSend info på e-post"),
            LeadbookContent(icon: "arrow.right.circle.fill",  iconColor: LBrand.yellow, title: "Neste steg",
                            body: "Avtal neste møte eller sending av relevant informasjon."),
        ],
        2: [   // Behov
            LeadbookContent(icon: "target",                  iconColor: LBrand.purpleLight, title: "Formål",
                            body: "Forstå smerte-punkter, prioriteringer og beslutningskriterier."),
            LeadbookContent(icon: "questionmark.bubble.fill", iconColor: LBrand.green, title: "Åpne spørsmål",
                            body: "Hvordan løser dere [problem] i dag?\nHva fungerer godt — og hva kunne vært bedre?\nHvilke konsekvenser har det at dere ikke løser dette nå?"),
            LeadbookContent(icon: "ear.fill",                iconColor: LBrand.blue,   title: "Aktiv lytting",
                            body: "Speil tilbake: «Hvis jeg forstår deg rett, er hovedutfordringen…». Bekreft før du går videre."),
            LeadbookContent(icon: "magnifyingglass",         iconColor: LBrand.yellow, title: "Avdekk beslutningstakere",
                            body: "Hvem flere er involvert i beslutningen?\nNår vil dere typisk ta en avgjørelse?"),
            LeadbookContent(icon: "arrow.right.circle.fill", iconColor: LBrand.purpleLight, title: "Neste steg",
                            body: "Oppsummér behov høyt → få ja-bekreftelse → introduser løsning."),
        ],
        3: [   // Pitch
            LeadbookContent(icon: "target",                  iconColor: LBrand.purpleLight, title: "Formål",
                            body: "Knytte løsningen direkte til behovene du nettopp avdekket."),
            LeadbookContent(icon: "sparkles",                iconColor: LBrand.pink,   title: "Hovedbudskap",
                            body: "«Basert på det du forteller, er vi bygget akkurat for dere fordi …»\nFokuser 3 konkrete verdier — ikke en feature-liste."),
            LeadbookContent(icon: "star.fill",               iconColor: LBrand.yellow, title: "Sosial proof",
                            body: "Nevn 1 sammenlignbar kunde: «Romerike Elektro reduserte X med 32 % på 90 dager.»"),
            LeadbookContent(icon: "norwegiankronesign.circle.fill", iconColor: LBrand.green, title: "Pris-anker",
                            body: "Gi rammen før detalj-prisen: «De fleste i deres størrelse lander på NOK 80-120k/mnd.»"),
            LeadbookContent(icon: "arrow.right.circle.fill", iconColor: LBrand.purpleLight, title: "Neste steg",
                            body: "Spør om interesse-nivå → foreslå pilot eller tilbud."),
        ],
        4: [   // Neste steg
            LeadbookContent(icon: "target",                  iconColor: LBrand.purpleLight, title: "Formål",
                            body: "Lukke møtet med en konkret, kalender-festet handling."),
            LeadbookContent(icon: "calendar.badge.plus",     iconColor: LBrand.blue,   title: "Konkret avtale",
                            body: "«La oss sette et oppfølgings-møte tirsdag 13:00 — passer det?» Bok i samme samtale."),
            LeadbookContent(icon: "doc.text.fill",           iconColor: LBrand.green,  title: "Hva sendes etter",
                            body: "Oppsummering på e-post m/ neste steg + relevant ressurs (sak-studie, demo-link)."),
            LeadbookContent(icon: "person.badge.plus",       iconColor: LBrand.yellow, title: "Andre beslutningstakere",
                            body: "«Skal vi invitere [navn] også til neste møte?» — utvid relasjonen."),
            LeadbookContent(icon: "checkmark.seal.fill",     iconColor: LBrand.pink,   title: "Bekreft commitment",
                            body: "«Da snakkes vi tirsdag 13:00. Jeg sender deg en kalender-invitt nå.»"),
        ],
    ]

    /// Demo PÅ → mock; ellers innvendinger fra publiserte Pondus-maler.
    @MainActor static var objections: [Objection] {
        DemoModeManager.isActiveNonisolated ? _objections : LeadbookLiveStore.shared.objections
    }

    private static let _objections: [Objection] = [
        Objection(title: "\"Vi har allerede leverandør\"",
                  response: "Det forstår jeg godt. Mange av våre kunder hadde det også – helt til de så resultatene vi leverer på X, Y og Z.",
                  icon: "shield.fill",
                  iconColor: LBrand.green),
        Objection(title: "\"Det er for dyrt\"",
                  response: "Hva er viktigst for dere – pris eller total verdi over tid?",
                  icon: "norwegiankronesign.circle.fill",
                  iconColor: LBrand.yellow),
        Objection(title: "\"Send info på e-post\"",
                  response: "Selvfølgelig! Hva er den beste e-posten å sende det til?",
                  icon: "envelope.fill",
                  iconColor: LBrand.blue),
    ]

    /// Mock ytelses-tall — KUN i demo-modus (ingen per-mal-analytics enda).
    static var perf: [PerformanceRow] {
        DemoModeManager.isActiveNonisolated ? _perf : []
    }
    private static let _perf: [PerformanceRow] = [
        PerformanceRow(name: "Møtebooking – telefon",     responseRate: 0.52, conversion: 0.41),
        PerformanceRow(name: "Første kontakt – feltbesøk", responseRate: 0.48, conversion: 0.32),
        PerformanceRow(name: "Oppfølging etter interesse", responseRate: 0.46, conversion: 0.26),
        PerformanceRow(name: "Tilbudsoppfølging",          responseRate: 0.37, conversion: 0.27),
        PerformanceRow(name: "Ikke til stede / return",    responseRate: 0.29, conversion: 0.18),
    ]

    /// Mock versjonshistorikk — KUN i demo-modus (versjons-backend mangler).
    static var versions: [VersionEntry] {
        DemoModeManager.isActiveNonisolated ? _versions : []
    }
    private static let _versions: [VersionEntry] = [
        VersionEntry(version: "v2.1", date: "Oppdatert i dag av Kari Nordmann", author: "Kari Nordmann",
                     summary: "Justert åpningsreplikk og spørsmål • Steg 1-2", status: .current),
        VersionEntry(version: "v2.0", date: "19. mai 2025 av Kari Nordmann", author: "Kari Nordmann",
                     summary: "Forbedret innvendinger og neste steg", status: .approved),
        VersionEntry(version: "v1.1", date: "14. mai 2025 av Ola Magnussen", author: "Ola Magnussen",
                     summary: "Oppdatert spørsmål å stille", status: .approved),
        VersionEntry(version: "v1.0", date: "7. mai 2025 av Henrik Solberg", author: "Henrik Solberg",
                     summary: "Opprinnelig versjon", status: .approved),
    ]
}

// MARK: - Main view

struct LeadbookView: View {
    @State private var selectedTemplate: LeadbookTemplate = LeadbookData.firstOrPlaceholder
    @State private var selectedStep: Int = 1
    @State private var showNewTemplate = false
    @State private var showNewObjection = false
    @State private var showLibrary = false
    @State private var showPerformance = false
    @State private var showVersions = false
    @State private var selectedKPI: LeadbookKPI?
    @State private var showStatsModal = false
    @State private var subTab: LeadbookSubTab = .pondus
    @State private var selectedPondusTemplate: PondusTemplate = PondusData.templates[0]
    @State private var showTeamAccess = false
    @State private var showEcosystem = false
    @State private var showMinProfil = false
    @State private var showCardScanner = false
    @State private var showSuperAdmin = false
    @State private var showLiveTranscription = false
    // Header: delt LeadgridTabHeader eier varsel-/popover-state selv.
    // Pondus (Leadgrid-produkt) — backend-backed mal-store. Byttet fra
    // lokal @State til `appState.pondusStore` (delt singleton) 2026-07-01
    // slik at App Intents / Watch / Vision-target kan lese samme instans.
    @State private var showPondusEditor = false
    @State private var pondusEditorTarget: PondusTemplateDTO?
    @Environment(AppState.self) private var appState
    /// iPhone-compact vs. iPad/Mac-regular. Brukes til å velge 2×2-grid
    /// vs. 1×4-rekke for KPI-kortene og andre tetthetsvalg.
    @Environment(\.horizontalSizeClass) private var hSize
    /// Lokalt alias for delt store — bevarer eksisterende callsteder som
    /// refererer `pondusStore.*`.
    private var pondusStore: PondusStore { appState.pondusStore }

    /// True på iPhone-portrait og trange split-view på iPad. Bruk til å
    /// bytte til vertikal single-column layout.
    private var isCompactLayout: Bool { hSize == .compact }

    var body: some View {
        // iPhone: fullScreenCover — LeadbookView er pushet inne i Mer-
        // fanens NavigationStack, og SuperAdminDashboards egen stack
        // nestet i pushen kollapset og poppet brukeren til Mer-roten.
        // iPad/Mac: innholds-bytte — Leadbook er egen fane (ingen push),
        // og fullScreenCover legges ut i portrett-bredde på landskap-iPad
        // (svart dødfelt til høyre).
        if DeviceIdiom.isPhone {
            leadbookBody
                .fullScreenCover(isPresented: $showSuperAdmin) {
                    SuperAdminDashboard(onExit: { showSuperAdmin = false })
                }
        } else {
            Group {
                if showSuperAdmin {
                    SuperAdminDashboard(onExit: { showSuperAdmin = false })
                        .transition(.move(edge: .trailing))
                } else {
                    leadbookBody
                        .transition(.move(edge: .leading))
                }
            }
            .animation(.easeInOut(duration: 0.25), value: showSuperAdmin)
        }
    }

    private var leadbookBody: some View {
        ZStack {
            LBrand.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                DemoModeBanner()
                ScrollView {
                    VStack(spacing: 16) {
                        header
                        kpiRow
                        subTabBar
                        Group {
                            switch subTab {
                            case .oversikt:  oversiktContent
                            case .maler:     malerContent.gated(.leadbookMaler)
                            case .pondus:    pondusContent.gated(.leadbookPondus)
                            case .akademi:   AcademyTabView()
                            case .eksempler: LeadbookExamplesView().gated(.leadbookEksempler)
                            case .innsikt:   LeadbookInnsiktView().gated(.leadbookInnsikt)
                            }
                        }
                        // Telefon: den flytende tab-baren overlapper de
                        // siste ~100pt — innhold lakk bak den (QA 2026-07-05).
                        Color.clear.frame(height: DeviceIdiom.isPhone ? 110 : 20)
                    }
                    .padding(.horizontal, 20).padding(.top, 14)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            await pondusStore.load(api: appState.api)
            // Uke 2-oppfølger: live-store for fanens mal-liste/KPI-er
            // (Pondus-maler + usage-stats). Idempotent attach.
            if let api = appState.api {
                LeadbookLiveStore.shared.attach(api: api)
            }
            // Ved cold-start konsumer deep-link satt av App Intent (som kjørte
            // før view-en var ready). Vi må gjøre det ETTER load() slik at
            // matching kan skje mot live templates.
            consumePondusDeepLink()
        }
        // Reagér på deep-link satt av App Intent (Siri) eller Watch. AppState
        // holder deep-linken; vi observerer den slik at BÅDE cold-start
        // (task-fase over) og warm-start (state endres mens view er live)
        // dekkes av samme observer.
        .onChange(of: appState.deepLinkPondusRequestedAt) { _, _ in
            consumePondusDeepLink()
        }
        // Legacy NotificationCenter-basert path — beholdt for Watch-siden
        // (PondusWatchSync) og for backward compat. Bruker samme match-
        // logikk (id ELLER navn).
        .onReceive(NotificationCenter.default.publisher(for: .pondusActivateTemplate)) { notif in
            subTab = .pondus
            let templateId = notif.userInfo?["templateId"] as? String
            let templateName = notif.userInfo?["templateName"] as? String
            selectPondusTemplate(id: templateId, name: templateName)
        }
        .sheet(isPresented: $showNewTemplate) { NewTemplateSheet() }
        // 2026-07-17: wiret «Ny innvending» i +-menyen til eksisterende
        // NewObjectionSheet (var død knapp).
        .sheet(isPresented: $showNewObjection) { NewObjectionSheet() }
        .sheet(isPresented: $showLibrary) {
            TemplateLibraryModal(selected: $selectedTemplate)
        }
        .sheet(isPresented: $showPerformance) { PerformanceModal() }
        .sheet(isPresented: $showVersions) { VersionsModal() }
        .sheet(item: $selectedKPI) { kpi in LeadbookKPIDetailSheet(kpi: kpi) }
        .sheet(isPresented: $showTeamAccess) { TeamAccessControlView() }
        .sheet(isPresented: $showEcosystem) { PondusEcosystemSheet() }
        .sheet(isPresented: $showMinProfil) { MinProfilSheet() }
        .sheet(isPresented: $showCardScanner) { BusinessCardScannerSheet() }
        .sheet(isPresented: $showLiveTranscription) { LiveTranscriptionSheet() }
        // Pondus template editor (create + edit). Én sheet-modifier;
        // pondusEditorTarget=nil ⇒ create-modus, ellers edit av valgt mal.
        .sheet(isPresented: $showPondusEditor, onDismiss: { pondusEditorTarget = nil }) {
            PondusTemplateEditor(store: pondusStore, existing: pondusEditorTarget)
                .environment(appState)
        }
    }

    // MARK: - Pondus deep-link consumption

    /// Trekk deep-link fra AppState hvis den finnes + match mot live templates.
    /// Idempotent — trygg å kalle flere ganger.
    private func consumePondusDeepLink() {
        guard appState.deepLinkPondusRequestedAt != nil else { return }
        subTab = .pondus
        let id = appState.deepLinkPondusTemplateId
        let name = appState.deepLinkPondusTemplateName
        selectPondusTemplate(id: id, name: name)
        appState.clearPondusDeepLink()
    }

    /// Match Pondus-mal på id ELLER navn (localizedCaseInsensitiveContains).
    /// Setter `pondusEditorTarget` som er state-anker for aktiv mal.
    private func selectPondusTemplate(id: String?, name: String?) {
        let q = (id ?? "").lowercased()
        let n = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let match = pondusStore.templates.first(where: { dto in
            if !q.isEmpty, dto.id.uuidString.lowercased() == q { return true }
            if !n.isEmpty, dto.name.localizedCaseInsensitiveContains(n) { return true }
            return false
        }) {
            pondusEditorTarget = match
        }
    }

    // MARK: Header — delt LeadgridTabHeader (fasit: Oversikt-fanen)
    //
    // Fane-verktøyene (Bibliotek/Ytelse/Versjoner/skanner/transkripsjon/
    // + Ny) ligger i en egen horisontalt scrollbar kontrollrad rett under
    // headeren — Leadbook har for mange knapper til extraControls-slotten.

    /// Demo-aware datakilde for header-badges/popovers.
    private var headerLeads: [LeadModel] {
        DemoModeManager.isActiveNonisolated
            ? DemoModeManager.shared.mockLeads
            : appState.leads
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            LeadgridTabHeader(
                subtitle: "Standardiser salgsprosessen med maler, scripts og oppfølging.",
                leads: headerLeads,
                onSuperAdmin: { showSuperAdmin = true })
            // Full-bleed scroller: negativ padding opphever ytre 20pt-marg
            // og margen legges i stedet inn i innholdet — uten dette klippes
            // siste knapp halvveis ved høyre kant på maks scroll.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    libraryButton                            // Bibliotek
                    performanceButton(isCompact: false)      // Ytelse
                    versionsButton(isCompact: false)         // Versjoner
                    cardScannerButton                        // + Lead m/ visittkort
                    transcriptionButton                      // Live transkripsjon
                    newButton(isCompact: false)
                }
                .padding(.horizontal, 20)
            }
            .padding(.horizontal, -20)
        }
    }

    // Bibliotek-knapp m/ tellebrikke
    private var libraryButton: some View {
        Button { showLibrary = true } label: {
            HStack(spacing: 6) {
                Image(systemName: "books.vertical.fill")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(LBrand.purpleLight)
                Text("Bibliotek")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1).fixedSize()
                Text("\(LeadbookData.templates.count)")
                    .font(.appScaled(size: 9, weight: .black, design: .rounded))
                    .foregroundStyle(LBrand.purpleLight)
                    .monospacedDigit()
                    .padding(.horizontal, 5).padding(.vertical, 1)
                    .background(LBrand.purple.opacity(0.20), in: Capsule())
            }
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private func performanceButton(isCompact: Bool) -> some View {
        Button { showPerformance = true } label: {
            HStack(spacing: 6) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(LBrand.green)
                if !isCompact {
                    Text("Ytelse")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1).fixedSize()
                }
            }
            .padding(.horizontal, isCompact ? 10 : 12).padding(.vertical, 11)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private func versionsButton(isCompact: Bool) -> some View {
        Button { showVersions = true } label: {
            HStack(spacing: 6) {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(LBrand.orange)
                if !isCompact {
                    Text("Versjoner")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1).fixedSize()
                }
                Text("\(LeadbookData.versions.filter { $0.status == .pending }.count)")
                    .font(.appScaled(size: 9, weight: .black, design: .rounded))
                    .foregroundStyle(LBrand.orange)
                    .monospacedDigit()
                    .padding(.horizontal, 5).padding(.vertical, 1)
                    .background(LBrand.orange.opacity(0.22), in: Capsule())
            }
            .padding(.horizontal, isCompact ? 10 : 12).padding(.vertical, 11)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private var transcriptionButton: some View {
        Button { showLiveTranscription = true } label: {
            ZStack {
                Image(systemName: "mic.fill")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(LBrand.pink)
                    .frame(width: 44, height: 44)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.pink.opacity(0.35), lineWidth: 1))
            }
        }.buttonStyle(.plain)
    }

    private var cardScannerButton: some View {
        Button { showCardScanner = true } label: {
            ZStack {
                Image(systemName: "rectangle.and.text.magnifyingglass")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(LBrand.green)
                    .frame(width: 44, height: 44)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.green.opacity(0.35), lineWidth: 1))
                ZStack {
                    Circle().fill(LBrand.purpleLight)
                    Image(systemName: "plus").font(.appScaled(size: 7, weight: .heavy)).foregroundStyle(.white)
                }
                .frame(width: 14, height: 14)
                .overlay(Circle().stroke(LBrand.bg, lineWidth: 1.5))
                .offset(x: 14, y: -14)
            }
        }
        .buttonStyle(.plain)
    }

    private func newButton(isCompact: Bool) -> some View {
        Menu {
            Button { showNewTemplate = true } label: { Label("Ny mal", systemImage: "doc.badge.plus") }
            // 2026-07-17: wiret til NewObjectionSheet (var død knapp).
            Button { showNewObjection = true } label: { Label("Ny innvending", systemImage: "shield.fill") }
            Divider()
            // Innganger som tidligere lå i fanens egen avatar-meny
            // (SharedProfileAvatar) — bevart her etter at headeren ble
            // unifisert med Oversikt (delt LeadgridTabHeader).
            Button { showMinProfil = true } label: { Label("Min Pondus-profil", systemImage: "person.circle") }
            Button { showEcosystem = true } label: { Label("Pondus overalt", systemImage: "applewatch") }
            // «Tilpass Leadbook» fjernet 2026-07-17: var død knapp — ingen
            // tilpasnings-flate finnes.
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "plus").font(.appScaled(size: 12, weight: .bold))
                if !isCompact {
                    Text("Ny mal").font(.appScaled(size: 12, weight: .bold)).lineLimit(1).fixedSize()
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, isCompact ? 12 : 14).padding(.vertical, 12)
            .background(
                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight], startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 11)
            )
            .shadow(color: LBrand.purple.opacity(0.35), radius: 6, y: 2)
        }
    }

    // MARK: Sub-tabs

    /// Fane-knappene delt mellom iPhone (scrollbar rad) og iPad/Mac (fast rad).
    /// `.lineLimit(1)` + `.fixedSize()` hindrer at ordene brytes midt i
    /// («Overs ikt», «Pond us») når compact width presser bredden.
    private var subTabButtons: some View {
        HStack(spacing: 4) {
            ForEach(LeadbookSubTab.allCases) { tab in
                Button { withAnimation(.easeInOut(duration: 0.18)) { subTab = tab } } label: {
                    VStack(spacing: 6) {
                        Text(tab.label)
                            .font(.appScaled(size: 13, weight: subTab == tab ? .bold : .semibold))
                            .foregroundStyle(subTab == tab ? .white : LBrand.textSecondary)
                            .lineLimit(1)
                            .fixedSize()
                            .padding(.horizontal, 14).padding(.vertical, 9)
                        Rectangle()
                            .fill(subTab == tab ? LBrand.purpleLight : .clear)
                            .frame(height: 2)
                    }
                }
                .buttonStyle(.plain)
                // Stabil id for QA-harnessen — label-CONTAINS-søk traff
                // kurs-kort («…Pondus…») og åpnet fullskjerm-spilleren.
                .accessibilityIdentifier("leadbook-subtab-\(tab.label)")
            }
        }
    }

    @ViewBuilder
    private var subTabBar: some View {
        if DeviceIdiom.isPhone {
            // iPhone: fem faner får ikke plass side om side på compact width —
            // horisontal scroller i stedet. Full-bleed (negativ padding
            // opphever ytre 20pt-marg) med marg lagt inn i innholdet, slik at
            // siste fane kan scrolles helt inn.
            ScrollView(.horizontal, showsIndicators: false) {
                subTabButtons
                    .padding(.horizontal, 20)
            }
            .accessibilityIdentifier("leadbook-subtab-scroller")
            .padding(.horizontal, -20)
            .background(
                Rectangle().fill(LBrand.stroke).frame(height: 1),
                alignment: .bottom
            )
        } else {
            // iPad/Mac: behold dagens faste rad — her er det alltid plass.
            HStack(spacing: 4) {
                subTabButtons
                Spacer()
            }
            .background(
                Rectangle().fill(LBrand.stroke).frame(height: 1),
                alignment: .bottom
            )
        }
    }

    // MARK: Content per sub-tab

    private var oversiktContent: some View {
        VStack(spacing: 16) {
            SelectedLeadbookCard(template: selectedTemplate, currentStep: $selectedStep)
            ObjectionsCard()
        }
    }

    private var malerContent: some View {
        LeadbookMalerView(selected: $selectedTemplate)
    }

    // Pondus (Leadgrid-produkt) — backend-backed content.
    // Prioritering:
    //   1) publiserte maler fra backend finnes → render backend-liste
    //   2) ingen publiserte + DemoMode aktivt → vis mock PondusTabView
    //   3) ingen publiserte + SuperAdmin → «Legg til første mal»-CTA
    //   4) ingen publiserte + vanlig bruker → «Ingen publiserte pondus-maler»
    @ViewBuilder
    private var pondusContent: some View {
        if !pondusStore.published.isEmpty {
            PondusBackendListView(
                templates: pondusStore.published,
                isSuperAdmin: appState.isSuperAdmin,
                onEdit: { template in
                    pondusEditorTarget = template
                    showPondusEditor = true
                },
                onNew: {
                    pondusEditorTarget = nil
                    showPondusEditor = true
                }
            )
        } else if DemoModeManager.isActiveNonisolated {
            PondusTabView(selected: $selectedPondusTemplate)
        } else {
            PondusEmptyStateView(
                isSuperAdmin: appState.isSuperAdmin,
                isLoading: pondusStore.isLoading,
                onNew: {
                    pondusEditorTarget = nil
                    showPondusEditor = true
                }
            )
        }
    }

    private func placeholderContent(_ title: String, icon: String, subtitle: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: icon)
                .font(.appScaled(size: 44, weight: .semibold))
                .foregroundStyle(LBrand.purpleLight.opacity(0.7))
            Text(title).font(.appScaled(size: 22, weight: .heavy)).foregroundStyle(.white)
            Text(subtitle).font(.appScaled(size: 13))
                .foregroundStyle(LBrand.textSecondary)
                .multilineTextAlignment(.center)
            // «Få beskjed når klar» fjernet 2026-07-17: var død knapp —
            // ingen varslings-flate for kommende innhold.
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 70)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: KPI-rad

    private var kpiRow: some View {
        // Alle idiomer (Daniel 2026-07-05): kompakt statistikk-knapp m/
        // kortene i modal — samme mønster på iPhone, iPad og Mac.
        statsButton
            .sheet(isPresented: $showStatsModal) { statsModal }
    }

    // ── iPhone: kompakt statistikk-knapp + modal ─────────────────────

    private var statsButton: some View {
        let isDemo = DemoModeManager.isActiveNonisolated
        let activeTemplates = isDemo ? LeadbookKPI.activeTemplates.value : LeadbookKPI.activeTemplates.liveValue
        return Button {
            showStatsModal = true
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(LBrand.purple.opacity(0.22))
                    Image(systemName: "chart.bar.fill")
                        // Fast 40pt-flis — ikonet skal ikke AX-skalere
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(LBrand.purple)
                }
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Statistikk")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text("\(activeTemplates) aktive maler")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(LBrand.textSecondary)
            }
            .padding(14)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var statsModal: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Statistikk")
                    .font(.appScaled(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 18)

                ForEach(LeadbookKPI.allCases) { kpi in
                    kpiCard(kpi: kpi)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
        .background(LBrand.bg.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        // Kortene er drill-down-knapper — sheet må ligge PÅ modalen for at
        // LeadbookKPIDetailSheet skal kunne presenteres oppå statistikk-modalen.
        .sheet(item: $selectedKPI) { kpi in LeadbookKPIDetailSheet(kpi: kpi) }
    }

    private func kpiCard(kpi: LeadbookKPI) -> some View {
        // Demo PÅ → mockup-tall m/ trend. Demo AV → ekte tall fra
        // usage-stats (trend skjules — ingen historikk-serie enda).
        let isDemo = DemoModeManager.isActiveNonisolated
        return Button { selectedKPI = kpi } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 7) {
                    Text(kpi.title).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(LBrand.textSecondary)
                    Text(isDemo ? kpi.value : kpi.liveValue)
                        .font(.appScaled(size: 26, weight: .bold, design: .rounded)).foregroundStyle(.white)
                        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
                    HStack(spacing: 6) {
                        Text(isDemo ? "vs. forrige periode" : "live fra teamet").font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
                        if isDemo {
                            Text(kpi.trend).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(LBrand.green).monospacedDigit()
                        }
                    }
                }
                Spacer(minLength: 0)
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(kpi.tint.opacity(0.22))
                    Image(systemName: kpi.icon).font(.appScaled(size: 17, weight: .semibold)).foregroundStyle(kpi.tint)
                }
                .frame(width: 42, height: 42)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - LeadbookKPI enum

enum LeadbookKPI: String, CaseIterable, Identifiable {
    case activeTemplates, usedToday, meetingRate, teamAdoption
    var id: String { rawValue }

    var title: String {
        switch self {
        case .activeTemplates: return "Aktive maler"
        case .usedToday:       return "Bruk i dag"
        case .meetingRate:     return "Booket møte-rate"
        case .teamAdoption:    return "Team-adopsjon"
        }
    }

    var value: String {
        switch self {
        case .activeTemplates: return "24"
        case .usedToday:       return "142"
        case .meetingRate:     return "28,6 %"
        case .teamAdoption:    return "76 %"
        }
    }

    /// EKTE verdi fra LeadbookLiveStore (usage-stats, mig 0364) — brukes
    /// når demo er AV så KPI-kortene ikke viser mockup-tallene over.
    @MainActor var liveValue: String {
        let store = LeadbookLiveStore.shared
        switch self {
        case .activeTemplates: return store.kpiActiveTemplates
        case .usedToday:       return store.kpiUsedToday
        case .meetingRate:     return store.kpiMeetingRate
        case .teamAdoption:    return store.kpiTeamAdoption
        }
    }

    var trend: String {
        switch self {
        case .activeTemplates: return "↑ 20 %"
        case .usedToday:       return "↑ 18 %"
        case .meetingRate:     return "↑ 3,4 pp"
        case .teamAdoption:    return "↑ 12 %"
        }
    }

    var icon: String {
        switch self {
        case .activeTemplates: return "doc.text.fill"
        case .usedToday:       return "person.3.fill"
        case .meetingRate:     return "chart.bar.fill"
        case .teamAdoption:    return "person.fill.checkmark"
        }
    }

    var tint: Color {
        switch self {
        case .activeTemplates: return LBrand.purpleLight
        case .usedToday:       return LBrand.blue
        case .meetingRate:     return LBrand.green
        case .teamAdoption:    return LBrand.orange
        }
    }

    var subtitle: String {
        switch self {
        case .activeTemplates: return "Antall maler i bibliotek som er status «Aktiv»"
        case .usedToday:       return "Total bruk i dag på tvers av team og kanaler"
        case .meetingRate:     return "Andel samtaler m/ mal som resulterte i booket møte"
        case .teamAdoption:    return "Andel av team som har brukt minst én mal siste 7 dager"
        }
    }

    /// 14-dagers serie (mock-data) til drill-down-graf
    var series: [Double] {
        switch self {
        case .activeTemplates: return [18, 19, 19, 20, 20, 21, 22, 22, 22, 23, 23, 23, 24, 24]
        case .usedToday:       return [86, 92, 88, 105, 110, 120, 124, 128, 119, 130, 138, 141, 137, 142]
        case .meetingRate:     return [22.1, 23.4, 22.8, 24.0, 24.6, 25.1, 25.8, 26.0, 26.5, 27.0, 27.4, 27.9, 28.2, 28.6]
        case .teamAdoption:    return [58, 60, 61, 63, 65, 66, 68, 69, 70, 71, 73, 74, 75, 76]
        }
    }
}

// MARK: - Sub-tabs

enum LeadbookSubTab: String, CaseIterable, Identifiable {
    case oversikt, maler, pondus, akademi, eksempler, innsikt
    var id: String { rawValue }
    var label: String {
        switch self {
        case .oversikt: return "Oversikt"
        case .maler: return "Maler"
        case .pondus: return "Pondus"
        case .akademi: return "Akademi"
        case .eksempler: return "Eksempler"
        case .innsikt: return "Innsikt"
        }
    }
}

// MARK: - PondusTemplate model

struct PondusTemplate: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let score: Int
    let channel: LeadbookTemplate.Channel
    let summary: String
    let steps: [PondusStep]
    let analysis: PondusAnalysis
    let usage: PondusUsage
    let suggestions: [PondusSuggestionPair]
}

struct PondusStep: Identifiable, Hashable {
    let id = UUID()
    let icon: String
    let iconColor: Color
    let label: String
    let content: String
    let charLimit: Int?  // optional limit (200/150)
}

struct PondusAnalysis: Hashable {
    let score: Int
    let scoreLabel: String
    let autoritet: Int
    let klarhet: Int
    let troverdighet: Int
    let trygghet: Int
    let fremdrift: Int
    let tips: [String]
}

struct PondusUsage: Hashable {
    let brukt: Int
    let svarrate: Double
    let svarrateDelta: Double
    let moeterate: Double
    let moerateDelta: Double
    let konvertering: Double
    let konverteringDelta: Double
}

struct PondusSuggestionPair: Identifiable, Hashable {
    let id = UUID()
    let stronger: String
    let weaker: String
}

// MARK: - PondusData mock

enum PondusData {
    static let templates: [PondusTemplate] = [
        PondusTemplate(
            name: "Første kontakt med pondus",
            score: 82,
            channel: .phone,
            summary: "Skap et sterkt førsteinntrykk og åpne for dialog.",
            steps: [
                PondusStep(icon: "target", iconColor: LBrand.purpleLight, label: "Formål", content: "Få kontaktpersonen nysgjerrig, etablere troverdighet og avtale et kort møte.", charLimit: nil),
                PondusStep(icon: "bubble.left.fill", iconColor: LBrand.purpleLight, label: "Åpningsreplikk", content: "Hei {navn}, jeg heter {ditt navn} i {din bedrift}. Vi hjelper {målgruppe} med {kjerneverdi}.", charLimit: 200),
                PondusStep(icon: "diamond.fill", iconColor: LBrand.purpleLight, label: "Verdiforslag", content: "Vi har nylig hjulpet {kunde} med å {konkret resultat}. Tror du dette kan være relevant for dere også?", charLimit: 200),
                PondusStep(icon: "questionmark.circle.fill", iconColor: LBrand.purpleLight, label: "Behovsspørsmål", content: "Hva er viktigst å få til i år innen {område}?", charLimit: 150),
                PondusStep(icon: "checkmark.shield.fill", iconColor: LBrand.purpleLight, label: "Tillitssignaler", content: "Vi jobber med selskaper som {kundetyper} og har gjennomsnittlig {resultat/besparelse}.", charLimit: 150),
                PondusStep(icon: "exclamationmark.circle.fill", iconColor: LBrand.orange, label: "Innvendinger", content: "Vanlig innvending: «Ikke relevant nå». Svar: «Skjønner godt det. Hva er på plass for at det skulle vært aktuelt å se på dette senere?»", charLimit: 200),
                PondusStep(icon: "arrow.right.circle.fill", iconColor: LBrand.purpleLight, label: "Neste steg", content: "Har du 15 minutter til en kort prat denne uken, eller passer det bedre til uken?", charLimit: 150)
            ],
            analysis: PondusAnalysis(
                score: 88, scoreLabel: "Sterk pondus",
                autoritet: 90, klarhet: 92, troverdighet: 86, trygghet: 83, fremdrift: 88,
                tips: [
                    "Bruk kundeeksempler med tall og resultat.",
                    "Vær tydelig på verdien du skaper.",
                    "Hold en rolig og lav tempo-tone.",
                    "Avslutt med et konkret neste steg."
                ]
            ),
            usage: PondusUsage(brukt: 432, svarrate: 0.44, svarrateDelta: 0.12, moeterate: 0.18, moerateDelta: 0.06, konvertering: 0.073, konverteringDelta: 0.021),
            suggestions: [
                PondusSuggestionPair(stronger: "Jeg ringer fordi vi kan hjelpe dere er interessert i våre tjenester.", weaker: "Jeg ringer for å høre om dere er interessert i våre tjenester."),
                PondusSuggestionPair(stronger: "Vi har hjulpet {kunde} med å oppnå {resultat}.", weaker: "Vi har mye erfaring og gode løsninger."),
                PondusSuggestionPair(stronger: "Gir det mening å se nærmere på dette i en kort prat?", weaker: "Kunne vi hatt et møte en gang?"),
                PondusSuggestionPair(stronger: "Hva må være på plass for at dette skulle vært aktuelt?", weaker: "Hva er grunnen til at dette ikke er aktuelt nå?")
            ]
        ),
        PondusTemplate(
            name: "Møteåpning med pondus",
            score: 91,
            channel: .video,
            summary: "Sett agendaen og etabler verdi fra start.",
            steps: [
                PondusStep(icon: "target", iconColor: LBrand.purpleLight, label: "Formål", content: "Etabler eierskap til samtalen + sikre at agenda gir gjensidig verdi.", charLimit: nil),
                PondusStep(icon: "calendar", iconColor: LBrand.purpleLight, label: "Agenda-forslag", content: "Jeg har satt opp 15 min: 5 til å forstå dere, 5 til å vise hva som virker hos andre, og 5 til neste steg. Funker det?", charLimit: 200),
                PondusStep(icon: "bubble.left.fill", iconColor: LBrand.purpleLight, label: "Ramme-spørsmål", content: "Før vi går i gang: hva er det viktigste å få ut av denne samtalen for dere?", charLimit: 150),
                PondusStep(icon: "diamond.fill", iconColor: LBrand.purpleLight, label: "Verdiforslag", content: "Vi har sett at {kundetype} ofte sliter med {hovedutfordring} — det er det vi kan løse.", charLimit: 200),
                PondusStep(icon: "arrow.right.circle.fill", iconColor: LBrand.purpleLight, label: "Bekreft videre", content: "Stemmer det vi snakker om med det dere håpet på?", charLimit: 100)
            ],
            analysis: PondusAnalysis(score: 91, scoreLabel: "Eksepsjonell pondus", autoritet: 95, klarhet: 93, troverdighet: 90, trygghet: 88, fremdrift: 92, tips: ["Bruk navnet på lederen tidlig.", "Speil deres egen vokabular.", "Hold blikket — bygger trygghet."]),
            usage: PondusUsage(brukt: 298, svarrate: 0.51, svarrateDelta: 0.08, moeterate: 0.24, moerateDelta: 0.07, konvertering: 0.091, konverteringDelta: 0.024),
            suggestions: []
        ),
        PondusTemplate(
            name: "Prisinnvending med pondus",
            score: 76,
            channel: .phone,
            summary: "Håndter prisinnvendinger uten å miste momentum.",
            steps: [
                PondusStep(icon: "target", iconColor: LBrand.purpleLight, label: "Formål", content: "Avdekk hva som ligger bak prisinnvendingen og bygg verdi-grunnlag.", charLimit: nil),
                PondusStep(icon: "checkmark.shield.fill", iconColor: LBrand.purpleLight, label: "Anerkjenn", content: "Skjønner godt det — pris er en viktig faktor.", charLimit: 100),
                PondusStep(icon: "questionmark.circle.fill", iconColor: LBrand.purpleLight, label: "Avklar", content: "Når du sier dyrt — hva sammenligner du oss med?", charLimit: 100),
                PondusStep(icon: "diamond.fill", iconColor: LBrand.purpleLight, label: "Reframe", content: "Vår erfaring er at de som velger billigere ender opp med {konkret konsekvens} etter 6–12 mnd.", charLimit: 200)
            ],
            analysis: PondusAnalysis(score: 76, scoreLabel: "God pondus", autoritet: 82, klarhet: 80, troverdighet: 78, trygghet: 72, fremdrift: 70, tips: ["Ikke gå i forsvar.", "Bruk tall fra eksisterende kunder.", "Still motspørsmål før du svarer."]),
            usage: PondusUsage(brukt: 187, svarrate: 0.38, svarrateDelta: 0.05, moeterate: 0.16, moerateDelta: 0.04, konvertering: 0.056, konverteringDelta: 0.013),
            suggestions: []
        ),
        PondusTemplate(
            name: "Beslutningstaker-dialog",
            score: 85,
            channel: .email,
            summary: "Engasjer beslutningstakere og få respons.",
            steps: [
                PondusStep(icon: "target", iconColor: LBrand.purpleLight, label: "Formål", content: "Få beslutningstaker til å allokere 15–20 min.", charLimit: nil),
                PondusStep(icon: "envelope.fill", iconColor: LBrand.purpleLight, label: "Emnefelt", content: "{Selskap} — 3 spørsmål som tar 2 min", charLimit: 60),
                PondusStep(icon: "bubble.left.fill", iconColor: LBrand.purpleLight, label: "Åpning", content: "{Navn} — jeg vet du har lite tid. Tre korte spørsmål:", charLimit: 100),
                PondusStep(icon: "list.bullet", iconColor: LBrand.purpleLight, label: "Kjernen", content: "(1) Er {tema} relevant?\n(2) Hvem eier dette internt?\n(3) Når er rett tid å se på det?", charLimit: 200),
                PondusStep(icon: "arrow.right.circle.fill", iconColor: LBrand.purpleLight, label: "Mikro-CTA", content: "Et JA, NEI, eller «spør om 2 mnd» er nok.", charLimit: 100)
            ],
            analysis: PondusAnalysis(score: 85, scoreLabel: "Sterk pondus", autoritet: 88, klarhet: 90, troverdighet: 82, trygghet: 80, fremdrift: 85, tips: ["Korte e-poster vinner på respons-rate.", "Personliggjør med faktisk research.", "Gi en CTA som er lavterskel."]),
            usage: PondusUsage(brukt: 165, svarrate: 0.47, svarrateDelta: 0.11, moeterate: 0.21, moerateDelta: 0.06, konvertering: 0.082, konverteringDelta: 0.019),
            suggestions: []
        )
    ]
}
