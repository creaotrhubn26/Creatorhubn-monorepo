import SwiftUI

// MARK: - Source picker (capture session vs loose photos)

/// After the brief is sent, the photographer chooses what to hand the editor.
/// The recommended path is a capture session run through the cull theater so
/// only the keepers are uploaded — fewer files, lower per-image cost, faster
/// delivery. Loose photos from the library remain available as a fallback.
struct EditorSourcePicker: View {
    let jobId: String
    let vendorName: String
    let pricePerImage: Double?
    let onDone: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var sessions: [Session] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var chosenSession: Session?
    @State private var showLoose = false

    private var ownerUserId: String? { SignInService.shared.session?.userId }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label("Sendt til \(vendorName).", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(CHTheme.accent)
                        .listRowBackground(CHTheme.surface)
                } footer: {
                    Text("Velg en fotoøkt for å cull-e før du sender — du ser og godkjenner utvalget først. Eller send løse bilder fra biblioteket.")
                        .foregroundStyle(CHTheme.textMuted)
                }

                Section("Fotoøkter") {
                    if loading {
                        HStack { ProgressView().controlSize(.small); Text("Laster økter…").foregroundStyle(CHTheme.textMuted) }
                            .listRowBackground(CHTheme.surface)
                    } else if let errorMessage {
                        Text(errorMessage).foregroundStyle(CHTheme.warning).listRowBackground(CHTheme.surface)
                    } else if sessions.isEmpty {
                        Text("Ingen økter på denne enheten ennå.").foregroundStyle(CHTheme.textMuted)
                            .listRowBackground(CHTheme.surface)
                    } else {
                        ForEach(sessions) { s in
                            Button { chosenSession = s } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(s.name).foregroundStyle(CHTheme.textPrimary)
                                        Text(s.startsAt.formatted(date: .abbreviated, time: .shortened))
                                            .font(.caption2).foregroundStyle(CHTheme.textMuted)
                                    }
                                    Spacer()
                                    Image(systemName: "wand.and.stars").foregroundStyle(CHTheme.accent)
                                }
                            }
                            .listRowBackground(CHTheme.surface)
                        }
                    }
                }

                Section {
                    Button { showLoose = true } label: {
                        Label("Send løse bilder fra biblioteket", systemImage: "photo.on.rectangle.angled")
                            .foregroundStyle(CHTheme.textSecondary)
                    }
                    .listRowBackground(CHTheme.surface)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Kildefiler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Hopp over") { onDone() } } }
            .navigationDestination(item: $chosenSession) { s in
                CullTheaterView(sessionId: s.id, sessionName: s.name, jobId: jobId,
                                pricePerImage: pricePerImage, onDone: onDone)
            }
            .fullScreenCover(isPresented: $showLoose) {
                SourceUploadView(jobId: jobId, vendorName: vendorName, onDone: onDone)
            }
            .task { await load() }
        }
        .chBranded()
    }

    private func load() async {
        guard let ownerUserId else { errorMessage = "Ikke innlogget"; loading = false; return }
        do {
            let url = try AppDatabase.defaultDiskURL()
            let db = try AppDatabase.openOnDisk(at: url)
            sessions = try await SessionStore(database: db).listSessions(ownerUserId: ownerUserId)
        } catch {
            errorMessage = "Kunne ikke laste økter"
        }
        loading = false
    }
}

// MARK: - Cull theater model

@MainActor
@Observable
final class CullTheaterModel {
    let sessionId: UUID
    let jobId: String
    let pricePerImage: Double?
    private let ownerUserId: String

    private(set) var assets: [Asset] = []
    private(set) var verdicts: [String: CullVerdict] = [:]   // assetId.lowercased -> verdict
    var keptIds: Set<UUID> = []                               // current (overridable) keepers
    var strictness = "balanced"

    private(set) var loading = true
    private(set) var culling = false
    var sending = false
    private(set) var sentCount = 0
    var errorMessage: String?
    private(set) var hasAutoCulled = false

    init(sessionId: UUID, jobId: String, pricePerImage: Double?, ownerUserId: String) {
        self.sessionId = sessionId
        self.jobId = jobId
        self.pricePerImage = pricePerImage
        self.ownerUserId = ownerUserId
    }

    var total: Int { assets.count }
    var keptAssets: [Asset] { assets.filter { keptIds.contains($0.id) } }
    var culledAssets: [Asset] { assets.filter { !keptIds.contains($0.id) } }
    var droppedCount: Int { total - keptIds.count }

    /// Estimated kroner saved by not paying the editor per dropped image.
    var savingKr: Int? {
        guard let p = pricePerImage, p > 0 else { return nil }
        return Int((Double(droppedCount) * p).rounded())
    }

