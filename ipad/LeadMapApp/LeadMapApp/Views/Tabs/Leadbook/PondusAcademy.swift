// PondusAcademy.swift — "Lær Leadgrid Pondus" videolæring (2026-06-30)
//
// Banner inline + full-screen player-modal med kapittel-sidebar, progresjon og transkript.
// Mock-video (gradient + SF Symbol som poster). Når brukeren trykker play, simulerer vi
// avspilling med en timer — auto-markerer kapittel som sett etter full lengde.

import SwiftUI
import AVKit

// MARK: - Models

struct PondusChapter: Identifiable, Hashable {
    // Stabil id fra backend (AcademyLiveStore) — mock-kapitler får tilfeldig.
    var id = UUID()
    let number: Int
    let section: Section
    let title: String
    let summary: String
    let instructor: String
    let duration: Int          // sekunder
    let posterIcon: String
    let posterTint: Color
    let learningObjectives: [String]
    let transcriptSnippet: String
    /// True når kapittelet har ekte video (R2) — spilleren henter da
    /// presignert URL i stedet for å simulere avspilling.
    var hasVideo: Bool = false

    enum Section: String, CaseIterable, Identifiable, Hashable {
        case grunnleggende = "Grunnleggende"
        case dimensjoner = "5 dimensjoner"
        case praksis = "Praksis"
        case test = "Test deg selv"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .grunnleggende: return "book.fill"
            case .dimensjoner: return "circle.hexagongrid.fill"
            case .praksis: return "play.rectangle.fill"
            case .test: return "checkmark.seal.fill"
            }
        }
        var tint: Color {
            switch self {
            case .grunnleggende: return LBrand.blue
            case .dimensjoner: return LBrand.purpleLight
            case .praksis: return LBrand.orange
            case .test: return LBrand.green
            }
        }
    }
}

enum PondusAcademyData {
    /// Kapitlene views leser — live fra AcademyLiveStore (mig 0368) når
    /// lastet, ellers den innebygde mocken. Demo-modus gir alltid mock.
    @MainActor
    static var chapters: [PondusChapter] {
        AcademyLiveStore.shared.chapters ?? mockChapters
    }

