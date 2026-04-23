import Foundation
import CoreGraphics

/// A captured signature, ready to persist + render. Produced by
/// ``SignatureCanvasView`` when the photographer (or client) finishes
/// drawing. Reusable across contract signing, quote approval, and
/// whatever other signed-from-iPad flows land later.
///
/// We carry *both* the PKDrawing archive bytes (lossless — allows a
/// user to keep drawing if they want) and a rendered PNG (flat,
/// stamp-able into PDFs, 2x retina). The bounds let us crop
/// whitespace when stamping onto a signature line of known size.
struct SignatureCapture: Sendable, Equatable {
    /// PKDrawing archive — opaque Apple-owned format. Preserve as-is
    /// across restore so re-opening the signature canvas picks up
    /// exactly where the drawer left off.
    let drawingData: Data
    /// Flattened PNG. Always 2x scale so stamping into a PDF looks
    /// sharp on retina displays without re-rendering.
    let pngData: Data
    /// Tight bounding box of the ink inside the canvas. Nil when the
    /// canvas is empty (``.isEmpty = true``).
    let bounds: CGRect
    let capturedAt: Date

    /// True when no strokes were drawn. ``SignatureStorage`` treats
    /// saving an empty capture as "delete the signature".
    var isEmpty: Bool { drawingData.isEmpty || bounds.isEmpty }
}

/// File-backed persistence for captured signatures. Each signature
/// is stored under ``Documents/signatures/<ref>/`` as two files —
/// ``drawing.plist`` (the PKDrawing archive) and ``signature.png``
/// (the flat render). We deliberately don't blob this into SQLite:
/// signatures are 20-100kB each and belong on the filesystem, not
/// in a row.
///
/// ``ref`` values are opaque UUID strings that get stored on the
/// ``contract.signatureDataRef`` column. A nil ref means the contract
/// has no signature yet.
/// ``@unchecked Sendable``: ``FileManager`` isn't Sendable in the
/// SDK but is documented thread-safe for the read/write/delete ops
/// we use. Swift 6 strict-concurrency needs the explicit
/// conformance so stores that hold this value can also be Sendable.
struct SignatureStorage: @unchecked Sendable {
    let fileManager: FileManager
    /// Directory to store signatures under. Injectable for tests —
    /// production uses ``defaultDirectory()``.
    let rootDirectory: URL

    init(fileManager: FileManager = .default, rootDirectory: URL) {
        self.fileManager = fileManager
        self.rootDirectory = rootDirectory
    }

    /// Production default: ``Documents/signatures/``.
    static func defaultDirectory(fileManager: FileManager = .default) throws -> URL {
        let docs = try fileManager.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true,
        )
        let dir = docs.appendingPathComponent("signatures", isDirectory: true)
        try fileManager.createDirectory(
            at: dir,
            withIntermediateDirectories: true,
        )
        return dir
    }

    /// Persist a capture. Returns the ``ref`` to store on the row.
    /// Saving an ``isEmpty`` capture is a noop + returns nil because
    /// we never want a zero-ink signature being flagged as "signed".
    @discardableResult
    func save(_ capture: SignatureCapture) throws -> String? {
        if capture.isEmpty { return nil }
        let ref = UUID().uuidString.lowercased()
        let dir = rootDirectory.appendingPathComponent(ref, isDirectory: true)
        try fileManager.createDirectory(
            at: dir,
            withIntermediateDirectories: true,
        )
        try capture.drawingData.write(
            to: dir.appendingPathComponent("drawing.plist"),
            options: .atomic,
        )
        try capture.pngData.write(
            to: dir.appendingPathComponent("signature.png"),
            options: .atomic,
        )
        // Bounds are inline in the file names as a simple manifest so
        // ``load`` can restore them without a separate metadata read.
        let manifest = """
        {"capturedAt":\(capture.capturedAt.timeIntervalSince1970),\
        "x":\(capture.bounds.minX),"y":\(capture.bounds.minY),\
        "w":\(capture.bounds.width),"h":\(capture.bounds.height)}
        """
        try manifest.data(using: .utf8)?.write(
            to: dir.appendingPathComponent("manifest.json"),
            options: .atomic,
        )
        return ref
    }

    /// Rehydrate a capture for display + re-edit. Returns nil when the
    /// ref is unknown — callers should treat that as "no signature".
    func load(ref: String) throws -> SignatureCapture? {
        let dir = rootDirectory.appendingPathComponent(ref, isDirectory: true)
        guard fileManager.fileExists(atPath: dir.path) else {
            return nil
        }
        let drawingURL = dir.appendingPathComponent("drawing.plist")
        let pngURL = dir.appendingPathComponent("signature.png")
        let manifestURL = dir.appendingPathComponent("manifest.json")
        guard
            let drawing = try? Data(contentsOf: drawingURL),
            let png = try? Data(contentsOf: pngURL),
            let manifestData = try? Data(contentsOf: manifestURL),
            let json = try JSONSerialization.jsonObject(with: manifestData) as? [String: Double]
        else {
            return nil
        }
        return SignatureCapture(
            drawingData: drawing,
            pngData: png,
            bounds: CGRect(
                x: json["x"] ?? 0,
                y: json["y"] ?? 0,
                width: json["w"] ?? 0,
                height: json["h"] ?? 0,
            ),
            capturedAt: Date(timeIntervalSince1970: json["capturedAt"] ?? 0),
        )
    }

    /// Remove a signature when the user clears it. Idempotent — it's
    /// safe to call with an already-missing ref.
    func delete(ref: String) throws {
        let dir = rootDirectory.appendingPathComponent(ref, isDirectory: true)
        if fileManager.fileExists(atPath: dir.path) {
            try fileManager.removeItem(at: dir)
        }
    }

    /// Return the rendered PNG file URL for a stored signature, if
    /// present. UI uses this to display the signed signature without
    /// holding bytes in memory.
    func pngURL(forRef ref: String) -> URL? {
        let url = rootDirectory
            .appendingPathComponent(ref, isDirectory: true)
            .appendingPathComponent("signature.png")
        return fileManager.fileExists(atPath: url.path) ? url : nil
    }
}
