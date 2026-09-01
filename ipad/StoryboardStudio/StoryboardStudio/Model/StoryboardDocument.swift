import CryptoKit
import Foundation

/// Persisted layer composition shared by the live canvas, exports and Role Room.
/// Unknown/custom layers are intentionally supported so older and newer clients
/// can round-trip a document without dropping production data.
enum BoardLayerBlendMode: String, Codable, Sendable, CaseIterable, Identifiable {
    case normal
    case multiply
    case screen
    case add

    var id: String { rawValue }

    var label: String {
        switch self {
        case .normal: return "Normal"
        case .multiply: return "Multiply"
        case .screen: return "Screen"
        case .add: return "Add"
        }
    }
}

struct BoardLayerState: Codable, Sendable, Equatable {
    static let schemaVersion = 2

    var version: Int
    var order: [String]
    var hidden: Set<String>
    var locked: Set<String>
    var opacity: [String: Double]
    var blendModes: [String: BoardLayerBlendMode]
    var activeLayer: String

    init(
        version: Int = Self.schemaVersion,
        order: [String] = BoardLayers.defaultOrder,
        hidden: Set<String> = [],
        locked: Set<String> = [],
        opacity: [String: Double] = [:],
        blendModes: [String: BoardLayerBlendMode] = [:],
        activeLayer: String = "Drawing"
    ) {
        self.version = version
        self.order = Self.normalizedOrder(order)
        self.hidden = hidden
        self.locked = locked
        self.opacity = opacity.mapValues { min(1, max(0, $0)) }
        self.blendModes = blendModes
        self.activeLayer = Self.normalizedOrder(order).contains(activeLayer)
            ? activeLayer : "Drawing"
    }

    static var standard: BoardLayerState { BoardLayerState() }

    static func normalizedOrder(_ proposed: [String]) -> [String] {
        var seen = Set<String>()
        var result = proposed
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
        for layer in BoardLayers.defaultOrder where seen.insert(layer).inserted {
            result.append(layer)
        }
        return result
    }

    mutating func normalize() {
        order = Self.normalizedOrder(order)
        hidden = hidden.intersection(order)
        locked = locked.intersection(order)
        opacity = opacity.filter { order.contains($0.key) }
            .mapValues { min(1, max(0, $0)) }
        blendModes = blendModes.filter { order.contains($0.key) }
        if !order.contains(activeLayer) { activeLayer = "Drawing" }
        version = Self.schemaVersion
    }
}

struct StoryboardPaintoverChangeSet: Sendable, Equatable {
    var pencilContentChanged: Bool
    var framingChanged: Bool
    var colorChanged: Bool
    var atmosphereChanged: Bool

    var pencilChanged: Bool {
        pencilContentChanged || framingChanged
    }

    var isPaintoverOnly: Bool {
        !pencilChanged && (colorChanged || atmosphereChanged)
    }

    init(
        pencilContentChanged: Bool,
        framingChanged: Bool,
        colorChanged: Bool,
        atmosphereChanged: Bool
    ) {
        self.pencilContentChanged = pencilContentChanged
        self.framingChanged = framingChanged
        self.colorChanged = colorChanged
        self.atmosphereChanged = atmosphereChanged
    }

    /// Compatibility initializer for callers that only model an aggregate
    /// Pencil-source mutation. Classifier results use the split initializer.
    init(
        pencilChanged: Bool,
        colorChanged: Bool,
        atmosphereChanged: Bool
    ) {
        pencilContentChanged = pencilChanged
        framingChanged = false
        self.colorChanged = colorChanged
        self.atmosphereChanged = atmosphereChanged
    }
}

struct StoryboardPaintoverState: Codable, Sendable, Equatable {
    var version: Int = 1
    var colorRevision: Int = 0
    var atmosphereRevision: Int = 0
    var colorFingerprint: String = ""
    var atmosphereFingerprint: String = ""
    var colorHasContent: Bool = false
    var atmosphereHasContent: Bool = false
    var atmosphereStale: Bool = false
    var videoStale: Bool = false

