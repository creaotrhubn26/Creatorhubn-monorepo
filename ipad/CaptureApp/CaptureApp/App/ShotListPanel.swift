import SwiftUI

/// Prosjektets shot-list inne i capture-flyten — polert etter mockup, men
/// dette ER shot-list-løsningen (ikke et eget dashbord). Innhold:
/// auto-huk-status + toggle, fremdrift, «Auto-huket denne økta» m/ angre,
/// «Gjør dette neste», og shot-radene med filtre, «Ferdig · navn» + chips.
///
/// Drives av `LiveCaptureModel.selectedProjectDetail.shotList`. `isCompleted`
/// flippes optimistisk (localOverrides), backend via `setShotCompletion`.
struct ShotListPanel: View {
    @Bindable var model: LiveCaptureModel
    @Environment(\.dismiss) private var dismiss

    @State private var localOverrides: [String: Bool] = [:]
    @State private var autoCheckBusy = false
    @State private var autoCheckError: String?
    @State private var showBriefGenerator = false
    @State private var filter: ShotFilter = .all
    @State private var query = ""

    enum ShotFilter: String, CaseIterable { case all = "Alle", must = "Must-have", optional = "Valgfritt" }

    // Palett (matcher mockup — mørkt m/ grønn auto-huk + lilla «neste»).
    private enum C {
        static let bg = Color(hex: 0x0B0B0D)
        static let card = Color(hex: 0x161619)
        static let cardHi = Color(hex: 0x1C1C21)
        static let stroke = Color.white.opacity(0.07)
        static let green = Color(hex: 0x2FD27A)
        static let purple = Color(hex: 0x8B5CF6)
        static let textPri = Color(hex: 0xF3F3F5)
        static let textSec = Color.white.opacity(0.56)
        static let textDim = Color.white.opacity(0.38)
        static func prio(_ p: String?) -> Color {
            switch (p ?? "").lowercased() {
            case "critical", "must": return Color(hex: 0xE0606A)
            case "high": return Color(hex: 0xE0A955)
            case "medium": return Color(hex: 0xD8C24A)
            default: return Color.white.opacity(0.5)
            }
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let project = model.selectedProject {
                    if let detail = model.selectedProjectDetail {
                        if detail.shotList.isEmpty {
                            emptyShotList(projectTitle: project.title)
                        } else {
                            content(for: detail)
                        }
                    } else {
                        ProgressView("Laster shot-list …")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(C.bg)
                    }
                } else {
                    noProjectSelected
                }
            }
            .navigationTitle(model.selectedProject?.title ?? "Shot-list")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if model.selectedProject != nil {
                        Button { showBriefGenerator = true } label: {
                            Label("Fra brief", systemImage: "sparkles")
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Ferdig") { dismiss() } }
            }
            .onChange(of: model.selectedProjectDetail?.shotList) { _, newList in
                guard let newList else { return }
                for shot in newList where localOverrides[shot.id] == (shot.isCompleted ?? false) {
                    localOverrides.removeValue(forKey: shot.id)
                }
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showBriefGenerator) {
            let hasShots = !(model.selectedProjectDetail?.shotList.isEmpty ?? true)
            ShotListFromBriefView(
                onSave: { scenes in try await model.saveShotListFromBrief(scenes, append: hasShots) },
                fetchTimeline: { await model.fetchWeddingTimelineBrief() },
                saveLabel: hasShots ? "Legg til i shot-listen" : "Lagre til prosjektet",
                callSheetURL: { model.callSheetURL(scenes: $0) })
        }
    }

    // MARK: - Hovedinnhold

    private func content(for detail: BackendProjectDetail) -> some View {
        let shots = detail.shotList
        let nextShot = shots.first { !isCompleted($0) }
        return ScrollView {
            VStack(spacing: 14) {
                autoHukCard
                progressCard(detail.shotListSummary, shots: shots)
                if !model.autoCheckLog.isEmpty { autoCheckLogCard }
                if let nextShot { nextShotCard(nextShot) }
                shotsCard(shots)
            }
            .padding(16)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        }
        .background(C.bg)
    }

    // MARK: - Auto-huk-status + toggle

