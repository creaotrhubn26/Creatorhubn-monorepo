// PondusEcosystem.swift — Pondus på alle Apple-enhetene + integrasjoner (2026-06-30)
//
// Interaktive mockups for Watch / iPhone / Mac / Vision Pro + Siri-shortcuts +
// 3.parts-integrasjoner (Slack/Teams/Zoom/HubSpot/Salesforce/Aircall).

import SwiftUI

struct PondusEcosystemSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var device: Device = .watch
    @State private var watchScene: WatchScene = .liveCoach
    @State private var phoneScene: PhoneScene = .precall
    @State private var macScene: MacScene = .editor
    @State private var visionScene: VisionScene = .immersive
    @State private var connectToast: String?

    enum Device: String, CaseIterable, Identifiable {
        case watch = "Apple Watch"
        case phone = "iPhone"
        case mac = "Mac"
        case vision = "Vision Pro"
        case siri = "Siri & Tastatursnarveier"
        case integrasjoner = "Integrasjoner"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .watch: return "applewatch"
            case .phone: return "iphone.gen3"
            case .mac: return "macbook"
            case .vision: return "visionpro"
            case .siri: return "mic.circle.fill"
            case .integrasjoner: return "puzzlepiece.fill"
            }
        }
        var tint: Color {
            switch self {
            case .watch: return LBrand.red
            case .phone: return LBrand.purpleLight
            case .mac: return LBrand.blue
            case .vision: return LBrand.pink
            case .siri: return LBrand.orange
            case .integrasjoner: return LBrand.green
            }
        }
    }

    enum WatchScene: String, CaseIterable, Identifiable {
        case liveCoach = "Live coach"
        case bookmark = "Marker key moment"
        case precall = "Før-samtale-readiness"
        case complication = "Komplikasjon"
        var id: String { rawValue }
    }

    enum PhoneScene: String, CaseIterable, Identifiable {
        case precall = "Pre-call-varsel"
        case dynamicIsland = "Dynamic Island"
        case voiceMemo = "Voice memo → Eksempler"
        case widget = "Lås-skjerm-widget"
        var id: String { rawValue }
    }

    enum MacScene: String, CaseIterable, Identifiable {
        case editor = "Multi-window editor"
        case dragDrop = "Drag-drop fra Finder"
        case shortcuts = "Tastatursnarveier"
        var id: String { rawValue }
    }

    enum VisionScene: String, CaseIterable, Identifiable {
        case immersive = "Immersiv pondus-trening"
        case eyeTracking = "Eye-tracking analyse"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                HStack(spacing: 0) {
                    sidebar.frame(width: 240)
                    Divider().overlay(LBrand.stroke)
                    contentColumn
                }
            }
            .navigationTitle("Pondus overalt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                // Ellipsis-menyen («Se status på alle enheter» / «Eksporter
                // QR-koder» / «Hjelp») fjernet 2026-07-17: var døde knapper —
                // tomme closures uten mål-flater.
            }
            .overlay(alignment: .top) {
                if let t = connectToast {
                    Label(t, systemImage: "checkmark.circle.fill")
                        .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(LBrand.green, in: Capsule())
                        .padding(.top, 6)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: connectToast)
        }
        .macCatalystSheetSize(minWidth: 1000, minHeight: 760)
    }

    // MARK: Sidebar

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text("ENHETER OG TJENESTER")
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                Text("Pondus følger deg")
                    .font(.appScaled(size: 18, weight: .heavy))
                    .foregroundStyle(.white)
                Text("Samme data, kontekstuell tilgang på alle dine Apple-enheter.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
            }
            .padding(16)
            Divider().overlay(LBrand.stroke)
            ScrollView {
                VStack(spacing: 4) {
                    ForEach(Device.allCases) { d in
                        deviceRow(d)
                    }
                }
                .padding(.vertical, 8)
            }
        }
    }

    private func deviceRow(_ d: Device) -> some View {
        let active = device == d
        return Button { device = d } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(d.tint.opacity(active ? 0.25 : 0.16))
                    Image(systemName: d.icon).font(.appScaled(size: 15, weight: .bold)).foregroundStyle(d.tint)
                }
                .frame(width: 32, height: 32)
                Text(d.rawValue)
                    .font(.appScaled(size: 13, weight: active ? .bold : .semibold))
                    .foregroundStyle(active ? .white : LBrand.textSecondary)
                Spacer()
                if active {
                    Rectangle().fill(d.tint).frame(width: 3, height: 24)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(active ? LBrand.cardHi : .clear)
        }
        .buttonStyle(.plain)
    }

    // MARK: Content

    @ViewBuilder
    private var contentColumn: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                switch device {
                case .watch: watchSection
                case .phone: phoneSection
                case .mac: macSection
                case .vision: visionSection
                case .siri: siriSection
                case .integrasjoner: integrationsSection
                }
                Color.clear.frame(height: 20)
            }
            .padding(20)
        }
    }

    // MARK: WATCH

    private var watchSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            sectionHero(
                title: "Apple Watch",
                subtitle: "Trykk én knapp for å markere et øyeblikk i pågående samtale — eller få lav-friksjons pondus-coaching mellom møtene.",
                tint: LBrand.red,
                statusOK: true,
                connectLabel: "Watch tilkoblet · v0.5.0",
                ctaTitle: "Åpne i Watch-appen"
            )
            scenePicker(WatchScene.allCases.map { s in (s.rawValue, watchScene == s, { watchScene = s }) })
            HStack(alignment: .top, spacing: 24) {
                AppleWatchMockup(scene: watchScene).frame(width: 220)
                VStack(alignment: .leading, spacing: 12) {
                    featureCard(icon: "bookmark.fill", title: "Marker key moment i sanntid",
                                desc: "Trykk Watch-knappen under en samtale — øyeblikket blir et annotert key moment i Eksempler etterpå.",
                                tint: LBrand.purpleLight)
                    featureCard(icon: "waveform.path.ecg", title: "Stress-pondus via puls",
                                desc: "Watch måler pulsen din under samtaler. Hvis stress-nivået topper på prisinnvendinger — det er et coaching-mål.",
                                tint: LBrand.red)
                    featureCard(icon: "bell.badge.fill", title: "Pre-call haptisk påminnelse",
                                desc: "5 min før møte: tre korte haptic taps + «Skuldre tilbake, haken opp». Ingen lyd nødvendig.",
                                tint: LBrand.orange)
                    featureCard(icon: "circle.hexagongrid.fill", title: "Komplikasjon",
                                desc: "Dagens pondus-score på urskiven — alltid synlig. Tap = åpne dagens første samtale-prep.",
                                tint: LBrand.green)
                }
            }
        }
    }

    // MARK: PHONE

    private var phoneSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            sectionHero(
                title: "iPhone",
                subtitle: "Når du er i bilen mellom møter — pondus-prep, voice memos, og kontekstuelle varsler i Dynamic Island.",
                tint: LBrand.purpleLight,
                statusOK: true,
                connectLabel: "iPhone 15 Pro · v0.5.0",
                ctaTitle: "Last ned iOS-app"
            )
            scenePicker(PhoneScene.allCases.map { s in (s.rawValue, phoneScene == s, { phoneScene = s }) })
            HStack(alignment: .top, spacing: 24) {
                iPhoneMockup(scene: phoneScene).frame(width: 240)
                VStack(alignment: .leading, spacing: 12) {
                    featureCard(icon: "calendar.badge.clock", title: "Pre-call-varsel",
                                desc: "5 min før hvert kundemøte: navn, pondus-mål, og siste samtales transkript-snippet på lås-skjerm.",
                                tint: LBrand.purpleLight)
                    featureCard(icon: "rectangle.dashed.badge.record", title: "Voice memo → Eksempler",
                                desc: "Ta opp via iPhone, send til Leadbook Eksempler med ett trykk. AI transkriberer og scorer.",
                                tint: LBrand.red)
                    featureCard(icon: "rectangle.fill.on.rectangle.fill", title: "Dynamic Island",
                                desc: "Live samtaletid + pondus-meter mens du er i samtale. Sveip ned for å markere moment.",
                                tint: LBrand.green)
                    featureCard(icon: "widget.small", title: "Lås-skjerm-widget",
                                desc: "Ukens beste eksempel + ditt pondus-snitt. Lockscreen-widget alle størrelser.",
                                tint: LBrand.orange)
                }
            }
        }
    }

    // MARK: MAC

    private var macSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            sectionHero(
                title: "Mac",
                subtitle: "Flere åpne mal-vinduer side ved side, drag-and-drop fra Finder, og tastatursnarveier for alt.",
                tint: LBrand.blue,
                statusOK: false,
                connectLabel: "Mac-app ikke installert",
                ctaTitle: "Last ned Mac-app"
            )
            scenePicker(MacScene.allCases.map { s in (s.rawValue, macScene == s, { macScene = s }) })
            VStack(spacing: 16) {
                MacMockup(scene: macScene)
                VStack(alignment: .leading, spacing: 12) {
                    featureCard(icon: "rectangle.split.3x1.fill", title: "Multi-window mal-editor",
                                desc: "Åpne 2-3 maler i parallelle vinduer for sammenligning. Diff-view innebygd.",
                                tint: LBrand.purpleLight)
                    featureCard(icon: "arrow.up.doc.on.clipboard", title: "Drag-drop fra Finder",
                                desc: "Slipp en MP4/M4A fra Finder rett på Eksempler-vinduet — auto-import.",
                                tint: LBrand.blue)
                    featureCard(icon: "command.square.fill", title: "Tastatursnarveier",
                                desc: "Cmd+N = ny mal · Cmd+Shift+P = pondus-test · Cmd+/ = søk overalt · Cmd+. = stopp opptak",
                                tint: LBrand.green)
                }
            }
        }
    }

    // MARK: VISION

    private var visionSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            sectionHero(
                title: "Vision Pro",
                subtitle: "Tren pondus i romlig kontekst — møt en AI-kunde øye-til-øye og få live eye-tracking-analyse.",
                tint: LBrand.pink,
                statusOK: false,
                connectLabel: "Vision Pro-app i beta · våren 2026",
                ctaTitle: "Bli med i beta"
            )
            scenePicker(VisionScene.allCases.map { s in (s.rawValue, visionScene == s, { visionScene = s }) })
            VStack(spacing: 16) {
                VisionMockup(scene: visionScene)
                VStack(alignment: .leading, spacing: 12) {
                    featureCard(icon: "person.fill.viewfinder", title: "Immersiv pondus-trening",
                                desc: "Tren med AI-kunde foran deg i rommet. Spatial transkript flyter i synsfeltet.",
                                tint: LBrand.pink)
                    featureCard(icon: "eye.circle.fill", title: "Eye-tracking",
                                desc: "Ser du faktisk på «kunden»? Vision Pro måler dette og scorer som del av Trygghet-dimensjonen.",
                                tint: LBrand.purpleLight)
                    featureCard(icon: "waveform.and.person.filled", title: "Stemme + pust-analyse",
                                desc: "Real-time analyse av tempo, pause-mønstre og pust — du ser dem mens du øver.",
                                tint: LBrand.green)
                }
            }
        }
    }

    // MARK: SIRI

    private var siriSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            sectionHero(
                title: "Siri & Tastatursnarveier",
                subtitle: "Sett opp dine egne stemmekommandoer for å starte opptak, slå opp maler eller åpne dagens leksjon — uten å åpne appen.",
                tint: LBrand.orange,
                statusOK: true,
                connectLabel: "12 shortcuts er konfigurert",
                ctaTitle: "Åpne Shortcuts-appen"
            )
            VStack(alignment: .leading, spacing: 10) {
                Text("STEMMEKOMMANDOER")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                ForEach(siriCommands, id: \.command) { c in siriRow(c) }
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("APPLE WATCH-DIKTAT")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Text("Hold inne Digital Crown på Watch og si f.eks. «Pondus, marker øyeblikk» eller «Pondus, neste leksjon». Fungerer offline.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(.white)
                    .padding(14)
                    .background(LBrand.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.orange.opacity(0.3), lineWidth: 1))
            }
        }
    }

    private struct SiriCommand { let command: String; let action: String; let icon: String; let tint: Color }
    private var siriCommands: [SiriCommand] {[
        .init(command: "«Hey Siri, start pondus-opptak»", action: "Starter ny voice memo for Eksempler", icon: "mic.fill", tint: LBrand.red),
        .init(command: "«Hey Siri, åpne Skanska-malen»", action: "Åpner sist brukte mal for kunden Skanska", icon: "doc.fill", tint: LBrand.blue),
        .init(command: "«Hey Siri, neste pondus-leksjon»", action: "Spiller av neste usett kapittel i Akademiet", icon: "play.fill", tint: LBrand.green),
        .init(command: "«Hey Siri, hva er min pondus i dag?»", action: "Leser opp dagens score + dagens beste samtale", icon: "speaker.wave.2.fill", tint: LBrand.purpleLight),
        .init(command: "«Hey Siri, klargjør møte»", action: "Åpner møte-forberedelse for neste kalenderpost", icon: "calendar.circle.fill", tint: LBrand.orange),
        .init(command: "«Hey Siri, marker øyeblikk»", action: "Setter et key moment på pågående samtale", icon: "bookmark.fill", tint: LBrand.pink)
    ]}

    private func siriRow(_ c: SiriCommand) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(c.tint.opacity(0.22))
                Image(systemName: c.icon).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(c.tint)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 3) {
                Text(c.command).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                Text(c.action).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
            // «+»-knappen (Legg til i Shortcuts) fjernet 2026-07-17: var død
            // knapp — kun toast, ingen Shortcuts-donasjon bak.
        }
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
    }

    // MARK: INTEGRASJONER

    private var integrationsSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            sectionHero(
                title: "Integrasjoner",
                subtitle: "Pondus kobler seg på verktøyene du allerede bruker — uten ekstra arbeid.",
                tint: LBrand.green,
                statusOK: true,
                connectLabel: "3 av 7 koblet til",
                ctaTitle: "Administrer alle"
            )
            LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 1, iPad: 2, mac: 3, spacing: 10), spacing: 10) {
                ForEach(integrations, id: \.name) { intg in integrationCard(intg) }
            }
        }
    }

    private struct Integration { let name: String; let category: String; let icon: String; let tint: Color; let connected: Bool; let desc: String }
    private var integrations: [Integration] {[
        .init(name: "Slack", category: "Varsler", icon: "number.circle.fill", tint: LBrand.purpleLight, connected: true,
              desc: "Ukentlig pondus-rapport til #salgs-kanal. Ping på nye «vant»-eksempler."),
        .init(name: "Microsoft Teams", category: "Varsler", icon: "person.3.fill", tint: LBrand.blue, connected: false,
              desc: "Pondus-bot i kanalene. Notifiser sjef på lavt pondus-score over 7 dager."),
        .init(name: "Zoom", category: "Møter", icon: "video.fill", tint: LBrand.blue, connected: true,
              desc: "Auto-import av Zoom-recordings til Eksempler. Pondus-analyse uten manuelt arbeid."),
        .init(name: "Google Meet", category: "Møter", icon: "video.circle.fill", tint: LBrand.green, connected: true,
              desc: "Samme som Zoom — bare for Google Meet-opptak. Inkluderer live transkript."),
        .init(name: "Aircall", category: "Telefoni", icon: "phone.connection.fill", tint: LBrand.orange, connected: false,
              desc: "Synk alle ringte samtaler. Pondus-score per samtale, per selger, per kampanje."),
        .init(name: "HubSpot", category: "CRM", icon: "building.2.fill", tint: LBrand.orange, connected: false,
              desc: "Knytt eksempler til HubSpot-deals. Pondus-score følger med på deal-kortet."),
        .init(name: "Salesforce", category: "CRM", icon: "cloud.fill", tint: LBrand.blue, connected: false,
              desc: "Activity-historikk synkes 2-veis. Pondus-score blir custom Salesforce-felt.")
    ]}

    private func integrationCard(_ i: Integration) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(i.tint.opacity(0.22))
                    Image(systemName: i.icon).font(.appScaled(size: 16, weight: .bold)).foregroundStyle(i.tint)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(i.name).font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
                    Text(i.category.uppercased()).font(.appScaled(size: 8, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                }
                Spacer()
                HStack(spacing: 4) {
                    Circle().fill(i.connected ? LBrand.green : LBrand.textTertiary).frame(width: 6, height: 6)
                    Text(i.connected ? "TILKOBLET" : "IKKE TILK.").font(.appScaled(size: 8, weight: .black))
                        .foregroundStyle(i.connected ? LBrand.green : LBrand.textTertiary).tracking(0.5)
                }
            }
            Text(i.desc)
                .font(.appScaled(size: 11))
                .foregroundStyle(LBrand.textSecondary)
                .lineLimit(3).frame(maxWidth: .infinity, alignment: .leading)
            // «Koble til»/«Innstillinger» fjernet 2026-07-17: var død knapp —
            // kun toast, ingen faktisk tilkobling/innstillings-flate.
        }
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Felles UI-byggesteiner

    private func sectionHero(title: String, subtitle: String, tint: Color, statusOK: Bool, connectLabel: String, ctaTitle: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.appScaled(size: 28, weight: .heavy))
                    .foregroundStyle(.white)
                Spacer()
                HStack(spacing: 5) {
                    Circle().fill(statusOK ? LBrand.green : LBrand.orange).frame(width: 7, height: 7)
                    Text(connectLabel).font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(statusOK ? LBrand.green : LBrand.orange)
                }
                .padding(.horizontal, 9).padding(.vertical, 4)
                .background((statusOK ? LBrand.green : LBrand.orange).opacity(0.12), in: Capsule())
                .overlay(Capsule().stroke((statusOK ? LBrand.green : LBrand.orange).opacity(0.4), lineWidth: 1))
            }
            Text(subtitle)
                .font(.appScaled(size: 13))
                .foregroundStyle(LBrand.textSecondary)
            // Hero-CTA («Åpne …»/«Last ned …») fjernet 2026-07-17: var død
            // knapp — kun toast, ingen app-/nedlastings-flate bak.
        }
    }

    private func scenePicker(_ items: [(String, Bool, () -> Void)]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(items.indices, id: \.self) { i in
                    let (label, active, action) = items[i]
                    Button(action: action) {
                        Text(label)
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(active ? .white : LBrand.textSecondary)
                            .padding(.horizontal, 11).padding(.vertical, 6)
                            .background(active ? LBrand.purple.opacity(0.30) : LBrand.cardHi, in: Capsule())
                            .overlay(Capsule().stroke(active ? LBrand.purple.opacity(0.55) : LBrand.stroke, lineWidth: 1))
                    }.buttonStyle(.plain)
                }
            }
        }
    }

    private func featureCard(icon: String, title: String, desc: String, tint: Color) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(tint.opacity(0.22))
                Image(systemName: icon).font(.appScaled(size: 14, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                Text(desc).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
    }
}