    func applying(_ changes: StoryboardPaintoverChangeSet) -> Self {
        var result = self
        if changes.colorChanged {
            result.colorRevision += 1
            result.atmosphereStale = true
            result.videoStale = true
        }
        if changes.atmosphereChanged {
            result.atmosphereRevision += 1
            result.videoStale = true
        }
        return result
    }
}

/// Strict bridge for the server-owned paintover identity. Missing or malformed
/// fields fail closed instead of inventing local revisions that could bind a
/// paid request to a different editable overlay.
enum StoryboardPaintoverStateCoding {
    static func decode(_ value: Any?) -> StoryboardPaintoverState? {
        guard let object = value as? [String: Any],
              integer(object["version"]) == 1,
              let colorRevision = integer(object["colorRevision"]),
              colorRevision >= 0,
              let atmosphereRevision = integer(object["atmosphereRevision"]),
              atmosphereRevision >= 0,
              let colorFingerprint = fingerprint(object["colorFingerprint"]),
              let atmosphereFingerprint = fingerprint(
                object["atmosphereFingerprint"]),
              let colorHasContent = boolean(object["colorHasContent"]),
              let atmosphereHasContent = boolean(
                object["atmosphereHasContent"]),
              let atmosphereStale = boolean(object["atmosphereStale"]),
              let videoStale = boolean(object["videoStale"])
        else { return nil }
        return StoryboardPaintoverState(
            version: 1,
            colorRevision: colorRevision,
            atmosphereRevision: atmosphereRevision,
            colorFingerprint: colorFingerprint,
            atmosphereFingerprint: atmosphereFingerprint,
            colorHasContent: colorHasContent,
            atmosphereHasContent: atmosphereHasContent,
            atmosphereStale: atmosphereStale,
            videoStale: videoStale)
    }

    static func object(_ state: StoryboardPaintoverState) -> [String: Any] {
        [
            "version": state.version,
            "colorRevision": state.colorRevision,
            "atmosphereRevision": state.atmosphereRevision,
            "colorFingerprint": state.colorFingerprint,
            "atmosphereFingerprint": state.atmosphereFingerprint,
            "colorHasContent": state.colorHasContent,
            "atmosphereHasContent": state.atmosphereHasContent,
            "atmosphereStale": state.atmosphereStale,
            "videoStale": state.videoStale,
        ]
    }

    private static func integer(_ value: Any?) -> Int? {
        if let value = value as? Int { return value }
        if let value = value as? NSNumber { return value.intValue }
        if let value = value as? String { return Int(value) }
        return nil
    }

    private static func boolean(_ value: Any?) -> Bool? {
        if let value = value as? Bool { return value }
        if let value = value as? NSNumber { return value.boolValue }
        return nil
    }

    private static func fingerprint(_ value: Any?) -> String? {
        guard let value = value as? String,
              value.count == 64,
              value.unicodeScalars.allSatisfy({
                (48...57).contains($0.value) || (65...70).contains($0.value)
                    || (97...102).contains($0.value)
              }) else { return nil }
        return value.lowercased()
    }
}

enum StoryboardPaintoverCompositeStage: String, Codable, Sendable {
    case color
    case atmosphere
}

/// Lossless client-rendered freeze plus every server-owned OCC/CAS token used
/// to prove which approved base and editable overlays its pixels represent.
struct StoryboardPaintoverComposite: Codable, Sendable, Equatable {
    let imageData: String
    let width: Int
    let height: Int
    let includedThroughStage: StoryboardPaintoverCompositeStage
    let baseVersionId: String
    let frameUpdatedAt: String
    let sourceUpdatedAt: String
    let sourceRevision: Int
    let framingFingerprint: String
    let colorRevision: Int
    let atmosphereRevision: Int
    let colorFingerprint: String
    let atmosphereFingerprint: String

    var identityFingerprint: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(self) else { return "" }
        return SHA256.hash(data: data)
            .map { String(format: "%02x", $0) }.joined()
    }

    var requestObject: [String: any Sendable] {
        [
            "imageData": imageData,
            "width": width,
            "height": height,
            "includedThroughStage": includedThroughStage.rawValue,
            "baseVersionId": baseVersionId,
            "frameUpdatedAt": frameUpdatedAt,
            "sourceUpdatedAt": sourceUpdatedAt,
            "sourceRevision": sourceRevision,
            "framingFingerprint": framingFingerprint,
            "colorRevision": colorRevision,
            "atmosphereRevision": atmosphereRevision,
            "colorFingerprint": colorFingerprint,
            "atmosphereFingerprint": atmosphereFingerprint,
        ]
    }
}

