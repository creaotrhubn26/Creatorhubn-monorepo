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
    var recipe: MagicRecipe = .neutral
    var presetName: String = "Nøytral"
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

    var currentFaceEdits: [FaceLocalAdjustFilter.Entry] {
        activeFaceAdjustments.map {
            .init(normalizedRect: $0.norm, adjustment: $0.adj)
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
        persistEdit()
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
    /// One retryable validation job per image. A new slider render cancels the
    /// stale job and validates only the latest visible result.
    private let editValidationService = EditValidationService()
    private var editValidationTasks: [UUID: Task<Void, Never>] = [:]
    private var editValidationTaskTokens: [UUID: UUID] = [:]

    /// Kamera-EXIF (ISO/blender/lukker/brennvidde) for det valgte bildet — lest
    /// fra RAW/JPEG ved valg. Vises i editoren; nil når fila mangler metadata.
    private(set) var exif: ExifInfo?

    /// Camera-aware colour base beneath presets and manual sliders. It is
    /// persisted per asset and participates in undo/redo so preview and export
    /// can never silently disagree about the selected profile.
    var cameraColorProfileID: CameraColorProfileID = .appleEmbedded

    var availableCameraColorProfiles: [CameraColorProfileDefinition] {
        CameraColorProfileCatalog.profiles(
            cameraModel: exif?.camera,
            hasRaw: selected?.rawKey != nil
        )
    }

    var activeCameraColorProfile: CameraColorProfileDefinition {
        CameraColorProfileCatalog.profile(
            cameraColorProfileID,
            cameraModel: exif?.camera,
            hasRaw: selected?.rawKey != nil
        )
    }

    private(set) var loading = true
    var errorMessage: String?

    /// Per-asset recipes applied via "Bruk på serie" / individual edits.
    private var applied: [UUID: MagicRecipe] = [:]
    /// Per-asset crop (normalised rect, origin top-left).
    private var crops: [UUID: CGRect] = [:]
    /// Areas explicitly excluded from portrait retouch (normalised, top-left).
    private(set) var protectedRegions: [CGRect] = []
    /// Persistent provenance for the selected image's non-destructive edit.
    private(set) var auditTrail: [RedigeringEditStore.AuditEntry] = []
    private var lastAuditAt: Date?
    private var lastAuditSource: String?
    /// Full-series batch progress.
    private(set) var seriesProgress = 0
    private(set) var seriesTotal = 0
    private(set) var resumableBatchCount = 0

    /// Reference frame used to harmonise exposure/colour across a scene.
    private(set) var sceneLockReferenceId: UUID?
    private(set) var sceneLockRunning = false
    private(set) var sceneLockStatus: String?

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

    /// One deliberate, undoable auto-tone action for portraits. It uses the
    /// already persisted per-asset measurements; nothing changes invisibly on
    /// subsequent renders. The photographer can inspect and tune every result.
    func applyAdaptivePortraitTone() {
        guard let analysis = selectedAnalysis, analysis.hasFaces else {
            statusMessage = "Fant ikke et sikkert ansikt for motivtilpasset tone."
            return
        }
        beginEdit()
        let result = PortraitToneAdvisor.adjust(
            recipe: recipe,
            exposureEV: exposureEV,
            analysis: analysis
        )
        recipe = result.recipe
        recipe.portraitRetouchLevel = .custom
        exposureEV = result.exposureEV
        recordAudit(source: "adaptive-tone", summary: "Motivtilpasset lys og hudtone brukt")
        statusMessage = "Lys og hudtone er tilpasset motivet — alle verdier kan finjusteres."
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

    var automaticProcessingStatus: String {
        guard !assets.isEmpty else { return "Ingen bilder importert" }
        let analyzed = assets.filter { $0.signals.analysis != nil }.count
        let validationTargets = assets.filter {
            $0.enhancedKey != nil || $0.serverEnhancedKey != nil || $0.autoCleanedKey != nil
        }
        let completed = validationTargets.filter { $0.signals.editValidation?.state == .completed }.count
        let failed = validationTargets.filter { $0.signals.editValidation?.state == .failed }.count
        var value = "\(assets.count) bilder · bildeanalyse \(analyzed)/\(assets.count)"
        if validationTargets.isEmpty {
            value += " · retusj-QC venter på resultat"
        } else {
            value += " · retusj-QC \(completed)/\(validationTargets.count)"
        }
        if failed > 0 { value += " · \(failed) må prøves igjen" }
        return value
    }

    var automaticProcessingComplete: Bool {
        guard !assets.isEmpty, assets.allSatisfy({ $0.signals.analysis != nil }) else { return false }
        let targets = assets.filter {
            $0.enhancedKey != nil || $0.serverEnhancedKey != nil || $0.autoCleanedKey != nil
        }
        return !targets.isEmpty && targets.allSatisfy { $0.signals.editValidation?.state == .completed }
    }

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
            assets = try await CullStore(
                database: db,
                outbox: Outbox(database: db, ownerUserId: ownerUserId)
            )
                .assets(sessionId: s.id, ownerUserId: ownerUserId)
            sceneLockReferenceId = RedigeringEditStore.loadSceneLockReference(s.id)
            resumableBatchCount = RedigeringEditStore.loadBatch(s.id)?.pendingIds.count ?? 0
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
        // Selection state must never leak from the previous image. Start from a
        // complete known baseline, then restore only this asset's persisted edit.
        recipe = .neutral
        presetName = "Nøytral"
        exposureEV = 0
        cameraColorProfileID = .appleEmbedded
        faceRectsNorm = []
        faceAdjust = [:]
        activeFace = nil
        reflectionRemoval = false
        protectedRegions = []
        auditTrail = []
        // Restore persisted edit (survives crash/teardown), else the in-memory
        // cache, else defaults.
        if let saved = RedigeringEditStore.load(id) {
            recipe = saved.recipe; exposureEV = saved.exposureEV
            crops[id] = saved.crop
            applied[id] = saved.recipe
            restoreFaceEdits(saved.faceEdits ?? [])
            reflectionRemoval = saved.reflectionRemoval ?? false
            cameraColorProfileID = saved.cameraColorProfileID ?? .appleEmbedded
            protectedRegions = saved.protectedRegions ?? []
            auditTrail = saved.auditTrail ?? []
            syncPresetName(to: saved.recipe)
        } else if let r = applied[id] {
            recipe = r
            syncPresetName(to: r)
        }
    }

    private func restoreFaceEdits(_ entries: [FaceLocalAdjustFilter.Entry]) {
        faceRectsNorm = entries.map(\.normalizedRect)
        faceAdjust = Dictionary(uniqueKeysWithValues: entries.enumerated().map {
            ($0.offset, $0.element.adjustment)
        })
        activeFace = entries.isEmpty ? nil : 0
    }

    /// Hold preset-etiketten i takt med recipen som lastes (persistert edit) så
    /// UI-en viser «Bryllup» i stedet for standard-navnet når recipen matcher.
    private func syncPresetName(to r: MagicRecipe) {
        presetName = Self.presets.first(where: { $0.1 == r })?.0 ?? "Tilpasset"
    }

    /// Persist the selected asset's current edit state to disk.
    private func persistEdit() {
        guard let id = selectedId else { return }
        applied[id] = recipe
        RedigeringEditStore.save(
            id,
            .init(
                recipe: recipe,
                exposureEV: exposureEV,
                crop: crops[id],
                faceEdits: currentFaceEdits,
                reflectionRemoval: reflectionRemoval,
                cameraColorProfileID: cameraColorProfileID,
                protectedRegions: protectedRegions,
                auditTrail: auditTrail
            )
        )
    }

    private func recordAudit(source: String, summary: String) {
        let now = Date()
        if lastAuditSource == source,
           let lastAuditAt,
           now.timeIntervalSince(lastAuditAt) < 2,
           !auditTrail.isEmpty {
            auditTrail[auditTrail.count - 1] = .init(date: now, source: source, summary: summary)
        } else {
            auditTrail.append(.init(date: now, source: source, summary: summary))
            if auditTrail.count > 50 { auditTrail.removeFirst(auditTrail.count - 50) }
        }
        self.lastAuditAt = now
        self.lastAuditSource = source
    }

    func applyCameraColorProfile(_ id: CameraColorProfileID) {
        guard availableCameraColorProfiles.contains(where: { $0.id == id }) else { return }
        pushUndo()
        cameraColorProfileID = id
        recordAudit(source: "camera-profile", summary: "Kameraprofil: \(activeCameraColorProfile.displayName)")
        persistEdit()
        Task { await render() }
    }

    func applyPreset(_ name: String, _ r: MagicRecipe) {
        pushUndo(); presetName = name; recipe = r
        recordAudit(source: "preset", summary: "Preset: \(name)")
        persistEdit()
        Task { await render() }
    }

    /// Call when a slider commits (on release) — renders the real pipeline.
    func recipeChanged() {
        syncPresetName(to: recipe)
        recordAudit(source: "manual", summary: "Manuelle lys-, farge- eller retusjverdier justert")
        persistEdit()
        Task { await render() }
    }
    func beginEdit() { pushUndo() }

    /// Return the selected asset to the calibrated neutral starting point. This
    /// is intentionally undoable and clears every local edit, not just sliders.
    func resetSelectedEdit() {
        guard let id = selectedId else { return }
        pushUndo()
        recipe = .neutral
        presetName = "Nøytral"
        exposureEV = 0
        cameraColorProfileID = .appleEmbedded
        crops[id] = nil
        faceRectsNorm = []
        faceAdjust = [:]
        activeFace = nil
        reflectionRemoval = false
        protectedRegions = []
        recordAudit(source: "reset", summary: "Alle redigeringer nullstilt")
        persistEdit()
        Task { await render() }
    }

    /// Øyeblikksbilde av HELE redigeringstilstanden (recipe + eksponering + crop)
    /// — undo dekket før bare `recipe`, så Angre etter en beskjæring/eksponering
    /// hoppet feil verdi.
    private func snapshot() -> RedigeringEditStore.EditState {
        .init(
            recipe: recipe,
            exposureEV: exposureEV,
            crop: selectedId.flatMap { crops[$0] },
            faceEdits: currentFaceEdits,
            reflectionRemoval: reflectionRemoval,
            cameraColorProfileID: cameraColorProfileID,
            protectedRegions: protectedRegions,
            auditTrail: auditTrail
        )
    }
    private func restore(_ s: RedigeringEditStore.EditState) {
        recipe = s.recipe
        exposureEV = s.exposureEV
        if let id = selectedId { crops[id] = s.crop }
        restoreFaceEdits(s.faceEdits ?? [])
        reflectionRemoval = s.reflectionRemoval ?? false
        cameraColorProfileID = s.cameraColorProfileID ?? .appleEmbedded
        protectedRegions = s.protectedRegions ?? []
        auditTrail = s.auditTrail ?? []
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

    func setSceneLockReferenceToSelected() {
        guard let session, let selectedId else { return }
        sceneLockReferenceId = selectedId
        RedigeringEditStore.saveSceneLockReference(selectedId, sessionId: session.id)
        recordAudit(source: "scene-lock", summary: "Valgt som Scene Lock-referanse")
        persistEdit()
        sceneLockStatus = "Referansen er satt til \(selected?.originalFilename ?? "valgt bilde")."
    }

    func applySceneLockToSeries() async {
        guard !sceneLockRunning,
              let referenceId = sceneLockReferenceId,
              let referenceAsset = assets.first(where: { $0.id == referenceId }),
              let svc = services()
        else {
            sceneLockStatus = "Velg først et referansebilde."
            return
        }
        sceneLockRunning = true
        defer { sceneLockRunning = false }
        guard let referenceAnalysis = await analysis(for: referenceAsset, store: svc.store) else {
            sceneLockStatus = "Referansebildet kunne ikke analyseres."
            return
        }
        let referenceState = RedigeringEditStore.load(referenceId) ?? .init(
            recipe: referenceId == selectedId ? recipe : .neutral,
            exposureEV: referenceId == selectedId ? exposureEV : 0,
            crop: nil
        )
        sceneLockStatus = "Matcher lys og farge i \(assets.count) bilder…"
        for asset in assets {
            guard let targetAnalysis = await analysis(for: asset, store: svc.store) else { continue }
            let prior = RedigeringEditStore.load(asset.id)
            let result: SceneConsistencyAdvisor.Result = asset.id == referenceId
                ? .init(recipe: referenceState.recipe, exposureEV: referenceState.exposureEV)
                : SceneConsistencyAdvisor.match(
                    referenceRecipe: referenceState.recipe,
                    referenceExposureEV: referenceState.exposureEV,
                    reference: referenceAnalysis,
                    target: targetAnalysis
                )
            var history = prior?.auditTrail ?? []
            history.append(.init(source: "scene-lock", summary: "Lys og farge matchet mot \(referenceAsset.originalFilename)"))
            RedigeringEditStore.save(asset.id, .init(
                recipe: result.recipe,
                exposureEV: result.exposureEV,
                crop: prior?.crop,
                faceEdits: prior?.faceEdits ?? [],
                reflectionRemoval: prior?.reflectionRemoval ?? false,
                cameraColorProfileID: prior?.cameraColorProfileID ?? .appleEmbedded,
                protectedRegions: prior?.protectedRegions ?? [],
                auditTrail: Array(history.suffix(50))
            ))
            applied[asset.id] = result.recipe
        }
        await persistSeries(assetIds: assets.map(\.id), mode: .sceneLock)
        if selectedId != nil { loadRecipeForSelection(); await render() }
        sceneLockStatus = resumableBatchCount == 0
            ? "Scene Lock er ferdig og lagret lokalt."
            : "Scene Lock er lagret; \(resumableBatchCount) bilder kan gjenopptas."
    }

    private func analysis(for asset: Asset, store: SessionStore) async -> AssetAnalysis? {
        if let existing = assets.first(where: { $0.id == asset.id })?.signals.analysis { return existing }
        guard let path = asset.previewKey ?? asset.displayPreviewKey,
              FileManager.default.fileExists(atPath: path),
              let measured = await assetAnalyzer.analyze(imageURL: URL(fileURLWithPath: path))
        else { return nil }
        if let index = assets.firstIndex(where: { $0.id == asset.id }) {
            var signals = assets[index].signals
            signals.analysis = measured
            signals.faceCount = measured.faces.count
            assets[index].signals = signals
            try? await store.updateAssetSignals(id: asset.id, signals: signals)
        }
        return measured
    }

    /// Apply the current recipe to every asset, then render + persist each one
    /// full-res in the background (real batch). Crop is per-asset; the recipe +
    /// exposure + reflection apply to all.
    func applyToSeries() {
        let sourceRecipe = recipe
        let sourceExposure = exposureEV
        let sourceProfile = cameraColorProfileID
        let sourceReflection = reflectionRemoval
        for asset in assets {
            let previous = RedigeringEditStore.load(asset.id)
            var history = previous?.auditTrail ?? []
            history.append(.init(source: "series", summary: "Justeringer brukt på hele serien"))
            let state = RedigeringEditStore.EditState(
                recipe: sourceRecipe,
                exposureEV: sourceExposure,
                crop: previous?.crop,
                faceEdits: previous?.faceEdits ?? [],
                reflectionRemoval: sourceReflection,
                cameraColorProfileID: sourceProfile,
                protectedRegions: previous?.protectedRegions ?? [],
                auditTrail: Array(history.suffix(50))
            )
            applied[asset.id] = sourceRecipe
            RedigeringEditStore.save(asset.id, state)
        }
        Task { await persistSeries(assetIds: assets.map(\.id), mode: .applySeries) }
    }

    func resumePendingBatch() {
        guard let session, let checkpoint = RedigeringEditStore.loadBatch(session.id),
              !checkpoint.pendingIds.isEmpty else { return }
        Task { await persistSeries(assetIds: checkpoint.pendingIds, mode: checkpoint.mode, resume: true) }
    }

    private func persistSeries(
        assetIds: [UUID],
        mode: RedigeringEditStore.BatchCheckpoint.Mode,
        resume: Bool = false
    ) async {
        guard let svc = services(), let session else { return }
        let targets = assetIds.compactMap { id in assets.first(where: { $0.id == id }) }
        guard !targets.isEmpty else { return }
        var checkpoint = resume
            ? (RedigeringEditStore.loadBatch(session.id) ?? .init(
                mode: mode, pendingIds: assetIds, completedIds: [], failedIds: [], startedAt: .now, updatedAt: .now))
            : .init(mode: mode, pendingIds: assetIds, completedIds: [], failedIds: [], startedAt: .now, updatedAt: .now)
        RedigeringEditStore.saveBatch(checkpoint, sessionId: session.id)
        resumableBatchCount = checkpoint.pendingIds.count
        working = true; seriesTotal = targets.count; seriesProgress = 0
        defer { working = false; seriesTotal = 0 }
        var failed: [String] = []
        for a in targets {
            guard !Task.isCancelled else { break }
            let state = RedigeringEditStore.load(a.id) ?? .init(
                recipe: .neutral, exposureEV: 0, crop: nil)
            // #4: SAMME base-valg som interaktiv render (server-sky → cleaned →
            // RAW) — før ignorerte batch serverEnhancedKey, så et server-forbedret
            // bilde ble eksportert fra RAW med full recipe mens previewen viste
            // server-basen flat. Nå matcher det fotografen ser det som leveres.
            let base = workingBase(for: a)
            // Camera matching resolves PER ASSET. A mixed-camera series must not
            // inherit the selected image's model profile. Unsupported bodies
            // safely fall back to Apple embedded.
            let exportRecipe = base.graded
                ? Self.flatGradedRecipe
                : effectiveRecipe(
                    for: a,
                    userRecipe: state.recipe,
                    profileID: state.cameraColorProfileID ?? .appleEmbedded,
                    reflectionRemovalOverride: state.reflectionRemoval ?? false
                )
            let crop = state.crop
            let faceEdits = state.faceEdits ?? []
            let protected = state.protectedRegions ?? []
            let data = await Task.detached(priority: .utility) {
                RedigeringPipeline.renderExport(rawPath: base.rawPath, jpegPath: base.jpegPath,
                                                recipe: exportRecipe, exposureEV: state.exposureEV, crop: crop,
                                                faceEdits: faceEdits, protectedRegions: protected)
            }.value
            var ok = false
            if let data {
                let dest = svc.dir.appendingPathComponent("\(a.id.uuidString)-enhanced.jpg")
                if (try? data.write(to: dest, options: .atomic)) != nil {
                    try? await svc.store.attachEnhancedKey(id: a.id, key: dest.path)
                    if let fresh = try? await svc.store.fetchAsset(id: a.id),
                       let index = assets.firstIndex(where: { $0.id == a.id }) {
                        assets[index] = fresh
                    }
                    ok = true
                }
            }
            checkpoint.pendingIds.removeAll { $0 == a.id }
            checkpoint.failedIds.removeAll { $0 == a.id }
            if ok {
                checkpoint.completedIds.append(a.id)
            } else {
                failed.append(a.originalFilename)
                checkpoint.failedIds.append(a.id)
                checkpoint.pendingIds.append(a.id)
            }
            checkpoint.updatedAt = .now
            RedigeringEditStore.saveBatch(checkpoint, sessionId: session.id)
            resumableBatchCount = checkpoint.pendingIds.count
            seriesProgress += 1
        }
        let saved = targets.count - failed.count
        if checkpoint.pendingIds.isEmpty {
            RedigeringEditStore.removeBatch(session.id)
            resumableBatchCount = 0
        }
        statusMessage = failed.isEmpty
            ? "\(saved) bilder er rendret lokalt og klare for den eksisterende CreatorHub-leveringsflyten."
            : "Lagret \(saved) lokalt. \(failed.count) kan gjenopptas: \(failed.prefix(3).joined(separator: ", "))\(failed.count > 3 ? "…" : "")"
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
                    flashReturnDetected: asset.signals.flashReturnDetected,
                    editValidation: assets.first(where: { $0.id == asset.id })?.signals.editValidation)
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
        recordAudit(source: "ai-retouch", summary: count > 0 ? "AI-retusj fjernet \(count) distraksjoner" : "AI-retusj kjørt uten funn")
        persistEdit()
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
        let faceEdits = currentFaceEdits
        let protected = protectedRegions
        let data = await Task.detached(priority: .userInitiated) {
            RedigeringPipeline.renderExport(
                rawPath: useRaw,
                jpegPath: jpeg,
                recipe: r,
                exposureEV: ev,
                crop: crop,
                faceEdits: faceEdits,
                protectedRegions: protected
            )
        }.value
        guard let data else { statusMessage = "Kunne ikke lagre — bildet lot seg ikke dekode/rendre."; return }
        let dest = svc.dir.appendingPathComponent("\(asset.id.uuidString)-enhanced.jpg")
        do {
            try data.write(to: dest, options: .atomic)
            try await svc.store.attachEnhancedKey(id: asset.id, key: dest.path)
            await reloadSelected(svc.store, assetId: asset.id)
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
            recordAudit(source: "inpaint", summary: "Markert område fjernet med AI-inpaint")
            persistEdit()
            statusMessage = "Område fjernet."
            await render()
        } catch { statusMessage = "Inpaint feilet." }
    }

    /// Freehand counterpart to the legacy rectangle tool. The PNG mask is made
    /// at source resolution, with round joins/caps, then sent through the same
    /// access-controlled inpaint endpoint. Original bytes remain untouched.
    func runManualInpaint(strokes: [NormalizedBrushStroke], brushDiameter: CGFloat) async {
        guard !strokes.isEmpty, let asset = selected, let svc = services() else { return }
        guard let srcPath = asset.displayPreviewKey,
              let imageData = try? Data(contentsOf: URL(fileURLWithPath: srcPath)),
              let img = UIImage(data: imageData), let cg = img.cgImage else { return }
        working = true; statusMessage = "Fjerner penslet område…"; defer { working = false }
        let w = cg.width, h = cg.height
        let format = UIGraphicsImageRendererFormat.default(); format.scale = 1; format.opaque = true
        let maskPng = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: format).image { renderer in
            let context = renderer.cgContext
            context.setFillColor(UIColor.black.cgColor)
            context.fill(CGRect(x: 0, y: 0, width: w, height: h))
            context.setStrokeColor(UIColor.white.cgColor)
            context.setLineCap(.round)
            context.setLineJoin(.round)
            context.setLineWidth(max(2, brushDiameter * CGFloat(min(w, h))))
            for stroke in strokes where !stroke.points.isEmpty {
                let first = stroke.points[0]
                context.beginPath()
                context.move(to: CGPoint(x: first.x * CGFloat(w), y: first.y * CGFloat(h)))
                if stroke.points.count == 1 {
                    context.addLine(to: CGPoint(x: first.x * CGFloat(w) + 0.1, y: first.y * CGFloat(h)))
                } else {
                    for point in stroke.points.dropFirst() {
                        context.addLine(to: CGPoint(x: point.x * CGFloat(w), y: point.y * CGFloat(h)))
                    }
                }
                context.strokePath()
            }
        }.pngData()
        guard let maskPng else { return }
        do {
            let resp = try await svc.backend.requestPhotoEnhancerInpaint(
                imageData: imageData,
                imageMimeType: "image/jpeg",
                maskPngData: maskPng,
                intensity: 1.0
            )
            guard let bytes = Data(base64Encoded: resp.imageBase64) else {
                statusMessage = "Penselretusj feilet. Originalen er beholdt."
                return
            }
            let dest = svc.dir.appendingPathComponent("\(asset.id.uuidString)-brush-retouched.jpg")
            try bytes.write(to: dest, options: .atomic)
            try await svc.store.attachAutoCleanedKey(id: asset.id, key: dest.path, detectionCount: strokes.count)
            await reloadSelected(svc.store, assetId: asset.id)
            recordAudit(source: "brush-inpaint", summary: "Penselretusj brukt på \(strokes.count) strøk")
            persistEdit()
            statusMessage = "Penselretusj fullført. Originalen er beholdt."
            await render()
        } catch {
            statusMessage = "Penselretusj feilet. Originalen er beholdt — prøv igjen."
        }
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
        let protected = protectedRegions
        let faceAdj = activeFaceAdjustments   // [(normRect, adj)] — lokal ansikts-justering
        let styleFlash = asset.signals.flashFired   // Del D: blits-dim til lært-stil-kNN
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
                        rawPath: raw, jpegPath: jpeg, recipe: r, exposureEV: ev, crop: crop,
                        protectedRegions: protected),
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
                ci = LearnedStyle.apply(scenes: scenes, to: ci, flashFired: styleFlash)   // lært look
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
        if let img { scheduleEditValidation(for: asset, renderedImage: img) }
    }

    /// Persist the exact preview shown in the editor and validate it against
    /// the camera preview. This makes registration/pixel-QC automatic for the
    /// initial retouch and for every subsequent recipe change.
    private func scheduleEditValidation(for asset: Asset, renderedImage: UIImage) {
        guard let beforePath = asset.previewKey ?? asset.displayPreviewKey,
              beforePath != asset.enhancedKey,
              let jpeg = renderedImage.jpegData(compressionQuality: 0.94),
              let svc = services()
        else { return }
        let id = asset.id
        let destination = svc.dir.appendingPathComponent("\(id.uuidString)-edit-preview.jpg")
        editValidationTasks[id]?.cancel()
        let token = UUID()
        editValidationTaskTokens[id] = token
        editValidationTasks[id] = Task { [weak self] in
            guard let self else { return }
            do {
                try jpeg.write(to: destination, options: .atomic)
                guard !Task.isCancelled else { return }
                guard let revision = EditValidationRevision.make(
                    beforePath: beforePath,
                    afterPath: destination.path
                ) else { throw EditValidationError.unreadableImage }

                var lastError: Error?
                for attempt in 1...3 where !Task.isCancelled {
                    await self.persistEditValidation(
                        id: id,
                        store: svc.store,
                        validation: EditValidation(
                            state: .running,
                            attempts: attempt,
                            sourceRevision: revision,
                            metrics: nil,
                            lastError: nil,
                            updatedAt: .now
                        )
                    )
                    do {
                        let metrics = try await self.editValidationService.validate(
                            beforeURL: URL(fileURLWithPath: beforePath),
                            afterURL: destination
                        )
                        guard !Task.isCancelled,
                              EditValidationRevision.make(
                                beforePath: beforePath,
                                afterPath: destination.path
                              ) == revision
                        else { return }
                        await self.persistEditValidation(
                            id: id,
                            store: svc.store,
                            validation: EditValidation(
                                state: .completed,
                                attempts: attempt,
                                sourceRevision: revision,
                                metrics: metrics,
                                lastError: nil,
                                updatedAt: .now
                            )
                        )
                        self.finishEditValidationTask(id: id, token: token)
                        return
                    } catch {
                        lastError = error
                        if attempt < 3 { try? await Task.sleep(for: .seconds(Double(attempt))) }
                    }
                }
                guard !Task.isCancelled else { return }
                await self.persistEditValidation(
                    id: id,
                    store: svc.store,
                    validation: EditValidation(
                        state: .failed,
                        attempts: 3,
                        sourceRevision: revision,
                        metrics: nil,
                        lastError: lastError?.localizedDescription ?? "Ukjent analysefeil",
                        updatedAt: .now
                    )
                )
            } catch {
                statusMessage = "Retusjen vises, men automatisk QC kunne ikke lagres."
            }
            finishEditValidationTask(id: id, token: token)
        }
    }

    private func finishEditValidationTask(id: UUID, token: UUID) {
        guard editValidationTaskTokens[id] == token else { return }
        editValidationTasks.removeValue(forKey: id)
        editValidationTaskTokens.removeValue(forKey: id)
    }

    private func persistEditValidation(
        id: UUID,
        store: SessionStore,
        validation: EditValidation
    ) async {
        try? await store.updateEditValidation(id: id, validation: validation)
        guard let fresh = try? await store.fetchAsset(id: id),
              let index = assets.firstIndex(where: { $0.id == id })
        else { return }
        assets[index] = fresh
    }

    /// Reflection removal isn't a separate model — it's a strong highlight/
    /// specular tame layered on the recipe (recovers blown reflections +
    /// a touch of dehaze for glare).
    private func effectiveRecipe(
        for asset: Asset? = nil,
        userRecipe: MagicRecipe? = nil,
        profileID: CameraColorProfileID? = nil,
        reflectionRemovalOverride: Bool? = nil
    ) -> MagicRecipe {
        let target = asset ?? selected
        let targetExif: ExifInfo? = {
            if target?.id == selectedId { return exif }
            return ExifInfo.read(fromPath: target?.rawKey ?? target?.displayPreviewKey)
        }()
        var r = CameraColorProfileCatalog.effectiveRecipe(
            userRecipe: userRecipe ?? recipe,
            profileID: profileID ?? cameraColorProfileID,
            cameraModel: targetExif?.camera,
            hasRaw: target?.rawKey != nil
        )
        if reflectionRemovalOverride ?? reflectionRemoval {
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
        recordAudit(source: "crop", summary: rect == nil ? "Beskjæring fjernet" : "Beskjæring oppdatert")
        persistEdit()
        Task { await render() }
    }

    func addProtectedRegion(_ rect: CGRect) {
        let clipped = rect.standardized.intersection(CGRect(x: 0, y: 0, width: 1, height: 1))
        guard clipped.width > 0.01, clipped.height > 0.01 else { return }
        pushUndo()
        protectedRegions.append(clipped)
        recordAudit(source: "protection", summary: "La til et identitetsbeskyttet område")
        persistEdit()
        Task { await render() }
    }

    func clearProtectedRegions() {
        guard !protectedRegions.isEmpty else { return }
        pushUndo()
        protectedRegions.removeAll()
        recordAudit(source: "protection", summary: "Fjernet alle beskyttede områder")
        persistEdit()
        Task { await render() }
    }

    /// Plain-language explanation generated from the exact persisted state —
    /// never a generic AI claim disconnected from the rendered values.
    var editExplanations: [String] {
        var lines: [String] = ["Kamerabasen er \(activeCameraColorProfile.displayName)."]
        if abs(exposureEV) >= 0.01 { lines.append(String(format: "Eksponering justeres %+.2f EV.", exposureEV)) }
        if recipe.highlightRecovery > 0.01 { lines.append("Høylys beskyttes med \(Int(recipe.highlightRecovery * 100)) % styrke.") }
        if abs(recipe.warmth) > 0.01 || abs(recipe.tint) > 0.01 {
            lines.append("Hvitbalansen korrigeres separat for temperatur og grønn–magenta tint.")
        }
        if recipe.skinLowFreq > 0.01 || recipe.blemishCleanup > 0.01 || recipe.skinDiscoloration > 0.01 {
            lines.append("Hudtone og små ujevnheter retusjeres maskert; porer og identitetsmerker bevares \(recipe.preserveIdentityMarks ? "strengt" : "med redusert vern").")
        }
        if !protectedRegions.isEmpty { lines.append("\(protectedRegions.count) markerte områder kompositeres tilbake uten portrettretusj.") }
        if sceneLockReferenceId != nil { lines.append("Scene Lock bruker et valgt referansebilde for konsistent lys og farge.") }
        if currentCrop != nil { lines.append("En ikke-destruktiv beskjæring brukes i preview og eksport.") }
        if !currentFaceEdits.isEmpty { lines.append("\(currentFaceEdits.count) ansikt har en lokal, reversibel justering.") }
        return lines
    }
}