// MARK: - Apple Watch mockup

struct AppleWatchMockup: View {
    let scene: PondusEcosystemSheet.WatchScene

    var body: some View {
        VStack(spacing: 14) {
            ZStack {
                // Watch chassis
                RoundedRectangle(cornerRadius: 52, style: .continuous)
                    .fill(.black)
                    .frame(width: 200, height: 240)
                    .overlay(
                        RoundedRectangle(cornerRadius: 52, style: .continuous)
                            .stroke(LinearGradient(colors: [.gray.opacity(0.6), .gray.opacity(0.2)],
                                                   startPoint: .top, endPoint: .bottom),
                                    lineWidth: 6)
                    )
                    .shadow(color: .black.opacity(0.8), radius: 18, y: 8)
                // Crown
                RoundedRectangle(cornerRadius: 3)
                    .fill(LinearGradient(colors: [.gray.opacity(0.7), .gray.opacity(0.3)],
                                         startPoint: .top, endPoint: .bottom))
                    .frame(width: 6, height: 28)
                    .offset(x: 102, y: -36)
                RoundedRectangle(cornerRadius: 2)
                    .fill(.gray.opacity(0.5))
                    .frame(width: 5, height: 18)
                    .offset(x: 102, y: 12)

                // Screen content
                screenContent
                    .frame(width: 174, height: 214)
                    .clipShape(RoundedRectangle(cornerRadius: 44, style: .continuous))
            }
            Text("Series 10 · 46 mm")
                .font(.appScaled(size: 10))
                .foregroundStyle(LBrand.textTertiary)
        }
    }

