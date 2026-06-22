import SwiftUI

// MARK: - Model

@MainActor
@Observable
final class RedigeringModel {
    private(set) var sessions: [Session] = []
    var session: Session?
    private(set) var assets: [Asset] = []
    var selectedId: UUID?

    /// The recipe being tuned for the selected asset (per-asset, kept locally).
    var recipe: MagicRecipe = .product
    var presetName: String = "Produkt Clean"
    /// Exposure in EV stops (-2…+2) — a true exposure control, applied on top
    /// of the recipe so it brightens/darkens the whole frame (not just shadows).
    var exposureEV: Double = 0

    /// AI-retusj toggles (distraction/dust/reflection removal).
    var dustRemoval = true
    var backgroundClean = true
    var reflectionRemoval = false

    /// Rendered "Etter" preview for the selected asset + current recipe.
    private(set) var afterImage: UIImage?
    private(set) var rendering = false

    private(set) var loading = true
    var errorMessage: String?

    /// Per-asset recipes applied via "Bruk på serie" / individual edits.
    private var applied: [UUID: MagicRecipe] = [:]
    /// Undo/redo stacks of the recipe for the selected asset.
    private var undo: [MagicRecipe] = []
    private var redo: [MagicRecipe] = []

    private var ownerUserId: String? { SignInService.shared.session?.userId }

    var selected: Asset? { assets.first { $0.id == selectedId } }
    var canUndo: Bool { !undo.isEmpty }
    var canRedo: Bool { !redo.isEmpty }
    var appliedCount: Int { applied.count }

    static let presets: [(String, MagicRecipe)] = [
        ("Produkt Clean", .product),
        ("Portrett", .portrait),
        ("Mat", .food),
        ("Landskap", .landscape),
        ("Nøytral", .neutral),
    ]

    func loadSessions() async {
        guard let ownerUserId else { errorMessage = "Ikke innlogget"; loading = false; return }
        do {
            let url = try AppDatabase.defaultDiskURL()
            let db = try AppDatabase.openOnDisk(at: url)
            sessions = try await SessionStore(database: db).listSessions(ownerUserId: ownerUserId)
            if session == nil { session = sessions.first }
            if let s = session { await loadAssets(s) }
        } catch { errorMessage = "Kunne ikke laste økter" }
        loading = false
    }

    func pick(_ s: Session) async { session = s; await loadAssets(s) }

    private func loadAssets(_ s: Session) async {
        guard let ownerUserId else { return }
        do {
            let url = try AppDatabase.defaultDiskURL()
            let db = try AppDatabase.openOnDisk(at: url)
            assets = try await CullStore(database: db, outbox: Outbox(database: db))
                .assets(sessionId: s.id, ownerUserId: ownerUserId)
            selectedId = assets.first?.id
            loadRecipeForSelection()
            await render()
        } catch { errorMessage = "Kunne ikke laste bilder" }
    }

    func select(_ asset: Asset) {
        selectedId = asset.id
        undo.removeAll(); redo.removeAll()
        loadRecipeForSelection()
        Task { await render() }
    }

    private func loadRecipeForSelection() {
        if let id = selectedId, let r = applied[id] { recipe = r }
    }

    func applyPreset(_ name: String, _ r: MagicRecipe) {
        pushUndo(); presetName = name; recipe = r
        Task { await render() }
    }

    /// Call when a slider commits (on release) — renders the real pipeline.
    func recipeChanged() { Task { await render() } }
    func beginEdit() { pushUndo() }

    func undoEdit() {
        guard let prev = undo.popLast() else { return }
        redo.append(recipe); recipe = prev; Task { await render() }
    }
    func redoEdit() {
        guard let next = redo.popLast() else { return }
        undo.append(recipe); recipe = next; Task { await render() }
    }

    private func pushUndo() { undo.append(recipe); redo.removeAll() }

    /// Apply the current recipe to every asset in the queue + persist the
    /// selected asset's edit so "Etter" survives across surfaces.
    func applyToSeries() {
        for a in assets { applied[a.id] = recipe }
        Task { await persistSelected() }
    }

    var working = false
    var statusMessage: String?

