import Foundation
import CoreGraphics

/// Apple Pencil markup captured on top of an asset preview. Unlike
/// ``SignatureCapture`` (a discrete flat signature), a markup is
/// *registered to the underlying photo* so the web retouch pass can
/// composite the photographer's arrows / crop-hints / "remove
/// person"-notes back over the full-resolution image without
/// alignment drift.
///
/// Storage shape (per ref):
///
///     Documents/markups/<ref>/
///       drawing.plist     PKDrawing archive (lossless, re-editable)
///       overlay.png       PNG of just the ink, transparent background
///       manifest.json     canvas size + ink bounds + timestamp
///
/// Why a PNG of "just the ink" + manifest — rather than a flattened
/// composite of (photo + ink):
///   * The photo is already on R2; re-storing it locally for every
///     marked-up frame wastes disk.
///   * The web retouch pass wants the ink alone so it can re-apply
///     at full resolution against the untouched RAW.
struct MarkupCapture: Sendable, Equatable {
    /// PKDrawing archive bytes. Round-trips through re-open so the
    /// photographer can add more strokes later.
    let drawingData: Data
    /// PNG of the ink against a transparent background. 2x retina so
    /// it survives inspection on the web editor.
    let overlayPNG: Data
    /// The canvas size the ink was drawn against. Used by the
    /// compositor on the server to scale the overlay to match the
    /// full-res image.
    let canvasSize: CGSize
    /// Tight bounding box of the ink inside the canvas.
    let inkBounds: CGRect
    let capturedAt: Date

    var isEmpty: Bool { drawingData.isEmpty || inkBounds.isEmpty }
}

/// File-backed persistence for markup captures. Mirrors the
/// ``SignatureStorage`` pattern but under its own directory — we
/// never want markups and signatures to collide by ref, and we want
/// to be able to sweep them independently when projects are
/// archived.
///
/// ``@unchecked Sendable``: ``FileManager`` isn't marked Sendable
/// in the SDK but is documented thread-safe for the read/write/
/// delete operations we use. Swift 6 strict-concurrency needs the
/// explicit conformance so stores that hold this value can also be
/// Sendable.
struct MarkupStorage: @unchecked Sendable {
    let fileManager: FileManager
    let rootDirectory: URL

    init(fileManager: FileManager = .default, rootDirectory: URL) {
        self.fileManager = fileManager
        self.rootDirectory = rootDirectory
    }

    static func defaultDirectory(
        fileManager: FileManager = .default,
    ) throws -> URL {
        let docs = try fileManager.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true,
        )
        let dir = docs.appendingPathComponent("markups", isDirectory: true)
        try fileManager.createDirectory(
            at: dir, withIntermediateDirectories: true,
        )
        return dir
    }

    @discardableResult
    func save(_ capture: MarkupCapture) throws -> String? {
        if capture.isEmpty { return nil }
        let ref = UUID().uuidString.lowercased()
        let dir = rootDirectory.appendingPathComponent(ref, isDirectory: true)
        try fileManager.createDirectory(
            at: dir, withIntermediateDirectories: true,
        )
        try capture.drawingData.write(
            to: dir.appendingPathComponent("drawing.plist"),
            options: .atomic,
        )
        try capture.overlayPNG.write(
            to: dir.appendingPathComponent("overlay.png"),
            options: .atomic,
        )
        // Canvas size matters for the server-side compositor — it
        // needs the original aspect ratio to scale the overlay to
        // full-res.
        let manifest = """
        {"capturedAt":\(capture.capturedAt.timeIntervalSince1970),\
        "canvasW":\(capture.canvasSize.width),\
        "canvasH":\(capture.canvasSize.height),\
        "x":\(capture.inkBounds.minX),"y":\(capture.inkBounds.minY),\
        "w":\(capture.inkBounds.width),"h":\(capture.inkBounds.height)}
        """
        try manifest.data(using: .utf8)?.write(
            to: dir.appendingPathComponent("manifest.json"),
            options: .atomic,
        )
        return ref
    }

    func load(ref: String) throws -> MarkupCapture? {
        let dir = rootDirectory.appendingPathComponent(ref, isDirectory: true)
        guard fileManager.fileExists(atPath: dir.path) else { return nil }
        guard
            let drawing = try? Data(contentsOf: dir.appendingPathComponent("drawing.plist")),
            let png = try? Data(contentsOf: dir.appendingPathComponent("overlay.png")),
            let manifestData = try? Data(contentsOf: dir.appendingPathComponent("manifest.json")),
            let json = try JSONSerialization.jsonObject(with: manifestData) as? [String: Double]
        else {
            return nil
        }
        return MarkupCapture(
            drawingData: drawing,
            overlayPNG: png,
            canvasSize: CGSize(
                width: json["canvasW"] ?? 0,
                height: json["canvasH"] ?? 0,
            ),
            inkBounds: CGRect(
                x: json["x"] ?? 0,
                y: json["y"] ?? 0,
                width: json["w"] ?? 0,
                height: json["h"] ?? 0,
            ),
            capturedAt: Date(timeIntervalSince1970: json["capturedAt"] ?? 0),
        )
    }

    func delete(ref: String) throws {
        let dir = rootDirectory.appendingPathComponent(ref, isDirectory: true)
        if fileManager.fileExists(atPath: dir.path) {
            try fileManager.removeItem(at: dir)
        }
    }

    func pngURL(forRef ref: String) -> URL? {
        let url = rootDirectory
            .appendingPathComponent(ref, isDirectory: true)
            .appendingPathComponent("overlay.png")
        return fileManager.fileExists(atPath: url.path) ? url : nil
    }
}