/// Chooses the newest safe approved base without ever double-applying a
/// lower-stage overlay. Atmosphere is usable only while Color has not made it
/// stale; otherwise animation intentionally falls back to approved Color.
enum StoryboardPaintoverStageSelection {
    static func animationStage(
        hasApprovedColor: Bool,
        hasApprovedAtmosphere: Bool,
        state: StoryboardPaintoverState?,
        localChanges: StoryboardPaintoverChangeSet = .init(
            pencilChanged: false, colorChanged: false,
            atmosphereChanged: false)
    ) -> StoryboardPaintoverCompositeStage? {
        guard !localChanges.pencilChanged, hasApprovedColor else { return nil }
        if hasApprovedAtmosphere,
           state?.atmosphereStale == false,
           !localChanges.colorChanged {
            return .atmosphere
        }
        return .color
    }

    static func canGenerateAtmosphere(
        hasApprovedColor: Bool,
        state: StoryboardPaintoverState?,
        localChanges: StoryboardPaintoverChangeSet
    ) -> Bool {
        hasApprovedColor && state != nil && !localChanges.pencilChanged
    }

    static func overlayLayers(
        for stage: StoryboardPaintoverCompositeStage
    ) -> Set<String> {
        switch stage {
        case .color: return ["Color"]
        case .atmosphere: return ["Atmosphere"]
        }
    }
}

/// Mirrors the backend paintover classifier. The shared WAL remains one atomic
/// stroke document, while only Drawing/camera changes advance Pencil source.
enum StoryboardPaintoverDocumentPolicy {
    private struct LayerVisualIdentity: Equatable {
        var hidden: Bool
        var opacity: Double
        var blendMode: BoardLayerBlendMode
        var compositeOrder: [String]?
    }

    private static let compositeLayers = Set(["Drawing", "Color", "Atmosphere"])
    private static let standardRenderOrder = [
        "Color", "Atmosphere", "Drawing", "Camera / Arrows", "Dialog", "Notes",
    ]

    static func classify(
        baseStrokesJSON: String?,
        currentStrokes: [PencilStroke],
        baseLayerState: BoardLayerState?,
        currentLayerState: BoardLayerState,
        baseShotFraming: ShotFramingState?,
        currentShotFraming: ShotFramingState
    ) -> StoryboardPaintoverChangeSet {
        guard let baseStrokesJSON,
              let baseStrokes = try? StrokeSerialization.decodeFromWebJSON(
                baseStrokesJSON) else {
            return StoryboardPaintoverChangeSet(
                pencilContentChanged: true,
                framingChanged: framingFingerprint(baseShotFraming)
                    != framingFingerprint(currentShotFraming),
                colorChanged: !strokes(in: "Color", from: currentStrokes).isEmpty,
                atmosphereChanged: !strokes(
                    in: "Atmosphere", from: currentStrokes).isEmpty)
        }
        let baseLayers = baseLayerState ?? .standard
        let pencilContentChanged = strokes(in: "Drawing", from: baseStrokes)
                != strokes(in: "Drawing", from: currentStrokes)
            || visualIdentity(
                for: "Drawing", state: baseLayers, includeOrder: false)
                != visualIdentity(
                    for: "Drawing", state: currentLayerState, includeOrder: false)
        let framingChanged = framingFingerprint(baseShotFraming)
            != framingFingerprint(currentShotFraming)
        let colorChanged = strokes(in: "Color", from: baseStrokes)
                != strokes(in: "Color", from: currentStrokes)
            || visualIdentity(for: "Color", state: baseLayers, includeOrder: true)
                != visualIdentity(
                    for: "Color", state: currentLayerState, includeOrder: true)
        let atmosphereChanged = strokes(in: "Atmosphere", from: baseStrokes)
                != strokes(in: "Atmosphere", from: currentStrokes)
            || visualIdentity(
                for: "Atmosphere", state: baseLayers, includeOrder: true)
                != visualIdentity(
                    for: "Atmosphere", state: currentLayerState, includeOrder: true)
        return StoryboardPaintoverChangeSet(
            pencilContentChanged: pencilContentChanged,
            framingChanged: framingChanged,
            colorChanged: colorChanged,
            atmosphereChanged: atmosphereChanged)
    }

