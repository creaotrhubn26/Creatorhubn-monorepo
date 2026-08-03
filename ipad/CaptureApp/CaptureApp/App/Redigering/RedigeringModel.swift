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
    #if DEBUG
    var learnedStyleIndex: Int? = LearnedStyleStore.demoForceStyleIndex
    /// Auto: motoren velger looken som passer bildets lys (per bilde).
    var learnedStyleAuto: Bool = LearnedStyleStore.demoForceAuto
    #else
    var learnedStyleIndex: Int?
    var learnedStyleAuto = false
    #endif
    var hasLearnedStyle: Bool { LearnedStyleStore.shared.isAvailable }
    var learnedStyleNames: [String] { LearnedStyleStore.shared.styleNames }

    /// SERVER motiv-maske (BiRefNet/U²-Net via `/subject-matte`) — «pro»-kvalitets
    /// motiv-maske for den subjekt-beskyttede løvverk-dempingen, i stedet for den
    /// on-device Vision-person-matten. Lagres som PNG-bytes (Sendable → trygt inn i
    /// den detached render-tasken); rekonstrueres til CIImage der. Gjelder KUN det
    /// hentede bildet (`serverMatteAssetId`).
    var useServerSubjectMatte = false
    var fetchingServerMatte = false
    private var serverSubjectMaskData: Data?
    private var serverMatteAssetId: UUID?
    var hasServerSubjectMatte: Bool { serverSubjectMaskData != nil && serverMatteAssetId == selectedId }

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
        faceDetectGeneration += 1
        let faceGen = faceDetectGeneration
        Task {
            let rects = await Task.detached(priority: .userInitiated) { () -> [CGRect] in
                let req = VNDetectFaceRectanglesRequest()
                let handler = VNImageRequestHandler(cgImage: src, orientation: .up, options: [:])
                try? handler.perform([req])
                return (req.results ?? [])
                    .map(\.boundingBox)
                    .filter { $0.width > 0.01 && $0.height > 0.01 }
            }.value
            // Koalescér: flere renders → flere deteksjoner i kappløp; kun det
            // NYESTE resultatet skal lande (samme generasjonsmønster som render()).
            guard faceGen == faceDetectGeneration else { return }
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
    /// Løpenummer for lokal ansiktsdeteksjon — koalescerer samtidige pass.
    private var faceDetectGeneration = 0

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

    /// Kvalitetssjekk (steg 4): leveranse-blokkere per bilde + kjøre-status.
    /// `qualityFindings` er sortert med blokkere øverst; tom etter en ren kjøring.
    private(set) var qualityFindings: [QualityFinding] = []
    private(set) var qualityRunning = false
    private(set) var qualityProgress = 0
    private(set) var qualityTotal = 0
    private(set) var qualityDidRun = false
    private let assetAnalyzer = AssetAnalyzer()
    var qualityBlockerCount: Int { qualityFindings.filter(\.hasBlocker).count }
    var qualityWarningCount: Int { qualityFindings.count - qualityBlockerCount }

    /// Samlet analyse for det VALGTE bildet — driver data-drevne auto-forslag.
    /// Gjenbruker persistert `signals.analysis`, ellers målt on-demand (cache).
    private(set) var selectedAnalysis: AssetAnalysis?

    /// Data-drevne auto-edit-forslag for det valgte bildet (motiv-klipp→høylys,
    /// motlys→skygge-løft, cast→WB, flatt→kontrast). Tom når justeringer er av
    /// (server-gradet/lært stil) siden recipe-deltaene da ikke slår gjennom.
    var editSuggestions: [EditSuggestion] {
        guard !serverGraded, !learnedStyleAuto, learnedStyleIndex == nil,
              let a = selectedAnalysis else { return [] }
        return EditSuggestionEngine.suggestions(for: a)
    }

    /// Påfør ett forslags recipe-delta (med angre-støtte), render + persister.
    func applySuggestion(_ s: EditSuggestion) {
        beginEdit()
        s.apply(to: &recipe)
        recipeChanged()
    }

    /// Oppdater `selectedAnalysis` for det valgte bildet — persistert hvis den
    /// finnes, ellers målt off-main (cache-drevet → rask ved gjenbesøk).
    private func refreshSelectedAnalysis() {
        selectedAnalysis = selected?.signals.analysis
        guard selectedAnalysis == nil, let asset = selected,
              let key = asset.previewKey ?? asset.displayPreviewKey,
              FileManager.default.fileExists(atPath: key) else { return }
        let id = asset.id
        let analyzer = assetAnalyzer
        Task { [weak self] in
            let measured = await analyzer.analyze(imageURL: URL(fileURLWithPath: key))
            guard let self, self.selectedId == id else { return }
            self.selectedAnalysis = measured
        }
    }
    /// Undo/redo av HELE edit-tilstanden (recipe + eksponering + crop) for det
    /// valgte bildet — ikke bare recipe.
    private var undo: [RedigeringEditStore.EditState] = []
    private var redo: [RedigeringEditStore.EditState] = []

    private var ownerUserId: String? { SignInService.shared.session?.userId }

    /// Bilder der fotografen har valgt å redigere ORIGINALEN i stedet for den
    /// server-forbedrede («AI-forbedring (sky)») basen — så preset/slider-
    /// justeringene virker igjen. Uten dette er sliderne stille inerte på server-
    /// gradede bilder (basen er alt gradet → flat recipe → ingenting skjer).
    private var bypassServerEnhance: Set<UUID> = []

    /// Sann når det valgte bildet redigeres på en server-gradet base (og ikke
    /// er overstyrt) → preset/sliders er deaktivert (dobbel-gradering unngås).
    /// Driver banner + disabling i ``SmartEditPanel``.
    var serverGraded: Bool {
        guard let a = selected else { return false }
        return a.serverEnhancedKey != nil && !bypassServerEnhance.contains(a.id)
    }

    /// Bytt mellom å redigere den server-forbedrede basen (justeringer av) og
    /// originalen (justeringer på) for det valgte bildet.
    func toggleEditOriginal() {
        guard let id = selectedId else { return }
        if bypassServerEnhance.contains(id) { bypassServerEnhance.remove(id) } else { bypassServerEnhance.insert(id) }
        Task { await render() }
    }

    /// Flat base-recipe for gradede baser (server-sky / lært stil): kun høylys-
    /// vern, INGEN auto-enhance/skygge-løft — så den alt-gradede tonen ikke
    /// dobbelt-prosesseres. Delt av interaktiv render + batch-eksport.
    private static let flatGradedRecipe = MagicRecipe(highlightRecovery: 0.30, autoEnhance: false)

    /// Base-utvalg + gradering-status for ett bilde — ÉN kilde delt av preview-
    /// render OG batch-eksport, så det fotografen SER er det som LEVERES.
    /// Prioritet: server-sky → AI-cleaned → RAW. `bypassServerEnhance` lar
    /// fotografen redigere originalen.
    private struct WorkingBase { let rawPath: String?; let jpegPath: String?; let graded: Bool }
    private func workingBase(for asset: Asset) -> WorkingBase {
        let server = bypassServerEnhance.contains(asset.id) ? nil : asset.serverEnhancedKey
        let cleaned = asset.autoCleanedKey
        // RAW kun når ingen alt-prosessert JPEG-base finnes (server/cleaned).
        let raw = (server == nil && cleaned == nil) ? asset.rawKey : nil
        let jpeg = server ?? cleaned ?? asset.displayPreviewKey
        return WorkingBase(rawPath: raw, jpegPath: jpeg, graded: server != nil)
    }

    var selected: Asset? { assets.first { $0.id == selectedId } }
    var canUndo: Bool { !undo.isEmpty }
    var canRedo: Bool { !redo.isEmpty }
    var appliedCount: Int { applied.count }

    /// #4: sann når videre redigering + eksport skjer fra en ~2400px preview-JPEG
    /// (etter AI-retusj/inpaint, som produserer `autoCleanedKey`) i stedet for
    /// kamera-RAW-en — et kvalitetstap fotografen ellers ikke ser. Driver en
    /// advarsel. (Full-res inpaint / composite-tilbake-i-RAW er egen oppgave.)
    var baseIsDegraded: Bool {
        guard let a = selected else { return false }
        return a.autoCleanedKey != nil && a.rawKey != nil
    }

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
        // #1: dekod den bundlete stil-profilen off-main FØR første render, så
        // «Min stil»-getterne (isAvailable/styleNames) og apply() ikke tvinger
        // synkron disk-I/O på main ved første UI-berøring.
        await LearnedStyleStore.shared.preload()
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
            refreshSelectedAnalysis()
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
        refreshSelectedAnalysis()
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

    /// Øyeblikksbilde av HELE redigeringstilstanden (recipe + eksponering + crop)
    /// — undo dekket før bare `recipe`, så Angre etter en beskjæring/eksponering
    /// hoppet feil verdi.
    private func snapshot() -> RedigeringEditStore.EditState {
        .init(recipe: recipe, exposureEV: exposureEV, crop: selectedId.flatMap { crops[$0] })
    }
    private func restore(_ s: RedigeringEditStore.EditState) {
        recipe = s.recipe
        exposureEV = s.exposureEV
        if let id = selectedId { crops[id] = s.crop }
        syncPresetName(to: s.recipe)
        persistEdit(); Task { await render() }
    }

    func undoEdit() {
        guard let prev = undo.popLast() else { return }
        redo.append(snapshot()); restore(prev)
    }
    func redoEdit() {
        guard let next = redo.popLast() else { return }
        undo.append(snapshot()); restore(next)
    }

    private func pushUndo() { undo.append(snapshot()); redo.removeAll() }

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
        let baseRecipe = effectiveRecipe(); let ev = exposureEV
        var failed: [String] = []
        for a in assets {
            // #4: SAMME base-valg som interaktiv render (server-sky → cleaned →
            // RAW) — før ignorerte batch serverEnhancedKey, så et server-forbedret
            // bilde ble eksportert fra RAW med full recipe mens previewen viste
            // server-basen flat. Nå matcher det fotografen ser det som leveres.
            let base = workingBase(for: a)
            // Gradet base (server-sky) → flat recipe, akkurat som render(). Ellers
            // brukerens effektive recipe.
            let exportRecipe = base.graded ? Self.flatGradedRecipe : baseRecipe
            // #3a: crop fra minne ELLER persistert edit — etter app-restart er
            // in-memory-dictet tomt for alle unntatt valgt asset, så batch mistet
            // ellers beskjæringene.
            let crop = crops[a.id] ?? RedigeringEditStore.load(a.id)?.crop
            // #3b: PERSISTÉR DET VI RENDRER (exportRecipe), ikke rå-recipen — ellers
            // matcher ikke lagret oppskrift den eksporterte JPEG-en etter restart.
            applied[a.id] = exportRecipe
            RedigeringEditStore.save(a.id, .init(recipe: exportRecipe, exposureEV: ev, crop: crop))
            let data = await Task.detached(priority: .utility) {
                RedigeringPipeline.renderExport(rawPath: base.rawPath, jpegPath: base.jpegPath,
                                                recipe: exportRecipe, exposureEV: ev, crop: crop)
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

    /// Kvalitetssjekk-passet: sørg for at hvert bilde har en `AssetAnalysis`
    /// (gjenbruk persistert, ellers MÅL én gang off-main + persister), oversett
    /// til leveranse-blokkere (``QualityCheckService``), og bygg review-listen.
    /// Cache-drevet → en re-kjøring etter at alle er målt er umiddelbar.
    func runQualityCheck() async {
        guard !qualityRunning, !assets.isEmpty else { return }
        qualityRunning = true
        qualityTotal = assets.count; qualityProgress = 0
        defer { qualityRunning = false; qualityDidRun = true }
        let store = services()?.store
        var findings: [QualityFinding] = []
        for asset in assets {
            var analysis = asset.signals.analysis
            if analysis == nil,
               let key = asset.previewKey ?? asset.displayPreviewKey,
               FileManager.default.fileExists(atPath: key) {
                let measured = await assetAnalyzer.analyze(imageURL: URL(fileURLWithPath: key))
                if let measured, let idx = assets.firstIndex(where: { $0.id == asset.id }) {
                    // Persistér målingen (én kilde) → cull/HUD/senere QC gjenbruker.
                    var signals = assets[idx].signals
                    signals.analysis = measured
                    signals.faceCount = measured.faces.count
                    if let face = measured.primaryFace { signals.eyesOpen = face.eyesOpen ?? signals.eyesOpen }
                    assets[idx].signals = signals
                    try? await store?.updateAssetSignals(id: asset.id, signals: signals)
                }
                analysis = measured
            }
            if let analysis {
                let issues = QualityCheckService.evaluate(
                    analysis,
                    flashFired: asset.signals.flashFired,
                    flashReturnDetected: asset.signals.flashReturnDetected)
                if !issues.isEmpty { findings.append(QualityFinding(assetId: asset.id, issues: issues)) }
            }
            qualityProgress += 1
        }
        // Blokkere øverst; ellers bevart opptaksrekkefølge (stabil sortering).
        qualityFindings = findings.sorted { $0.worstSeverity > $1.worstSeverity }
    }

    /// Velg bildet bak et kvalitetsfunn (fra review-listen → hovedbildet).
    func selectFinding(_ finding: QualityFinding) {
        if let asset = assets.first(where: { $0.id == finding.assetId }) { select(asset) }
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

    /// Hent SERVER motiv-maske (BiRefNet/U²-Net via `/subject-matte`) for det valgte
    /// bildet og re-render med den (høyere kant-kvalitet enn on-device Vision). Faller
    /// stille tilbake til Vision-matten ved feil.
    func fetchServerSubjectMatte() async {
        guard let asset = selected, let client = PhotoEnhancerClient.make() else { return }
        let previewPath = workingBase(for: asset).jpegPath ?? asset.displayPreviewKey
        guard let previewPath,
              let data = try? Data(contentsOf: URL(fileURLWithPath: previewPath)) else { return }
        fetchingServerMatte = true
        defer { fetchingServerMatte = false }
        do {
            let matte = try await client.subjectMatte(imageData: data)
            serverSubjectMaskData = matte.pngData()
            serverMatteAssetId = asset.id
            useServerSubjectMatte = true
            await render()
        } catch {
            // behold on-device Vision-fallback stille
        }
    }

    /// Slå av server-matten → tilbake til on-device Vision-matten.
    func clearServerSubjectMatte() {
        useServerSubjectMatte = false
        Task { await render() }
    }

    private func render() async {
        guard let asset = selected else { afterImage = nil; return }
        renderGeneration += 1
        let gen = renderGeneration
        rendering = true
        // Working base priority (DELT med batch-eksport via workingBase): server
        // "sky" enhance → AI-cleaned → RAW. Local recipe/exposure/crop layer on top.
        let base = workingBase(for: asset)
        let raw = base.rawPath
        let jpeg = base.jpegPath
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
        // #12: server-enhanced base er ALLEREDE fargestyrt/gradet av «AI-forbedring
        // (sky)». Å legge preset-graden (Bryllup osv.) oppå dobbeltprosesserer tonen
        // — samme feil vi løste for lært stil. Bruk flat base når basen er gradet,
        // så sliderne ikke dobbelt-graderer. (auto-cleaned er IKKE gradet → beholder
        // recipen der.) Server-gradede bilder viser i tillegg et banner + deaktiverte
        // slidere (se `serverGraded`), så inertien er FORKLART, ikke stille.
        let r = (learnedActive || base.graded) ? Self.flatGradedRecipe : effectiveRecipe()
        let ev = exposureEV
        let crop = crops[asset.id]
        let faceAdj = activeFaceAdjustments   // [(normRect, adj)] — lokal ansikts-justering
        let styleFlash = asset.signals.flashFired   // Del D: blits-dim til lært-stil-kNN
        // SERVER motiv-maske (PNG-bytes → Sendable) — kun for det hentede bildet.
        let serverMatteData = (useServerSubjectMatte && serverMatteAssetId == asset.id)
            ? serverSubjectMaskData : nil
        let img = await Task.detached(priority: .userInitiated) { () -> UIImage? in
            // «Min stil» krever en NØYTRAL rawpy-lignende base (den LUT-en ble lært
            // på). renderPreview gir en Picture-Style-baket/fargestyrt base → LUT
            // vasker den ut. Bruk bar CIRAWFilter-develop for den lærte banen.
            // 🔑 16-BIT: den lærte banen får basen som en 16-bit CIImage rett fra
            // CIRAWFilter (ingen 8-bit-mellomledd) → CR3-ens 14-bit-presisjon +
            // headroom bevares gjennom HELE LUT/LAB/hud-kjeden; 8-bit skjer kun i
            // ColorManagement.renderCGImage til slutt.
            var ci: CIImage
            if learnedActive, let raw,
               let neutral = RedigeringPipeline.neutralBaseCIImage(rawPath: raw, exposureEV: ev, crop: crop) {
                ci = neutral
            } else {
                // Preset-bane (ikke lært) eller RAW-fallback → 8-bit via renderPreview.
                guard let base = RedigeringPipeline.renderPreview(
                        rawPath: raw, jpegPath: jpeg, recipe: r, exposureEV: ev, crop: crop),
                      let ci0 = CIImage(image: base) else { return nil }
                ci = ci0
            }
            // Auto → FULL-MODELL kNN over ALLE scener (matcher Python-motorens
            // `apply_model`, som kNN-er mot hele arkivet). Å auto-velge ÉN klynge
            // først og kNN-e innen den divergerte (valgte «luftig» → for lyst);
            // full kNN treffer fasiten på tvers av scener. Manuelt valg = kun den
            // valgte stilens scener.
            let scenes = manualScenes ?? (auto ? styles.flatMap { $0.scenes } : nil)
            if let scenes, !scenes.isEmpty {
                // Server-matten (om hentet) rekonstrueres her; ellers bruker
                // LearnedStyle on-device Vision-person-matten. `CIImage(image:)`
                // respekterer orienteringen så den flukter med develop-basen.
                let serverMask: CIImage? = serverMatteData
                    .flatMap { UIImage(data: $0) }
                    .flatMap { CIImage(image: $0) }
                ci = LearnedStyle.apply(scenes: scenes, to: ci, flashFired: styleFlash,
                                        subjectMaskOverride: serverMask)   // lært look
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
            else { return nil }
            return UIImage(cgImage: cg)
        }.value
        // GENERASJONSVAKT: forkast resultatet hvis en nyere render har startet
        // (raske slider-slipp) — den nyere renderen eier `rendering`-flagget.
        guard gen == renderGeneration else { return }
        // Byttet asset uten en nyere render i flukt → nullstill flagget selv
        // (ellers står spinneren evig på det gamle bildet).
        guard selectedId == asset.id else { rendering = false; return }
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
        pushUndo()   // #10: crop var utenfor undo-stacken
        if let rect { crops[id] = rect } else { crops[id] = nil }
        persistEdit()
        Task { await render() }
    }
}