/// Conservative series matching. It transfers the reference look, then adjusts
/// only exposure, contrast, highlight protection and obvious skin cast.
enum SceneConsistencyAdvisor {
    struct Result: Sendable {
        var recipe: MagicRecipe
        var exposureEV: Double
    }

    static func match(
        referenceRecipe: MagicRecipe,
        referenceExposureEV: Double,
        reference: AssetAnalysis,
        target: AssetAnalysis
    ) -> Result {
        var recipe = referenceRecipe
        let referenceLuma = reference.primaryFace?.luma ?? reference.medianLuma
        let targetLuma = target.primaryFace?.luma ?? target.medianLuma
        let ratio = (referenceLuma + 0.03) / (targetLuma + 0.03)
        let deltaEV = min(0.75, max(-0.75, log2(max(0.2, ratio))))

        let referenceRange = reference.p95Luma - reference.p5Luma
        let targetRange = target.p95Luma - target.p5Luma
        recipe.contrast = min(1, max(-1, recipe.contrast + (referenceRange - targetRange) * 0.7))
        if target.highlightClip > reference.highlightClip + 0.01 {
            recipe.highlightRecovery = max(recipe.highlightRecovery, min(1, (target.highlightClip - reference.highlightClip) * 8))
        }
        switch target.skinCast {
        case .tooWarm?: recipe.warmth -= 0.08
        case .tooCool?: recipe.warmth += 0.08
        case .tooGreen?: recipe.tint += 0.08
        case .tooMagenta?: recipe.tint -= 0.08
        case .neutral?, nil: break
        }
        recipe.warmth = min(1, max(-1, recipe.warmth))
        recipe.tint = min(1, max(-1, recipe.tint))
        return .init(recipe: recipe, exposureEV: min(2, max(-2, referenceExposureEV + deltaEV)))
    }
}