    private static func strokes(
        in layer: String, from strokes: [PencilStroke]
    ) -> [PencilStroke] {
        strokes.filter { ($0.boardLayer ?? "Drawing") == layer }
    }

    private static func framingFingerprint(
        _ framing: ShotFramingState?
    ) -> String {
        (framing ?? .standard).normalized().canonicalFingerprint
    }

    private static func visualIdentity(
        for layer: String,
        state: BoardLayerState,
        includeOrder: Bool
    ) -> LayerVisualIdentity {
        let normalizedOrder = BoardLayerState.normalizedOrder(state.order)
        let onlyStandard = normalizedOrder.count == BoardLayers.defaultOrder.count
            && Set(normalizedOrder) == Set(BoardLayers.defaultOrder)
        let effectiveOrder = (onlyStandard ? standardRenderOrder : normalizedOrder)
            .filter { compositeLayers.contains($0) }
        return LayerVisualIdentity(
            hidden: state.hidden.contains(layer),
            opacity: min(1, max(0, state.opacity[layer] ?? 1)),
            blendMode: state.blendModes[layer] ?? .normal,
            compositeOrder: includeOrder ? effectiveOrder : nil)
    }
}

/// One complete editing checkpoint. History is frame-scoped and persisted,
/// unlike NSUndoManager which is tied to the lifetime of a view hierarchy.
struct CanvasDocumentSnapshot: Codable, Sendable, Equatable {
    var strokes: [PencilStroke]
    var layers: BoardLayerState
    // Optional for backward compatibility with v2 history archives created
    // before the non-destructive camera window was introduced.
    var shotFraming: ShotFramingState?
    // Added in CAM-M2 history v7; nil keeps all earlier archives decodable.
    var cameraMotionTrack: CameraMotionTrack? = nil
}

struct CanvasHistoryEntry: Codable, Sendable, Equatable {
    var label: String
    var createdAt: Date
    var snapshot: CanvasDocumentSnapshot
    /// Conservative resident-size estimate captured once with the snapshot.
    /// Keeping it in the archive avoids rescanning every point whenever a new
    /// undo checkpoint is added. Optional keeps all v2-v7 archives decodable.
    var estimatedByteCount: Int?

    init(
        label: String,
        createdAt: Date,
        snapshot: CanvasDocumentSnapshot,
        estimatedByteCount: Int? = nil
    ) {
        self.label = label
        self.createdAt = createdAt
        self.snapshot = snapshot
        self.estimatedByteCount = max(
            0,
            estimatedByteCount
                ?? CanvasHistoryBudgetPolicy.estimatedByteCount(for: snapshot)
        )
    }

    private enum CodingKeys: String, CodingKey {
        case label
        case createdAt
        case snapshot
        case estimatedByteCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        label = try container.decode(String.self, forKey: .label)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        snapshot = try container.decode(
            CanvasDocumentSnapshot.self, forKey: .snapshot)

        // The persisted value is only a cache, never a trusted allocation
        // boundary. Re-measure once on load so an older/corrupt archive cannot
        // under-report itself and bypass the resident byte budget.
        let persistedEstimate = try container.decodeIfPresent(
            Int.self, forKey: .estimatedByteCount)
        estimatedByteCount = max(
            0,
            persistedEstimate ?? 0,
            CanvasHistoryBudgetPolicy.estimatedByteCount(for: snapshot)
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(label, forKey: .label)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(snapshot, forKey: .snapshot)
        try container.encodeIfPresent(
            estimatedByteCount, forKey: .estimatedByteCount)
    }
}

struct CanvasHistoryArchive: Codable, Sendable, Equatable {
    static let schemaVersion = 7
    var version = Self.schemaVersion
    var frameId: String
    var undo: [CanvasHistoryEntry]
    var redo: [CanvasHistoryEntry]
}

/// Undo remains full-document and lossless, but is bounded by both depth and a
/// conservative byte budget. The most immediately applicable entries live at
/// the end of each stack, so pressure always evicts from the front.
enum CanvasHistoryBudgetPolicy {
    static let maximumEntriesPerStack = 80
    static let maximumEstimatedResidentBytes = 32 * 1_024 * 1_024
    static let maximumPersistedFileBytes = 16 * 1_024 * 1_024