    private func services() -> (store: SessionStore, backend: BackendClient, dir: URL)? {
        guard let stored = SignInService.shared.session,
              let url = try? AppDatabase.defaultDiskURL(),
              let db = try? AppDatabase.openOnDisk(at: url) else { return nil }
        let store = SessionStore(database: db)
        let backend = BackendClient(baseURL: stored.backendBaseURL, authHeaders: SignInService.shared.authHeaders)
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("redigering", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return (store, backend, dir)
    }

    /// Real AI-retusj: detect distractions (Claude Vision) + inpaint via the
    /// existing native AutoCleanService, then reload so the cleaned image
    /// becomes the working base. Gated by the dust/background toggles.
    func runAIRetouch() async {
        guard dustRemoval || backgroundClean else { statusMessage = "Skru på Støvfjerning eller Bakgrunnsrydd først."; return }
        guard let asset = selected, let svc = services() else { return }
        working = true; statusMessage = "Analyserer og fjerner distraksjoner…"; defer { working = false }
        let auto = AutoCleanService(store: svc.store, backend: svc.backend)
        await auto.processAsset(asset, downloadDir: svc.dir, mode: .autoClean)
        await reloadSelected(svc.store, assetId: asset.id)
        let count = selected?.autoCleanedDetectionCount ?? 0
        statusMessage = count > 0 ? "Fjernet \(count) distraksjoner." : "Ingen distraksjoner funnet."
        await render()
    }

    /// Persist the current edit as the asset's enhanced variant (full-res),
    /// so other surfaces show "Etter".
    func persistSelected() async {
        guard let asset = selected, let svc = services() else { return }
        working = true; defer { working = false }
        let useRaw = asset.autoCleanedKey == nil ? asset.rawKey : nil
        let jpeg = asset.displayPreviewKey
        let r = recipe; let ev = exposureEV
        let data = await Task.detached(priority: .userInitiated) {
            RedigeringPipeline.renderExport(rawPath: useRaw, jpegPath: jpeg, recipe: r, exposureEV: ev)
        }.value
        guard let data else { return }
        let dest = svc.dir.appendingPathComponent("\(asset.id.uuidString)-enhanced.jpg")
        do {
            try data.write(to: dest, options: .atomic)
            try await svc.store.attachEnhancedKey(id: asset.id, key: dest.path)
            statusMessage = "Lagret forbedret versjon."
        } catch { statusMessage = "Kunne ikke lagre." }
    }

    private func reloadSelected(_ store: SessionStore, assetId: UUID) async {
        if let fresh = try? await store.fetchAsset(id: assetId),
           let idx = assets.firstIndex(where: { $0.id == assetId }) {
            assets[idx] = fresh
        }
    }

    /// Persist the current recipe as a named local preset.
    func saveAsPreset(_ name: String) {
        if let data = try? JSONEncoder().encode(recipe) {
            UserDefaults.standard.set(data, forKey: "creatorhub.redigering.preset.\(name)")
        }
        presetName = name
    }

    private func render() async {
        guard let asset = selected else { afterImage = nil; return }
        rendering = true
        // Use the RAW source for max quality, UNLESS AI-retusj has produced a
        // cleaned JPEG — then that cleaned image is the working base.
        let raw = asset.autoCleanedKey == nil ? asset.rawKey : nil
        let jpeg = asset.displayPreviewKey
        let r = recipe
        let ev = exposureEV
        let img = await Task.detached(priority: .userInitiated) {
            RedigeringPipeline.renderPreview(rawPath: raw, jpegPath: jpeg, recipe: r, exposureEV: ev)
        }.value
        afterImage = img
        rendering = false
    }
}

// MARK: - View

struct RedigeringView: View {
    @State private var model = RedigeringModel()
    @State private var zoom: CGFloat = 1