/// Pure, deterministic portrait auto-tone policy. Kept independent of Vision
/// and UI so it can be regression-tested with representative skin/light data.
enum PortraitToneAdvisor {
    struct Result: Equatable {
        var recipe: MagicRecipe
        var exposureEV: Double
    }

    static func adjust(
        recipe: MagicRecipe,
        exposureEV: Double,
        analysis: AssetAnalysis
    ) -> Result {
        var r = recipe
        let faceLuma = max(0.08, analysis.primaryFace?.luma ?? analysis.medianLuma)
        // Partial correction keeps the scene's lighting intent; a night portrait
        // must not be normalized into daylight.
        let desiredFaceLuma = 0.48
        let correction = log2(desiredFaceLuma / faceLuma) * 0.45
        let ev = max(-2, min(2, exposureEV + max(-0.65, min(0.75, correction))))

        let subjectClip = analysis.subjectHighlightClip ?? analysis.highlightClip
        if subjectClip > 0.005 {
            r.highlightRecovery = max(r.highlightRecovery, min(0.62, 0.22 + subjectClip * 5.5))
        }
        if analysis.p5Luma < 0.08 {
            r.shadowLift = max(r.shadowLift, min(0.42, 0.12 + (0.08 - analysis.p5Luma) * 3.0))
        }
        let spread = analysis.p95Luma - analysis.p5Luma
        if spread < 0.36 { r.contrast = max(r.contrast, min(0.28, (0.36 - spread) * 0.9)) }

        switch analysis.skinCast {
        case .tooWarm: r.warmth = max(-1, r.warmth - 0.12)
        case .tooCool: r.warmth = min(1, r.warmth + 0.12)
        case .tooGreen:
            r.tint = min(1, r.tint + 0.10)
            r.skinGuard = max(r.skinGuard, 0.60)
        case .tooMagenta: r.tint = max(-1, r.tint - 0.10)
        case .neutral, .none: break
        }

        // Conservative natural-retouch baseline. Existing stronger manual
        // choices win; this action never reduces a photographer's setting.
        r.skinGuard = max(r.skinGuard, 0.60)
        r.blemishCleanup = max(r.blemishCleanup, 0.14)
        r.skinDiscoloration = max(r.skinDiscoloration, 0.12)
        r.dodgeBurn = max(r.dodgeBurn, 0.10)
        r.shineControl = max(r.shineControl, 0.08)
        r.underEyeLift = max(r.underEyeLift, 0.06)
        return Result(recipe: r, exposureEV: ev)
    }
}