    struct TrimmedHistory: Sendable, Equatable {
        var undo: [CanvasHistoryEntry]
        var redo: [CanvasHistoryEntry]
    }

    static func estimatedByteCount(
        for snapshot: CanvasDocumentSnapshot
    ) -> Int {
        // JSON history repeats field names and numeric text, while Swift keeps
        // arrays/strings behind copy-on-write storage. These weights err on the
        // safe side without allocating or encoding a second full document on
        // the main actor.
        var total = 4_096
        add(snapshot.strokes.count * 1_024, to: &total)
        for stroke in snapshot.strokes {
            add(stroke.points.count * 160, to: &total)
            add(stringBytes(stroke.id), to: &total)
            add(stringBytes(stroke.inputType), to: &total)
            add(stringBytes(stroke.color), to: &total)
            add(stringBytes(stroke.boardLayer), to: &total)
            add(stringBytes(stroke.textAnnotation), to: &total)
            add(stringBytes(stroke.annotationStyle), to: &total)
            add(stringBytes(stroke.stampGroupId), to: &total)
            if let brush = stroke.brush {
                add(512, to: &total)
                add(stringBytes(brush.color), to: &total)
                add(stringBytes(brush.stampDataURL), to: &total)
            }
            add(estimatedStampBytes(stroke.stampInstance), to: &total)
            if let released = stroke.releasedStampContext {
                add(512, to: &total)
                add(stringBytes(released.originalStrokeId), to: &total)
                add(estimatedStampBytes(released.stamp), to: &total)
            }
        }

        let layers = snapshot.layers
        for value in layers.order { add(stringBytes(value) * 2, to: &total) }
        for value in layers.hidden { add(stringBytes(value) * 2, to: &total) }
        for value in layers.locked { add(stringBytes(value) * 2, to: &total) }
        for value in layers.opacity.keys { add(stringBytes(value) * 2, to: &total) }
        for value in layers.blendModes.keys { add(stringBytes(value) * 2, to: &total) }
        add(stringBytes(layers.activeLayer) * 2, to: &total)
        if let motion = snapshot.cameraMotionTrack {
            add(1_024 + motion.keyframes.count * 1_024, to: &total)
            add(stringBytes(motion.presetId), to: &total)
            for keyframe in motion.keyframes {
                add(stringBytes(keyframe.id) * 2, to: &total)
            }
        }
        return total
    }

    static func trimmed(
        undo: [CanvasHistoryEntry],
        redo: [CanvasHistoryEntry],
        maximumEntriesPerStack: Int = maximumEntriesPerStack,
        maximumEstimatedBytes: Int = maximumEstimatedResidentBytes
    ) -> TrimmedHistory {
        let depth = max(0, maximumEntriesPerStack)
        var result = TrimmedHistory(
            undo: Array(undo.suffix(depth)).map(ensuringEstimate),
            redo: Array(redo.suffix(depth)).map(ensuringEstimate)
        )
        var estimatedBytes = combinedEstimatedBytes(result)
        let byteLimit = max(0, maximumEstimatedBytes)
        while estimatedBytes > byteLimit {
            guard let removed = removeOldest(from: &result) else { break }
            estimatedBytes = max(
                0,
                estimatedBytes - resolvedEstimatedByteCount(removed)
            )
        }
        return result
    }

    static func removeOldest(
        from history: inout TrimmedHistory
    ) -> CanvasHistoryEntry? {
        if history.undo.isEmpty { return history.redo.removeFirstOrNil() }
        if history.redo.isEmpty { return history.undo.removeFirstOrNil() }
        if history.undo[0].createdAt <= history.redo[0].createdAt {
            return history.undo.removeFirst()
        }
        return history.redo.removeFirst()
    }