    var body: some View {
        NavigationStack {
            Group {
                if model.loading {
                    ProgressView("Laster bilder…").frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if model.assets.isEmpty {
                    ContentUnavailableView("Ingen bilder å redigere", systemImage: "wand.and.stars",
                                           description: Text("Velg en fotoøkt med importerte bilder."))
                } else {
                    content
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Redigering")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { sessionMenu } }
        }
        .task { await model.loadSessions() }
        .chBranded()
    }

    private var sessionMenu: some View {
        Menu {
            ForEach(model.sessions) { s in
                Button(s.name) { Task { await model.pick(s) } }
            }
        } label: {
            Label(model.session?.name ?? "Økt", systemImage: "chevron.down").labelStyle(.titleAndIcon)
        }
        .tint(CHTheme.accent)
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                subtitle
                HStack(alignment: .top, spacing: 16) {
                    VStack(spacing: 12) { compareCard; toolbarRow }
                    SmartEditPanel(model: model).frame(width: 320)
                }
                queueStrip
                StepFlow()
                bottomCards
            }
            .padding(16)
        }
    }

    private var subtitle: some View {
        HStack(spacing: 6) {
            Circle().fill(CHTheme.accent).frame(width: 7, height: 7)
            Text("\(model.assets.count) bilder importert · AI-analyse ferdig")
                .font(.subheadline).foregroundStyle(CHTheme.textSecondary)
        }
    }

    private var compareCard: some View {
        BeforeAfterCompare(
            beforePath: model.selected?.previewKey ?? model.selected?.displayPreviewKey,
            after: model.afterImage,
            rendering: model.rendering,
            zoom: $zoom,
        )
        .frame(height: 460)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var toolbarRow: some View {
        HStack(spacing: 0) {
            toolButton("Zoom", "plus.magnifyingglass", active: zoom > 1) { withAnimation { zoom = zoom > 1 ? 1 : 2 } }
            toolButton("Beskjær", "crop") {}
            toolButton("Sammenlign", "rectangle.split.2x1", active: true) {}
            toolButton("Masker", "paintbrush.pointed") {}
            toolButton("Angre", "arrow.uturn.backward", enabled: model.canUndo) { model.undoEdit() }
            toolButton("Gjør om", "arrow.uturn.forward", enabled: model.canRedo) { model.redoEdit() }
        }
        .padding(.vertical, 8)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    private func toolButton(_ title: String, _ icon: String, active: Bool = false, enabled: Bool = true, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                Text(title).font(.caption2)
            }
            .frame(maxWidth: .infinity)
            .foregroundStyle(active ? CHTheme.accent : (enabled ? CHTheme.textSecondary : CHTheme.textMuted))
        }
        .disabled(!enabled)
    }

    private var queueStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Bildkø (\(model.assets.count))", systemImage: "rectangle.stack")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text("Sortér: Opptaksrekkefølge").font(.caption).foregroundStyle(CHTheme.textMuted)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(model.assets) { a in
                        QueueThumb(asset: a, selected: a.id == model.selectedId) { model.select(a) }
                    }
                }
            }
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private var bottomCards: some View {
        HStack(alignment: .top, spacing: 12) {
            batchCard; suggestionsCard; deliveryCard
        }
    }

    private var batchCard: some View {
        InfoCard(title: "Batch-redigering", icon: "rectangle.on.rectangle") {
            row("checkmark.circle.fill", "\(model.appliedCount) bilder klare", CHTheme.success)
            row("clock", "\(max(0, model.assets.count - model.appliedCount)) i kø", CHTheme.textMuted)
            row("globe", "Levering: Web + Print", CHTheme.textSecondary)
            ProgressView(value: Double(model.appliedCount), total: Double(max(1, model.assets.count)))
                .tint(CHTheme.accent)
            Text("\(model.appliedCount) / \(model.assets.count) bilder").font(.caption2).foregroundStyle(CHTheme.textMuted)
        }
    }

    private var suggestionsCard: some View {
        InfoCard(title: "AI forslag", icon: "lightbulb") {
            suggestion("Match lys mot referanse")
            suggestion("Fjern støv på utvalgte bilder")
            suggestion("Lag web-versjon 2048px")
        }
    }

    private var deliveryCard: some View {
        InfoCard(title: "Levering", icon: "shippingbox") {
            HStack {
                VStack(alignment: .leading) {
                    Text("Neste levering").font(.caption).foregroundStyle(CHTheme.textMuted)
                    Text("18:00").font(.title2.weight(.bold)).foregroundStyle(CHTheme.textPrimary)
                }
                Spacer()
                Image(systemName: "clock").foregroundStyle(CHTheme.textMuted)
            }
            Text("Klientgalleri klargjøres").font(.caption).foregroundStyle(CHTheme.textMuted)
            ProgressView(value: 0.7).tint(CHTheme.accent)
        }
    }

    private func row(_ icon: String, _ text: String, _ tint: Color) -> some View {
        Label(text, systemImage: icon).font(.caption).foregroundStyle(tint)
    }
    private func suggestion(_ text: String) -> some View {
        HStack {
            Image(systemName: "sparkles").foregroundStyle(CHTheme.accent)
            Text(text).font(.caption).foregroundStyle(CHTheme.textSecondary)
            Spacer()
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(CHTheme.textMuted)
        }
    }
}

