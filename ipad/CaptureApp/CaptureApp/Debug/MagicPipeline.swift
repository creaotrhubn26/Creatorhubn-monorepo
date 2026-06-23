#if DEBUG
import Foundation
import CoreImage
import UIKit
import Vision

/// In-process Magic-enhancement pipeline. Stands in for the production
/// backend enhancer while we're still wiring auth + upload + handoff —
/// same public shape (observe SessionStore → produce enhanced preview →
/// attach via `attachEnhancedKey`), just runs CoreImage locally.
///
/// **Important context on RAW:** this pipeline operates on the display
/// JPEG Canon generates from the RAW (fetched via `?kind=display`) so the
/// UI has sub-second preview feedback while shooting continues. For
/// final-quality delivery we still need a separate RAW pass that:
///   1. downloads the CR3 via `?kind=main`,
///   2. runs it through `CIRAWFilter` (proper demosaic + WB + exposure),
///   3. applies the same `MagicRecipe` parameters (which were chosen to
///      translate cleanly to CIRAWFilter's own inputs — `temperature`,
///      `exposure`, `shadowAmount`, etc.).
/// That's Phase 2 when we wire Export. Recipe tuning on the preview is
/// a faithful proxy — warmth/shadow/contrast decisions carry over — but
/// the demosaiced RAW pass has ~2 stops more shadow headroom and
/// accurate white-balance so the committed deliverable will be cleaner
/// than what the UI shows live.
///
/// Two responsibilities:
/// 1. `start(sessionId:)` — watch for new previews; for each one run a
///    subject-aware recipe (portrait when faces detected, neutral otherwise)
///    and persist the result.
/// 2. `retune(assetId:recipe:sourcePath:)` — re-run a specific asset with
///    a new recipe when the photographer adjusts the tune sliders.
///    Overwrites the previous enhanced bytes so the UI updates
///    automatically via SessionStore's ValueObservation.
@MainActor
final class MagicPipeline {
    private let store: SessionStore
    private let outputDirectory: URL
    private var autoTask: Task<Void, Never>?
    private var inFlightAssets: Set<UUID> = []
    /// Per-asset live retune task; we cancel the previous one before
    /// spawning a new one so slider drags don't queue up parallel
    /// CoreImage renders (that was the source of the laggy tune panel).
    private var retuneTasks: [UUID: Task<Void, Never>] = [:]

    /// Tracks the auto-detected recipe for each asset so later retunes
    /// start from the right baseline if the user resets sliders.
    private(set) var baselineRecipes: [UUID: MagicRecipe] = [:]

    init(store: SessionStore, outputDirectory: URL) {
        self.store = store
        self.outputDirectory = outputDirectory
        try? FileManager.default.createDirectory(
            at: outputDirectory,
            withIntermediateDirectories: true
        )
    }

    func start(sessionId: UUID) {
        guard autoTask == nil else { return }
        let store = self.store
        autoTask = Task { [weak self] in
            let stream = store.assetsStream(sessionId: sessionId)
            for await assets in stream {
                if Task.isCancelled { break }
                await self?.autoEnhance(assets)
            }
        }
    }

    func stop() {
        autoTask?.cancel()
        autoTask = nil
        for t in retuneTasks.values { t.cancel() }
        retuneTasks.removeAll()
        inFlightAssets.removeAll()
    }

    /// Re-run Magic with a tuned recipe for one asset. Called from the
    /// Tune panel each time the photographer adjusts a slider (caller
    /// should debounce so we don't saturate CoreImage).
    func retune(assetId: UUID, recipe: MagicRecipe, sourcePath: String) {
        retuneTasks[assetId]?.cancel()
        let destination = outputDirectory
            .appendingPathComponent("\(assetId.uuidString)-enhanced.jpg")
        retuneTasks[assetId] = Task { [weak self] in
            guard let self else { return }
            await self.applyMagic(
                assetId: assetId,
                source: sourcePath,
                destination: destination,
                recipe: recipe
            )
        }
    }