    private static func combinedEstimatedBytes(
        _ history: TrimmedHistory
    ) -> Int {
        (history.undo + history.redo).reduce(into: 0) { total, entry in
            add(resolvedEstimatedByteCount(entry), to: &total)
        }
    }

    private static func ensuringEstimate(
        _ entry: CanvasHistoryEntry
    ) -> CanvasHistoryEntry {
        guard entry.estimatedByteCount == nil else { return entry }
        return CanvasHistoryEntry(
            label: entry.label,
            createdAt: entry.createdAt,
            snapshot: entry.snapshot
        )
    }

    private static func resolvedEstimatedByteCount(
        _ entry: CanvasHistoryEntry
    ) -> Int {
        max(
            0,
            entry.estimatedByteCount
                ?? estimatedByteCount(for: entry.snapshot)
        )
    }

    private static func estimatedStampBytes(
        _ stamp: ProductionStampInstance?
    ) -> Int {
        guard let stamp else { return 0 }
        var total = 1_024
        for value in [
            stamp.version, stamp.variantName, stamp.styleProfileId,
            stamp.continuityId,
        ] {
            add(stringBytes(value), to: &total)
        }
        for (key, value) in stamp.parameters {
            add(stringBytes(key) + stringBytes(value), to: &total)
        }
        if let geometry = stamp.compoundGeometry {
            add(stringBytes(geometry.version), to: &total)
            add(geometry.paths.count * 256, to: &total)
            for path in geometry.paths {
                add(stringBytes(path.id), to: &total)
                add(path.points.count * 64, to: &total)
            }
        }
        return total
    }

    private static func stringBytes(_ value: String?) -> Int {
        value?.utf8.count ?? 0
    }

    private static func add(_ value: Int, to total: inout Int) {
        guard value > 0 else { return }
        let (sum, overflow) = total.addingReportingOverflow(value)
        total = overflow ? Int.max : sum
    }
}

private extension Array {
    mutating func removeFirstOrNil() -> Element? {
        isEmpty ? nil : removeFirst()
    }
}

private struct StoryboardFrameHistoryWriteResult: Sendable {
    var sequence: UInt64
    var didWrite: Bool
}

/// Serializes generation-tagged writes away from the main actor. A late task
/// can never overwrite a newer checkpoint for the same frame.
private actor StoryboardFrameHistoryWriter {
    private var latestSequenceByFrame: [String: UInt64] = [:]

    func persist(
        archive: CanvasHistoryArchive,
        sequence: UInt64,
        directory: URL,
        fileURL: URL
    ) -> StoryboardFrameHistoryWriteResult {
        guard sequence >= (latestSequenceByFrame[archive.frameId] ?? 0) else {
            return StoryboardFrameHistoryWriteResult(
                sequence: sequence, didWrite: false)
        }
        latestSequenceByFrame[archive.frameId] = sequence
        guard let payload = encodedPayloadWithinLimit(archive) else {
            return StoryboardFrameHistoryWriteResult(
                sequence: sequence, didWrite: false)
        }
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
                attributes: [
                    .protectionKey:
                        FileProtectionType.completeUntilFirstUserAuthentication,
                ]
            )
            try payload.write(
                to: fileURL,
                options: [
                    .atomic,
                    .completeFileProtectionUntilFirstUserAuthentication,
                ]
            )
            return StoryboardFrameHistoryWriteResult(
                sequence: sequence, didWrite: true)
        } catch {
            return StoryboardFrameHistoryWriteResult(
                sequence: sequence, didWrite: false)
        }
    }

    func clear(frameId: String, sequence: UInt64, fileURL: URL) {
        guard sequence >= (latestSequenceByFrame[frameId] ?? 0) else { return }
        latestSequenceByFrame[frameId] = sequence
        try? FileManager.default.removeItem(at: fileURL)
    }

    private func encodedPayloadWithinLimit(
        _ archive: CanvasHistoryArchive
    ) -> Data? {
        var candidate = CanvasHistoryBudgetPolicy.TrimmedHistory(
            undo: archive.undo,
            redo: archive.redo
        )
        while true {
            let boundedArchive = CanvasHistoryArchive(
                version: archive.version,
                frameId: archive.frameId,
                undo: candidate.undo,
                redo: candidate.redo
            )
            guard let data = try? JSONEncoder().encode(boundedArchive) else {
                return nil
            }
            let limit = CanvasHistoryBudgetPolicy.maximumPersistedFileBytes
            if data.count <= limit { return data }
            let entryCount = candidate.undo.count + candidate.redo.count
            guard entryCount > 0 else { return nil }

            // Remove proportionally to the measured excess to avoid repeatedly
            // allocating near-limit JSON payloads for a pathological archive.
            let retainedFraction = Double(limit) / Double(data.count)
            let targetRemovalCount = max(
                1,
                Int(ceil(Double(entryCount) * (1 - retainedFraction) * 1.1))
            )
            for _ in 0..<targetRemovalCount {
                guard CanvasHistoryBudgetPolicy.removeOldest(from: &candidate)
                    != nil else { break }
            }
        }
    }
}

