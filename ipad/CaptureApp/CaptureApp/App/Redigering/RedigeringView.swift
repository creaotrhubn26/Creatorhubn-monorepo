import SwiftUI
import CoreImage
import Vision

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

    /// «Min stil (lært)» — påfør fotografens arkiv-lærte profil (per-kanal-LUT +
    /// a/b, scene-matchet on-device) oppå den valgte recipen. Kun tilgjengelig
    /// når en profil er bundlet/lastet (``LearnedStyleStore``).
    /// Valgt lært stil (indeks i ``LearnedStyleStore.styles``); nil = av.
    var learnedStyleIndex: Int? = LearnedStyleStore.demoForceStyleIndex
    /// Auto: motoren velger looken som passer bildets lys (per bilde).
    var learnedStyleAuto: Bool = LearnedStyleStore.demoForceAuto
    var hasLearnedStyle: Bool { LearnedStyleStore.shared.isAvailable }
    var learnedStyleNames: [String] { LearnedStyleStore.shared.styleNames }

    /// Trykk-på-ansikt (lokal justering): detekterte ansikter i NORMALISERTE
    /// CI-koordinater (0–1, origo nede-venstre) + per-ansikt justering + valgt.
    var faceRectsNorm: [CGRect] = []
    var faceAdjust: [Int: FaceLocalAdjustFilter.Adjust] = [:]
    var activeFace: Int?
    var localFaceMode = ProcessInfo.processInfo.arguments.contains("--face-on")

    /// (normalisert rekt, justering) for ansikter med en aktiv lokal justering.
    var activeFaceAdjustments: [(norm: CGRect, adj: FaceLocalAdjustFilter.Adjust)] {
        faceRectsNorm.indices.compactMap { i in
            guard let a = faceAdjust[i], a.isActive else { return nil }
            return (faceRectsNorm[i], a)
        }
    }

    /// Detektér ansikter i «Etter»-bildet → normaliserte CI-rekter (for tapping
    /// + maskert lokal justering). Kjøres når lokal ansikts-modus slås på.
    func detectFacesForLocal() {
        guard let after = afterImage, let cg = after.cgImage else { faceRectsNorm = []; return }
        // OFF-MAIN: Vision-ansiktsdeteksjon frøs UI-en (synkron CIDetector high-
        // accuracy på 1600px, re-kjørt etter hver render). Kjør detached, kun
        // [CGRect] (Sendable) tilbake til MainActor. Vision gir NORMALISERTE
        // nede-venstre-rekter direkte — samme konvensjon som `faceRectsNorm`.
        nonisolated(unsafe) let src = cg
        Task {
            let rects = await Task.detached(priority: .userInitiated) { () -> [CGRect] in
                let req = VNDetectFaceRectanglesRequest()
                let handler = VNImageRequestHandler(cgImage: src, orientation: .up, options: [:])
                try? handler.perform([req])
                return (req.results ?? [])
                    .map(\.boundingBox)
                    .filter { $0.width > 0.01 && $0.height > 0.01 }
            }.value
            faceRectsNorm = rects
            if activeFace == nil, !rects.isEmpty { activeFace = 0 }
            // Demo-hekte: forhåndsvis en lokal justering på ansikt 0.
            if ProcessInfo.processInfo.arguments.contains("--face-demo"),
               faceAdjust.isEmpty, !rects.isEmpty {
                faceAdjust[0] = .init(brightness: 0.55, warmth: 0.3)
                await render()
            }
        }
    }

    func setFaceAdjust(_ adj: FaceLocalAdjustFilter.Adjust, for index: Int) {
        faceAdjust[index] = adj
        Task { await render() }
    }

    /// Rendered "Etter" preview for the selected asset + current recipe.
    private(set) var afterImage: UIImage?
    private(set) var rendering = false
    /// Monotont løpenummer per render. En detached render tar sekunder (RAW-
    /// dekoding); bytter brukeren asset eller slipper en slider på nytt i mellom-
    /// tiden, må det GAMLE resultatet forkastes — ellers lander feil bilde oppå.
    private var renderGeneration = 0

    /// Kamera-EXIF (ISO/blender/lukker/brennvidde) for det valgte bildet — lest
    /// fra RAW/JPEG ved valg. Vises i editoren; nil når fila mangler metadata.
    private(set) var exif: ExifInfo?

    private(set) var loading = true
    var errorMessage: String?

    /// Per-asset recipes applied via "Bruk på serie" / individual edits.
    private var applied: [UUID: MagicRecipe] = [:]
    /// Per-asset crop (normalised rect, origin top-left).
    private var crops: [UUID: CGRect] = [:]
    /// Full-series batch progress.
    private(set) var seriesProgress = 0
    private(set) var seriesTotal = 0
    /// Undo/redo stacks of the recipe for the selected asset.
    private var undo: [MagicRecipe] = []
    private var redo: [MagicRecipe] = []

    private var ownerUserId: String? { SignInService.shared.session?.userId }

    var selected: Asset? { assets.first { $0.id == selectedId } }
    var canUndo: Bool { !undo.isEmpty }
    var canRedo: Bool { !redo.isEmpty }
    var appliedCount: Int { applied.count }

    static let presets: [(String, MagicRecipe)] = [
        ("Bryllup", .wedding),
        ("Portra Clean", .portraClean),
        ("Reception Warm", .receptionWarm),
        ("Bright & Airy", .brightAiry),
        ("Portrett", .portrait),
        ("Produkt Clean", .product),
        ("Mat", .food),
        ("Landskap", .landscape),
        ("Nøytral", .neutral)
    ]

    func loadSessions() async {
        guard let ownerUserId else { errorMessage = "Ikke innlogget"; loading = false; return }
        #if DEBUG
        await RedigeringSampleSeeder.seedIfNeeded(ownerUserId: ownerUserId)
        #endif
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
            loadExifForSelection()
            await render()
        } catch { errorMessage = "Kunne ikke laste bilder" }
    }

    /// Les kamera-EXIF for det valgte bildet (RAW først, ellers preview-JPEG).
    private func loadExifForSelection() {
        exif = ExifInfo.read(fromPath: selected?.rawKey ?? selected?.displayPreviewKey)
    }

    func select(_ asset: Asset) {
        selectedId = asset.id
        undo.removeAll(); redo.removeAll()
        loadExifForSelection()
        loadRecipeForSelection()
        Task { await render() }
    }

    private func loadRecipeForSelection() {
        guard let id = selectedId else { return }
        // Restore persisted edit (survives crash/teardown), else the in-memory
        // cache, else defaults.
        if let saved = RedigeringEditStore.load(id) {
            recipe = saved.recipe; exposureEV = saved.exposureEV
            crops[id] = saved.crop
            applied[id] = saved.recipe
            syncPresetName(to: saved.recipe)
        } else if let r = applied[id] {
            recipe = r
            syncPresetName(to: r)
        } else {
            exposureEV = 0
        }
    }

    /// Hold preset-etiketten i takt med recipen som lastes (persistert edit) så
    /// UI-en viser «Bryllup» i stedet for standard-navnet når recipen matcher.
    private func syncPresetName(to r: MagicRecipe) {
        if let match = Self.presets.first(where: { $0.1 == r }) { presetName = match.0 }
    }

    /// Persist the selected asset's current edit state to disk.
    private func persistEdit() {
        guard let id = selectedId else { return }
        applied[id] = recipe
        RedigeringEditStore.save(id, .init(recipe: recipe, exposureEV: exposureEV, crop: crops[id]))
    }

    func applyPreset(_ name: String, _ r: MagicRecipe) {
        pushUndo(); presetName = name; recipe = r
        persistEdit()
        Task { await render() }
    }

    /// Call when a slider commits (on release) — renders the real pipeline.
    func recipeChanged() { persistEdit(); Task { await render() } }
    func beginEdit() { pushUndo() }

    func undoEdit() {
        guard let prev = undo.popLast() else { return }
        redo.append(recipe); recipe = prev; persistEdit(); Task { await render() }
    }
    func redoEdit() {
        guard let next = redo.popLast() else { return }
        undo.append(recipe); recipe = next; persistEdit(); Task { await render() }
    }

    private func pushUndo() { undo.append(recipe); redo.removeAll() }

    /// Apply the current recipe to every asset, then render + persist each one
    /// full-res in the background (real batch). Crop is per-asset; the recipe +
    /// exposure + reflection apply to all.
    func applyToSeries() {
        for a in assets { applied[a.id] = recipe }
        Task { await persistSeries() }
    }

    private func persistSeries() async {
        guard let svc = services() else { return }
        working = true; seriesTotal = assets.count; seriesProgress = 0
        defer { working = false; seriesTotal = 0 }
        let r = effectiveRecipe(); let ev = exposureEV
        var failed: [String] = []
        for a in assets {
            let useRaw = a.autoCleanedKey == nil ? a.rawKey : nil
            let jpeg = a.displayPreviewKey
            let crop = crops[a.id]
            // PERSISTÉR selve oppskriften per asset (ikke bare den eksporterte
            // JPEG-en) — ellers er edits/crops borte etter app-restart for alle
            // unntatt det valgte bildet. `applied` holdes også i sync.
            applied[a.id] = recipe
            RedigeringEditStore.save(a.id, .init(recipe: recipe, exposureEV: ev, crop: crop))
            let data = await Task.detached(priority: .utility) {
                RedigeringPipeline.renderExport(rawPath: useRaw, jpegPath: jpeg, recipe: r, exposureEV: ev, crop: crop)
            }.value
            var ok = false
            if let data {
                let dest = svc.dir.appendingPathComponent("\(a.id.uuidString)-enhanced.jpg")
                if (try? data.write(to: dest, options: .atomic)) != nil {
                    try? await svc.store.attachEnhancedKey(id: a.id, key: dest.path)
                    ok = true
                }
            }
            if !ok { failed.append(a.originalFilename) }
            seriesProgress += 1
        }
        let saved = assets.count - failed.count
        statusMessage = failed.isEmpty
            ? "Lagret \(saved) bilder."
            : "Lagret \(saved), feilet \(failed.count): \(failed.prefix(3).joined(separator: ", "))\(failed.count > 3 ? "…" : "")"
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
        let r = effectiveRecipe(); let ev = exposureEV; let crop = crops[asset.id]
        let data = await Task.detached(priority: .userInitiated) {
            RedigeringPipeline.renderExport(rawPath: useRaw, jpegPath: jpeg, recipe: r, exposureEV: ev, crop: crop)
        }.value
        guard let data else { statusMessage = "Kunne ikke lagre — bildet lot seg ikke dekode/rendre."; return }
        let dest = svc.dir.appendingPathComponent("\(asset.id.uuidString)-enhanced.jpg")
        do {
            try data.write(to: dest, options: .atomic)
            try await svc.store.attachEnhancedKey(id: asset.id, key: dest.path)
            statusMessage = "Lagret forbedret versjon."
        } catch { statusMessage = "Kunne ikke lagre." }
    }

    /// Masker tool: remove whatever the photographer marked. Builds a PNG mask
    /// (white = remove) from a normalised rect and runs the real inpaint
    /// endpoint, then makes the cleaned image the working base.
    func runManualInpaint(normalizedRect: CGRect) async {
        guard let asset = selected, let svc = services() else { return }
        guard let srcPath = asset.displayPreviewKey,
              let imageData = try? Data(contentsOf: URL(fileURLWithPath: srcPath)),
              let img = UIImage(data: imageData), let cg = img.cgImage else { return }
        working = true; statusMessage = "Fjerner markert område…"; defer { working = false }
        let w = cg.width, h = cg.height
        let rectPx = CGRect(x: normalizedRect.minX * CGFloat(w), y: normalizedRect.minY * CGFloat(h),
                            width: normalizedRect.width * CGFloat(w), height: normalizedRect.height * CGFloat(h))
        let format = UIGraphicsImageRendererFormat.default(); format.scale = 1; format.opaque = true
        let maskPng = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: format).image { _ in
            UIColor.black.setFill(); UIBezierPath(rect: CGRect(x: 0, y: 0, width: w, height: h)).fill()
            UIColor.white.setFill(); UIBezierPath(rect: rectPx).fill()
        }.pngData()
        guard let maskPng else { return }
        do {
            let resp = try await svc.backend.requestPhotoEnhancerInpaint(
                imageData: imageData, imageMimeType: "image/jpeg", maskPngData: maskPng, intensity: 1.0)
            guard let bytes = Data(base64Encoded: resp.imageBase64) else { statusMessage = "Inpaint feilet."; return }
            let dest = svc.dir.appendingPathComponent("\(asset.id.uuidString)-masked.jpg")
            try bytes.write(to: dest, options: .atomic)
            try await svc.store.attachAutoCleanedKey(id: asset.id, key: dest.path, detectionCount: 1)
            await reloadSelected(svc.store, assetId: asset.id)
            statusMessage = "Område fjernet."
            await render()
        } catch { statusMessage = "Inpaint feilet." }
    }

    private func reloadSelected(_ store: SessionStore, assetId: UUID) async {
        if let fresh = try? await store.fetchAsset(id: assetId),
           let idx = assets.firstIndex(where: { $0.id == assetId }) {
            assets[idx] = fresh
        }
    }

    /// Reload the selected asset from disk + re-render (after a Sky enhance).
    func refreshSelected() async {
        guard let id = selectedId, let svc = services() else { return }
        await reloadSelected(svc.store, assetId: id)
        await render()
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
        renderGeneration += 1
        let gen = renderGeneration
        rendering = true
        // Working base priority: server "sky" enhance → AI-cleaned → RAW.
        // Local recipe/exposure/crop layer on top of whichever base.
        let serverEnhanced = asset.serverEnhancedKey
        let cleaned = asset.autoCleanedKey
        let raw = (serverEnhanced == nil && cleaned == nil) ? asset.rawKey : nil
        let jpeg = serverEnhanced ?? cleaned ?? asset.displayPreviewKey
        let styles = LearnedStyleStore.shared.styles
        let manualScenes: [LearnedStyleProfile.Scene]? = {
            guard let i = learnedStyleIndex, styles.indices.contains(i) else { return nil }
            return styles[i].scenes
        }()
        let auto = learnedStyleAuto && !styles.isEmpty
        // Lært stil er en KOMPLETT look (nøytral→levert). Stables den oppå en
        // annen recipe dobbelt-prosesserer den → bruk en FLAT base når en stil
        // (eller auto) er aktiv: INGEN auto-enhance/skygge-løft (som .neutral har
        // og som blåser opp lyse scener), kun høylys-vern. Da opererer LUT-en på
        // et sant nøytralt utgangspunkt i stedet for et alt-oppløftet.
        let learnedActive = manualScenes != nil || auto
        let learnedBase = MagicRecipe(highlightRecovery: 0.30, autoEnhance: false)
        let r = learnedActive ? learnedBase : effectiveRecipe()
        let ev = exposureEV
        let crop = crops[asset.id]
        let faceAdj = activeFaceAdjustments   // [(normRect, adj)] — lokal ansikts-justering
        let img = await Task.detached(priority: .userInitiated) { () -> UIImage? in
            // «Min stil» krever en NØYTRAL rawpy-lignende base (den LUT-en ble lært
            // på). renderPreview gir en Picture-Style-baket/fargestyrt base → LUT
            // vasker den ut. Bruk bar CIRAWFilter-develop for den lærte banen.
            let base: UIImage?
            if learnedActive, let raw {
                base = RedigeringPipeline.renderNeutralRAW(rawPath: raw, exposureEV: ev, crop: crop)
                    ?? RedigeringPipeline.renderPreview(rawPath: raw, jpegPath: jpeg, recipe: r, exposureEV: ev, crop: crop)
            } else {
                base = RedigeringPipeline.renderPreview(rawPath: raw, jpegPath: jpeg, recipe: r, exposureEV: ev, crop: crop)
            }
            guard let base else { return nil }
            guard var ci = CIImage(image: base) else { return base }
            // Auto → FULL-MODELL kNN over ALLE scener (matcher Python-motorens
            // `apply_model`, som kNN-er mot hele arkivet). Å auto-velge ÉN klynge
            // først og kNN-e innen den divergerte (valgte «luftig» → for lyst);
            // full kNN treffer fasiten på tvers av scener. Manuelt valg = kun den
            // valgte stilens scener.
            let scenes = manualScenes ?? (auto ? styles.flatMap { $0.scenes } : nil)
            if let scenes, !scenes.isEmpty {
                ci = LearnedStyle.apply(scenes: scenes, to: ci)   // lært look
            }
            // Lokal per-ansikt-justering (normalisert rekt → piksler av ci.extent).
            if !faceAdj.isEmpty {
                let e = ci.extent
                let faces = faceAdj.map { item -> (rect: CGRect, adj: FaceLocalAdjustFilter.Adjust) in
                    let n = item.norm
                    return (CGRect(x: n.minX * e.width, y: n.minY * e.height,
                                   width: n.width * e.width, height: n.height * e.height), item.adj)
                }
                ci = FaceLocalAdjustFilter.apply(to: ci, faces: faces)
            }
            // Bruk appens KANONISKE farge-pipeline (samme som «Før»-previewen) så
            // resultatet fargestyres korrekt — en egenrullet CIContext tagger
            // CGImage-en i lineært arbeidsrom.
            let ctx = ColorManagement.makeContext(for: .appPreview)
            guard let cg = ColorManagement.renderCGImage(from: ci, context: ctx, purpose: .appPreview)
            else { return base }
            return UIImage(cgImage: cg)
        }.value
        // GENERASJONSVAKT: forkast resultatet hvis en nyere render har startet
        // (raske slider-slipp) ELLER brukeren har byttet asset i mellomtiden.
        guard gen == renderGeneration, selectedId == asset.id else { return }
        afterImage = img
        rendering = false
    }

    /// Reflection removal isn't a separate model — it's a strong highlight/
    /// specular tame layered on the recipe (recovers blown reflections +
    /// a touch of dehaze for glare).
    private func effectiveRecipe() -> MagicRecipe {
        var r = recipe
        if reflectionRemoval {
            r.highlightRecovery = max(r.highlightRecovery, 0.7)
            r.dehaze = max(r.dehaze, 0.2)
        }
        return r
    }

    // MARK: - Crop

    var currentCrop: CGRect? { selectedId.flatMap { crops[$0] } }
    func setCrop(_ rect: CGRect?) {
        guard let id = selectedId else { return }
        if let rect { crops[id] = rect } else { crops[id] = nil }
        persistEdit()
        Task { await render() }
    }
}