    // MARK: - Auto enhance

    private func autoEnhance(_ assets: [Asset]) async {
        for asset in assets {
            guard asset.enhancedKey == nil,
                  let previewKey = asset.previewKey,
                  FileManager.default.fileExists(atPath: previewKey),
                  !inFlightAssets.contains(asset.id)
            else { continue }
            inFlightAssets.insert(asset.id)
            let destination = outputDirectory
                .appendingPathComponent("\(asset.id.uuidString)-enhanced.jpg")
            Task { [weak self] in
                guard let self else { return }
                await self.autoProcess(
                    assetId: asset.id,
                    source: previewKey,
                    destination: destination
                )
                await MainActor.run { self.inFlightAssets.remove(asset.id) }
            }
        }
    }

    private func autoProcess(assetId: UUID, source: String, destination: URL) async {
        // Feel of a real remote enhancer: ~1.5s round-trip.
        try? await Task.sleep(for: .milliseconds(1500))
        guard let image = UIImage(contentsOfFile: source) else { return }

        // Subject classification — face detect first because it's fast and
        // dominates. Then fall back to VNClassifyImageRequest's label set
        // for plane / vehicle / food / landscape / product.
        let recipe: MagicRecipe = Self.classifySubject(image)
        await MainActor.run { self.baselineRecipes[assetId] = recipe }

        await applyMagic(
            assetId: assetId,
            source: source,
            destination: destination,
            recipe: recipe
        )
    }

    // MARK: - Filter execution

    /// Does the CoreImage work on a detached task (off the main actor) so
    /// slider drags don't stutter the UI. Main-actor work is limited to
    /// reading the asset list and writing the resulting key back to
    /// SessionStore.
    private func applyMagic(
        assetId: UUID,
        source: String,
        destination: URL,
        recipe: MagicRecipe
    ) async {
        let ok: Bool = await Task.detached(priority: .userInitiated) {
            Self.renderToDisk(source: source, destination: destination, recipe: recipe)
        }.value
        guard ok, !Task.isCancelled else { return }
        try? await store.attachEnhancedKey(id: assetId, key: destination.path)
    }

    /// Render a recipe against a source JPEG and return the result as a
    /// UIImage — for the native Redigering tab's live Før/Etter preview.
    /// Reuses the exact disk pipeline (no duplicated colour logic) via a
    /// throwaway temp file. Heavy; call off the main actor and ideally on
    /// slider-release rather than every drag tick.
    nonisolated static func renderPreview(source: String, recipe: MagicRecipe) -> UIImage? {
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent("magic-preview-\(UUID().uuidString).jpg")
        defer { try? FileManager.default.removeItem(at: tmp) }
        guard renderToDisk(source: source, destination: tmp, recipe: recipe) else { return nil }
        return UIImage(contentsOfFile: tmp.path)
    }