    static let mockChapters: [PondusChapter] = [
        // Grunnleggende
        PondusChapter(number: 1, section: .grunnleggende,
                      title: "Velkommen til Pondus",
                      summary: "Hvorfor pondus er den manglende brikken i salgsteamets utvikling.",
                      instructor: "Lars Kristensen",
                      duration: 134,
                      posterIcon: "hand.wave.fill", posterTint: LBrand.purpleLight,
                      learningObjectives: [
                        "Hva er pondus, og hvorfor måler vi det",
                        "Hvordan akademiet er bygget opp",
                        "Hvordan bruke verktøyet i hverdagen"
                      ],
                      transcriptSnippet: "Pondus handler om en ting: at den du snakker med opplever at det du sier veier noe. Det er ikke salgstriks, det er at du står inne for verdien."),
        PondusChapter(number: 2, section: .grunnleggende,
                      title: "Hva er Pondus?",
                      summary: "Definisjon: autoritet × klarhet × troverdighet × trygghet × fremdrift.",
                      instructor: "Marit Hansen",
                      duration: 222,
                      posterIcon: "lightbulb.fill", posterTint: LBrand.yellow,
                      learningObjectives: [
                        "De 5 dimensjonene vi måler",
                        "Hvordan score'en regnes ut",
                        "Forskjellen på pondus og selvsikkerhet"
                      ],
                      transcriptSnippet: "Selvsikkerhet er internt. Pondus er hvordan den andre opplever deg. De er ikke det samme — du kan være selvsikker uten pondus, og motsatt."),

        // 5 dimensjoner
        PondusChapter(number: 3, section: .dimensjoner,
                      title: "Autoritet — stå inne for verdien",
                      summary: "Hvordan signalisere ekspertise uten å være arrogant.",
                      instructor: "Lars Kristensen",
                      duration: 258,
                      posterIcon: "person.fill", posterTint: LBrand.purpleLight,
                      learningObjectives: [
                        "Tre kjennetegn på autoritet",
                        "Vanlige feil som dreper autoritet",
                        "Øvelse: 60-sekunders pitch"
                      ],
                      transcriptSnippet: "Autoritet er ikke å snakke høyt. Det er å snakke uten å spørre om lov. Følelsen den andre får er: 'Denne personen vet hva han driver med.'"),
        PondusChapter(number: 4, section: .dimensjoner,
                      title: "Klarhet — ett poeng om gangen",
                      summary: "Hvorfor enkelhet alltid vinner i salg.",
                      instructor: "Marit Hansen",
                      duration: 235,
                      posterIcon: "scope", posterTint: LBrand.purpleLight,
                      learningObjectives: [
                        "Ett-budskap-prinsippet",
                        "Når man skal pause istedenfor å snakke",
                        "Klarhet i e-post vs telefon"
                      ],
                      transcriptSnippet: "Folk husker ikke det du sier mest. De husker det du sier klarest. Hvert salgsbudskap har én kjerne — alt annet er støy."),
        PondusChapter(number: 5, section: .dimensjoner,
                      title: "Troverdighet — vis at du har gjort jobben",
                      summary: "Bevis bygger tillit raskere enn ord.",
                      instructor: "Espen Bråten",
                      duration: 272,
                      posterIcon: "checkmark.seal.fill", posterTint: LBrand.purpleLight,
                      learningObjectives: [
                        "Hvilke bevis funker (og hvilke ikke)",
                        "Hvordan referere til andre kunder",
                        "Tall som virker uten å virke pushy"
                      ],
                      transcriptSnippet: "Du kan si du er flink. Eller du kan si: «Vi gjorde dette for Skanska forrige måned. Resultatet var 22 % flere møter på 30 dager.» — den ene veier mye mer enn den andre."),
        PondusChapter(number: 6, section: .dimensjoner,
                      title: "Trygghet — stå i det vanskelige",
                      summary: "Hvordan møte innvendinger uten å bli defensiv.",
                      instructor: "Marit Hansen",
                      duration: 248,
                      posterIcon: "shield.fill", posterTint: LBrand.purpleLight,
                      learningObjectives: [
                        "Pust-teknikk under press",
                        "Hvordan reframe en innvending",
                        "Kroppsspråk under vanskelige spørsmål"
                      ],
                      transcriptSnippet: "Når kunden sier «det er for dyrt», er det enten en panikkrespons fra deg, eller en åpning. Trygghet bestemmer hvilken det blir."),
        PondusChapter(number: 7, section: .dimensjoner,
                      title: "Fremdrift — neste konkrete steg",
                      summary: "En samtale uten neste steg har ingen pondus.",
                      instructor: "Lars Kristensen",
                      duration: 201,
                      posterIcon: "arrow.right.circle.fill", posterTint: LBrand.purpleLight,
                      learningObjectives: [
                        "Hvordan formulere mikro-CTA",
                        "Når man skal foreslå tid, og når man skal foreslå handling",
                        "Avslutninger som ikke føles pushy"
                      ],
                      transcriptSnippet: "Hvert kundemøte må ende med én ting: et konkret neste steg, med dato. Ikke «vi tar kontakt», men «jeg ringer torsdag kl 10»."),

        // Praksis
        PondusChapter(number: 8, section: .praksis,
                      title: "Kroppspråkets kraft",
                      summary: "Positiv vs negativ pondus — visuell guide.",
                      instructor: "Marit Hansen",
                      duration: 314,
                      posterIcon: "figure.stand", posterTint: LBrand.orange,
                      learningObjectives: [
                        "5 kjennetegn på positiv pondus",
                        "5 kjennetegn på negativ pondus",
                        "Hvordan kroppspråk smitter — også på telefon"
                      ],
                      transcriptSnippet: "Selv på telefon hører kunden om du sitter krumbøyd. Pondus starter før første ord."),
        PondusChapter(number: 9, section: .praksis,
                      title: "Vanlige feil og hvordan unngå dem",
                      summary: "De 7 mest vanlige pondus-killerne i norsk B2B-salg.",
                      instructor: "Espen Bråten",
                      duration: 287,
                      posterIcon: "exclamationmark.triangle.fill", posterTint: LBrand.red,
                      learningObjectives: [
                        "Fyllord som senker score 12 %",
                        "Beklagelser som ikke skulle vært der",
                        "Tomme høflighetsfraser"
                      ],
                      transcriptSnippet: "«Beklager at jeg forstyrrer» er bønn om avvisning. Pondus åpner med en grunn, ikke en unnskyldning."),
        PondusChapter(number: 10, section: .praksis,
                      title: "Pondus i praksis — ekte samtaler",
                      summary: "3 ekte salgssamtaler analysert kapittel for kapittel.",
                      instructor: "Lars Kristensen",
                      duration: 502,
                      posterIcon: "phone.fill", posterTint: LBrand.green,
                      learningObjectives: [
                        "Casestudie 1: kald samtale m/ 4 «åpne» replikker",
                        "Casestudie 2: prisinnvending som vant",
                        "Casestudie 3: hvordan en god åpning ble dårlig avslutning"
                      ],
                      transcriptSnippet: "Vi spiller av Maria's samtale med Norkonsult. Følg med på hvordan hun pauser etter pris-spørsmålet — der vinner hun samtalen."),

        // Test
        PondusChapter(number: 11, section: .test,
                      title: "Test deg selv",
                      summary: "12-spørsmåls quiz som gir deg din pondus-baseline.",
                      instructor: "Akademi-team",
                      duration: 300,
                      posterIcon: "checkmark.seal.fill", posterTint: LBrand.green,
                      learningObjectives: [
                        "Få din egen pondus-baseline",
                        "Identifiser sterkeste og svakeste dimensjon",
                        "Få en personlig 14-dagers øvelsesplan"
                      ],
                      transcriptSnippet: "Quizen er ærlig — ingen riktige svar er åpenbare. Den er designet for å avdekke hvor du faktisk står, ikke hvor du tror du står.")
    ]
}