// MARK: - Before/After compare

struct BeforeAfterCompare: View {
    let beforePath: String?
    let after: UIImage?
    let rendering: Bool
    @Binding var zoom: CGFloat
    @State private var split: CGFloat = 0.5
    @GestureState private var pinch: CGFloat = 1

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                CHTheme.surfaceElevated
                if let beforePath, let before = UIImage(contentsOfFile: beforePath) {
                    Image(uiImage: before).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                }
                if let after {
                    Image(uiImage: after).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                        .mask(alignment: .leading) {
                            Rectangle().frame(width: geo.size.width * split)
                        }
                }
                labels
                handle(in: geo)
                if rendering {
                    ProgressView().padding(8).background(.black.opacity(0.4), in: Circle())
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .scaleEffect(max(1, zoom * pinch))
            .contentShape(Rectangle())
            .gesture(DragGesture().onChanged { v in
                split = min(1, max(0, v.location.x / geo.size.width))
            })
            .simultaneousGesture(
                MagnificationGesture()
                    .updating($pinch) { value, state, _ in state = value }
                    .onEnded { value in zoom = min(4, max(1, zoom * value)) }
            )
        }
    }

    private var labels: some View {
        VStack {
            HStack {
                tag("Før"); Spacer(); tag("Etter")
            }.padding(10)
            Spacer()
        }
    }
    private func tag(_ t: String) -> some View {
        Text(t).font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 5)
            .background(.black.opacity(0.45), in: Capsule()).foregroundStyle(.white)
    }
    private func handle(in geo: GeometryProxy) -> some View {
        ZStack {
            Rectangle().fill(.white.opacity(0.8)).frame(width: 1.5)
            Image(systemName: "arrow.left.and.right.circle.fill")
                .font(.title).foregroundStyle(.white).background(Circle().fill(CHTheme.accent))
        }
        .position(x: geo.size.width * split, y: geo.size.height / 2)
    }
}

// MARK: - Smart Edit panel

struct SmartEditPanel: View {
    @Bindable var model: RedigeringModel
    @State private var showSavePreset = false
    @State private var presetDraft = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("Smart Edit", systemImage: "sparkles").font(.headline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Image(systemName: "ellipsis").foregroundStyle(CHTheme.textMuted)
            }
            Menu {
                ForEach(RedigeringModel.presets, id: \.0) { name, r in
                    Button(name) { model.applyPreset(name, r) }
                }
            } label: {
                HStack {
                    Text("Preset: \(model.presetName)").foregroundStyle(CHTheme.textPrimary)
                    Spacer(); Image(systemName: "chevron.down").foregroundStyle(CHTheme.textMuted)
                }
                .padding(10).background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10))
            }

            slider("Eksponering", systemImage: "sun.max", value: $model.exposureEV, range: -2...2, signed: true)
            slider("Kontrast", systemImage: "circle.lefthalf.filled", value: $model.recipe.contrast, range: -1...1, signed: true)
            slider("Skarphet", systemImage: "triangle", value: $model.recipe.texture, range: 0...1, signed: false)
            slider("Metning", systemImage: "drop", value: $model.recipe.saturation, range: -1...1, signed: true)

            warmthRow
            Divider().overlay(CHTheme.border)
            toggleRow("Støvfjerning", systemImage: "sparkle", isOn: $model.dustRemoval)
            toggleRow("Bakgrunnsrydd", systemImage: "scissors", isOn: $model.backgroundClean)
            toggleRow("Fjern refleks", systemImage: "circle.dashed", isOn: $model.reflectionRemoval)

            Button { Task { await model.runAIRetouch() } } label: {
                HStack {
                    if model.working { ProgressView().controlSize(.small) }
                    Label("Kjør AI-retusj", systemImage: "wand.and.stars.inverse")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered).controlSize(.large).tint(CHTheme.accent)
            .disabled(model.working)

            if let msg = model.statusMessage {
                Text(msg).font(.caption2).foregroundStyle(CHTheme.textMuted)
            }

            Button { model.applyToSeries() } label: {
                Label("Bruk på serie", systemImage: "sparkles").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent).controlSize(.large).tint(CHTheme.accent)

            Button { showSavePreset = true } label: {
                Label("Lagre som preset", systemImage: "bookmark").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered).controlSize(.large).tint(CHTheme.accent)
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 16))
        .alert("Lagre preset", isPresented: $showSavePreset) {
            TextField("Navn", text: $presetDraft)
            Button("Lagre") { if !presetDraft.isEmpty { model.saveAsPreset(presetDraft); presetDraft = "" } }
            Button("Avbryt", role: .cancel) {}
        }
    }

    private func slider(_ title: String, systemImage: String, value: Binding<Double>, range: ClosedRange<Double>, signed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Label(title, systemImage: systemImage).font(.subheadline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text(displayValue(value.wrappedValue, range: range, signed: signed))
                    .font(.caption).foregroundStyle(CHTheme.accentSoft)
            }
            Slider(value: value, in: range) { editing in
                if editing { model.beginEdit() } else { model.recipeChanged() }
            }
            .tint(CHTheme.accent)
        }
    }

    private func displayValue(_ v: Double, range: ClosedRange<Double>, signed: Bool) -> String {
        if signed { return String(format: "%+.0f", v * 100 / max(1, range.upperBound) * range.upperBound) }
        return "\(Int(v * 100)) %"
    }

    private var warmthRow: some View {
        HStack {
            Label("Fargebalanse", systemImage: "thermometer.medium").font(.subheadline).foregroundStyle(CHTheme.textPrimary)
            Spacer()
            Menu {
                Button("Kald") { model.beginEdit(); model.recipe.warmth = -0.25; model.recipeChanged() }
                Button("Nøytral") { model.beginEdit(); model.recipe.warmth = 0; model.recipeChanged() }
                Button("Varm") { model.beginEdit(); model.recipe.warmth = 0.25; model.recipeChanged() }
            } label: {
                Text(model.recipe.warmth > 0.05 ? "Varm" : (model.recipe.warmth < -0.05 ? "Kald" : "Nøytral"))
                    .foregroundStyle(CHTheme.accentSoft)
                Image(systemName: "chevron.right").font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
        }
    }

    private func toggleRow(_ title: String, systemImage: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            Label(title, systemImage: systemImage).font(.subheadline).foregroundStyle(CHTheme.textPrimary)
        }
        .tint(CHTheme.accent)
    }
}

