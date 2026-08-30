import CryptoKit
import Foundation

/// Durable v7 write-ahead record for one transactional camera edit. It owns
/// both the canonical t=0 framing snapshot and the independent motion write,
/// so an app kill between those server acknowledgements cannot split them.
struct PendingCameraMotionMutation: Codable, Sendable, Equatable {
    var version = 7
    var manuscriptId: String
    var sceneId: String
    var frameId: String
    var shotDuration: MediaTime
    var initialFraming: ShotFramingState
    /// Nil is an explicit request to remove the motion track (Static).
    var motionTrack: CameraMotionTrack?
    var expectedMotionRevision: Int
    var baseMotionTrack: CameraMotionTrack?
    var baseMotionFingerprint: String?
    var baseMotionStatus: String?
    var localRevision: Int
    var strokesJSON: String
    var thumbnailDataURL: String?
    var layerState: BoardLayerState
    var baseUpdatedAt: String?
    /// Source-only OCC token. Unlike `baseUpdatedAt`, this does not advance
    /// for a camera-only write and therefore lets an acknowledged write prove
    /// that no collaborator changed Pencil/layers/framing while it was in
    /// flight.
    var baseSourceUpdatedAt: String? = nil
    var baseStrokesJSON: String?
    var baseLayerState: BoardLayerState?
    var baseShotFraming: ShotFramingState?
    var savedAt = Date()

    var changesInitialFraming: Bool {
        initialFraming.normalized()
            != (baseShotFraming ?? initialFraming).normalized()
    }
}

/// Immutable server base returned after one camera mutation has committed.
/// It deliberately contains only authoritative values that a later local WAL
/// is allowed to inherit; the queued intent itself is never rewritten.
struct PendingCameraMotionAuthoritativeBase: Sendable, Equatable {
    struct SourceSnapshot: Sendable, Equatable {
        var strokesJSON: String
        var layerState: BoardLayerState
        var shotFraming: ShotFramingState
        var sourceUpdatedAt: String
    }

    var motionTrack: CameraMotionTrack?
    var motionRevision: Int
    var motionFingerprint: String?
    var motionStatus: String
    var frameUpdatedAt: String?
    var sourceUpdatedAt: String?
    var shotFraming: ShotFramingState
    /// Present only when the acknowledged mutation also committed the source
    /// document. This is the exact new 3-way-merge base for a queued edit.
    var sourceSnapshot: SourceSnapshot?
}

enum PendingCameraMotionRebaseDecision: Sendable, Equatable {
    case noNewerMutation
    case rebased(PendingCameraMotionMutation)
    case conflict
}

enum PendingCameraMotionStore {
    /// File coordination inside this process. Data.write(.atomic) protects the
    /// bytes on disk; this lock makes read-compare-replace one indivisible CAS
    /// for autosave, retry and scene-change tasks racing in the same app.
    private static let storeLock = NSLock()

    private static var directory: URL {
        FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent(
            "pending-camera-motion-v7",
            isDirectory: true
        )
    }

    private static func fileURL(frameId: String) -> URL {
        let digest = SHA256.hash(data: Data(frameId.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return directory.appendingPathComponent("\(digest).json")
    }

    @discardableResult
    static func save(_ mutation: PendingCameraMotionMutation) -> Bool {
        storeLock.lock()
        defer { storeLock.unlock() }
        return saveUnlocked(mutation)
    }

    private static func saveUnlocked(
        _ mutation: PendingCameraMotionMutation
    ) -> Bool {
        if let track = mutation.motionTrack,
           (try? track.normalized(for: mutation.shotDuration)) == nil {
            return false
        }
        guard mutation.version == 7,
              !mutation.manuscriptId.isEmpty,
              !mutation.sceneId.isEmpty,
              !mutation.frameId.isEmpty,
              mutation.expectedMotionRevision >= 0,
              let data = try? JSONEncoder().encode(mutation)
        else { return false }
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
                attributes: [
                    .protectionKey:
                        FileProtectionType.completeUntilFirstUserAuthentication,
                ]
            )
            try data.write(
                to: fileURL(frameId: mutation.frameId),
                options: [
                    .atomic,
                    .completeFileProtectionUntilFirstUserAuthentication,
                ]
            )
            return true
        } catch {
            return false
        }
    }

    static func load(frameId: String) -> PendingCameraMotionMutation? {
        storeLock.lock()
        defer { storeLock.unlock() }
        return loadUnlocked(frameId: frameId)
    }

    private static func loadUnlocked(
        frameId: String
    ) -> PendingCameraMotionMutation? {
        guard let data = try? Data(contentsOf: fileURL(frameId: frameId)),
              data.count <= 256 * 1_024,
              let mutation = try? JSONDecoder().decode(
                PendingCameraMotionMutation.self,
                from: data
              ),
              mutation.version == 7,
              mutation.frameId == frameId
        else { return nil }
        return mutation
    }