// MARK: - Banner (inline i Pondus-fanen)

struct PondusAcademyBanner: View {
    @Binding var watched: Set<UUID>
    @Binding var currentChapter: PondusChapter?
    var onOpen: () -> Void

    private var nextChapter: PondusChapter {
        PondusAcademyData.chapters.first { !watched.contains($0.id) } ?? PondusAcademyData.chapters[0]
    }
    private var progressPct: Double {
        Double(watched.count) / Double(PondusAcademyData.chapters.count)
    }

    var body: some View {
        Button {
            currentChapter = nextChapter
            onOpen()
        } label: {
            HStack(spacing: 14) {
                // Mini-poster: bilde av Marit (Pondus-coach) m/ play-overlay
                ZStack {
                    SmartPortrait(assetName: "portrait-marit", cornerRadius: 0, cropAspect: 70.0/50.0)
                        .frame(width: 70, height: 50)
                    LinearGradient(
                        colors: [nextChapter.posterTint.opacity(0.30), .clear],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                    Circle().fill(.black.opacity(0.55))
                        .frame(width: 26, height: 26)
                        .overlay(
                            Image(systemName: "play.fill")
                                .font(.appScaled(size: 10, weight: .bold))
                                .foregroundStyle(.white)
                                .offset(x: 1)
                        )
                }
                .frame(width: 70, height: 50)
                .clipShape(RoundedRectangle(cornerRadius: 11))

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Text("LÆR LEADGRID PONDUS")
                            .font(.appScaled(size: 9, weight: .black))
                            .foregroundStyle(LBrand.purpleLight).tracking(0.8)
                        Text("•").foregroundStyle(LBrand.textTertiary)
                        Text("\(watched.count) / \(PondusAcademyData.chapters.count) sett")
                            .font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                    Text(watched.isEmpty ? "Start: «\(nextChapter.title)»" : "Fortsett: «\(nextChapter.title)»")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    // Progress bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(LBrand.cardHi).frame(height: 4)
                            Capsule()
                                .fill(LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                                     startPoint: .leading, endPoint: .trailing))
                                .frame(width: max(6, geo.size.width * progressPct), height: 4)
                        }
                    }
                    .frame(height: 4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 6) {
                    Image(systemName: "play.fill").font(.appScaled(size: 11, weight: .bold))
                    Text("Åpne Akademi").font(.appScaled(size: 12, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(
                    LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Capsule()
                )
                .shadow(color: LBrand.purple.opacity(0.45), radius: 6, y: 2)
            }
            .padding(12)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14).stroke(LBrand.purple.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Full-screen Akademi-modal

struct PondusAkademiSheet: View {
    @Binding var watched: Set<UUID>
    @State var current: PondusChapter
    /// Kapitlene sheeten opererer på — Pondus-kurset fra PondusTab, vilkårlig
    /// kurs fra Akademi-fanen. Alle interne lister/navigasjon bruker denne.
    let chapters: [PondusChapter]
    @Environment(\.dismiss) private var dismiss

    @State private var isPlaying = false
    @State private var playbackSeconds: Int = 0
    @State private var playbackSpeed: Double = 1.0
    @State private var sectionFilter: PondusChapter.Section?
    @State private var showTranscript = true
    @State private var search: String = ""
    // Ekte video (R2, presignert URL) — kun for kapitler med hasVideo.
    @State private var videoPlayer: AVPlayer?
    @State private var videoLoading = false
    @State private var videoLoadFailed = false
    // Quiz-kapittelet («Test deg selv») er interaktivt — ikke video.
    @State private var showQuiz = false
    @State private var quizLocalResult: PondusQuizLocalResult? = PondusQuizLocalResult.load()
    // «Anbefalt for deg» (slice B): kvalitets-underkjenninger som signal.
    @Environment(AppState.self) private var appState
    @State private var qualityRejections: [SalesVerification] = []

    private var filteredChapters: [PondusChapter] {
        var list = chapters
        if let f = sectionFilter { list = list.filter { $0.section == f } }
        if !search.isEmpty {
            let q = search.lowercased()
            list = list.filter { $0.title.lowercased().contains(q) || $0.summary.lowercased().contains(q) }
        }
        return list
    }

    private var watchedDurationSeconds: Int {
        chapters.filter { watched.contains($0.id) }.map(\.duration).reduce(0, +)
    }
    private var totalDurationSeconds: Int {
        chapters.map(\.duration).reduce(0, +)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                if DeviceIdiom.isPhone {
                    // iPhone: spiller øverst, kapittel-listen som kompakt
                    // bunn-seksjon (egen intern scroll) — 360pt-sidebaren
                    // får ikke plass ved siden av spilleren.
                    VStack(spacing: 0) {
                        playerColumn
                        Divider().overlay(LBrand.stroke)
                        sidebarColumn
                            .frame(height: 320)
                    }
                } else {
                    HStack(spacing: 0) {
                        playerColumn
                        Divider().overlay(LBrand.stroke)
                        sidebarColumn
                            .frame(width: 360)
                    }
                }
            }
            .navigationTitle("Lær Leadgrid Pondus")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text("\(watched.count) av \(chapters.count) kapitler")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                        Text("\(formatMinutes(watchedDurationSeconds)) av \(formatMinutes(totalDurationSeconds))")
                            .font(.appScaled(size: 9))
                            .foregroundStyle(LBrand.textSecondary)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        // «Last ned for offline» + «Del Akademi-lenke» fjernet
                        // 2026-07-17: var døde knapper — ingen offline-/dele-
                        // flate for Akademi-innhold.
                        Button { showTranscript.toggle() } label: {
                            Label(showTranscript ? "Skjul transkript" : "Vis transkript", systemImage: "text.quote")
                        }
                        Divider()
                        Button(role: .destructive) {
                            watched.removeAll()
                            playbackSeconds = 0
                        } label: { Label("Nullstill fremdrift", systemImage: "arrow.counterclockwise") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
        }
        .onChange(of: current) { _, _ in
            playbackSeconds = 0
            isPlaying = false
        }
        .task { await loadRejections() }
    }

    // MARK: «Anbefalt for deg» (slice B)

    /// Kun Pondus-kurset har dimensjons-kapitler (tittel-prefiks «Autoritet»,
    /// «Klarhet», …) — andre kurs fra Akademi-fanen får ingen seksjon.
    private var isPondusCourse: Bool {
        PondusDimension.allCases.contains { dim in
            chapters.contains { $0.title.hasPrefix(dim.label) }
        }
    }

    private var recommendations: [PondusRecommendation] {
        guard isPondusCourse else { return [] }
        return PondusRecommendationEngine.recommendations(
            quiz: quizLocalResult,
            rejections: qualityRejections,
            chapters: chapters
        )
    }

    /// Underkjenninger som personlig signal. Demo: demo-køen. Ekte: kun EGNE
    /// underkjenninger — uten kjent bruker-id vises ingenting (aldri org-data
    /// som personlig signal). 403 fra kvalitetskøen → signal stille borte.
    private func loadRejections() async {
        if DemoModeManager.isActiveNonisolated {
            qualityRejections = KvalitetDemoStore.shared.items.filter { $0.status == "rejected" }
            return
        }
        guard let me = TeamLiveStore.shared.currentUserId else { return }
        guard let q = await QualityService.shared.queue(using: appState.api) else { return }
        qualityRejections = q.items.filter { $0.status == "rejected" && $0.sellerUserId == me }
    }

    // MARK: Player

    private var playerColumn: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if current.section == .test {
                    // Quiz-kapittelet: interaktiv quiz i stedet for video
                    // (slice A — PondusQuiz.swift).
                    quizCanvas
                } else if current.hasVideo {
                    // Ekte video: AVKit-spiller m/ native kontroller —
                    // den simulerte scrubben/transporten skjules.
                    videoCanvas
                } else {
                    playerCanvas
                    playerControls
                }
                chapterMeta
                if showTranscript { transcriptCard }
                relatedRow
                Color.clear.frame(height: 24)
            }
            .padding(20)
        }
        // Hent presignert URL når kapittelet (m/ video) endres. task(id:)
        // kansellerer forrige last ved kapittelbytte.
        .task(id: current.id) {
            teardownVideo()
            guard current.hasVideo else { return }
            await loadVideo()
        }
        .onDisappear { teardownVideo() }
        // Fullført avspilling → marker sett (parent persisterer via onChange).
        .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)) { note in
            guard current.hasVideo,
                  let item = note.object as? AVPlayerItem,
                  item === videoPlayer?.currentItem else { return }
            watched.insert(current.id)
        }
    }

    /// Quiz-kapittelet: CTA-kort i spiller-flaten. Viser siste resultat når
    /// quizen er tatt, og markerer kapittelet som sett ved fullføring.
    private var quizCanvas: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(LinearGradient(
                    colors: [LBrand.green.opacity(0.32), .black, LBrand.purple.opacity(0.24)],
                    startPoint: .topLeading, endPoint: .bottomTrailing))
            VStack(spacing: 14) {
                ZStack {
                    Circle().fill(.black.opacity(0.45))
                        .frame(width: 74, height: 74)
                    Image(systemName: "checkmark.seal.fill")
                        .font(.appScaled(size: 32, weight: .semibold))
                        .foregroundStyle(LBrand.green)
                }
                Text("Interaktiv quiz — 12 spørsmål")
                    .font(.appScaled(size: 19, weight: .heavy))
                    .foregroundStyle(.white)
                if let r = quizLocalResult {
                    Text("Siste resultat: \(r.total) · \(r.tierLabel) · \(formatQuizDate(r.date))")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.75))
                }
                Button { showQuiz = true } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "play.fill")
                            .font(.appScaled(size: 13, weight: .bold))
                        Text(quizLocalResult == nil ? "Start quizen" : "Ta på nytt")
                            .font(.appScaled(size: 14, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 26).padding(.vertical, 12)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                    .shadow(color: LBrand.purple.opacity(0.5), radius: 8, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
        .aspectRatio(16/9, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .sheet(isPresented: $showQuiz) {
            PondusQuizSheet(onCompleted: { r in
                quizLocalResult = r
                if let quizChapter = chapters.first(where: { $0.section == .test }) {
                    watched.insert(quizChapter.id)
                }
            })
        }
    }

    private func formatQuizDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM yyyy"
        return f.string(from: d)
    }

    private var videoCanvas: some View {
        ZStack {
            if let player = videoPlayer {
                VideoPlayer(player: player)
            } else {
                RoundedRectangle(cornerRadius: 16)
                    .fill(LinearGradient(
                        colors: [current.posterTint.opacity(0.40), .black, current.posterTint.opacity(0.20)],
                        startPoint: .topLeading, endPoint: .bottomTrailing))
                if videoLoading {
                    VStack(spacing: 10) {
                        ProgressView().tint(.white)
                        Text("Laster video…")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.8))
                    }
                } else if videoLoadFailed {
                    VStack(spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.appScaled(size: 26))
                            .foregroundStyle(LBrand.yellow)
                        Text("Kunne ikke laste videoen")
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        Button {
                            Task { await loadVideo() }
                        } label: {
                            Text("Prøv igjen")
                                .font(.appScaled(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .background(LBrand.purple, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .aspectRatio(16/9, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func loadVideo() async {
        videoLoadFailed = false
        videoLoading = true
        defer { videoLoading = false }
        guard let url = await AcademyLiveStore.shared.videoURL(for: current.id) else {
            videoLoadFailed = true
            return
        }
        guard !Task.isCancelled else { return }
        videoPlayer = AVPlayer(playerItem: AVPlayerItem(url: url))
    }

    private func teardownVideo() {
        videoPlayer?.pause()
        videoPlayer = nil
        videoLoadFailed = false
    }

    // Map instruktør → PondusCast
    private func castFor(_ instructor: String) -> PondusCast? {
        switch instructor {
        case "Lars Kristensen": return .lars
        case "Marit Hansen":    return .marit
        case "Espen Bråten":    return .aaron        // Aaron som ny Espen-ekspert
        default: return nil
        }
    }

    private var playerCanvas: some View {
        ZStack {
            // Bakgrunn: hvis "Kroppspråkets kraft" (kap 8), bruk infografikken; ellers portrett av instruktøren
            if current.number == 8 {
                Image("infographic-kroppsprak")
                    .resizable()
                    .scaledToFit()
                    .background(.black)
            } else if let cast = castFor(current.instructor) {
                Image(cast.assetName)
                    .resizable()
                    .scaledToFill()
                    .clipped()
                    .overlay(
                        LinearGradient(
                            colors: [current.posterTint.opacity(0.20), .black.opacity(0.30), .clear, .black.opacity(0.80)],
                            startPoint: .top, endPoint: .bottom)
                    )
            } else {
                RoundedRectangle(cornerRadius: 16)
                    .fill(LinearGradient(
                        colors: [current.posterTint.opacity(0.40), .black, current.posterTint.opacity(0.20)],
                        startPoint: .topLeading, endPoint: .bottomTrailing))
            }
            // Tittel + meta — vises bare når ikke kropp​språkets kraft (som har egen tittel)
            if current.number != 8 {
                VStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Text("Kapittel \(current.number) · \(current.section.rawValue)")
                            .font(.appScaled(size: 10, weight: .black))
                            .foregroundStyle(.white.opacity(0.8))
                            .tracking(0.8)
                        Text(current.title)
                            .font(.appScaled(size: 24, weight: .heavy))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 30)
                            .shadow(color: .black.opacity(0.6), radius: 8)
                    }
                    .padding(.bottom, 28)
                }
            }
            // Play overlay
            if !isPlaying {
                Button { togglePlay() } label: {
                    Circle().fill(.black.opacity(0.5))
                        .frame(width: 86, height: 86)
                        .overlay(
                            Image(systemName: "play.fill")
                                .font(.appScaled(size: 36, weight: .bold))
                                .foregroundStyle(.white)
                                .offset(x: 3)
                        )
                }
                .buttonStyle(.plain)
            }
            // Live indicator
            VStack {
                HStack {
                    if isPlaying {
                        HStack(spacing: 5) {
                            Circle().fill(LBrand.red).frame(width: 6, height: 6)
                                .opacity(0.85)
                            Text("SPILLES AV")
                                .font(.appScaled(size: 9, weight: .black)).tracking(0.8)
                                .foregroundStyle(.white)
                        }
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(.black.opacity(0.5), in: Capsule())
                    }
                    Spacer()
                    HStack(spacing: 6) {
                        Image(systemName: "person.fill")
                            .font(.appScaled(size: 9, weight: .bold))
                        Text(current.instructor)
                            .font(.appScaled(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(.black.opacity(0.5), in: Capsule())
                }
                Spacer()
            }
            .padding(12)
        }
        .aspectRatio(16/9, contentMode: .fit)
        .frame(maxWidth: .infinity)
    }

    private var playerControls: some View {
        VStack(spacing: 10) {
            // Scrubber
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(LBrand.cardHi).frame(height: 6)
                    Capsule()
                        .fill(LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(6, geo.size.width * progressFraction), height: 6)
                    Circle().fill(.white)
                        .frame(width: 12, height: 12)
                        .offset(x: max(0, geo.size.width * progressFraction - 6))
                        .shadow(color: LBrand.purple.opacity(0.6), radius: 4)
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { v in
                            let pct = max(0, min(1, v.location.x / geo.size.width))
                            playbackSeconds = Int(Double(current.duration) * pct)
                        }
                )
            }
            .frame(height: 12)
            // Time + transport
            HStack(spacing: 16) {
                Text(formatHMS(playbackSeconds))
                    .font(.appScaled(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(LBrand.textSecondary)
                Spacer()
                Button { jumpPrev() } label: {
                    Image(systemName: "backward.end.fill")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
                Button { skip(-10) } label: {
                    Image(systemName: "gobackward.10")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
                Button { togglePlay() } label: {
                    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                        .font(.appScaled(size: 18, weight: .heavy))
                        .foregroundStyle(.white)
                        .frame(width: 52, height: 52)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: Circle()
                        )
                        .shadow(color: LBrand.purple.opacity(0.5), radius: 8)
                }.buttonStyle(.plain)
                Button { skip(10) } label: {
                    Image(systemName: "goforward.10")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
                Button { jumpNext() } label: {
                    Image(systemName: "forward.end.fill")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
                Spacer()
                Menu {
                    ForEach([0.75, 1.0, 1.25, 1.5, 2.0], id: \.self) { s in
                        Button("\(s == 1 ? "Normal" : String(format: "%.2gx", s))") { playbackSpeed = s }
                    }
                } label: {
                    Text(playbackSpeed == 1 ? "1×" : "\(String(format: "%.2gx", playbackSpeed))")
                        .font(.appScaled(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 32)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(LBrand.stroke, lineWidth: 1))
                }
                Text(formatHMS(current.duration))
                    .font(.appScaled(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(LBrand.textSecondary)
            }
        }
    }

    private var chapterMeta: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text(current.title)
                    .font(.appScaled(size: 22, weight: .heavy))
                    .foregroundStyle(.white)
                Spacer()
                if watched.contains(current.id) {
                    Label("Sett", systemImage: "checkmark.circle.fill")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(LBrand.green)
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(LBrand.green.opacity(0.16), in: Capsule())
                }
            }
            Text(current.summary)
                .font(.appScaled(size: 13))
                .foregroundStyle(LBrand.textSecondary)
            VStack(alignment: .leading, spacing: 8) {
                Text("DU VIL LÆRE")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                ForEach(current.learningObjectives, id: \.self) { obj in
                    HStack(alignment: .top, spacing: 9) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.appScaled(size: 12))
                            .foregroundStyle(LBrand.purpleLight)
                        Text(obj)
                            .font(.appScaled(size: 13))
                            .foregroundStyle(.white)
                        Spacer()
                    }
                }
            }
            .padding(12)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        }
    }

    private var transcriptCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "text.quote")
                    .foregroundStyle(LBrand.purpleLight)
                Text("TRANSKRIPT")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Spacer()
                // «Eksporter»-knappen fjernet 2026-07-17: var død knapp —
                // ingen eksport-flate for transkript.
            }
            Text(current.transcriptSnippet)
                .font(.appScaled(size: 13, design: .serif))
                .foregroundStyle(.white)
                .lineSpacing(4)
                .padding(.vertical, 4)
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            Rectangle().fill(LBrand.purpleLight).frame(width: 3),
            alignment: .leading
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var relatedRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("NESTE I AKADEMIET").font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            HStack(spacing: 10) {
                ForEach(nextSuggestions, id: \.id) { c in
                    Button { current = c } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            ZStack {
                                if c.number == 8 {
                                    Image("infographic-kroppsprak")
                                        .resizable().scaledToFill()
                                } else if let cast = castFor(c.instructor) {
                                    Image(cast.assetName)
                                        .resizable().scaledToFill()
                                } else {
                                    RoundedRectangle(cornerRadius: 9)
                                        .fill(LinearGradient(
                                            colors: [c.posterTint.opacity(0.35), c.posterTint.opacity(0.1)],
                                            startPoint: .topLeading, endPoint: .bottomTrailing))
                                    Image(systemName: c.posterIcon)
                                        .font(.appScaled(size: 22, weight: .semibold))
                                        .foregroundStyle(.white)
                                }
                                LinearGradient(colors: [.clear, .black.opacity(0.55)],
                                               startPoint: .top, endPoint: .bottom)
                            }
                            .frame(height: 70)
                            .clipShape(RoundedRectangle(cornerRadius: 9))
                            Text(c.title)
                                .font(.appScaled(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                                .lineLimit(2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            HStack(spacing: 6) {
                                Image(systemName: "clock")
                                    .font(.appScaled(size: 9))
                                Text(formatHMS(c.duration))
                                    .font(.appScaled(size: 10, design: .monospaced))
                            }
                            .foregroundStyle(LBrand.textSecondary)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var nextSuggestions: [PondusChapter] {
        let all = chapters
        guard let idx = all.firstIndex(of: current) else { return Array(all.prefix(3)) }
        return Array(all[(idx + 1)..<min(idx + 4, all.count)])
    }

    // MARK: Sidebar — kapittel-liste

    private var sidebarColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(LBrand.textTertiary)
                    TextField("Søk kapittel…", text: $search)
                        .foregroundStyle(.white).textFieldStyle(.plain)
                    if !search.isEmpty {
                        Button { search = "" } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(LBrand.textTertiary)
                        }.buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 7) {
                        sectionChip(nil, label: "Alle")
                        ForEach(PondusChapter.Section.allCases) { s in
                            sectionChip(s, label: s.rawValue)
                        }
                    }
                }
            }
            .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 10)

            ScrollView {
                VStack(spacing: 8) {
                    // «Anbefalt for deg» — skjules under aktivt søk/filter så
                    // listen forblir ren når brukeren leter selv.
                    if isPondusCourse && search.isEmpty && sectionFilter == nil {
                        PondusRecommendationSection(
                            recommendations: recommendations,
                            quizTaken: quizLocalResult != nil,
                            onSelect: { current = $0 },
                            onQuizCompleted: { r in
                                quizLocalResult = r
                                if let quizChapter = chapters.first(where: { $0.section == .test }) {
                                    watched.insert(quizChapter.id)
                                }
                            }
                        )
                    }
                    ForEach(PondusChapter.Section.allCases) { sec in
                        let chs = filteredChapters.filter { $0.section == sec }
                        if !chs.isEmpty {
                            sectionHeader(sec, count: chs.count)
                            ForEach(chs) { c in chapterRow(c) }
                        }
                    }
                }
                .padding(.horizontal, 14).padding(.bottom, 16)
            }
        }
        .background(LBrand.bg)
    }

    private func sectionChip(_ s: PondusChapter.Section?, label: String) -> some View {
        let isOn = sectionFilter == s
        return Button { sectionFilter = s } label: {
            Text(label)
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(isOn ? .white : LBrand.textSecondary)
                .padding(.horizontal, 11).padding(.vertical, 6)
                .background(isOn ? LBrand.purple.opacity(0.30) : LBrand.cardHi, in: Capsule())
                .overlay(Capsule().stroke(isOn ? LBrand.purple.opacity(0.55) : LBrand.stroke, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    private func sectionHeader(_ s: PondusChapter.Section, count: Int) -> some View {
        HStack(spacing: 7) {
            Image(systemName: s.icon)
                .font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(s.tint)
            Text(s.rawValue.uppercased())
                .font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(s.tint)
                .tracking(0.6)
            Text("·").foregroundStyle(LBrand.textTertiary)
            Text("\(count)")
                .font(.appScaled(size: 10, weight: .bold, design: .rounded))
                .foregroundStyle(LBrand.textTertiary)
            Spacer()
        }
        .padding(.top, 6).padding(.bottom, 2)
    }

    private func chapterRow(_ c: PondusChapter) -> some View {
        let isCurrent = c.id == current.id
        let isWatched = watched.contains(c.id)
        return Button {
            current = c
        } label: {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    if c.number == 8 {
                        Image("infographic-kroppsprak")
                            .resizable().scaledToFill()
                    } else if let cast = castFor(c.instructor) {
                        Image(cast.assetName)
                            .resizable().scaledToFill()
                    } else {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(LinearGradient(
                                colors: [c.posterTint.opacity(0.40), c.posterTint.opacity(0.10)],
                                startPoint: .topLeading, endPoint: .bottomTrailing))
                        Image(systemName: c.posterIcon)
                            .font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    if isCurrent {
                        Circle().fill(.black.opacity(0.5))
                            .frame(width: 22, height: 22)
                            .overlay(
                                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                                    .font(.appScaled(size: 8, weight: .heavy))
                                    .foregroundStyle(.white)
                            )
                    } else if isWatched {
                        ZStack {
                            Circle().fill(LBrand.green.opacity(0.95)).frame(width: 18, height: 18)
                            Image(systemName: "checkmark")
                                .font(.appScaled(size: 9, weight: .black))
                                .foregroundStyle(.white)
                        }
                    }
                }
                .frame(width: 56, height: 40)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 5) {
                        Text("\(c.number)")
                            .font(.appScaled(size: 10, weight: .black, design: .rounded))
                            .foregroundStyle(LBrand.textTertiary)
                        Text(c.title)
                            .font(.appScaled(size: 12, weight: isCurrent ? .bold : .semibold))
                            .foregroundStyle(isCurrent ? LBrand.purpleLight : .white)
                            .lineLimit(2)
                    }
                    HStack(spacing: 5) {
                        Image(systemName: "clock")
                            .font(.appScaled(size: 8))
                            .foregroundStyle(LBrand.textTertiary)
                        Text(formatHMS(c.duration))
                            .font(.appScaled(size: 10, design: .monospaced))
                            .foregroundStyle(LBrand.textTertiary)
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text(c.instructor)
                            .font(.appScaled(size: 10))
                            .foregroundStyle(LBrand.textTertiary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 4)
            }
            .padding(10)
            .background(
                isCurrent ? LBrand.purple.opacity(0.13) : LBrand.card,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isCurrent ? LBrand.purple.opacity(0.4) : LBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Actions

    private var progressFraction: Double {
        Double(playbackSeconds) / max(1, Double(current.duration))
    }

    private func togglePlay() {
        if isPlaying { isPlaying = false; return }
        if watched.contains(current.id) && playbackSeconds >= current.duration {
            // restart
            playbackSeconds = 0
        }
        isPlaying = true
        tick()
    }

    private func tick() {
        guard isPlaying else { return }
        // Advance by 1s scaled by playbackSpeed every 1s
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            if !isPlaying { return }
            playbackSeconds = min(current.duration, playbackSeconds + Int(playbackSpeed.rounded()))
            if playbackSeconds >= current.duration {
                isPlaying = false
                watched.insert(current.id)
                // auto-advance til neste kapittel
                if let next = nextUnwatched() {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                        current = next
                    }
                }
            } else {
                tick()
            }
        }
    }

    private func skip(_ delta: Int) {
        playbackSeconds = max(0, min(current.duration, playbackSeconds + delta))
    }
    private func jumpPrev() {
        let all = chapters
        guard let idx = all.firstIndex(of: current), idx > 0 else { return }
        current = all[idx - 1]
    }
    private func jumpNext() {
        let all = chapters
        guard let idx = all.firstIndex(of: current), idx < all.count - 1 else { return }
        current = all[idx + 1]
    }
    private func nextUnwatched() -> PondusChapter? {
        let all = chapters
        guard let idx = all.firstIndex(of: current) else { return nil }
        for i in (idx + 1)..<all.count where !watched.contains(all[i].id) { return all[i] }
        return nil
    }

    // MARK: Formatters

    private func formatHMS(_ secs: Int) -> String {
        let m = secs / 60, s = secs % 60
        return String(format: "%d:%02d", m, s)
    }
    private func formatMinutes(_ secs: Int) -> String {
        let m = secs / 60, s = secs % 60
        if m < 60 { return "\(m) min \(s)s" }
        let h = m / 60, mm = m % 60
        return "\(h) t \(mm) min"
    }
}
