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
        inFlightAssets.removeAll()
    }

    /// Re-run Magic with a tuned recipe for one asset. Called from the
    /// Tune panel each time the photographer adjusts a slider (caller
    /// should debounce so we don't saturate CoreImage).
    func retune(assetId: UUID, recipe: MagicRecipe, sourcePath: String) {
        let destination = outputDirectory
            .appendingPathComponent("\(assetId.uuidString)-enhanced.jpg")
        Task { [weak self] in
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

    private func applyMagic(
        assetId: UUID,
        source: String,
        destination: URL,
        recipe: MagicRecipe
    ) async {
        guard let sourceImage = UIImage(contentsOfFile: source),
              let enhanced = Self.apply(recipe: recipe, to: sourceImage),
              let jpeg = enhanced.jpegData(compressionQuality: 0.85)
        else { return }
        do {
            try jpeg.write(to: destination, options: .atomic)
            try await store.attachEnhancedKey(id: assetId, key: destination.path)
        } catch {
            // Best-effort; silent on failure.
        }
    }

    private static func apply(recipe: MagicRecipe, to image: UIImage) -> UIImage? {
        guard let ciImage = CIImage(image: image) else { return nil }
        let ctx = CIContext(options: nil)
        var current = ciImage

        if recipe.warmth != 0 {
            let target = 6500.0 + recipe.warmth * 700.0
            let f = CIFilter(name: "CITemperatureAndTint")!
            f.setValue(current, forKey: kCIInputImageKey)
            f.setValue(CIVector(x: 6500, y: 0), forKey: "inputNeutral")
            f.setValue(CIVector(x: CGFloat(target), y: 0), forKey: "inputTargetNeutral")
            if let out = f.outputImage { current = out }
        }

        if recipe.shadowLift > 0 {
            let f = CIFilter(name: "CIHighlightShadowAdjust")!
            f.setValue(current, forKey: kCIInputImageKey)
            f.setValue(recipe.shadowLift, forKey: "inputShadowAmount")
            f.setValue(0.0, forKey: "inputHighlightAmount")
            if let out = f.outputImage { current = out }
        }

        if recipe.contrast != 0 || recipe.saturation != 0 {
            let f = CIFilter(name: "CIColorControls")!
            f.setValue(current, forKey: kCIInputImageKey)
            f.setValue(1.0 + recipe.saturation * 0.35, forKey: kCIInputSaturationKey)
            f.setValue(1.0 + recipe.contrast * 0.35, forKey: kCIInputContrastKey)
            if let out = f.outputImage { current = out }
        }

        if recipe.skinSmooth > 0 {
            let blur = CIFilter(name: "CIGaussianBlur")!
            blur.setValue(current, forKey: kCIInputImageKey)
            blur.setValue(recipe.skinSmooth * 1.5, forKey: kCIInputRadiusKey)
            if let soft = blur.outputImage {
                current = soft.cropped(to: ciImage.extent)
            }
            let sharpen = CIFilter(name: "CISharpenLuminance")!
            sharpen.setValue(current, forKey: kCIInputImageKey)
            sharpen.setValue(0.4, forKey: kCIInputSharpnessKey)
            if let out = sharpen.outputImage { current = out }
        }

        guard let cgImage = ctx.createCGImage(current, from: ciImage.extent) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }

    // MARK: - Subject classification

    /// Returns the recipe that best matches the subject in `image`.
    /// Order of checks matches importance: faces are the dominant signal
    /// for "portrait" and override everything else; then Vision's general
    /// scene classifier picks up plane / car / food / landscape / product.
    private static func classifySubject(_ image: UIImage) -> MagicRecipe {
        guard let cgImage = image.cgImage else { return .neutral }

        if detectFaces(cgImage: cgImage) { return .portrait }

        // VNClassifyImageRequest returns labels like "sports_car",
        // "airliner", "plate", "mountain", "product". Confidence > 0.25
        // is the practical threshold for iOS's bundled model.
        let request = VNClassifyImageRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do { try handler.perform([request]) } catch { return .neutral }

        let labels = (request.results ?? [])
            .filter { $0.confidence >= 0.25 }
            .map(\.identifier)
            .map { $0.lowercased() }

        if labels.contains(where: Self.aviationHints.contains) { return .aviation }
        if labels.contains(where: Self.vehicleHints.contains)  { return .vehicle }
        if labels.contains(where: Self.foodHints.contains)     { return .food }
        if labels.contains(where: Self.landscapeHints.contains){ return .landscape }
        if labels.contains(where: Self.productHints.contains)  { return .product }
        return .neutral
    }

    private static func detectFaces(cgImage: CGImage) -> Bool {
        let request = VNDetectFaceRectanglesRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do { try handler.perform([request]) } catch { return false }
        return request.results?.contains { $0.confidence >= 0.5 } ?? false
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
        "food", "meal", "plate", "pizza", "hamburger", "burger", "pasta", "sushi",
        "salad", "dessert", "cake", "bread", "pancake", "soup", "steak", "cocktail",
        "wine_glass", "coffee", "beer_glass"
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