/// Crash-safe, protected local history. The server remains the document source
/// of truth; this archive only restores editing intent on the same device.
@MainActor
enum StoryboardFrameHistoryStore {
    private struct PendingArchive {
        var sequence: UInt64
        var archive: CanvasHistoryArchive
    }

    private static let writer = StoryboardFrameHistoryWriter()
    private static var nextSequence: UInt64 = 0
    private static var pendingArchives: [String: PendingArchive] = [:]
    private static var inFlightArchive: PendingArchive?
    private static var writeLoopTask: Task<Void, Never>?
    private static var pendingClears: [String: UInt64] = [:]

    private static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("storyboard-history-v2", isDirectory: true)
    }

    private static func safeName(_ frameId: String) -> String {
        frameId.unicodeScalars.map { scalar in
            CharacterSet.alphanumerics.contains(scalar) || scalar == "-" || scalar == "_"
                ? String(scalar) : "_"
        }.joined()
    }

    private static func fileURL(_ frameId: String) -> URL {
        directory.appendingPathComponent("\(safeName(frameId)).json")
    }

    static func save(
        frameId: String,
        undo: [CanvasHistoryEntry],
        redo: [CanvasHistoryEntry]
    ) {
        let bounded = CanvasHistoryBudgetPolicy.trimmed(undo: undo, redo: redo)
        let archive = CanvasHistoryArchive(
            frameId: frameId, undo: bounded.undo, redo: bounded.redo)
        let sequence = makeSequence()
        pendingClears.removeValue(forKey: frameId)
        pendingArchives[frameId] = PendingArchive(
            sequence: sequence, archive: archive)
        startWriteLoopIfNeeded()
    }

    static func load(frameId: String) -> CanvasHistoryArchive? {
        if pendingClears[frameId] != nil { return nil }
        if let pending = pendingArchives[frameId] { return pending.archive }
        if inFlightArchive?.archive.frameId == frameId {
            return inFlightArchive?.archive
        }
        let url = fileURL(frameId)
        guard let fileSize = try? url.resourceValues(
                forKeys: [.fileSizeKey]
              ).fileSize,
              fileSize >= 0,
              fileSize <= CanvasHistoryBudgetPolicy.maximumPersistedFileBytes,
              let data = try? Data(contentsOf: url, options: .mappedIfSafe),
              data.count <= CanvasHistoryBudgetPolicy.maximumPersistedFileBytes,
              let archive = try? JSONDecoder().decode(CanvasHistoryArchive.self, from: data),
              (2...CanvasHistoryArchive.schemaVersion).contains(archive.version),
              archive.frameId == frameId else { return nil }
        let bounded = CanvasHistoryBudgetPolicy.trimmed(
            undo: archive.undo, redo: archive.redo)
        return CanvasHistoryArchive(
            version: archive.version,
            frameId: archive.frameId,
            undo: bounded.undo,
            redo: bounded.redo
        )
    }

    static func clear(frameId: String) {
        let sequence = makeSequence()
        pendingArchives.removeValue(forKey: frameId)
        pendingClears[frameId] = sequence
        let targetURL = fileURL(frameId)
        Task(priority: .utility) {
            await writer.clear(
                frameId: frameId, sequence: sequence, fileURL: targetURL)
            guard pendingClears[frameId] == sequence else { return }
            pendingClears.removeValue(forKey: frameId)
        }
    }

    private static func makeSequence() -> UInt64 {
        nextSequence &+= 1
        if nextSequence == 0 { nextSequence = 1 }
        return nextSequence
    }

    /// At most one archive is encoded at a time and repeated checkpoints for
    /// the same frame replace the queued value. This prevents a fast Pencil
    /// session from retaining an O(n²) chain of full-document Task captures
    /// while disk encoding catches up.
    private static func startWriteLoopIfNeeded() {
        guard writeLoopTask == nil else { return }
        writeLoopTask = Task(priority: .utility) {
            while let request = takeNextPendingArchive() {
                let frameId = request.archive.frameId
                let result = await writer.persist(
                    archive: request.archive,
                    sequence: request.sequence,
                    directory: directory,
                    fileURL: fileURL(frameId)
                )
                completeWrite(result)
                await Task.yield()
            }
            writeLoopTask = nil
        }
    }

    private static func takeNextPendingArchive() -> PendingArchive? {
        guard inFlightArchive == nil,
              let next = pendingArchives.values.min(by: {
                  $0.sequence < $1.sequence
              }) else { return nil }
        pendingArchives.removeValue(forKey: next.archive.frameId)
        inFlightArchive = next
        return next
    }

    private static func completeWrite(
        _ result: StoryboardFrameHistoryWriteResult
    ) {
        guard inFlightArchive?.sequence == result.sequence else { return }
        // A failed recovery-aid write has the same semantics as the previous
        // synchronous best-effort store. Do not retain a 32 MiB archive for
        // the rest of the process lifetime merely because storage is full.
        inFlightArchive = nil
    }
}