    nonisolated private static func renderToDisk(source: String, destination: URL, recipe: MagicRecipe) -> Bool {
        guard let sourceImage = UIImage(contentsOfFile: source),
              let ciRaw = CIImage(image: sourceImage)
        else { return false }
        // `CIImage(image:)` returns sensor-natural pixels and silently
        // drops `UIImage.imageOrientation` — well-known Apple gotcha.
        // For Canon `?kind=display` JPEGs that ship with EXIF
        // orientation != 1 (camera held portrait), the rendered output
        // would arrive sideways unless we re-apply the EXIF transform
        // here. Read directly from the file bytes (authoritative)
        // rather than translating UIImage.imageOrientation, which can
        // drift through UIKit's own conversions.
        let sourceData = (try? Data(contentsOf: URL(fileURLWithPath: source))) ?? Data()
        let orientation = ColorManagement.readOrientation(from: sourceData)
        let ciImage = orientation == .up ? ciRaw : ciRaw.oriented(orientation)
        // Display-pipeline renders the camera-baked JPEG (already
        // Display P3) for in-app hero consumption. Use the appPreview
        // working space so we don't down-gamut to sRGB before display.
        let ctx = ColorManagement.makeContext(for: .appPreview)

        // Phase 5.2 — Picture Style baseline (same logic as the RAW
        // pipeline). Only when recipe is fully neutral do we read the
        // embedded Picture Style from the source JPEG and merge its
        // baseline. Photographer's slider edits trump everything.
        let effectiveRecipe: MagicRecipe = {
            let withStyle: MagicRecipe = {
                guard recipe.isNeutral,
                      let data = try? Data(contentsOf: URL(fileURLWithPath: source))
                else { return recipe }
                let style = CanonPictureStyle.read(fromImageData: data) ?? .unknown
                return recipe.merging(baseline: style.baselineRecipeAdjustment)
            }()
            // Phase 7E — subject-type overlay on top of style baseline.
            return withStyle.merging(baseline: withStyle.subjectTypeAdjustment)
        }()

        // Phase 7C — auto-straighten / horizon levelling. Apply early
        // so the auto filters + face detection + tone adjustments all
        // see the post-rotation image (face-detection coordinates +
        // mask geometry need to match the final pixels).
        let straightened = AutoStraightenFilter.apply(
            recipe: effectiveRecipe, to: ciImage,
        )

        // 1. Apple's auto-adjustment filters: white balance, tone curve,
        //    red-eye. These analyse the scene, so they give us a clean
        //    colour-neutral baseline before we apply subject-specific
        //    recipe adjustments on top.
        var current = straightened
        let autoFilters = straightened.autoAdjustmentFilters(options: [
            .enhance: true,
            .redEye: true
        ])
        for filter in autoFilters {
            filter.setValue(current, forKey: kCIInputImageKey)
            if let out = filter.outputImage { current = out }
        }

        // 2. Recipe adjustments in stable order: warmth → shadows → tone →
        //    skin. Warmth first because it interacts with white balance
        //    that the auto pass just set.

        if effectiveRecipe.warmth != 0 {
            let target = 6500.0 + effectiveRecipe.warmth * 900.0
            let f = CIFilter(name: "CITemperatureAndTint")!
            f.setValue(current, forKey: kCIInputImageKey)
            f.setValue(CIVector(x: 6500, y: 0), forKey: "inputNeutral")
            f.setValue(CIVector(x: CGFloat(target), y: 0), forKey: "inputTargetNeutral")
            if let out = f.outputImage { current = out }
        }

        if effectiveRecipe.shadowLift > 0 || effectiveRecipe.highlightRecovery > 0 {
            // CIHighlightShadowAdjust handles both axes in one pass.
            // **Audit fix 2026-05-04**: per Apple Core Image Filter
            // Reference, `inputHighlightAmount` is range [0, 1] = "by
            // how much to dampen highlights": 0 = no dampening (no
            // recovery), 1 = max dampening (full recovery). Default
            // is 1 so the filter does something out-of-the-box, but
            // *identity* (image unchanged) is at 0. Pre-audit code
            // used `-recipe.highlightRecovery` which Core Image
            // clamped to 0 → no dampening → the slider was DEAD at
            // every value. Sky/glaze highlights never recovered.
            // Fixed: pass the slider directly so 0 = identity, 1 = max.
            let f = CIFilter(name: "CIHighlightShadowAdjust")!
            f.setValue(current, forKey: kCIInputImageKey)
            f.setValue(effectiveRecipe.shadowLift, forKey: "inputShadowAmount")
            f.setValue(effectiveRecipe.highlightRecovery, forKey: "inputHighlightAmount")
            if let out = f.outputImage { current = out }
        }

        // Phase 6 — dehaze proxy (coordinated contrast + sat + shadow
        // nudge). Applied first so subsequent contrast/sat sliders
        // stack on top.
        if effectiveRecipe.dehaze > 0 {
            let d = effectiveRecipe.dehaze
            if let pre = CIFilter(name: "CIColorControls") {
                pre.setValue(current, forKey: kCIInputImageKey)
                pre.setValue(1.0 + d * 0.15, forKey: kCIInputContrastKey)
                pre.setValue(1.0 + d * 0.10, forKey: kCIInputSaturationKey)
                if let out = pre.outputImage { current = out }
            }
            if let shadow = CIFilter(name: "CIHighlightShadowAdjust") {
                shadow.setValue(current, forKey: kCIInputImageKey)
                shadow.setValue(d * 0.10, forKey: "inputShadowAmount")
                shadow.setValue(1.0, forKey: "inputHighlightAmount")
                if let out = shadow.outputImage { current = out }
            }
        }

        if effectiveRecipe.contrast != 0 || effectiveRecipe.saturation != 0 {
            let f = CIFilter(name: "CIColorControls")!
            f.setValue(current, forKey: kCIInputImageKey)
            f.setValue(1.0 + effectiveRecipe.saturation * 0.45, forKey: kCIInputSaturationKey)
            f.setValue(1.0 + effectiveRecipe.contrast * 0.45, forKey: kCIInputContrastKey)
            if let out = f.outputImage { current = out }
        }

        // Phase 6 — Vibrance (CIVibrance lifts dull colors only).
        if effectiveRecipe.vibrance != 0 {
            if let v = CIFilter(name: "CIVibrance") {
                v.setValue(current, forKey: kCIInputImageKey)
                v.setValue(effectiveRecipe.vibrance, forKey: "inputAmount")
                if let out = v.outputImage { current = out }
            }
        }

        // Phase 6 — Texture (wide-radius unsharp mask).
        if effectiveRecipe.texture > 0 {
            if let t = CIFilter(name: "CIUnsharpMask") {
                t.setValue(current, forKey: kCIInputImageKey)
                t.setValue(25.0, forKey: kCIInputRadiusKey)
                t.setValue(effectiveRecipe.texture * 0.6, forKey: kCIInputIntensityKey)
                if let out = t.outputImage { current = out }
            }
        }

        // Phase 7 — frequency-separated skin retouch. Low-freq (tone)
        // and high-freq (detail) treated independently, matching
        // Evoto's split-slider model. Legacy `skinSmooth` folds into
        // the low-freq positive direction so old recipes still smooth.
        let lowFreqPos = max(0, effectiveRecipe.skinLowFreq)
            + max(0, effectiveRecipe.skinSmooth)
        if lowFreqPos > 0 {
            // Edge-preserving smoothing for tone — CINoiseReduction is
            // Apple's bilateral filter; smooths flat tonal areas while
            // preserving edges (eyelashes, lip edges, hair strands).
            // Sharpness raised from 0.5 → 0.7 vs pre-Phase-7 because
            // the dedicated high-freq axis now owns detail-rebuild;
            // we no longer need the sharpen-after-blur kludge.
            if let nr = CIFilter(name: "CINoiseReduction") {
                nr.setValue(current, forKey: kCIInputImageKey)
                nr.setValue(min(1, lowFreqPos) * 0.06, forKey: "inputNoiseLevel")
                nr.setValue(0.7, forKey: "inputSharpness")
                if let reduced = nr.outputImage {
                    current = reduced
                }
            }
        }
        if effectiveRecipe.skinLowFreq < 0 {
            // Enhance facial structure (subtle broad-tonal contrast).
            if let cc = CIFilter(name: "CIColorControls") {
                cc.setValue(current, forKey: kCIInputImageKey)
                cc.setValue(1.0 + (-effectiveRecipe.skinLowFreq) * 0.15,
                            forKey: kCIInputContrastKey)
                if let out = cc.outputImage { current = out }
            }
        }
        if effectiveRecipe.skinHighFreq > 0 {
            // Sharpen pore detail (narrow-radius unsharp mask).
            if let s = CIFilter(name: "CIUnsharpMask") {
                s.setValue(current, forKey: kCIInputImageKey)
                s.setValue(1.5, forKey: kCIInputRadiusKey)
                s.setValue(effectiveRecipe.skinHighFreq * 0.5,
                           forKey: kCIInputIntensityKey)
                if let out = s.outputImage { current = out }
            }
        } else if effectiveRecipe.skinHighFreq < 0 {
            // Blur micro-texture (gentle gaussian for portrait soften).
            if let blur = CIFilter(name: "CIGaussianBlur") {
                blur.setValue(current, forKey: kCIInputImageKey)
                blur.setValue((-effectiveRecipe.skinHighFreq) * 1.2,
                              forKey: kCIInputRadiusKey)
                if let out = blur.outputImage { current = out }
            }
        }

        // Phase 7B — eye-region sharpen + catch-light boost. Detection
        // sees the fully-toned image so the masked filters apply on top
        // of all upstream adjustments. No-op when no faces detected.
        current = EyeEffectFilter.apply(recipe: effectiveRecipe, to: current)

        // Phase 7D — teeth whitening (innerLips-polygon-masked).
        current = TeethWhiteningFilter.apply(recipe: effectiveRecipe, to: current)

        // Phase 7F — face↔body skin-tone unify.
        current = SkinToneUnifyFilter.apply(recipe: effectiveRecipe, to: current)

        guard !Task.isCancelled,
              let cgImage = ColorManagement.renderCGImage(
                from: current, context: ctx, purpose: .appPreview,
              )
        else { return false }
        // Encode through ColorManagement so the JPEG carries a P3
        // ICC profile tag — UIImage.jpegData strips that and falls
        // back to the device color space at decode time.
        do {
            let jpeg = try ColorManagement.encodeJPEG(
                cgImage: cgImage, purpose: .appPreview, quality: 0.85,
            )
            try jpeg.write(to: destination, options: .atomic)
            return true
        } catch {
            return false
        }
    }