    @ViewBuilder
    private var screenContent: some View {
        switch scene {
        case .liveCoach: liveCoach
        case .bookmark: bookmark
        case .precall: precall
        case .complication: complication
        }
    }

    private var liveCoach: some View {
        VStack(spacing: 8) {
            HStack {
                Text("09:41")
                    .font(.appScaled(size: 14, weight: .heavy, design: .rounded))
                    .foregroundStyle(LBrand.green)
                Spacer()
                Image(systemName: "phone.fill.connection")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.green)
            }
            VStack(spacing: 2) {
                Text("SKANSKA AS")
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(.white.opacity(0.7))
                    .tracking(0.6)
                Text("12:34")
                    .font(.appScaled(size: 24, weight: .heavy, design: .monospaced))
                    .foregroundStyle(.white)
            }
            ZStack {
                Circle()
                    .stroke(.white.opacity(0.15), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: 0.84)
                    .stroke(
                        AngularGradient(colors: [LBrand.purple, LBrand.purpleLight, LBrand.pink, LBrand.purple], center: .center),
                        style: StrokeStyle(lineWidth: 6, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text("84").font(.appScaled(size: 26, weight: .heavy, design: .rounded)).foregroundStyle(.white)
                    Text("LIVE").font(.appScaled(size: 7, weight: .black)).foregroundStyle(LBrand.purpleLight).tracking(0.6)
                }
            }
            .frame(width: 70, height: 70)
            Text("Trykk for å markere")
                .font(.appScaled(size: 8))
                .foregroundStyle(.white.opacity(0.7))
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LinearGradient(colors: [.black, Color(red: 0.10, green: 0.05, blue: 0.20)],
                                   startPoint: .top, endPoint: .bottom))
    }