    static func pendingMutations() -> [PendingCameraMotionMutation] {
        storeLock.lock()
        defer { storeLock.unlock() }
        let urls = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.fileSizeKey],
            options: [.skipsHiddenFiles]
        )) ?? []
        return urls.compactMap { url in
            guard url.pathExtension == "json",
                  let data = try? Data(contentsOf: url),
                  data.count <= 256 * 1_024,
                  let value = try? JSONDecoder().decode(
                    PendingCameraMotionMutation.self,
                    from: data
                  ),
                  value.version == 7 else { return nil }
            return value
        }.sorted { $0.savedAt < $1.savedAt }
    }

    @discardableResult
    static func clear(ifUnchangedFrom mutation: PendingCameraMotionMutation) -> Bool {
        storeLock.lock()
        defer { storeLock.unlock() }
        guard loadUnlocked(frameId: mutation.frameId) == mutation else {
            return false
        }
        do {
            try FileManager.default.removeItem(
                at: fileURL(frameId: mutation.frameId))
            return true
        } catch {
            return false
        }
    }

    /// Pure same-client rebase. A queued mutation may advance to the
    /// authoritative base only when every original motion/source provenance
    /// field still equals the acknowledged request. Any unknown or remote
    /// divergence is intentionally a conflict, never a last-writer-wins merge.
    static func rebaseDecision(
        acknowledged mutation: PendingCameraMotionMutation,
        queued: PendingCameraMotionMutation?,
        onto authoritative: PendingCameraMotionAuthoritativeBase
    ) -> PendingCameraMotionRebaseDecision {
        guard let queued else { return .noNewerMutation }
        guard queued != mutation else { return .noNewerMutation }
        guard mutation.version == 7,
              queued.version == mutation.version,
              authoritative.motionRevision >= 0,
              queued.manuscriptId == mutation.manuscriptId,
              queued.sceneId == mutation.sceneId,
              queued.frameId == mutation.frameId,
              queued.shotDuration == mutation.shotDuration,
              queued.savedAt >= mutation.savedAt,
              queued.localRevision >= mutation.localRevision,
              queued.expectedMotionRevision
                == mutation.expectedMotionRevision,
              queued.baseMotionTrack == mutation.baseMotionTrack,
              queued.baseMotionFingerprint
                == mutation.baseMotionFingerprint,
              queued.baseMotionStatus == mutation.baseMotionStatus,
              queued.baseUpdatedAt == mutation.baseUpdatedAt,
              queued.baseSourceUpdatedAt
                == mutation.baseSourceUpdatedAt,
              queued.baseStrokesJSON == mutation.baseStrokesJSON,
              queued.baseLayerState == mutation.baseLayerState,
              queued.baseShotFraming == mutation.baseShotFraming
        else { return .conflict }

        guard let authoritativeSourceToken = authoritative.sourceUpdatedAt,
              !authoritativeSourceToken.trimmingCharacters(
                in: .whitespacesAndNewlines
              ).isEmpty
        else { return .conflict }

        // A camera-only acknowledgement cannot certify a source base if the
        // source OCC token moved while the request was in flight. nil/nil is
        // legacy absence, not proof of equality.
        if !mutation.changesInitialFraming {
            guard let originalSourceToken = mutation.baseSourceUpdatedAt,
                  !originalSourceToken.trimmingCharacters(
                    in: .whitespacesAndNewlines
                  ).isEmpty,
                  authoritativeSourceToken == originalSourceToken
            else { return .conflict }
        }
        if mutation.changesInitialFraming {
            guard let source = authoritative.sourceSnapshot,
                  !source.sourceUpdatedAt.trimmingCharacters(
                    in: .whitespacesAndNewlines
                  ).isEmpty,
                  source.sourceUpdatedAt == authoritativeSourceToken
            else { return .conflict }
        }

        var rebased = queued
        rebased.expectedMotionRevision = authoritative.motionRevision
        rebased.baseMotionTrack = authoritative.motionTrack
        rebased.baseMotionFingerprint = authoritative.motionFingerprint
        rebased.baseMotionStatus = authoritative.motionStatus
        rebased.baseUpdatedAt = authoritative.frameUpdatedAt
        rebased.baseSourceUpdatedAt = authoritative.sourceUpdatedAt
        rebased.baseShotFraming = authoritative.shotFraming.normalized()
        if let source = authoritative.sourceSnapshot {
            rebased.baseStrokesJSON = source.strokesJSON
            rebased.baseLayerState = source.layerState
            rebased.baseShotFraming = source.shotFraming.normalized()
        }
        return .rebased(rebased)
    }

    /// Atomic disk CAS used after `rebaseDecision`. A third mutation arriving
    /// between acknowledgement and replacement wins; this method fails closed
    /// and never overwrites it.
    @discardableResult
    static func compareAndReplace(
        _ expected: PendingCameraMotionMutation,
        with replacement: PendingCameraMotionMutation
    ) -> Bool {
        guard replacement.frameId == expected.frameId else { return false }
        storeLock.lock()
        defer { storeLock.unlock() }
        guard loadUnlocked(frameId: expected.frameId) == expected else {
            return false
        }
        return saveUnlocked(replacement)
    }
}