    private func cullStore() throws -> CullStore {
        let url = try AppDatabase.defaultDiskURL()
        let db = try AppDatabase.openOnDisk(at: url)
        return CullStore(database: db, outbox: Outbox(database: db))
    }

    func load() async {
        loading = assets.isEmpty
        do {
            assets = try await cullStore().assets(sessionId: sessionId, ownerUserId: ownerUserId)
            // Seed keepers from any decisions already made (LiveCull etc.):
            // keep unless explicitly rejected or rated a soft-reject.
            keptIds = Set(assets.filter { !$0.rejected && $0.rating != 2 }.map(\.id))
        } catch {
            errorMessage = "Kunne ikke laste bilder fra økten."
        }
        loading = false
    }

    /// Ask the backend classifier to sort the session, then apply its verdict
    /// as the initial keep/drop split (photographer can still override).
    func runAutoCull() async {
        guard let client = DashboardClient.make() else { return }
        culling = true; defer { culling = false }
        errorMessage = nil
        do {
            let result = try await client.cullSuggestions(
                sessionId: sessionId.uuidString.lowercased(), strictness: strictness)
            verdicts = result.verdicts
            var kept = Set<UUID>()
            for a in assets {
                let v = verdicts[a.id.uuidString.lowercased()]
                // No verdict -> default keep (don't silently drop the unknown).
                if let v { if CullSuggestions.keepBuckets.contains(v.bucket) { kept.insert(a.id) } }
                else { kept.insert(a.id) }
            }
            keptIds = kept
            hasAutoCulled = true
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? "Auto-cull feilet."
        }
    }

    func toggle(_ asset: Asset) {
        if keptIds.contains(asset.id) { keptIds.remove(asset.id) } else { keptIds.insert(asset.id) }
    }

    func verdict(for asset: Asset) -> CullVerdict? { verdicts[asset.id.uuidString.lowercased()] }

    /// Persist the keep/drop decisions (so the cull state survives) and upload
    /// only the keepers to the editor as source files.
    func approveAndSend() async {
        guard let client = DashboardClient.make() else { return }
        sending = true; sentCount = 0; errorMessage = nil
        defer { sending = false }

        // 1) Persist decisions locally + enqueue backend sync.
        if let store = try? cullStore() {
            for a in assets {
                let decision: CullDecision = keptIds.contains(a.id)
                    ? (a.flaggedForClient ? .hero : .keep) : .reject
                _ = try? await store.apply(decision, to: a.id, ownerUserId: ownerUserId)
            }
        }

        // 2) Upload the keepers' bytes to staging for the editor.
        for a in keptAssets {
            guard let path = a.fullKey ?? a.previewKey ?? a.displayPreviewKey,
                  let data = try? Data(contentsOf: URL(fileURLWithPath: path)) else { continue }
            do {
                try await client.sendSourceFile(jobId: jobId, fileName: a.originalFilename,
                                                 contentType: a.mime.isEmpty ? "image/jpeg" : a.mime, data: data)
                sentCount += 1
            } catch {
                errorMessage = (error as? DashboardError)?.localizedDescription ?? "Opplasting feilet."
            }
        }
    }
}

// MARK: - Cull theater view

/// The review-and-approve gate: every photo in the session, sorted into
/// **Sendes** (keepers) and **Droppes** (culled). The photographer sees the
/// full split, taps any photo to move it, then approves — only keepers upload.
struct CullTheaterView: View {
    @State private var model: CullTheaterModel
    let sessionName: String
    let onDone: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var didFinish = false

    private let strictnessOptions = ["conservative", "balanced", "aggressive"]
    private let strictnessLabels = ["conservative": "Mild", "balanced": "Balansert", "aggressive": "Streng"]