    private var bookmark: some View {
        VStack(spacing: 6) {
            Spacer()
            Image(systemName: "bookmark.fill")
                .font(.appScaled(size: 36, weight: .heavy))
                .foregroundStyle(LBrand.purpleLight)
            Text("Markert!")
                .font(.appScaled(size: 16, weight: .heavy)).foregroundStyle(.white)
            Text("12:34 i samtalen")
                .font(.appScaled(size: 10, design: .monospaced))
                .foregroundStyle(.white.opacity(0.7))
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LinearGradient(colors: [Color(red: 0.18, green: 0.08, blue: 0.28), .black],
                                   startPoint: .topLeading, endPoint: .bottomTrailing))
    }

    private var precall: some View {
        VStack(spacing: 6) {
            HStack {
                Text("OM 5 MIN")
                    .font(.appScaled(size: 8, weight: .black))
                    .foregroundStyle(LBrand.orange).tracking(0.6)
                Spacer()
                Image(systemName: "calendar")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(LBrand.orange)
            }
            Text("Skanska AS").font(.appScaled(size: 14, weight: .heavy)).foregroundStyle(.white)
            Text("Marit Eik · Kjøpsmøte")
                .font(.appScaled(size: 9)).foregroundStyle(.white.opacity(0.7))
            Divider().background(.white.opacity(0.15))
            VStack(alignment: .leading, spacing: 3) {
                Label("Skuldre tilbake", systemImage: "checkmark")
                Label("Haken opp", systemImage: "checkmark")
                Label("Ett poeng", systemImage: "checkmark")
            }
            .font(.appScaled(size: 9, weight: .semibold))
            .foregroundStyle(LBrand.green)
            Spacer()
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(.black)
    }

    private var complication: some View {
        VStack(spacing: 0) {
            Spacer()
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .stroke(.white.opacity(0.15), lineWidth: 4)
                    Circle()
                        .trim(from: 0, to: 0.78)
                        .stroke(LBrand.purpleLight, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("78").font(.appScaled(size: 12, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 1) {
                    Text("PONDUS").font(.appScaled(size: 7, weight: .black))
                        .foregroundStyle(.white.opacity(0.6)).tracking(0.6)
                    Text("I dag").font(.appScaled(size: 10)).foregroundStyle(.white)
                    HStack(spacing: 3) {
                        Image(systemName: "arrow.up.right").font(.appScaled(size: 7, weight: .bold))
                        Text("+4")
                            .font(.appScaled(size: 9, weight: .bold, design: .rounded))
                    }
                    .foregroundStyle(LBrand.green)
                }
            }
            Spacer()
            Text("3 samtaler · 12 min trening")
                .font(.appScaled(size: 7))
                .foregroundStyle(.white.opacity(0.6))
                .padding(.bottom, 4)
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black)
    }
}

// MARK: - iPhone mockup

struct iPhoneMockup: View {
    let scene: PondusEcosystemSheet.PhoneScene

    var body: some View {
        VStack(spacing: 12) {
            ZStack(alignment: .top) {
                RoundedRectangle(cornerRadius: 38, style: .continuous)
                    .fill(.black)
                    .frame(width: 220, height: 460)
                    .overlay(
                        RoundedRectangle(cornerRadius: 38, style: .continuous)
                            .stroke(LinearGradient(colors: [.white.opacity(0.4), .gray.opacity(0.15)],
                                                   startPoint: .top, endPoint: .bottom), lineWidth: 4)
                    )
                    .shadow(color: .black.opacity(0.8), radius: 18, y: 8)
                screenContent
                    .frame(width: 198, height: 438)
                    .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
            }
            Text("iPhone 15 Pro")
                .font(.appScaled(size: 10))
                .foregroundStyle(LBrand.textTertiary)
        }
    }

    @ViewBuilder
    private var screenContent: some View {
        switch scene {
        case .precall: precall
        case .dynamicIsland: dynamicIsland
        case .voiceMemo: voiceMemo
        case .widget: widget
        }
    }

    private var precall: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.04, green: 0.04, blue: 0.10), .black],
                           startPoint: .top, endPoint: .bottom)
            VStack(spacing: 8) {
                Spacer().frame(height: 60)
                Text("9:41").font(.appScaled(size: 64, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                Text("tirsdag 30. juni")
                    .font(.appScaled(size: 12)).foregroundStyle(.white.opacity(0.6))
                Spacer().frame(height: 18)
                // Pondus-notifikasjon
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        ZStack {
                            Circle().fill(LBrand.purpleLight)
                            Image(systemName: "circle.hexagongrid.fill")
                                .font(.appScaled(size: 9, weight: .bold)).foregroundStyle(.white)
                        }
                        .frame(width: 16, height: 16)
                        Text("LEADGRID PONDUS")
                            .font(.appScaled(size: 9, weight: .black))
                            .foregroundStyle(.white.opacity(0.8)).tracking(0.5)
                        Spacer()
                        Text("nå").font(.appScaled(size: 9))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                    Text("Møte med Skanska om 5 min")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Pondus-mål: Trygghet · Reaktiver «Den vanskelige prisinnvendingen»-malen?")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(.white.opacity(0.7))
                }
                .padding(10)
                .background(.ultraThinMaterial.opacity(0.55), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.1), lineWidth: 1))
                .padding(.horizontal, 10)
                Spacer()
                HStack(spacing: 28) {
                    Image(systemName: "flashlight.off.fill")
                        .font(.appScaled(size: 18, weight: .bold))
                        .foregroundStyle(.white).padding(12)
                        .background(.ultraThinMaterial, in: Circle())
                    Image(systemName: "camera.fill")
                        .font(.appScaled(size: 18, weight: .bold))
                        .foregroundStyle(.white).padding(12)
                        .background(.ultraThinMaterial, in: Circle())
                }
                .padding(.bottom, 30)
            }
        }
    }

    private var dynamicIsland: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.08, green: 0.04, blue: 0.12), .black],
                           startPoint: .top, endPoint: .bottom)
            VStack(spacing: 0) {
                Spacer().frame(height: 12)
                // Dynamic Island - utvidet form
                HStack(spacing: 10) {
                    ZStack {
                        Circle().fill(LBrand.green.opacity(0.3))
                        Image(systemName: "phone.fill")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(LBrand.green)
                    }
                    .frame(width: 28, height: 28)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Skanska AS").font(.appScaled(size: 11, weight: .bold)).foregroundStyle(.white)
                        Text("Live · 12:34").font(.appScaled(size: 9, design: .monospaced))
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    Spacer()
                    // Pondus mini
                    HStack(spacing: 4) {
                        ZStack {
                            Circle().stroke(.white.opacity(0.2), lineWidth: 2)
                            Circle().trim(from: 0, to: 0.84)
                                .stroke(LBrand.purpleLight, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                        }
                        .frame(width: 18, height: 18)
                        Text("84").font(.appScaled(size: 11, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(.black, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(.white.opacity(0.1), lineWidth: 1))
                .padding(.horizontal, 14)
                Spacer()
                VStack(spacing: 5) {
                    Text("DYNAMIC ISLAND").font(.appScaled(size: 8, weight: .black))
                        .foregroundStyle(.white.opacity(0.4)).tracking(0.7)
                    Text("Sveip ned → marker key moment")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(.white.opacity(0.6))
                }
                .padding(.bottom, 30)
            }
        }
    }

    private var voiceMemo: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.20, green: 0.05, blue: 0.10), .black],
                           startPoint: .top, endPoint: .bottom)
            VStack(spacing: 14) {
                Spacer().frame(height: 24)
                Text("VOICE MEMO").font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(.white.opacity(0.6)).tracking(0.8)
                Text("0:42")
                    .font(.appScaled(size: 42, weight: .heavy, design: .monospaced))
                    .foregroundStyle(.white)
                // Waveform
                HStack(spacing: 2) {
                    ForEach(0..<30, id: \.self) { i in
                        let h = CGFloat(((i * 37) % 100)) / 100
                        Capsule().fill(LBrand.red).frame(width: 2, height: 12 + h * 36)
                    }
                }
                .frame(height: 50)
                Spacer()
                // Record knapp
                ZStack {
                    Circle().fill(.white.opacity(0.1)).frame(width: 70, height: 70)
                    Circle().fill(LBrand.red).frame(width: 56, height: 56)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(.white).frame(width: 22, height: 22)
                }
                Text("Trykk for å stoppe")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(.white.opacity(0.6))
                HStack(spacing: 10) {
                    Image(systemName: "sparkles").font(.appScaled(size: 10)).foregroundStyle(LBrand.purpleLight)
                    Text("Sendes til Leadbook Eksempler ved stopp")
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(LBrand.purpleLight)
                }
                .padding(8)
                .background(LBrand.purple.opacity(0.18), in: Capsule())
                Spacer().frame(height: 20)
            }
        }
    }

    private var widget: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.04, green: 0.05, blue: 0.12), .black],
                           startPoint: .top, endPoint: .bottom)
            VStack(spacing: 8) {
                Spacer().frame(height: 60)
                Text("9:41")
                    .font(.appScaled(size: 64, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                Spacer().frame(height: 8)
                // Widget
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 5) {
                        Image(systemName: "circle.hexagongrid.fill")
                            .font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(LBrand.purpleLight)
                        Text("PONDUS")
                            .font(.appScaled(size: 8, weight: .black))
                            .foregroundStyle(LBrand.purpleLight).tracking(0.8)
                        Spacer()
                    }
                    HStack(alignment: .bottom, spacing: 4) {
                        Text("82").font(.appScaled(size: 30, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                        Text("/100").font(.appScaled(size: 12)).foregroundStyle(.white.opacity(0.5))
                            .padding(.bottom, 5)
                    }
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.up.right").font(.appScaled(size: 8, weight: .bold))
                        Text("+4 i dag")
                            .font(.appScaled(size: 9, weight: .bold))
                    }
                    .foregroundStyle(LBrand.green)
                    Text("Beste: Skanska 12:30").font(.appScaled(size: 9))
                        .foregroundStyle(.white.opacity(0.7))
                }
                .padding(11)
                .frame(maxWidth: 156, alignment: .leading)
                .background(.ultraThinMaterial.opacity(0.6), in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.1), lineWidth: 1))
                Spacer()
            }
        }
    }
}

