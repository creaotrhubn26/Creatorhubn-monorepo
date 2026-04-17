#if DEBUG
import Foundation
import CoreImage
import UIKit

/// Simulates the photo-enhancer loop inside the app for UX testing.
/// Watches a `SessionStore` and, when a new asset has finished downloading
/// its preview, waits ~2s (matches what a real remote enhancer round-trip
/// feels like), runs a CoreImage filter chain over the preview, writes the
/// result to disk, and stores the path via `attachEnhancedKey`.
///
/// Drops in behind the same contract as the real pipeline:
///   real: iPad → backend upload → enhancer worker → enhancedKey on asset
///   demo: iPad → DemoEnhancer (in-process CIFilter) → enhancedKey on asset
///
/// Once enhancedKey is populated, the UI can show the result with no
/// further plumbing — the same hero/tile toggle lights up whether the
/// enhancement happened locally or on the backend.
@MainActor
final class DemoEnhancer {
    private let store: SessionStore
    private let outputDirectory: URL
    private var inFlight: Set<UUID> = []
    private var task: Task<Void, Never>?

    init(store: SessionStore, outputDirectory: URL) {
        self.store = store
        self.outputDirectory = outputDirectory
        try? FileManager.default.createDirectory(
            at: outputDirectory,
            withIntermediateDirectories: true
        )
    }

    func start(sessionId: UUID) {
        guard task == nil else { return }
        let store = self.store
        task = Task { [weak self] in
            let stream = store.assetsStream(sessionId: sessionId)
            for await assets in stream {
                if Task.isCancelled { break }
                await self?.process(assets)
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
        inFlight.removeAll()
    }

    private func process(_ assets: [Asset]) async {
        for asset in assets {
            guard asset.enhancedKey == nil,
                  let previewKey = asset.previewKey,
                  FileManager.default.fileExists(atPath: previewKey),
                  !inFlight.contains(asset.id)
            else { continue }
            inFlight.insert(asset.id)
            let outputPath = outputDirectory
                .appendingPathComponent("\(asset.id.uuidString)-enhanced.jpg")
            Task {
                await enhance(assetId: asset.id, source: previewKey, destination: outputPath)
            }
        }
    }

    private func enhance(assetId: UUID, source: String, destination: URL) async {
        // Simulate the round-trip the real pipeline will have when it's
        // uploading, queuing, enhancing, and returning. 2s feels like an
        // actual remote service; shorter and the UX feels too magical.
        try? await Task.sleep(for: .seconds(2))
        guard let original = UIImage(contentsOfFile: source),
              let enhanced = Self.applyFilter(to: original),
              let jpeg = enhanced.jpegData(compressionQuality: 0.85)
        else { return }
        do {
            try jpeg.write(to: destination, options: .atomic)
            try await store.attachEnhancedKey(id: assetId, key: destination.path)
        } catch {
            // Best effort — a failed demo enhancement just means the tile
            // keeps the original and the UI shows no Enhanced badge.
        }
    }

    private static func applyFilter(to image: UIImage) -> UIImage? {
        guard let ciImage = CIImage(image: image) else { return nil }
        let context = CIContext(options: nil)

        // Chain: warm the whites + boost saturation + gentle contrast lift.
        // Mirrors the look photographers would expect from a "studio auto"
        // enhancer preset; tasteful, not over-filtered.
        let color = CIFilter(name: "CIColorControls")!
        color.setValue(ciImage, forKey: kCIInputImageKey)
        color.setValue(1.25, forKey: kCIInputSaturationKey)
        color.setValue(0.05, forKey: kCIInputBrightnessKey)
        color.setValue(1.08, forKey: kCIInputContrastKey)
        guard let colorOut = color.outputImage else { return nil }

        let warm = CIFilter(name: "CITemperatureAndTint")!
        warm.setValue(colorOut, forKey: kCIInputImageKey)
        warm.setValue(CIVector(x: 6500, y: 0),   forKey: "inputNeutral")
        warm.setValue(CIVector(x: 5800, y: 10),  forKey: "inputTargetNeutral")
        guard let final = warm.outputImage,
              let cgImage = context.createCGImage(final, from: final.extent)
        else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
#endif