    // MARK: - Subject classification

    /// Returns the recipe that best matches the subject in `image`.
    /// Order of checks matches importance: faces are the dominant signal
    /// for "portrait" and override everything else; then Vision's general
    /// scene classifier picks up plane / car / food / landscape / product.
    /// **Audit 2026-05-04** — fix for false-positive portrait detection
    /// on food/object photos. Pre-fix order was: faces first, scene-
    /// classifier as fallback. Result: VNDetectFaceRectanglesRequest
    /// hit 0.5 confidence on the curved highlights of bread/object
    /// shots and forced portrait recipe (skin-smoothing on food
    /// texture, warm bias on already-warm subjects).
    ///
    /// New order: scene classifier FIRST. If it confidently matches
    /// a non-portrait subject, that wins. Only when scene classifier
    /// returns no high-confidence match do we fall back to face
    /// detection — and then with a much higher confidence floor
    /// (0.85, not 0.5) so an actual portrait has to look like one.
    private static func classifySubject(_ image: UIImage) -> MagicRecipe {
        guard let cgImage = image.cgImage else { return .neutral }

        // Scene classifier first — `VNClassifyImageRequest` returns
        // labels like "sports_car", "airliner", "plate", "mountain",
        // "product". Threshold 0.30 (slightly tighter than the old
        // 0.25) so weak guesses don't fire wrong recipes.
        let request = VNClassifyImageRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do { try handler.perform([request]) } catch { return faceFallback(cgImage: cgImage) }

        let labels = (request.results ?? [])
            .filter { $0.confidence >= 0.30 }
            .map(\.identifier)
            .map { $0.lowercased() }

        // Substring match instead of exact set membership: Apple's
        // classifier returns compound identifiers like
        // "strawberry_ice_cream" / "french_bulldog" / "sports_car";
        // pre-fix exact matching missed almost every compound. Now
        // any label containing a hint substring counts.
        if Self.matchesAny(labels, in: Self.aviationHints) { return .aviation }
        if Self.matchesAny(labels, in: Self.vehicleHints) { return .vehicle }
        if Self.matchesAny(labels, in: Self.foodHints) { return .food }
        if Self.matchesAny(labels, in: Self.landscapeHints) { return .landscape }
        if Self.matchesAny(labels, in: Self.productHints) { return .product }

        // No confident scene match — try faces with a strict floor.
        return faceFallback(cgImage: cgImage)
    }

