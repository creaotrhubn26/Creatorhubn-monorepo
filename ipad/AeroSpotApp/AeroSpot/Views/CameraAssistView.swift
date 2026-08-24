// CameraAssistView.swift — Kameraassistenten: neste-mål-header m/ nedtelling,
// modusvalg, anbefaling (nærmeste fly + lys + gear-profil), teknikk-diagram
// for panning/propell, iPhone- eller Canon-søker med live Vision-coaching,
// differ + «Bruk på kamera» (CCAPI-write), lær-av-loggbok, spotting session
// og opt-in foto-nedlasting til mobilen med progress.

import SwiftUI

private let PHOTO_TIPS = [
    "Prøv å plassere flyet i øvre tredjedel. Gi rom i bildet for retning og bevegelse.",
    "Flyet kommer fra siden? La det være mer luft foran flyet enn bak.",
    "Pass på highlights i skyene — trekk eksponeringen ned 1/3 ved behov.",
    "Varm dag? Heat haze ødelegger telebilder — kom nærmere eller vent.",
    "Panning: fortsett bevegelsen etter eksponeringen, som en golfsving.",
]

struct CameraAssistView: View {
    @Environment(AppModel.self) private var model
    @State private var connecting = false
    @State private var connectError: String?
    @State private var tipIndex = 0
    @State private var phoneCam = PhoneCameraStore()
    @State private var usePhoneViewfinder = false
    @State private var now = Date()
    @State private var applying = false
    @State private var applyResult: String?
    @State private var showApplyConfirm = false
    private let ticker = Timer.publish(every: 5, on: .main, in: .common).autoconnect()

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.spacingLG) {
                    Text("Kameraassistent")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)

                    // Handling først: neste ankomst + søker + anbefaling + session
                    nextTargetHeader
                    modePicker
                    viewfinderCard
                    recommendationCard
                    techniqueCard
                    differencesCard
                    applyCard
                    downloadsCard
                    learnCard
                    sessionCard
                    // Sekundært: kamera-tilkobling og generelle tips nederst
                    cameraCard
                    tipsCard
                }
                .padding(Theme.spacingLG)
            }
            .background(Theme.background)
        }
        .onReceive(ticker) { now = $0 }
        .sheet(item: sessionSummaryBinding) { summary in
            SessionSummarySheet(summary: summary)
                .presentationDetents([.medium])
                .presentationBackground(Theme.surface)
        }
    }

    private var sessionSummaryBinding: Binding<SessionSummary?> {
        let session = model.session
        return Binding(
            get: { session.lastSummary },
            set: { session.lastSummary = $0 }
        )
    }

    // ── Neste mål: header med nedtelling (handling først) ────────────

    @ViewBuilder
    private var nextTargetHeader: some View {
        if let arrival = model.nearestFlight {
            let f = arrival.flight
            HStack(spacing: Theme.spacingMD) {
                Image(systemName: "airplane.circle.fill")
                    .font(.title2).foregroundStyle(Theme.primaryBright)
                VStack(alignment: .leading, spacing: 2) {
                    Text("NESTE MÅL")
                        .font(.system(size: 10, weight: .bold)).tracking(0.8)
                        .foregroundStyle(Theme.textSecondary)
                    Text(f.aircraftType ?? f.callsign)
                        .font(.headline).foregroundStyle(Theme.textPrimary)
                    Text("\(String(format: "%.1f", arrival.distanceKm)) km unna\(countdownSuffix(f))")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                RareBadge(rarity: f.rarity)
            }
            .card(elevated: true)
        }
    }

    private func countdownSuffix(_ f: LiveFlight) -> String {
        guard let eta = f.etaIso, let date = ISO8601DateFormatter().date(from: eta) else { return "" }
        let secs = date.timeIntervalSince(now)
        if secs <= 0 { return " · passerer nå" }
        let mins = Int(secs / 60)
        return mins >= 1 ? " · om \(mins) min" : " · om \(Int(secs)) sek"
    }

    // ── Teknikk-visualisering (panning / propell) ────────────────────

    @ViewBuilder
    private var techniqueCard: some View {
        switch model.photographyMode {
        case .panning:
            techniqueBox(
                title: "PANNING-TEKNIKK",
                text: "Følg flyet jevnt gjennom hele bevegelsen og fortsett etter at du har eksponert.",
                diagram: PanningDiagram()
            )
        case .propeller:
            techniqueBox(
                title: "PROPELL-TEKNIKK",
                text: "1/160 gir mykt propell-blur. Frossen propell ser unaturlig «parkert» ut.",
                diagram: PropellerDiagram()
            )
        default:
            EmptyView()
        }
    }

    private func techniqueBox(title: String, text: String, diagram: some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text(title)
                .font(.system(size: 10, weight: .bold)).tracking(0.8)
                .foregroundStyle(Theme.primaryBright)
            diagram.frame(height: 60).frame(maxWidth: .infinity)
            Text(text).font(.caption).foregroundStyle(Theme.textSecondary)
        }
        .card()
    }

    // ── Bruk anbefaling på kamera (CCAPI-write) ──────────────────────

    @ViewBuilder
    private var applyCard: some View {
        if model.camera.state.connected {
            VStack(spacing: Theme.spacingSM) {
                Button {
                    showApplyConfirm = true
                } label: {
                    Label(applying ? "Sender til kamera…" : "Bruk anbefaling på kamera",
                          systemImage: "arrow.down.circle.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.spacingMD)
                        .background(Theme.primary)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                }
                .disabled(applying)
                if let applyResult {
                    Text(applyResult).font(.caption).foregroundStyle(Theme.textSecondary)
                }
            }
            .confirmationDialog("Skrive innstillinger til kameraet?",
                                isPresented: $showApplyConfirm, titleVisibility: .visible) {
                Button("Bruk \(output.recommendation.shutterSpeed) · \(output.recommendation.aperture) · ISO \(output.recommendation.iso)") {
                    Task { await applyToCamera() }
                }
                Button("Avbryt", role: .cancel) {}
            }
        }
    }

    private func applyToCamera() async {
        applying = true
        applyResult = nil
        let rec = output.recommendation
        let ok = await model.camera.applySettings(
            shutter: rec.shutterSpeed,
            aperture: rec.aperture,
            iso: rec.iso == "Auto" ? nil : rec.iso
        )
        applyResult = ok ? "Kamera oppdatert ✓" : "Kunne ikke endre alle innstillinger."
        applying = false
    }

    // ── Nedlastinger til mobil (opt-in) + progress ───────────────────

    @ViewBuilder
    private var downloadsCard: some View {
        let store = model.photoDownload
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Toggle(isOn: Binding(
                get: { store.autoDownload },
                set: { store.autoDownload = $0 }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Last ned bilder til mobilen")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("Lagrer bildene du tar automatisk i Bilder")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                }
            }
            .tint(Theme.primary)

            ForEach(store.active) { item in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: iconFor(item.state))
                            .foregroundStyle(colorFor(item.state))
                        Text(item.fileName).font(.caption).foregroundStyle(Theme.textPrimary)
                        Spacer()
                        Text(labelFor(item)).font(.caption2).foregroundStyle(Theme.textSecondary)
                    }
                    if item.state == .downloading {
                        ProgressView(value: item.progress).tint(Theme.primaryBright)
                    }
                }
                .padding(.top, 4)
            }
        }
        .card()
    }

    private func iconFor(_ s: DownloadItem.State) -> String {
        switch s {
        case .downloading: return "arrow.down.circle"
        case .saving: return "square.and.arrow.down"
        case .done: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }
    private func colorFor(_ s: DownloadItem.State) -> Color {
        switch s {
        case .done: return Theme.success
        case .failed: return Theme.danger
        default: return Theme.primaryBright
        }
    }
    private func labelFor(_ item: DownloadItem) -> String {
        switch item.state {
        case .downloading: return "\(Int(item.progress * 100))%"
        case .saving: return "Lagrer…"
        case .done: return "Lagret ✓"
        case .failed: return "Feilet"
        }
    }

    // ── Lær av loggboken ─────────────────────────────────────────────

    @ViewBuilder
    private var learnCard: some View {
        if let type = model.nearestFlight?.flight.aircraftType,
           let past = lastShotOfType(type) {
            VStack(alignment: .leading, spacing: Theme.spacingXS) {
                Text("FRA LOGGBOKEN DIN")
                    .font(.system(size: 10, weight: .bold)).tracking(0.8)
                    .foregroundStyle(Theme.textSecondary)
                Text("Sist du fotograferte en \(type) brukte du \(pastSettingsText(past)).")
                    .font(.subheadline).foregroundStyle(Theme.textPrimary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.spacingMD)
            .background(Theme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
        }
    }

    private func lastShotOfType(_ type: String) -> LogbookEntry? {
        model.logbook.entries.first {
            $0.aircraftType == type &&
            ($0.shutterSpeed != nil || $0.aperture != nil || $0.iso != nil)
        }
    }

    private func pastSettingsText(_ e: LogbookEntry) -> String {
        var parts: [String] = []
        if let s = e.shutterSpeed { parts.append(s) }
        if let a = e.aperture { parts.append(a) }
        if let iso = e.iso { parts.append("ISO \(iso)") }
        if let f = e.focalLengthMm { parts.append("\(f) mm") }
        return parts.joined(separator: " · ")
    }

    // ── Spotting Session ─────────────────────────────────────────────

    @ViewBuilder
    private var sessionCard: some View {
        let session = model.session
        if session.isActive {
            VStack(alignment: .leading, spacing: Theme.spacingMD) {
                HStack {
                    Label("Session pågår", systemImage: "record.circle")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.danger)
                    Spacer()
                    if let started = session.startedAt {
                        Text(started, style: .timer)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                HStack(spacing: Theme.spacingSM) {
                    ValueTile(label: "Bilder", value: "\(session.photoCount)")
                    ValueTile(label: "Fly", value: "\(session.aircraft.count)")
                    ValueTile(
                        label: "Sjeldne",
                        value: "\(session.aircraft.values.filter { $0.rarity.rank >= 2 }.count)"
                    )
                }
                Button {
                    session.stop()
                } label: {
                    Text("Avslutt session")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.spacingMD)
                        .background(Theme.danger.opacity(0.85))
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                }
            }
            .card(elevated: true)
        } else {
            Button {
                session.start(
                    locationName: model.ranked.first?.location.name,
                    runway: model.runway?.runway
                )
            } label: {
                HStack {
                    Image(systemName: "record.circle")
                    Text("Start spotting session")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.spacingMD)
                .background(Theme.surfaceElevated)
                .foregroundStyle(Theme.primaryBright)
                .clipShape(Capsule())
            }
        }
    }

    private var modePicker: some View {
        @Bindable var model = model
        return Picker("Modus", selection: $model.photographyMode) {
            ForEach(PhotographyMode.allCases, id: \.self) { mode in
                Text(mode.label).tag(mode)
            }
        }
        .pickerStyle(.segmented)
    }

    private var output: CameraRecommendationService.Output {
        let nearest = model.nearestFlight
        let camera = model.camera.state
        // Tilkoblet Canon: bruk kameraets faktiske objektiv (crop 1.0 her
        // fordi kameraet melder faktisk mm). Ellers: brukerens gear-profil.
        let connectedLens = CameraRecommendationService.parseLensRange(camera.lensName)
        let lensRange = camera.connected ? connectedLens : model.gear.ownedLensRange
        let crop = camera.connected ? 1.0 : model.gear.body.cropFactor
        return CameraRecommendationService.recommend(
            CameraRecommendationService.Input(
                aircraftSpeedKt: nearest?.flight.groundSpeedKt,
                aircraftDistanceKm: nearest?.distanceKm,
                sunElevationDeg: model.sun?.elevationDeg,
                cloudCoverPct: model.weather?.cloudCoverPct,
                current: camera.connected ? camera.settings : nil,
                lensRange: lensRange,
                cropFactor: crop,
                mode: model.photographyMode
            )
        )
    }

    private var recommendationCard: some View {
        let out = output
        return VStack(alignment: .leading, spacing: Theme.spacingMD) {
            Text(recommendationTitle)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.primaryBright)
            HStack(spacing: Theme.spacingSM) {
                IconTile(
                    icon: "timer",
                    label: "Lukkertid",
                    value: out.recommendation.shutterSpeed,
                    subtitle: shutterSubtitle
                )
                IconTile(
                    icon: "camera.aperture",
                    label: "Blender",
                    value: out.recommendation.aperture,
                    subtitle: "Skarphet"
                )
                IconTile(
                    icon: "dial.medium",
                    label: "ISO",
                    value: out.recommendation.iso,
                    subtitle: isoSubtitle(out.recommendation.iso)
                )
            }
            HStack(spacing: Theme.spacingMD) {
                Image(systemName: "binoculars.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.primaryBright)
                VStack(alignment: .leading, spacing: 2) {
                    Text("OBJEKTIV ANBEFALING")
                        .font(.system(size: 9, weight: .semibold))
                        .tracking(0.5)
                        .foregroundStyle(Theme.textSecondary)
                    Text("\(out.recommendation.focalRange.lowerBound)–\(out.recommendation.focalRange.upperBound) mm")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                }
                Spacer()
                Text("Telezoom")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }
            .padding(Theme.spacingMD)
            .background(Theme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
            Text(out.recommendation.explanation)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
        }
        .card(elevated: true)
    }

    /// Viewfinder: live Canon-feed når streaming, ellers placeholder/asset.
    /// Fokus-brackets + live coaching-tips (Vision + Apple Intelligence).
    private var viewfinderCard: some View {
        ZStack {
            if usePhoneViewfinder {
                PhoneCameraPreview(session: phoneCam.session)
                    .frame(height: 190)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
            } else if let frame = model.liveView.frame {
                Image(uiImage: frame)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 190)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
            } else {
                PhotoPlaceholder(assetName: "viewfinder-aircraft", height: 190, symbol: "airplane")
            }
            // Fokus-brackets i hjørnene
            GeometryReader { geo in
                let inset: CGFloat = 26
                let len: CGFloat = 22
                Path { path in
                    let w = geo.size.width, h = geo.size.height
                    // fire hjørner
                    path.move(to: CGPoint(x: inset, y: inset + len))
                    path.addLine(to: CGPoint(x: inset, y: inset))
                    path.addLine(to: CGPoint(x: inset + len, y: inset))
                    path.move(to: CGPoint(x: w - inset - len, y: inset))
                    path.addLine(to: CGPoint(x: w - inset, y: inset))
                    path.addLine(to: CGPoint(x: w - inset, y: inset + len))
                    path.move(to: CGPoint(x: inset, y: h - inset - len))
                    path.addLine(to: CGPoint(x: inset, y: h - inset))
                    path.addLine(to: CGPoint(x: inset + len, y: h - inset))
                    path.move(to: CGPoint(x: w - inset - len, y: h - inset))
                    path.addLine(to: CGPoint(x: w - inset, y: h - inset))
                    path.addLine(to: CGPoint(x: w - inset, y: h - inset - len))
                }
                .stroke(Color.white.opacity(0.7), lineWidth: 1.5)
            }
            // Overlay: live coaching-tips (Canon live view eller telefon-søker)
            let coachingOn = model.liveView.isStreaming || usePhoneViewfinder
            let activeTip = usePhoneViewfinder ? phoneCam.tip : model.liveView.tip
            VStack {
                if coachingOn {
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles")
                            .font(.caption2)
                        Text("Live coaching")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, Theme.spacingSM)
                    .padding(.vertical, 4)
                    .background(Theme.primary.opacity(0.85))
                    .clipShape(Capsule())
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(Theme.spacingSM)
                }
                Spacer()
                if let tip = activeTip, coachingOn {
                    HStack(spacing: Theme.spacingSM) {
                        Image(systemName: tip.source == .appleIntelligence ? "apple.intelligence" : "lightbulb.fill")
                            .foregroundStyle(Theme.gold)
                        Text(tip.text)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(Theme.spacingMD)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
                    .padding(Theme.spacingSM)
                } else if coachingOn {
                    // Coaching på, men ikke noe tips ennå
                    Text("Analyserer bildet…")
                        .font(.caption).foregroundStyle(.white)
                        .padding(.horizontal, Theme.spacingMD).padding(.vertical, Theme.spacingSM)
                        .background(.ultraThinMaterial).clipShape(Capsule())
                        .padding(.bottom, Theme.spacingMD)
                } else if let sun = model.sun {
                    let light = SunService.lightQuality(
                        sunAzimuthDeg: sun.azimuthDeg,
                        sunElevationDeg: sun.elevationDeg,
                        shootingDirectionDeg: model.ranked.first?.location.shootingDirectionDeg ?? 0
                    )
                    Text(light.label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .padding(.horizontal, Theme.spacingMD)
                        .padding(.vertical, Theme.spacingSM)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                        .padding(.bottom, Theme.spacingMD)
                }
            }
        }
        .overlay(alignment: .bottomTrailing) {
            HStack(spacing: Theme.spacingSM) {
                // Telefon-søker (fungerer uten Canon)
                if !model.liveView.isStreaming {
                    Button {
                        togglePhoneViewfinder()
                    } label: {
                        Image(systemName: usePhoneViewfinder ? "iphone.slash" : "iphone.gen3")
                            .font(.title2).foregroundStyle(.white).shadow(radius: 3)
                    }
                }
                // Canon live view
                if model.camera.state.connected && !usePhoneViewfinder {
                    Button {
                        toggleLiveView()
                    } label: {
                        Image(systemName: model.liveView.isStreaming ? "stop.circle.fill" : "play.circle.fill")
                            .font(.title).foregroundStyle(.white).shadow(radius: 3)
                    }
                }
            }
            .padding(Theme.spacingSM)
        }
        .onDisappear {
            // Stopp søkeren helt når man forlater fanen — ellers henger
            // kamerabruk og coaching-state igjen (og prompt kan dukke opp).
            phoneCam.stop()
            usePhoneViewfinder = false
        }
    }

    private func togglePhoneViewfinder() {
        if usePhoneViewfinder {
            phoneCam.stop()
            usePhoneViewfinder = false
        } else {
            phoneCam.contextProvider = { [weak model] in
                guard let model else { return TipContext() }
                return TipContext(
                    aircraftType: model.nearestFlight?.flight.aircraftType,
                    distanceKm: model.nearestFlight?.distanceKm,
                    lightLabel: nil,
                    recommendedShutter: nil,
                    currentShutter: nil
                )
            }
            phoneCam.start()
            usePhoneViewfinder = true
        }
    }

    private func toggleLiveView() {
        guard let client = model.camera.client else { return }
        if model.liveView.isStreaming {
            model.liveView.stop(client: client)
        } else {
            model.liveView.contextProvider = { [weak model] in
                guard let model else { return TipContext() }
                let out = CameraRecommendationService.recommend(
                    CameraRecommendationService.Input(
                        aircraftSpeedKt: model.nearestFlight?.flight.groundSpeedKt,
                        aircraftDistanceKm: model.nearestFlight?.distanceKm,
                        sunElevationDeg: model.sun?.elevationDeg,
                        cloudCoverPct: model.weather?.cloudCoverPct,
                        current: model.camera.state.settings,
                        lensRange: CameraRecommendationService.parseLensRange(model.camera.state.lensName),
                        mode: model.photographyMode
                    )
                )
                return TipContext(
                    aircraftType: model.nearestFlight?.flight.aircraftType,
                    distanceKm: model.nearestFlight?.distanceKm,
                    lightLabel: nil,
                    recommendedShutter: out.recommendation.shutterSpeed,
                    currentShutter: model.camera.state.settings.shutterSpeed
                )
            }
            model.liveView.start(client: client)
        }
    }

    /// Dagens fototips med side-dots — trykk for neste.
    private var tipsCard: some View {
        Button {
            withAnimation { tipIndex = (tipIndex + 1) % PHOTO_TIPS.count }
        } label: {
            VStack(alignment: .leading, spacing: Theme.spacingMD) {
                HStack(spacing: Theme.spacingSM) {
                    Image(systemName: "lightbulb.fill")
                        .foregroundStyle(Theme.gold)
                    Text("DAGENS FOTOTIPS")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(Theme.textSecondary)
                }
                HStack(alignment: .top, spacing: Theme.spacingMD) {
                    Text(PHOTO_TIPS[tipIndex])
                        .font(.subheadline)
                        .foregroundStyle(Theme.textPrimary)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    PhotoPlaceholder(assetName: "tips-photo", height: 56, symbol: "photo")
                        .frame(width: 72)
                }
                HStack(spacing: 5) {
                    ForEach(0..<PHOTO_TIPS.count, id: \.self) { index in
                        Circle()
                            .fill(index == tipIndex ? Theme.primaryBright : Theme.textTertiary.opacity(0.4))
                            .frame(width: 5, height: 5)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
        }
        .buttonStyle(.plain)
    }

    private var shutterSubtitle: String {
        switch model.photographyMode {
        case .freeze: return "Frys bevegelse"
        case .panning: return "Bevegelsesuskarphet"
        case .propeller: return "Propell-blur"
        case .night: return "Håndholdt-grense"
        }
    }

    private func isoSubtitle(_ iso: String) -> String {
        if iso == "Auto" { return "Kameraet velger" }
        if let value = Int(iso) {
            return value <= 400 ? "Lavt støynivå" : "Hevet for lyset"
        }
        return ""
    }

    private var recommendationTitle: String {
        if let nearest = model.nearestFlight {
            return "ANBEFALT · \(nearest.flight.aircraftType ?? nearest.flight.callsign)"
        }
        return "ANBEFALT"
    }

    @ViewBuilder
    private var differencesCard: some View {
        let out = output
        if model.camera.state.connected {
            if out.differences.isEmpty {
                Label("Kameraet matcher anbefalingen", systemImage: "checkmark.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(Theme.success)
            } else {
                VStack(alignment: .leading, spacing: Theme.spacingMD) {
                    Text("AVVIK FRA KAMERAET DITT")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(Theme.warning)
                    ForEach(out.differences) { diff in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(diff.message)
                                .font(.subheadline)
                                .foregroundStyle(Theme.textPrimary)
                            Text("Anbefalt \(diff.recommended) · Nå \(diff.current)")
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
                .card()
            }
        }
    }

    @ViewBuilder
    private var cameraCard: some View {
        let state = model.camera.state
        if state.connected {
            connectedCamera(state)
        } else if state.reconnecting {
            VStack(alignment: .leading, spacing: Theme.spacingXS) {
                Text("Kamera frakoblet")
                    .font(.headline)
                    .foregroundStyle(Theme.warning)
                Text("Prøver å koble til igjen…")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
            }
            .card(elevated: true)
        } else {
            connectForm
        }
    }

    private func connectedCamera(_ state: ConnectedCameraState) -> some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            Label("Tilkoblet kamera", systemImage: "circle.fill")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.success)
            Text(state.model ?? "Canon")
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.textPrimary)
            if let lens = state.lensName {
                Text(lens)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
            }
            HStack(spacing: Theme.spacingSM) {
                ValueTile(label: "Lukker", value: state.settings.shutterSpeed ?? "–")
                ValueTile(label: "Blender", value: state.settings.aperture ?? "–")
                ValueTile(label: "ISO", value: state.settings.iso ?? "–")
            }
            if let battery = state.batteryLevel {
                ValueTile(label: "Batteri", value: battery)
            }
            if let captured = state.lastCaptureAt {
                Text("Siste bilde: \(formatTime(captured))")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
            Button("Koble fra") { model.camera.disconnect() }
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
        }
        .card(elevated: true)
    }

    private var connectForm: some View {
        @Bindable var camera = model.camera
        return VStack(alignment: .leading, spacing: Theme.spacingMD) {
            Text("Koble til Canon-kamera")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            Text("Få live kamerainnstillinger og smartere AeroSpot-anbefalinger via CCAPI. Kameraet må være på samme Wi-Fi.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
            TextField("Kameraets IP-adresse", text: $camera.ipAddress)
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
            if let error = connectError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Theme.danger)
            }
            Button {
                connecting = true
                connectError = nil
                Task {
                    await model.camera.connect()
                    connecting = false
                    if !model.camera.state.connected {
                        connectError = "Fikk ikke kontakt med kameraet. Sjekk IP og Wi-Fi."
                    }
                }
            } label: {
                Text(connecting ? "Kobler til…" : "Koble til")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.spacingMD)
                    .background(Theme.primary)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
            .disabled(connecting || camera.ipAddress.isEmpty)
        }
        .card(elevated: true)
    }
}

/// Panning: fly som glir jevnt langs en bue med bevegelses-streker.
private struct PanningDiagram: View {
    @State private var phase: CGFloat = 0
    var body: some View {
        Canvas { ctx, size in
            let y = size.height / 2
            // Bevegelses-streker
            for i in 0..<5 {
                let x = size.width * (0.15 + 0.12 * CGFloat(i))
                var p = Path()
                p.move(to: CGPoint(x: x - 18, y: y + CGFloat(i - 2) * 6))
                p.addLine(to: CGPoint(x: x + 10, y: y + CGFloat(i - 2) * 6))
                ctx.stroke(p, with: .color(Theme.textTertiary.opacity(0.5)), lineWidth: 2)
            }
            // Fly
            let planeX = size.width * (0.2 + 0.6 * phase)
            let plane = Image(systemName: "airplane")
            ctx.draw(plane, at: CGPoint(x: planeX, y: y))
        }
        .foregroundStyle(Theme.primaryBright)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) {
                phase = 1
            }
        }
    }
}

/// Propell: navet stille, blad-buer roterer (blur).
private struct PropellerDiagram: View {
    @State private var angle: Double = 0
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                ForEach(0..<3, id: \.self) { i in
                    Capsule()
                        .fill(Theme.primaryBright.opacity(0.35))
                        .frame(width: 4, height: 44)
                        .rotationEffect(.degrees(angle + Double(i) * 120))
                }
                Circle().fill(Theme.primaryBright).frame(width: 10, height: 10)
            }
            .frame(width: 50, height: 50)
            Text("myk blur, ikke frossen")
                .font(.caption2).foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .onAppear {
            withAnimation(.linear(duration: 0.5).repeatForever(autoreverses: false)) {
                angle = 360
            }
        }
    }
}