// MARK: - Mac mockup

struct MacMockup: View {
    let scene: PondusEcosystemSheet.MacScene

    var body: some View {
        VStack(spacing: 0) {
            // Title bar
            HStack(spacing: 6) {
                Circle().fill(.red).frame(width: 11, height: 11)
                Circle().fill(.yellow).frame(width: 11, height: 11)
                Circle().fill(.green).frame(width: 11, height: 11)
                Spacer()
                Text("Leadgrid").font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
                Spacer()
                Image(systemName: "minus.rectangle").foregroundStyle(.white.opacity(0.4))
                Image(systemName: "rectangle.expand.vertical").foregroundStyle(.white.opacity(0.4))
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(LBrand.cardHi)
            Divider().overlay(LBrand.stroke)
            // Content
            content
                .frame(height: 280)
        }
        .background(LBrand.card)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
        .shadow(color: .black.opacity(0.6), radius: 14, y: 6)
    }

    @ViewBuilder
    private var content: some View {
        switch scene {
        case .editor: editor
        case .dragDrop: dragDrop
        case .shortcuts: shortcuts
        }
    }

    private var editor: some View {
        HStack(spacing: 0) {
            // 3 mal-vinduer side ved side
            ForEach(0..<3, id: \.self) { i in
                VStack(alignment: .leading, spacing: 6) {
                    Text(["Variant A · 82", "Variant B · 88", "Variant C · 91"][i])
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle([LBrand.orange, LBrand.purpleLight, LBrand.green][i])
                    Text(["Hei, jeg ringer fra…",
                          "Hei {navn} — vi har…",
                          "Vi har nylig hjulpet…"][i])
                        .font(.appScaled(size: 11, design: .serif))
                        .foregroundStyle(.white)
                        .lineLimit(6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Spacer()
                    HStack(spacing: 4) {
                        Image(systemName: "chart.bar.fill")
                            .font(.appScaled(size: 9))
                            .foregroundStyle([LBrand.orange, LBrand.purpleLight, LBrand.green][i])
                        Text(["28%", "34%", "41%"][i])
                            .font(.appScaled(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                    }
                }
                .padding(10)
                .frame(maxHeight: .infinity)
                .background(LBrand.cardHi)
                if i < 2 { Divider().overlay(LBrand.stroke) }
            }
        }
    }

    private var dragDrop: some View {
        ZStack {
            LBrand.bg
            VStack(spacing: 12) {
                Image(systemName: "arrow.down.doc.fill")
                    .font(.appScaled(size: 36, weight: .semibold))
                    .foregroundStyle(LBrand.blue)
                Text("Slipp Skanska_call.m4a")
                    .font(.appScaled(size: 15, weight: .bold)).foregroundStyle(.white)
                Text("AI starter transkripsjon + pondus-analyse automatisk")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
            .padding(40)
            .background(LBrand.card.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                    .foregroundStyle(LBrand.blue.opacity(0.6))
            )
            .padding(30)
        }
    }

    private var shortcuts: some View {
        ScrollView {
            VStack(spacing: 6) {
                shortcutRow("⌘N", "Ny mal")
                shortcutRow("⌘⇧P", "Start pondus-test")
                shortcutRow("⌘/", "Søk overalt")
                shortcutRow("⌘.", "Stopp opptak")
                shortcutRow("⌘R", "Spill av siste eksempel")
                shortcutRow("⌘⇧E", "Eksporter PDF")
                shortcutRow("⌘1-5", "Bytt sub-fane (Oversikt/Maler/Pondus/Eksempler/Innsikt)")
            }
            .padding(14)
        }
    }

    private func shortcutRow(_ key: String, _ desc: String) -> some View {
        HStack(spacing: 12) {
            Text(key)
                .font(.appScaled(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
                .padding(.horizontal, 9).padding(.vertical, 4)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(LBrand.stroke, lineWidth: 1))
                .frame(width: 70, alignment: .leading)
            Text(desc).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            Spacer()
        }
    }
}

// MARK: - Vision Pro mockup

struct VisionMockup: View {
    let scene: PondusEcosystemSheet.VisionScene

    var body: some View {
        ZStack {
            // Bakgrunns-rom
            LinearGradient(colors: [Color(red: 0.05, green: 0.08, blue: 0.18), Color(red: 0.10, green: 0.05, blue: 0.20)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            // Sirkulært "rom"-perspektiv
            ForEach(0..<5, id: \.self) { i in
                Circle()
                    .stroke(.white.opacity(0.05), lineWidth: 1)
                    .frame(width: CGFloat(60 + i * 80))
            }
            content
        }
        .frame(height: 320)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.pink.opacity(0.4), lineWidth: 1))
    }

    @ViewBuilder
    private var content: some View {
        switch scene {
        case .immersive: immersive
        case .eyeTracking: eyeTracking
        }
    }

    private var immersive: some View {
        ZStack {
            // AI-kunde (stilisert)
            ZStack {
                Circle()
                    .stroke(LBrand.pink.opacity(0.6), style: StrokeStyle(lineWidth: 2, dash: [3, 3]))
                    .frame(width: 130, height: 130)
                ZStack {
                    Circle().fill(LBrand.pink.opacity(0.18)).frame(width: 110, height: 110)
                    Image(systemName: "person.fill")
                        .font(.appScaled(size: 50, weight: .light))
                        .foregroundStyle(LBrand.pink)
                }
                VStack { Spacer()
                    Text("AI-KUNDE «MARIT»")
                        .font(.appScaled(size: 8, weight: .black))
                        .foregroundStyle(.white).tracking(0.6)
                        .padding(.horizontal, 9).padding(.vertical, 3)
                        .background(LBrand.pink, in: Capsule())
                        .offset(y: 14)
                }
                .frame(height: 130)
            }
            // Flytende panel — pondus live
            VStack(alignment: .leading, spacing: 4) {
                Text("PONDUS LIVE").font(.appScaled(size: 8, weight: .black))
                    .foregroundStyle(LBrand.purpleLight).tracking(0.6)
                Text("87").font(.appScaled(size: 28, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                ProgressView(value: 0.87).tint(LBrand.purpleLight).frame(width: 80)
            }
            .padding(10)
            .background(.ultraThinMaterial.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
            .offset(x: -120, y: -80)
            // Transkript panel
            VStack(alignment: .leading, spacing: 4) {
                Text("DERES SISTE REPLIKK")
                    .font(.appScaled(size: 8, weight: .black))
                    .foregroundStyle(.white.opacity(0.7)).tracking(0.6)
                Text("«Det er litt dyrt for oss…»")
                    .font(.appScaled(size: 11, design: .serif))
                    .foregroundStyle(.white)
                Text("Forslag: Pause 4 sek + spør «sammenligningsgrunnlag?»")
                    .font(.appScaled(size: 9, weight: .semibold))
                    .foregroundStyle(LBrand.green)
            }
            .padding(10)
            .frame(width: 200, alignment: .leading)
            .background(.ultraThinMaterial.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.green.opacity(0.4), lineWidth: 1))
            .offset(x: 130, y: 70)
        }
    }

    private var eyeTracking: some View {
        ZStack {
            // Stilisert person + eye-track-overlays
            ZStack {
                RoundedRectangle(cornerRadius: 60)
                    .fill(.white.opacity(0.1))
                    .frame(width: 120, height: 150)
                Image(systemName: "person.crop.rectangle.fill")
                    .font(.appScaled(size: 60, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.5))
                // Eye-track sirkler
                Circle().stroke(LBrand.green, lineWidth: 2)
                    .frame(width: 24, height: 24)
                    .offset(x: -10, y: -34)
                Circle().stroke(LBrand.green, lineWidth: 2)
                    .frame(width: 24, height: 24)
                    .offset(x: 14, y: -34)
            }
            // Data overlay
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Image(systemName: "eye.circle.fill").foregroundStyle(LBrand.green)
                    Text("EYE-TRACK").font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(LBrand.green).tracking(0.6)
                }
                Text("Direkte øyekontakt: 73 %").font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white)
                Text("Trygghet +4 pondus-poeng").font(.appScaled(size: 10)).foregroundStyle(LBrand.purpleLight)
            }
            .padding(10)
            .background(.ultraThinMaterial.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            .offset(x: 110, y: -50)
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Image(systemName: "waveform.path.ecg").foregroundStyle(LBrand.red)
                    Text("PULS").font(.appScaled(size: 9, weight: .black)).foregroundStyle(LBrand.red).tracking(0.6)
                }
                Text("82 bpm").font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white)
                Text("Rolig — stress-pondus optimal").font(.appScaled(size: 10)).foregroundStyle(LBrand.green)
            }
            .padding(10)
            .background(.ultraThinMaterial.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            .offset(x: -120, y: 70)
        }
    }
}