// MARK: - View

struct RedigeringView: View {
    @State private var model = RedigeringModel()
    @State private var zoom: CGFloat = 1
    @State private var showCrop = false
    @State private var showMask = false
    /// Bilde-først: skjul inspector-panelet så bildet fyller bredden.
    @State private var inspectorOpen = true
    /// Histogram + clipping-varsel-overlegg på sammenlignings-bildet.
    @State private var showHistogram = false
    /// Vis motiv-maske-overlegg (hva AI segmenterer/behandler lokalt).
    @State private var showMaskOverlay = ProcessInfo.processInfo.arguments.contains("--mask-on")
    @State private var maskOverlay: UIImage?
    /// Vis «AI-endringer»-heatmap (hvor + hvor mye redigeringen endret bildet).
    @State private var showDiff = ProcessInfo.processInfo.arguments.contains("--diff-on")
    @State private var diffOverlay: UIImage?

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
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 14) {
                        Button {
                            model.localFaceMode.toggle()
                            if model.localFaceMode { model.detectFacesForLocal() }
                        } label: {
                            Image(systemName: "person.crop.circle.badge.checkmark")
                                .foregroundStyle(model.localFaceMode ? CHTheme.accent : CHTheme.textSecondary)
                        }
                        .help("Trykk-på-ansikt (lokal justering)")
                        Button {
                            showMaskOverlay.toggle()
                            Task { await updateMaskOverlay() }
                        } label: {
                            Image(systemName: "person.crop.rectangle.stack")
                                .foregroundStyle(showMaskOverlay ? CHTheme.accent : CHTheme.textSecondary)
                        }
                        .help("Vis motiv-maske (per-region)")
                        Button {
                            showDiff.toggle()
                            Task { await updateDiffOverlay() }
                        } label: {
                            Image(systemName: "square.on.square.dashed")
                                .foregroundStyle(showDiff ? CHTheme.accent : CHTheme.textSecondary)
                        }
                        .help("Vis AI-endringer (heatmap)")
                        Button {
                            showHistogram.toggle()
                        } label: {
                            Image(systemName: "waveform.path.ecg.rectangle")
                                .foregroundStyle(showHistogram ? CHTheme.accent : CHTheme.textSecondary)
                        }
                        .help("Histogram + clipping")
                        Button {
                            withAnimation(.easeInOut(duration: 0.22)) { inspectorOpen.toggle() }
                        } label: {
                            Image(systemName: inspectorOpen ? "sidebar.right" : "slider.horizontal.3")
                                .foregroundStyle(inspectorOpen ? CHTheme.textSecondary : CHTheme.accent)
                        }
                        .help(inspectorOpen ? "Skjul panel (større bilde)" : "Vis verktøy-panel")
                        sessionMenu
                    }
                }
            }
        }
        .task { await model.loadSessions() }
        .sheet(isPresented: $showCrop) {
            if let path = model.selected?.previewKey ?? model.selected?.displayPreviewKey {
                RectMarqueeSheet(imagePath: path, title: "Beskjær", applyLabel: "Beskjær",
                                 initialRect: model.currentCrop, allowReset: true,
                                 onReset: { model.setCrop(nil) }) { rect in model.setCrop(rect) }
            }
        }
        .sheet(isPresented: $showMask) {
            if let path = model.selected?.displayPreviewKey {
                RectMarqueeSheet(imagePath: path, title: "Masker — marker for fjerning", applyLabel: "Fjern område",
                                 initialRect: nil, allowReset: false, onReset: {}) { rect in
                    Task { await model.runManualInpaint(normalizedRect: rect) }
                }
            }
        }
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
        GeometryReader { geo in
            // Bildet dominerer: ~70 % av høyden med inspector åpen, ~82 % lukket.
            let imageH = geo.size.height * (inspectorOpen ? 0.70 : 0.82)
            VStack(alignment: .leading, spacing: 12) {
                subtitle
                HStack(alignment: .top, spacing: 14) {
                    VStack(spacing: 10) {
                        compareCard(height: imageH)
                        if model.localFaceMode, let fi = model.activeFace { localFaceControl(fi) }
                        toolbarRow
                    }
                    .frame(maxWidth: .infinity)
                    if inspectorOpen {
                        ScrollView { SmartEditPanel(model: model) }
                            .frame(width: 340)
                            .transition(.move(edge: .trailing).combined(with: .opacity))
                    }
                }
                // Sekundært (prosjekt/status) — komprimert nederst, ikke i veien.
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 12) { queueStrip; StepFlow(); bottomCards }
                }
                .frame(maxHeight: geo.size.height * 0.22)
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

    private func compareCard(height: CGFloat) -> some View {
        BeforeAfterCompare(
            beforePath: model.selected?.previewKey ?? model.selected?.displayPreviewKey,
            after: model.afterImage,
            rendering: model.rendering,
            zoom: $zoom,
            showHistogram: showHistogram,
            maskOverlay: showMaskOverlay ? maskOverlay : nil,
            diffOverlay: showDiff ? diffOverlay : nil,
            faceDots: model.localFaceMode ? model.faceRectsNorm : [],
            activeFace: model.activeFace,
            onTapFace: { model.activeFace = $0 },
        )
        .frame(height: max(320, height))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(alignment: .bottomLeading) { exifBadge }
        .onChange(of: model.afterImage) { _, _ in
            Task { await updateMaskOverlay(); await updateDiffOverlay() }
            if model.localFaceMode { model.detectFacesForLocal() }
        }
    }

    /// Opptaksdata-merke (kamera-EXIF): ISO/blender/lukker/brennvidde + kamera/
    /// objektiv, lest fra RAW/JPEG. Diskret nederst-venstre i compare-kortet.
    @ViewBuilder private var exifBadge: some View {
        if let exif = model.exif, exif.hasData {
            VStack(alignment: .leading, spacing: 1) {
                if !exif.techLine.isEmpty {
                    Text(exif.techLine)
                        .font(.caption2.weight(.semibold)).foregroundStyle(.white)
                }
                if let cam = exif.camera {
                    Text(exif.lens.map { "\(cam) · \($0)" } ?? cam)
                        .font(.system(size: 9)).foregroundStyle(.white.opacity(0.75))
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(.black.opacity(0.45), in: RoundedRectangle(cornerRadius: 8))
            .padding(10)
        }
    }

    /// Beregn «AI-endringer»-heatmap fra Før (preview) vs Etter (off-main).
    private func updateDiffOverlay() async {
        guard showDiff, let after = model.afterImage,
              let path = model.selected?.previewKey ?? model.selected?.displayPreviewKey,
              let before = UIImage(contentsOfFile: path) else { diffOverlay = nil; return }
        diffOverlay = await Task.detached(priority: .userInitiated) {
            DiffHeatmap.overlay(before: before, after: after)
        }.value
    }

    /// Lokal justerings-kontroll for det tappede ansiktet (lys + varme, maskert).
    private func localFaceControl(_ i: Int) -> some View {
        let adj = model.faceAdjust[i] ?? .init()
        return HStack(spacing: 14) {
            Text("Ansikt \(i + 1)").font(.caption.weight(.bold)).foregroundStyle(CHTheme.accent)
            faceSlider("Lys", systemImage: "sun.max", value: adj.brightness) { v in
                var a = adj; a.brightness = v; model.setFaceAdjust(a, for: i)
            }
            faceSlider("Varme", systemImage: "thermometer.medium", value: adj.warmth) { v in
                var a = adj; a.warmth = v; model.setFaceAdjust(a, for: i)
            }
            Button {
                model.setFaceAdjust(.init(), for: i)
            } label: { Image(systemName: "arrow.counterclockwise").font(.caption) }
                .buttonStyle(.plain).foregroundStyle(CHTheme.textMuted)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    private func faceSlider(_ title: String, systemImage: String, value: Double, onChange: @escaping (Double) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Label("\(title)  \(String(format: "%+.0f", value * 100))", systemImage: systemImage)
                .font(.caption2).foregroundStyle(CHTheme.textSecondary)
            Slider(value: Binding(get: { value }, set: onChange), in: -1...1)
                .tint(CHTheme.accent).frame(width: 150)
        }
    }

    /// Beregn motiv-maske-overlegget fra «Etter»-bildet (Vision, off-main).
    private func updateMaskOverlay() async {
        guard showMaskOverlay, let after = model.afterImage, let cg = after.cgImage else {
            maskOverlay = nil; return
        }
        maskOverlay = await Task.detached(priority: .userInitiated) {
            SubjectSegmentation.subjectOverlay(
                for: cg, extent: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
        }.value
    }

    private var toolbarRow: some View {
        HStack(spacing: 0) {
            toolButton("Zoom", "plus.magnifyingglass", active: zoom > 1) { withAnimation { zoom = zoom > 1 ? 1 : 2 } }
            toolButton("Beskjær", "crop", active: model.currentCrop != nil) { showCrop = true }
            toolButton("Sammenlign", "rectangle.split.2x1", active: true) {}
            toolButton("Masker", "paintbrush.pointed") { showMask = true }
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
            if model.seriesTotal > 0 {
                row("hourglass", "Lagrer \(model.seriesProgress)/\(model.seriesTotal)…", CHTheme.accent)
                ProgressView(value: Double(model.seriesProgress), total: Double(max(1, model.seriesTotal)))
                    .tint(CHTheme.accent)
            } else {
                row("checkmark.circle.fill", "\(model.appliedCount) bilder klare", CHTheme.success)
                row("clock", "\(max(0, model.assets.count - model.appliedCount)) i kø", CHTheme.textMuted)
                row("globe", "Levering: Web + Print", CHTheme.textSecondary)
                ProgressView(value: Double(model.appliedCount), total: Double(max(1, model.assets.count)))
                    .tint(CHTheme.accent)
                Text("\(model.appliedCount) / \(model.assets.count) bilder").font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
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

// MARK: - Histogram + clipping

/// Kompakt luma-histogram + clipping-varsel (utblåste høylys / knuste skygger)
/// beregnet fra «Etter»-bildet — proft vurderingsverktøy fotografen etterlyste.
private struct HistogramOverlay: View {
    let image: UIImage
    @State private var bins: [Double] = []
    @State private var clipHi = 0.0
    @State private var clipLo = 0.0

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if clipHi > 0.005 || clipLo > 0.005 {
                HStack(spacing: 8) {
                    if clipHi > 0.005 {
                        Label("Høylys klippet \(Int(clipHi * 100))%", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color(hex: 0xE0606A))
                    }
                    if clipLo > 0.005 {
                        Label("Skygger klippet \(Int(clipLo * 100))%", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color(hex: 0x4A90E2))
                    }
                }
                .font(.caption2.weight(.semibold))
            }
            GeometryReader { geo in
                let maxV = max(bins.max() ?? 1, 0.0001)
                HStack(alignment: .bottom, spacing: 1) {
                    ForEach(bins.indices, id: \.self) { i in
                        Rectangle().fill(.white.opacity(0.75))
                            .frame(height: geo.size.height * CGFloat(bins[i] / maxV))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
            .frame(width: 220, height: 56)
            .padding(6)
            .background(.black.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
        }
        .task(id: image) { compute() }
    }

    private func compute() {
        guard let cg = image.cgImage else { return }
        let w = 96, h = 96
        var px = [UInt8](repeating: 0, count: w * h * 4)
        guard let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var b = [Double](repeating: 0, count: 48)
        var hi = 0.0, lo = 0.0
        let n = Double(w * h)
        for i in stride(from: 0, to: px.count, by: 4) {
            let l = 0.299 * Double(px[i]) + 0.587 * Double(px[i + 1]) + 0.114 * Double(px[i + 2])
            b[min(47, Int(l / 256.0 * 48))] += 1
            if l >= 252 { hi += 1 }
            if l <= 3 { lo += 1 }
        }
        bins = b.map { $0 / n }
        clipHi = hi / n
        clipLo = lo / n
    }
}

// MARK: - Before/After compare

struct BeforeAfterCompare: View {
    let beforePath: String?
    let after: UIImage?
    let rendering: Bool
    @Binding var zoom: CGFloat
    var showHistogram: Bool = false
    var maskOverlay: UIImage?
    var diffOverlay: UIImage?
    var faceDots: [CGRect] = []          // normaliserte CI-rekter (origo nede-venstre)
    var activeFace: Int?
    var onTapFace: (Int) -> Void = { _ in }
    @State private var split: CGFloat = 0.5
    @State private var holdingOriginal = false
    @GestureState private var pinch: CGFloat = 1
    /// «Før»-bildet dekodes ÉN gang (i .task) — ikke i body ved hver drag-frame.
    @State private var beforeImage: UIImage?

    var body: some View {
        GeometryReader { geo in
            // «Før» (original) = VENSTRE, «Etter» (resultat) = HØYRE — matcher
            // etikettene. `after` avsløres til HØYRE for deleren. Hold-for-original
            // → skjul Etter helt (deler helt til høyre → kun original synlig).
            let effSplit = holdingOriginal ? 1 : split
            ZStack(alignment: .topLeading) {
                CHTheme.surfaceElevated
                if let before = beforeImage {
                    Image(uiImage: before).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                }
                if let after {
                    Image(uiImage: after).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                        .mask(alignment: .trailing) {
                            Rectangle().frame(width: geo.size.width * (1 - effSplit))
                        }
                }
                if let maskOverlay {
                    Image(uiImage: maskOverlay).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                        .opacity(0.4).allowsHitTesting(false)
                }
                if let diffOverlay {
                    Image(uiImage: diffOverlay).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                        .opacity(0.7).allowsHitTesting(false)
                }
                // Tappbare ansikts-prikker (lokal justering). CI-koord (nede-
                // venstre) → SwiftUI (topp-venstre): flipp Y.
                ForEach(faceDots.indices, id: \.self) { i in
                    let r = faceDots[i]
                    let cx = r.midX * geo.size.width
                    let cy = (1 - r.midY) * geo.size.height
                    Circle()
                        .stroke(activeFace == i ? CHTheme.accent : .white, lineWidth: activeFace == i ? 3 : 2)
                        .background(Circle().fill((activeFace == i ? CHTheme.accent : .black).opacity(0.35)))
                        .frame(width: 30, height: 30)
                        .overlay(Text("\(i + 1)").font(.caption.weight(.bold)).foregroundStyle(.white))
                        .position(x: cx, y: cy)
                        .onTapGesture { onTapFace(i) }
                }
                labels
                if !holdingOriginal { handle(in: geo) }
                if showHistogram, let after {
                    HistogramOverlay(image: after)
                        .frame(height: 84).padding(10)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                }
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
        .task(id: beforePath) {
            let path = beforePath
            beforeImage = await Task.detached(priority: .userInitiated) {
                path.flatMap { UIImage(contentsOfFile: $0) }
            }.value
        }
    }

    private var labels: some View {
        VStack {
            HStack {
                tag(holdingOriginal ? "Original" : "Før"); Spacer()
                holdButton
                Spacer()
                tag("Etter")
            }.padding(10)
            Spacer()
        }
    }

    /// Trykk-og-hold for å se originalen (rå sammenligning).
    private var holdButton: some View {
        Text("Hold for original")
            .font(.caption2.weight(.semibold)).foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(.black.opacity(holdingOriginal ? 0.55 : 0.3), in: Capsule())
            .overlay(Capsule().stroke(.white.opacity(0.25)))
            .onLongPressGesture(minimumDuration: 0, maximumDistance: 60,
                                pressing: { holdingOriginal = $0 }, perform: {})
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
    @State private var showSky = false

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

            let learnedActive = model.learnedStyleAuto || model.learnedStyleIndex != nil
            if learnedActive {
                HStack(spacing: 6) {
                    Image(systemName: "brain.head.profile").font(.caption2)
                    Text("Grunnjustering styrt av Min stil (lært)").font(.caption2)
                    Spacer()
                }
                .foregroundStyle(CHTheme.accent)
                .padding(.horizontal, 8).padding(.vertical, 5)
                .background(CHTheme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
            }
            VStack(alignment: .leading, spacing: 14) {
                slider("Eksponering", systemImage: "sun.max", value: $model.exposureEV, range: -2...2, unit: .ev)
                slider("Kontrast", systemImage: "circle.lefthalf.filled", value: $model.recipe.contrast, range: -1...1, unit: .signedPercent)
                slider("Skarphet", systemImage: "triangle", value: $model.recipe.texture, range: 0...1, unit: .percent)
                slider("Metning", systemImage: "drop", value: $model.recipe.saturation, range: -1...1, unit: .signedPercent)
                warmthRow
            }
            .disabled(learnedActive)
            .opacity(learnedActive ? 0.45 : 1)
            toggleRow("Rett opp horisont", systemImage: "level", isOn: $model.recipe.autoStraighten)
                .onChange(of: model.recipe.autoStraighten) { _, _ in model.recipeChanged() }
            Divider().overlay(CHTheme.border)

            // Ærlig tilstand: bryterne er INNSTILLINGER for AI-retusjen (kjøres når
            // du trykker «Kjør AI-retusj»), ikke noe som alt er utført.
            aiRetouchHeader
            toggleRow("Støvfjerning", systemImage: "sparkle", isOn: $model.dustRemoval)
            toggleRow("Bakgrunnsrydd", systemImage: "scissors", isOn: $model.backgroundClean)
            toggleRow("Fjern refleks", systemImage: "circle.dashed", isOn: $model.reflectionRemoval)
                .onChange(of: model.reflectionRemoval) { _, _ in model.recipeChanged() }
            if model.hasLearnedStyle {
                learnedStylePicker
            }

            aiAction("Kjør AI-retusj", subtitle: "Fjern støv, distraksjoner + rydd bakgrunn (valgene over)",
                     systemImage: "wand.and.stars.inverse", prominent: false, busy: model.working) {
                Task { await model.runAIRetouch() }
            }
            if let msg = model.statusMessage {
                Text(msg).font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
            aiAction("AI-forbedring (sky)", subtitle: "Høyoppløst rekonstruksjon + støyreduksjon (server)",
                     systemImage: "cloud.bolt", prominent: false, busy: false,
                     disabled: model.selected == nil) { showSky = true }
            aiAction("Bruk på serie", subtitle: "Synk disse justeringene til lignende bilder",
                     systemImage: "sparkles", prominent: true, busy: false) { model.applyToSeries() }
            aiAction("Lagre som preset", subtitle: nil,
                     systemImage: "bookmark", prominent: false, busy: false) { showSavePreset = true }

            HStack(spacing: 5) {
                Image(systemName: "lock.rotation").font(.caption2)
                Text("Endringer lagres automatisk · originalfilen røres ikke")
                    .font(.caption2)
            }
            .foregroundStyle(CHTheme.textMuted).padding(.top, 2)
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 16))
        .alert("Lagre preset", isPresented: $showSavePreset) {
            TextField("Navn", text: $presetDraft)
            Button("Lagre") { if !presetDraft.isEmpty { model.saveAsPreset(presetDraft); presetDraft = "" } }
            Button("Avbryt", role: .cancel) {}
        }
        .sheet(isPresented: $showSky) {
            if let asset = model.selected {
                SkyEnhanceView(asset: asset) { Task { await model.refreshSelected() } }
            }
        }
    }

    /// Standardiserte verdi-enheter (fotografene forventer EV/prosent, ikke
    /// interne modell-tall). `.ev` = ±X.XX EV · `.signedPercent` = ±100 ·
    /// `.percent` = 0–100 %.
    enum SliderUnit { case ev, signedPercent, percent }

    private func slider(_ title: String, systemImage: String, value: Binding<Double>, range: ClosedRange<Double>, unit: SliderUnit) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Label(title, systemImage: systemImage).font(.subheadline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text(displayValue(value.wrappedValue, unit: unit))
                    .font(.caption.monospacedDigit()).foregroundStyle(CHTheme.accentSoft)
            }
            Slider(value: value, in: range) { editing in
                if editing { model.beginEdit() } else { model.recipeChanged() }
            }
            .tint(CHTheme.accent)
        }
    }

    private func displayValue(_ v: Double, unit: SliderUnit) -> String {
        switch unit {
        case .ev: return String(format: "%+.2f EV", v)
        case .signedPercent: return String(format: "%+.0f", v * 100)
        case .percent: return "\(Int(v * 100)) %"
        }
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

    /// Ærlig AI-retusj-tilstand: ikke kjørt / kjører / N fjernet.
    private var aiRetouchStatus: (text: String, color: Color) {
        if model.working { return ("kjører …", CHTheme.accent) }
        if model.selected?.autoCleanedKey != nil {
            let c = model.selected?.autoCleanedDetectionCount ?? 0
            return (c > 0 ? "\(c) fjernet" : "ingen funn", Color(hex: 0x2FD27A))
        }
        return ("ikke kjørt", CHTheme.textMuted)
    }

    private var aiRetouchHeader: some View {
        HStack {
            Label("AI-RETUSJ", systemImage: "wand.and.stars.inverse")
                .font(.caption2.weight(.bold)).foregroundStyle(CHTheme.textSecondary)
            Spacer()
            Text(aiRetouchStatus.text).font(.caption2.weight(.semibold))
                .foregroundStyle(aiRetouchStatus.color)
                .padding(.horizontal, 7).padding(.vertical, 2)
                .background(aiRetouchStatus.color.opacity(0.15), in: Capsule())
        }
    }

    /// AI-handling med forklarende undertekst (hva den faktisk gjør).
    @ViewBuilder
    private func aiAction(_ title: String, subtitle: String?, systemImage: String,
                          prominent: Bool, busy: Bool, disabled: Bool = false,
                          action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Group {
                if prominent {
                    Button(action: action) { aiActionLabel(title, systemImage, busy) }
                        .buttonStyle(.borderedProminent)
                } else {
                    Button(action: action) { aiActionLabel(title, systemImage, busy) }
                        .buttonStyle(.bordered)
                }
            }
            .controlSize(.large).tint(CHTheme.accent).disabled(busy || disabled)
            if let subtitle {
                Text(subtitle).font(.caption2).foregroundStyle(CHTheme.textMuted)
                    .padding(.leading, 2)
            }
        }
    }
    private func aiActionLabel(_ title: String, _ systemImage: String, _ busy: Bool) -> some View {
        HStack {
            if busy { ProgressView().controlSize(.small) }
            Label(title, systemImage: systemImage)
        }.frame(maxWidth: .infinity)
    }

    /// «Min stil (lært)» — velg blant fotografens arkiv-lærte, navngitte looker
    /// (fler-stil-profil), eller «Av». Påføres on-device oppå nøytral base.
    private var learnedStylePicker: some View {
        let names = model.learnedStyleNames
        let current: String = model.learnedStyleAuto
            ? "Auto"
            : (model.learnedStyleIndex.flatMap { names.indices.contains($0) ? names[$0] : nil } ?? "Av")
        let isOn = model.learnedStyleAuto || model.learnedStyleIndex != nil
        return HStack {
            Label("Min stil (lært)", systemImage: "brain.head.profile")
                .font(.subheadline).foregroundStyle(CHTheme.textPrimary)
            Spacer()
            Menu {
                Button("Av") { model.learnedStyleIndex = nil; model.learnedStyleAuto = false; model.recipeChanged() }
                Button("Auto (per bilde)") { model.learnedStyleAuto = true; model.learnedStyleIndex = nil; model.recipeChanged() }
                ForEach(Array(names.enumerated()), id: \.offset) { i, name in
                    Button(name) { model.learnedStyleIndex = i; model.learnedStyleAuto = false; model.recipeChanged() }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(current).font(.subheadline.weight(.semibold))
                    Image(systemName: "chevron.up.chevron.down").font(.caption2)
                }
                .foregroundStyle(isOn ? CHTheme.accent : CHTheme.textMuted)
            }
        }
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

// MARK: - Rectangle marquee (shared by Beskjær + Masker)

/// Draw a rectangle over the fitted image and return it in normalised image
/// coordinates (origin top-left, 0…1). Used for crop and for marking a region
/// to inpaint.
struct RectMarqueeSheet: View {
    let imagePath: String
    let title: String
    let applyLabel: String
    let initialRect: CGRect?
    let allowReset: Bool
    let onReset: () -> Void
    let onApply: (CGRect) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var startPoint: CGPoint?
    @State private var currentRect: CGRect?   // in container coords

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                let image = UIImage(contentsOfFile: imagePath)
                let fitted = fittedRect(image: image?.size ?? .zero, in: geo.size)
                ZStack {
                    CHTheme.bg
                    if let image {
                        Image(uiImage: image).resizable().scaledToFit()
                    }
                    if let r = displayRect(in: fitted) {
                        Rectangle().path(in: r).stroke(CHTheme.accent, lineWidth: 2)
                        Rectangle().path(in: r).fill(CHTheme.accent.opacity(0.12))
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 4)
                        .onChanged { v in
                            let s = startPoint ?? v.startLocation
                            startPoint = s
                            let r = CGRect(x: min(s.x, v.location.x), y: min(s.y, v.location.y),
                                           width: abs(v.location.x - s.x), height: abs(v.location.y - s.y))
                                .intersection(fitted)
                            currentRect = r
                            if fitted.width > 0, fitted.height > 0 {
                                normalized = CGRect(x: (r.minX - fitted.minX) / fitted.width,
                                                    y: (r.minY - fitted.minY) / fitted.height,
                                                    width: r.width / fitted.width,
                                                    height: r.height / fitted.height)
                            }
                        }
                        .onEnded { _ in startPoint = nil }
                )
            }
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(applyLabel) { apply() }.disabled(currentRect == nil || (currentRect?.width ?? 0) < 8)
                }
                if allowReset {
                    ToolbarItem(placement: .bottomBar) {
                        Button("Tilbakestill", role: .destructive) { onReset(); dismiss() }
                    }
                }
            }
        }
        .chBranded()
    }

    private func fittedRect(image: CGSize, in container: CGSize) -> CGRect {
        guard image.width > 0, image.height > 0 else { return CGRect(origin: .zero, size: container) }
        let scale = min(container.width / image.width, container.height / image.height)
        let w = image.width * scale, h = image.height * scale
        return CGRect(x: (container.width - w) / 2, y: (container.height - h) / 2, width: w, height: h)
    }

    private func displayRect(in fitted: CGRect) -> CGRect? {
        if let currentRect { return currentRect }
        if let initialRect {
            return CGRect(x: fitted.minX + initialRect.minX * fitted.width,
                          y: fitted.minY + initialRect.minY * fitted.height,
                          width: initialRect.width * fitted.width, height: initialRect.height * fitted.height)
        }
        return nil
    }

    private func apply() {
        guard let norm = normalized else { return }
        onApply(norm.intersection(CGRect(x: 0, y: 0, width: 1, height: 1)))
        dismiss()
    }

    /// Normalised rect (0…1, image space) computed live during the drag.
    @State private var normalized: CGRect?
}