    /// Substring match — any classifier label containing any hint
    /// counts. Apple's bundled scene classifier returns compound
    /// identifiers like "french_bulldog" / "strawberry_ice_cream" /
    /// "sports_car" that won't match a flat set of base nouns.
    private static func matchesAny(_ labels: [String], in hints: Set<String>) -> Bool {
        for label in labels {
            for hint in hints where label.contains(hint) {
                return true
            }
        }
        return false
    }

    private static func faceFallback(cgImage: CGImage) -> MagicRecipe {
        let request = VNDetectFaceRectanglesRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do { try handler.perform([request]) } catch { return .neutral }
        // 0.85 confidence floor — an actual portrait clears this; a
        // bread-as-face hallucination doesn't. Pre-fix value was 0.5
        // which was the source of the cross-genre misfires.
        let hasFace = request.results?.contains { $0.confidence >= 0.85 } ?? false
        return hasFace ? .portrait : .neutral
    }

    // The label vocabulary below is a subset of Apple's bundled scene
    // classifier output, ranked by what a photographer would shoot. Match
    // on substring so we cover model-specific variants ("sports_car" vs
    // "sportscar"). Hints live as lowercased identifiers.
    private static let aviationHints: Set<String> = [
        "airliner", "airplane", "biplane", "jet", "aircraft", "propeller_plane", "fighter_plane", "seaplane"
    ]
    private static let vehicleHints: Set<String> = [
        "sports_car", "convertible", "limousine", "car", "minivan", "pickup",
        "racer", "jeep", "motorcycle", "motor_scooter", "truck", "bus"
    ]
    private static let foodHints: Set<String> = [
        // Substring-matched, so "strawberry_ice_cream" matches "ice"
        // and "french_loaf" matches "loaf". Coverage tilted toward
        // common iPad-shoot food categories.
        "food", "meal", "dish", "appetizer", "snack", "plate",
        "pizza", "burger", "hamburger", "cheeseburger", "sandwich",
        "burrito", "taco", "hot_dog", "hotdog",
        "pasta", "spaghetti", "ravioli", "lasagna", "carbonara",
        "sushi", "ramen", "soup", "consomme", "stew", "hotpot",
        "salad", "dessert", "cake", "pie", "tart", "pastry", "donut", "doughnut",
        "bread", "bun", "loaf", "bagel", "roll", "pretzel", "scone", "biscuit",
        "pancake", "waffle", "crepe", "toast",
        "ice", "cream", "popsicle", "lolly", "icecream",
        "chocolate", "candy", "sweet",
        "steak", "chop", "ribs", "roast", "meatloaf",
        "cocktail", "wine", "beer", "espresso", "cappuccino", "latte",
        "coffee", "tea_cup", "teacup",
        "fruit", "vegetable", "tomato", "apple", "orange", "banana", "lemon",
        "strawberry", "broccoli", "carrot", "cucumber", "pepper", "mushroom",
        "egg", "omelet", "bacon"
    ]
    private static let landscapeHints: Set<String> = [
        "landscape", "mountain", "beach", "seashore", "valley", "lake", "river",
        "forest", "field", "sky", "sunrise", "sunset", "cityscape", "skyline"
    ]
    private static let productHints: Set<String> = [
        "product", "bottle", "watch", "shoe", "handbag", "electronic_device",
        "laptop", "smartphone", "camera", "headphone", "sunglasses"
    ]
}
#endif