enum BoardLayerStateCoding {
    static func object(_ state: BoardLayerState) -> Any? {
        guard let data = try? JSONEncoder().encode(state) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    static func decode(_ object: Any?) -> BoardLayerState? {
        guard let object, JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object),
              var decoded = try? JSONDecoder().decode(BoardLayerState.self, from: data)
        else { return nil }
        decoded.normalize()
        return decoded
    }
}

struct InspectorTextDraft: Codable, Sendable, Equatable {
    var sceneId: String
    var frameId: String
    var description: String
    var notes: String
    var updatedAt: Date
}

/// Small crash-safe write-ahead log for Inspector text. A draft is removed
/// only after the refreshed server frame contains the same values.
enum InspectorTextDraftStore {
    private static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("storyboard-inspector-drafts-v1", isDirectory: true)
    }

    private static func safeName(_ frameId: String) -> String {
        frameId.unicodeScalars.map { scalar in
            CharacterSet.alphanumerics.contains(scalar) || scalar == "-" || scalar == "_"
                ? String(scalar) : "_"
        }.joined()
    }

    private static func fileURL(frameId: String) -> URL {
        directory.appendingPathComponent("\(safeName(frameId)).json")
    }

    static func save(_ draft: InspectorTextDraft) {
        guard let data = try? JSONEncoder().encode(draft) else { return }
        do {
            try FileManager.default.createDirectory(
                at: directory, withIntermediateDirectories: true,
                attributes: [.protectionKey:
                    FileProtectionType.completeUntilFirstUserAuthentication])
            try data.write(
                to: fileURL(frameId: draft.frameId),
                options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch {
            // The in-memory draft remains editable even when protected storage
            // is temporarily unavailable.
        }
    }

    static func load(frameId: String) -> InspectorTextDraft? {
        guard let data = try? Data(contentsOf: fileURL(frameId: frameId)),
              let draft = try? JSONDecoder().decode(InspectorTextDraft.self, from: data),
              draft.frameId == frameId else { return nil }
        return draft
    }

    static func clear(frameId: String) {
        try? FileManager.default.removeItem(at: fileURL(frameId: frameId))
    }
}
