import Foundation

/// Phase 2C — orchestrator over ``RAWExportPipeline``.
///
/// Owns disk layout for RAW-rendered deliverables and turns "render this
/// asset's RAW with this recipe" into "JPEG bytes are now at this URL".
/// The actual demosaic + recipe math lives in the pipeline; this layer
/// only handles asset lookup, source-file reads, output naming, and
/// off-actor execution.
///
/// Routing — "should I use the RAW pipeline or the display-enhanced
/// JPEG?" — is **not** this service's responsibility. ``DeliveryService``
/// makes that call per asset and falls back to the existing
/// ``MagicPipeline`` enhanced output when ``Error/noRAWSource`` is thrown.
final class RAWExportService: Sendable {

    enum Error: Swift.Error, Equatable {
        case assetNotFound
        case noRAWSource
        case sourceUnreadable
        case renderFailed(String)
        case writeFailed(String)
    }

    private let store: SessionStore
    private let outputDirectory: URL

    init(store: SessionStore, outputDirectory: URL) {
        self.store = store
        self.outputDirectory = outputDirectory
        try? FileManager.default.createDirectory(
            at: outputDirectory,
            withIntermediateDirectories: true,
        )
    }

    /// Stable on-disk path for the RAW-rendered JPEG of `assetId`. Same
    /// suffix is used by ``render(assetId:recipe:)``; callers can call
    /// this first to check `FileManager.fileExists` and skip the render
    /// if a previous run already produced output.
    func exportPath(for assetId: UUID) -> URL {
        outputDirectory.appendingPathComponent("\(assetId.uuidString)-export.jpg")
    }

    /// Stable on-disk path for the WYSIWYG preview-quality RAW render
    /// (lower resolution than the deliverable, but still demosaiced
    /// through `CIRAWFilter` so the hero shows what the client will
    /// receive — not the camera-baked JPEG with its own contrast +
    /// sharpening already applied).
    func previewPath(for assetId: UUID) -> URL {
        outputDirectory.appendingPathComponent("\(assetId.uuidString)-preview.jpg")
    }

    /// Render a preview-size JPEG (default ~1920px on the long edge)
    /// from the asset's RAW for in-app hero display. Same demosaic +
    /// recipe + linear-space color path as ``render`` so the
    /// photographer sees true WYSIWYG — what's on the iPad hero is
    /// what lands in the client gallery, just at lower res.
    ///
    /// Quality 0.85 (lower than deliverable's 0.92) since this is for
    /// on-screen review only — extra compression saves disk + RAM
    /// budget when the photographer scrolls through hundreds of shots.
    func renderPreview(
        assetId: UUID,
        sourceAssetId: UUID? = nil,
        recipe: MagicRecipe,
        targetMaxDimension: CGFloat = 1920,
    ) async throws -> URL {
        let resolvedSourceId = sourceAssetId ?? assetId
        guard let sourceAsset = try await store.fetchAsset(id: resolvedSourceId) else {
            throw Error.assetNotFound
        }
        guard let rawPath = sourceAsset.rawKey,
              FileManager.default.fileExists(atPath: rawPath)
        else {
            throw Error.noRAWSource
        }

        let destination = previewPath(for: assetId)
        let identifierHint = (sourceAsset.originalFilename as NSString)
            .pathExtension
            .lowercased()

        try await Task.detached(priority: .userInitiated) {
            let rawData: Data
            do {
                rawData = try Data(
                    contentsOf: URL(fileURLWithPath: rawPath),
                    options: [.mappedIfSafe],
                )
            } catch {
                throw Error.sourceUnreadable
            }

            let jpeg: Data
            do {
                jpeg = try RAWExportPipeline.render(
                    rawData: rawData,
                    recipe: recipe,
                    identifierHint: identifierHint.isEmpty ? nil : identifierHint,
                    jpegCompressionQuality: 0.85,
                    targetMaxDimension: targetMaxDimension,
                    colorPurpose: .appPreview,
                )
            } catch {
                throw Error.renderFailed(String(describing: error))
            }

            do {
                try jpeg.write(to: destination, options: .atomic)
            } catch {
                throw Error.writeFailed(String(describing: error))
            }
        }.value

        return destination
    }

    /// Render the asset's camera-original RAW through ``RAWExportPipeline``
    /// using `recipe`, then write the resulting JPEG to
    /// ``exportPath(for:)``. Returns the on-disk URL.
    ///
    /// `sourceAssetId` defaults to `assetId` (single-file RAW shoot). Set
    /// it explicitly for dual RAW+JPG shoots where the picked asset is
    /// the JPG row but the bytes to demosaic live on the sibling CR3
    /// row's `rawKey`. Output is still keyed to the *primary* `assetId`
    /// so the upload uses the picked asset's filename + metadata.
    ///
    /// Throws ``Error/noRAWSource`` when the source asset has no RAW
    /// (JPEG-only shoot, or RAW download hasn't completed). Caller
    /// should fall back to the display-enhanced JPEG in that case.
    ///
    /// All file IO + CoreImage work runs on a detached user-initiated
    /// task so the caller's actor (typically MainActor for UI flows) is
    /// never blocked by the demosaic, which can take 1–3 s per CR3 on
    /// iPad Pro M-series.
    func render(assetId: UUID, sourceAssetId: UUID? = nil, recipe: MagicRecipe) async throws -> URL {
        let resolvedSourceId = sourceAssetId ?? assetId
        guard let sourceAsset = try await store.fetchAsset(id: resolvedSourceId) else {
            throw Error.assetNotFound
        }
        guard let rawPath = sourceAsset.rawKey,
              FileManager.default.fileExists(atPath: rawPath)
        else {
            throw Error.noRAWSource
        }

        let destination = exportPath(for: assetId)
        let identifierHint = (sourceAsset.originalFilename as NSString)
            .pathExtension
            .lowercased()

        try await Task.detached(priority: .userInitiated) {
            let rawData: Data
            do {
                rawData = try Data(
                    contentsOf: URL(fileURLWithPath: rawPath),
                    options: [.mappedIfSafe],
                )
            } catch {
                throw Error.sourceUnreadable
            }

            let jpeg: Data
            do {
                jpeg = try RAWExportPipeline.render(
                    rawData: rawData,
                    recipe: recipe,
                    identifierHint: identifierHint.isEmpty ? nil : identifierHint,
                )
            } catch {
                throw Error.renderFailed(String(describing: error))
            }

            do {
                try jpeg.write(to: destination, options: .atomic)
            } catch {
                throw Error.writeFailed(String(describing: error))
            }
        }.value

        return destination
    }
}