    private var autoHukCard: some View {
        let on = model.shotListAutoCheckEnabled
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("AUTO-HUK SHOTS", systemImage: "sparkles")
                    .font(.caption.weight(.bold)).foregroundStyle(on ? C.green : C.textSec)
                Spacer()
                Toggle("", isOn: Binding(get: { on }, set: { setAutoCheck($0) }))
                    .labelsHidden().tint(C.green).disabled(autoCheckBusy)
            }
            Text(on ? "Auto-huk er på" : "Auto-huk er av")
                .font(.title3.weight(.bold)).foregroundStyle(C.textPri)
            Text(autoCheckError ?? (on
                 ? "Vision huker av shots automatisk når du tar bildet. Gjelder hele teamet."
                 : "Av — hak av manuelt. Slå på for å la Vision gjøre det for teamet."))
                .font(.caption).foregroundStyle(autoCheckError == nil ? C.textSec : Color(hex: 0xE0606A))
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous).fill(
                on ? LinearGradient(colors: [Color(hex: 0x0E2A1C), Color(hex: 0x121913)], startPoint: .topLeading, endPoint: .bottomTrailing)
                   : LinearGradient(colors: [C.card, C.card], startPoint: .top, endPoint: .bottom)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(on ? C.green.opacity(0.25) : C.stroke))
    }

    // MARK: - Fremdrift

    private func progressCard(_ summary: BackendProjectShotListSummary?, shots: [BackendShotListItem]) -> some View {
        let done = shots.filter { isCompleted($0) }.count
        let total = max(shots.count, 1)
        let must = summary?.mustHaveShots ?? 0
        let mustDone = summary?.completedMustHave ?? 0
        let pct = Int((Double(done) / Double(total) * 100).rounded())
        return HStack(spacing: 18) {
            ZStack {
                Circle().stroke(Color.white.opacity(0.08), lineWidth: 9)
                Circle().trim(from: 0, to: Double(done) / Double(total))
                    .stroke(C.green, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: -1) {
                    Text("\(done)").font(.title3.weight(.bold)).foregroundStyle(C.textPri)
                    Text("av \(total)").font(.caption2).foregroundStyle(C.textSec)
                }
            }.frame(width: 78, height: 78)
            VStack(alignment: .leading, spacing: 4) {
                Text("\(pct)% fullført").font(.headline).foregroundStyle(C.textPri)
                if must > 0 {
                    Label("\(mustDone) av \(must) must-have gjort", systemImage: "checkmark.circle.fill")
                        .font(.caption.weight(.medium)).foregroundStyle(C.green)
                }
                Text(pct >= 100 ? "Alle shots fullført 🎉" : "\(total - done) shots gjenstår.")
                    .font(.caption).foregroundStyle(C.textSec)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(C.card))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(C.stroke))
    }

    // MARK: - Auto-huket denne økta (angre)

    private var autoCheckLogCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("AUTO-HUKET DENNE ØKTA (\(model.autoCheckLog.count))", systemImage: "sparkles")
                    .font(.caption.weight(.bold)).foregroundStyle(C.textSec)
                Spacer()
                Button("Angre alle") {
                    let ids = model.autoCheckLog.map(\.shotId)
                    Task { for id in ids { await model.undoAutoCheck(shotId: id) } }
                }.font(.caption.weight(.semibold)).foregroundStyle(C.purple)
            }
            ForEach(model.autoCheckLog) { entry in
                HStack(spacing: 12) {
                    thumb(for: entry.shotId).frame(width: 44, height: 40).clipShape(RoundedRectangle(cornerRadius: 9))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(entry.scene).font(.subheadline.weight(.semibold)).foregroundStyle(C.textPri)
                        Text("Auto-huket \(entry.at.formatted(date: .omitted, time: .shortened))")
                            .font(.caption2).foregroundStyle(C.textSec)
                    }
                    Spacer(minLength: 8)
                    Button { Task { await model.undoAutoCheck(shotId: entry.shotId) } } label: {
                        Text("Angre").font(.caption.weight(.semibold)).foregroundStyle(Color(hex: 0xE0A955))
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .overlay(Capsule().stroke(Color(hex: 0xE0A955).opacity(0.5)))
                    }.buttonStyle(.plain)
                }
                .padding(9).background(RoundedRectangle(cornerRadius: 12).fill(C.cardHi))
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(C.card))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(C.stroke))
    }

    // MARK: - Gjør dette neste

    private func nextShotCard(_ shot: BackendShotListItem) -> some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 12).fill(C.purple.opacity(0.18)).frame(width: 48, height: 48)
                .overlay(Image(systemName: "camera.viewfinder").foregroundStyle(C.purple))
            VStack(alignment: .leading, spacing: 2) {
                Label("GJØR DETTE NESTE", systemImage: "sparkles")
                    .font(.caption2.weight(.bold)).foregroundStyle(C.purple)
                Text(shot.scene).font(.subheadline.weight(.bold)).foregroundStyle(C.textPri).lineLimit(1)
                if let d = shot.description, !d.isEmpty {
                    Text(d).font(.caption).foregroundStyle(C.textSec).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            Button { toggleCompletion(shot) } label: {
                Text("Hak av").font(.subheadline.weight(.bold)).foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(C.purple, in: Capsule())
            }.buttonStyle(.plain)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(LinearGradient(colors: [Color(hex: 0x1A1530), C.card], startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(C.purple.opacity(0.28)))
    }

    // MARK: - Shots

    private func shotsCard(_ shots: [BackendShotListItem]) -> some View {
        let filtered = filteredSorted(shots)
        return VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text("SHOTS").font(.caption.weight(.bold)).foregroundStyle(C.textSec)
                ForEach(ShotFilter.allCases, id: \.self) { f in
                    Button { filter = f } label: {
                        Text(f.rawValue).font(.caption.weight(.semibold))
                            .foregroundStyle(filter == f ? .black : C.textSec)
                            .padding(.horizontal, 11).padding(.vertical, 5)
                            .background(filter == f ? C.green : .clear, in: Capsule())
                    }.buttonStyle(.plain)
                }
                Spacer()
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass").font(.caption).foregroundStyle(C.textDim)
                    TextField("Søk …", text: $query).font(.caption).foregroundStyle(C.textPri).frame(width: 110)
                }.padding(.horizontal, 11).padding(.vertical, 7).background(C.cardHi, in: Capsule())
            }
            .padding(.horizontal, 16).padding(.vertical, 14)

            ForEach(Array(filtered.enumerated()), id: \.element.id) { idx, shot in
                shotRow(index: idx + 1, shot: shot)
                if idx < filtered.count - 1 { Divider().overlay(C.stroke).padding(.leading, 72) }
            }
        }
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(C.card))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(C.stroke))
    }

    private func shotRow(index: Int, shot: BackendShotListItem) -> some View {
        let done = isCompleted(shot)
        return Button { toggleCompletion(shot) } label: {
            HStack(spacing: 13) {
                ZStack {
                    Circle().fill(done ? C.green : .clear)
                        .overlay(Circle().stroke(done ? C.green : C.textDim, lineWidth: 1.5))
                    if done { Image(systemName: "checkmark").font(.caption2.weight(.bold)).foregroundStyle(.black) }
                    else { Text("\(index)").font(.caption.weight(.bold)).foregroundStyle(C.textSec) }
                }.frame(width: 26, height: 26)
                thumb(for: shot.id).frame(width: 50, height: 42).clipShape(RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) {
                    Text(shot.scene).font(.subheadline.weight(.semibold))
                        .foregroundStyle(done ? C.textSec : C.textPri)
                        .strikethrough(done, color: C.textDim).lineLimit(1)
                    if let d = shot.description, !d.isEmpty {
                        Text(d).font(.caption2).foregroundStyle(C.textSec).lineLimit(1)
                    }
                }.frame(width: 190, alignment: .leading)
                if done, let by = shot.completedBy, !by.isEmpty { pill("Ferdig · \(by)", C.green) }
                else if done { pill("Ferdig", C.green) }
                if let p = shot.priority, !p.isEmpty { pill(p.capitalized, C.prio(p)) }
                if let t = shot.shotType, !t.isEmpty { pill(t.capitalized, Color(hex: 0x4A90E2)) }
                Spacer(minLength: 6)
                if let loc = shot.locationName, !loc.isEmpty {
                    Label(loc, systemImage: "mappin.and.ellipse").font(.caption2).foregroundStyle(C.textSec).lineLimit(1)
                }
                if let dur = shot.estimatedDuration {
                    Label("\(dur) min", systemImage: "clock").font(.caption2).foregroundStyle(C.textSec)
                }
            }
            .contentShape(Rectangle())
            .padding(.horizontal, 16).padding(.vertical, 11)
        }.buttonStyle(.plain)
    }

    private func pill(_ text: String, _ color: Color) -> some View {
        Text(text).font(.caption2.weight(.bold)).foregroundStyle(color)
            .padding(.horizontal, 9).padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
    }

    @ViewBuilder
    private func thumb(for shotId: String) -> some View {
        if let scene = ShotListPanel.demoThumbs[shotId] {
            MockPhotoView(scene: scene)
        } else {
            RoundedRectangle(cornerRadius: 9).fill(C.cardHi)
                .overlay(Image(systemName: "photo").font(.caption2).foregroundStyle(C.textDim))
        }
    }

    /// Demo-thumbnails pr shot-id. Ekte bruk kobler asset-previews senere.
    static var demoThumbs: [String: MockScene] = [:]

    // MARK: - Tom / ingen prosjekt

    private var noProjectSelected: some View {
        ContentUnavailableView("Ingen prosjekt valgt", systemImage: "folder.badge.questionmark",
            description: Text("Velg et prosjekt fra topplinjen for å se de planlagte shotsene."))
            .background(C.bg)
    }

    private func emptyShotList(projectTitle: String) -> some View {
        VStack(spacing: 20) {
            ContentUnavailableView("Ingen planlagte shots", systemImage: "checklist",
                description: Text("\(projectTitle) har ingen shot-list ennå. Generer én fra klient-briefen."))
            Button { showBriefGenerator = true } label: {
                Label("Generer fra brief", systemImage: "sparkles").font(.body.weight(.semibold))
                    .padding(.horizontal, 18).padding(.vertical, 11)
            }.buttonStyle(.borderedProminent).tint(C.green)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity).background(C.bg)
    }

    // MARK: - Logikk

    private func filteredSorted(_ shots: [BackendShotListItem]) -> [BackendShotListItem] {
        shots.filter { s in
            let f: Bool = {
                switch filter {
                case .all: return true
                case .must: return ["critical", "must", "high"].contains((s.priority ?? "").lowercased())
                case .optional: return !["critical", "must", "high"].contains((s.priority ?? "").lowercased())
                }
            }()
            return f && (query.isEmpty || s.scene.localizedCaseInsensitiveContains(query))
        }.sorted { priorityRank($0.priority) < priorityRank($1.priority) }
    }

    private func setAutoCheck(_ enabled: Bool) {
        let previous = model.shotListAutoCheckEnabled
        model.shotListAutoCheckEnabled = enabled
        autoCheckError = nil; autoCheckBusy = true
        Task {
            do { try await model.setShotListAutoCheck(enabled) }
            catch {
                await MainActor.run {
                    model.shotListAutoCheckEnabled = previous
                    autoCheckError = (error as? ShotAutoCheckError) == .notOwner
                        ? "Kun prosjekteier kan endre dette." : "Kunne ikke lagre — prøv igjen."
                }
            }
            await MainActor.run { autoCheckBusy = false }
        }
    }

    private func isCompleted(_ shot: BackendShotListItem) -> Bool {
        localOverrides[shot.id] ?? (shot.isCompleted ?? false)
    }

    private func toggleCompletion(_ shot: BackendShotListItem) {
        let previous = isCompleted(shot)
        let next = !previous
        localOverrides[shot.id] = next
        Task {
            do { try await model.setShotCompletion(shotId: shot.id, isCompleted: next) }
            catch { await MainActor.run { localOverrides[shot.id] = previous } }
        }
    }

    private func priorityRank(_ priority: String?) -> Int {
        switch priority?.lowercased() {
        case "critical", "must": return 0
        case "high": return 1
        case "medium": return 2
        case "low": return 3
        default: return 4
        }
    }
}