    init(sessionId: UUID, sessionName: String, jobId: String, pricePerImage: Double?, onDone: @escaping () -> Void) {
        let owner = SignInService.shared.session?.userId ?? ""
        _model = State(initialValue: CullTheaterModel(sessionId: sessionId, jobId: jobId,
                                                       pricePerImage: pricePerImage, ownerUserId: owner))
        self.sessionName = sessionName
        self.onDone = onDone
    }

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: 6)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                summaryCard
                controlsCard
                if model.loading {
                    ProgressView("Laster bilder…").frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    bucketSection(title: "Sendes", count: model.keptIds.count, tint: CHTheme.success,
                                  assets: model.keptAssets, kept: true)
                    bucketSection(title: "Droppes", count: model.droppedCount, tint: CHTheme.textMuted,
                                  assets: model.culledAssets, kept: false)
                }
            }
            .padding(16)
        }
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(sessionName)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) { sendBar }
        .task { await model.load() }
        .chBranded()
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(model.total) bilder i økten")
                .font(.headline).foregroundStyle(CHTheme.textPrimary)
            HStack(spacing: 16) {
                Label("\(model.keptIds.count) sendes", systemImage: "paperplane.fill")
                    .foregroundStyle(CHTheme.success)
                Label("\(model.droppedCount) droppes", systemImage: "tray.full")
                    .foregroundStyle(CHTheme.textMuted)
            }
            .font(.subheadline)
            if let saving = model.savingKr, saving > 0 {
                Label("Sparer ~\(saving) kr hos redigereren", systemImage: "banknote")
                    .font(.caption).foregroundStyle(CHTheme.accent)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private var controlsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Strenghet", selection: Binding(get: { model.strictness }, set: { model.strictness = $0 })) {
                ForEach(strictnessOptions, id: \.self) { Text(strictnessLabels[$0] ?? $0).tag($0) }
            }
            .pickerStyle(.segmented)
            .disabled(model.culling)
            Button {
                Task { await model.runAutoCull() }
            } label: {
                HStack {
                    if model.culling { ProgressView().controlSize(.small) }
                    Text(model.hasAutoCulled ? "Kjør auto-cull på nytt" : "Auto-cull forslag")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .tint(CHTheme.accent)
            .disabled(model.culling || model.total == 0)
            Text("Auto-cull bruker skarphet, øyne, eksponering og duplikat-grupper. Du kan flytte hvert bilde manuelt etterpå — du har siste ord.")
                .font(.caption2).foregroundStyle(CHTheme.textMuted)
            if let msg = model.errorMessage {
                Text(msg).font(.caption).foregroundStyle(CHTheme.warning)
            }
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private func bucketSection(title: String, count: Int, tint: Color, assets: [Asset], kept: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle().fill(tint).frame(width: 8, height: 8)
                Text("\(title) · \(count)").font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
            }
            if assets.isEmpty {
                Text(kept ? "Ingen bilder valgt." : "Ingenting droppet.").font(.caption).foregroundStyle(CHTheme.textMuted)
            } else {
                LazyVGrid(columns: columns, spacing: 6) {
                    ForEach(assets) { a in
                        CullThumb(asset: a, kept: kept, verdict: model.verdict(for: a)) { model.toggle(a) }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sendBar: some View {
        VStack(spacing: 6) {
            if model.sending {
                Text("Laster opp \(model.sentCount)/\(model.keptIds.count)…")
                    .font(.caption).foregroundStyle(CHTheme.textSecondary)
            }
            Button {
                Task {
                    await model.approveAndSend()
                    if model.errorMessage == nil { didFinish = true; onDone() }
                }
            } label: {
                Text(model.sending ? "Sender…" : "Godkjenn og send \(model.keptIds.count) bilder")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .tint(CHTheme.accent)
            .disabled(model.sending || model.keptIds.isEmpty)
        }
        .padding(12)
        .background(CHTheme.surface.overlay(CHTheme.border.frame(height: 0.5), alignment: .top).ignoresSafeArea(edges: .bottom))
    }
}

/// One photo in the theater grid. Tap to flip it between keep and drop.
private struct CullThumb: View {
    let asset: Asset
    let kept: Bool
    let verdict: CullVerdict?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack(alignment: .topTrailing) {
                Group {
                    if let path = asset.displayPreviewKey, let ui = UIImage(contentsOfFile: path) {
                        Image(uiImage: ui).resizable().scaledToFill()
                    } else {
                        ZStack { CHTheme.surfaceElevated; Image(systemName: "photo").foregroundStyle(CHTheme.textMuted) }
                    }
                }
                .frame(width: 96, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(kept ? CHTheme.success : Color.clear, lineWidth: 2))
                .opacity(kept ? 1 : 0.5)

                Image(systemName: kept ? "checkmark.circle.fill" : "minus.circle.fill")
                    .foregroundStyle(kept ? CHTheme.success : CHTheme.textMuted)
                    .background(Circle().fill(.black.opacity(0.4)))
                    .padding(4)

                if let v = verdict {
                    Text(bucketLabel(v.bucket))
                        .font(.system(size: 8, weight: .bold))
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(bucketTint(v.bucket).opacity(0.85), in: Capsule())
                        .foregroundStyle(.white)
                        .padding(4)
                        .frame(maxWidth: 96, maxHeight: 96, alignment: .bottomLeading)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private func bucketLabel(_ b: String) -> String {
        switch b { case "hero": return "HERO"; case "keep": return "KEEP"; case "weak": return "SVAK"; default: return "DROPP" }
    }
    private func bucketTint(_ b: String) -> Color {
        switch b { case "hero": return CHTheme.accent; case "keep": return CHTheme.success
        case "weak": return CHTheme.warning; default: return .red }
    }
}