// MARK: - Queue thumb / step flow / info card

private struct QueueThumb: View {
    let asset: Asset
    let selected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack(alignment: .bottomLeading) {
                Group {
                    if let path = asset.displayPreviewKey, let ui = UIImage(contentsOfFile: path) {
                        Image(uiImage: ui).resizable().scaledToFill()
                    } else {
                        ZStack { CHTheme.surfaceElevated; Image(systemName: "photo").foregroundStyle(CHTheme.textMuted) }
                    }
                }
                .frame(width: 92, height: 92).clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(selected ? CHTheme.accent : .clear, lineWidth: 2))

                if asset.signals.faceCount ?? 0 > 0 {
                    Text("AI").font(.system(size: 8, weight: .bold)).padding(.horizontal, 4).padding(.vertical, 1)
                        .background(CHTheme.accent.opacity(0.85), in: Capsule()).foregroundStyle(.white).padding(4)
                }
            }
            .overlay(alignment: .topTrailing) {
                if asset.rating >= 4 || asset.flaggedForClient {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(CHTheme.success)
                        .background(Circle().fill(.black.opacity(0.4))).padding(4)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

private struct StepFlow: View {
    private let steps = ["Cull", "Preset", "AI Retusj", "Kvalitetssjekk", "Eksporter"]
    private let current = 2
    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.offset) { idx, label in
                HStack(spacing: 6) {
                    if idx < current {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(CHTheme.success)
                    } else if idx == current {
                        Text("\(idx + 1)").font(.caption.weight(.bold)).foregroundStyle(.white)
                            .frame(width: 20, height: 20).background(Circle().fill(CHTheme.accent))
                    } else {
                        Text("\(idx + 1)").font(.caption).foregroundStyle(CHTheme.textMuted)
                            .frame(width: 20, height: 20).overlay(Circle().strokeBorder(CHTheme.border))
                    }
                    Text(label).font(.caption).foregroundStyle(idx <= current ? CHTheme.textPrimary : CHTheme.textMuted)
                }
                if idx < steps.count - 1 { Image(systemName: "chevron.right").font(.caption2).foregroundStyle(CHTheme.textMuted).frame(maxWidth: .infinity) }
            }
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct InfoCard<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon).font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }
}
