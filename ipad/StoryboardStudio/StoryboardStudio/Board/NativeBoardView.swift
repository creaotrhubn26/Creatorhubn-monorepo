import SwiftUI
import UIKit
import PhotosUI
import AVFoundation
import AVKit
import CryptoKit

// Native Board Pro — mockup-flaten («Neon City», STORYBOARD_DESIGN.md §4b)
// i SwiftUI rundt Metal-motoren, med Role Room-brand (fiolett aksent).
// Aktiv shot-rute er en LIVE PencilCanvasView (predicted touches, stamp-
// commit); inaktive ruter viser synkede thumbnails. Inspector patcher
// frame-felter rett mot samme scene-upsert som web.

enum BoardBrand {
    static let accent = Color(red: 0.545, green: 0.361, blue: 0.965)      // #8b5cf6
    static let chrome = Color(red: 0.043, green: 0.043, blue: 0.055)      // #0b0b0e
    static let panel = Color(red: 0.078, green: 0.082, blue: 0.098)
    static let border = Color.white.opacity(0.07)
    static let dim = Color.white.opacity(0.55)
    static let label = Color.white.opacity(0.42)
    static let workspace = Color(red: 0.235, green: 0.243, blue: 0.267)
    static let sheet = Color(red: 0.969, green: 0.965, blue: 0.949)
    static let inkOnSheet = Color(red: 0.2, green: 0.204, blue: 0.227)
    static let handwriting = "Bradley Hand"                               // innebygd iOS-håndskrift
}

private func panelLabel(_ text: String) -> some View {
    Text(text.uppercased())
        .font(.system(size: 10.5, weight: .bold))
        .kerning(1.1)
        .foregroundStyle(BoardBrand.label)
}

// Ray casting — punkt-i-polygon for lasso-utvalg.
private func pointInPolygon(_ point: CGPoint, polygon: [CGPoint]) -> Bool {
    guard polygon.count > 2 else { return false }
    var inside = false
    var j = polygon.count - 1
    for i in 0..<polygon.count {
        let a = polygon[i], b = polygon[j]
        if (a.y > point.y) != (b.y > point.y),
           point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x {
            inside.toggle()
        }
        j = i
    }
    return inside
}

func decodeDataURL(_ dataURL: String?) -> UIImage? {
    guard let dataURL, dataURL.hasPrefix("data:"),
          let comma = dataURL.firstIndex(of: ","),
          let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) else { return nil }
    return UIImage(data: data)
}

private func storyboardThumbnailDataURL(_ dataURL: String) -> String? {
    guard let image = decodeDataURL(dataURL) else { return nil }
    let maxWidth = 420.0
    let scale = min(1, maxWidth / max(1, image.size.width))
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let thumb = UIGraphicsImageRenderer(size: size, format: format).image { _ in
        image.draw(in: CGRect(origin: .zero, size: size))
    }
    guard let data = thumb.jpegData(compressionQuality: 0.72) else { return nil }
    return "data:image/jpeg;base64," + data.base64EncodedString()
}

enum FrameDurationResponseAdoptionPolicy {
    /// A reload may replace optimistic pixels/state while a PATCH is in
    /// flight. Only an explicitly queued later target is allowed to outlive
    /// the authoritative response for the completed request.
    static func shouldApplyAuthoritativeResponse(
        newerPendingTarget: MediaTime?
    ) -> Bool {
        newerPendingTarget == nil
    }
}

enum FrameDurationVideoInvalidationPolicy {
    static func afterDurationChange(
        _ state: StoryboardPaintoverState?,
        changed: Bool
    ) -> StoryboardPaintoverState? {
        guard changed, var state else { return state }
        state.videoStale = true
        return state
    }
}

enum CameraMotionHistorySyncPolicy {
    /// A framing-only undo/redo still changes the coordinate system to which
    /// an otherwise equal motion track is bound. It therefore needs the same
    /// dedicated OCC mutation as a changed track.
    static func requiresMotionRebind(
        framingChanged: Bool,
        currentTrack: CameraMotionTrack?,
        authoritativeTrack: CameraMotionTrack?,
        readState: FrameCameraMotionReadState
    ) -> Bool {
        guard framingChanged else { return false }
        switch readState {
        case .invalid, .upgradeRequired:
            return false
        case .none, .valid:
            // `.none` may be a legacy summary, but without a decoded known
            // v1 track there is nothing safe to serialize or rebind.
            return currentTrack != nil || authoritativeTrack != nil
        }
    }
}

@MainActor
final class BoardState: ObservableObject {
    let manuscript: ManuscriptSummary
    let projectId: String?
    @Published var scenes: [SceneSummary] = []
    @Published var scenarioPacks: [StoryboardScenarioPackSummary] = []
    @Published var aiModels: [StoryboardAIModelSummary] = []
    @Published var scenarioCatalogError: String?
    @Published var selectedSceneIndex = 0
    @Published var activeFrameIndex = 0
    @Published var errorMessage: String?
    @Published var syncStatus: String?
    private let usesLocalSample: Bool
    private var pendingDurations: [String: MediaTime] = [:]
    private var durationExpectedRevisions: [String: Int] = [:]
    private var durationSyncTasks: [String: Task<Void, Never>] = [:]
    private var durationRollbacks: [String: DurationRollbackState] = [:]

    private struct DurationRollbackState {
        let shotDuration: MediaTime?
        let durationSec: Double
        let durationRevision: Int?
        let updatedAt: String?
        let sourceUpdatedAt: String?
        let aiPaintoverState: StoryboardPaintoverState?
        let cameraMotion: FrameDurationCameraMotionSidecar?
    }

    init(manuscript: ManuscriptSummary, projectId: String? = nil,
         sampleScenes: [SceneSummary] = []) {
        self.manuscript = manuscript
        self.projectId = projectId
        self.usesLocalSample = !sampleScenes.isEmpty
        self.scenes = RoleRoomAPIClient.applyingStoryboardTiming(
            manuscript.storyboardTiming, to: sampleScenes)
    }

    var scene: SceneSummary? { scenes.indices.contains(selectedSceneIndex) ? scenes[selectedSceneIndex] : nil }
    var isLocalSample: Bool { usesLocalSample }
    var frame: FrameSummary? {
        guard let scene, scene.frames.indices.contains(activeFrameIndex) else { return nil }
        return scene.frames[activeFrameIndex]
    }

    func reload() async {
        guard !usesLocalSample else { return }
        let selectedSceneId = scene?.id
        let selectedFrameId = frame?.id
        do {
            let fetched = try await RoleRoomAPIClient.shared.fetchScenes(
                manuscriptId: manuscript.id)
            let refreshed = RoleRoomAPIClient.applyingStoryboardTiming(
                manuscript.storyboardTiming, to: fetched)
            scenes = refreshed
            if let selectedSceneId,
               let sameScene = refreshed.firstIndex(where: { $0.id == selectedSceneId }) {
                selectedSceneIndex = sameScene
            } else {
                selectedSceneIndex = min(selectedSceneIndex, max(0, refreshed.count - 1))
            }
            // Server-reorder må ikke flytte den aktive canvasen fra A til B
            // mens en save await-er. Bevar identitet, ikke bare gammel indeks.
            if let selectedFrameId,
               let sameFrame = scene?.frames.firstIndex(where: { $0.id == selectedFrameId }) {
                activeFrameIndex = sameFrame
            } else {
                activeFrameIndex = min(
                    activeFrameIndex, max(0, (scene?.frames.count ?? 1) - 1))
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadScenarioPacksIfNeeded() async {
        guard !usesLocalSample else { return }
        if scenarioPacks.isEmpty {
            do {
                scenarioPacks = try await RoleRoomAPIClient.shared.fetchScenarioPacks()
                scenarioCatalogError = nil
            } catch {
                scenarioCatalogError = error.localizedDescription
            }
        }
        if aiModels.isEmpty {
            aiModels = (try? await RoleRoomAPIClient.shared.fetchStoryboardAIModels()) ?? []
        }
    }

    /// Live-polling: 304-billig sjekk mot serveren; true = noe endret og
    /// summaries er lastet på nytt.
    func refreshFromServer() async -> Bool {
        guard !usesLocalSample else { return false }
        let changed = await RoleRoomAPIClient.shared.pollScenesChanged(manuscriptId: manuscript.id)
        if changed { await reload() }
        return changed
    }

    func refreshAnimationURLs() async {
        guard let projectId else { return }
        var changed = false
        var refreshedURLs: [(StoryboardAIVideoRefreshIdentity, String)] = []
        for scene in scenes {
            for frame in scene.frames {
                guard let jobId = frame.aiVideoJobId,
                      let storyboardId = frame.aiStoryboardId else { continue }
                let storedStatus = StoryboardVideoJobLifecyclePolicy
                    .normalizedStatus(frame.aiVideoStatus)
                guard storedStatus == "completed"
                        || StoryboardVideoJobLifecyclePolicy
                            .isActive(storedStatus) else { continue }
                if storedStatus == "completed",
                   !Self.videoURLNeedsRefresh(frame.aiVideoURL) { continue }
                guard let status = try? await RoleRoomAPIClient.shared.pollStoryboardAnimation(
                    projectId: projectId, storyboardId: storyboardId, jobId: jobId) else { continue }
                let remoteStatus = StoryboardVideoJobLifecyclePolicy
                    .normalizedStatus(status.status)
                if remoteStatus == "completed" {
                    // Polling the job transactionally adopts its URL on the
                    // server only while the submit-time source CAS is still
                    // current. Never replay a completion URL through the
                    // compatibility patch endpoint after that decision: the
                    // frame may change between this response and a patch.
                    changed = true
                    if StoryboardAIVideoCompletionPolicy.serverAdopted(status),
                       let outputURL = status.outputURL,
                       let parsedURL = URL(string: outputURL),
                       parsedURL.scheme?.lowercased() == "https" {
                        refreshedURLs.append((
                            StoryboardAIVideoRefreshIdentity(
                                sceneId: scene.id, frameId: frame.id,
                                storyboardId: storyboardId, jobId: jobId),
                            outputURL))
                    }
                } else if remoteStatus == "failed" {
                    try? await RoleRoomAPIClient.shared.saveFramePatch(
                        manuscriptId: manuscript.id, sceneId: scene.id, frameId: frame.id,
                        fields: ["aiVideoStatus": "failed"])
                    changed = true
                }
            }
        }
        if changed {
            await reload()
            // A signed B2 URL may be fresher than the provider URL persisted
            // at adoption. Apply it only to this freshly reloaded in-memory
            // frame; never race a source edit through saveFramePatch.
            for (identity, outputURL) in refreshedURLs {
                guard let sceneIndex = scenes.firstIndex(where: {
                    $0.id == identity.sceneId
                }),
                      let frameIndex = scenes[sceneIndex].frames.firstIndex(where: {
                    $0.id == identity.frameId
                }) else { continue }
                let current = scenes[sceneIndex].frames[frameIndex]
                guard StoryboardAIVideoRefreshPolicy.canApply(
                    identity,
                    sceneId: scenes[sceneIndex].id,
                    frameId: current.id,
                    storyboardId: current.aiStoryboardId,
                    jobId: current.aiVideoJobId,
                    sourceIdentityMatches: StoryboardVideoPlaybackPolicy
                        .sourceIdentityMatches(current)) else { continue }
                scenes[sceneIndex].frames[frameIndex].aiVideoURL = outputURL
            }
        }
    }

    private static func videoURLNeedsRefresh(_ value: String?) -> Bool {
        guard let value, let components = URLComponents(string: value) else { return true }
        let items = (components.queryItems ?? []).reduce(into: [String: String]()) {
            $0[$1.name.lowercased()] = $1.value ?? ""
        }
        guard let rawDate = items["x-amz-date"],
              let seconds = TimeInterval(items["x-amz-expires"] ?? "") else {
            return false
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
        guard let signedAt = formatter.date(from: rawDate) else { return true }
        return signedAt.addingTimeInterval(seconds).timeIntervalSinceNow < 300
    }

    func addShot() {
        guard let scene else { return }
        runMutation("Shot lagt til ✓") {
            try await RoleRoomAPIClient.shared.addFrame(
                manuscriptId: self.manuscript.id, sceneId: scene.id)
        }
    }

    func deleteShot(frameId: String) {
        guard let scene else { return }
        runMutation("Shot slettet ✓") {
            try await RoleRoomAPIClient.shared.deleteFrame(
                manuscriptId: self.manuscript.id, sceneId: scene.id, frameId: frameId)
            return nil
        }
    }

    func duplicateShot(frameId: String) {
        guard let scene else { return }
        runMutation("Shot duplisert ✓") {
            try await RoleRoomAPIClient.shared.duplicateFrame(
                manuscriptId: self.manuscript.id, sceneId: scene.id, frameId: frameId)
        }
    }

    func moveShot(frameId: String, offset: Int) {
        guard let scene else { return }
        runMutation("Flyttet ✓") {
            try await RoleRoomAPIClient.shared.moveFrame(
                manuscriptId: self.manuscript.id, sceneId: scene.id, frameId: frameId, offset: offset)
            return frameId
        }
    }

    func addScene(title: String) {
        syncStatus = "…"
        Task {
            do {
                let sceneId = try await RoleRoomAPIClient.shared.addScene(
                    manuscriptId: manuscript.id, title: title, projectId: projectId)
                await reload()
                if let index = scenes.firstIndex(where: { $0.id == sceneId }) {
                    selectedSceneIndex = index
                    activeFrameIndex = 0
                }
                syncStatus = "Scene opprettet ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    @Published var sceneDeleteUndoAvailable = false

    func deleteScene(sceneId: String) {
        syncStatus = "…"
        Task {
            do {
                try await RoleRoomAPIClient.shared.deleteScene(
                    manuscriptId: manuscript.id, sceneId: sceneId)
                await reload()
                selectedSceneIndex = min(selectedSceneIndex, max(0, scenes.count - 1))
                activeFrameIndex = 0
                syncStatus = "Scene slettet ✓"
                sceneDeleteUndoAvailable = true
                try? await Task.sleep(nanoseconds: 15_000_000_000)
                sceneDeleteUndoAvailable = false
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func undoSceneDelete() {
        syncStatus = "…"
        sceneDeleteUndoAvailable = false
        Task {
            do {
                try await RoleRoomAPIClient.shared.undoLastSceneDelete()
                await reload()
                syncStatus = "Scene gjenopprettet ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func duplicateScene(sceneId: String) {
        syncStatus = "…"
        Task {
            do {
                let newId = try await RoleRoomAPIClient.shared.duplicateScene(
                    manuscriptId: manuscript.id, sceneId: sceneId)
                await reload()
                if let index = scenes.firstIndex(where: { $0.id == newId }) {
                    selectedSceneIndex = index
                    activeFrameIndex = 0
                }
                syncStatus = "Scene duplisert ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func renameScene(sceneId: String, title: String) {
        syncStatus = "…"
        Task {
            do {
                try await RoleRoomAPIClient.shared.renameScene(
                    manuscriptId: manuscript.id, sceneId: sceneId, title: title)
                await reload()
                syncStatus = "Omdøpt ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func renumberShots() {
        guard let scene else { return }
        runMutation("Renummerert ✓") {
            try await RoleRoomAPIClient.shared.renumberFrames(
                manuscriptId: self.manuscript.id, sceneId: scene.id)
            return nil
        }
    }

    /// Flytt shot til eksakt posisjon (drag-reorder).
    func moveShot(frameId: String, toIndex target: Int) {
        guard let scene,
              let source = scene.frames.firstIndex(where: { $0.id == frameId }),
              source != target else { return }
        moveShot(frameId: frameId, offset: target - source)
    }

    /// Kjør frame-mutasjon → reload → velg returnert frame-id (om noen).
    private func runMutation(_ successStatus: String, _ work: @escaping () async throws -> String?) {
        syncStatus = "…"
        Task {
            do {
                let focusId = try await work()
                await reload()
                if let focusId, let index = scene?.frames.firstIndex(where: { $0.id == focusId }) {
                    activeFrameIndex = index
                }
                syncStatus = successStatus
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func patchActiveFrame(_ fields: [String: any Sendable]) {
        guard let frame else { return }
        patchFrame(frameId: frame.id, fields: fields)
    }

    /// Updates the visible sample immediately, then serializes dedicated OCC
    /// writes per frame. Rapid +/- taps therefore cannot conflict with an
    /// earlier request from this same iPad.
    func setActiveFrameDuration(seconds: Double) {
        guard seconds.isFinite,
              scenes.indices.contains(selectedSceneIndex),
              scenes[selectedSceneIndex].frames.indices.contains(activeFrameIndex)
        else { return }
        let boundedSeconds = min(600, max(0.5, seconds))
        guard let duration = try? MediaTime(
            seconds: boundedSeconds, preferredTimescale: 600)
        else { return }

        let sceneId = scenes[selectedSceneIndex].id
        let current = scenes[selectedSceneIndex].frames[activeFrameIndex]
        let frameId = current.id
        let key = durationSyncKey(sceneId: sceneId, frameId: frameId)
        if durationRollbacks[key] == nil {
            durationRollbacks[key] = DurationRollbackState(
                shotDuration: current.shotDuration,
                durationSec: current.durationSec,
                durationRevision: current.durationRevision,
                updatedAt: current.updatedAt,
                sourceUpdatedAt: current.sourceUpdatedAt,
                aiPaintoverState: current.aiPaintoverState,
                cameraMotion: durationCameraMotionSidecar(from: current))
        }
        if durationExpectedRevisions[key] == nil {
            // Canonical phase-1 frames without an explicit revision are
            // server-defined revision 1; truly legacy frames begin at 0.
            durationExpectedRevisions[key] = current.durationRevision
                ?? (current.shotDuration == nil ? 0 : 1)
        }

        scenes[selectedSceneIndex].frames[activeFrameIndex].shotDuration = duration
        scenes[selectedSceneIndex].frames[activeFrameIndex].durationSec =
            duration.seconds
        if usesLocalSample {
            scenes[selectedSceneIndex].frames[activeFrameIndex]
                .durationRevision = (current.durationRevision ?? 0) + 1
            if current.cameraMotionReadState == .valid,
               current.cameraMotionStatus == nil
                    || current.cameraMotionStatus == "valid",
               let track = current.cameraMotionTrack,
               let retimed = try? track.retimedProportionally(
                    from: current.effectiveShotDuration,
                    to: duration) {
                scenes[selectedSceneIndex].frames[activeFrameIndex]
                    .cameraMotionTrack = retimed
                scenes[selectedSceneIndex].frames[activeFrameIndex]
                    .cameraMotionRevision =
                    (current.cameraMotionRevision ?? 0) + 1
                scenes[selectedSceneIndex].frames[activeFrameIndex]
                    .cameraMotionFingerprint =
                    try? retimed.canonicalRenderFingerprint(for: duration)
            }
        }

        scenes[selectedSceneIndex].frames[activeFrameIndex].aiPaintoverState =
            FrameDurationVideoInvalidationPolicy.afterDurationChange(
                current.aiPaintoverState,
                changed: duration != current.effectiveShotDuration)


        guard !usesLocalSample else {
            durationRollbacks.removeValue(forKey: key)
            durationExpectedRevisions.removeValue(forKey: key)
            syncStatus = nil
            return
        }

        pendingDurations[key] = duration
        syncStatus = "Lagrer varighet …"
        guard durationSyncTasks[key] == nil else { return }
        durationSyncTasks[key] = Task { [weak self] in
            await self?.flushDurationChanges(
                sceneId: sceneId, frameId: frameId, key: key)
        }
    }

    private func flushDurationChanges(
        sceneId: String,
        frameId: String,
        key: String
    ) async {
        while let requestedDuration = pendingDurations.removeValue(forKey: key) {
            guard durationFrameIndices(
                sceneId: sceneId, frameId: frameId) != nil else {
                finishDurationSync(key: key)
                return
            }
            let expectedRevision = durationExpectedRevisions[key] ?? 0
            do {
                let response = try await RoleRoomAPIClient.shared
                    .patchFrameDuration(
                        manuscriptId: manuscript.id,
                        sceneId: sceneId,
                        frameId: frameId,
                        shotDuration: requestedDuration,
                        expectedDurationRevision: expectedRevision)
                durationExpectedRevisions[key] = response.durationRevision
                let currentFrame = durationFrameIndices(
                    sceneId: sceneId, frameId: frameId).flatMap {
                        scenes[$0.scene].frames[$0.frame]
                    }
                durationRollbacks[key] = DurationRollbackState(
                    shotDuration: response.shotDuration,
                    durationSec: response.durationSec,
                    durationRevision: response.durationRevision,
                    updatedAt: response.updatedAt,
                    sourceUpdatedAt: response.sourceUpdatedAt,
                    aiPaintoverState: response.aiPaintoverState
                        ?? currentFrame?.aiPaintoverState,
                    cameraMotion: response.cameraMotion
                        ?? currentFrame.flatMap(durationCameraMotionSidecar))

                if let indices = durationFrameIndices(
                    sceneId: sceneId, frameId: frameId) {
                    // Preserve a newer optimistic tap while this response was
                    // in flight, but always advance its server precondition.
                    let newerPendingTarget = pendingDurations[key]
                    if FrameDurationResponseAdoptionPolicy
                        .shouldApplyAuthoritativeResponse(
                            newerPendingTarget: newerPendingTarget) {
                        applyDurationResponse(response, at: indices)
                    } else {
                        scenes[indices.scene].frames[indices.frame]
                            .durationRevision = response.durationRevision
                        applyDurationCameraMotion(response.cameraMotion, at: indices)
                        if let state = response.aiPaintoverState {
                            scenes[indices.scene].frames[indices.frame]
                                .aiPaintoverState = state
                        }
                        if !response.updatedAt.isEmpty {
                            scenes[indices.scene].frames[indices.frame]
                                .updatedAt = response.updatedAt
                        }
                        if let sourceUpdatedAt = response.sourceUpdatedAt {
                            scenes[indices.scene].frames[indices.frame]
                                .sourceUpdatedAt = sourceUpdatedAt
                        }
                    }
                }
                syncStatus = pendingDurations[key] == nil
                    ? "Varighet synket ✓" : "Lagrer varighet …"
            } catch let error as FrameDurationPatchError {
                pendingDurations.removeValue(forKey: key)
                if let current = error.currentState,
                   let indices = durationFrameIndices(
                    sceneId: sceneId, frameId: frameId) {
                    scenes[indices.scene].frames[indices.frame].shotDuration =
                        current.shotDuration
                    scenes[indices.scene].frames[indices.frame].durationSec =
                        current.shotDuration.seconds
                    scenes[indices.scene].frames[indices.frame].durationRevision =
                        current.revision
                    if let rollback = durationRollbacks[key],
                       let rollbackDuration = rollback.shotDuration
                        ?? MediaTimeCoding.decodeLegacySeconds(
                            rollback.durationSec),
                       current.shotDuration == rollbackDuration {
                        scenes[indices.scene].frames[indices.frame]
                            .aiPaintoverState = rollback.aiPaintoverState
                    }
                } else {
                    restoreDuration(
                        durationRollbacks[key],
                        sceneId: sceneId,
                        frameId: frameId)
                }
                await reload()
                syncStatus = error.localizedDescription
                finishDurationSync(key: key)
                return
            } catch {
                pendingDurations.removeValue(forKey: key)
                restoreDuration(
                    durationRollbacks[key],
                    sceneId: sceneId,
                    frameId: frameId)
                syncStatus = error.localizedDescription
                finishDurationSync(key: key)
                return
            }
        }
        finishDurationSync(key: key)
    }

    private func durationFrameIndices(
        sceneId: String,
        frameId: String
    ) -> (scene: Int, frame: Int)? {
        guard let sceneIndex = scenes.firstIndex(where: { $0.id == sceneId }),
              let frameIndex = scenes[sceneIndex].frames.firstIndex(
                where: { $0.id == frameId }) else { return nil }
        return (sceneIndex, frameIndex)
    }

    private func durationCameraMotionSidecar(
        from frame: FrameSummary
    ) -> FrameDurationCameraMotionSidecar? {
        guard frame.cameraMotionTrack != nil
                || frame.cameraMotionRevision != nil
                || frame.cameraMotionRawJSON != nil else { return nil }
        return FrameDurationCameraMotionSidecar(
            track: frame.cameraMotionTrack,
            revision: frame.cameraMotionRevision ?? 0,
            updatedAt: frame.cameraMotionUpdatedAt,
            fingerprint: frame.cameraMotionFingerprint,
            baseFramingFingerprint:
                frame.cameraMotionBaseFramingFingerprint,
            status: frame.cameraMotionStatus ?? "valid",
            readState: frame.cameraMotionReadState,
            rawJSON: frame.cameraMotionRawJSON)
    }

    private func applyDurationCameraMotion(
        _ sidecar: FrameDurationCameraMotionSidecar?,
        at indices: (scene: Int, frame: Int)
    ) {
        guard let sidecar else { return }
        var frame = scenes[indices.scene].frames[indices.frame]
        frame.cameraMotionTrack = sidecar.track
        frame.cameraMotionRevision = sidecar.revision
        frame.cameraMotionUpdatedAt = sidecar.updatedAt
        frame.cameraMotionFingerprint = sidecar.fingerprint
        frame.cameraMotionBaseFramingFingerprint =
            sidecar.baseFramingFingerprint
        frame.cameraMotionStatus = sidecar.status
        frame.cameraMotionReadState = sidecar.readState
        frame.cameraMotionRawJSON = sidecar.rawJSON
        scenes[indices.scene].frames[indices.frame] = frame
    }

    private func applyDurationResponse(
        _ response: FrameDurationPatchResponse,
        at indices: (scene: Int, frame: Int)
    ) {
        scenes[indices.scene].frames[indices.frame].shotDuration =
            response.shotDuration
        scenes[indices.scene].frames[indices.frame].durationSec =
            response.durationSec
        scenes[indices.scene].frames[indices.frame].durationRevision =
            response.durationRevision
        applyDurationCameraMotion(response.cameraMotion, at: indices)
        if let state = response.aiPaintoverState {
            scenes[indices.scene].frames[indices.frame]
                .aiPaintoverState = state
        }
        if !response.updatedAt.isEmpty {
            scenes[indices.scene].frames[indices.frame].updatedAt =
                response.updatedAt
        }
        if let sourceUpdatedAt = response.sourceUpdatedAt {
            scenes[indices.scene].frames[indices.frame].sourceUpdatedAt =
                sourceUpdatedAt
        }
    }

    private func restoreDuration(
        _ rollback: DurationRollbackState?,
        sceneId: String,
        frameId: String
    ) {
        guard let rollback,
              let indices = durationFrameIndices(
                sceneId: sceneId, frameId: frameId) else { return }
        scenes[indices.scene].frames[indices.frame].shotDuration =
            rollback.shotDuration
        scenes[indices.scene].frames[indices.frame].durationSec =
            rollback.durationSec
        scenes[indices.scene].frames[indices.frame].durationRevision =
            rollback.durationRevision
        scenes[indices.scene].frames[indices.frame].updatedAt =
            rollback.updatedAt
        scenes[indices.scene].frames[indices.frame].sourceUpdatedAt =
            rollback.sourceUpdatedAt
        scenes[indices.scene].frames[indices.frame].aiPaintoverState =
            rollback.aiPaintoverState
        applyDurationCameraMotion(rollback.cameraMotion, at: indices)
    }

    private func finishDurationSync(key: String) {
        pendingDurations.removeValue(forKey: key)
        durationExpectedRevisions.removeValue(forKey: key)
        durationRollbacks.removeValue(forKey: key)
        durationSyncTasks.removeValue(forKey: key)
    }

    private func durationSyncKey(sceneId: String, frameId: String) -> String {
        "\(sceneId)\u{1F}\(frameId)"
    }

    /// Immediate in-memory update used by the camera engine. Network/offline
    /// persistence is intentionally handled by the same crash-safe document
    /// autosave as strokes, so framing and its thumbnail commit atomically.
    func applyShotFramingLocally(
        _ framing: ShotFramingState,
        markAIStale: Bool = true
    ) {
        guard scenes.indices.contains(selectedSceneIndex),
              scenes[selectedSceneIndex].frames.indices.contains(activeFrameIndex)
        else { return }
        let normalized = framing.normalized()
        let previous = scenes[selectedSceneIndex].frames[activeFrameIndex]
            .shotFraming?.normalized()
        let motionNeedsRebase = markAIStale
            && scenes[selectedSceneIndex].frames[activeFrameIndex].cameraMotionTrack != nil
            && previous?.canonicalFingerprint != normalized.canonicalFingerprint
        scenes[selectedSceneIndex].frames[activeFrameIndex].shotFraming = normalized
        scenes[selectedSceneIndex].frames[activeFrameIndex].shotType = normalized.shotSize
        scenes[selectedSceneIndex].frames[activeFrameIndex].angle = normalized.angle
        if motionNeedsRebase {
            scenes[selectedSceneIndex].frames[activeFrameIndex]
                .cameraMotionStatus = "needsRebase"
        }
        scenes[selectedSceneIndex].frames[activeFrameIndex].lensMm = normalized.lensMm
        if markAIStale {
            markActiveAIOutputStaleLocally(reason: "shot-framing-changed")
            syncStatus = usesLocalSample
                ? "Lokal framing oppdatert" : "Utsnitt endret · venter på synk"
        }
    }

    /// Optimistic camera-motion adoption for the active shot. Camera motion
    /// invalidates a generated video, but does not make the approved still
    /// raster stale; the still remains the source plate for the move.
    func applyCameraMotionLocally(
        _ track: CameraMotionTrack?,
        revision: Int? = nil,
        status: String = "valid",
        updatedAt: String? = nil,
        fingerprint: String? = nil,
        baseFramingFingerprint: String? = nil,
        frameUpdatedAt: String? = nil,
        sourceUpdatedAt: String? = nil,
        paintoverState: StoryboardPaintoverState? = nil,
        markVideoStale: Bool = true
    ) {
        guard scenes.indices.contains(selectedSceneIndex),
              scenes[selectedSceneIndex].frames.indices.contains(activeFrameIndex)
        else { return }
        var frame = scenes[selectedSceneIndex].frames[activeFrameIndex]
        frame.cameraMotionTrack = track
        frame.cameraMotionReadState = track == nil ? .none : .valid
        frame.cameraMotionRawJSON = nil
        frame.cameraMotionStatus = status
        if let revision { frame.cameraMotionRevision = revision }
        if let updatedAt { frame.cameraMotionUpdatedAt = updatedAt }
        frame.cameraMotionFingerprint = fingerprint
        frame.cameraMotionBaseFramingFingerprint = baseFramingFingerprint
        if let frameUpdatedAt { frame.updatedAt = frameUpdatedAt }
        if let sourceUpdatedAt { frame.sourceUpdatedAt = sourceUpdatedAt }
        if let paintoverState {
            frame.aiPaintoverState = paintoverState
        } else if markVideoStale, var paintover = frame.aiPaintoverState {
            paintover.videoStale = true
            frame.aiPaintoverState = paintover
        }
        scenes[selectedSceneIndex].frames[activeFrameIndex] = frame
        syncStatus = usesLocalSample
            ? "Lokal kamerabane oppdatert"
            : "Kamerabane endret · venter på synk"
    }

    /// Immediate UI-side stale gate. The server repeats this validation, but
    /// the Inspector must never offer Animate during the autosave debounce.
    func markActiveAIOutputStaleLocally(reason: String) {
        guard scenes.indices.contains(selectedSceneIndex),
              scenes[selectedSceneIndex].frames.indices.contains(activeFrameIndex)
        else { return }
        let frame = scenes[selectedSceneIndex].frames[activeFrameIndex]
        guard frame.aiStoryboardId != nil || frame.aiSourceFramingFingerprint != nil else {
            return
        }
        // A source mutation invalidates the pixels themselves and therefore
        // outranks camera-only staleness. A later camera edit must not downgrade
        // that stronger gate while the same generated raster is still active.
        if reason == "shot-framing-changed",
           frame.aiOutputStale,
           frame.aiOutputStaleReason != nil,
           frame.aiOutputStaleReason != "shot-framing-changed" {
            return
        }
        scenes[selectedSceneIndex].frames[activeFrameIndex].aiOutputStale = true
        scenes[selectedSceneIndex].frames[activeFrameIndex].aiOutputStaleReason = reason
    }

    func patchFrame(frameId: String, fields: [String: any Sendable]) {
        guard let scene else { return }
        patchFrame(sceneId: scene.id, frameId: frameId, fields: fields)
    }

    func patchFrame(
        sceneId: String, frameId: String, fields: [String: any Sendable]
    ) {
        guard !usesLocalSample else {
            syncStatus = nil
            return
        }
        syncStatus = "…"
        Task {
            do {
                try await RoleRoomAPIClient.shared.saveFramePatch(
                    manuscriptId: manuscript.id, sceneId: sceneId,
                    frameId: frameId, fields: fields)
                await reload()
                syncStatus = "Synket ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func patchActiveScene(_ fields: [String: any Sendable]) {
        guard let scene else { return }
        guard !usesLocalSample else {
            syncStatus = nil
            return
        }
        syncStatus = "…"
        Task {
            do {
                try await RoleRoomAPIClient.shared.saveScenePatch(
                    manuscriptId: manuscript.id, sceneId: scene.id, fields: fields)
                await reload()
                syncStatus = "Scene-kontekst synket ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    /// Review: sett status (planned/in_review/needs_work/done).
    func setFrameStatus(frameId: String, status: String) {
        patchFrame(frameId: frameId, fields: ["frameStatus": status])
    }

    /// Review: legg til rollekommentar (web StoryboardFrameComment-form).
    func addComment(frameId: String, role: String, text: String) {
        guard let frame = scene?.frames.first(where: { $0.id == frameId }) else { return }
        Task {
            let author = await RoleRoomAPIClient.shared.userDisplayName ?? "iPad"
            let existing: [[String: String]] = frame.comments.map {
                ["id": $0.id, "role": $0.role, "author": $0.author, "text": $0.text, "at": $0.at]
            }
            let new: [String: String] = [
                "id": "c-\(Int(Date().timeIntervalSince1970 * 1000))",
                "role": role,
                "author": author,
                "text": text,
                "at": ISO8601DateFormatter().string(from: Date()),
            ]
            patchFrame(frameId: frameId, fields: ["frameComments": existing + [new]])
        }
    }
}

// Verktøyraden over arket (mockup): select | tegn/viskelær | pil/rekt/tekst.
enum BoardTool: String, CaseIterable {
    case select, draw, eraser, arrow, rect, text
    var icon: String {
        switch self {
        case .select: return "cursorarrow"
        case .draw: return "paintbrush.pointed"
        case .eraser: return "eraser"
        case .arrow: return "arrow.up.right"
        case .rect: return "rectangle"
        case .text: return "textformat"
        }
    }
    var label: String {
        switch self {
        case .select: return "Lasso og transformer"
        case .draw: return "Tegn"
        case .eraser: return "Viskelær"
        case .arrow: return "Pil"
        case .rect: return "Rektangel"
        case .text: return "Tekst"
        }
    }
}

struct BoardCanvasBackground {
    let editableBase: CGImage?
    /// Approved AI Color/Atmosphere is already rendered in output/viewport
    /// coordinates. Present it after the camera transform so it is never
    /// cropped a second time. The Pencil source remains the editable document.
    let viewportPreview: CGImage?
    let referenceUnderlay: CGImage?
    let referenceOpacity: Double
}

struct EditableFrameRasterIdentity: Hashable {
    let raster: FrameRasterIdentity
    let placementFingerprint: String?

    init?(frame: FrameSummary) {
        guard let raster = FrameRasterIdentity(frame: frame) else { return nil }
        self.raster = raster
        placementFingerprint = StoryboardFrameImagePolicy
            .rasterPlacementFraming(for: frame)?.canonicalFingerprint
    }
}

private struct RetainedEditableBase {
    let identity: EditableFrameRasterIdentity
    let image: UIImage
}

struct StoryboardAIRasterEditingDecision: Equatable {
    let activeLayer: String
    let automaticallySelectedLayer: String?
    let suppressedSourceLayers: Set<String>
}

/// Pure state transition for AI raster editing. The board records ownership of
/// an automatic Color/Atmosphere selection so an unsafe camera/source change
/// can return to Drawing without overriding an artist's explicit layer choice.
enum StoryboardAIRasterEditingPolicy {
    static func permitsRaster(
        isOutputStale: Bool,
        staleReason: String?
    ) -> Bool {
        !isOutputStale || staleReason == "shot-framing-changed"
    }

    static func resolve(
        canUseRaster: Bool,
        activeLayer: String,
        automaticallySelectedLayer: String?,
        targetLayer: String
    ) -> StoryboardAIRasterEditingDecision {
        guard canUseRaster else {
            return StoryboardAIRasterEditingDecision(
                activeLayer: automaticallySelectedLayer == activeLayer
                    ? "Drawing" : activeLayer,
                automaticallySelectedLayer: nil,
                suppressedSourceLayers: [])
        }
        guard activeLayer == "Drawing" else {
            return StoryboardAIRasterEditingDecision(
                activeLayer: activeLayer,
                automaticallySelectedLayer: automaticallySelectedLayer,
                suppressedSourceLayers: ["Drawing"])
        }
        return StoryboardAIRasterEditingDecision(
            activeLayer: targetLayer,
            automaticallySelectedLayer: targetLayer,
            suppressedSourceLayers: ["Drawing"])
    }
}

enum StoryboardActiveRasterPolicy {
    static func expectsRaster(_ frame: FrameSummary) -> Bool {
        FrameDocumentProjection.effectiveRasterSource(for: frame)
            .includesFrameImage
    }
}

private struct BoardScenarioSelection: Equatable {
    let packId: String
    let packVersion: String
    let subdomainId: String
    let zoneId: String
    let roleIds: [String]
    let propTypeIds: [String]
    let actionIds: [String]
    let stateIds: [String]
    let continuityLockIds: [String]
    let inheritedFromScene: Bool

    var patchFields: [String: any Sendable] {
        [
            "scenarioPackId": packId, "scenarioPackVersion": packVersion,
            "scenarioSubdomainId": subdomainId, "scenarioZoneId": zoneId,
            "scenarioRoleIds": roleIds, "scenarioPropTypeIds": propTypeIds,
            "scenarioActionIds": actionIds, "scenarioStateIds": stateIds,
            "scenarioContinuityLockIds": continuityLockIds,
        ]
    }
}

private enum BoardInspectorTab: String, CaseIterable, Identifiable {
    case shot = "Shot"
    case story = "Story"
    case production = "Produksjon"
    case ai = "AI"

    var id: String { rawValue }

    var accessibilityIdentifier: String {
        "inspector-tab-\(String(describing: self))"
    }
}

private struct InspectorDraftReference: Equatable {
    let sceneId: String
    let frameId: String
}

private enum AIInspectorPrimaryAction {
    case generateColor
    case reviewColor
    case generateAtmosphere

    case reviewAtmosphere
    case animate
    case animationInProgress

    var label: String {
        switch self {
        case .generateColor: return "Generate AI Color"
        case .reviewColor: return "Review Color candidate"
        case .generateAtmosphere: return "Generate AI Atmosphere"
        case .reviewAtmosphere: return "Review Atmosphere candidate"
        case .animate: return "Animate approved"
        case .animationInProgress: return "Animation in progress"
        }
    }

    var symbol: String {
        switch self {
        case .generateColor: return "paintpalette.fill"
        case .reviewColor, .reviewAtmosphere: return "checkmark.rectangle.stack"
        case .generateAtmosphere: return "cloud.sun.fill"
        case .animate: return "play.rectangle.fill"
        case .animationInProgress: return "clock.arrow.circlepath"
        }
    }
}

@MainActor
private struct CameraMotionEditorSession: Identifiable {
    let id = UUID()
    let sourceFrame: FrameSummary
    let model: CameraMotionEditorModel
}
private struct CameraMotionPreviewSurface: View {
    let sourceFrame: FrameSummary
    let framing: ShotFramingState
    let strokesOverride: [PencilStroke]?
    let layerStateOverride: BoardLayerState?
    let localDocumentRevision: Int

    @State private var image: UIImage?
    @State private var completedPlateKey: CameraMotionPreviewPlateKey?

    private var sourceSize: ShotFramingSize {
        ShotFramingSize(
            width: sourceFrame.drawingWidth,
            height: sourceFrame.drawingHeight
        )
    }

    private var compactRasterIdentity: String? {
        guard let value = sourceFrame.imageUrl else { return nil }
        // A data URL can be several megabytes. The source OCC/revision fields
        // already own its identity, so the task key must not copy or hash that
        // payload on every 60/120 Hz affine presentation tick.
        if value.hasPrefix("data:") {
            return "inline-raster"
        }
        return value
    }

    private var plateKey: CameraMotionPreviewPlateKey {
        CameraMotionPreviewPlateKey(
            frameID: sourceFrame.id,
            localDocumentRevision: localDocumentRevision,
            sourceUpdatedAt:
                sourceFrame.sourceUpdatedAt ?? sourceFrame.updatedAt,
            rasterIdentity: [
                compactRasterIdentity ?? "",
                sourceFrame.imageSource ?? "",
                sourceFrame.aiSourceRevision.map(String.init) ?? "",
                sourceFrame.aiRasterPlacementFraming?
                    .canonicalFingerprint ?? "source-space",
            ].joined(separator: "|"),
            sourceSize: sourceSize,
            strokeCount: strokesOverride?.count ?? -1
        )
    }

    var body: some View {
        GeometryReader { proxy in
            let viewportSize = ShotFramingSize(
                width: max(1, Double(proxy.size.width)),
                height: max(1, Double(proxy.size.height))
            )
            let snapshot = CameraMotionPreviewSnapshot(
                plateKey: plateKey,
                sourceSize: sourceSize,
                viewportSize: viewportSize,
                framing: framing
            )
            ZStack {
                if let image, let affine = snapshot?.affine {
                    Image(uiImage: image)
                        .resizable()
                        .interpolation(.high)
                        .frame(
                            width: CGFloat(affine.sourceSize.width),
                            height: CGFloat(affine.sourceSize.height)
                        )
                        .scaleEffect(CGFloat(affine.scale))
                        .rotationEffect(.degrees(affine.rotationDegrees))
                        .position(
                            x: CGFloat(affine.imageCenterInViewport.x),
                            y: CGFloat(affine.imageCenterInViewport.y)
                        )
                        .opacity(completedPlateKey == plateKey ? 1 : 0.72)
                        .accessibilityHidden(true)
                } else if completedPlateKey == plateKey {
                    ContentUnavailableView(
                        "Preview unavailable",
                        systemImage: "viewfinder",
                        description: Text(
                            "The frozen source plate cannot cover this camera move."))
                        .foregroundStyle(.secondary)
                }

                if completedPlateKey != plateKey {
                    ProgressView()
                        .tint(.white)
                        .padding(12)
                        .background(.black.opacity(0.5), in: Capsule())
                        .accessibilityLabel("Rendering camera preview")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
        }
        .task(id: plateKey) {
            await Task.yield()
            guard !Task.isCancelled else { return }
            var previewFrame = sourceFrame
            let plateFraming = ShotFramingState(
                centerX: 0.5,
                centerY: 0.5,
                zoom: 1,
                rollDegrees: 0,
                aspectRatio: sourceSize.aspectRatio
            )
            previewFrame.shotFraming = plateFraming
            previewFrame.cameraMotionTrack = nil
            previewFrame.cameraMotionReadState = .none
            previewFrame.cameraMotionRawJSON = nil
            previewFrame.cameraMotionStatus = "valid"
            let plateWidth = min(
                3_072,
                max(1_280, CGFloat(sourceFrame.drawingWidth))
            )
            let rendered = FrameRenderCoordinator.image(
                for: previewFrame,
                maxWidth: plateWidth,
                at: .zero,
                framingOverride: plateFraming,
                strokesOverride: strokesOverride,
                layerStateOverride: layerStateOverride,
                localDocumentRevision: localDocumentRevision)
            guard !Task.isCancelled else { return }
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                image = rendered
                completedPlateKey = plateKey
            }
        }
    }
}



private struct AIFrameSessionKey: Equatable, Sendable {
    let projectId: String
    let sceneId: String
    let frameId: String
    let epoch: UUID
    /// Same-frame edits must invalidate in-flight consent, generation,
    /// approval and animation work just as decisively as navigation does.
    let documentRevision: Int
}

struct NativeBoardView: View {
    @StateObject private var board: BoardState
    @StateObject private var canvasState = CanvasState()
    @State private var renderer = MetalStrokeRenderer()
    @State private var showAnimatic = false
    @State private var showShotList = false
    @State private var showScript = false
    @State private var showReview = false
    @State private var showProductionDashboard = false
    @State private var exportPDFURL: URL?
    @State private var boardTool: BoardTool = .draw
    @State private var textPromptShown = false
    @State private var textPromptValue = ""
    @State private var textPromptPoint: CGPoint = .zero
    @State private var sheetZoom: Double = 1.0
    @State private var scrollTarget: Int?
    @State private var showFullscreenDraw = false
    @State private var showBrushEditor = false
    @State private var showPromptInspector = false
    @State private var showAIVersionBrowser = false
    @State private var cameraMotionEditorSession: CameraMotionEditorSession?
    @State private var promptCompilation: StoryboardPromptCompilationSummary?
    @State private var aiStatus: String?
    @State private var aiInFlight = false
    /// Per-frame operation registry survives A → B → A navigation. A single
    /// Bool was reset on frame switches and could reopen paid actions while
    /// the original request for A was still running.
    @State private var activeAIFrameOperations: [String: UUID] = [:]
    @State private var aiFrameEpoch = UUID()
    @State private var selectedVideoModelId = "seedance-2-i2v"
    @State private var imageStageVersions: [StoryboardAIImageVersionSummary] = []
    @State private var imageVersionDocumentRevisions: [String: Int] = [:]
    @State private var imageStageStoryboardId: String?
    @State private var currentAIImageSourceRevision: Int?
    @State private var pendingImageStageVersion: StoryboardAIImageVersionSummary?
    @State private var pendingImageStageGeneration: String?
    @State private var animationPreflight: StoryboardAnimationPreflightSummary?
    @State private var animationPreflightSourceImage: UIImage?
    @State private var animationPreflightComposite: StoryboardPaintoverComposite?
    @State private var animationPreflightSession: AIFrameSessionKey?
    @State private var showAIConsentPrompt = false
    @State private var pendingAIConsentAction = "animate"
    @State private var pendingAIConsentSession: AIFrameSessionKey?
    @State private var stampInspectorStrokeID: String?
    @State private var toneReport: ToneReport?
    @State private var showToneReport = false
    @State private var pendingDeleteFrameId: String?
    @State private var newSceneTitle = ""
    @State private var lastObservedCameraMotionTrack: CameraMotionTrack?
    @State private var cameraMotionAutosyncTask: Task<Void, Never>?
    @State private var cameraMotionSyncInFlight = false
    @State private var cameraMotionSyncRequestedAfterCurrent = false
    @State private var showNewScenePrompt = false
    @State private var sceneThumbnailImages: [String: UIImage] = [:]
    @State private var shotPreviewImages: [String: UIImage] = [:]
    @State private var scenePreviewRenderKeys: [String: String] = [:]
    @State private var shotPreviewRenderKeys: [String: String] = [:]
    @State private var retainedEditableBaseImages: [String: RetainedEditableBase] = [:]
    @State private var automaticallySelectedAIRasterLayer: String?
    @State private var showNewLayerPrompt = false
    @State private var newLayerName = ""
    @State private var selectedInspectorTab: BoardInspectorTab = .shot
    @State private var showInspectorSheet = false
    @State private var isInspectorDockVisible = true
    @State private var isReframing = false
    @State private var framingGestureBaseline: ShotFramingState?
    @State private var framingPanTranslation: CGSize = .zero
    @State private var framingMagnification: CGFloat = 1
    @State private var framingRotationDegrees: Double = 0
    @State private var framingPanActive = false
    @State private var framingZoomActive = false
    @State private var framingRollActive = false
    /// Tracks whether the main Metal canvas currently owns a source-space AI
    /// raster or has fallen back to Pencil because the camera no longer
    /// matches that raster. A camera gesture may emit dozens of revisions;
    /// only the coordinate-space transition requires an expensive rebuild.
    @State private var appliedAIRasterPolicyKey = "none"
    @Environment(\.dismiss) private var dismiss

    enum InitialSheet { case script, shotList, animatic, review }

    init(manuscript: ManuscriptSummary, projectId: String? = nil,
         initialSceneIndex: Int = 0, initialSheet: InitialSheet? = nil,
         sampleScenes: [SceneSummary] = []) {
        let state = BoardState(manuscript: manuscript, projectId: projectId,
                               sampleScenes: sampleScenes)
        state.selectedSceneIndex = initialSceneIndex
        _board = StateObject(wrappedValue: state)
        _showScript = State(initialValue: initialSheet == .script)
        _showShotList = State(initialValue: initialSheet == .shotList)
        _showAnimatic = State(initialValue: initialSheet == .animatic)
        _showReview = State(initialValue: initialSheet == .review)
        _selectedInspectorTab = State(initialValue:
            BoardInspectorTab(rawValue: ProcessInfo.processInfo.environment[
                "SB_UI_TEST_INSPECTOR_TAB"] ?? "") ?? .shot)
    }

    var body: some View {
        serviceObservedBoardView
    }

    private var workspaceView: some View {
        GeometryReader { geometry in
            let forceDockedInspector = ProcessInfo.processInfo.environment[
                "SB_UI_TEST_FORCE_DOCKED_INSPECTOR"] == "1"
            let compactWorkspace = !forceDockedInspector
                && (geometry.size.width < 1_060
                    || ProcessInfo.processInfo.environment[
                        "SB_UI_TEST_COMPACT_WORKSPACE"] == "1")
            VStack(spacing: 0) {
                topbar(compactWorkspace: compactWorkspace)
                Divider().overlay(BoardBrand.border)
                HStack(spacing: 0) {
                    scenesColumn
                    Divider().overlay(BoardBrand.border)
                    sheetArea
                    if !compactWorkspace && isInspectorDockVisible {
                        Divider().overlay(BoardBrand.border)
                        inspector
                    }
                }
                Divider().overlay(BoardBrand.border)
                brushBar
            }
            .background(BoardBrand.chrome)
        }
    }

    /// Type-erasure boundaries keep Swift's generic View type from growing
    /// beyond the compiler's practical limit as production observers expand.
    private var presentedBoardView: AnyView {
        AnyView(workspaceView
        .navigationBarHidden(true)
        .fullScreenCover(isPresented: $showAnimatic) {
            AnimaticView(sceneHeading: board.scene?.heading ?? "",
                         frames: effectiveFramesForRendering(
                            board.scene?.frames ?? []),
                         storyboardTiming: board.manuscript.storyboardTiming,
                         onVoiceoverChanged: { frameId, dataURL in
                             board.patchFrame(frameId: frameId, fields: [
                                 "voiceoverDataURL": dataURL ?? NSNull(),
                             ])
                         })
        }
        .fullScreenCover(item: $cameraMotionEditorSession) { session in
            CameraMotionEditorView(
                shotNumber: session.sourceFrame.shotNumber,
                shotTitle: session.sourceFrame.description,
                sourceSize: ShotFramingSize(
                    width: session.sourceFrame.drawingWidth,
                    height: session.sourceFrame.drawingHeight),
                model: session.model,
                canvas: { framing in
                    cameraMotionPreview(
                        sourceFrame: session.sourceFrame,
                        framing: framing)
                },
                onPresentationFramingChanged: { framing in
                    canvasState.presentationFraming = framing
                },
                onSave: { commit in
                    commitCameraMotion(
                        commit,
                        sourceFrame: session.sourceFrame)
                    cameraMotionEditorSession = nil
                },
                onCancel: {
                    canvasState.presentationFraming = nil
                    cameraMotionEditorSession = nil
                })
        }
        .fullScreenCover(isPresented: $showFullscreenDraw) {
            if let frame = board.frame {
                FullscreenDrawView(canvasState: canvasState, frame: frame,
                                   background: composedCanvasBackground())
            }
        }
        .fullScreenCover(isPresented: $showProductionDashboard) {
            BoardProductionDashboard(
                projectTitle: board.manuscript.title,
                scenes: effectiveScenesForRendering(),
                onSelectFrame: { sceneIndex, frameIndex in
                    board.selectedSceneIndex = sceneIndex
                    board.activeFrameIndex = frameIndex
                })
        }
        .alert("Nytt lag", isPresented: $showNewLayerPrompt) {
            TextField("Lagnavn", text: $newLayerName)
            Button("Avbryt", role: .cancel) { newLayerName = "" }
            Button("Opprett") { addLayer(named: newLayerName) }
        } message: {
            Text("Lag blir lagret med shotet og følger eksport og synk.")
        })
    }

    private var loadedBoardView: AnyView {
        AnyView(presentedBoardView
        .task {
            await board.reload()
            await board.loadScenarioPacksIfNeeded()
            await board.refreshAnimationURLs()
            loadActiveFrameIntoCanvas()
            await retryPendingCameraMotionForActiveFrame()
        }
        .task(id: scenePreviewTaskKey) { await rebuildSceneThumbnails() }
        .task(id: board.frame?.id) {
            await retryPendingCameraMotionForActiveFrame()
        }
        .task(id: shotPreviewTaskKey) { await rebuildShotPreviews() }
        .task(id: activeRasterTaskKey) {
            await loadActiveRaster()
            await refreshImageStageVersions()
        })
    }

    private var frameObservedBoardView: AnyView {
        AnyView(loadedBoardView
        .onChange(of: board.activeFrameIndex) { loadActiveFrameIntoCanvas() }
        .onChange(of: board.selectedSceneIndex) {
            board.activeFrameIndex = 0
            loadActiveFrameIntoCanvas()
        }
        .onChange(of: board.scenes.count) { loadActiveFrameIntoCanvas() }
        .onChange(of: canvasState.revision) { scheduleAutosync() }
        .onChange(of: canvasState.shotFraming) {
            guard canvasState.shotFraming != lastObservedShotFraming else { return }
            // A persisted camera edit invalidates any transient evaluated
            // presentation tick. Static editing immediately falls back to the
            // same canonical t=0 pose until the next frozen snapshot is made.
            canvasState.presentationFraming = nil
            lastObservedShotFraming = canvasState.shotFraming
            invalidateAnimationPreflightForCameraHistoryChange()
            board.applyShotFramingLocally(canvasState.shotFraming)
            updateAIRasterEditingMode()
            refreshFramingDependentBackground()
            if CameraMotionHistorySyncPolicy.requiresMotionRebind(
                framingChanged: true,
                currentTrack: canvasState.cameraMotionTrack,
                authoritativeTrack: loadedFrameCameraMotionTrack,
                readState: board.frame?.cameraMotionReadState
                    ?? .upgradeRequired
            ) {
                scheduleCameraMotionAutosync()
            }
        }
        .onChange(of: canvasState.cameraMotionTrack) {
            guard canvasState.cameraMotionTrack != lastObservedCameraMotionTrack
            else { return }
            lastObservedCameraMotionTrack = canvasState.cameraMotionTrack
            invalidateAnimationPreflightForCameraHistoryChange()
            board.applyCameraMotionLocally(canvasState.cameraMotionTrack)
            scheduleCameraMotionAutosync()
        }
        .onChange(of: board.frame?.durationRevision) {
            reconcileDurationCameraMotion()
        }
        )
    }

    private var backgroundObservedBoardView: AnyView {
        AnyView(frameObservedBoardView
        .onChange(of: board.frame?.imageUrl) {
            // Et godkjent AI Color/Atmosphere-bilde er en ny rasterbase, ikke
            // et nytt tegnedokument. Behold stroke-historikken mens den nye
            // basen lastes av activeRasterTaskKey.
            applyUnderlay(to: renderer)
            updateAIRasterEditingMode()
            canvasState.backgroundRevision += 1
        }
        .onChange(of: board.frame?.aiOutputStale) {
            updateAIRasterEditingMode()
            applyUnderlay(to: renderer)
        }
        .onChange(of: board.frame?.aiOutputStaleReason) {
            updateAIRasterEditingMode()
            applyUnderlay(to: renderer)
        }
        .onChange(of: board.frame?.aiSourceFramingFingerprint) {
            updateAIRasterEditingMode()
            applyUnderlay(to: renderer)
        }
        .onChange(of: onionMode) { applyUnderlay(to: renderer) }
        .onChange(of: board.frame?.underlayDataURL) { applyUnderlay(to: renderer) }
        .onChange(of: board.frame?.underlayOpacity) { applyUnderlay(to: renderer) }
        )
    }

    private var serviceObservedBoardView: AnyView {
        AnyView(backgroundObservedBoardView
        .onChange(of: perspectiveMode) { handlePerspectiveModeChange() }
        .onChange(of: perspectiveSnap) { updateSnapState() }
        .task {
            await retryPendingDocumentsLoop()
        }
        .task {
            await liveSyncLoop()
        }
        .onChange(of: boardTool) { selectedStrokeIds = [] }
        .onChange(of: tipPickerItem) { importSelectedBrushTip() }
        )
    }

    private func retryPendingDocumentsLoop() async {
        guard !board.isLocalSample else { return }
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 60_000_000_000)
            if !pendingFrameIds.isEmpty { flushAllPending() }
            await retryAllPendingCameraMotionMutations()
        }
    }

    private func handlePerspectiveModeChange() {
        persistPerspective()
        updateSnapState()
    }

    private func liveSyncLoop() async {
        guard !board.isLocalSample else { return }
        presentOthers = await RoleRoomAPIClient.shared.reportPresence(
            manuscriptId: board.manuscript.id)
        while !Task.isCancelled {
            let interval: UInt64 = presentOthers.isEmpty ? 30 : 10
            try? await Task.sleep(nanoseconds: interval * 1_000_000_000)
            guard !Task.isCancelled else { break }
            presentOthers = await RoleRoomAPIClient.shared.reportPresence(
                manuscriptId: board.manuscript.id)
            let changed = await board.refreshFromServer()
            await board.refreshAnimationURLs()
            if changed, let other = presentOthers.first {
                board.syncStatus = "Oppdatert fra \(other)"
            }
            if changed,
               canvasState.revision == loadedRevision,
               board.frame?.updatedAt != loadedFrameUpdatedAt {
                loadActiveFrameIntoCanvas()
            }
        }
    }

    // Forrige lastede frame + strøkantall — usynkede strøk flushes automatisk
    // ved shot-/scenebytte så tegning ikke mistes uten eksplisitt Synk.
    @State private var loadedFrameRef: (sceneId: String, frameId: String)?
    @State private var loadedRevision = 0
    @State private var loadedFrameUpdatedAt: String?
    /// Stable Pencil/layer/framing token used only by the AI pipeline.
    /// General frame OCC keeps using loadedFrameUpdatedAt so comments and
    /// approval metadata cannot masquerade as source edits.
    @State private var loadedFrameSourceUpdatedAt: String?
    @State private var loadedFrameStrokesJSON: String?
    @State private var loadedFrameLayerState: BoardLayerState?
    @State private var loadedFrameShotFraming: ShotFramingState?
    @State private var loadedFrameCameraMotionTrack: CameraMotionTrack?
    @State private var loadedFrameCameraMotionRevision = 0
    @State private var loadedFrameCameraMotionFingerprint: String?
    @State private var loadedFrameCameraMotionStatus: String?
    @State private var loadedFramePaintoverState: StoryboardPaintoverState?
    @State private var lastObservedShotFraming: ShotFramingState?
    @State private var pendingFrameIds: Set<String> = []

    private func loadActiveFrameIntoCanvas() {
        if loadedFrameRef?.sceneId != board.scene?.id
            || loadedFrameRef?.frameId != board.frame?.id {
            resetFrameScopedAIState()
        } else {
            // A same-frame reload may contain a collaborator's newer source.
            // Fail closed until image-stage GET confirms the live revision.
            currentAIImageSourceRevision = nil
        }
        flushPendingStrokes()
        canvasState.endHistory()
        autosyncTask?.cancel()
        canvasState.contentSize = board.frame.map {
            CGSize(width: $0.drawingWidth, height: $0.drawingHeight)
        }
        // Pending-backup (app drept før synk) er alltid nyere enn serverens
        // versjon — gjenopprett og synk den.
        var restoredPending = false
        var recoveredLayerState = board.frame?.layerState
        var recoveredShotFraming = board.frame?.shotFraming
        var recoveredStrokesJSON = board.frame?.strokesJSON ?? "[]"
        var recoveredBaseUpdatedAt = board.frame?.updatedAt
        var recoveredBaseSourceUpdatedAt =
            board.frame?.sourceUpdatedAt
        var recoveredBaseStrokesJSON = board.frame?.strokesJSON
        var recoveredBaseLayerState = board.frame?.layerState
        var recoveredBaseShotFraming = board.frame?.shotFraming
        var recoveredCameraMotionTrack = board.frame?.cameraMotionTrack
        var recoveredBaseCameraMotionTrack = board.frame?.cameraMotionTrack
        var recoveredBaseCameraMotionRevision =
            board.frame?.cameraMotionRevision ?? 0
        var recoveredBaseCameraMotionFingerprint =
            board.frame?.cameraMotionFingerprint
        var recoveredBaseCameraMotionStatus = board.frame?.cameraMotionStatus
        var restoredPendingCameraMotion = false
        var restoredPendingCameraFraming = false
        if let frameId = board.frame?.id,
           let pending = PendingStrokeStore.loadDocument(frameId: frameId) {
            // v1-v4 manglet original base. For slike eldre WAL-er velger vi
            // en tapsfri union med dagens serverdokument (lokale tillegg
            // beholdes uten å slette samtidige serverstrøk).
            let pendingJSON: String
            if pending.baseStrokesJSON == nil,
               let serverJSON = board.frame?.strokesJSON,
               let merged = StrokeMerge.union(
                serverJSON: serverJSON, oursJSON: pending.strokesJSON) {
                pendingJSON = merged
            } else {
                pendingJSON = pending.strokesJSON
            }
            if let strokes = try? StrokeSerialization.decodeFromWebJSON(pendingJSON) {
                canvasState.strokes = strokes
                recoveredStrokesJSON = pendingJSON
                recoveredLayerState = pending.layerState ?? recoveredLayerState
                recoveredShotFraming = pending.shotFraming ?? recoveredShotFraming
                recoveredBaseUpdatedAt = pending.baseUpdatedAt ?? recoveredBaseUpdatedAt
                recoveredBaseStrokesJSON = pending.baseStrokesJSON
                    ?? recoveredBaseStrokesJSON
                recoveredBaseLayerState = pending.baseLayerState
                    ?? recoveredBaseLayerState
                recoveredBaseShotFraming = pending.baseShotFraming
                    ?? recoveredBaseShotFraming
                restoredPending = true
                board.syncStatus = "Gjenopprettet usynket tegning"
            }
        }
        if let frameId = board.frame?.id,
           let pendingMotion = PendingCameraMotionStore.load(frameId: frameId) {
            recoveredShotFraming = pendingMotion.initialFraming
            recoveredCameraMotionTrack = pendingMotion.motionTrack
            recoveredBaseUpdatedAt = pendingMotion.baseUpdatedAt
                ?? recoveredBaseUpdatedAt
            recoveredBaseSourceUpdatedAt =
                pendingMotion.baseSourceUpdatedAt
            recoveredBaseStrokesJSON = pendingMotion.baseStrokesJSON
                ?? recoveredBaseStrokesJSON
            recoveredBaseLayerState = pendingMotion.baseLayerState
                ?? recoveredBaseLayerState
            recoveredBaseShotFraming = pendingMotion.baseShotFraming
                ?? recoveredBaseShotFraming
            recoveredBaseCameraMotionTrack = pendingMotion.baseMotionTrack
            recoveredBaseCameraMotionRevision =
                pendingMotion.expectedMotionRevision
            recoveredBaseCameraMotionFingerprint =
                pendingMotion.baseMotionFingerprint
            recoveredBaseCameraMotionStatus =
                pendingMotion.baseMotionStatus
            restoredPendingCameraMotion = true
            restoredPendingCameraFraming = pendingMotion.changesInitialFraming
            board.syncStatus = "Gjenopprettet usynket kamerabane"
        }
        if !restoredPending {
            if let json = board.frame?.strokesJSON,
               let strokes = try? StrokeSerialization.decodeFromWebJSON(json) {
                canvasState.strokes = strokes
            } else {
                canvasState.strokes = []
            }
        }
        if let frame = board.frame {
            let legacyFraming = ShotFramingState(
                shotSize: frame.shotType, angle: frame.angle, lensMm: frame.lensMm,
                aspectRatio: frame.drawingWidth / max(1, frame.drawingHeight)
            )
            canvasState.beginHistory(
                frameId: frame.id,
                layerState: recoveredLayerState,
                shotFraming: recoveredShotFraming ?? legacyFraming,
                cameraMotionTrack: recoveredCameraMotionTrack
            )
            // Pending/offline framing is the active document immediately,
            // including for Prompt Engine calls made before autosync finishes.
            board.applyShotFramingLocally(
                canvasState.shotFraming,
                markAIStale: restoredPending || restoredPendingCameraFraming)
            lastObservedShotFraming = canvasState.shotFraming
            loadedFrameLayerState = recoveredBaseLayerState
                ?? frame.layerState ?? .standard
            loadedFrameShotFraming = recoveredBaseShotFraming
                ?? frame.shotFraming ?? legacyFraming
            loadedFrameCameraMotionTrack = recoveredBaseCameraMotionTrack
            loadedFrameCameraMotionRevision =
                recoveredBaseCameraMotionRevision
            loadedFrameCameraMotionFingerprint =
                recoveredBaseCameraMotionFingerprint
            loadedFrameCameraMotionStatus = recoveredBaseCameraMotionStatus
            lastObservedCameraMotionTrack = canvasState.cameraMotionTrack
            if restoredPendingCameraMotion {
                board.applyCameraMotionLocally(
                    canvasState.cameraMotionTrack,
                    revision: frame.cameraMotionRevision,
                    status: "valid")
            }
        } else {
            canvasState.applyLayerState(.standard)
            canvasState.shotFraming = .standard
            lastObservedShotFraming = .standard
            canvasState.undoStack = []
            canvasState.cameraMotionTrack = nil
            lastObservedCameraMotionTrack = nil
            canvasState.redoStack = []
            loadedFrameLayerState = nil
            loadedFrameShotFraming = nil
            loadedFrameCameraMotionTrack = nil
            loadedFrameCameraMotionRevision = 0
            loadedFrameCameraMotionFingerprint = nil
            loadedFrameCameraMotionStatus = nil
        }
        loadedFrameRef = board.scene.flatMap { scene in
            board.frame.map { (scene.id, $0.id) }
        }
        loadedFrameUpdatedAt = recoveredBaseUpdatedAt
        loadedFrameSourceUpdatedAt = if restoredPending {
            nil
        } else if restoredPendingCameraMotion {
            recoveredBaseSourceUpdatedAt
        } else {
            board.frame?.sourceUpdatedAt
        }
        loadedFrameStrokesJSON = recoveredBaseStrokesJSON ?? recoveredStrokesJSON
        // A recovered WAL is deliberately not assigned a fabricated overlay
        // revision. This remains the last server snapshot until PATCH acks the
        // exact recovered document.
        loadedFramePaintoverState = board.frame?.aiPaintoverState
        if let frame = board.frame,
           let identity = EditableFrameRasterIdentity(frame: frame),
           let image = FrameImageCache.image(for: frame) {
            retainedEditableBaseImages[frame.id] = RetainedEditableBase(
                identity: identity, image: image)
        } else if let frame = board.frame,
                  retainedEditableBaseImages[frame.id]?.identity
                    != EditableFrameRasterIdentity(frame: frame) {
            // Never let frame A pixels survive under frame B provenance.
            retainedEditableBaseImages.removeValue(forKey: frame.id)
        }
        perspectiveMode = board.frame?.perspectiveMode ?? 0
        vanishingPoints = (board.frame?.vanishingPoints ?? []).compactMap { pair in
            pair.count == 2 ? CGPoint(x: pair[0], y: pair[1]) : nil
        }
        updateAIRasterEditingMode()
        applyUnderlay(to: renderer)
        updateSnapState()
        pendingFrameIds = PendingStrokeStore.pendingFrameIds()
        canvasState.revision += 1
        loadedRevision = canvasState.revision
        refreshTZeroPresentationSnapshot()
        if restoredPending {
            // Marker som usynket så autosynken plukker den opp (thumb
            // rendres etter at canvasen har rebuildet den nye framen).
            loadedRevision = -1
            scheduleAutosync()
        }
    }

    private func reconcileDurationCameraMotion() {
        guard let frame = board.frame,
              loadedFrameRef?.frameId == frame.id,
              PendingCameraMotionStore.load(frameId: frame.id) == nil,
              !cameraMotionSyncInFlight else { return }
        let revision = frame.cameraMotionRevision ?? 0
        let changed = revision != loadedFrameCameraMotionRevision
            || frame.cameraMotionTrack != loadedFrameCameraMotionTrack
            || frame.cameraMotionFingerprint
                != loadedFrameCameraMotionFingerprint
            || frame.cameraMotionStatus != loadedFrameCameraMotionStatus
        guard changed else { return }

        loadedFrameUpdatedAt = frame.updatedAt
        loadedFrameCameraMotionTrack = frame.cameraMotionTrack
        loadedFrameCameraMotionRevision = revision
        loadedFrameCameraMotionFingerprint =
            frame.cameraMotionFingerprint
        loadedFrameCameraMotionStatus = frame.cameraMotionStatus
        lastObservedCameraMotionTrack = frame.cameraMotionTrack
        canvasState.cameraMotionTrack = frame.cameraMotionTrack
        canvasState.presentationFraming = nil
    }

    /// Proves the active Metal surface consumes the same immutable t=0
    /// contract as thumbnails and exports. Editor selection/zoom is excluded;
    /// only the recovered server/canvas/WAL document participates.
    private func refreshTZeroPresentationSnapshot() {
        guard let frame = board.frame,
              let snapshot = try? FrameRenderCoordinator.snapshot(
                for: frame,
                at: .zero,
                strokesOverride: canvasState.strokes,
                layerStateOverride: canvasState.layerState,
                framingOverride: canvasState.shotFraming,
                localDocumentRevision: canvasState.revision)
        else {
            canvasState.presentationFraming = nil
            return
        }
        canvasState.presentationFraming = snapshot.presentationFraming
    }

    /// Én SwiftUI-eid lastesyklus per aktiv rasterkilde. Den gamle ad-hoc
    /// Task-en kunne bli kansellert etter at en parallell thumbnail-request
    /// hadde fylt cachen, men før Metal fikk den nye basen. Resultatet var et
    /// hvitt aktivt shot selv om previewen til venstre var synlig.
    private var activeRasterTaskKey: String {
        guard let scene = board.scene, let frame = board.frame else { return "none" }
        let source = FrameDocumentProjection.effectiveRasterSource(for: frame)
        let identity = EditableFrameRasterIdentity(frame: frame)
        return [
            scene.id, frame.id, frame.updatedAt ?? "",
            source.stableIdentity ?? "excluded",
            source.includesFrameImage
                ? (identity?.placementFingerprint ?? "source-space")
                : "no-placement",
            frame.aiOutputStale
                ? (frame.aiOutputStaleReason ?? "stale") : "current",
        ].joined(separator: "|")
    }

    private func loadActiveRaster() async {
        guard let frame = board.frame else { return }
        let frameId = frame.id
        let source = FrameDocumentProjection.effectiveRasterSource(for: frame)
        guard source.includesFrameImage,
              let identity = EditableFrameRasterIdentity(frame: frame) else {
            retainedEditableBaseImages.removeValue(forKey: frameId)
            updateAIRasterEditingMode()
            applyUnderlay(to: renderer)
            return
        }
        await FrameImageCache.prefetch(frames: [frame])
        guard !Task.isCancelled,
              board.frame?.id == frameId,
              board.frame.flatMap(EditableFrameRasterIdentity.init(frame:)) == identity,
              let currentFrame = board.frame,
              let image = FrameImageCache.image(for: currentFrame) else {
            updateAIRasterEditingMode()
            applyUnderlay(to: renderer)
            return
        }
        retainedEditableBaseImages[frameId] = RetainedEditableBase(
            identity: identity, image: image)
        updateAIRasterEditingMode()
        applyUnderlay(to: renderer)
    }

    @MainActor
    private func refreshImageStageVersions() async {
        guard let projectId = board.projectId,
              let sceneId = board.scene?.id,
              let frameId = board.frame?.id,
              let session = currentAIFrameSession() else {
            imageStageStoryboardId = nil
            imageStageVersions = []
            currentAIImageSourceRevision = nil
            return
        }
        do {
            let storyboardId: String
            if let linked = board.frame?.aiStoryboardId ?? imageStageStoryboardId {
                storyboardId = linked
            } else if let recovered = try await RoleRoomAPIClient.shared
                .resolveStoryboardId(
                    projectId: projectId, sceneId: sceneId, frameId: frameId) {
                storyboardId = recovered
            } else {
                guard isCurrentAIFrameSession(session) else { return }
                imageStageStoryboardId = nil
                imageStageVersions = []
                currentAIImageSourceRevision = nil
                return
            }
            guard isCurrentAIFrameSession(session) else { return }
            imageStageStoryboardId = storyboardId
            let result = try await RoleRoomAPIClient.shared
                .fetchStoryboardImageVersions(
                    projectId: projectId, storyboardId: storyboardId)
            guard !Task.isCancelled, isCurrentAIFrameSession(session),
                  board.frame?.id == frameId,
                  imageStageStoryboardId == storyboardId else { return }
            imageStageVersions = result.versions
            currentAIImageSourceRevision = result.currentSourceRevision
            loadedFrameSourceUpdatedAt = result.sourceUpdatedAt
        } catch {
            if isCurrentAIFrameSession(session) {
                imageStageVersions = []
                currentAIImageSourceRevision = nil
                loadedFrameSourceUpdatedAt = nil
            }
        }
    }

    /// Gjenopprett en historikk-versjon: vanlig strokes-lagring (dagens
    /// versjon havner selv i historikken server-side — angrbart).
    private func restoreHistory(entry: (updatedAt: String, strokes: String)) {
        guard let ref = historyFrameRef else { return }
        showHistorySheet = false
        let manuscriptId = board.manuscript.id
        Task {
            _ = try? await RoleRoomAPIClient.shared.saveFrameStrokes(
                manuscriptId: manuscriptId, sceneId: ref.sceneId,
                frameId: ref.frameId, strokesJSON: entry.strokes)
            await board.reload()
            if board.frame?.id == ref.frameId { loadActiveFrameIntoCanvas() }
            board.syncStatus = "Gjenopprettet ✓"
        }
    }

    /// Snap-tilstand → canvas (VP-er i innholdsrom).
    private func updateSnapState() {
        let contentWidth = board.frame?.drawingWidth ?? 1920
        let contentHeight = board.frame?.drawingHeight ?? 1080
        let active = (1...3).contains(perspectiveMode) && perspectiveSnap
        canvasState.perspectiveSnapEnabled = active
        canvasState.perspectiveSnapPoints = active
            ? vanishingPoints.map { CGPoint(x: $0.x * contentWidth, y: $0.y * contentHeight) }
            : []
    }

    // Kuratert symbolsett for stamp-penselen (presentasjons-ikoner).
    static let stampSymbols = ["person.fill", "heart", "target", "chart.bar.fill",
                               "star.fill", "checkmark.seal", "exclamationmark.triangle",
                               "camera.fill", "lightbulb", "hand.thumbsup"]

    /// SF Symbol → PNG-dataURL som penselspiss (form = alfakanal).
    static func symbolTipDataURL(_ name: String) -> String? {
        let config = UIImage.SymbolConfiguration(pointSize: 100, weight: .medium)
        guard let symbol = UIImage(systemName: name, withConfiguration: config)?
            .withTintColor(.black, renderingMode: .alwaysOriginal) else { return nil }
        let side = 128.0
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: side, height: side),
                                            format: format).image { _ in
            let fit = min(side / symbol.size.width, side / symbol.size.height) * 0.86
            let drawSize = CGSize(width: symbol.size.width * fit, height: symbol.size.height * fit)
            symbol.draw(in: CGRect(x: (side - drawSize.width) / 2,
                                   y: (side - drawSize.height) / 2,
                                   width: drawSize.width, height: drawSize.height))
        }
        guard let png = image.pngData() else { return nil }
        return "data:image/png;base64," + png.base64EncodedString()
    }

    /// B2-opplasting med dataURL-fallback. Filene legges I PRODUKSJONS-
    /// STRUKTUREN, ikke løst i bucketen: projectId + sceneId + entity-
    /// kobling (storyboard_frame/scene) driver per-prosjekt-visningen og
    /// entity-files-oppslaget i Role Room-lagringen, og filnavnet bærer
    /// prosjekt/scene/shot for menneskelig lesbarhet.
    static func uploadOrInline(dataURL: String, name: String, board: BoardState,
                               sceneId: String? = nil,
                               entityType: String? = nil,
                               entityId: String? = nil,
                               note: String? = nil) async -> String {
        guard let comma = dataURL.firstIndex(of: ","),
              let jpeg = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) else {
            return dataURL
        }
        do {
            let path = try await RoleRoomAPIClient.shared.uploadStorageImage(
                jpegData: jpeg, name: name,
                projectId: board.projectId,
                sceneId: sceneId,
                attachedToEntityType: entityType,
                attachedToEntityId: entityId,
                attachmentNote: note)
            await MainActor.run {
                if let cached = UIImage(data: jpeg) {
                    FrameImageCache.store(cached, for: path)
                }
            }
            return path
        } catch {
            return dataURL
        }
    }

    /// Nedskalert JPEG-dataURL (payload-diett for scene-synk).
    static func jpegDataURL(_ image: UIImage, maxSide: Double, quality: Double) -> String? {
        let scaleFactor = min(1, maxSide / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scaleFactor,
                          height: image.size.height * scaleFactor)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let scaled = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let jpeg = scaled.jpegData(compressionQuality: quality) else { return nil }
        return "data:image/jpeg;base64," + jpeg.base64EncodedString()
    }

    /// Persister perspektiv-oppsettet på framen (visnings-metadata; web
    /// ignorerer feltene).
    private func persistPerspective() {
        guard board.frame != nil else { return }
        board.patchActiveFrame([
            "perspectiveMode": perspectiveMode,
            "vanishingPoints": vanishingPoints.map { [Double($0.x), Double($0.y)] },
        ])
    }

    /// Dekod frame-underlag + ev. onion-skin (forrige shot) og sett på
    /// gitt renderer (inline og fullskjerm har hver sin instans).
    private func applyUnderlay(to target: MetalStrokeRenderer?) {
        let background = composedCanvasBackground()
        target?.setEditableBase(cgImage: background.editableBase)
        target?.setViewportPreview(cgImage: background.viewportPreview)
        target?.setUnderlay(cgImage: background.referenceUnderlay,
                            opacity: background.referenceOpacity)
        // Shot-radene flytter den samme renderer-instansen mellom SwiftUI-
        // celler. Dersom drawable-størrelsen er uendret, kalles ikke alltid
        // layoutSubviews på nytt. Bygg derfor den nye rasterbasen direkte inn
        // i eksisterende Metal-akkumulator i stedet for å vente på layout.
        if let target, let texture = target.committedTexture {
            let contentWidth = max(1, board.frame?.drawingWidth ?? 1920)
            let scale = Double(texture.width) / contentWidth
            target.rebuild(strokes: canvasState.visibleStrokes(), scale: scale,
                           layerBlendModes: canvasState.layerBlendModes)
        }
        if let target, let mainRenderer = renderer, target === mainRenderer {
            appliedAIRasterPolicyKey = currentAIRasterPolicyKey
        }
        canvasState.backgroundRevision += 1
    }

    private func exactFrameRaster(for frame: FrameSummary) -> UIImage? {
        guard let identity = EditableFrameRasterIdentity(frame: frame) else {
            return nil
        }
        if let image = FrameImageCache.image(for: frame) { return image }
        guard let retained = retainedEditableBaseImages[frame.id],
              retained.identity == identity else { return nil }
        return retained.image
    }

    /// Preview-only fallback. Exact source pixels still pass the coordinator's
    /// camera/coverage gate. A legacy thumbnail-only poster is deliberately
    /// isolated here and can never enter export, animation or AI source paths.
    private func safeDirectRasterFallback(for frame: FrameSummary) -> UIImage? {
        if frame.imageUrl != nil {
            guard FrameRenderCoordinator.allowsDirectRasterFallback(
                for: frame) else { return nil }
            return exactFrameRaster(for: frame)
        }
        guard let posterURL = StoryboardPreviewPolicy
            .legacyThumbnailOnlyPosterURL(for: frame) else { return nil }
        return FrameImageCache.image(for: posterURL)
    }

    private var currentAIRasterPolicyKey: String {
        guard let frame = board.frame else { return "none" }
        guard StoryboardFrameImagePolicy.isAIViewportEncoded(frame) else {
            return "source:\(frame.id)"
        }
        if let placement = StoryboardFrameImagePolicy
            .rasterPlacementFraming(for: frame) {
            return [
                "editable", frame.id,
                frame.imageUrl ?? "",
                frame.aiSourceFramingFingerprint ?? "",
                placement.canonicalFingerprint,
                canvasState.shotFraming.canonicalFingerprint,
                String(frame.aiSourceRevision ?? -1),
                frame.aiOutputStale ? (frame.aiOutputStaleReason ?? "stale") : "current",
            ].joined(separator: ":")
        }
        return "archived:\(frame.id)"
    }

    /// Rebuild the editable source-space base whenever archived raster
    /// placement/provenance changes. Legacy approvals without a frozen pose
    /// still fail closed after a camera edit and return to Pencil until the
    /// generated viewport is re-approved.
    private func refreshFramingDependentBackground() {
        guard currentAIRasterPolicyKey != appliedAIRasterPolicyKey else { return }
        applyUnderlay(to: renderer)
    }

    private func updateAIRasterEditingMode() {
        let frame = board.frame
        let target = frame?.aiAtmosphereFramingFingerprint
            == canvasState.shotFraming.canonicalFingerprint
            ? "Atmosphere" : "Color"
        let decision = StoryboardAIRasterEditingPolicy.resolve(
            canUseRaster: frame.map(canUseApprovedAIRaster) ?? false,
            activeLayer: canvasState.activeBoardLayer,
            automaticallySelectedLayer: automaticallySelectedAIRasterLayer,
            targetLayer: target)
        canvasState.activeBoardLayer = decision.activeLayer
        automaticallySelectedAIRasterLayer = decision.automaticallySelectedLayer
        canvasState.suppressedSourceLayers = decision.suppressedSourceLayers
    }

    /// A frozen AI viewport may remain editable after a camera change only
    /// while the versioned coverage policy proves that every requested pixel
    /// is present in the archived raster. Pull-outs and unsafe translations
    /// therefore return to Pencil instead of exposing blank/synthesized areas.
    private func canUseApprovedAIRaster(_ frame: FrameSummary) -> Bool {
        guard StoryboardFrameImagePolicy.rasterPlacementFraming(for: frame) != nil,
              exactFrameRaster(for: frame) != nil,
              StoryboardAIRasterEditingPolicy.permitsRaster(
                isOutputStale: frame.aiOutputStale,
                staleReason: frame.aiOutputStaleReason),
              let snapshot = try? FrameRenderCoordinator.snapshot(
                for: frame,
                at: .zero,
                strokesOverride: canvasState.strokes,
                layerStateOverride: canvasState.layerState,
                framingOverride: canvasState.shotFraming,
                localDocumentRevision: canvasState.revision)
        else { return false }
        return FrameRenderCoordinator.canRender(frame: frame, snapshot: snapshot)
    }

    /// Et faktisk panelbilde går inn i rasterakkumulatoren og kan viskes i.
    /// Referansefoto/onion uten panelbilde forblir et skjerm-underlag.
    private func composedCanvasBackground() -> BoardCanvasBackground {
        let frameImage = board.frame.flatMap { frame in
            exactFrameRaster(for: frame)
        }
        if let frame = board.frame,
           canUseApprovedAIRaster(frame),
           let rasterPlacement = StoryboardFrameImagePolicy
            .rasterPlacementFraming(for: frame),
           let rasterSourceIdentity = FrameDocumentProjection
            .effectiveRasterSource(for: frame).stableIdentity,
           let preview = frameImage {
            let sourceSpace = StoryboardViewportRasterMapper.sourceSpaceImage(
                viewportImage: preview, frame: frame,
                framing: rasterPlacement,
                rasterSourceIdentity: rasterSourceIdentity)
            return BoardCanvasBackground(
                editableBase: sourceSpace?.cgImage, viewportPreview: nil,
                referenceUnderlay: nil, referenceOpacity: 0)
        }
        if let frame = board.frame,
           StoryboardFrameImagePolicy.isAIViewportEncoded(frame) {
            // The archived AI image belongs to an older camera transform.
            // Keep it in version review; the live canvas returns to Pencil.
            return BoardCanvasBackground(
                editableBase: nil, viewportPreview: nil,
                referenceUnderlay: nil, referenceOpacity: 0)
        }
        if board.frame?.imageUrl != nil {
            // Imported/source-space images keep their native pixels. Never
            // flatten reference/onion layers into the editable raster: that
            // both stretched mismatched aspects and leaked guides into saves.
            return BoardCanvasBackground(editableBase: frameImage?.cgImage,
                                         viewportPreview: nil,
                                         referenceUnderlay: nil, referenceOpacity: 0)
        }
        let (composed, opacity) = composedUnderlay()
        return BoardCanvasBackground(editableBase: nil, viewportPreview: nil,
                                     referenceUnderlay: composed, referenceOpacity: opacity)
    }

    /// Komponert underlag (referansefoto + onion-lag) for aktiv frame —
    /// deles med fullskjerm så begge renderere viser det samme.
    private func composedUnderlay() -> (CGImage?, Double) {
        // Bilde-frame: statisk innhold tegnes underst med full opacity
        // (i motsetning til referanse-underlaget følger det med i eksport
        // via FrameRenderService).
        let frameImage = board.frame.flatMap { frame in
            exactFrameRaster(for: frame)
        }
        let underlayImage = board.frame?.underlayDataURL.flatMap(decodeDataURL)
        // Onion-kilder med alpha: forrige tydeligst, nabo nummer to svakere.
        var onionLayers: [(image: UIImage, alpha: CGFloat)] = []
        if onionMode > 0, let scene = board.scene {
            func render(_ index: Int) -> UIImage? {
                guard scene.frames.indices.contains(index) else { return nil }
                let frame = effectiveFrameForRendering(scene.frames[index])
                return FrameRenderCoordinator.image(
                    for: frame,
                    maxWidth: 1120)
            }
            let current = board.activeFrameIndex
            if let previous = render(current - 1) { onionLayers.append((previous, 0.35)) }
            if onionMode == 2, let next = render(current + 1) { onionLayers.append((next, 0.2)) }
            if onionMode == 3, let older = render(current - 2) { onionLayers.append((older, 0.2)) }
        }
        let opacity = board.frame?.underlayOpacity ?? 0.4
        // Ingen kompositt nødvendig: behold originalens faktiske piksler.
        // Tidligere ble også rene panelbilder først rasterisert til 1120 px,
        // som gjorde 1B og øvrige shots uklare i Retina/fullskjerm.
        if let frameImage, underlayImage == nil, onionLayers.isEmpty {
            return (frameImage.cgImage, 1)
        }
        switch (underlayImage, onionLayers.isEmpty && frameImage == nil) {
        case (nil, true):
            return (nil, 0)
        case (let underlay?, true):
            return (underlay.cgImage, opacity)
        default:
            // Komponer på papirfarget flate (samlet opacity 1 i shaderen).
            let logicalWidth = board.frame?.drawingWidth ?? 1920
            let sourceWidth = Double(frameImage?.cgImage?.width ?? 0)
            let width = min(4096, max(logicalWidth, max(sourceWidth, 1120)))
            let height = width * (board.frame.map { $0.drawingHeight / max(1, $0.drawingWidth) } ?? 9.0 / 16)
            let size = CGSize(width: width, height: height)
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let composed = UIGraphicsImageRenderer(size: size, format: format).image { context in
                UIColor(red: 0.961, green: 0.949, blue: 0.918, alpha: 1).setFill()
                context.fill(CGRect(origin: .zero, size: size))
                if let base = frameImage {
                    base.draw(in: CGRect(origin: .zero, size: size))
                }
                if let underlay = underlayImage {
                    underlay.draw(in: CGRect(origin: .zero, size: size), blendMode: .normal, alpha: opacity)
                }
                for layer in onionLayers {
                    layer.image.draw(in: CGRect(origin: .zero, size: size),
                                     blendMode: .multiply, alpha: layer.alpha)
                }
            }
            return (composed.cgImage, 1)
        }
    }

    /// Apply a server-preserved sidecar only when that sidecar did not change
    /// locally after the immutable save snapshot. Newer local camera/layer
    /// intent remains in the WAL for the follow-up three-way save.
    private func reconcileConfirmedSidecars(
        snapshot: ActiveFrameSaveSnapshot,
        layerState: BoardLayerState,
        shotFraming: ShotFramingState
    ) {
        guard loadedFrameRef?.frameId == snapshot.frameId else { return }
        if canvasState.layerState == snapshot.layerState,
           layerState != snapshot.layerState {
            canvasState.applyLayerState(layerState)
        }
        if canvasState.shotFraming == snapshot.shotFraming,
           shotFraming != snapshot.shotFraming {
            canvasState.shotFraming = shotFraming
            lastObservedShotFraming = shotFraming
            board.applyShotFramingLocally(shotFraming, markAIStale: false)
        }
    }

    private func flushPendingStrokes() {
        guard !board.isLocalSample else { return }
        guard let ref = loadedFrameRef, canvasState.revision != loadedRevision,
              let json = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes) else { return }
        // Dersom den vanlige autosynken allerede lagrer dette shotet, lar vi
        // completion lese den nyere WAL-en og starte frame-switch-save etterpå.
        if syncInFlight {
            syncRequestedAfterCurrent = true
            return
        }
        let snapshot = ActiveFrameSaveSnapshot(
            manuscriptId: board.manuscript.id,
            sceneId: ref.sceneId,
            frameId: ref.frameId,
            revision: canvasState.revision,
            strokesJSON: json,
            thumbnailDataURL: renderer?.thumbnailDataURL(
                framing: canvasState.shotFraming),
            layerState: canvasState.layerState,
            shotFraming: canvasState.shotFraming,
            baseUpdatedAt: loadedFrameUpdatedAt,
            baseStrokesJSON: loadedFrameStrokesJSON,
            baseLayerState: loadedFrameLayerState,
            baseShotFraming: loadedFrameShotFraming)
        PendingStrokeStore.save(
            snapshot.strokesJSON, frameId: snapshot.frameId,
            layerState: snapshot.layerState,
            shotFraming: snapshot.shotFraming,
            localRevision: snapshot.revision,
            thumbnailDataURL: snapshot.thumbnailDataURL,
            baseUpdatedAt: snapshot.baseUpdatedAt,
            baseStrokesJSON: snapshot.baseStrokesJSON,
            baseLayerState: snapshot.baseLayerState,
            baseShotFraming: snapshot.baseShotFraming)
        pendingFrameIds.insert(snapshot.frameId)
        Task {
            guard let result = try? await RoleRoomAPIClient.shared.saveFrameStrokes(
                manuscriptId: snapshot.manuscriptId,
                sceneId: snapshot.sceneId,
                frameId: snapshot.frameId,
                strokesJSON: snapshot.strokesJSON,
                thumbnailDataURL: snapshot.thumbnailDataURL,
                baseUpdatedAt: snapshot.baseUpdatedAt,
                layerState: snapshot.layerState,
                shotFraming: snapshot.shotFraming,
                baseStrokesJSON: snapshot.baseStrokesJSON,
                baseLayerState: snapshot.baseLayerState,
                baseShotFraming: snapshot.baseShotFraming)
            else { return }
            let pending = PendingStrokeStore.loadDocument(frameId: snapshot.frameId)
            let plan = FrameSaveRacePolicy.completionPlan(
                snapshot: snapshot,
                loadedFrameId: loadedFrameRef?.frameId,
                currentRevision: canvasState.revision,
                pendingDocument: pending)
            let authoritativeLayerState = result.layerState ?? snapshot.layerState
            let authoritativeShotFraming = result.shotFraming ?? snapshot.shotFraming
            if plan.updateActiveBaselines {
                loadedRevision = snapshot.revision
                loadedFrameUpdatedAt = result.updatedAt ?? snapshot.baseUpdatedAt
                currentAIImageSourceRevision = result.sourceRevision
                loadedFrameSourceUpdatedAt = result.sourceUpdatedAt
                loadedFrameStrokesJSON = result.strokesJSON ?? snapshot.strokesJSON
                loadedFrameLayerState = authoritativeLayerState
                loadedFrameShotFraming = authoritativeShotFraming
                if let paintoverState = result.paintoverState {
                    loadedFramePaintoverState = paintoverState
                }
                reconcileConfirmedSidecars(
                    snapshot: snapshot,
                    layerState: authoritativeLayerState,
                    shotFraming: authoritativeShotFraming)
            }
            if plan.clearPendingDocument, let pending,
               PendingStrokeStore.clear(
                frameId: snapshot.frameId, ifUnchangedFrom: pending) {
                pendingFrameIds.remove(snapshot.frameId)
            } else if PendingStrokeStore.loadDocument(
                frameId: snapshot.frameId) != nil {
                pendingFrameIds.insert(snapshot.frameId)
                if plan.scheduleLatestActiveSave {
                    scheduleAutosync()
                } else if loadedFrameRef?.frameId != snapshot.frameId {
                    flushAllPending()
                }
            }
        }
    }

    @State private var autosyncTask: Task<Void, Never>?

    private func syncActiveFrameStrokes() {
        guard !board.isLocalSample else {
            board.syncStatus = "Lokal UX-demo · ingen serverendringer"
            return
        }
        // Re-entrancy-vern (E2E-QA fant race): manuell Synk + autosynk-
        // timeren samtidig ga to parallelle saves og visnings-desynk.
        guard !syncInFlight else {
            // Ikke mist en autosync som fyrer mens forrige snapshot fortsatt
            // er på vei til serveren. Completion planlegger den nyeste WAL-en
            // på nytt etter at in-flight-vernet er løftet.
            syncRequestedAfterCurrent = true
            return
        }
        guard let scene = board.scene, let frame = board.frame,
              let ref = loadedFrameRef,
              ref.sceneId == scene.id, ref.frameId == frame.id,
              let json = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes)
        else { return }

        // Alt API-kallet skal lagre fryses FØR Task opprettes. SwiftUI-state
        // kan endres mens await pågår (tegning, kamerautsnitt eller shotbytte).
        let snapshot = ActiveFrameSaveSnapshot(
            manuscriptId: board.manuscript.id,
            sceneId: ref.sceneId,
            frameId: ref.frameId,
            revision: canvasState.revision,
            strokesJSON: json,
            thumbnailDataURL: renderer?.thumbnailDataURL(
                framing: canvasState.shotFraming),
            layerState: canvasState.layerState,
            shotFraming: canvasState.shotFraming,
            baseUpdatedAt: loadedFrameUpdatedAt,
            baseStrokesJSON: loadedFrameStrokesJSON,
            baseLayerState: loadedFrameLayerState,
            baseShotFraming: loadedFrameShotFraming
        )
        // Oppgrader den lette per-edit WAL-en med thumb akkurat én gang når
        // nett-save starter; unngår dyr rasterisering på hvert Pencil-commit.
        PendingStrokeStore.save(
            snapshot.strokesJSON, frameId: snapshot.frameId,
            layerState: snapshot.layerState,
            shotFraming: snapshot.shotFraming,
            localRevision: snapshot.revision,
            thumbnailDataURL: snapshot.thumbnailDataURL,
            baseUpdatedAt: snapshot.baseUpdatedAt,
            baseStrokesJSON: snapshot.baseStrokesJSON,
            baseLayerState: snapshot.baseLayerState,
            baseShotFraming: snapshot.baseShotFraming)
        pendingFrameIds.insert(snapshot.frameId)
        syncInFlight = true
        board.syncStatus = "…"
        Task {
            var shouldScheduleLatest = false
            var shouldFlushInactivePending = false
            do {
                let result = try await RoleRoomAPIClient.shared.saveFrameStrokes(
                    manuscriptId: snapshot.manuscriptId,
                    sceneId: snapshot.sceneId,
                    frameId: snapshot.frameId,
                    strokesJSON: snapshot.strokesJSON,
                    thumbnailDataURL: snapshot.thumbnailDataURL,
                    baseUpdatedAt: snapshot.baseUpdatedAt,
                    layerState: snapshot.layerState,
                    shotFraming: snapshot.shotFraming,
                    baseStrokesJSON: snapshot.baseStrokesJSON,
                    baseLayerState: snapshot.baseLayerState,
                    baseShotFraming: snapshot.baseShotFraming)

                let pending = PendingStrokeStore.loadDocument(
                    frameId: snapshot.frameId)
                let plan = FrameSaveRacePolicy.completionPlan(
                    snapshot: snapshot,
                    loadedFrameId: loadedFrameRef?.frameId,
                    currentRevision: canvasState.revision,
                    pendingDocument: pending)
                let authoritativeStrokesJSON = result.strokesJSON
                    ?? snapshot.strokesJSON
                let authoritativeLayerState = result.layerState
                    ?? snapshot.layerState
                let authoritativeShotFraming = result.shotFraming
                    ?? snapshot.shotFraming

                if plan.updateActiveBaselines {
                    // Baseline er snapshotet serveren faktisk bekreftet —
                    // aldri en nyere canvas-revisjon som oppstod under await.
                    loadedRevision = snapshot.revision
                    loadedFrameUpdatedAt = result.updatedAt ?? snapshot.baseUpdatedAt
                    currentAIImageSourceRevision = result.sourceRevision
                    loadedFrameSourceUpdatedAt = result.sourceUpdatedAt
                    loadedFrameStrokesJSON = authoritativeStrokesJSON
                    loadedFrameLayerState = authoritativeLayerState
                    loadedFrameShotFraming = authoritativeShotFraming
                    if let paintoverState = result.paintoverState {
                        loadedFramePaintoverState = paintoverState
                    }
                    reconcileConfirmedSidecars(
                        snapshot: snapshot,
                        layerState: authoritativeLayerState,
                        shotFraming: authoritativeShotFraming)
                }
                if plan.clearPendingDocument, let pending,
                   PendingStrokeStore.clear(
                    frameId: snapshot.frameId, ifUnchangedFrom: pending) {
                    pendingFrameIds.remove(snapshot.frameId)
                } else if PendingStrokeStore.loadDocument(
                    frameId: snapshot.frameId) != nil {
                    pendingFrameIds.insert(snapshot.frameId)
                }
                shouldScheduleLatest = plan.scheduleLatestActiveSave
                shouldFlushInactivePending = PendingStrokeStore.loadDocument(
                    frameId: snapshot.frameId) != nil
                    && loadedFrameRef?.frameId != snapshot.frameId

                // Serveren kan ha flettet inn samtidige strøk samtidig som
                // artisten fortsatte å tegne lokalt. Rebase den nyeste lokale
                // canvasen på serverens bekreftede dokument før oppfølgingssave.
                if result.merged, plan.scheduleLatestActiveSave,
                   loadedFrameRef?.frameId == snapshot.frameId,
                   let currentJSON = try? StrokeSerialization.encodeToWebJSON(
                    canvasState.strokes),
                   let rebasedJSON = StrokeMerge.threeWay(
                    serverJSON: authoritativeStrokesJSON,
                    baseJSON: snapshot.strokesJSON,
                    oursJSON: currentJSON),
                   rebasedJSON != currentJSON,
                   let rebasedStrokes = try? StrokeSerialization.decodeFromWebJSON(
                    rebasedJSON) {
                    canvasState.strokes = rebasedStrokes
                    canvasState.revision += 1
                }

                if result.merged, plan.updateActiveBaselines,
                   !plan.scheduleLatestActiveSave {
                    // Ekte konflikt: serveren hadde nyere strøk — hent unionen
                    // inn i canvasen så lokal visning matcher det som ble lagret.
                    await board.reload()
                    // Brukeren kan ha tegnet eller byttet shot mens reload
                    // await-et. Da må lokal canvas/WAL vinne og synkes etterpå.
                    if loadedFrameRef?.frameId == snapshot.frameId,
                       canvasState.revision == snapshot.revision {
                        loadActiveFrameIntoCanvas()
                        board.syncStatus = "Synket (flettet med annen enhet) ✓"
                    } else {
                        shouldScheduleLatest = true
                    }
                } else if plan.updateActiveBaselines {
                    board.syncStatus = plan.scheduleLatestActiveSave
                        ? "Nyere endring venter på synk"
                        : "Synket ✓"
                }
            } catch SyncError.unauthenticated {
                if loadedFrameRef?.frameId == snapshot.frameId {
                    board.syncStatus = "Token utløpt — logg inn på nytt"
                }
            } catch {
                // Pending-fil beholdes; neste autosynk prøver igjen.
                if loadedFrameRef?.frameId == snapshot.frameId {
                    board.syncStatus = error.localizedDescription
                }
            }
            let queuedWhileSaving = syncRequestedAfterCurrent
            syncRequestedAfterCurrent = false
            syncInFlight = false
            if queuedWhileSaving || shouldScheduleLatest {
                // scheduleAutosync skriver den nyeste snapshot-WAL-en på nytt
                // og starter etter at syncInFlight er false, så kallet kan
                // ikke lenger forsvinne i re-entrancy-vernet.
                scheduleAutosync()
            }
            if shouldFlushInactivePending {
                flushAllPending()
            }
        }
    }

    /// Synk alle usynkede frames fra disk-backupen — kjøres fra «Synk nå»
    /// og en 60 s retry-timer (nett tilbake skal ikke kreve at hver frame
    /// åpnes på nytt).
    private func flushAllPending() {
        for frameId in PendingStrokeStore.pendingFrameIds() {
            if frameId == board.frame?.id {
                syncActiveFrameStrokes()
                continue
            }
            guard let scene = board.scenes.first(where: { scene in
                scene.frames.contains { $0.id == frameId }
            }), let pending = PendingStrokeStore.loadDocument(frameId: frameId) else { continue }
            let manuscriptId = board.manuscript.id
            let sceneId = scene.id
            let savedPending = pending
            Task {
                do {
                    _ = try await RoleRoomAPIClient.shared.saveFrameStrokes(
                        manuscriptId: manuscriptId, sceneId: sceneId,
                        frameId: frameId, strokesJSON: savedPending.strokesJSON,
                        thumbnailDataURL: savedPending.thumbnailDataURL,
                        baseUpdatedAt: savedPending.baseUpdatedAt,
                        layerState: savedPending.layerState,
                        shotFraming: savedPending.shotFraming,
                        baseStrokesJSON: savedPending.baseStrokesJSON,
                        baseLayerState: savedPending.baseLayerState,
                        baseShotFraming: savedPending.baseShotFraming)
                    // En ny lokal WAL kan ha blitt skrevet mens await pågikk.
                    // Slett bare filen som faktisk ble sendt og bekreftet.
                    if PendingStrokeStore.clear(
                        frameId: frameId, ifUnchangedFrom: savedPending) {
                        pendingFrameIds.remove(frameId)
                    } else {
                        pendingFrameIds.insert(frameId)
                        if loadedFrameRef?.frameId == frameId {
                            scheduleAutosync()
                        }
                    }
                } catch {
                    // beholdes på disk; neste retry tar den
                }
            }
        }
    }

    // Autosynk: backup til disk straks, nett-synk etter 3 s ro.
    private func scheduleAutosync() {
        guard !board.isLocalSample else { return }
        guard let frame = board.frame,
              canvasState.revision != loadedRevision,
              let json = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes) else { return }
        let changes = activePaintoverChanges()
        if changes.pencilContentChanged {
            currentAIImageSourceRevision = nil
            loadedFrameSourceUpdatedAt = nil
            board.markActiveAIOutputStaleLocally(
                reason: "source-document-changed")
        } else if changes.framingChanged {
            board.markActiveAIOutputStaleLocally(
                reason: "shot-framing-changed")
        }
        if changes.pencilChanged || changes.colorChanged
            || changes.atmosphereChanged {
            // A confirmation is bound to an immutable rendered PNG. Editing
            // any contributing layer dismisses it, without fabricating a new
            // server-owned overlay revision locally.
            animationPreflight = nil
            animationPreflightSourceImage = nil
            animationPreflightComposite = nil
            animationPreflightSession = nil
        }
        PendingStrokeStore.save(
            json, frameId: frame.id, layerState: canvasState.layerState,
            shotFraming: canvasState.shotFraming,
            localRevision: canvasState.revision,
            baseUpdatedAt: loadedFrameUpdatedAt,
            baseStrokesJSON: loadedFrameStrokesJSON,
            baseLayerState: loadedFrameLayerState,
            baseShotFraming: loadedFrameShotFraming)
        pendingFrameIds.insert(frame.id)
        autosyncTask?.cancel()
        autosyncTask = Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            syncActiveFrameStrokes()
        }
    }

    private func activePaintoverChanges() -> StoryboardPaintoverChangeSet {
        StoryboardPaintoverDocumentPolicy.classify(
            baseStrokesJSON: loadedFrameStrokesJSON,
            currentStrokes: canvasState.strokes,
            baseLayerState: loadedFrameLayerState,
            currentLayerState: canvasState.layerState,
            baseShotFraming: loadedFrameShotFraming,
            currentShotFraming: canvasState.shotFraming)
    }

    /// Paid Color generation may only start from a frame snapshot the server
    /// has acknowledged. This closes the draw -> immediate Generate window
    /// where the delayed autosync previously made a just-created candidate
    /// stale before it could even be reviewed.
    @MainActor
    private func acknowledgeActiveSourceForAIGeneration(
        session: AIFrameSessionKey
    ) async throws -> AISourceSnapshotAcknowledgement {
        autosyncTask?.cancel()
        var waitPasses = 0
        while syncInFlight && waitPasses < 200 {
            try await Task.sleep(nanoseconds: 50_000_000)
            guard isSameAIFrameIdentity(session) else {
                throw SyncError.serverMessage(
                    "Shotet ble byttet under synk. AI-generering ble ikke startet.")
            }
            waitPasses += 1
        }
        guard !syncInFlight else {
            throw SyncError.serverMessage(
                "Synkronisering tar uvanlig lang tid. Prøv igjen før AI-generering.")
        }
        autosyncTask?.cancel()
        guard isCurrentAIFrameSession(session),
              let ref = loadedFrameRef,
              ref.sceneId == session.sceneId,
              ref.frameId == session.frameId,
              let strokesJSON = try? StrokeSerialization.encodeToWebJSON(
                canvasState.strokes)
        else {
            throw SyncError.serverMessage(
                "Shotet ble endret før kilden var låst. AI-generering ble ikke startet.")
        }

        let snapshot = ActiveFrameSaveSnapshot(
            manuscriptId: board.manuscript.id,
            sceneId: ref.sceneId,
            frameId: ref.frameId,
            revision: canvasState.revision,
            strokesJSON: strokesJSON,
            thumbnailDataURL: renderer?.thumbnailDataURL(
                framing: canvasState.shotFraming),
            layerState: canvasState.layerState,
            shotFraming: canvasState.shotFraming,
            baseUpdatedAt: loadedFrameUpdatedAt,
            baseStrokesJSON: loadedFrameStrokesJSON,
            baseLayerState: loadedFrameLayerState,
            baseShotFraming: loadedFrameShotFraming)
        PendingStrokeStore.save(
            snapshot.strokesJSON, frameId: snapshot.frameId,
            layerState: snapshot.layerState,
            shotFraming: snapshot.shotFraming,
            localRevision: snapshot.revision,
            thumbnailDataURL: snapshot.thumbnailDataURL,
            baseUpdatedAt: snapshot.baseUpdatedAt,
            baseStrokesJSON: snapshot.baseStrokesJSON,
            baseLayerState: snapshot.baseLayerState,
            baseShotFraming: snapshot.baseShotFraming)
        pendingFrameIds.insert(snapshot.frameId)
        syncInFlight = true
        defer {
            syncInFlight = false
            if syncRequestedAfterCurrent {
                syncRequestedAfterCurrent = false
                scheduleAutosync()
            }
        }

        let result = try await RoleRoomAPIClient.shared.saveFrameStrokes(
            manuscriptId: snapshot.manuscriptId,
            sceneId: snapshot.sceneId,
            frameId: snapshot.frameId,
            strokesJSON: snapshot.strokesJSON,
            thumbnailDataURL: snapshot.thumbnailDataURL,
            baseUpdatedAt: snapshot.baseUpdatedAt,
            layerState: snapshot.layerState,
            shotFraming: snapshot.shotFraming,
            baseStrokesJSON: snapshot.baseStrokesJSON,
            baseLayerState: snapshot.baseLayerState,
            baseShotFraming: snapshot.baseShotFraming)
        guard isSameAIFrameIdentity(session) else {
            throw SyncError.serverMessage(
                "Shotet ble byttet etter kildesynk. AI-generering ble ikke startet.")
        }
        guard let updatedAt = result.updatedAt,
              !updatedAt.isEmpty,
              let sourceUpdatedAt = result.sourceUpdatedAt,
              !sourceUpdatedAt.isEmpty else {
            currentAIImageSourceRevision = nil
            loadedFrameSourceUpdatedAt = nil
            throw SyncError.serverMessage(
                "Serveren kunne ikke bekrefte AI-kilden. Ingen generering ble startet.")
        }
        let sourceRevision = result.sourceRevision

        let authoritativeStrokesJSON = result.strokesJSON ?? snapshot.strokesJSON
        let authoritativeLayerState = result.layerState ?? snapshot.layerState
        let authoritativeShotFraming = result.shotFraming ?? snapshot.shotFraming
        loadedFrameUpdatedAt = updatedAt
        loadedFrameStrokesJSON = authoritativeStrokesJSON
        loadedFrameLayerState = authoritativeLayerState
        loadedFrameShotFraming = authoritativeShotFraming
        guard let paintoverState = result.paintoverState else {
            throw SyncError.serverMessage(
                "Serveren kunne ikke bekrefte paintover-identiteten. Ingen AI-kostnad er utløst.")
        }
        loadedFramePaintoverState = paintoverState
        currentAIImageSourceRevision = sourceRevision
        loadedFrameSourceUpdatedAt = sourceUpdatedAt

        if result.merged, canvasState.revision != snapshot.revision {
            // The artist continued drawing while the server was also merging
            // a collaborator's changes. Rebase the live local document onto
            // the acknowledged server result; never replace the newer canvas
            // (or its WAL) with the older immutable generation snapshot.
            if let currentJSON = try? StrokeSerialization.encodeToWebJSON(
                canvasState.strokes),
               let rebasedJSON = StrokeMerge.threeWay(
                serverJSON: authoritativeStrokesJSON,
                baseJSON: snapshot.strokesJSON,
                oursJSON: currentJSON),
               rebasedJSON != currentJSON,
               let rebasedStrokes = try? StrokeSerialization.decodeFromWebJSON(
                rebasedJSON) {
                canvasState.strokes = rebasedStrokes
                canvasState.revision += 1
            }
            loadedRevision = snapshot.revision
            reconcileConfirmedSidecars(
                snapshot: snapshot,
                layerState: authoritativeLayerState,
                shotFraming: authoritativeShotFraming)
            currentAIImageSourceRevision = nil
            scheduleAutosync()
            throw SyncError.serverMessage(
                "Shotet ble flettet samtidig som du tegnet. De nyeste lokale endringene er bevart og synkes før AI-generering.")
        }

        if result.merged {
            if let mergedStrokes = try? StrokeSerialization.decodeFromWebJSON(
                authoritativeStrokesJSON) {
                canvasState.strokes = mergedStrokes
            }
            canvasState.applyLayerState(authoritativeLayerState)
            canvasState.shotFraming = authoritativeShotFraming
            lastObservedShotFraming = authoritativeShotFraming
            canvasState.revision += 1
            loadedRevision = canvasState.revision
            if let pending = PendingStrokeStore.loadDocument(frameId: snapshot.frameId),
               PendingStrokeStore.clear(
                frameId: snapshot.frameId, ifUnchangedFrom: pending) {
                pendingFrameIds.remove(snapshot.frameId)
            }
            throw SyncError.serverMessage(
                "Shotet ble flettet med endringer fra en annen enhet. Kontroller resultatet og start AI-generering på nytt.")
        }

        guard canvasState.revision == snapshot.revision else {
            loadedRevision = snapshot.revision
            reconcileConfirmedSidecars(
                snapshot: snapshot,
                layerState: authoritativeLayerState,
                shotFraming: authoritativeShotFraming)
            currentAIImageSourceRevision = nil
            scheduleAutosync()
            throw SyncError.serverMessage(
                "Tegningen ble endret under kildelåsing. Den nyeste versjonen synkes før AI-generering.")
        }
        loadedRevision = snapshot.revision
        reconcileConfirmedSidecars(
            snapshot: snapshot,
            layerState: authoritativeLayerState,
            shotFraming: authoritativeShotFraming)
        if let pending = PendingStrokeStore.loadDocument(frameId: snapshot.frameId),
           FrameSaveRacePolicy.pendingMatches(pending, represents: snapshot),
           PendingStrokeStore.clear(frameId: snapshot.frameId, ifUnchangedFrom: pending) {
            pendingFrameIds.remove(snapshot.frameId)
        }
        board.syncStatus = "AI-kilde synket ✓"
        return AISourceSnapshotAcknowledgement(
            frameUpdatedAt: updatedAt,
            sourceUpdatedAt: sourceUpdatedAt,
            sourceRevision: sourceRevision,
            strokesJSON: authoritativeStrokesJSON,
            layerState: authoritativeLayerState,
            shotFraming: authoritativeShotFraming,
            paintoverState: paintoverState)
    }

    // MARK: Topbar

    @ViewBuilder
    private func topbar(compactWorkspace: Bool) -> some View {
        if compactWorkspace {
            compactTopbar
        } else {
            fullTopbar
        }
    }

    private var compactTopbar: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 8)
                .fill(LinearGradient(
                    colors: [BoardBrand.accent, Color(red: 0.388, green: 0.4, blue: 0.945)],
                    startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 32, height: 32)
                .overlay(Image(systemName: "rectangle.grid.2x2")
                    .font(.system(size: 15)).foregroundStyle(.white))
            Text(board.manuscript.title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)
            if let scene = board.scene {
                Menu {
                    ForEach(Array(board.scenes.enumerated()), id: \.element.id) { index, entry in
                        Button(entry.heading) { board.selectedSceneIndex = index }
                    }
                } label: {
                    Text("S\(board.selectedSceneIndex + 1) · \(scene.heading)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(BoardBrand.dim)
                        .lineLimit(1)
                        .frame(maxWidth: 180)
                }
            }
            Spacer(minLength: 4)
            Menu {
                Button("Script") { showScript = true }
                Button("Shot List") { showShotList = true }
                Button("Production Health") { showProductionDashboard = true }
                Button("Review") { showReview = true }
                Button("Animatic") { showAnimatic = true }
                Divider()
                Button("Eksporter") { exportPDF(includeUnderlay: false) }
            } label: {
                Image(systemName: "rectangle.grid.1x2")
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Arbeidsflater")
            Button {
                showInspectorSheet = true
            } label: {
                Image(systemName: "sidebar.right")
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Åpne Inspector")
            .accessibilityIdentifier("open-adaptive-inspector")
            HStack(spacing: 0) {
                Button { canvasState.undo() } label: {
                    Image(systemName: "arrow.uturn.backward").frame(width: 40, height: 44)
                }
                .disabled(canvasState.undoStack.isEmpty)
                .accessibilityLabel("Angre")
                Button { canvasState.redo() } label: {
                    Image(systemName: "arrow.uturn.forward").frame(width: 40, height: 44)
                }
                .disabled(canvasState.redoStack.isEmpty)
                .accessibilityLabel("Gjenta")
            }
            Button { syncActiveFrameStrokes() } label: {
                Image(systemName: "icloud.and.arrow.up")
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(BoardBrand.accent, in: RoundedRectangle(cornerRadius: 9))
            }
            .accessibilityLabel("Synk")
            Button { dismiss() } label: {
                Image(systemName: "xmark").frame(width: 44, height: 44)
            }
            .accessibilityLabel("Lukk board")
        }
        .buttonStyle(.plain)
        .foregroundStyle(BoardBrand.dim)
        .padding(.horizontal, 10)
        .frame(height: 52)
    }

    private var fullTopbar: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 8)
                .fill(LinearGradient(colors: [BoardBrand.accent, Color(red: 0.388, green: 0.4, blue: 0.945)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 32, height: 32)
                .overlay(Image(systemName: "rectangle.grid.2x2").font(.system(size: 15)).foregroundStyle(.white))
            Text("PROJECT").font(.system(size: 10.5, weight: .bold)).kerning(1).foregroundStyle(BoardBrand.label)
            Text(board.manuscript.title).font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
            if let scene = board.scene {
                Text("SEQ.").font(.system(size: 10.5, weight: .bold)).kerning(1).foregroundStyle(BoardBrand.label)
                Menu {
                    ForEach(Array(board.scenes.enumerated()), id: \.element.id) { index, sceneEntry in
                        Button(sceneEntry.heading) { board.selectedSceneIndex = index }
                    }
                } label: {
                    Text("\(String(format: "%02d", board.selectedSceneIndex + 1)) \(scene.heading) ▾")
                        .font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                }
            }
            Spacer()
            // Fanerad (mockup): Board aktiv · Shot List · Animatic.
            HStack(spacing: 4) {
                topTab("Board", icon: "rectangle.grid.2x2", active: true) {}
                topTab("Script", icon: "doc.text", active: false) { showScript = true }
                topTab("Shot List", icon: "list.bullet", active: false) { showShotList = true }
                topTab("Health", icon: "waveform.path.ecg", active: false) {
                    showProductionDashboard = true
                }
                topTab("Review", icon: "checkmark.bubble", active: false) { showReview = true }
                topTab("Animatic", icon: "play.rectangle", active: false) { showAnimatic = true }
            }
            Spacer()
            if !pendingFrameIds.isEmpty {
                Button { flushAllPending() } label: {
                    Label("\(pendingFrameIds.count) usynket — synk nå",
                          systemImage: "arrow.triangle.2.circlepath")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.orange)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Synk nå")
            }
            if !presentOthers.isEmpty {
                Label(presentOthers.joined(separator: ", "), systemImage: "eye")
                    .font(.system(size: 11))
                    .foregroundStyle(BoardBrand.accent)
                    .lineLimit(1)
                    .accessibilityLabel("Andre aktive: \(presentOthers.joined(separator: ", "))")
            }
            if board.sceneDeleteUndoAvailable {
                Button { board.undoSceneDelete() } label: {
                    Text("Angre sletting")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(BoardBrand.accent, in: Capsule())
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 2) {
                Button { canvasState.undo() } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .frame(width: 44, height: 44)
                }
                .disabled(canvasState.undoStack.isEmpty)
                .accessibilityLabel("Angre")
                .accessibilityHint("To fingre på tegneflaten eller Kommando-Z")
                .keyboardShortcut("z", modifiers: .command)

                Button { canvasState.redo() } label: {
                    Image(systemName: "arrow.uturn.forward")
                        .frame(width: 44, height: 44)
                }
                .disabled(canvasState.redoStack.isEmpty)
                .accessibilityLabel("Gjenta")
                .accessibilityHint("Tre fingre på tegneflaten eller Skift-Kommando-Z")
                .keyboardShortcut("z", modifiers: [.command, .shift])
            }
            .buttonStyle(.plain)
            .foregroundStyle(.white)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 7))
            if let status = board.syncStatus {
                Text(status).font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
                if status.localizedCaseInsensitiveContains("token") {
                    // Token utløp midt i økta — re-auth uten å miste tegningen.
                    Button {
                        showReauth = true
                    } label: {
                        Text("Logg inn")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.red.opacity(0.8), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            Button {
                toneReport = renderer?.toneReport()
                heroReport = renderer?.heroAnalysis()
                showToneReport = true
            } label: {
                Image(systemName: "chart.bar")
                    .font(.system(size: 15)).foregroundStyle(BoardBrand.dim)
            }
            .accessibilityLabel("Tone-analyse")
            if let progress = pdfExportProgress {
                Text("Eksporterer \(progress)")
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(BoardBrand.dim)
            }
            Menu {
                Button {
                    exportPDF(includeUnderlay: false)
                } label: {
                    Label("PDF", systemImage: "doc.richtext")
                }
                Button {
                    exportPDF(includeUnderlay: true)
                } label: {
                    Label("PDF med underlag", systemImage: "photo.on.rectangle")
                }
                Button {
                    presentationConceptDraft = board.scenes.first?.presentationConcept ?? ""
                    presentationFooterDraft = PresentationFooter.decode(
                        board.scenes.first?.presentationFooter)
                    showPresentationSetup = true
                } label: {
                    Label("Presentasjonsoppsett…", systemImage: "text.badge.checkmark")
                }
                Button {
                    pdfExportProgress = "…"
                    let scenes = effectiveScenesForRendering()
                    Task {
                        let result = await BoardPDFExporter.exportPresentation(
                            projectTitle: board.manuscript.title, scenes: scenes,
                            progress: { done, total in pdfExportProgress = "\(done)/\(total)" })
                        if let result {
                            exportPDFURL = result
                        } else {
                            pdfExportFailed = true
                        }
                        pdfExportProgress = nil
                    }
                } label: {
                    Label("Presentasjon (PDF)", systemImage: "rectangle.grid.3x2")
                }
                Button {
                    let scenes = effectiveScenesForRendering()
                    exportPDFURL = BoardPDFExporter.exportCSV(
                        projectTitle: board.manuscript.title, scenes: scenes)
                } label: {
                    Label("Shot-liste (CSV)", systemImage: "tablecells")
                }
            } label: {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 16)).foregroundStyle(BoardBrand.dim)
                    .frame(width: 44, height: 44)
            }
            .disabled(board.scenes.isEmpty || pdfExportProgress != nil)
            .accessibilityLabel("Eksporter PDF")
            Button {
                isInspectorDockVisible.toggle()
            } label: {
                Image(systemName: isInspectorDockVisible
                      ? "sidebar.trailing" : "sidebar.trailing")
                    .symbolVariant(isInspectorDockVisible ? .fill : .none)
                    .font(.system(size: 16))
                    .foregroundStyle(isInspectorDockVisible ? BoardBrand.accent : BoardBrand.dim)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isInspectorDockVisible ? "Skjul Inspector" : "Vis Inspector")
            .accessibilityIdentifier("toggle-docked-inspector")
            .keyboardShortcut("i", modifiers: [.command, .option])
            Button { syncActiveFrameStrokes() } label: {
                Label("Synk", systemImage: "icloud.and.arrow.up")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(BoardBrand.accent, in: RoundedRectangle(cornerRadius: 9))
                    .frame(minHeight: 44)
            }
            Button { dismiss() } label: {
                Image(systemName: "xmark").foregroundStyle(BoardBrand.dim)
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 52)
    }

    private func topTab(_ title: String, icon: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(active ? .white : BoardBrand.dim)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(active ? Color.white.opacity(0.1) : .clear,
                            in: RoundedRectangle(cornerRadius: 8))
                .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
    }

    /// Fingerprinten gjør at SwiftUI avbryter gammel preview-lasting når
    /// scene-/frame-data byttes av live-synk.
    private var scenePreviewTaskKey: String {
        board.scenes.map { scene in
            guard let frame = StoryboardPreviewPolicy.representativeFrame(in: scene.frames) else {
                return scene.id
            }
            let thumbnailKey = frame.thumbnailDataURL.map {
                "\($0.count):\($0.prefix(24))"
            } ?? ""
            return [scene.id, frame.id, frame.updatedAt ?? "",
                    frame.imageUrl ?? "", thumbnailKey,
                    framingPreviewKey(frame.shotFraming),
                    frame.id == board.frame?.id ? String(canvasState.revision) : "",
                    pendingFrameIds.contains(frame.id) ? "pending" : ""
            ].joined(separator: "|")
        }.joined(separator: ";")
    }

    /// One authoritative render snapshot for previews, AI-adjacent exports
    /// and animatics. The server summary can lag the active canvas by the
    /// autosave debounce, and inactive shots can still have a durable WAL.
    /// Rendering must never make that lag visible to the artist.
    private func effectiveFrameForRendering(_ frame: FrameSummary) -> FrameSummary {
        var effective = frame
        if loadedFrameRef?.frameId == frame.id,
           let liveJSON = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes) {
            effective.strokesJSON = liveJSON
            effective.layerState = canvasState.layerState
            effective.shotFraming = canvasState.shotFraming
            effective.shotType = canvasState.shotFraming.shotSize ?? effective.shotType
            effective.angle = canvasState.shotFraming.angle ?? effective.angle
            effective.lensMm = canvasState.shotFraming.lensMm ?? effective.lensMm
            let changes = activePaintoverChanges()
            if changes.pencilChanged || changes.colorChanged
                || changes.atmosphereChanged {
                // Derived render snapshot only. The acknowledged baseline is
                // untouched until PATCH returns its server-owned state.
                effective.aiPaintoverState?.videoStale = true
            }
            return effective
        }
        if pendingFrameIds.contains(frame.id),
           let pending = PendingStrokeStore.loadDocument(frameId: frame.id) {
            effective.strokesJSON = pending.strokesJSON
            effective.layerState = pending.layerState
            effective.shotFraming = pending.shotFraming
            effective.shotType = pending.shotFraming?.shotSize ?? effective.shotType
            effective.angle = pending.shotFraming?.angle ?? effective.angle
            effective.lensMm = pending.shotFraming?.lensMm ?? effective.lensMm
        }
        return effective
    }

    private func effectiveFramesForRendering(
        _ frames: [FrameSummary]
    ) -> [FrameSummary] {
        frames.map(effectiveFrameForRendering)
    }

    private func effectiveScenesForRendering() -> [SceneSummary] {
        board.scenes.map { scene in
            var effective = scene
            effective.frames = effectiveFramesForRendering(scene.frames)
            return effective
        }
    }

    /// Scene-listen viser et faktisk kompositt (original + strøk) når det
    /// finnes. Gamle/blanke thumbnailUrl-data brukes bare som siste fallback.
    private func rebuildSceneThumbnails() async {
        do {
            try await Task.sleep(nanoseconds: 220_000_000)
        } catch {
            return
        }
        let scenes = effectiveScenesForRendering()
        let representatives = scenes.compactMap {
            StoryboardPreviewPolicy.representativeFrame(in: $0.frames)
        }
        await FrameImageCache.prefetchPreviewSources(frames: representatives)
        guard !Task.isCancelled else { return }

        let activeSceneIds = Set(scenes.map(\.id))
        var nextImages = sceneThumbnailImages.filter { activeSceneIds.contains($0.key) }
        var nextKeys = scenePreviewRenderKeys.filter { activeSceneIds.contains($0.key) }
        for scene in scenes {
            guard let frame = StoryboardPreviewPolicy.representativeFrame(in: scene.frames) else {
                nextImages.removeValue(forKey: scene.id)
                nextKeys.removeValue(forKey: scene.id)
                continue
            }
            guard !Task.isCancelled else { return }
            let key = previewRenderKey(frame)
            if nextKeys[scene.id] == key, nextImages[scene.id] != nil { continue }
            let directFallback = safeDirectRasterFallback(for: frame)
            if let image = FrameRenderCoordinator.image(for: frame, maxWidth: 248)
                ?? directFallback {
                nextImages[scene.id] = image
                nextKeys[scene.id] = key
            } else {
                nextImages.removeValue(forKey: scene.id)
                nextKeys[scene.id] = key
            }
        }
        guard !Task.isCancelled else { return }
        sceneThumbnailImages = nextImages
        scenePreviewRenderKeys = nextKeys
    }

    private func scenePreviewFallbackImage(for scene: SceneSummary) -> UIImage? {
        guard let frame = StoryboardPreviewPolicy.representativeFrame(in: scene.frames) else {
            return nil
        }
        return safeDirectRasterFallback(for: frame)
    }

    /// Alle shot-rader i valgt scene får en fulloppløselig preview. Dette er
    /// separat fra 280 px thumbnailDataURL, som kun er en rask placeholder.
    private var shotPreviewTaskKey: String {
        guard let scene = board.scene else { return "none" }
        let frameKeys = scene.frames.map { frame in
            [frame.id, frame.updatedAt ?? "", frame.imageUrl ?? "",
             String(frame.strokesJSON?.count ?? 0),
             framingPreviewKey(frame.shotFraming),
             frame.id == board.frame?.id ? String(canvasState.revision) : "",
             pendingFrameIds.contains(frame.id) ? "pending" : ""
            ].joined(separator: "|")
        }
        return ([scene.id] + frameKeys).joined(separator: ";")
    }

    private func framingPreviewKey(_ state: ShotFramingState?) -> String {
        guard let state else { return "framing:none" }
        return [
            String(state.revision), String(format: "%.5f", state.centerX),
            String(format: "%.5f", state.centerY), String(format: "%.5f", state.zoom),
            String(format: "%.3f", state.rollDegrees), state.shotSize ?? "",
            state.angle ?? "", state.lensMm.map(String.init) ?? "",
        ].joined(separator: ":")
    }

    private func previewRenderKey(_ frame: FrameSummary) -> String {
        [
            frame.id,
            frame.updatedAt ?? "",
            frame.imageUrl ?? "",
            String(frame.aiSourceRevision ?? -1),
            frame.aiOutputStale
                ? (frame.aiOutputStaleReason ?? "stale") : "current",
            String(frame.strokesJSON?.hashValue ?? 0),
            framingPreviewKey(frame.shotFraming),
            frame.id == loadedFrameRef?.frameId ? String(canvasState.revision) : "",
            pendingFrameIds.contains(frame.id) ? "pending" : "",
        ].joined(separator: "|")
    }

    private func rebuildShotPreviews() async {
        guard let scene = board.scene else {
            shotPreviewImages = [:]
            shotPreviewRenderKeys = [:]
            return
        }
        // Pencil can publish several revisions per second. Let SwiftUI cancel
        // superseded tasks so only the settled revision reaches GPU readback.
        do {
            try await Task.sleep(nanoseconds: 140_000_000)
        } catch {
            return
        }
        let sceneId = scene.id
        let frames = effectiveFramesForRendering(scene.frames)
        await FrameImageCache.prefetch(frames: frames)
        guard !Task.isCancelled, board.scene?.id == sceneId else { return }

        let activeFrameIds = Set(frames.map(\.id))
        var nextImages = shotPreviewImages.filter { activeFrameIds.contains($0.key) }
        var nextKeys = shotPreviewRenderKeys.filter { activeFrameIds.contains($0.key) }
        for frame in frames {
            guard !Task.isCancelled else { return }
            let key = previewRenderKey(frame)
            if nextKeys[frame.id] == key, nextImages[frame.id] != nil { continue }
            // This is a UI preview, never the export source. 960 px remains
            // crisp on the iPad shot strip while avoiding 1280–1920 px
            // scene-wide Metal rebuilds after every Pencil gesture.
            let previewWidth = min(960, max(640, CGFloat(frame.drawingWidth)))
            let directFallback = safeDirectRasterFallback(for: frame)
            if let image = FrameRenderCoordinator.image(for: frame, maxWidth: previewWidth)
                ?? directFallback {
                nextImages[frame.id] = image
                nextKeys[frame.id] = key
            } else {
                nextImages.removeValue(forKey: frame.id)
                nextKeys[frame.id] = key
            }
        }
        guard !Task.isCancelled, board.scene?.id == sceneId else { return }
        shotPreviewImages = nextImages
        shotPreviewRenderKeys = nextKeys
    }

    private func fullResolutionRaster(for frame: FrameSummary) -> UIImage? {
        exactFrameRaster(for: frame)
    }

    @ViewBuilder
    private func inactiveShotPreview(frame: FrameSummary) -> some View {
        if let image = shotPreviewImages[frame.id]
            ?? safeDirectRasterFallback(for: frame) {
            Image(uiImage: image).resizable().interpolation(.high).scaledToFill()
        } else {
            Color(white: 0.925)
            Text(frame.imageUrl == nil ? "Trykk for å tegne" : "Laster original …")
                .font(.system(size: 11)).foregroundStyle(Color(white: 0.6))
        }
    }

    // MARK: SCENES

    private var scenesColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                panelLabel("Scenes")
                Spacer()
                Button { showNewScenePrompt = true } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(BoardBrand.dim)
                }
                .accessibilityLabel("Ny scene")
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(Array(board.scenes.enumerated()), id: \.element.id) { index, scene in
                        let selected = index == board.selectedSceneIndex
                        Button { board.selectedSceneIndex = index } label: {
                            HStack(spacing: 10) {
                                Group {
                                    if let image = sceneThumbnailImages[scene.id]
                                        ?? scenePreviewFallbackImage(for: scene) {
                                        ZStack {
                                            Color.black.opacity(0.22)
                                            Image(uiImage: image)
                                                .resizable()
                                                .interpolation(.high)
                                                .scaledToFit()
                                        }
                                    } else {
                                        ZStack {
                                            Color.white.opacity(0.06)
                                            ProgressView().controlSize(.mini).tint(BoardBrand.dim)
                                        }
                                    }
                                }
                                .frame(width: 62, height: 40)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                .accessibilityElement(children: .ignore)
                                .accessibilityIdentifier("scene-thumbnail-\(scene.id)")
                                .accessibilityLabel("Scene-thumbnail \(index + 1)")
                                .accessibilityValue(sceneThumbnailImages[scene.id] == nil ? "loading" : "loaded")
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(String(format: "%02d", index + 1))
                                        .font(.system(size: 10, weight: .bold)).foregroundStyle(BoardBrand.label)
                                    Text(scene.heading)
                                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                                        .lineLimit(1)
                                    Text("\(scene.frames.count) \(scene.frames.count == 1 ? "SHOT" : "SHOTS")")
                                        .font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(8)
                            .background(selected ? BoardBrand.accent.opacity(0.16) : Color.white.opacity(0.02),
                                        in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10)
                                .stroke(selected ? BoardBrand.accent : BoardBrand.border, lineWidth: selected ? 1.5 : 1))
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button {
                                renameSceneId = scene.id
                                renameSceneDraft = scene.heading
                            } label: { Label("Omdøp", systemImage: "pencil") }
                            Button {
                                board.duplicateScene(sceneId: scene.id)
                            } label: { Label("Dupliser", systemImage: "plus.square.on.square") }
                            Button {
                                board.selectedSceneIndex = index
                                showSheetImportDialog = true
                            } label: { Label("Importer ark…", systemImage: "square.grid.3x3.square") }
                            Button {
                                board.renumberShots()
                            } label: { Label("Renummerer shots", systemImage: "textformat.123") }
                            Button(role: .destructive) {
                                pendingDeleteSceneId = scene.id
                            } label: { Label("Slett scene", systemImage: "trash") }
                        }
                    }
                }
                .padding(.horizontal, 12)
            }
        }
        .frame(width: 230)
        .background(BoardBrand.chrome)
    }

    // MARK: Arket

    private var toolRow: some View {
        HStack(spacing: 6) {
            ForEach([BoardTool.select, .draw, .eraser], id: \.self) { tool in toolButton(tool) }
            Rectangle().fill(BoardBrand.border).frame(width: 1, height: 20).padding(.horizontal, 4)
            ForEach([BoardTool.arrow, .rect, .text], id: \.self) { tool in toolButton(tool) }
            Rectangle().fill(BoardBrand.border).frame(width: 1, height: 20).padding(.horizontal, 4)
            // Onion-skin: nabo-shots bak aktiv frame
            Menu {
                Picker("Onion-skin", selection: $onionMode) {
                    Text("Av").tag(0)
                    Text("Forrige shot").tag(1)
                    Text("Forrige + neste").tag(2)
                    Text("To tilbake").tag(3)
                }
            } label: {
                Image(systemName: "square.2.layers.3d.bottom.filled")
                    .font(.system(size: 14))
                    .foregroundStyle(onionMode > 0 ? .white : BoardBrand.dim)
                    .frame(width: 34, height: 30)
                    .background(onionMode > 0 ? BoardBrand.accent : Color.white.opacity(0.05),
                                in: RoundedRectangle(cornerRadius: 7))
            }
            .accessibilityLabel("Onion-skin")
            // Perspektiv-hjelpelinjer
            Menu {
                Picker("Perspektiv", selection: $perspectiveMode) {
                    Text("Av").tag(0)
                    Text("1-punkts").tag(1)
                    Text("2-punkts").tag(2)
                    Text("3-punkts").tag(3)
                    Text("Isometrisk").tag(4)
                    Text("Fisheye").tag(5)
                }
                if (1...3).contains(perspectiveMode) {
                    Toggle("Snap strøk til VP", isOn: $perspectiveSnap)
                }
            } label: {
                Image(systemName: "road.lanes.curved.right")
                    .font(.system(size: 14))
                    .foregroundStyle(perspectiveMode > 0 ? .white : BoardBrand.dim)
                    .frame(width: 34, height: 30)
                    .background(perspectiveMode > 0 ? BoardBrand.accent : Color.white.opacity(0.05),
                                in: RoundedRectangle(cornerRadius: 7))
            }
            .accessibilityLabel("Perspektiv")
            Spacer()
            Button { board.addShot() } label: {
                Label("Add shot", systemImage: "plus")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Color.black, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 8)
        .background(BoardBrand.panel)
    }

    private func toolButton(_ tool: BoardTool) -> some View {
        let selected = boardTool == tool
        return Button {
            boardTool = tool
            // Tegn/viskelær speiles i pensel-valget (samme kobling som web).
            if tool == .eraser { canvasState.selectBrush(.eraser) }
            if tool == .draw,
               [.eraser, .kneaded, .lightlift].contains(canvasState.brushType) {
                canvasState.selectBrush(.pencil)
            }
        } label: {
            Image(systemName: tool.icon)
                .font(.system(size: 14))
                .foregroundStyle(selected ? .white : BoardBrand.dim)
                .frame(width: 34, height: 30)
                .background(selected ? BoardBrand.accent : Color.white.opacity(0.05),
                            in: RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tool.label)
        .help(tool.label)
    }

    private var sheetArea: some View {
        VStack(spacing: 0) {
            toolRow
            Divider().overlay(BoardBrand.border)
            beatTimeline
            sheetScroll
        }
        .alert("Annotasjonstekst", isPresented: $textPromptShown) {
            TextField("f.eks. PUSH IN", text: $textPromptValue)
            Button("Tekst") { commitTextAnnotation(style: nil) }
            Button("Post-it") { commitTextAnnotation(style: "note") }
            Button("Snakkeboble") { commitTextAnnotation(style: "bubble") }
            Button("Avbryt", role: .cancel) { textPromptValue = "" }
        }
        .sheet(isPresented: $showShotList) {
            ShotListSheet(sceneHeading: board.scene?.heading ?? "",
                          frames: board.scene?.frames ?? [])
        }
        .sheet(isPresented: $showScript) {
            ScriptSheet(scenes: board.scenes, activeIndex: board.selectedSceneIndex)
        }
        .fullScreenCover(isPresented: $showReview) {
            // Den ekte Review-flaten (samme som hubben) — den gamle enkle
            // ReviewSheet er pensjonert.
            NavigationStack {
                ReviewView(project: ProjectSummary(id: board.projectId ?? "",
                                                   name: board.manuscript.title),
                           manuscript: board.manuscript)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Board") {
                                showReview = false
                                Task { await board.reload() }
                            }
                        }
                    }
            }
        }
        .sheet(isPresented: $showBrushEditor) {
            BrushEditorSheet(canvasState: canvasState)
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showPromptInspector) {
            PromptInspectorSheet(compilation: promptCompilation, status: aiStatus)
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showInspectorSheet) {
            NavigationStack {
                inspectorPanel(isOverlay: true)
                    .navigationTitle("Inspector")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Ferdig") {
                                flushInspectorDrafts()
                                showInspectorSheet = false
                            }
                        }
                    }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showAIVersionBrowser) {
            AIStageVersionBrowser(
                versions: imageStageVersions,
                currentFramingFingerprint: canvasState.shotFraming.canonicalFingerprint
            ) { version in
                Task { await approveImageStageVersion(version) }
            }
        }
        .sheet(item: $pendingImageStageVersion) { version in
            AIImageStagePreviewSheet(
                version: version,
                sourceImage: imageStageVersions.first(where: {
                    $0.id == version.parentVersionId
                }).flatMap { decodeDataURL($0.imageData) },
                resultImage: decodeDataURL(version.imageData),
                onCancel: {
                    pendingImageStageVersion = nil
                    aiStatus = "Kandidat beholdt uten godkjenning"
                },
                onRegenerate: {
                    pendingImageStageVersion = nil
                    pendingImageStageGeneration = version.stage
                },
                onApprove: {
                    pendingImageStageVersion = nil
                    Task { await approveImageStageVersion(version) }
                })
            .interactiveDismissDisabled()
        }
        .sheet(item: $animationPreflight) { preflight in
            AnimationPreflightSheet(
                preflight: preflight,
                sourceImage: animationPreflightSourceImage,
                sourceStage: approvedAnimationStageLabel,
                onCancel: {
                    animationPreflight = nil
                    animationPreflightSourceImage = nil
                    animationPreflightComposite = nil
                    animationPreflightSession = nil
                    aiStatus = "Animasjon avbrutt før kostnad"
                },
                onConfirm: {
                    let composite = animationPreflightComposite
                    animationPreflight = nil
                    animationPreflightSourceImage = nil
                    Task { await animateActiveStoryboard(
                        checkConsent: false,
                        confirmedPreflight: preflight,
                        confirmedPaintoverComposite: composite) }
                })
            .interactiveDismissDisabled()
        }
        .sheet(isPresented: Binding(
            get: { stampInspectorStrokeID != nil },
            set: { if !$0 { stampInspectorStrokeID = nil } }
        )) {
            if let stampInspectorStrokeID {
                PlacedStampInspectorSheet(
                    canvasState: canvasState, strokeID: stampInspectorStrokeID)
                    .presentationDetents([.medium, .large])
            }
        }
        .sheet(isPresented: $showToneReport) {
            ToneReportSheet(report: toneReport, hero: heroReport)
                .presentationDetents([.medium])
        }
        .confirmationDialog(
            pendingImageStageGeneration == "atmosphere"
                ? "Generer AI Atmosphere?" : "Generer AI Color?",
            isPresented: Binding(
                get: { pendingImageStageGeneration != nil },
                set: { if !$0 { pendingImageStageGeneration = nil } }
            ), titleVisibility: .visible
        ) {
            Button("Generer med GPT Image 2 · HD") {
                guard let stage = pendingImageStageGeneration else { return }
                pendingImageStageGeneration = nil
                Task { await generateImageStage(stage: stage) }
            }
            Button("Avbryt", role: .cancel) { pendingImageStageGeneration = nil }
        } message: {
            Text("Dette oppretter en ny kandidat og bruker AI-kreditter. Originaltegningen blir ikke overskrevet.")
        }
        .alert("Tillat AI for prosjektet?", isPresented: $showAIConsentPrompt) {
            Button(pendingAIConsentAction == "animate"
                   ? "Tillat og animer" : "Tillat og generer") {
                guard let consentSession = pendingAIConsentSession else { return }
                let action = pendingAIConsentAction
                pendingAIConsentSession = nil
                Task {
                    do {
                        try await RoleRoomAPIClient.shared.setProjectAIConsent(
                            projectId: consentSession.projectId, consented: true)
                        guard isCurrentAIFrameSession(consentSession) else { return }
                        if action == "animate" {
                            await animateActiveStoryboard(checkConsent: false)
                        } else {
                            await generateImageStage(
                                stage: action, checkConsent: false)
                        }
                    } catch {
                        if isCurrentAIFrameSession(consentSession) {
                            aiStatus = error.localizedDescription
                        }
                    }
                }
            }
            Button("Avbryt", role: .cancel) { pendingAIConsentSession = nil }
        } message: {
            Text("Produksjonskontekst og eventuelt startbilde sendes til valgt AI-leverandør. Samtykket lagres på prosjektet og kan trekkes tilbake i The Role Room.")
        }
        .sheet(item: $exportPDFURL) { url in
            ShareSheet(items: [url])
        }
        .alert("Eksport stoppet", isPresented: $pdfExportFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(
                "Minst ett panel har deklarert innhold som ikke lenger kan "
                + "knyttes til riktig kilde, revisjon eller kamera. Last inn "
                + "originalen på nytt eller regenerer panelet før eksport.")
        }
        .sheet(isPresented: $showReauth) {
            NavigationStack { LoginView(sync: reauthSync) }
        }
        .sheet(isPresented: Binding(get: { imageImportFrameId != nil },
                                    set: { if !$0 { imageImportFrameId = nil } })) {
            NavigationStack {
                VStack(spacing: 20) {
                    Text("Bildet blir panelets innhold — det vises i boardet, kan tegnes over, og følger med i PDF/PNG/animatic.")
                        .font(.subheadline).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center).padding(.horizontal)
                    PhotosPicker(selection: $frameImagePickerItem, matching: .images) {
                        Label("Velg bilde", systemImage: "photo.badge.plus")
                            .font(.headline)
                            .padding(.horizontal, 20).padding(.vertical, 12)
                            .background(BoardBrand.accent, in: Capsule())
                            .foregroundStyle(.white)
                    }
                    if board.scene?.frames.first(where: { $0.id == imageImportFrameId })?.imageUrl != nil {
                        Button("Fjern eksisterende bilde", role: .destructive) {
                            if let frameId = imageImportFrameId {
                                board.patchFrame(frameId: frameId,
                                                 fields: ["imageUrl": NSNull(), "imageSource": NSNull()])
                            }
                            imageImportFrameId = nil
                        }
                    }
                }
                .navigationTitle("Bilde-frame")
                .toolbar { ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { imageImportFrameId = nil }
                } }
            }
            .presentationDetents([.medium])
        }
        .onChange(of: frameImagePickerItem) {
            guard let item = frameImagePickerItem, let frameId = imageImportFrameId else { return }
            frameImagePickerItem = nil
            imageImportFrameId = nil
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data),
                      let dataURL = Self.jpegDataURL(image, maxSide: 1600, quality: 0.75) else { return }
                // B2 først (holder scene-payloaden slank); dataURL kun som
                // fallback når lagring ikke er konfigurert/offline.
                let scene = board.scene
                let shot = scene?.frames.first(where: { $0.id == frameId })?.shotNumber ?? frameId
                let imageUrl = await Self.uploadOrInline(
                    dataURL: dataURL,
                    name: "\(board.manuscript.title) - \(scene?.heading ?? "scene") - \(shot).jpg",
                    board: board,
                    sceneId: scene?.id,
                    entityType: "storyboard_frame",
                    entityId: frameId,
                    note: "Panel-bilde importert fra Storyboard Studio")
                board.patchFrame(frameId: frameId,
                                 fields: ["imageUrl": imageUrl, "imageSource": "imported"])
                if board.frame?.id == frameId { loadActiveFrameIntoCanvas() }
            }
        }
        .sheet(isPresented: $showSheetImportDialog) {
            NavigationStack {
                VStack(spacing: 18) {
                    Text("Importer et helt storyboard-ark: bildet splittes i et rutenett og hver rute blir et panel i scenen.")
                        .font(.subheadline).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center).padding(.horizontal)
                    Picker("Rutenett", selection: Binding(
                        get: { "\(sheetImportGrid.columns)x\(sheetImportGrid.rows)" },
                        set: { value in
                            let parts = value.split(separator: "x").compactMap { Int($0) }
                            if parts.count == 2 { sheetImportGrid = (parts[0], parts[1]) }
                        })) {
                        Text("2 × 2").tag("2x2")
                        Text("3 × 2").tag("3x2")
                        Text("4 × 3").tag("4x3")
                        Text("3 × 4").tag("3x4")
                    }
                    .pickerStyle(.segmented).padding(.horizontal)
                    PhotosPicker(selection: $sheetImportPickerItem, matching: .images) {
                        Label("Velg ark", systemImage: "square.grid.3x3.square")
                            .font(.headline)
                            .padding(.horizontal, 20).padding(.vertical, 12)
                            .background(BoardBrand.accent, in: Capsule())
                            .foregroundStyle(.white)
                    }
                }
                .navigationTitle("Importer ark")
                .toolbar { ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { showSheetImportDialog = false }
                } }
            }
            .presentationDetents([.medium])
        }
        .onChange(of: sheetImportPickerItem) {
            guard let item = sheetImportPickerItem else { return }
            sheetImportPickerItem = nil
            showSheetImportDialog = false
            let grid = sheetImportGrid
            guard let scene = board.scene else { return }
            let manuscriptId = board.manuscript.id
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data), let cg = image.cgImage else { return }
                var panels: [String] = []
                let cellWidth = cg.width / grid.columns
                let cellHeight = cg.height / grid.rows
                for row in 0..<grid.rows {
                    for col in 0..<grid.columns {
                        guard let cell = cg.cropping(to: CGRect(
                            x: col * cellWidth, y: row * cellHeight,
                            width: cellWidth, height: cellHeight)) else { continue }
                        if let dataURL = Self.jpegDataURL(UIImage(cgImage: cell),
                                                          maxSide: 1200, quality: 0.72) {
                            panels.append(dataURL)
                        }
                    }
                }
                guard !panels.isEmpty else { return }
                board.syncStatus = "Importerer \(panels.count) paneler…"
                var panelURLs: [String] = []
                for (index, dataURL) in panels.enumerated() {
                    board.syncStatus = "Laster opp panel \(index + 1)/\(panels.count)…"
                    panelURLs.append(await Self.uploadOrInline(
                        dataURL: dataURL,
                        name: "\(board.manuscript.title) - \(scene.heading) - ark \(index + 1).jpg",
                        board: board,
                        sceneId: scene.id,
                        entityType: "storyboard_scene",
                        entityId: scene.id,
                        note: "Ark-import (\(grid.columns)×\(grid.rows)) fra Storyboard Studio"))
                }
                do {
                    try await RoleRoomAPIClient.shared.importImageFrames(
                        manuscriptId: manuscriptId, sceneId: scene.id, imageURLs: panelURLs)
                    await board.reload()
                    board.syncStatus = "\(panels.count) paneler importert ✓"
                } catch {
                    board.syncStatus = error.localizedDescription
                }
            }
        }
        .sheet(isPresented: $showPresentationSetup) {
            NavigationStack {
                Form {
                    Section("Konsept-linje (under tittelen)") {
                        TextField("f.eks. En som tar helse på alvor …",
                                  text: $presentationConceptDraft, axis: .vertical)
                            .lineLimit(2...3)
                    }
                    ForEach($presentationFooterDraft) { $section in
                        Section {
                            TextField("Tittel", text: $section.title)
                                .font(.headline)
                            TextField("Ett punkt per linje", text: $section.itemsText, axis: .vertical)
                                .lineLimit(3...6)
                        }
                    }
                }
                .navigationTitle("Presentasjonsoppsett")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Avbryt") { showPresentationSetup = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Lagre") {
                            showPresentationSetup = false
                            let concept = presentationConceptDraft
                            let footer = PresentationFooter.encode(presentationFooterDraft)
                            let manuscriptId = board.manuscript.id
                            Task {
                                try? await RoleRoomAPIClient.shared.setPresentationMeta(
                                    manuscriptId: manuscriptId, concept: concept,
                                    footerJSON: footer)
                                await board.reload()
                                board.syncStatus = "Presentasjonsoppsett lagret ✓"
                            }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showHistorySheet) {
            NavigationStack {
                List {
                    if historyEntries.isEmpty {
                        Text("Ingen tidligere versjoner — historikk lagres fra og med neste tegneendring.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(Array(historyEntries.enumerated()), id: \.offset) { _, entry in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.updatedAt.isEmpty ? "Ukjent tidspunkt" : entry.updatedAt)
                                    .font(.subheadline)
                                let count = (try? StrokeSerialization.decodeFromWebJSON(entry.strokes))?.count ?? 0
                                Text("\(count) strøk").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Gjenopprett") {
                                restoreHistory(entry: entry)
                            }
                            .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                        }
                    }
                }
                .navigationTitle("Tegne-historikk")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Lukk") { showHistorySheet = false }
                    }
                }
            }
        }
        .onChange(of: reauthSync.isLoggedIn) {
            if reauthSync.isLoggedIn {
                showReauth = false
                board.syncStatus = "Innlogget ✓"
                flushAllPending()
            }
        }
        .confirmationDialog("Slette shotet permanent?",
                            isPresented: Binding(get: { pendingDeleteFrameId != nil },
                                                 set: { if !$0 { pendingDeleteFrameId = nil } })) {
            Button("Slett shot", role: .destructive) {
                if let frameId = pendingDeleteFrameId { board.deleteShot(frameId: frameId) }
                pendingDeleteFrameId = nil
            }
        }
        .alert("Ny scene", isPresented: $showNewScenePrompt) {
            TextField("Scenetittel", text: $newSceneTitle)
            Button("Opprett") {
                let title = newSceneTitle.trimmingCharacters(in: .whitespaces)
                newSceneTitle = ""
                if !title.isEmpty { board.addScene(title: title) }
            }
            Button("Avbryt", role: .cancel) { newSceneTitle = "" }
        }
        .alert("Omdøp scene", isPresented: Binding(
            get: { renameSceneId != nil },
            set: { if !$0 { renameSceneId = nil } })) {
            TextField("Scenetittel", text: $renameSceneDraft)
            Button("Lagre") {
                let title = renameSceneDraft.trimmingCharacters(in: .whitespaces)
                if let sceneId = renameSceneId, !title.isEmpty {
                    board.renameScene(sceneId: sceneId, title: title)
                }
                renameSceneId = nil
            }
            Button("Avbryt", role: .cancel) { renameSceneId = nil }
        }
        .confirmationDialog("Slette scenen og alle shots permanent?",
                            isPresented: Binding(get: { pendingDeleteSceneId != nil },
                                                 set: { if !$0 { pendingDeleteSceneId = nil } })) {
            Button("Slett scene", role: .destructive) {
                if let sceneId = pendingDeleteSceneId { board.deleteScene(sceneId: sceneId) }
                pendingDeleteSceneId = nil
            }
        }
    }

    // Beat-timeline (web SceneTimelineStrip): SETUP/TENSION/ACTION/RESOLUTION,
    // segmentbredde ∝ varighet, frames uten beat arver forrige fase.
    private static let beatToPhase: [String: String] = [
        "ESTABLISHING": "SETUP", "TENSION": "TENSION", "BEAT": "TENSION",
        "ACTION": "ACTION", "DIALOGUE": "ACTION", "RESOLUTION": "RESOLUTION",
    ]
    private static let phaseColors: [String: Color] = [
        "SETUP": Color(red: 0.39, green: 0.45, blue: 0.55),
        "TENSION": Color(red: 0.96, green: 0.62, blue: 0.04),
        "ACTION": BoardBrand.accent,
        "RESOLUTION": Color(red: 0.13, green: 0.7, blue: 0.42),
    ]

    private var beatTimeline: some View {
        let frames = board.scene?.frames ?? []
        var phase = "SETUP"
        let entries: [(index: Int, phase: String, weight: Double)] = frames.enumerated().map { index, frame in
            if let beat = frame.beatTag, let mapped = Self.beatToPhase[beat] { phase = mapped }
            return (index, phase, max(0.5, frame.effectiveShotDuration.seconds))
        }
        return HStack(spacing: 2) {
            ForEach(entries, id: \.index) { entry in
                Button { scrollTarget = entry.index } label: {
                    RoundedRectangle(cornerRadius: 2)
                        .fill((Self.phaseColors[entry.phase] ?? .gray)
                            .opacity(entry.index == board.activeFrameIndex ? 1 : 0.45))
                        .frame(height: 6)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .frame(minWidth: 10)
                .layoutPriority(entry.weight)
                .accessibilityLabel("Beat \(entry.phase) shot \(entry.index + 1)")
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 5)
        .background(BoardBrand.panel)
    }

    private var sheetScroll: some View {
        ScrollViewReader { proxy in
            ScrollView {
                sheetContent
            }
            .background(BoardBrand.workspace)
            .onChange(of: scrollTarget) {
                if let target = scrollTarget {
                    withAnimation { proxy.scrollTo(target, anchor: .top) }
                    scrollTarget = nil
                }
            }
        }
    }

    private var sheetContent: some View {
            VStack(alignment: .leading, spacing: 22) {
                ForEach(Array((board.scene?.frames ?? []).enumerated()), id: \.element.id) { index, frame in
                    shotRow(frame: frame, index: index)
                        .id(index)
                        .onDrop(of: [.text], delegate: ShotDropDelegate(
                            targetIndex: index,
                            draggedFrameId: $draggedFrameId,
                            board: board))
                }
            }
            .padding(28)
            .background(BoardBrand.sheet, in: RoundedRectangle(cornerRadius: 4))
            .shadow(color: .black.opacity(0.4), radius: 22, y: 8)
            .padding(.vertical, 24)
            .frame(maxWidth: 900 * sheetZoom)
            .frame(maxWidth: .infinity)
    }

    private func shotRow(frame: FrameSummary, index: Int) -> some View {
        let isActive = index == board.activeFrameIndex
        return HStack(alignment: .top, spacing: 18) {
            // Venstre: kode + ACTION/DIALOG + NOTES
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    // Shot-meny: dupliser/flytt/slett (mockupens «…»)
                    Menu {
                        Button { board.duplicateShot(frameId: frame.id) } label: {
                            Label("Dupliser", systemImage: "plus.square.on.square")
                        }
                        Button { board.moveShot(frameId: frame.id, offset: -1) } label: {
                            Label("Flytt opp", systemImage: "arrow.up")
                        }
                        .disabled(index == 0)
                        Button { board.moveShot(frameId: frame.id, offset: 1) } label: {
                            Label("Flytt ned", systemImage: "arrow.down")
                        }
                        .disabled(index == (board.scene?.frames.count ?? 1) - 1)
                        Button {
                            exportPDFURL = FrameRenderService.exportPNG(
                                frame: effectiveFrameForRendering(frame),
                                projectTitle: board.manuscript.title)
                        } label: {
                            Label("Eksporter PNG", systemImage: "photo")
                        }
                        Button {
                            imageImportFrameId = frame.id
                        } label: {
                            Label("Importer bilde…", systemImage: "photo.badge.plus")
                        }
                        Button {
                            guard let scene = board.scene else { return }
                            historyFrameRef = (scene.id, frame.id)
                            Task {
                                historyEntries = await RoleRoomAPIClient.shared.frameHistory(
                                    manuscriptId: board.manuscript.id,
                                    sceneId: scene.id, frameId: frame.id)
                                showHistorySheet = true
                            }
                        } label: {
                            Label("Historikk…", systemImage: "clock.arrow.circlepath")
                        }
                        Button(role: .destructive) { pendingDeleteFrameId = frame.id } label: {
                            Label("Slett shot", systemImage: "trash")
                        }
                    } label: {
                        Text(frame.shotNumber)
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundStyle(BoardBrand.inkOnSheet)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(.white, in: RoundedRectangle(cornerRadius: 4))
                            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(white: 0.25), lineWidth: 1.5))
                    }
                    .accessibilityLabel("Shot-meny \(frame.shotNumber)")
                    // Drag-reorder: grip-håndtak (drag på selve raden ville
                    // kollidert med tegning på aktiv canvas).
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color(white: 0.6))
                        .frame(width: 20, height: 20)
                        .contentShape(Rectangle())
                        .onDrag {
                            draggedFrameId = frame.id
                            return NSItemProvider(object: frame.id as NSString)
                        }
                        .accessibilityLabel("Flytt shot \(frame.shotNumber)")
                    if pendingFrameIds.contains(frame.id) {
                        Circle().fill(Color.orange).frame(width: 7, height: 7)
                            .accessibilityLabel("Usynkede endringer")
                    }
                    Rectangle().fill(Color(white: 0.72)).frame(width: 24, height: 1.5)
                }
                Text("ACTION / DIALOG")
                    .font(.system(size: 8.5, weight: .bold)).kerning(1)
                    .foregroundStyle(Color(white: 0.62))
                Text(frame.description)
                    .font(.custom(BoardBrand.handwriting, size: 15))
                    .foregroundStyle(BoardBrand.inkOnSheet)
                if let notes = frame.notes, !notes.isEmpty {
                    Text("NOTES / DIAGRAM")
                        .font(.system(size: 8.5, weight: .bold)).kerning(1)
                        .foregroundStyle(Color(white: 0.62))
                        .padding(.top, 3)
                    Text(notes)
                        .font(.custom(BoardBrand.handwriting, size: 13))
                        .foregroundStyle(Color(white: 0.38))
                }
                NotesDiagramMini(strokesJSON: frame.strokesJSON,
                                 contentWidth: frame.drawingWidth)
            }
            .frame(width: 150, alignment: .leading)

            // Midt: aktiv = live Metal-canvas, ellers thumbnail
            ZStack {
                if isActive, renderer != nil {
                    activeCanvas(frame: frame)
                } else {
                    inactiveShotPreview(frame: frame)
                }
            }
            .aspectRatio(
                CGFloat((isActive ? canvasState.shotFraming.aspectRatio
                                   : frame.shotFraming?.aspectRatio)
                    ?? (frame.drawingWidth / max(1, frame.drawingHeight))),
                contentMode: .fit)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4)
                .stroke(isActive ? BoardBrand.accent : Color(white: 0.2), lineWidth: isActive ? 2 : 1.5))
            .onTapGesture {
                if !isActive { board.activeFrameIndex = index }
            }

            // Høyre: metadata-kolonnen
            VStack(alignment: .leading, spacing: 8) {
                metaEntry("CAM / SHOT", frame.shotType ?? "—")
                metaEntry("LENS / CAMERA", frame.lensMm.map { "\($0)mm" } ?? "—")
                metaEntry("MOVEMENT", frame.movement ?? "—")
                metaEntry("DURATION", "\(Int(frame.effectiveShotDuration.seconds)) SEC")
                if let beat = frame.beatTag {
                    Text(beat)
                        .font(.system(size: 9, weight: .bold)).kerning(0.8)
                        .foregroundStyle(BoardBrand.accent)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(BoardBrand.accent.opacity(0.14), in: Capsule())
                }
            }
            .frame(width: 104, alignment: .leading)
        }
    }

    // MARK: Aktiv canvas + annotasjonsverktøy (pil/rekt/tekst — web-paritet)

    @State private var shapeStart: CGPoint?
    @State private var shapeCurrent: CGPoint?
    @State private var lassoPoints: [CGPoint] = []
    @State private var selectedStrokeIds: Set<String> = []
    @State private var selectionDragOffset: CGSize = .zero

    private func annotationStroke(points: [StrokePoint], text: String? = nil) -> PencilStroke {
        var brush = BrushSpec.preset(.ink, size: 7, color: "#8b5cf6", opacity: 0.95)
        brush.grain = 0
        return PencilStroke(
            id: "board-\(Int(Date().timeIntervalSince1970 * 1000))-\(Int.random(in: 100...999))",
            points: points, inputType: "pencil",
            color: "#8b5cf6", width: 7, opacity: 0.95,
            brush: brush, boardLayer: "Camera / Arrows", textAnnotation: text)
    }

    private func annotationPoint(_ x: Double, _ y: Double) -> StrokePoint {
        StrokePoint(x: x, y: y, pressure: 0.85, tiltX: 0, tiltY: 0,
                    timestamp: Date().timeIntervalSince1970 * 1000)
    }

    private func appendAnnotation(_ stroke: PencilStroke) {
        canvasState.captureUndo("Legg til annotasjon")
        canvasState.strokes.append(stroke)
        canvasState.revision += 1
    }

    private func framingGeometry(for frame: FrameSummary,
                                 viewportSize: CGSize) -> ShotFramingGeometry? {
        ShotFramingGeometry(
            sourceSize: ShotFramingSize(width: frame.drawingWidth,
                                        height: frame.drawingHeight),
            viewportSize: ShotFramingSize(width: viewportSize.width,
                                          height: viewportSize.height),
            state: canvasState.shotFraming
        )
    }

    private func sourcePoint(_ viewportPoint: CGPoint,
                             geometry: ShotFramingGeometry?,
                             fallbackScale: CGFloat) -> CGPoint {
        guard let geometry else {
            return CGPoint(x: viewportPoint.x / fallbackScale,
                           y: viewportPoint.y / fallbackScale)
        }
        let point = geometry.sourcePoint(fromViewportPoint: ShotFramingPoint(
            x: viewportPoint.x, y: viewportPoint.y))
        return CGPoint(x: point.x, y: point.y)
    }

    private func viewportPoint(_ sourcePoint: CGPoint,
                               geometry: ShotFramingGeometry?,
                               fallbackScale: CGFloat) -> CGPoint {
        guard let geometry else {
            return CGPoint(x: sourcePoint.x * fallbackScale,
                           y: sourcePoint.y * fallbackScale)
        }
        let point = geometry.viewportPoint(fromSourcePoint: ShotFramingPoint(
            x: sourcePoint.x, y: sourcePoint.y))
        return CGPoint(x: point.x, y: point.y)
    }

    private func commitTextAnnotation(style: String?) {
        let text = textPromptValue.trimmingCharacters(in: .whitespacesAndNewlines)
        textPromptValue = ""
        guard !text.isEmpty else { return }
        var stroke = annotationStroke(
            points: [annotationPoint(textPromptPoint.x, textPromptPoint.y)], text: text)
        stroke.annotationStyle = style
        appendAnnotation(stroke)
    }

    private func activeCanvas(frame: FrameSummary) -> some View {
        GeometryReader { geo in
            let scale = geo.size.width / CGFloat(max(1, frame.drawingWidth))
            let framing = framingGeometry(for: frame, viewportSize: geo.size)
            let expectsRaster = StoryboardActiveRasterPolicy.expectsRaster(frame)
            let rasterPending = expectsRaster
                && fullResolutionRaster(for: frame) == nil
            ZStack(alignment: .topTrailing) {
                PencilCanvasView(state: canvasState, renderer: renderer)
                    .background(Color(red: 0.992, green: 0.992, blue: 0.984))
                    .allowsHitTesting(!rasterPending
                        && (boardTool == .draw || boardTool == .eraser))
                // Den lille server-thumbnailen er kun en eksplisitt
                // lasteplaceholder. Tegning/visking aktiveres først når den
                // fulloppløselige, redigerbare rasterbasen er i Metal.
                if rasterPending {
                    ZStack {
                        Color(white: 0.94)
                        ProgressView("Laster original …")
                            .font(.system(size: 11, weight: .semibold))
                            .tint(BoardBrand.accent)
                            .padding(9)
                            .background(.black.opacity(0.58), in: Capsule())
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped().allowsHitTesting(false)
                }
                // Tekst-annotasjoner: Metal tegner ikke tekst — SwiftUI-overlay
                // i samme håndskrift som web (Caveat ↔ Bradley Hand).
                ForEach(canvasState.strokes.filter {
                    $0.textAnnotation != nil
                        && !canvasState.hiddenLayers.contains($0.boardLayer ?? "Drawing")
                }) { stroke in
                    if let point = stroke.points.first {
                        let style = stroke.annotationStyle
                        let metrics = StoryboardAnnotationLayoutMetrics.resolve(
                            style: style,
                            sourceScale: framing?.sourceScale ?? Double(scale))
                        Text(style == nil ? (stroke.textAnnotation ?? "").uppercased()
                                          : (stroke.textAnnotation ?? ""))
                            .font(.custom(BoardBrand.handwriting,
                                          size: CGFloat(metrics.fontSize)))
                            .foregroundStyle(style == "note"
                                ? Color(red: 0.25, green: 0.22, blue: 0.15)
                                : (Color(hex: stroke.color) ?? BoardBrand.accent))
                            .padding(CGFloat(metrics.padding))
                            .background {
                                if style == "note" {
                                    RoundedRectangle(
                                        cornerRadius: CGFloat(metrics.cornerRadius))
                                        .fill(Color(red: 0.96, green: 0.91, blue: 0.75))
                                        .shadow(color: .black.opacity(0.2),
                                                radius: 3 * CGFloat(metrics.displayScale),
                                                y: 2 * CGFloat(metrics.displayScale))
                                } else if style == "bubble" {
                                    RoundedRectangle(
                                        cornerRadius: CGFloat(metrics.cornerRadius))
                                        .fill(.white)
                                        .overlay(RoundedRectangle(
                                            cornerRadius: CGFloat(metrics.cornerRadius))
                                            .stroke(Color(hex: stroke.color) ?? BoardBrand.accent,
                                                    lineWidth: CGFloat(metrics.lineWidth)))
                                        .shadow(color: .black.opacity(0.15),
                                                radius: 3 * CGFloat(metrics.displayScale),
                                                y: 2 * CGFloat(metrics.displayScale))
                                }
                            }
                            .rotationEffect(.degrees(canvasState.shotFraming.rollDegrees))
                            .position(viewportPoint(CGPoint(x: point.x, y: point.y),
                                                    geometry: framing,
                                                    fallbackScale: scale))
                            .allowsHitTesting(false)
                    }
                }
                if perspectiveMode > 0 {
                    PerspectiveOverlay(
                        mode: perspectiveMode,
                        points: $vanishingPoints,
                        editable: boardTool == .select,
                        onCommit: { persistPerspective(); updateSnapState() })
                }
                if boardTool == .arrow || boardTool == .rect || boardTool == .text {
                    annotationCapture(scale: scale, geometry: framing)
                }
                if boardTool == .select {
                    lassoCapture(scale: scale, geometry: framing)
                }
                if isReframing {
                    framingAdjustmentOverlay(frame: frame, viewportSize: geo.size)
                }
                // Fullskjerm tegnemodus (pinch-zoom, palm rejection)
                Button { showFullscreenDraw = true } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(Color.black.opacity(0.45), in: RoundedRectangle(cornerRadius: 7))
                }
                .buttonStyle(.plain)
                .padding(6)
                .accessibilityLabel("Fullskjerm tegning")
            }
        }
    }

    private func normalizedBounds(for strokes: [PencilStroke],
                                  frame: FrameSummary) -> ShotFramingRect? {
        let points = strokes.flatMap { stroke -> [ShotFramingPoint] in
            let stampScale = stroke.stampInstance.map {
                $0.scale * $0.depth.renderScale
            } ?? 1
            let radius = max(2, stroke.width * stampScale / 2)
            return stroke.points.flatMap { point in
                [
                    ShotFramingPoint(x: (point.x - radius) / frame.drawingWidth,
                                     y: (point.y - radius) / frame.drawingHeight),
                    ShotFramingPoint(x: (point.x + radius) / frame.drawingWidth,
                                     y: (point.y + radius) / frame.drawingHeight),
                ]
            }
        }
        guard let minX = points.map(\.x).min(), let maxX = points.map(\.x).max(),
              let minY = points.map(\.y).min(), let maxY = points.map(\.y).max()
        else { return nil }
        return ShotFramingRect(minX: minX, minY: minY,
                               width: maxX - minX, height: maxY - minY)
            .clampedToUnitSquare()
    }

    private func autoFramingInputs(frame: FrameSummary)
        -> (bounds: ShotFramingRect?, focus: ShotFramingPoint?) {
        let visible = canvasState.visibleStrokes().filter { $0.textAnnotation == nil }
        let selected = visible.filter { selectedStrokeIds.contains($0.id) }
        let subjectTypes: Set<BrushType> = [
            .gestureBrush, .silhouetteBrush, .characterPoseStamp,
            .faceExpressionStamp, .handPoseStamp, .crowdStamp,
        ]
        let semanticSubjects = visible.filter {
            guard let type = $0.brush?.type else { return false }
            return subjectTypes.contains(type)
        }
        // Only selected or semantic strokes are trustworthy subject bounds.
        // Treating an entire freehand/background drawing as one character can
        // cancel a CU request because the bounds span the whole canvas.
        let subjectStrokes = !selected.isEmpty ? selected : semanticSubjects
        let sceneBounds = normalizedBounds(for: visible, frame: frame)
        let focusPoints = visible.filter { $0.brush?.type == .focusBrush }
            .flatMap(\.points)
        let focus: ShotFramingPoint? = if !focusPoints.isEmpty {
            ShotFramingPoint(
                x: focusPoints.map(\.x).reduce(0, +)
                    / Double(focusPoints.count) / frame.drawingWidth,
                y: focusPoints.map(\.y).reduce(0, +)
                    / Double(focusPoints.count) / frame.drawingHeight
            )
        } else if subjectStrokes.isEmpty, let sceneBounds {
            // With no semantic subject, retain useful composition context but
            // let the shot preset own the zoom. The user can refine this with
            // a Focus Brush or by selecting strokes.
            ShotFramingPoint(x: sceneBounds.midX, y: sceneBounds.midY)
        } else { nil }
        return (normalizedBounds(for: subjectStrokes, frame: frame), focus)
    }

    private func shotFramingQualityReport(
        frame: FrameSummary
    ) -> ShotFramingQualityReport {
        let state = canvasState.shotFraming.normalized()
        let outputWidth = 1_920.0
        let outputHeight = outputWidth / max(0.1, state.aspectRatio)
        let sourceSize: ShotFramingSize
        if StoryboardFrameImagePolicy.usesViewportCoordinates(frame),
           let rasterSourceIdentity = FrameDocumentProjection
            .effectiveRasterSource(for: frame).stableIdentity,
           let viewportImage = fullResolutionRaster(for: frame),
           let mapped = StoryboardViewportRasterMapper.sourceSpaceImage(
                viewportImage: viewportImage,
                frame: frame,
                framing: state,
                rasterSourceIdentity: rasterSourceIdentity)?.cgImage {
            sourceSize = ShotFramingSize(
                width: Double(mapped.width), height: Double(mapped.height))
        } else if let cgImage = fullResolutionRaster(for: frame)?.cgImage {
            sourceSize = ShotFramingSize(
                width: Double(cgImage.width), height: Double(cgImage.height))
        } else {
            sourceSize = FrameRenderService.vectorSourceRenderSize(
                frame: frame, outputWidth: outputWidth, framing: state)
        }
        let selected = canvasState.strokes.filter {
            selectedStrokeIds.contains($0.id) && $0.textAnnotation == nil
        }
        return ShotFramingQualityValidator.validate(
            state: state,
            sourceSize: sourceSize,
            outputSize: ShotFramingSize(width: outputWidth, height: outputHeight),
            protectedSourceBounds: selected.isEmpty
                ? nil : normalizedBounds(for: selected, frame: frame))
    }

    private func shotFramingQualityText(
        _ code: ShotFramingQualityIssueCode
    ) -> String {
        switch code {
        case .invalidDimensions: return "Ugyldige bildedimensjoner"
        case .aspectRatioMismatch: return "Kilden krever sentrert aspect-fill crop"
        case .uncoveredViewport: return "Utsnittet etterlater tomme kanter"
        case .insufficientResolution: return "Rasterkilden kan bli litt myk i dette utsnittet"
        case .excessiveUpscale: return "Rasterkilden har for lav oppløsning for dette utsnittet"
        case .focusOutsideSafeArea: return "Fokuspunktet ligger utenfor safe area"
        case .protectedContentClipped: return "Valgt motiv blir klippet av safe area"
        }
    }

    /// Paid providers only receive production-valid camera windows. Warnings
    /// remain advisory; geometry errors move the artist back to Shot controls
    /// before credits can be reserved.
    @MainActor
    private func requireProductionReadyFraming(_ frame: FrameSummary) -> Bool {
        let report = shotFramingQualityReport(frame: frame)
        guard !report.isAcceptable,
              let issue = report.issues.first(where: { $0.severity == .error })
        else { return true }
        selectedInspectorTab = .shot
        isInspectorDockVisible = true
        aiStatus = "Utsnittet må justeres før AI: \(shotFramingQualityText(issue.code)). Ingen AI-kostnad er utløst."
        return false
    }

    private func finishFramingChange(_ state: ShotFramingState,
                                     label: String,
                                     captureUndo: Bool = true) {
        if captureUndo { canvasState.captureUndo(label) }
        var next = state.normalized()
        next.revision = max(canvasState.shotFraming.revision, next.revision) + 1
        next.intentFingerprint = next.canonicalFingerprint
        canvasState.shotFraming = next
        canvasState.revision += 1
    }

    private func applyShotSize(_ value: String, frame: FrameSummary) {
        guard let shotSize = ShotSize(metadataValue: value) else { return }
        let suggested = automaticFramingState(
            shotSize: shotSize,
            lensMm: canvasState.shotFraming.lensMm ?? frame.lensMm ?? 35,
            frame: frame)
        finishFramingChange(suggested, label: "Endre shot size")
    }

    private func automaticFramingState(
        shotSize: ShotSize, lensMm: Int, frame: FrameSummary,
        aspectRatio: Double? = nil
    ) -> ShotFramingState {
        let inputs = autoFramingInputs(frame: frame)
        let source = ShotFramingSize(width: frame.drawingWidth,
                                     height: frame.drawingHeight)
        var baseState = canvasState.shotFraming
        baseState.aspectRatio = aspectRatio ?? baseState.aspectRatio
        let viewport = ShotFramingSize(
            width: frame.drawingWidth,
            height: frame.drawingWidth
                / max(0.1, baseState.aspectRatio))
        var suggested = ShotFramingGeometry.suggestedState(
            for: shotSize, currentState: baseState,
            sourceSize: source, viewportSize: viewport,
            fullSubjectBounds: inputs.bounds, focusAnchor: inputs.focus)
        suggested.lensMm = lensMm
        let lensRatio = Double(lensMm) / 35.0
        let desiredZoom = suggested.zoom * lensRatio
        suggested.zoom = desiredZoom
        // A 2D crop can preview field of view, but it cannot synthesize the
        // perspective/compression of a different physical lens. Keep the
        // preview immediate and mark non-35mm optics for true AI recompose.
        suggested.mode = lensMm == 35 ? .automatic : .recomposed
        if let geometry = ShotFramingGeometry(
            sourceSize: source, viewportSize: viewport, state: suggested) {
            let covered = geometry.stateEnsuringFullCoverage()
            if covered.zoom > max(ShotFramingState.minimumZoom, desiredZoom) + 0.000_001 {
                suggested.mode = .recomposed
            }
            suggested = covered
        }
        return suggested
    }

    private func applyLens(_ lensMm: Int, frame: FrameSummary) {
        let shotSize = ShotSize(metadataValue:
            canvasState.shotFraming.shotSize ?? frame.shotType) ?? .wide
        let next = automaticFramingState(
            shotSize: shotSize, lensMm: lensMm, frame: frame)
        finishFramingChange(next, label: "Endre objektiv")
    }

    private func applyAspectRatio(_ aspectRatio: Double, frame: FrameSummary) {
        let shotSize = ShotSize(metadataValue:
            canvasState.shotFraming.shotSize ?? frame.shotType) ?? .wide
        let next = automaticFramingState(
            shotSize: shotSize,
            lensMm: canvasState.shotFraming.lensMm ?? frame.lensMm ?? 35,
            frame: frame,
            aspectRatio: aspectRatio)
        finishFramingChange(next, label: "Endre bildeformat")
    }

    private func aspectRatioValue(_ label: String) -> Double {
        switch label {
        case "2.39:1": return 2.39
        case "4:3": return 4.0 / 3.0
        case "1:1": return 1
        case "9:16": return 9.0 / 16.0
        default: return 16.0 / 9.0
        }
    }

    private func applyCameraAngle(_ angle: String, frame: FrameSummary) {
        var next = canvasState.shotFraming
        next.angle = angle
        switch angle {
        case "Dutch":
            next.rollDegrees = 8
            next.mode = next.lensMm == 35 ? .automatic : .recomposed
        case "Eye level":
            next.rollDegrees = 0
            next.mode = next.lensMm == 35 ? .automatic : .recomposed
        default:
            // Low/high/bird/worm alter perspective, not merely crop. Keep the
            // current artwork intact and explicitly request AI re-composition.
            next.rollDegrees = 0
            next.mode = .recomposed
        }
        let source = ShotFramingSize(width: frame.drawingWidth,
                                     height: frame.drawingHeight)
        let viewport = ShotFramingSize(
            width: frame.drawingWidth,
            height: frame.drawingWidth / max(0.1, next.aspectRatio))
        if let geometry = ShotFramingGeometry(sourceSize: source, viewportSize: viewport,
                                              state: next) {
            next = geometry.stateEnsuringFullCoverage()
        }
        finishFramingChange(next, label: "Endre kameravinkel")
    }

    private func resetFraming(frame: FrameSummary) {
        var reset = automaticFramingState(
            shotSize: .wide, lensMm: 35, frame: frame)
        reset.angle = "Eye level"
        reset.rollDegrees = 0
        reset.mode = .automatic
        finishFramingChange(reset, label: "Nullstill utsnitt")
    }

    private func beginFramingGestureIfNeeded() {
        guard framingGestureBaseline == nil else { return }
        framingGestureBaseline = canvasState.shotFraming
        framingPanTranslation = .zero
        framingMagnification = 1
        framingRotationDegrees = 0
        canvasState.captureUndo("Juster utsnitt")
    }

    private func updateFramingGesture(
        sourceSize: ShotFramingSize, viewportSize: CGSize
    ) {
        guard let baseline = framingGestureBaseline else { return }
        canvasState.shotFraming = ShotFramingInteraction.state(
            baseline: baseline,
            panTranslation: ShotFramingSize(
                width: Double(framingPanTranslation.width),
                height: Double(framingPanTranslation.height)),
            magnification: Double(framingMagnification),
            rotationDegrees: framingRotationDegrees,
            sourceSize: sourceSize,
            viewportSize: ShotFramingSize(
                width: Double(viewportSize.width),
                height: Double(viewportSize.height)))
    }

    private func finishFramingGestureIfComplete() {
        guard !framingPanActive, !framingZoomActive, !framingRollActive,
              framingGestureBaseline != nil else { return }
        framingGestureBaseline = nil
        framingPanTranslation = .zero
        framingMagnification = 1
        framingRotationDegrees = 0
        finishFramingChange(
            canvasState.shotFraming,
            label: "Juster utsnitt", captureUndo: false)
    }

    private func framingAdjustmentOverlay(frame: FrameSummary,
                                          viewportSize: CGSize) -> some View {
        let sourceSize = ShotFramingSize(width: frame.drawingWidth,
                                         height: frame.drawingHeight)
        return ZStack {
            Color.black.opacity(0.08).contentShape(Rectangle())
            Path { path in
                for fraction in [1.0 / 3.0, 2.0 / 3.0] {
                    path.move(to: CGPoint(x: viewportSize.width * fraction, y: 0))
                    path.addLine(to: CGPoint(x: viewportSize.width * fraction,
                                             y: viewportSize.height))
                    path.move(to: CGPoint(x: 0, y: viewportSize.height * fraction))
                    path.addLine(to: CGPoint(x: viewportSize.width,
                                             y: viewportSize.height * fraction))
                }
            }
            .stroke(Color.white.opacity(0.58), lineWidth: 0.8)
            RoundedRectangle(cornerRadius: 3)
                .stroke(Color.yellow.opacity(0.72), style: StrokeStyle(lineWidth: 1,
                                                                      dash: [7, 5]))
                .padding(viewportSize.width * 0.05)
            VStack {
                HStack(spacing: 8) {
                    Label("Dra · knip · roter", systemImage: "viewfinder")
                    Spacer()
                    Text(String(format: "%.2f× · %.1f°",
                                canvasState.shotFraming.zoom,
                                canvasState.shotFraming.rollDegrees))
                        .monospacedDigit()
                    Button("Ferdig") { isReframing = false }
                        .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                        .accessibilityIdentifier("finish-shot-framing")
                }
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white)
                .padding(8)
                .background(.black.opacity(0.68), in: RoundedRectangle(cornerRadius: 8))
                .padding(8)
                Spacer()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Manuell framing")
        .accessibilityIdentifier("shot-framing-overlay")
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    framingPanActive = true
                    beginFramingGestureIfNeeded()
                    framingPanTranslation = value.translation
                    updateFramingGesture(
                        sourceSize: sourceSize, viewportSize: viewportSize)
                }
                .onEnded { _ in
                    framingPanActive = false
                    finishFramingGestureIfComplete()
                }
        )
        .simultaneousGesture(
            MagnificationGesture()
                .onChanged { value in
                    framingZoomActive = true
                    beginFramingGestureIfNeeded()
                    framingMagnification = value
                    updateFramingGesture(
                        sourceSize: sourceSize, viewportSize: viewportSize)
                }
                .onEnded { _ in
                    framingZoomActive = false
                    finishFramingGestureIfComplete()
                }
        )
        .simultaneousGesture(
            RotationGesture()
                .onChanged { value in
                    framingRollActive = true
                    beginFramingGestureIfNeeded()
                    framingRotationDegrees = value.degrees
                    updateFramingGesture(
                        sourceSize: sourceSize, viewportSize: viewportSize)
                }
                .onEnded { _ in
                    framingRollActive = false
                    finishFramingGestureIfComplete()
                }
        )
    }

    private func annotationCapture(scale: CGFloat,
                                   geometry: ShotFramingGeometry?) -> some View {
        ZStack {
            Color.clear.contentShape(Rectangle())
            // Gummistrikk-preview i view-rom
            if let start = shapeStart, let current = shapeCurrent, boardTool != .text {
                Path { path in
                    if boardTool == .arrow {
                        path.move(to: start)
                        path.addLine(to: current)
                    } else {
                        path.addRect(CGRect(x: min(start.x, current.x), y: min(start.y, current.y),
                                            width: abs(current.x - start.x), height: abs(current.y - start.y)))
                    }
                }
                .stroke(BoardBrand.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round))
            }
        }
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    if shapeStart == nil { shapeStart = value.startLocation }
                    shapeCurrent = value.location
                }
                .onEnded { value in
                    defer { shapeStart = nil; shapeCurrent = nil }
                    let start = value.startLocation
                    let end = value.location
                    if boardTool == .text {
                        textPromptPoint = sourcePoint(end, geometry: geometry,
                                                      fallbackScale: scale)
                        textPromptShown = true
                        return
                    }
                    // Innholdsrom-koordinater (web lagrer 1920×1080-rom)
                    let sourceStart = sourcePoint(start, geometry: geometry,
                                                  fallbackScale: scale)
                    let sourceEnd = sourcePoint(end, geometry: geometry,
                                                fallbackScale: scale)
                    let sx = Double(sourceStart.x), sy = Double(sourceStart.y)
                    let ex = Double(sourceEnd.x), ey = Double(sourceEnd.y)
                    guard hypot(end.x - start.x, end.y - start.y) >= 12 else { return }
                    let points: [StrokePoint]
                    if boardTool == .arrow {
                        // Web-paritet: linje + tilbake til spiss + to hodelinjer (34px, ±0.45 rad)
                        let angle = atan2(ey - sy, ex - sx)
                        let head = 34.0
                        points = [
                            annotationPoint(sx, sy), annotationPoint(ex, ey),
                            annotationPoint(ex - head * cos(angle - 0.45), ey - head * sin(angle - 0.45)),
                            annotationPoint(ex, ey),
                            annotationPoint(ex - head * cos(angle + 0.45), ey - head * sin(angle + 0.45)),
                        ]
                    } else {
                        let x0 = min(sx, ex), y0 = min(sy, ey), x1 = max(sx, ex), y1 = max(sy, ey)
                        points = [annotationPoint(x0, y0), annotationPoint(x1, y0),
                                  annotationPoint(x1, y1), annotationPoint(x0, y1),
                                  annotationPoint(x0, y0)]
                    }
                    appendAnnotation(annotationStroke(points: points))
                }
        )
    }

    // MARK: Lasso-select: marker strøk → flytt (drag) eller slett

    private func selectionRect(scale: CGFloat,
                               geometry: ShotFramingGeometry?) -> CGRect? {
        let selected = canvasState.strokes.filter { selectedStrokeIds.contains($0.id) }
        let bounds = selected.compactMap { stroke -> (Double, Double, Double, Double)? in
            guard let minX = stroke.points.map(\.x).min(),
                  let maxX = stroke.points.map(\.x).max(),
                  let minY = stroke.points.map(\.y).min(),
                  let maxY = stroke.points.map(\.y).max() else { return nil }
            let stampScale = stroke.stampInstance.map {
                $0.scale * $0.depth.renderScale
            } ?? 1
            let radius = max(1, stroke.width * stampScale / 2)
            return (minX - radius, minY - radius, maxX + radius, maxY + radius)
        }
        guard let first = bounds.first else { return nil }
        let minX = bounds.dropFirst().reduce(first.0) { min($0, $1.0) }
        let minY = bounds.dropFirst().reduce(first.1) { min($0, $1.1) }
        let maxX = bounds.dropFirst().reduce(first.2) { max($0, $1.2) }
        let maxY = bounds.dropFirst().reduce(first.3) { max($0, $1.3) }
        let sourceCorners = [
            CGPoint(x: minX, y: minY), CGPoint(x: maxX, y: minY),
            CGPoint(x: maxX, y: maxY), CGPoint(x: minX, y: maxY),
        ]
        let corners = sourceCorners.map {
            viewportPoint($0, geometry: geometry, fallbackScale: scale)
        }
        let left = corners.map(\.x).min() ?? 0
        let top = corners.map(\.y).min() ?? 0
        let right = corners.map(\.x).max() ?? left
        let bottom = corners.map(\.y).max() ?? top
        return CGRect(x: left, y: top, width: max(20, right - left),
                      height: max(20, bottom - top))
    }

    private func lassoCapture(scale: CGFloat,
                              geometry: ShotFramingGeometry?) -> some View {
        ZStack(alignment: .topLeading) {
            Color.clear.contentShape(Rectangle())
            if lassoPoints.count > 1 {
                Path { path in
                    path.move(to: lassoPoints[0])
                    for point in lassoPoints.dropFirst() { path.addLine(to: point) }
                }
                .stroke(BoardBrand.accent, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
            }
            if let rect = selectionRect(scale: scale, geometry: geometry) {
                RoundedRectangle(cornerRadius: 4)
                    .stroke(BoardBrand.accent, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                    .background(BoardBrand.accent.opacity(0.06))
                    .frame(width: rect.width + 16, height: rect.height + 16)
                    .scaleEffect(selectionScaleFactor)
                    .rotationEffect(.radians(selectionRotationAngle))
                    .offset(x: rect.minX - 8 + selectionDragOffset.width,
                            y: rect.minY - 8 + selectionDragOffset.height)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture()
                            .onChanged { selectionDragOffset = $0.translation }
                            .onEnded { value in
                                let sourceOrigin = sourcePoint(.zero, geometry: geometry,
                                                               fallbackScale: scale)
                                let sourceTranslation = sourcePoint(
                                    CGPoint(x: value.translation.width,
                                            y: value.translation.height),
                                    geometry: geometry, fallbackScale: scale)
                                moveSelection(dx: sourceTranslation.x - sourceOrigin.x,
                                              dy: sourceTranslation.y - sourceOrigin.y)
                                selectionDragOffset = .zero
                            }
                    )
                // Skaleringshåndtak (nedre høyre): drag fra/mot senter.
                selectionHandle(systemImage: "arrow.up.left.and.arrow.down.right")
                    .position(x: rect.maxX + 8, y: rect.maxY + 8)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                let center = CGPoint(x: rect.midX, y: rect.midY)
                                let start = hypot(value.startLocation.x - center.x,
                                                  value.startLocation.y - center.y)
                                let current = hypot(value.location.x - center.x,
                                                    value.location.y - center.y)
                                selectionScaleFactor = max(0.1, min(8, current / max(1, start)))
                            }
                            .onEnded { _ in
                                transformSelection(scaleBy: Double(selectionScaleFactor),
                                                   rotateBy: 0, viewRect: rect, scale: scale,
                                                   geometry: geometry)
                                selectionScaleFactor = 1
                            }
                    )
                // Rotasjonshåndtak (topp midt).
                selectionHandle(systemImage: "arrow.trianglehead.2.clockwise.rotate.90")
                    .position(x: rect.midX, y: rect.minY - 28)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                let center = CGPoint(x: rect.midX, y: rect.midY)
                                let startAngle = atan2(value.startLocation.y - center.y,
                                                       value.startLocation.x - center.x)
                                let currentAngle = atan2(value.location.y - center.y,
                                                         value.location.x - center.x)
                                selectionRotationAngle = Double(currentAngle - startAngle)
                            }
                            .onEnded { _ in
                                transformSelection(scaleBy: 1, rotateBy: selectionRotationAngle,
                                                   viewRect: rect, scale: scale,
                                                   geometry: geometry)
                                selectionRotationAngle = 0
                            }
                    )
                HStack(spacing: 8) {
                    Button { deleteSelection() } label: {
                        Label("Slett", systemImage: "trash")
                            .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.red.opacity(0.85), in: Capsule())
                    }
                    Button { selectedStrokeIds = [] } label: {
                        Text("Avbryt")
                            .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.black.opacity(0.6), in: Capsule())
                    }
                    // Retusj (SBP Pencil Line Retouch-paritet): juster
                    // eksisterende strøk uten å tegne på nytt.
                    retouchButton("minus.circle", "Tynnere") { retouchSelection(widthFactor: 0.8) }
                    retouchButton("plus.circle", "Tykkere") { retouchSelection(widthFactor: 1.25) }
                    retouchButton("sun.min", "Blekere") { retouchSelection(opacityFactor: 0.8) }
                    retouchButton("sun.max", "Mørkere") { retouchSelection(opacityFactor: 1.25) }
                    retouchButton("paintpalette", "Pensel-farge") {
                        retouchSelection(color: canvasState.brushColor)
                    }
                    if selectedStrokeIds.contains(where: { id in
                        canvasState.strokes.first(where: { $0.id == id })?.stampInstance != nil
                    }) {
                        retouchButton("arrow.left.and.right", "Speilvend stamp") {
                            flipSelectedStamps()
                        }
                        retouchButton("slider.horizontal.3", "Stamp Inspector") {
                            stampInspectorStrokeID = selectedStrokeIds.first(where: { id in
                                canvasState.strokes.first(where: { $0.id == id })?
                                    .stampInstance != nil
                            })
                        }
                    }
                }
                .offset(x: max(0, rect.minX - 8), y: max(0, rect.minY - 36))
            }
        }
        .gesture(
            selectedStrokeIds.isEmpty
                ? DragGesture(minimumDistance: 0)
                    .onChanged { lassoPoints.append($0.location) }
                    .onEnded { _ in finishLasso(scale: scale, geometry: geometry) }
                : nil
        )
    }

    private func finishLasso(scale: CGFloat, geometry: ShotFramingGeometry?) {
        defer { lassoPoints = [] }
        guard lassoPoints.count > 4 else { return }
        let polygon = lassoPoints.map {
            sourcePoint($0, geometry: geometry, fallbackScale: scale)
        }
        var hit: Set<String> = []
        for stroke in canvasState.strokes {
            let total = stroke.points.count
            guard total > 0 else { continue }
            let inside = stroke.points.filter {
                pointInPolygon(CGPoint(x: $0.x, y: $0.y), polygon: polygon)
            }.count
            if Double(inside) / Double(total) > 0.5 { hit.insert(stroke.id) }
        }
        selectedStrokeIds = hit
    }

    private func retouchButton(_ systemImage: String, _ label: String,
                               action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                .padding(6)
                .background(Color.black.opacity(0.6), in: Circle())
        }
        .accessibilityLabel(label)
    }

    /// Muter valgte strøk (bredde/opasitet/farge) — én undo per trykk.
    private func retouchSelection(widthFactor: Double = 1,
                                  opacityFactor: Double = 1,
                                  color: String? = nil) {
        guard !selectedStrokeIds.isEmpty else { return }
        canvasState.captureUndo("Juster utvalg")
        canvasState.strokes = canvasState.strokes.map { stroke in
            guard selectedStrokeIds.contains(stroke.id) else { return stroke }
            var adjusted = stroke
            adjusted.width = max(0.5, adjusted.width * widthFactor)
            adjusted.opacity = min(1, max(0.05, adjusted.opacity * opacityFactor))
            if var brush = adjusted.brush {
                brush.size = max(0.5, brush.size * widthFactor)
                brush.opacity = min(1, max(0.05, brush.opacity * opacityFactor))
                if let color { brush.color = color }
                adjusted.brush = brush
            }
            if let color { adjusted.color = color }
            return adjusted
        }
        canvasState.revision += 1
    }

    private func selectionHandle(systemImage: String) -> some View {
        Image(systemName: systemImage)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 22, height: 22)
            .background(BoardBrand.accent, in: Circle())
            .overlay(Circle().stroke(.white, lineWidth: 1.5))
    }

    /// Skaler/roter valgte strøk rundt utvalgets senter (innholdsrom).
    private func transformSelection(scaleBy factor: Double, rotateBy angle: Double,
                                    viewRect: CGRect, scale: CGFloat,
                                    geometry: ShotFramingGeometry?) {
        guard !selectedStrokeIds.isEmpty,
              factor != 1 || angle != 0 else { return }
        let sourceCenter = sourcePoint(CGPoint(x: viewRect.midX, y: viewRect.midY),
                                       geometry: geometry, fallbackScale: scale)
        let center = (x: Double(sourceCenter.x), y: Double(sourceCenter.y))
        let cosA = cos(angle), sinA = sin(angle)
        canvasState.captureUndo("Transformer utvalg")
        canvasState.strokes = canvasState.strokes.map { stroke in
            guard selectedStrokeIds.contains(stroke.id) else { return stroke }
            var transformed = stroke
            transformed.points = transformed.points.map { point in
                var p = point
                let dx = (p.x - center.x) * factor
                let dy = (p.y - center.y) * factor
                p.x = center.x + dx * cosA - dy * sinA
                p.y = center.y + dx * sinA + dy * cosA
                return p
            }
            if var stamp = transformed.stampInstance {
                stamp.scale = min(8, max(0.1, stamp.scale * factor))
                stamp.rotationDegrees += angle * 180 / .pi
                transformed.stampInstance = stamp
            } else {
                transformed.width *= factor
                transformed.brush?.size *= factor
            }
            return transformed
        }
        canvasState.revision += 1
    }

    private func flipSelectedStamps() {
        guard !selectedStrokeIds.isEmpty else { return }
        canvasState.captureUndo("Speil stamp")
        canvasState.strokes = canvasState.strokes.map { stroke in
            guard selectedStrokeIds.contains(stroke.id),
                  var stamp = stroke.stampInstance else { return stroke }
            var flipped = stroke
            stamp.flipX.toggle()
            flipped.stampInstance = stamp
            return flipped
        }
        canvasState.revision += 1
    }

    private func moveSelection(dx: Double, dy: Double) {
        guard !selectedStrokeIds.isEmpty, dx != 0 || dy != 0 else { return }
        canvasState.captureUndo("Flytt utvalg")
        canvasState.strokes = canvasState.strokes.map { stroke in
            guard selectedStrokeIds.contains(stroke.id) else { return stroke }
            var moved = stroke
            moved.points = moved.points.map { point in
                var p = point
                p.x += dx
                p.y += dy
                return p
            }
            return moved
        }
        canvasState.revision += 1
    }

    private func deleteSelection() {
        guard !selectedStrokeIds.isEmpty else { return }
        canvasState.captureUndo("Slett utvalg")
        canvasState.strokes.removeAll { selectedStrokeIds.contains($0.id) }
        canvasState.revision += 1
        selectedStrokeIds = []
    }

    private func metaEntry(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 8, weight: .bold)).kerning(1)
                .foregroundStyle(Color(white: 0.62))
            Text(value).font(.custom(BoardBrand.handwriting, size: 14))
                .foregroundStyle(BoardBrand.inkOnSheet)
        }
    }


    // MARK: Camera motion

    private func openCameraMotionEditor(
        frame: FrameSummary,
        applying preset: CameraMotionEditorPreset?
    ) {
        guard !cameraMotionSyncInFlight else {
            board.syncStatus = "Vent til kamerabanen er ferdig synket"
            return
        }
        switch frame.cameraMotionReadState {
        case .invalid:
            board.syncStatus = "Kamerabanen er ugyldig og er bevart for gjenoppretting"
            return
        case .upgradeRequired:
            board.syncStatus = "Kamerabanen er laget i et nyere format. Oppgrader appen."
            return
        case .none, .valid:
            break
        }

        let isActive = board.frame?.id == frame.id
        let fallback = ShotFramingState(
            shotSize: frame.shotType,
            angle: frame.angle,
            lensMm: frame.lensMm,
            aspectRatio: frame.drawingWidth / max(1, frame.drawingHeight))
        let initialFraming = isActive
            ? canvasState.shotFraming
            : (frame.shotFraming ?? fallback)
        let motionTrack = isActive
            ? canvasState.cameraMotionTrack
            : frame.cameraMotionTrack
        let sourceFrame = frame
        let model = CameraMotionEditorModel(
            initialFraming: initialFraming,
            motionTrack: motionTrack,
            shotDuration: frame.effectiveShotDuration,
            timing: frame.storyboardTiming,
            validator: { initial, track, duration in
                cameraMotionValidation(
                    sourceFrame: sourceFrame,
                    initialFraming: initial,
                    track: track,
                    duration: duration)
            })
        if let preset,
           preset != .custom,
           CameraMotionEditorPreset.resolve(track: motionTrack) != preset {
            model.applyPreset(preset)
        }
        cameraMotionEditorSession = CameraMotionEditorSession(
            sourceFrame: sourceFrame,
            model: model)
    }

    private func cameraMotionValidation(
        sourceFrame: FrameSummary,
        initialFraming: ShotFramingState,
        track: CameraMotionTrack?,
        duration: MediaTime
    ) -> CameraMotionEditorValidation {
        var candidate = sourceFrame
        candidate.shotFraming = initialFraming.normalized()
        candidate.shotDuration = duration
        candidate.durationSec = duration.seconds
        candidate.cameraMotionTrack = track
        candidate.cameraMotionReadState = track == nil ? .none : .valid
        candidate.cameraMotionStatus = "valid"
        let report = FrameRenderCoordinator.motionCoverageReport(
            frame: candidate)
        let codes = (report.blockingCodes + report.warningCodes)
            .map(cameraMotionIssueText)
            .joined(separator: " · ")
        switch report.classification {
        case .valid:
            return .ready
        case .warning:
            return CameraMotionEditorValidation(
                severity: .warning,
                title: "Coverage warning",
                detail: codes.isEmpty
                    ? "Review the complete move before export."
                    : codes)
        case .blocking:
            return CameraMotionEditorValidation(
                severity: .blocking,
                title: "Move exceeds source coverage",
                detail: codes.isEmpty
                    ? "The full camera path cannot be rendered safely."
                    : codes)
        }
    }

    private func cameraMotionIssueText(
        _ code: StoryboardCoverageIssueCode
    ) -> String {
        switch code {
        case .uncoveredViewport: return "Camera path leaves the source plate"
        case .motionPlateRequired: return "A larger motion plate is required"
        case .lowSourceResolution: return "Source resolution becomes too low"
        case .largeEmptyCorners: return "Rotation exposes empty corners"
        case .aggressiveDigitalZoom: return "Digital zoom is aggressive"
        case .focusNearCropEdge: return "Focus point approaches the crop edge"
        case .criticalSubjectOutside: return "Critical subject leaves frame"
        case .aspectRatioMismatch: return "Aspect ratio does not match"
        case .invalidMotionTrack: return "Camera track is invalid"
        case .unsupportedProjectFrameRate: return "Frame rate is unsupported"
        case .unsupportedPolicyVersion: return "Coverage policy needs an upgrade"
        case .invalidDimensions: return "Source dimensions are invalid"
        case .invalidFraming: return "Framing is invalid"
        case .coverageNonConvergent: return "Camera curve cannot be verified"
        case .emptyViewport: return "Viewport is empty"
        case .providerMaySynthesizeOutsideSource:
            return "Provider may synthesize outside the source"
        }
    }

    private func canAdjustShotDuration(frame: FrameSummary) -> Bool {
        guard !cameraMotionSyncInFlight,
              !frame.hasBlockingCameraMotionDraft else { return false }
        return PendingCameraMotionStore.load(frameId: frame.id) == nil
    }

    private func adjustShotDuration(
        frame: FrameSummary,
        deltaSeconds: Double
    ) {
        guard canAdjustShotDuration(frame: frame) else {
            board.syncStatus =
                "Vent til kamerabanen er synket før varigheten endres."
            return
        }
        board.setActiveFrameDuration(
            seconds: frame.effectiveShotDuration.seconds + deltaSeconds)
    }

    private func cameraMotionStatusText(
        frame: FrameSummary,
        track: CameraMotionTrack?
    ) -> String {
        if cameraMotionSyncInFlight && board.frame?.id == frame.id {
            return "Saving camera move…"
        }
        if frame.cameraMotionReadState == .upgradeRequired {
            return "Newer camera format — update required"
        }
        if frame.cameraMotionReadState == .invalid
            || frame.cameraMotionStatus == "invalid" {
            return "Invalid draft preserved — playback blocked"
        }
        if frame.cameraMotionStatus == "needsRebase" {
            return "Start framing changed — open editor to rebase"
        }
        guard let track, track.enabled, !track.keyframes.isEmpty else {
            return "Static · no camera transform"
        }
        let keyLabel = track.keyframes.count == 1 ? "key" : "keys"
        if track.mode == .performed {
            return "Performed · \(track.keyframes.count) \(keyLabel)"
        }
        let preset = CameraMotionEditorPreset.resolve(track: track)
        return "\(preset.label) · \(track.keyframes.count) \(keyLabel)"
    }

    private func cameraMotionStatusSymbol(frame: FrameSummary) -> String {
        if cameraMotionSyncInFlight { return "arrow.triangle.2.circlepath" }
        if frame.hasBlockingCameraMotionDraft {
            return "exclamationmark.triangle.fill"
        }
        return frame.cameraMotionTrack == nil
            ? "pause.circle.fill" : "checkmark.seal.fill"
    }

    private func cameraMotionStatusColor(frame: FrameSummary) -> Color {
        if cameraMotionSyncInFlight { return BoardBrand.accent }
        if frame.hasBlockingCameraMotionDraft { return .orange }
        return .green
    }

    private func cameraMotionPreview(
        sourceFrame: FrameSummary,
        framing: ShotFramingState
    ) -> some View {
        let isActive = board.frame?.id == sourceFrame.id
        return CameraMotionPreviewSurface(
            sourceFrame: sourceFrame,
            framing: framing,
            strokesOverride: isActive ? canvasState.strokes : nil,
            layerStateOverride: isActive ? canvasState.layerState : nil,
            localDocumentRevision: isActive ? canvasState.revision : 0)
    }

    private func commitCameraMotion(
        _ commit: CameraMotionEditorCommit,
        sourceFrame: FrameSummary
    ) {
        guard board.frame?.id == sourceFrame.id else {
            board.syncStatus = "Shotet ble byttet. Kamerabanen ble ikke lagret."
            return
        }
        let framing = commit.initialFraming.normalized()
        let framingChanged = framing != canvasState.shotFraming
        let motionChanged = commit.motionTrack != canvasState.cameraMotionTrack
        let requiresRebase = board.frame?.cameraMotionStatus == "needsRebase"
        guard framingChanged || motionChanged || requiresRebase else {
            canvasState.presentationFraming = nil
            return
        }
        let nextRevision = canvasState.revision + (framingChanged ? 1 : 0)
        guard let mutation = pendingCameraMotionMutation(
            initialFraming: framing,
            motionTrack: commit.motionTrack,
            localRevision: nextRevision)
        else {
            board.syncStatus = "Kamerabanen kunne ikke fryses for lagring"
            return
        }
        if !board.isLocalSample,
           !PendingCameraMotionStore.save(mutation) {
            board.syncStatus = "Kamerabanen kunne ikke sikres på enheten"
            return
        }

        invalidateAnimationPreflightForCameraHistoryChange()
        if framingChanged || motionChanged {
            canvasState.captureUndo("Endre kamerabane")
        }
        lastObservedShotFraming = framing
        lastObservedCameraMotionTrack = commit.motionTrack
        canvasState.shotFraming = framing
        canvasState.cameraMotionTrack = commit.motionTrack
        canvasState.presentationFraming = nil
        if framingChanged { canvasState.revision = nextRevision }
        board.applyShotFramingLocally(framing, markAIStale: framingChanged)
        board.applyCameraMotionLocally(commit.motionTrack)
        updateAIRasterEditingMode()
        refreshFramingDependentBackground()

        guard !board.isLocalSample else { return }
        cameraMotionAutosyncTask?.cancel()
        cameraMotionAutosyncTask = Task {
            await persistPendingCameraMotion(mutation)
        }
    }

    private func invalidateAnimationPreflightForCameraHistoryChange() {
        animationPreflight = nil
        animationPreflightSourceImage = nil
        animationPreflightComposite = nil
        animationPreflightSession = nil
    }

    private func pendingCameraMotionMutation(
        initialFraming: ShotFramingState,
        motionTrack: CameraMotionTrack?,
        localRevision: Int
    ) -> PendingCameraMotionMutation? {
        guard let ref = loadedFrameRef,
              let frame = board.frame,
              frame.id == ref.frameId,
              let strokesJSON = try? StrokeSerialization.encodeToWebJSON(
                canvasState.strokes)
        else { return nil }
        return PendingCameraMotionMutation(
            manuscriptId: board.manuscript.id,
            sceneId: ref.sceneId,
            frameId: ref.frameId,
            shotDuration: frame.effectiveShotDuration,
            initialFraming: initialFraming.normalized(),
            motionTrack: motionTrack,
            expectedMotionRevision: loadedFrameCameraMotionRevision,
            baseMotionTrack: loadedFrameCameraMotionTrack,
            baseMotionFingerprint: loadedFrameCameraMotionFingerprint,
            baseMotionStatus: loadedFrameCameraMotionStatus,
            localRevision: localRevision,
            strokesJSON: strokesJSON,
            thumbnailDataURL: renderer?.thumbnailDataURL(
                framing: initialFraming),
            layerState: canvasState.layerState,
            baseUpdatedAt: loadedFrameUpdatedAt,
            baseSourceUpdatedAt: loadedFrameSourceUpdatedAt,
            baseStrokesJSON: loadedFrameStrokesJSON,
            baseLayerState: loadedFrameLayerState,
            baseShotFraming: loadedFrameShotFraming
                ?? frame.shotFraming
                ?? canvasState.shotFraming)
    }

    private func scheduleCameraMotionAutosync() {
        guard !board.isLocalSample,
              let mutation = pendingCameraMotionMutation(
                initialFraming: canvasState.shotFraming,
                motionTrack: canvasState.cameraMotionTrack,
                localRevision: canvasState.revision),
              PendingCameraMotionStore.save(mutation)
        else { return }
        if cameraMotionSyncInFlight {
            cameraMotionSyncRequestedAfterCurrent = true
            return
        }
        cameraMotionAutosyncTask?.cancel()
        cameraMotionAutosyncTask = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            await persistPendingCameraMotion(mutation)
        }
    }

    @MainActor
    private func persistPendingCameraMotion(
        _ mutation: PendingCameraMotionMutation
    ) async {
        guard !board.isLocalSample,
              mutation.manuscriptId == board.manuscript.id else { return }
        if cameraMotionSyncInFlight {
            cameraMotionSyncRequestedAfterCurrent = true
            return
        }
        cameraMotionSyncInFlight = true
        board.syncStatus = "Lagrer kamerabane…"

        var waitPasses = 0
        while syncInFlight && waitPasses < 200 {
            try? await Task.sleep(nanoseconds: 50_000_000)
            guard !Task.isCancelled else {
                cameraMotionSyncInFlight = false
                return
            }
            waitPasses += 1
        }
        guard !syncInFlight else {
            board.syncStatus = "Tegnesynk pågår · kamerabanen er sikret lokalt"
            cameraMotionSyncInFlight = false
            return
        }

        syncInFlight = true
        defer {
            syncInFlight = false
            cameraMotionSyncInFlight = false
            if syncRequestedAfterCurrent {
                syncRequestedAfterCurrent = false
                scheduleAutosync()
            }
            if cameraMotionSyncRequestedAfterCurrent {
                cameraMotionSyncRequestedAfterCurrent = false
                let pending = PendingCameraMotionStore.pendingMutations()
                    .filter {
                        $0.manuscriptId == board.manuscript.id
                    }
                // Finish the just-rebased same-frame queue before unrelated
                // older WALs can consume the single global in-flight slot.
                if let next = pending.first(where: {
                    $0.frameId == mutation.frameId
                }) ?? pending.first {
                    cameraMotionAutosyncTask = Task {
                        await persistPendingCameraMotion(next)
                    }
                }
            }
        }

        do {
            var expectedRevision = mutation.expectedMotionRevision
            var committedSourceSnapshot:
                PendingCameraMotionAuthoritativeBase.SourceSnapshot?
            var committedSourcePaintoverState:
                StoryboardPaintoverState?
            if mutation.changesInitialFraming {
                let sourceResult = try await RoleRoomAPIClient.shared
                    .saveFrameStrokes(
                        manuscriptId: mutation.manuscriptId,
                        sceneId: mutation.sceneId,
                        frameId: mutation.frameId,
                        strokesJSON: mutation.strokesJSON,
                        thumbnailDataURL: mutation.thumbnailDataURL,
                        baseUpdatedAt: mutation.baseUpdatedAt,
                        layerState: mutation.layerState,
                        shotFraming: mutation.initialFraming,
                        baseStrokesJSON: mutation.baseStrokesJSON,
                        baseLayerState: mutation.baseLayerState,
                        baseShotFraming: mutation.baseShotFraming)
                let authoritativeFraming = sourceResult.shotFraming
                    ?? mutation.initialFraming
                guard authoritativeFraming.canonicalFingerprint
                    == mutation.initialFraming.canonicalFingerprint else {
                    throw SyncError.serverMessage(
                        "Startutsnittet ble endret på en annen enhet. Kamerabanen er bevart lokalt.")
                }
                if let sourceUpdatedAt = sourceResult.sourceUpdatedAt,
                   !sourceUpdatedAt.trimmingCharacters(
                    in: .whitespacesAndNewlines
                   ).isEmpty {
                    committedSourceSnapshot = .init(
                        strokesJSON: sourceResult.strokesJSON ?? mutation.strokesJSON,
                        layerState: sourceResult.layerState ?? mutation.layerState,
                        shotFraming: authoritativeFraming,
                        sourceUpdatedAt: sourceUpdatedAt)
                }
                committedSourcePaintoverState =
                    sourceResult.paintoverState
                if let pending = PendingStrokeStore.loadDocument(
                    frameId: mutation.frameId),
                   pending.strokesJSON == mutation.strokesJSON,
                   pending.layerState == mutation.layerState,
                   pending.shotFraming == mutation.initialFraming {
                    _ = PendingStrokeStore.clear(
                        frameId: mutation.frameId,
                        ifUnchangedFrom: pending)
                    pendingFrameIds.remove(mutation.frameId)
                }
                await board.reload()
                guard let current = board.scenes
                    .first(where: { $0.id == mutation.sceneId })?
                    .frames.first(where: { $0.id == mutation.frameId })
                else {
                    throw SyncError.serverMessage(
                        "Shotet forsvant mens Start-utsnittet ble lagret.")
                }
                let currentFraming = current.shotFraming ?? ShotFramingState(
                    shotSize: current.shotType,
                    angle: current.angle,
                    lensMm: current.lensMm,
                    aspectRatio: current.drawingWidth
                        / max(1, current.drawingHeight))
                guard currentFraming.canonicalFingerprint
                    == mutation.initialFraming.canonicalFingerprint else {
                    throw SyncError.serverMessage(
                        "Startutsnittet ble ikke bekreftet av serveren. "
                        + "Kamerabanen er bevart lokalt.")
                }
                let currentRevision = current.cameraMotionRevision ?? 0
                let sameBaseMotion = current.cameraMotionTrack
                    == mutation.baseMotionTrack
                    || (mutation.baseMotionFingerprint != nil
                        && current.cameraMotionFingerprint
                            == mutation.baseMotionFingerprint)
                let unchanged = currentRevision == expectedRevision
                    && sameBaseMotion
                let ownFramingRevalidation = expectedRevision < Int.max
                    && currentRevision == expectedRevision + 1
                    && sameBaseMotion
                    && current.cameraMotionStatus == "needsRebase"
                guard unchanged || ownFramingRevalidation else {
                    throw SyncError.serverMessage(
                        "Kamerabanen ble endret på en annen enhet. Din lokale versjon er bevart.")
                }
                expectedRevision = currentRevision
            }

            let response = try await RoleRoomAPIClient.shared
                .patchFrameCameraMotion(
                    manuscriptId: mutation.manuscriptId,
                    sceneId: mutation.sceneId,
                    frameId: mutation.frameId,
                    cameraMotionTrack: mutation.motionTrack,
                    expectedMotionRevision: expectedRevision,
                    shotDuration: mutation.shotDuration)
            if mutation.motionTrack != nil {
                guard response.cameraMotionBaseFramingFingerprint
                    == mutation.initialFraming.canonicalFingerprint else {
                    throw SyncError.serverMessage(
                        "Serveren bandt kamerabanen til feil Start-utsnitt. Den lokale versjonen er bevart.")
                }
            }

            // Reload only the authoritative summary. CanvasState remains the
            // optimistic document and is restored below if a newer local WAL
            // exists.
            await board.reload()
            guard let acknowledgedFrame = board.scenes
                .first(where: { $0.id == mutation.sceneId })?
                .frames.first(where: { $0.id == mutation.frameId })
            else {
                throw SyncError.serverMessage(
                    "Shotet forsvant etter at kamerabanen ble lagret.")
            }
            let acknowledgedFraming = acknowledgedFrame.shotFraming
                ?? ShotFramingState(
                    shotSize: acknowledgedFrame.shotType,
                    angle: acknowledgedFrame.angle,
                    lensMm: acknowledgedFrame.lensMm,
                    aspectRatio: acknowledgedFrame.drawingWidth
                        / max(1, acknowledgedFrame.drawingHeight)
                )
            let authoritative = PendingCameraMotionAuthoritativeBase(
                motionTrack: response.cameraMotionTrack,
                motionRevision: response.cameraMotionRevision,
                motionFingerprint: response.cameraMotionFingerprint,
                motionStatus: response.cameraMotionStatus,
                frameUpdatedAt: response.updatedAt,
                sourceUpdatedAt:
                    response.sourceUpdatedAt
                        ?? acknowledgedFrame.sourceUpdatedAt,
                shotFraming: acknowledgedFraming,
                sourceSnapshot: committedSourceSnapshot
            )

            let isActiveFrame = loadedFrameRef?.frameId == mutation.frameId
            let activeDocumentStillMatches = isActiveFrame
                && canvasState.revision == mutation.localRevision
                && canvasState.shotFraming == mutation.initialFraming
                && canvasState.cameraMotionTrack == mutation.motionTrack

            // Advance the in-memory authoritative base even while CanvasState
            // already contains B. Otherwise the next autosave recreates B on
            // A's stale revision and self-conflicts.
            if isActiveFrame {
                loadedRevision = mutation.localRevision
                loadedFrameUpdatedAt = response.updatedAt
                loadedFrameSourceUpdatedAt = authoritative.sourceUpdatedAt
                loadedFrameShotFraming = acknowledgedFraming
                loadedFrameCameraMotionTrack = response.cameraMotionTrack
                loadedFrameCameraMotionRevision =
                    response.cameraMotionRevision
                loadedFrameCameraMotionFingerprint =
                    response.cameraMotionFingerprint
                loadedFrameCameraMotionStatus =
                    response.cameraMotionStatus
                if let source = committedSourceSnapshot {
                    loadedFrameStrokesJSON = source.strokesJSON
                    loadedFrameLayerState = source.layerState
                    loadedFrameShotFraming = source.shotFraming
                }
                if let state = response.aiPaintoverState
                    ?? committedSourcePaintoverState {
                    loadedFramePaintoverState = state
                }
            }

            let queued = PendingCameraMotionStore.load(
                frameId: mutation.frameId)
            let decision = PendingCameraMotionStore.rebaseDecision(
                acknowledged: mutation,
                queued: queued,
                onto: authoritative
            )
            var hasNewerQueuedIntent = false
            var queueConflict = false
            switch decision {
            case .noNewerMutation:
                if queued == mutation {
                    guard PendingCameraMotionStore.clear(
                        ifUnchangedFrom: mutation
                    ) else {
                        queueConflict = true
                        break
                    }
                }
            case .rebased(let rebased):
                guard let queued,
                      PendingCameraMotionStore.compareAndReplace(
                        queued,
                        with: rebased
                      ) else {
                    queueConflict = true
                    break
                }
                hasNewerQueuedIntent = true
                cameraMotionSyncRequestedAfterCurrent = true
            case .conflict:
                queueConflict = true
            }

            if queueConflict {
                // A third local write or unknown/remote provenance is not a
                // same-client rebase. Preserve it for explicit/later retry.
                cameraMotionSyncRequestedAfterCurrent = false
            } else if isActiveFrame,
                      !activeDocumentStillMatches,
                      !hasNewerQueuedIntent {
                // The published Canvas change reached us before its onChange
                // autosave. Freeze it now against the just-acknowledged base.
                scheduleCameraMotionAutosync()
                hasNewerQueuedIntent = true
            }

            let adoptServerResponse = !queueConflict
                && !hasNewerQueuedIntent
                && (!isActiveFrame || activeDocumentStillMatches)

            guard isActiveFrame else {
                board.syncStatus = queueConflict
                    ? "Nyere kameraredigering har ukjent base · bevart lokalt"
                    : (hasNewerQueuedIntent
                        ? "Nyere kameraredigering venter på synk"
                        : "Kamerabane synket ✓")
                return
            }
            if adoptServerResponse {
                lastObservedShotFraming = acknowledgedFraming
                lastObservedCameraMotionTrack = response.cameraMotionTrack
                canvasState.shotFraming = acknowledgedFraming
                canvasState.cameraMotionTrack = response.cameraMotionTrack
                canvasState.presentationFraming = nil
                board.applyCameraMotionLocally(
                    response.cameraMotionTrack,
                    revision: response.cameraMotionRevision,
                    status: response.cameraMotionStatus,
                    updatedAt: response.cameraMotionUpdatedAt,
                    fingerprint: response.cameraMotionFingerprint,
                    baseFramingFingerprint:
                        response.cameraMotionBaseFramingFingerprint,
                    frameUpdatedAt: response.updatedAt,
                    sourceUpdatedAt: response.sourceUpdatedAt,
                    paintoverState: response.aiPaintoverState,
                    markVideoStale: response.aiPaintoverState == nil)
                board.syncStatus = "Kamerabane synket ✓"
            } else {
                // BoardState was refreshed above; restore B's optimistic
                // presentation without touching its rebased WAL.
                board.applyShotFramingLocally(
                    canvasState.shotFraming,
                    markAIStale: false)
                board.applyCameraMotionLocally(canvasState.cameraMotionTrack)
                board.syncStatus = queueConflict
                    ? "Nyere kameraredigering har ukjent base · bevart lokalt"
                    : "Nyere kameraredigering venter på synk"
            }
        } catch let error as FrameCameraMotionPatchError {
            await board.reload()
            board.syncStatus = error.localizedDescription
        } catch {
            board.syncStatus = error.localizedDescription
        }
    }

    @MainActor
    private func retryPendingCameraMotionForActiveFrame() async {
        guard let frameId = board.frame?.id,
              let mutation = PendingCameraMotionStore.load(frameId: frameId)
        else { return }
        await persistPendingCameraMotion(mutation)
    }

    @MainActor
    private func retryAllPendingCameraMotionMutations() async {
        for mutation in PendingCameraMotionStore.pendingMutations()
        where mutation.manuscriptId == board.manuscript.id {
            guard !Task.isCancelled else { return }
            await persistPendingCameraMotion(mutation)
        }
    }

    // MARK: Inspector

    private var inspector: some View {
        inspectorPanel(isOverlay: false)
    }

    @ViewBuilder
    private func inspectorPanel(isOverlay: Bool) -> some View {
        let content = VStack(spacing: 0) {
            if let frame = board.frame {
                inspectorHeader(frame)
                    .accessibilityIdentifier("storyboard-inspector-v2")
                Divider().overlay(BoardBrand.border)
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        switch selectedInspectorTab {
                        case .shot:
                            shotInspector(frame)
                        case .story:
                            storyInspector(frame)
                        case .production:
                            productionInspector(frame)
                        case .ai:
                            storyboardAIInspector(frame)
                        }
                    }
                    .padding(14)
                }
                .accessibilityIdentifier("storyboard-inspector-scroll")
                .scrollDismissesKeyboard(.interactively)
            } else {
                ContentUnavailableView("Velg et shot", systemImage: "rectangle.on.rectangle")
                    .foregroundStyle(BoardBrand.dim)
            }
        }
        .background(BoardBrand.chrome)
        .onChange(of: board.frame?.id) {
            flushInspectorDrafts()
            loadInspectorDrafts()
        }
        .onChange(of: descriptionDraft) { scheduleInspectorDraftAutosave() }
        .onChange(of: notesDraft) { scheduleInspectorDraftAutosave() }
        .onChange(of: board.frame?.updatedAt) { reconcileInspectorDraft() }
        .onAppear { loadInspectorDrafts() }
        .onDisappear { flushInspectorDrafts() }
        .onChange(of: underlayPickerItem) {
            importSelectedUnderlay()
        }

        if isOverlay {
            content.frame(minWidth: 360, idealWidth: 480, maxWidth: .infinity,
                          maxHeight: .infinity)
        } else {
            content.frame(width: 340)
        }
    }

    private func inspectorHeader(_ frame: FrameSummary) -> some View {
        let readiness = StoryboardReadiness.frame(frame)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("SHOT \(frame.shotNumber)")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    Text(frame.description.isEmpty ? "Ingen handling beskrevet" : frame.description)
                        .font(.system(size: 11))
                        .foregroundStyle(BoardBrand.dim)
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                Label("\(readiness.completed)/\(readiness.total)",
                      systemImage: readiness.progress == 1
                        ? "checkmark.shield.fill" : "checkmark.shield")
                    .font(.system(size: 11, weight: .semibold).monospacedDigit())
                    .foregroundStyle(readiness.progress == 1 ? Color.green : BoardBrand.accent)
                    .accessibilityLabel("Produksjonsklar \(readiness.completed) av \(readiness.total)")
            }
            Picker("Inspector", selection: $selectedInspectorTab) {
                ForEach(BoardInspectorTab.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("inspector-tab-picker")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private func inspectorSection<Content: View>(
        _ title: String, symbol: String, @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title.uppercased(), systemImage: symbol)
                .font(.system(size: 11, weight: .bold))
                .kerning(0.6)
                .foregroundStyle(BoardBrand.label)
            content()
        }
        .padding(12)
        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(BoardBrand.border))
    }

    @ViewBuilder
    private func shotInspector(_ frame: FrameSummary) -> some View {
        let framingQuality = shotFramingQualityReport(frame: frame)
        let aiRecompositionResolved = canvasState.shotFraming.mode == .recomposed
            && StoryboardFrameImagePolicy.usesViewportCoordinates(frame)
        let activeMotionTrack = board.frame?.id == frame.id
            ? canvasState.cameraMotionTrack : frame.cameraMotionTrack
        let selectedMotionPreset = CameraMotionEditorPreset.resolve(
            track: activeMotionTrack)
        inspectorSection("Shot size", symbol: "viewfinder") {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4),
                      spacing: 6) {
                ForEach(["EWS", "WS", "MS", "MCU", "CU", "ECU", "OTS", "POV"],
                        id: \.self) { value in
                    inspectorChoice(value, selected: frame.shotType == value) {
                        applyShotSize(value, frame: frame)
                    }
                }
            }
        }
        .accessibilityIdentifier("inspector-shot-content")

        inspectorSection("Camera", symbol: "camera") {
            inspectorPicker("Angle", value: frame.angle,
                            options: ["Eye level", "Low", "High", "Dutch",
                                      "Bird's-eye", "Worm's-eye"]) {
                applyCameraAngle($0, frame: frame)
            }
            inspectorPicker("Lens", value: frame.lensMm.map { "\($0)mm" },
                            options: ["14mm", "18mm", "24mm", "28mm", "35mm",
                                      "50mm", "85mm", "135mm"]) {
                applyLens(Int($0.replacingOccurrences(of: "mm", with: "")) ?? 35,
                          frame: frame)
            }
        }

        inspectorSection("Aspect ratio", symbol: "rectangle.ratio.16.to.9") {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3),
                      spacing: 6) {
                ForEach(["16:9", "2.39:1", "4:3", "1:1", "9:16"], id: \.self) { label in
                    let value = aspectRatioValue(label)
                    inspectorChoice(
                        label,
                        selected: abs(canvasState.shotFraming.aspectRatio - value) < 0.001
                    ) {
                        applyAspectRatio(value, frame: frame)
                    }
                }
            }
        }

        inspectorSection("Framing", symbol: "crop") {
            HStack(spacing: 8) {
                Label(String(format: "%.2f×", canvasState.shotFraming.zoom),
                      systemImage: "magnifyingglass")
                Text(String(format: "%.1f°", canvasState.shotFraming.rollDegrees))
                Spacer()
                Text(aiRecompositionResolved
                     ? "AI resolved" : canvasState.shotFraming.mode.rawValue.capitalized)
                    .foregroundStyle(aiRecompositionResolved
                        ? Color.green
                        : canvasState.shotFraming.mode == .recomposed
                            ? Color.orange : BoardBrand.accent)
            }
            .font(.system(size: 11, weight: .semibold).monospacedDigit())
            .foregroundStyle(BoardBrand.dim)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("shot-framing-status")

            if canvasState.shotFraming.mode == .recomposed
                && !aiRecompositionResolved {
                VStack(alignment: .leading, spacing: 7) {
                    Label("Vinkel eller optikk endrer perspektiv. Utsnittet er en trygg 2D-preview og må rekomponeres av AI før animasjon.",
                          systemImage: "wand.and.rays")
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundStyle(.orange)
                    Button {
                        selectedInspectorTab = .ai
                        pendingImageStageGeneration = "color"
                    } label: {
                        Label("Rekomponer med AI", systemImage: "sparkles")
                    }
                    .buttonStyle(.bordered)
                    .tint(.orange)
                    .accessibilityIdentifier("recompose-shot-with-ai")
                }
            }

            HStack(spacing: 7) {
                Button {
                    isReframing.toggle()
                } label: {
                    Label(isReframing ? "Ferdig" : "Juster utsnitt",
                          systemImage: isReframing ? "checkmark" : "viewfinder")
                }
                .buttonStyle(.borderedProminent)
                .tint(BoardBrand.accent)
                .accessibilityIdentifier("adjust-shot-framing")

                Button("Auto") {
                    applyShotSize(canvasState.shotFraming.shotSize
                        ?? frame.shotType ?? "WS", frame: frame)
                }
                .buttonStyle(.bordered)

                Button("Reset") { resetFraming(frame: frame) }
                    .buttonStyle(.bordered)
            }
            .font(.system(size: 11, weight: .semibold))

            if frame.aiOutputStale {
                Label("Farge/atmosfære er eldre enn dette utsnittet. Regenerer før animasjon.",
                      systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 10.5, weight: .medium))
                    .foregroundStyle(.orange)
            }

            if framingQuality.issues.isEmpty {
                Label("Produksjonsklart utsnitt",
                      systemImage: "checkmark.seal.fill")
                    .font(.system(size: 10.5, weight: .medium))
                    .foregroundStyle(.green)
                    .accessibilityIdentifier("shot-framing-quality-ok")
            } else {
                ForEach(Array(framingQuality.issues.enumerated()), id: \.offset) {
                    _, issue in
                    Label(shotFramingQualityText(issue.code),
                          systemImage: issue.severity == .error
                            ? "xmark.octagon.fill" : "exclamationmark.triangle.fill")
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundStyle(issue.severity == .error ? Color.red : Color.orange)
                }
                .accessibilityIdentifier("shot-framing-quality-issues")
            }
        }

        inspectorSection("Movement", symbol: "move.3d") {
            Label(
                cameraMotionStatusText(frame: frame, track: activeMotionTrack),
                systemImage: cameraMotionStatusSymbol(frame: frame)
            )
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(cameraMotionStatusColor(frame: frame))
            .accessibilityIdentifier("camera-motion-status")

            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: 6
            ) {
                ForEach(CameraMotionEditorPreset.allCases.filter {
                    $0 != .custom
                }) { preset in
                    inspectorChoice(
                        preset.label,
                        selected: selectedMotionPreset == preset
                    ) {
                        openCameraMotionEditor(
                            frame: frame,
                            applying: preset)
                    }
                }
            }

            Button {
                openCameraMotionEditor(frame: frame, applying: nil)
            } label: {
                Label("Open Start / End editor", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                    .font(.system(size: 11, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 34)
            }
            .buttonStyle(.borderedProminent)
            .tint(BoardBrand.accent)
            .disabled(cameraMotionSyncInFlight)
            .accessibilityIdentifier("open-camera-motion-editor")
            HStack {
                Text("DURATION")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(BoardBrand.label)
                Spacer()
                inspectorStepButton("minus") {
                    adjustShotDuration(frame: frame, deltaSeconds: -0.5)
                }
                .disabled(!canAdjustShotDuration(frame: frame))
                Text(String(format: "%.1f sec", frame.effectiveShotDuration.seconds))
                    .font(.system(size: 13, weight: .semibold).monospacedDigit())
                    .foregroundStyle(.white)
                    .frame(minWidth: 58)
                inspectorStepButton("plus") {
                    adjustShotDuration(frame: frame, deltaSeconds: 0.5)
                }
                .disabled(!canAdjustShotDuration(frame: frame))
            }
        }

        DisclosureGroup {
            VStack(spacing: 10) {
                inspectorPicker("Transition", value: frame.transition,
                                options: ["Cut", "Dissolve", "Match Cut", "Smash Cut", "Wipe", "Fade"]) {
                    board.patchActiveFrame(["transition": $0])
                }
                inspectorPicker("Focus / Depth", value: frame.focusDepth,
                                options: ["Shallow", "Deep"]) {
                    board.patchActiveFrame(["focusDepth": $0])
                }
                inspectorPicker("Time of day", value: frame.timeOfDay,
                                options: ["Day", "Night", "Dawn", "Dusk"]) {
                    board.patchActiveFrame(["timeOfDay": $0])
                }
                inspectorPicker("Weather", value: frame.weather,
                                options: ["Clear", "Rain", "Snow", "Overcast", "Fog"]) {
                    board.patchActiveFrame(["weather": $0])
                }
            }
            .padding(.top, 8)
        } label: {
            Label("Advanced camera", systemImage: "slider.horizontal.3")
                .font(.system(size: 12, weight: .semibold))
        }
        .tint(BoardBrand.accent)
        .padding(12)
        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func storyInspector(_ frame: FrameSummary) -> some View {
        inspectorSection("Action / Dialog", symbol: "text.bubble") {
            TextField("Hva skjer i shotet…", text: $descriptionDraft, axis: .vertical)
                .lineLimit(3...7)
                .font(.system(size: 13))
                .foregroundStyle(.white)
                .padding(10)
                .background(Color.black.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
                .onSubmit { flushInspectorDrafts() }
                .accessibilityIdentifier("inspector-action-field")
        }
        .accessibilityIdentifier("inspector-story-content")

        inspectorSection("Story beat", symbol: "waveform.path") {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                ForEach(["ESTABLISHING", "TENSION", "BEAT", "ACTION",
                         "DIALOGUE", "RESOLUTION"], id: \.self) { value in
                    inspectorChoice(value, selected: frame.beatTag == value) {
                        board.patchActiveFrame(["beatTag": value])
                    }
                }
            }
        }

        inspectorSection("Notes", symbol: "note.text") {
            TextField("Produksjonsnotater…", text: $notesDraft, axis: .vertical)
                .lineLimit(3...7)
                .font(.system(size: 13))
                .foregroundStyle(.white)
                .padding(10)
                .background(Color.black.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
                .onSubmit { flushInspectorDrafts() }
                .accessibilityIdentifier("inspector-notes-field")
        }

        inspectorSection("Tags", symbol: "tag") {
            FlowTags(tags: frame.tags) { removed in
                board.patchActiveFrame(["tags": frame.tags.filter { $0 != removed }])
            }
            HStack(spacing: 6) {
                TextField("Ny tag", text: $tagDraft)
                    .font(.system(size: 12))
                    .foregroundStyle(.white)
                    .textInputAutocapitalization(.characters)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 44)
                    .background(Color.black.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
                    .onSubmit { addTag(frame: frame) }
                Button { addTag(frame: frame) } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(BoardBrand.accent, in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .disabled(tagDraft.trimmingCharacters(in: .whitespaces).isEmpty)
                .accessibilityLabel("Legg til tag")
            }
        }
    }

    @ViewBuilder
    private func productionInspector(_ frame: FrameSummary) -> some View {
        productionReadinessPanel(frame)
            .accessibilityIdentifier("inspector-production-content")
        inspectorSection("Scenario / AI context", symbol: "shippingbox") {
            scenarioInspector(frame)
        }
        inspectorSection("Underlag", symbol: "photo.on.rectangle") {
            underlayInspector(frame)
        }
    }

    private func inspectorChoice(
        _ value: String, selected: Bool, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if selected { Image(systemName: "checkmark") }
                Text(value).lineLimit(1).minimumScaleFactor(0.75)
            }
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(selected ? Color.white : BoardBrand.dim)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(selected ? BoardBrand.accent : Color.white.opacity(0.055),
                        in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(value)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func inspectorStepButton(
        _ symbol: String, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(symbol == "plus" ? "Øk varighet" : "Reduser varighet")
    }

    @ViewBuilder
    private func underlayInspector(_ frame: FrameSummary) -> some View {
        HStack(spacing: 8) {
            PhotosPicker(selection: $underlayPickerItem, matching: .images) {
                Label(frame.underlayDataURL == nil ? "Velg foto" : "Bytt foto",
                      systemImage: "photo.badge.plus")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 8))
            }
            if frame.underlayDataURL != nil {
                Button {
                    board.patchActiveFrame([
                        "underlayDataURL": NSNull(), "underlayOpacity": NSNull(),
                    ])
                    renderer?.setUnderlay(cgImage: nil, opacity: 0)
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(.red)
                        .frame(width: 44, height: 44)
                        .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Fjern underlag")
            }
        }
        if frame.underlayDataURL != nil {
            HStack(spacing: 10) {
                Slider(value: Binding(
                    get: { frame.underlayOpacity ?? 0.4 },
                    set: { value in
                        board.patchActiveFrame(["underlayOpacity": value])
                        applyUnderlay(to: renderer)
                    }), in: 0.05...0.9)
                    .tint(BoardBrand.accent)
                Text("\(Int((frame.underlayOpacity ?? 0.4) * 100))%")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(BoardBrand.dim)
                    .frame(width: 38)
            }
        }
    }

    @State private var notesDraft = ""
    @State private var descriptionDraft = ""
    @State private var inspectorDraftReference: InspectorDraftReference?
    @State private var lastSavedDescription = ""
    @State private var lastSavedNotes = ""
    @State private var inspectorAutosaveTask: Task<Void, Never>?
    @State private var tagDraft = ""
    @State private var underlayPickerItem: PhotosPickerItem?
    @State private var tipPickerItem: PhotosPickerItem?
    @State private var imageImportFrameId: String?
    @State private var frameImagePickerItem: PhotosPickerItem?
    @State private var sheetImportPickerItem: PhotosPickerItem?
    @State private var sheetImportGrid: (columns: Int, rows: Int) = (4, 3)
    @State private var showSheetImportDialog = false
    @State private var showPresentationSetup = false
    @State private var presentationConceptDraft = ""
    @State private var presentationFooterDraft: [PresentationFooter.Section] = PresentationFooter.defaults
    @State private var renameSceneId: String?
    @State private var renameSceneDraft = ""
    @State private var pendingDeleteSceneId: String?
    @State private var draggedFrameId: String?
    @StateObject private var reauthSync = SyncState()
    @State private var showReauth = false
    @State private var presentOthers: [String] = []
    @State private var canUndoSceneDelete = false
    @State private var historyFrameRef: (sceneId: String, frameId: String)?
    @State private var historyEntries: [(updatedAt: String, strokes: String)] = []
    @State private var showHistorySheet = false
    @State private var pdfExportProgress: String?
    @State private var pdfExportFailed = false
    @State private var heroReport: HeroReport?
    @State private var syncInFlight = false
    @State private var syncRequestedAfterCurrent = false

    private func exportPDF(includeUnderlay: Bool) {
        pdfExportProgress = "…"
        let scenes = effectiveScenesForRendering()
        Task {
            let result = await BoardPDFExporter.export(
                projectTitle: board.manuscript.title, scenes: scenes,
                includeUnderlay: includeUnderlay,
                progress: { done, total in pdfExportProgress = "\(done)/\(total)" })
            if let result {
                exportPDFURL = result
            } else {
                pdfExportFailed = true
            }
            pdfExportProgress = nil
        }
    }
    // Onion-skin: 0=av, 1=forrige, 2=forrige+neste, 3=to tilbake.
    @State private var onionMode = 0
    // Perspektiv-hjelpelinjer: 0=av, 1/2/3-punkts. VP-er normalisert 0–1
    // (y>1 = under canvas for 3-punkts). Kun visning — aldri i data/eksport.
    @State private var perspectiveMode = 0
    @State private var vanishingPoints: [CGPoint] = []
    @State private var perspectiveSnap = false
    // Lasso-transform (transient under gest)
    @State private var selectionScaleFactor: CGFloat = 1
    @State private var selectionRotationAngle: Double = 0

    private func loadInspectorDrafts() {
        inspectorAutosaveTask?.cancel()
        guard let scene = board.scene, let frame = board.frame else {
            inspectorDraftReference = nil
            lastSavedDescription = ""
            lastSavedNotes = ""
            descriptionDraft = ""
            notesDraft = ""
            return
        }
        inspectorDraftReference = InspectorDraftReference(
            sceneId: scene.id, frameId: frame.id)
        lastSavedDescription = frame.description
        lastSavedNotes = frame.notes ?? ""
        if let pending = InspectorTextDraftStore.load(frameId: frame.id),
           pending.sceneId == scene.id {
            descriptionDraft = pending.description
            notesDraft = pending.notes
        } else {
            descriptionDraft = frame.description
            notesDraft = frame.notes ?? ""
        }
    }

    private func scheduleInspectorDraftAutosave() {
        guard inspectorDraftReference != nil,
              descriptionDraft != lastSavedDescription || notesDraft != lastSavedNotes else {
            return
        }
        if let reference = inspectorDraftReference {
            InspectorTextDraftStore.save(InspectorTextDraft(
                sceneId: reference.sceneId, frameId: reference.frameId,
                description: descriptionDraft, notes: notesDraft, updatedAt: Date()))
        }
        inspectorAutosaveTask?.cancel()
        inspectorAutosaveTask = Task {
            try? await Task.sleep(nanoseconds: 650_000_000)
            guard !Task.isCancelled else { return }
            flushInspectorDrafts()
        }
    }

    /// Saves against the captured scene/shot reference so a fast scene switch
    /// cannot accidentally write the previous draft into the newly selected shot.
    private func flushInspectorDrafts() {
        inspectorAutosaveTask?.cancel()
        guard let reference = inspectorDraftReference else { return }
        var fields: [String: any Sendable] = [:]
        if descriptionDraft != lastSavedDescription {
            fields["description"] = descriptionDraft
        }
        if notesDraft != lastSavedNotes {
            fields["notes"] = notesDraft
        }
        guard !fields.isEmpty else { return }
        lastSavedDescription = descriptionDraft
        lastSavedNotes = notesDraft
        board.patchFrame(
            sceneId: reference.sceneId, frameId: reference.frameId, fields: fields)
    }

    private func reconcileInspectorDraft() {
        guard let reference = inspectorDraftReference,
              let frame = board.frame, frame.id == reference.frameId,
              let pending = InspectorTextDraftStore.load(frameId: reference.frameId),
              frame.description == pending.description,
              (frame.notes ?? "") == pending.notes else { return }
        InspectorTextDraftStore.clear(frameId: reference.frameId)
        lastSavedDescription = frame.description
        lastSavedNotes = frame.notes ?? ""
    }

    private func importSelectedBrushTip() {
        guard let item = tipPickerItem else { return }
        tipPickerItem = nil
        let isStamp = canvasState.brushType == .stamp
        Task {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else { return }
            let maxSide = 256.0
            let scaleFactor = min(1, maxSide / max(image.size.width, image.size.height))
            let size = CGSize(width: image.size.width * scaleFactor,
                              height: image.size.height * scaleFactor)
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let scaled = UIGraphicsImageRenderer(size: size, format: format).image { _ in
                image.draw(in: CGRect(origin: .zero, size: size))
            }
            guard let png = scaled.pngData() else { return }
            let dataURL = "data:image/png;base64," + png.base64EncodedString()
            if isStamp {
                canvasState.stampTipDataURL = dataURL
                UserDefaults.standard.set(dataURL, forKey: "sb.stampTip")
            } else {
                canvasState.customTipDataURL = dataURL
                UserDefaults.standard.set(dataURL, forKey: "sb.customTip")
            }
        }
    }

    private func importSelectedUnderlay() {
        guard let item = underlayPickerItem else { return }
        underlayPickerItem = nil
        Task {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else { return }
            let maxSide = 1280.0
            let scale = min(1, maxSide / max(image.size.width, image.size.height))
            let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let scaled = UIGraphicsImageRenderer(size: size, format: format).image { _ in
                image.draw(in: CGRect(origin: .zero, size: size))
            }
            guard let jpeg = scaled.jpegData(compressionQuality: 0.6) else { return }
            let dataURL = "data:image/jpeg;base64," + jpeg.base64EncodedString()
            board.patchActiveFrame([
                "underlayDataURL": dataURL,
                "underlayOpacity": board.frame?.underlayOpacity ?? 0.4,
            ])
            renderer?.setUnderlay(
                cgImage: scaled.cgImage, opacity: board.frame?.underlayOpacity ?? 0.4)
        }
    }

    private func addTag(frame: FrameSummary) {
        let tag = tagDraft.trimmingCharacters(in: .whitespaces).uppercased()
        tagDraft = ""
        guard !tag.isEmpty, !frame.tags.contains(tag) else { return }
        board.patchActiveFrame(["tags": frame.tags + [tag]])
    }

    private func productionReadinessPanel(_ frame: FrameSummary) -> some View {
        let status = StoryboardReadiness.frame(frame)
        let frameIssues = StoryboardProductionAnalysis.continuityIssues(scenes: board.scenes)
            .filter { $0.sceneIndex == board.selectedSceneIndex
                && $0.frameIndex == board.activeFrameIndex }
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("PRODUCTION READY", systemImage: "checkmark.shield")
                    .font(.system(size: 11, weight: .bold)).kerning(0.5)
                    .foregroundStyle(BoardBrand.label)
                Spacer()
                Text("\(status.completed)/\(status.total)")
                    .font(.system(size: 11, weight: .semibold).monospacedDigit())
                    .foregroundStyle(status.progress == 1 ? Color.green : BoardBrand.accent)
            }
            ProgressView(value: status.progress)
                .tint(status.progress == 1 ? .green : BoardBrand.accent)
            if !status.missing.isEmpty {
                Text("Mangler: " + status.missing.prefix(3).joined(separator: " · "))
                    .font(.system(size: 11)).foregroundStyle(BoardBrand.dim).lineLimit(2)
            }
            if !frameIssues.isEmpty {
                Label("\(frameIssues.count) mulig continuity-avvik",
                      systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(.orange)
            }
            Button { showProductionDashboard = true } label: {
                HStack {
                    Text("Åpne Production Health")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.system(size: 12, weight: .semibold))
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(.white)
        }
        .padding(10)
        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(BoardBrand.border))
    }

    @ViewBuilder
    private func scenarioInspector(_ frame: FrameSummary) -> some View {
        let selection = effectiveScenario(frame)
        let pack = board.scenarioPacks.first { $0.id == selection?.packId }
        let subdomain = pack?.subdomains.first { $0.id == selection?.subdomainId }
        let zone = subdomain?.zones.first { $0.id == selection?.zoneId }

        if board.scenarioPacks.isEmpty {
            Text(board.scenarioCatalogError ?? "Laster scenario-katalog …")
                .font(.system(size: 11))
                .foregroundStyle(BoardBrand.dim)
        } else {
            scenarioPicker("Pakke", value: pack?.label, options: board.scenarioPacks) {
                $0.label
            } onSelect: { selectScenarioPack($0) }

            if let pack {
                scenarioPicker("Miljø", value: subdomain?.label, options: pack.subdomains) {
                    $0.label
                } onSelect: { selectScenarioSubdomain($0, in: pack) }

                if let subdomain {
                    scenarioPicker("Sone", value: zone?.label, options: subdomain.zones) {
                        $0.label
                    } onSelect: { selectScenarioZone($0, pack: pack, subdomain: subdomain) }

                    scenarioMultiSelect(
                        "Roller", options: subdomain.roles,
                        selected: selection?.roleIds ?? []) { values in
                            patchScenarioSelection(selection, field: "scenarioRoleIds", values: values)
                        }
                    scenarioMultiSelect(
                        "Props", options: subdomain.propTypes,
                        selected: selection?.propTypeIds ?? []) { values in
                            patchScenarioSelection(selection, field: "scenarioPropTypeIds", values: values)
                        }
                    scenarioMultiSelect(
                        "Handling", options: subdomain.actions,
                        selected: selection?.actionIds ?? []) { values in
                            patchScenarioSelection(selection, field: "scenarioActionIds", values: values)
                        }
                    scenarioMultiSelect(
                        "Tilstand", options: subdomain.states,
                        selected: selection?.stateIds ?? []) { values in
                            patchScenarioSelection(selection, field: "scenarioStateIds", values: values)
                        }
                    scenarioMultiSelect(
                        "Continuity", options: subdomain.continuityLocks,
                        selected: selection?.continuityLockIds ?? []) { values in
                            patchScenarioSelection(selection, field: "scenarioContinuityLockIds", values: values)
                        }
                }

                HStack(spacing: 6) {
                    Image(systemName: selection?.packVersion == pack.version
                          && zone != nil ? "checkmark.shield.fill" : "exclamationmark.triangle.fill")
                    Text(selection?.packVersion == pack.version && zone != nil
                         ? "Prompt Engine · v\(pack.version)"
                           + (selection?.inheritedFromScene == true ? " · arvet fra scene" : " · shot override")
                         : "Velg gyldig miljø/sone for v\(pack.version)")
                    Spacer(minLength: 0)
                    Menu {
                        if let selection {
                            Button("Bruk på hele scenen") {
                                board.patchActiveScene(selection.patchFields)
                            }
                        }
                        Button("Arv fra scene") { clearScenario() }
                        Button("Fjern fra shot", role: .destructive) { clearScenario() }
                    } label: { Image(systemName: "ellipsis.circle") }
                        .buttonStyle(.plain)
                        .foregroundStyle(BoardBrand.dim)
                }
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(selection?.packVersion == pack.version && zone != nil
                                 ? BoardBrand.accent : Color.orange)

                ForEach(scenarioContinuityWarnings(frame), id: \.self) { warning in
                    Label(warning, systemImage: "exclamationmark.triangle")
                        .font(.system(size: 9))
                        .foregroundStyle(Color.orange)
                }
            }
        }
    }

    private func effectiveScenario(_ frame: FrameSummary) -> BoardScenarioSelection? {
        let scene = board.scene
        let useFrame = frame.scenarioPackId != nil
        guard let packId = useFrame ? frame.scenarioPackId : scene?.scenarioPackId,
              let version = useFrame ? frame.scenarioPackVersion : scene?.scenarioPackVersion,
              let subdomainId = useFrame ? frame.scenarioSubdomainId : scene?.scenarioSubdomainId,
              let zoneId = useFrame ? frame.scenarioZoneId : scene?.scenarioZoneId else { return nil }
        return BoardScenarioSelection(
            packId: packId, packVersion: version, subdomainId: subdomainId, zoneId: zoneId,
            roleIds: useFrame ? frame.scenarioRoleIds : scene?.scenarioRoleIds ?? [],
            propTypeIds: useFrame ? frame.scenarioPropTypeIds : scene?.scenarioPropTypeIds ?? [],
            actionIds: useFrame ? frame.scenarioActionIds : scene?.scenarioActionIds ?? [],
            stateIds: useFrame ? frame.scenarioStateIds : scene?.scenarioStateIds ?? [],
            continuityLockIds: useFrame
                ? frame.scenarioContinuityLockIds : scene?.scenarioContinuityLockIds ?? [],
            inheritedFromScene: !useFrame)
    }

    @ViewBuilder
    private func scenarioMultiSelect(
        _ label: String, options: [StoryboardScenarioOptionSummary], selected: [String],
        onChange: @escaping ([String]) -> Void
    ) -> some View {
        if !options.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                panelLabel(label)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 5) {
                        ForEach(options) { option in
                            let active = selected.contains(option.id)
                            Button(option.label) {
                                onChange(active
                                    ? selected.filter { $0 != option.id }
                                    : selected + [option.id])
                            }
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(active ? Color.white : BoardBrand.dim)
                            .padding(.horizontal, 9)
                            .frame(minHeight: 44)
                            .background(active ? BoardBrand.accent : Color.white.opacity(0.05),
                                        in: Capsule())
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(active ? .isSelected : [])
                        }
                    }
                }
            }
        }
    }

    private func patchScenarioSelection(
        _ selection: BoardScenarioSelection?, field: String, values: [String]
    ) {
        guard let selection else { return }
        var fields = selection.patchFields
        fields[field] = values
        board.patchActiveFrame(fields)
    }

    private func scenarioContinuityWarnings(_ frame: FrameSummary) -> [String] {
        guard let scene = board.scene,
              let index = scene.frames.firstIndex(where: { $0.id == frame.id }),
              let current = effectiveScenario(frame) else { return [] }
        let neighbours = [index > 0 ? scene.frames[index - 1] : nil,
                          index + 1 < scene.frames.count ? scene.frames[index + 1] : nil]
            .compactMap { $0 }.compactMap(effectiveScenario)
        var warnings: [String] = []
        for other in neighbours {
            if current.packId != other.packId || current.packVersion != other.packVersion {
                warnings.append("Scenario-pakke avviker fra naboshot")
            } else if current.zoneId != other.zoneId {
                warnings.append("Sone avviker – kontroller geografi/skjermretning")
            }
            if Set(current.roleIds) != Set(other.roleIds) {
                warnings.append("Rollevalg avviker fra naboshot")
            }
            if Set(current.propTypeIds) != Set(other.propTypeIds) {
                warnings.append("Propvalg avviker fra naboshot")
            }
        }
        return Array(Set(warnings)).sorted()
    }

    private func selectScenarioPack(_ id: String) {
        guard let pack = board.scenarioPacks.first(where: { $0.id == id }),
              let subdomain = pack.subdomains.first,
              let zone = subdomain.zones.first else { return }
        board.patchActiveFrame([
            "scenarioPackId": pack.id,
            "scenarioPackVersion": pack.version,
            "scenarioSubdomainId": subdomain.id,
            "scenarioZoneId": zone.id,
            "scenarioRoleIds": [String](),
            "scenarioPropTypeIds": [String](),
            "scenarioActionIds": [String](),
            "scenarioStateIds": [String](),
            "scenarioContinuityLockIds": subdomain.continuityLocks.map(\.id),
        ])
    }

    private func selectScenarioSubdomain(
        _ id: String, in pack: StoryboardScenarioPackSummary
    ) {
        guard let subdomain = pack.subdomains.first(where: { $0.id == id }),
              let zone = subdomain.zones.first else { return }
        board.patchActiveFrame([
            "scenarioPackId": pack.id,
            "scenarioPackVersion": pack.version,
            "scenarioSubdomainId": subdomain.id,
            "scenarioZoneId": zone.id,
            "scenarioRoleIds": [String](),
            "scenarioPropTypeIds": [String](),
            "scenarioActionIds": [String](),
            "scenarioStateIds": [String](),
            "scenarioContinuityLockIds": subdomain.continuityLocks.map(\.id),
        ])
    }

    private func selectScenarioZone(
        _ id: String,
        pack: StoryboardScenarioPackSummary,
        subdomain: StoryboardScenarioSubdomainSummary
    ) {
        guard subdomain.zones.contains(where: { $0.id == id }) else { return }
        var fields: [String: any Sendable] = [
            "scenarioPackId": pack.id,
            "scenarioPackVersion": pack.version,
            "scenarioSubdomainId": subdomain.id,
            "scenarioZoneId": id,
        ]
        if let current = board.frame.flatMap(effectiveScenario),
           current.packId == pack.id, current.subdomainId == subdomain.id {
            fields["scenarioRoleIds"] = current.roleIds
            fields["scenarioPropTypeIds"] = current.propTypeIds
            fields["scenarioActionIds"] = current.actionIds
            fields["scenarioStateIds"] = current.stateIds
            fields["scenarioContinuityLockIds"] = current.continuityLockIds
        }
        board.patchActiveFrame(fields)
    }

    private func clearScenario() {
        board.patchActiveFrame([
            "scenarioPackId": NSNull(),
            "scenarioPackVersion": NSNull(),
            "scenarioSubdomainId": NSNull(),
            "scenarioZoneId": NSNull(),
            "scenarioRoleIds": [String](),
            "scenarioPropTypeIds": [String](),
            "scenarioActionIds": [String](),
            "scenarioStateIds": [String](),
            "scenarioContinuityLockIds": [String](),
        ])
    }

    private var approvedColorVersion: StoryboardAIImageVersionSummary? {
        return imageStageVersions.last {
            $0.stage == "color" && $0.isApproved && imageVersionMatchesActiveFrame($0)
        }
    }

    private var approvedAtmosphereVersion: StoryboardAIImageVersionSummary? {
        let changes = activePaintoverChanges()
        guard loadedFramePaintoverState?.atmosphereStale == false,
              !changes.colorChanged else { return nil }
        return imageStageVersions.last {
            $0.stage == "atmosphere" && $0.isApproved && imageVersionMatchesActiveFrame($0)
        }
    }

    private var approvedAnimationVersion: StoryboardAIImageVersionSummary? {
        switch StoryboardPaintoverStageSelection.animationStage(
            hasApprovedColor: approvedColorVersion != nil,
            hasApprovedAtmosphere: approvedAtmosphereVersion != nil,
            state: loadedFramePaintoverState,
            localChanges: activePaintoverChanges()) {
        case .atmosphere: return approvedAtmosphereVersion
        case .color: return approvedColorVersion
        case nil: return nil
        }
    }

    private var approvedAnimationStageLabel: String {
        approvedAnimationVersion?.stage == "atmosphere"
            ? "Approved AI Atmosphere" : "Approved AI Color"
    }

    private func videoBelongsToCurrentActiveSource(
        _ frame: FrameSummary
    ) -> Bool {
        let changes = activePaintoverChanges()
        guard !changes.pencilChanged, !changes.colorChanged,
              !changes.atmosphereChanged else { return false }
        return StoryboardVideoPlaybackPolicy.belongsToCurrentSource(frame)
    }

    @ViewBuilder
    private func storyboardAIInspector(_ frame: FrameSummary) -> some View {
        let action = aiInspectorPrimaryAction
        let videoModels = board.aiModels.filter { $0.modality == "video" }
        let selectedModel = videoModels.first { $0.id == selectedVideoModelId }

        inspectorSection("AI pipeline", symbol: "wand.and.stars") {
            VStack(spacing: 0) {
                aiPipelineRow(
                    "Pencil source", state: .approved,
                    detail: "Original drawing · immutable")
                aiPipelineConnector(active: approvedColorVersion != nil)
                aiPipelineRow(
                    "AI Color", state: aiStageState("color"),
                    detail: aiStageDetail("color"))
                aiPipelineConnector(active: approvedAtmosphereVersion != nil)
                aiPipelineRow(
                    "AI Atmosphere", state: aiStageState("atmosphere"),
                    detail: aiStageDetail("atmosphere"))
                aiPipelineConnector(
                    active: videoBelongsToCurrentActiveSource(frame))
                aiPipelineRow(
                    "Animation",
                    state: videoBelongsToCurrentActiveSource(frame)
                        ? .approved
                        : isActiveVideoJobStatus(frame.aiVideoStatus) ? .candidate : .waiting,
                    detail: videoBelongsToCurrentActiveSource(frame)
                        ? "Ready in Animatic"
                        : isActiveVideoJobStatus(frame.aiVideoStatus)
                            ? "Provider job is already running" : "Requires approved image")
            }

            Button { performAIInspectorPrimaryAction(action) } label: {
                HStack {
                    if aiInFlight {
                        ProgressView().controlSize(.small).tint(.white)
                    } else {
                        Image(systemName: action.symbol)
                    }
                    Text(aiInFlight ? (aiStatus ?? "Working …") : action.label)
                    Spacer()
                    if !aiInFlight { Image(systemName: "arrow.right") }
                }
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(BoardBrand.accent, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .disabled(
                aiInFlight || board.projectId == nil
                    || action == .animationInProgress)
            .accessibilityIdentifier("ai-primary-action")

            if action == .animate {
                Menu {
                    ForEach(videoModels) { model in
                        Button {
                            selectedVideoModelId = model.id
                        } label: {
                            Label(
                                model.label + String(
                                    format: " · ~$%.2f/5s", model.estimatedCostUsd),
                                systemImage: model.configured
                                    ? "checkmark.circle" : "xmark.circle")
                        }
                    }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("VIDEO MODEL")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(BoardBrand.label)
                            Text(selectedModel?.label ?? "Seedance 2")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                        Spacer()
                        if let selectedModel {
                            Text(String(format: "~$%.2f / 5s", selectedModel.estimatedCostUsd))
                                .font(.system(size: 11).monospacedDigit())
                                .foregroundStyle(BoardBrand.dim)
                        }
                        Image(systemName: "chevron.up.chevron.down")
                            .foregroundStyle(BoardBrand.dim)
                    }
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("ai-video-model-picker")
            } else {
                Label("GPT Image 2 · HD · confirmation before credits",
                      systemImage: "creditcard")
                    .font(.system(size: 11))
                    .foregroundStyle(BoardBrand.dim)
            }
        }
        .accessibilityIdentifier("inspector-ai-content")

        inspectorSection("Control", symbol: "switch.2") {
            Button { inspectActivePrompt() } label: {
                inspectorNavigationRow(
                    "Prompt Inspector", detail: "Inherited context and compiled prompt",
                    symbol: "doc.text.magnifyingglass")
            }
            .buttonStyle(.plain)
            .disabled(aiInFlight || board.projectId == nil)
            .accessibilityIdentifier("open-prompt-inspector")

            Button { showAIVersionBrowser = true } label: {
                inspectorNavigationRow(
                    "Versions", detail: "\(imageStageVersions.count) candidates",
                    symbol: "photo.stack")
            }
            .buttonStyle(.plain)
            .disabled(imageStageVersions.isEmpty)
            .accessibilityIdentifier("ai-version-browser")
        }

        if let aiStatus, !aiInFlight {
            Label(aiStatus, systemImage: "info.circle")
                .font(.system(size: 11))
                .foregroundStyle(BoardBrand.dim)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private enum AIPipelineVisualState {
        case waiting
        case candidate
        case approved
    }

    private var aiInspectorPrimaryAction: AIInspectorPrimaryAction {
        if isActiveVideoJobStatus(board.frame?.aiVideoStatus) {
            return .animationInProgress
        }
        if let frame = board.frame, frame.aiOutputStale {
            let fingerprint = canvasState.shotFraming.canonicalFingerprint
            let colorSourceChanged = frame.aiOutputStaleReason != "atmosphere-framing-stale"
            if colorSourceChanged || frame.aiColorFramingFingerprint != fingerprint {
                return latestImageCandidate(stage: "color") == nil
                    ? .generateColor : .reviewColor
            }
            return latestImageCandidate(stage: "atmosphere") == nil
                ? .generateAtmosphere : .reviewAtmosphere
        }
        if approvedColorVersion == nil {
            return latestImageCandidate(stage: "color") == nil ? .generateColor : .reviewColor
        }
        if approvedAtmosphereVersion == nil {
            return latestImageCandidate(stage: "atmosphere") == nil
                ? .generateAtmosphere : .reviewAtmosphere
        }
        return .animate
    }

    private func latestImageCandidate(stage: String) -> StoryboardAIImageVersionSummary? {
        imageStageVersions.last {
            $0.stage == stage && $0.status == "generated"
                && imageVersionMatchesActiveFrame($0)
        }
    }

    private func imageVersionMatchesActiveFrame(
        _ version: StoryboardAIImageVersionSummary
    ) -> Bool {
        guard version.frameId == board.frame?.id
            && version.storyboardId == (imageStageStoryboardId ?? board.frame?.aiStoryboardId)
            && version.framingFingerprint
                == canvasState.shotFraming.canonicalFingerprint else { return false }
        let changes = activePaintoverChanges()
        guard AIImageStagePaintoverPolicy.matches(
            stage: version.stage,
            isApproved: version.isApproved,
            capturedColorRevision: version.paintoverColorRevision,
            capturedColorFingerprint: version.paintoverColorFingerprint,
            state: loadedFramePaintoverState,
            localChanges: changes) else { return false }
        return AIImageVersionRevisionPolicy.matches(
            candidateSourceRevision: version.sourceRevision,
            authoritativeSourceRevision: currentAIImageSourceRevision,
            generatedDocumentRevision: nil,
            // Approved/generated bases depend on Drawing/framing; editable
            // Color/Atmosphere remain separate overlays. Their stage-specific
            // identity checks above replace the old blanket revision gate.
            currentDocumentRevision: loadedRevision,
            loadedDocumentRevision: loadedRevision,
            isApproved: version.isApproved,
            frameIsStale: board.frame?.aiOutputStale ?? true)
    }

    private func performAIInspectorPrimaryAction(_ action: AIInspectorPrimaryAction) {
        switch action {
        case .generateColor:
            pendingImageStageGeneration = "color"
        case .reviewColor:
            pendingImageStageVersion = latestImageCandidate(stage: "color")
        case .generateAtmosphere:
            pendingImageStageGeneration = "atmosphere"
        case .reviewAtmosphere:
            pendingImageStageVersion = latestImageCandidate(stage: "atmosphere")
        case .animate:
            Task { await animateActiveStoryboard() }
        case .animationInProgress:
            break
        }
    }

    private func isActiveVideoJobStatus(_ status: String?) -> Bool {
        StoryboardVideoJobLifecyclePolicy.isActive(status)
    }

    private func aiStageState(_ stage: String) -> AIPipelineVisualState {
        if imageStageVersions.contains(where: {
            $0.stage == stage && $0.isApproved && imageVersionMatchesActiveFrame($0)
        }) {
            return .approved
        }
        if latestImageCandidate(stage: stage) != nil { return .candidate }
        return .waiting
    }

    private func aiStageDetail(_ stage: String) -> String {
        switch aiStageState(stage) {
        case .approved: return "Approved source"
        case .candidate: return "Candidate ready for review"
        case .waiting:
            return stage == "color" ? "Generated from Pencil" : "Requires approved Color"
        }
    }

    private func aiPipelineRow(
        _ title: String, state: AIPipelineVisualState, detail: String
    ) -> some View {
        HStack(spacing: 10) {
            Image(systemName: state == .approved
                  ? "checkmark.circle.fill" : state == .candidate
                  ? "circle.dotted.circle.fill" : "circle")
                .font(.system(size: 17))
                .foregroundStyle(state == .approved ? Color.green
                                 : state == .candidate ? BoardBrand.accent : BoardBrand.dim)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                Text(detail).font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
            }
            Spacer()
            if state == .candidate {
                Text("REVIEW")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(BoardBrand.accent)
            }
        }
        .frame(minHeight: 44)
    }

    private func aiPipelineConnector(active: Bool) -> some View {
        HStack {
            Rectangle()
                .fill(active ? BoardBrand.accent : BoardBrand.border)
                .frame(width: 2, height: 12)
                .padding(.leading, 10)
            Spacer()
        }
    }

    private func inspectorNavigationRow(
        _ title: String, detail: String, symbol: String
    ) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol).foregroundStyle(BoardBrand.accent).frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                Text(detail).font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(BoardBrand.dim)
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }

    private func activeAIContext() -> (
        projectId: String, scene: SceneSummary, frame: FrameSummary,
        context: [String: any Sendable], strokes: String?
    )? {
        guard let projectId = board.projectId, let scene = board.scene,
              let persistedFrame = board.frame else { return nil }
        var frame = persistedFrame
        frame.shotFraming = canvasState.shotFraming
        frame.shotType = canvasState.shotFraming.shotSize ?? frame.shotType
        frame.angle = canvasState.shotFraming.angle ?? frame.angle
        frame.lensMm = canvasState.shotFraming.lensMm ?? frame.lensMm
        frame.layerState = canvasState.layerState
        let index = scene.frames.firstIndex(where: { $0.id == frame.id }) ?? 0
        let previous = index > 0 ? scene.frames[index - 1] : nil
        let next = index + 1 < scene.frames.count ? scene.frames[index + 1] : nil
        let context = RoleRoomAPIClient.storyboardShotContext(
            manuscript: board.manuscript, scene: scene, frame: frame,
            previous: previous, next: next)
        let liveStrokes = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes)
        return (projectId, scene, frame, context, liveStrokes ?? frame.strokesJSON)
    }

    /// Builds the provider source from one explicit approved version, never
    /// from the raster currently displayed by the frame. Color is overlaid on
    /// approved Color; Atmosphere is overlaid on approved Atmosphere. This
    /// prevents a later stage from being baked twice.
    @MainActor
    private func freezePaintoverComposite(
        baseVersion: StoryboardAIImageVersionSummary,
        includedThroughStage stage: StoryboardPaintoverCompositeStage,
        acknowledgement: AISourceSnapshotAcknowledgement,
        frame: FrameSummary
    ) async throws -> StoryboardPaintoverComposite {
        let expectedBaseStage = stage.rawValue
        guard baseVersion.stage == expectedBaseStage,
              baseVersion.frameId == frame.id,
              baseVersion.isApproved,
              let sourceRevision = acknowledgement.sourceRevision,
              baseVersion.sourceRevision == sourceRevision,
              let baseFraming = baseVersion.framingFingerprint,
              baseFraming == acknowledgement.shotFraming.canonicalFingerprint
        else {
            throw SyncError.malformed(
                "Godkjent \(expectedBaseStage)-base tilhører et eldre shot. Ingen AI-kostnad er utløst.")
        }
        if stage == .atmosphere,
           acknowledgement.paintoverState.atmosphereStale {
            throw SyncError.malformed(
                "Color er endret etter godkjent Atmosphere. Bruk Color eller regenerer Atmosphere før animasjon.")
        }
        var renderFrame = frame
        renderFrame.strokesJSON = acknowledgement.strokesJSON
        renderFrame.layerState = acknowledgement.layerState
        renderFrame.shotFraming = acknowledgement.shotFraming
        renderFrame.shotType = acknowledgement.shotFraming.shotSize
        renderFrame.angle = acknowledgement.shotFraming.angle
        renderFrame.lensMm = acknowledgement.shotFraming.lensMm
        renderFrame.aiStoryboardId = baseVersion.storyboardId
        renderFrame.aiSourceFramingFingerprint = baseFraming
        renderFrame.aiSourceRevision = sourceRevision
        renderFrame.aiOutputStale = false
        await FrameImageCache.prefetch(imageURLs: [baseVersion.imageData])
        guard let strokes = try? StrokeSerialization.decodeFromWebJSON(
                acknowledgement.strokesJSON),
              let imageData = FrameRenderService.animationSourceDataURL(
                for: renderFrame,
                visibleStrokes: strokes,
                stage: stage == .color ? .color : .atmosphere,
                overlayLayers: StoryboardPaintoverStageSelection.overlayLayers(
                    for: stage),
                frameImageURLOverride: baseVersion.imageData,
                frameImageIsViewportEncodedOverride: true),
              let image = decodeDataURL(imageData),
              let pixels = image.cgImage,
              pixels.width >= 64, pixels.height >= 64 else {
            throw SyncError.malformed(
                "Paintover-kilden kunne ikke fryses tapsfritt. Ingen AI-kostnad er utløst.")
        }
        let state = acknowledgement.paintoverState
        return StoryboardPaintoverComposite(
            imageData: imageData,
            width: pixels.width,
            height: pixels.height,
            includedThroughStage: stage,
            baseVersionId: baseVersion.id,
            frameUpdatedAt: acknowledgement.frameUpdatedAt,
            sourceUpdatedAt: acknowledgement.sourceUpdatedAt,
            sourceRevision: sourceRevision,
            framingFingerprint: baseFraming,
            colorRevision: state.colorRevision,
            atmosphereRevision: state.atmosphereRevision,
            colorFingerprint: state.colorFingerprint,
            atmosphereFingerprint: state.atmosphereFingerprint)
    }

    private func currentAIFrameSession() -> AIFrameSessionKey? {
        guard let projectId = board.projectId, let sceneId = board.scene?.id,
              let frameId = board.frame?.id else { return nil }
        return AIFrameSessionKey(
            projectId: projectId, sceneId: sceneId,
            frameId: frameId, epoch: aiFrameEpoch,
            documentRevision: canvasState.revision)
    }

    private func isCurrentAIFrameSession(_ session: AIFrameSessionKey) -> Bool {
        isSameAIFrameIdentity(session)
            && session.documentRevision == canvasState.revision
    }

    private func isSameAIFrameIdentity(_ session: AIFrameSessionKey) -> Bool {
        session.epoch == aiFrameEpoch
            && session.projectId == board.projectId
            && session.sceneId == board.scene?.id
            && session.frameId == board.frame?.id
    }

    private func aiOperationKey(
        projectId: String, sceneId: String, frameId: String
    ) -> String {
        "\(projectId)|\(sceneId)|\(frameId)"
    }

    private func aiOperationKey(_ session: AIFrameSessionKey) -> String {
        aiOperationKey(
            projectId: session.projectId,
            sceneId: session.sceneId,
            frameId: session.frameId)
    }

    private var activeFrameAIOperationKey: String? {
        guard let projectId = board.projectId,
              let sceneId = board.scene?.id,
              let frameId = board.frame?.id else { return nil }
        return aiOperationKey(
            projectId: projectId, sceneId: sceneId, frameId: frameId)
    }

    @MainActor
    private func beginAIFrameOperation(_ session: AIFrameSessionKey) -> UUID? {
        let key = aiOperationKey(session)
        guard activeAIFrameOperations[key] == nil else {
            if activeFrameAIOperationKey == key { aiInFlight = true }
            return nil
        }
        let operationID = UUID()
        activeAIFrameOperations[key] = operationID
        if activeFrameAIOperationKey == key { aiInFlight = true }
        return operationID
    }

    @MainActor
    private func endAIFrameOperation(
        _ operationID: UUID, session: AIFrameSessionKey
    ) {
        let key = aiOperationKey(session)
        if activeAIFrameOperations[key] == operationID {
            activeAIFrameOperations.removeValue(forKey: key)
        }
        aiInFlight = activeFrameAIOperationKey.flatMap {
            activeAIFrameOperations[$0]
        } != nil
    }

    private func resetFrameScopedAIState() {
        aiFrameEpoch = UUID()
        aiInFlight = activeFrameAIOperationKey.flatMap {
            activeAIFrameOperations[$0]
        } != nil
        aiStatus = nil
        promptCompilation = nil
        imageStageStoryboardId = board.frame?.aiStoryboardId
        imageStageVersions = []
        currentAIImageSourceRevision = nil
        imageVersionDocumentRevisions = [:]
        pendingImageStageVersion = nil
        pendingImageStageGeneration = nil
        animationPreflight = nil
        animationPreflightSourceImage = nil
        animationPreflightComposite = nil
        animationPreflightSession = nil
        showAIVersionBrowser = false
        showAIConsentPrompt = false
        pendingAIConsentSession = nil
    }

    private func inspectActivePrompt() {
        guard let input = activeAIContext(), let session = currentAIFrameSession() else { return }
        guard let operationID = beginAIFrameOperation(session) else { return }
        let framingFingerprint = canvasState.shotFraming.canonicalFingerprint
        aiStatus = "Kompilerer produksjonskontekst …"
        Task {
            defer { endAIFrameOperation(operationID, session: session) }
            do {
                let storyboardId: String
                var ensuredSourceRevision: Int?
                if let existing = imageStageStoryboardId ?? input.frame.aiStoryboardId {
                    storyboardId = existing
                } else if let recovered = try await RoleRoomAPIClient.shared
                    .resolveStoryboardId(
                        projectId: input.projectId,
                        sceneId: input.scene.id,
                        frameId: input.frame.id) {
                    storyboardId = recovered
                } else {
                    let ensured = try await RoleRoomAPIClient.shared.ensureStoryboard(
                        projectId: input.projectId,
                        scene: input.scene,
                        frame: input.frame,
                        strokesJSON: input.strokes,
                        preserveExistingImagePipeline: true)
                    storyboardId = ensured.id
                    ensuredSourceRevision = ensured.currentSourceRevision
                }
                guard isCurrentAIFrameSession(session),
                      canvasState.shotFraming.canonicalFingerprint == framingFingerprint
                else { return }
                imageStageStoryboardId = storyboardId
                if let ensuredSourceRevision {
                    currentAIImageSourceRevision = ensuredSourceRevision
                }
                let compilation = try await RoleRoomAPIClient.shared.compileStoryboardPrompt(
                    projectId: input.projectId, storyboardId: storyboardId,
                    model: "gpt-image-1-mini", kind: "storyboard-image",
                    context: input.context)
                guard isCurrentAIFrameSession(session),
                      canvasState.shotFraming.canonicalFingerprint == framingFingerprint
                else { return }
                promptCompilation = compilation
                aiStatus = compilation.valid
                    ? "Prompt validert ✓" : "Prompt har valideringsfunn"
                showPromptInspector = true
            } catch {
                if isCurrentAIFrameSession(session) {
                    aiStatus = error.localizedDescription
                }
            }
        }
    }

    @MainActor
    private func generateImageStage(stage: String, checkConsent: Bool = true) async {
        guard let input = activeAIContext(), let session = currentAIFrameSession() else { return }
        guard stage == "color" || stage == "atmosphere" else { return }
        guard requireProductionReadyFraming(input.frame) else { return }
        // MainActor makes this an atomic single-flight gate. It is acquired
        // before the first consent await so two rapid confirmations cannot
        // submit duplicate paid generations for the same shot.
        guard let operationID = beginAIFrameOperation(session) else { return }
        defer { endAIFrameOperation(operationID, session: session) }
        let framingFingerprint = canvasState.shotFraming.canonicalFingerprint
        if checkConsent {
            do {
                if try await !RoleRoomAPIClient.shared.fetchProjectAIConsent(
                    projectId: input.projectId) {
                    guard isCurrentAIFrameSession(session),
                          canvasState.shotFraming.canonicalFingerprint == framingFingerprint
                    else { return }
                    pendingAIConsentAction = stage
                    pendingAIConsentSession = session
                    showAIConsentPrompt = true
                    return
                }
            } catch {
                if isCurrentAIFrameSession(session) {
                    aiStatus = error.localizedDescription
                }
                return
            }
        }
        guard isCurrentAIFrameSession(session),
              canvasState.shotFraming.canonicalFingerprint == framingFingerprint
        else { return }
        aiStatus = stage == "color"
            ? "Synkroniserer og låser Pencil-kilden …"
            : "Bruker godkjent Color og genererer atmosfære …"
        do {
            guard isCurrentAIFrameSession(session) else { return }
            // Capture this before the exact save advances the local baseline.
            // It decides whether an existing immutable Pencil chain can be
            // reused or must be replaced with a newly frozen Drawing source.
            let changesBeforeAcknowledgement = activePaintoverChanges()
            var expectedSourceRevision: Int?
            var expectedSourceUpdatedAt: String?
            var sourceStrokesJSON = input.strokes
            var paintoverComposite: StoryboardPaintoverComposite?
            let acknowledgement = try await acknowledgeActiveSourceForAIGeneration(
                session: session)
            expectedSourceRevision = acknowledgement.sourceRevision
            expectedSourceUpdatedAt = acknowledgement.sourceUpdatedAt
            sourceStrokesJSON = acknowledgement.strokesJSON
            if stage == "color" {
                aiStatus = "Pencil-kilden er låst · klargjør produksjonsfarger …"
            } else {
                guard input.frame.aiOutputStale == false,
                      !activePaintoverChanges().pencilChanged else {
                    throw SyncError.malformed(
                        "Pencil eller utsnitt er endret. Regenerer AI Color før Atmosphere — ingen AI-kostnad er utløst.")
                }
                guard let storyboardId = imageStageStoryboardId
                    ?? input.frame.aiStoryboardId else {
                    throw SyncError.malformed(
                        "Godkjenn AI Color før Atmosphere. Ingen AI-kostnad er utløst.")
                }
                // Revision and stable source token must come from the same
                // authoritative read immediately before the paid stage.
                let versionList = try await RoleRoomAPIClient.shared
                    .fetchStoryboardImageVersions(
                        projectId: input.projectId, storyboardId: storyboardId)
                guard isCurrentAIFrameSession(session) else { return }
                imageStageVersions = versionList.versions
                currentAIImageSourceRevision = versionList.currentSourceRevision
                loadedFrameSourceUpdatedAt = versionList.sourceUpdatedAt
                guard versionList.currentSourceRevision
                        == acknowledgement.sourceRevision,
                      versionList.sourceUpdatedAt
                        == acknowledgement.sourceUpdatedAt,
                      let approvedColor = versionList.versions.last(where: {
                        $0.stage == "color" && $0.isApproved
                            && $0.frameId == input.frame.id
                            && $0.framingFingerprint == framingFingerprint
                            && $0.sourceRevision
                                == acknowledgement.sourceRevision
                      }) else {
                    throw SyncError.malformed(
                        "Godkjent Color tilhører ikke den synkede Pencil-kilden. Regenerer Color først.")
                }
                paintoverComposite = try await freezePaintoverComposite(
                    baseVersion: approvedColor,
                    includedThroughStage: .color,
                    acknowledgement: acknowledgement,
                    frame: input.frame)
            }
            guard isCurrentAIFrameSession(session) else { return }
            // Decode the immutable snapshot captured before the first await.
            // Reading canvasState here would mix a newer document with an
            // older prompt/context when the artist keeps drawing.
            let capturedStrokes = sourceStrokesJSON.flatMap {
                try? StrokeSerialization.decodeFromWebJSON($0)
            } ?? []
            let drawingStrokes = capturedStrokes.filter {
                ($0.boardLayer ?? "Drawing") == "Drawing"
            }
            let importedPencil = stage == "color"
                && StoryboardFrameImagePolicy.isImportedPencilSource(input.frame)
            if importedPencil {
                await FrameImageCache.prefetch(frames: [input.frame])
                guard isCurrentAIFrameSession(session) else { return }
            }
            let pencilSource = stage == "color"
                && (!drawingStrokes.isEmpty || importedPencil)
                ? FrameRenderService.pencilSourceDataURL(
                    for: input.frame,
                    visibleStrokes: drawingStrokes,
                    includeImportedFrameImage: importedPencil)
                : nil
            if importedPencil && pencilSource == nil {
                throw SyncError.malformed(
                    "Originalbildet er ikke ferdig lastet i full oppløsning. Prøv igjen — ingen AI-kostnad er utløst.")
            }
            if stage == "color" && pencilSource == nil
                && input.frame.imageUrl == nil && imageStageVersions.isEmpty {
                throw SyncError.malformed(
                    "Tegn eller importer et Pencil-panel før AI Color. Ingen AI-kostnad er utløst.")
            }
            var existingStoryboardId = imageStageStoryboardId
                ?? input.frame.aiStoryboardId
            if existingStoryboardId == nil {
                existingStoryboardId = try await RoleRoomAPIClient.shared
                    .resolveStoryboardId(
                        projectId: input.projectId,
                        sceneId: input.scene.id,
                        frameId: input.frame.id)
                guard isCurrentAIFrameSession(session) else { return }
                if let recovered = existingStoryboardId {
                    imageStageStoryboardId = recovered
                }
            }
            if stage == "color", pencilSource == nil,
               StoryboardFrameImagePolicy.isApprovedAIOutput(input.frame),
               existingStoryboardId == nil {
                throw SyncError.malformed(
                    "AI-panelets immutable Pencil-kilde kunne ikke gjenopprettes. Last shotet på nytt — ingen AI-kostnad er utløst.")
            }
            let storyboardId: String
            if let existingStoryboardId,
               stage == "atmosphere"
                || (stage == "color"
                    && !input.frame.aiOutputStale
                    && !changesBeforeAcknowledgement.pencilChanged) {
                // Regenerering bruker den immutable Pencil-versjonen som
                // allerede ligger i versjonskjeden. Det aktive AI-previewet
                // må aldri lastes opp igjen som en falsk Pencil-kilde.
                storyboardId = existingStoryboardId
            } else {
                let ensured = try await RoleRoomAPIClient.shared.ensureStoryboard(
                    projectId: input.projectId, scene: input.scene, frame: input.frame,
                    strokesJSON: sourceStrokesJSON,
                    imageDataOverride: pencilSource,
                    workflowLevelOverride: stage == "color"
                        ? "ai-pipeline-pencil-source" : nil,
                    expectedSourceRevision: expectedSourceRevision,
                    expectedSourceUpdatedAt: expectedSourceUpdatedAt,
                    expectedFramingFingerprint: framingFingerprint)
                storyboardId = ensured.id
                expectedSourceRevision = ensured.currentSourceRevision
                    ?? expectedSourceRevision
                if stage == "color" {
                    guard let lockedToken = expectedSourceUpdatedAt,
                          ensured.sourceUpdatedAt == lockedToken else {
                        throw SyncError.malformed(
                            "Shotet ble endret av en annen enhet under klargjøring. Ingen AI-kostnad er utløst.")
                    }
                }
                // Color keeps the compat token acknowledged before its
                // immutable Pencil raster was built. Never launder an older
                // raster by adopting a newer token returned by upsert.
                if stage != "color" {
                    expectedSourceUpdatedAt = ensured.sourceUpdatedAt
                        ?? expectedSourceUpdatedAt
                }
            }
            // Last no-cost checkpoint before a provider generation can spend.
            guard isCurrentAIFrameSession(session),
                  canvasState.shotFraming.canonicalFingerprint == framingFingerprint
            else { return }
            guard requireProductionReadyFraming(input.frame) else { return }
            guard let expectedSourceRevision,
                  let expectedSourceUpdatedAt,
                  !expectedSourceUpdatedAt.isEmpty else {
                throw SyncError.malformed(
                    "Serveren mangler en bekreftet source revision. Ingen AI-kostnad er utløst.")
            }
            imageStageStoryboardId = storyboardId
            let operationIdentity = try AIImageGenerationOperationIdentity(
                projectId: input.projectId,
                storyboardId: storyboardId,
                frameId: input.frame.id,
                stage: stage,
                sourceRevision: expectedSourceRevision,
                sourceUpdatedAt: expectedSourceUpdatedAt,
                framingFingerprint: framingFingerprint,
                requestFingerprint: AIImageGenerationOperationIdentity
                    .contextFingerprint(input.context),
                paintoverCompositeFingerprint:
                    paintoverComposite?.identityFingerprint)
            // Written before the first paid request. A timeout or app kill
            // reconstructs this exact identity and reuses the same server key.
            let idempotencyKey = try AIImageGenerationOperationStore
                .operationKey(for: operationIdentity)
            let result: StoryboardAIImageStageResult
            do {
                result = try await RoleRoomAPIClient.shared.generateStoryboardImageStage(
                    projectId: input.projectId, storyboardId: storyboardId,
                    stage: stage, context: input.context,
                    expectedSourceRevision: expectedSourceRevision,
                    expectedCompatFrameUpdatedAt: expectedSourceUpdatedAt,
                    idempotencyKey: idempotencyKey,
                    paintoverComposite: paintoverComposite)
            } catch {
                // A structured server rejection is a known terminal attempt:
                // its operation row is failed (or was never claimed), so the
                // next explicit click needs a new key. Transport, cancellation
                // and malformed-success errors keep the key because provider
                // outcome may be unknown.
                if AIImageGenerationOperationRetentionPolicy
                    .shouldClearAfterTerminalResponse(error) {
                    _ = AIImageGenerationOperationStore.clear(
                        operationIdentity,
                        ifOperationKeyMatches: idempotencyKey)
                }
                throw error
            }
            guard result.version.storyboardId == storyboardId,
                  result.version.frameId == input.frame.id,
                  result.version.framingFingerprint == framingFingerprint,
                  result.version.sourceRevision == expectedSourceRevision else {
                throw SyncError.malformed("AI-kandidaten tilhører et annet shot eller utsnitt")
            }
            // The paid candidate is now durably persisted and belongs to the
            // exact captured source. A later explicit regeneration may use a
            // fresh operation key even if its source remains unchanged.
            _ = AIImageGenerationOperationStore.clear(
                operationIdentity, ifOperationKeyMatches: idempotencyKey)
            guard isCurrentAIFrameSession(session) else { return }
            imageVersionDocumentRevisions[result.version.id] = session.documentRevision
            imageStageStoryboardId = storyboardId
            if let existingIndex = imageStageVersions.firstIndex(where: {
                $0.id == result.version.id
            }) {
                imageStageVersions[existingIndex] = result.version
            } else {
                imageStageVersions.append(result.version)
            }
            currentAIImageSourceRevision = expectedSourceRevision
            loadedFrameSourceUpdatedAt = expectedSourceUpdatedAt
            pendingImageStageVersion = result.version
            if let prompt = result.prompt { promptCompilation = prompt }
            // Candidate adoption and operation unlock never wait for the
            // presentation-only Prompt Inspector request.
            Task {
                guard let compilation = try? await RoleRoomAPIClient.shared
                    .compileStoryboardPrompt(
                        projectId: input.projectId,
                        storyboardId: storyboardId,
                        model: "gpt-image-2",
                        kind: stage == "color"
                            ? "storyboard-color" : "storyboard-atmosphere",
                        context: input.context),
                      isCurrentAIFrameSession(session),
                      pendingImageStageVersion?.id == result.version.id
                else { return }
                promptCompilation = compilation
            }
            // Refresh is presentation-only. A transient GET failure after the
            // provider succeeded must not hide a paid candidate or suggest a
            // duplicate regeneration.
            if let versionList = try? await RoleRoomAPIClient.shared
                .fetchStoryboardImageVersions(
                    projectId: input.projectId, storyboardId: storyboardId),
               isCurrentAIFrameSession(session) {
                imageStageVersions = versionList.versions.contains(where: {
                    $0.id == result.version.id
                }) ? versionList.versions : versionList.versions + [result.version]
                currentAIImageSourceRevision = versionList.currentSourceRevision
                loadedFrameSourceUpdatedAt = versionList.sourceUpdatedAt
            }
            guard isCurrentAIFrameSession(session) else { return }
            if canvasState.shotFraming.canonicalFingerprint != framingFingerprint {
                aiStatus = "Utsnittet ble endret mens AI jobbet. Kandidaten er arkivert, men kan ikke godkjennes; generer på nytt."
                return
            }
            aiStatus = result.estimatedCostUsd.map {
                String(format: "%@-kandidat klar · $%.2f · godkjenning kreves",
                       stage == "color" ? "Color" : "Atmosphere", $0)
            } ?? "AI-kandidat klar · godkjenning kreves"
        } catch {
            if isCurrentAIFrameSession(session) {
                aiStatus = error.localizedDescription
            }
        }
    }

    @MainActor
    private func approveImageStageVersion(
        _ candidate: StoryboardAIImageVersionSummary
    ) async {
        guard let input = activeAIContext(), let session = currentAIFrameSession() else { return }
        let framingFingerprint = canvasState.shotFraming.canonicalFingerprint
        guard imageVersionMatchesActiveFrame(candidate),
              candidate.storyboardId == (imageStageStoryboardId ?? input.frame.aiStoryboardId),
              candidate.frameId == input.frame.id,
              candidate.framingFingerprint == framingFingerprint else {
            aiStatus = "Kandidaten tilhører et eldre shot eller utsnitt. Generer på nytt."
            return
        }
        let storyboardId = candidate.storyboardId
        guard let operationID = beginAIFrameOperation(session) else { return }
        aiStatus = "Godkjenner \(candidate.stage == "color" ? "AI Color" : "AI Atmosphere") …"
        defer { endAIFrameOperation(operationID, session: session) }
        do {
            let approval = try await RoleRoomAPIClient.shared.approveStoryboardImageVersion(
                projectId: input.projectId, storyboardId: storyboardId,
                versionId: candidate.id,
                expectedFramingFingerprint: framingFingerprint)
            let approved = approval.version
            guard approved.storyboardId == storyboardId,
                  approved.frameId == input.frame.id,
                  approved.framingFingerprint == framingFingerprint else {
                throw SyncError.malformed("Godkjenningen returnerte feil shot-kontekst")
            }
            guard isSameAIFrameIdentity(session) else { return }
            currentAIImageSourceRevision = approval.currentSourceRevision
            // Approval adopts the preview in the compatibility frame and
            // advances the general OCC token without changing the Pencil
            // document. Keep the stable source token separate for Atmosphere.
            if let adoptedFrameUpdatedAt = approval.adoptedFrameUpdatedAt,
               !adoptedFrameUpdatedAt.isEmpty {
                loadedFrameUpdatedAt = adoptedFrameUpdatedAt
            }
            if let sourceUpdatedAt = approval.sourceUpdatedAt,
               !sourceUpdatedAt.isEmpty {
                loadedFrameSourceUpdatedAt = sourceUpdatedAt
            }
            let sameFrameSourceChanged = !isCurrentAIFrameSession(session)
            if sameFrameSourceChanged {
                let changes = activePaintoverChanges()
                // Color/Atmosphere edits do not mutate Pencil identity. Keep
                // their WAL intact and let its exact PATCH acknowledgement
                // advance only the server-owned downstream stage revisions.
                if changes.pencilChanged {
                    let reason = canvasState.shotFraming.canonicalFingerprint
                        == framingFingerprint
                        ? "source-changed-during-approval"
                        : "framing-changed-during-approval"
                    try await RoleRoomAPIClient.shared.saveFramePatch(
                        manuscriptId: board.manuscript.id,
                        sceneId: input.scene.id,
                        frameId: input.frame.id,
                        fields: [
                            "aiStoryboardId": storyboardId,
                            "aiOutputStale": true,
                            "aiOutputStaleReason": reason,
                        ])
                }
                if isSameAIFrameIdentity(session) {
                    await board.reload()
                    loadedFramePaintoverState = board.frame?.aiPaintoverState
                    if let versionList = try? await RoleRoomAPIClient.shared
                        .fetchStoryboardImageVersions(
                            projectId: input.projectId, storyboardId: storyboardId) {
                        imageStageVersions = versionList.versions
                        currentAIImageSourceRevision = versionList.currentSourceRevision
                        loadedFrameSourceUpdatedAt = versionList.sourceUpdatedAt
                    }
                    aiStatus = changes.pencilChanged
                        ? "Pencil eller utsnitt ble endret under godkjenning. Shotet må genereres på nytt."
                        : "Godkjent ✓ · lokale paintover-endringer synkes separat"
                }
                return
            }
            // Approval already adopted the raster and all compatibility fields
            // in the same server transaction as the revision/framing CAS.
            // A second generic frame patch here could race a collaborator's
            // Pencil edit and partially overwrite the authoritative state.
            guard isCurrentAIFrameSession(session) else { return }
            await board.reload()
            guard isCurrentAIFrameSession(session) else { return }
            loadedFramePaintoverState = board.frame?.aiPaintoverState
            // Version refresh is presentation-only. It must not sit between
            // the committed approval and adoption of the approved image.
            if let versionList = try? await RoleRoomAPIClient.shared
                .fetchStoryboardImageVersions(
                    projectId: input.projectId, storyboardId: storyboardId),
               isCurrentAIFrameSession(session) {
                imageStageVersions = versionList.versions
                currentAIImageSourceRevision = versionList.currentSourceRevision
                loadedFrameSourceUpdatedAt = versionList.sourceUpdatedAt
            }
            aiStatus = approved.stage == "color"
                ? "AI Color godkjent · Atmosphere er låst opp ✓"
                : "AI Atmosphere godkjent · klart for animasjon ✓"
        } catch {
            if isCurrentAIFrameSession(session) {
                aiStatus = error.localizedDescription
            }
        }
    }

    @MainActor
    private func animateActiveStoryboard(
        checkConsent: Bool = true,
        confirmedPreflight: StoryboardAnimationPreflightSummary? = nil,
        confirmedPaintoverComposite: StoryboardPaintoverComposite? = nil
    ) async {
        guard let input = activeAIContext(), let session = currentAIFrameSession() else { return }
        let framingFingerprint = canvasState.shotFraming.canonicalFingerprint
        let modelId = selectedVideoModelId
        if let confirmedPreflight {
            guard animationPreflightSession == session else {
                aiStatus = "Shotet ble endret etter forhåndskontrollen. Kjør den på nytt — ingen videokostnad er utløst."
                animationPreflight = nil
                animationPreflightSourceImage = nil
                animationPreflightComposite = nil
                animationPreflightSession = nil
                return
            }
            animationPreflightSession = nil
            animationPreflightComposite = nil
            guard confirmedPreflight.model == modelId else {
                aiStatus = "Valgt modell er endret. Kjør forhåndskontrollen på nytt — ingen videokostnad er utløst."
                return
            }
            guard confirmedPaintoverComposite != nil else {
                aiStatus = "Den fryste paintover-kilden mangler. Kjør forhåndskontrollen på nytt — ingen videokostnad er utløst."
                return
            }
        }
        guard !input.frame.aiOutputStale else {
            aiStatus = "Utsnittet er endret. Regenerer og godkjenn AI Color/Atmosphere før animasjon — ingen videokostnad er utløst."
            return
        }
        guard requireProductionReadyFraming(input.frame) else { return }
        guard !isActiveVideoJobStatus(input.frame.aiVideoStatus) else {
            aiStatus = StoryboardVideoJobLifecyclePolicy
                .reconciliationMessage(for: input.frame.aiVideoStatus)
                ?? "En animasjonsjobb kjører allerede for shotet. Ingen ny videokostnad er utløst."
            return
        }
        // Acquire before consent/preflight awaits. The confirmation dialog
        // otherwise leaves a short window where the paid action can be
        // launched twice from two rapidly scheduled Tasks.
        guard let operationID = beginAIFrameOperation(session) else { return }
        defer { endAIFrameOperation(operationID, session: session) }
        if checkConsent {
            do {
                if try await !RoleRoomAPIClient.shared.fetchProjectAIConsent(
                    projectId: input.projectId) {
                    guard isCurrentAIFrameSession(session),
                          canvasState.shotFraming.canonicalFingerprint == framingFingerprint
                    else { return }
                    pendingAIConsentAction = "animate"
                    pendingAIConsentSession = session
                    showAIConsentPrompt = true
                    return
                }
            } catch {
                if isCurrentAIFrameSession(session) {
                    aiStatus = error.localizedDescription
                }
                return
            }
        }
        guard isCurrentAIFrameSession(session),
              canvasState.shotFraming.canonicalFingerprint == framingFingerprint
        else { return }
        aiStatus = "Kontrollerer godkjent AI-kilde …"
        do {
            guard let storyboardId = imageStageStoryboardId ?? input.frame.aiStoryboardId else {
                throw SyncError.malformed(
                    "Godkjenn AI Color eller AI Atmosphere før animasjon. Ingen videokostnad er utløst.")
            }
            let acknowledgement: AISourceSnapshotAcknowledgement?
            if confirmedPreflight == nil {
                acknowledgement = try await acknowledgeActiveSourceForAIGeneration(
                    session: session)
            } else {
                acknowledgement = nil
            }
            let versionList = try await RoleRoomAPIClient.shared.fetchStoryboardImageVersions(
                projectId: input.projectId, storyboardId: storyboardId)
            guard isCurrentAIFrameSession(session),
                  canvasState.shotFraming.canonicalFingerprint == framingFingerprint
            else { return }
            imageStageStoryboardId = storyboardId
            imageStageVersions = versionList.versions
            currentAIImageSourceRevision = versionList.currentSourceRevision
            loadedFrameSourceUpdatedAt = versionList.sourceUpdatedAt
            guard let animationSourceRevision = versionList.currentSourceRevision,
                  let animationSourceUpdatedAt = versionList.sourceUpdatedAt,
                  !animationSourceUpdatedAt.isEmpty else {
                throw SyncError.malformed(
                    "Serveren kunne ikke låse animasjonskilden. Ingen videokostnad er utløst.")
            }
            let composite: StoryboardPaintoverComposite
            if let acknowledgement {
                guard acknowledgement.sourceRevision == animationSourceRevision,
                      acknowledgement.sourceUpdatedAt == animationSourceUpdatedAt
                else {
                    throw SyncError.malformed(
                        "Shotet ble endret mellom kildesynk og versjonskontroll. Ingen videokostnad er utløst.")
                }
                let approvedColor = versionList.versions.last(where: {
                    $0.stage == "color" && $0.isApproved
                        && $0.frameId == input.frame.id
                        && $0.framingFingerprint == framingFingerprint
                        && $0.sourceRevision == animationSourceRevision
                })
                let approvedAtmosphere = versionList.versions.last(where: {
                    $0.stage == "atmosphere" && $0.isApproved
                        && $0.frameId == input.frame.id
                        && $0.framingFingerprint == framingFingerprint
                        && $0.sourceRevision == animationSourceRevision
                })
                guard let selectedStage = StoryboardPaintoverStageSelection
                    .animationStage(
                        hasApprovedColor: approvedColor != nil,
                        hasApprovedAtmosphere: approvedAtmosphere != nil,
                        state: acknowledgement.paintoverState),
                      let approvedSource = selectedStage == .atmosphere
                        ? approvedAtmosphere : approvedColor else {
                    throw SyncError.malformed(
                        "Godkjent AI-kilde tilhører et eldre shot eller utsnitt. Regenerer før animasjon — ingen videokostnad er utløst.")
                }
                composite = try await freezePaintoverComposite(
                    baseVersion: approvedSource,
                    includedThroughStage: selectedStage,
                    acknowledgement: acknowledgement,
                    frame: input.frame)
            } else if let confirmedPaintoverComposite {
                guard confirmedPaintoverComposite.sourceRevision
                        == animationSourceRevision,
                      confirmedPaintoverComposite.sourceUpdatedAt
                        == animationSourceUpdatedAt,
                      confirmedPaintoverComposite.framingFingerprint
                        == framingFingerprint,
                      loadedFrameUpdatedAt
                        == confirmedPaintoverComposite.frameUpdatedAt,
                      versionList.versions.contains(where: {
                        $0.id == confirmedPaintoverComposite.baseVersionId
                            && $0.stage == confirmedPaintoverComposite
                                .includedThroughStage.rawValue
                            && $0.isApproved
                      }) else {
                    throw SyncError.malformed(
                        "Den bekreftede paintover-kilden er ikke lenger gjeldende. Kjør forhåndskontrollen på nytt.")
                }
                composite = confirmedPaintoverComposite
            } else {
                throw SyncError.malformed(
                    "Fryst paintover-kilde mangler. Ingen videokostnad er utløst.")
            }
            var animationContext = input.context
            let animationProject: [String: any Sendable] = [
                "styleProfileId": "story-pencil-color",
                "creativeDirection": composite.includedThroughStage == .atmosphere
                    ? "Approved production-aware color storyboard with controlled atmosphere"
                    : "Approved production-aware color storyboard",
            ]
            animationContext["project"] = animationProject
            aiStatus = "Kompilerer motion prompt fra godkjent \(composite.includedThroughStage.rawValue) …"
            let compiled = try await RoleRoomAPIClient.shared.compileStoryboardPrompt(
                projectId: input.projectId, storyboardId: storyboardId,
                model: modelId, kind: "storyboard-video",
                context: animationContext)
            guard isCurrentAIFrameSession(session),
                  canvasState.shotFraming.canonicalFingerprint == framingFingerprint
            else { return }
            promptCompilation = compiled
            guard compiled.valid else {
                aiStatus = "Motion prompt feilet validering"
                showPromptInspector = true
                return
            }
            if confirmedPreflight == nil {
                aiStatus = "Henter autoritativ pris fra leverandøren …"
                let checked = try await RoleRoomAPIClient.shared.preflightStoryboardAnimation(
                    projectId: input.projectId, storyboardId: storyboardId,
                    context: animationContext, model: modelId,
                    duration: input.frame.effectiveShotDuration.seconds,
                    paintoverComposite: composite)
                guard isCurrentAIFrameSession(session),
                      canvasState.shotFraming.canonicalFingerprint == framingFingerprint
                else { return }
                animationPreflightSourceImage = decodeDataURL(composite.imageData)
                animationPreflightComposite = composite
                animationPreflightSession = session
                animationPreflight = checked
                aiStatus = String(format: "Klar til start · $%.2f", checked.estimatedCostUsd)
                return
            }
            // Last no-cost checkpoint before the provider request. A frame
            // switch, a reframe or a model change invalidates the confirmation.
            guard isCurrentAIFrameSession(session),
                  canvasState.shotFraming.canonicalFingerprint == framingFingerprint,
                  selectedVideoModelId == modelId
            else { return }
            guard requireProductionReadyFraming(input.frame) else { return }
            guard let confirmedPreflight else {
                aiStatus = "Forhåndskontroll mangler. Ingen videokostnad er utløst."
                return
            }
            let job = try await RoleRoomAPIClient.shared.startStoryboardAnimation(
                projectId: input.projectId, storyboardId: storyboardId,
                context: animationContext, model: modelId,
                duration: input.frame.effectiveShotDuration.seconds,
                confirmedPreflight: confirmedPreflight,
                paintoverComposite: composite)
            // Backend atomically persists the submitting handle and exact
            // source binding before provider IO. A generic native frame patch
            // here would advance general OCC and could overwrite that state.
            if let reconciliationMessage = StoryboardVideoJobLifecyclePolicy
                .reconciliationMessage(for: job.status) {
                await board.reload()
                if isSameAIFrameIdentity(session) {
                    aiStatus = reconciliationMessage
                }
                return
            }
            guard StoryboardVideoJobLifecyclePolicy.isPollable(job.status) else {
                await board.reload()
                if isSameAIFrameIdentity(session) {
                    aiStatus = "Jobben er lagret med status «\(job.status)». Automatisk statuskontroll er satt på pause; jobben blir ikke sendt på nytt."
                }
                return
            }
            if isCurrentAIFrameSession(session) {
                aiStatus = job.estimatedCostUsd.map {
                    String(format: "Animerer · estimert $%.2f …", $0)
                } ?? "Animerer …"
            }
            var consecutivePollErrors = 0
            for _ in 0..<72 {
                try await Task.sleep(nanoseconds: 5_000_000_000)
                let status: StoryboardAIJobSummary
                do {
                    status = try await RoleRoomAPIClient.shared.pollStoryboardAnimation(
                        projectId: input.projectId, storyboardId: storyboardId,
                        jobId: job.jobId)
                    consecutivePollErrors = 0
                } catch {
                    consecutivePollErrors += 1
                    if consecutivePollErrors < 5 { continue }
                    throw error
                }
                if status.status == "completed" {
                    // The server has already settled and conditionally
                    // adopted the completion in one transaction. Reload that
                    // state; a second client-side URL patch could attach an
                    // old paid result after a concurrent source edit.
                    await board.reload()
                    if isSameAIFrameIdentity(session) {
                        if StoryboardAIVideoCompletionPolicy.serverAdopted(status),
                           canvasState.shotFraming.canonicalFingerprint
                                == framingFingerprint,
                           let currentFrame = board.frame,
                           videoBelongsToCurrentActiveSource(currentFrame) {
                            aiStatus = "Animert shot klart ✓"
                        } else {
                            aiStatus = "Animasjonen er ferdig, men kilden ble endret. Resultatet er arkivert og er ikke festet til aktivt shot."
                        }
                    }
                    return
                }
                if let reconciliationMessage = StoryboardVideoJobLifecyclePolicy
                    .reconciliationMessage(for: status.status) {
                    await board.reload()
                    if isSameAIFrameIdentity(session) {
                        aiStatus = reconciliationMessage
                    }
                    return
                }
                if StoryboardVideoJobLifecyclePolicy
                    .normalizedStatus(status.status) == "failed" {
                    await board.reload()
                    if isCurrentAIFrameSession(session) {
                        aiStatus = status.error ?? "AI-video feilet"
                    }
                    return
                }
                guard StoryboardVideoJobLifecyclePolicy
                    .isPollable(status.status) else {
                    await board.reload()
                    if isSameAIFrameIdentity(session) {
                        aiStatus = "Jobben er lagret med status «\(status.status)». Automatisk statuskontroll er satt på pause; jobben blir ikke sendt på nytt."
                    }
                    return
                }
            }
            if isCurrentAIFrameSession(session) {
                aiStatus = "Jobben kjører videre; åpne shotet senere for status"
            }
        } catch {
            if isCurrentAIFrameSession(session) {
                aiStatus = error.localizedDescription
            }
        }
    }

    private func glyphButton(
        _ symbol: String, value: String, current: String?, action: @escaping () -> Void
    ) -> some View {
        let selected = current == value
        return Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13))
                .foregroundStyle(selected ? .white : BoardBrand.dim)
                .frame(width: 44, height: 44)
                .background(selected ? BoardBrand.accent : Color.white.opacity(0.05),
                            in: RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(value)
    }

    private func inspectorPicker(
        _ label: String, value: String?, options: [String], onSelect: @escaping (String) -> Void
    ) -> some View {
        HStack {
            panelLabel(label)
            Spacer()
            Menu {
                ForEach(options, id: \.self) { option in
                    Button(option) { onSelect(option) }
                }
            } label: {
                Text(value ?? "—")
                    .font(.system(size: 13)).foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 44)
                    .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
            }
            .accessibilityLabel("\(label): \(value ?? "Ikke valgt")")
        }
    }

    private func scenarioPicker<Option: Identifiable>(
        _ label: String,
        value: String?,
        options: [Option],
        optionLabel: @escaping (Option) -> String,
        onSelect: @escaping (String) -> Void
    ) -> some View where Option.ID == String {
        HStack {
            panelLabel(label)
            Spacer()
            Menu {
                ForEach(options) { option in
                    Button(optionLabel(option)) { onSelect(option.id) }
                }
            } label: {
                Text(value ?? "—")
                    .font(.system(size: 12)).foregroundStyle(.white)
                    .lineLimit(1)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 44)
                    .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
            }
            .accessibilityLabel("\(label): \(value ?? "Ikke valgt")")
        }
    }

    // MARK: Bunnpaneler (Brushes | Layers | Navigator) — mockup-stil

    private var brushBar: some View {
        HStack(alignment: .top, spacing: 0) {
            brushesPanel
            Divider().overlay(BoardBrand.border)
            layersPanel
            Divider().overlay(BoardBrand.border)
            navigatorPanel
        }
        .frame(height: 190)
        .background(BoardBrand.panel)
    }

    // Story Brush Engine-settet (spec §47/§83): DRAW / TONE / CLEAN.
    private static let brushChips: [(BrushType, String)] =
        BrushCatalog.all.map { ($0, BrushCatalog.displayName($0)) }

    private var brushColorBinding: Binding<Color> {
        Binding(
            get: { Color(hex: canvasState.brushColor) ?? .black },
            set: { canvasState.brushColor = $0.hexString }
        )
    }

    // Smoothing vises som pensel-default til brukeren overstyrer (web-paritet
    // streamlineOverride = pct * 0.92).
    private var smoothingBinding: Binding<Double> {
        Binding(
            get: {
                canvasState.streamlineOverride.map { $0 / 0.92 }
                    ?? Streamline.amount(for: canvasState.brushType) / 0.92
            },
            set: { canvasState.streamlineOverride = $0 * 0.92 }
        )
    }

    private var brushesPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button { showBrushEditor = true } label: {
                    HStack(spacing: 4) {
                        panelLabel("Brushes")
                        Image(systemName: "slider.horizontal.3")
                            .font(.system(size: 9, weight: .bold)).foregroundStyle(BoardBrand.label)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pensel-editor")
                // Valgt pensel med navn — glyfene alene sa ikke hva som er aktivt.
                Text(Self.brushChips.first(where: { $0.0 == canvasState.brushType })?.1 ?? "")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(BoardBrand.accent.opacity(0.25), in: Capsule())
                if board.frame?.imageUrl != nil {
                    Label("Bilde redigeres", systemImage: "photo.badge.checkmark")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.green)
                        .accessibilityLabel("Panelbildet er redigerbart")
                }
                Spacer()
                Button { canvasState.undo() } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: 13)).foregroundStyle(canvasState.undoStack.isEmpty ? BoardBrand.label : .white)
                }
                .disabled(canvasState.undoStack.isEmpty)
                .accessibilityLabel("Angre")
                .accessibilityHint("To fingre på tegneflaten eller Kommando-Z")
                Button { canvasState.redo() } label: {
                    Image(systemName: "arrow.uturn.forward")
                        .font(.system(size: 13)).foregroundStyle(canvasState.redoStack.isEmpty ? BoardBrand.label : .white)
                }
                .disabled(canvasState.redoStack.isEmpty)
                .accessibilityLabel("Gjenta")
                .accessibilityHint("Tre fingre på tegneflaten eller Skift-Kommando-Z")
                Text("\(canvasState.strokes.count) strøk")
                    .font(.system(size: 10).monospacedDigit()).foregroundStyle(BoardBrand.dim)
            }
            HStack(alignment: .top, spacing: 14) {
                // Tip-glyfer i 2×5-grid (mockup) — form, ikke tekst.
                // Scrollbart glyf-grid — penselfamilien vokser.
                ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 4) {
                    let chips = sortedBrushChips()
                    ForEach(0..<((chips.count + 4) / 5), id: \.self) { row in
                        HStack(spacing: 5) {
                            ForEach(Array(chips[(row * 5)..<min(row * 5 + 5, chips.count)]), id: \.0) { type, name in
                                let selected = canvasState.brushType == type
                                let favorite = canvasState.favoriteBrushes.contains(type.rawValue)
                                Button {
                                    canvasState.selectBrush(type)
                                    boardTool = [.eraser, .vinyl, .kneaded, .lightlift].contains(type)
                                        ? .eraser
                                        : .draw
                                } label: {
                                    BrushTipGlyph(type: type)
                                        .frame(width: 44, height: 26)
                                        .background(selected ? Color.white.opacity(0.12) : Color.white.opacity(0.04),
                                                    in: RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8)
                                            .stroke(selected ? BoardBrand.accent : BoardBrand.border,
                                                    lineWidth: selected ? 1.5 : 1))
                                        .overlay(alignment: .topTrailing) {
                                            if favorite {
                                                Image(systemName: "star.fill")
                                                    .font(.system(size: 6))
                                                    .foregroundStyle(.yellow)
                                                    .padding(2)
                                            }
                                        }
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(name)
                                .accessibilityValue(selected ? "valgt" : "ikke valgt")
                                .contextMenu {
                                    Text(BrushDefaults.describe(type))
                                    Button {
                                        canvasState.toggleFavoriteBrush(type)
                                    } label: {
                                        Label(favorite ? "Fjern favoritt" : "Favoritt",
                                              systemImage: favorite ? "star.slash" : "star")
                                    }
                                }
                            }
                        }
                    }
                }
                }
                .frame(height: 92)
                .accessibilityIdentifier("brush-palette-scroll")
                VStack(spacing: 4) {
                    HStack(spacing: 5) {
                        ColorPicker("Farge", selection: brushColorBinding, supportsOpacity: false)
                            .labelsHidden().frame(width: 32, height: 28)
                        Button { canvasState.colorPickArmed.toggle() } label: {
                            Image(systemName: "eyedropper")
                                .font(.system(size: 12))
                                .foregroundStyle(canvasState.colorPickArmed ? .white : BoardBrand.dim)
                                .frame(width: 24, height: 24)
                                .background(canvasState.colorPickArmed ? BoardBrand.accent : Color.white.opacity(0.05),
                                            in: RoundedRectangle(cornerRadius: 7))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Fargeplukker")
                        if canvasState.brushType == .stamp || canvasState.brushType == .custom {
                            PhotosPicker(selection: $tipPickerItem, matching: .images) {
                                Image(systemName: "square.and.arrow.down")
                                    .font(.system(size: 12))
                                    .foregroundStyle(BoardBrand.dim)
                                    .frame(width: 24, height: 24)
                                    .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 7))
                            }
                            .accessibilityLabel("Importer penselspiss")
                            // Innebygd symbolsett (SF Symbols → spiss)
                            ForEach(Self.stampSymbols, id: \.self) { symbol in
                                Button {
                                    if let dataURL = Self.symbolTipDataURL(symbol) {
                                        if canvasState.brushType == .stamp {
                                            canvasState.stampTipDataURL = dataURL
                                            UserDefaults.standard.set(dataURL, forKey: "sb.stampTip")
                                        } else {
                                            canvasState.customTipDataURL = dataURL
                                            UserDefaults.standard.set(dataURL, forKey: "sb.customTip")
                                        }
                                    }
                                } label: {
                                    Image(systemName: symbol)
                                        .font(.system(size: 11))
                                        .foregroundStyle(BoardBrand.dim)
                                        .frame(width: 22, height: 22)
                                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 6))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Symbol \(symbol)")
                            }
                        }
                        if canvasState.brushType == .eraser || canvasState.brushType == .vinyl {
                            // Objektmodus: berørte strøk slettes hele
                            Button { canvasState.eraserObjectMode.toggle() } label: {
                                Image(systemName: "scissors")
                                    .font(.system(size: 12))
                                    .foregroundStyle(canvasState.eraserObjectMode ? .white : BoardBrand.dim)
                                    .frame(width: 24, height: 24)
                                    .background(canvasState.eraserObjectMode ? BoardBrand.accent : Color.white.opacity(0.05),
                                                in: RoundedRectangle(cornerRadius: 7))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Strøk-viskelær")
                        }
                        // Nylige farger
                        ForEach(canvasState.recentColors.prefix(6), id: \.self) { hex in
                            Button { canvasState.brushColor = hex } label: {
                                Circle()
                                    .fill(Color(hex: hex) ?? .white)
                                    .frame(width: 16, height: 16)
                                    .overlay(Circle().stroke(
                                        canvasState.brushColor == hex ? BoardBrand.accent : BoardBrand.border,
                                        lineWidth: canvasState.brushColor == hex ? 1.5 : 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                // Sliders vertikalt m/ verdi til høyre (mockup)
                VStack(spacing: 10) {
                    sliderRow("Size", value: $canvasState.brushSize, range: 1...120,
                              display: "\(Int(canvasState.brushSize)) px")
                    sliderRow("Opacity", value: $canvasState.brushOpacity, range: 0.1...1,
                              display: "\(Int(canvasState.brushOpacity * 100))%")
                    sliderRow("Smothing", value: smoothingBinding, range: 0...1,
                              display: "\(Int(smoothingBinding.wrappedValue * 100))%")
                }
                .frame(maxWidth: .infinity)
                // Strøk-forhåndsvisning: ekte dabs gjennom motoren
                StrokePreview(brush: canvasState.currentBrush())
                    .frame(width: 118, height: 122)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity)
    }

    /// Favoritter først (stabil rekkefølge ellers).
    private func sortedBrushChips() -> [(BrushType, String)] {
        let selection = board.frame.flatMap(effectiveScenario)
        let recommended = ProductionMarkCatalog.recommendedStamps(
            packId: selection?.packId, subdomainId: selection?.subdomainId)
        let front = BrushCatalog.core + recommended.filter { !BrushCatalog.core.contains($0) }
        let curated = front + BrushCatalog.all.filter { !front.contains($0) }
        let base = curated.map { ($0, BrushCatalog.displayName($0)) }
        let favorites = canvasState.favoriteBrushes
        guard !favorites.isEmpty else { return base }
        return base.filter { favorites.contains($0.0.rawValue) }
            + base.filter { !favorites.contains($0.0.rawValue) }
    }

    private func sliderRow(
        _ label: String, value: Binding<Double>, range: ClosedRange<Double>, display: String
    ) -> some View {
        HStack(spacing: 8) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold)).kerning(0.8)
                .foregroundStyle(BoardBrand.label)
            Slider(value: value, in: range).tint(BoardBrand.accent)
            Text(display)
                .font(.system(size: 10).monospacedDigit()).foregroundStyle(BoardBrand.dim)
                .frame(width: 40, alignment: .trailing)
        }
    }

    private var activeLayerOpacityBinding: Binding<Double> {
        Binding(
            get: { canvasState.layerOpacity[canvasState.activeBoardLayer] ?? 1 },
            set: { canvasState.layerOpacity[canvasState.activeBoardLayer] = $0 }
        )
    }

    private func mutateLayers(_ label: String, _ mutation: () -> Void) {
        canvasState.captureUndo(label)
        mutation()
        canvasState.revision += 1
        canvasState.persistHistory()
    }

    private func addLayer(named rawName: String) {
        let name = String(rawName.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40))
        newLayerName = ""
        guard !name.isEmpty, !canvasState.layerOrder.contains(name) else { return }
        automaticallySelectedAIRasterLayer = nil
        mutateLayers("Opprett lag") {
            canvasState.layerOrder.insert(name, at: 0)
            canvasState.activeBoardLayer = name
        }
    }

    private func duplicateActiveLayer() {
        automaticallySelectedAIRasterLayer = nil
        let source = canvasState.activeBoardLayer
        var candidate = "\(source) copy"
        var suffix = 2
        while canvasState.layerOrder.contains(candidate) {
            candidate = "\(source) copy \(suffix)"
            suffix += 1
        }
        let target = candidate
        mutateLayers("Dupliser lag") {
            let sourceIndex = canvasState.layerOrder.firstIndex(of: source) ?? 0
            canvasState.layerOrder.insert(target, at: sourceIndex)
            canvasState.layerOpacity[target] = canvasState.layerOpacity[source] ?? 1
            canvasState.layerBlendModes[target] = canvasState.layerBlendModes[source] ?? .normal
            let copies = canvasState.strokes.filter { ($0.boardLayer ?? "Drawing") == source }
                .map { stroke -> PencilStroke in
                    var copy = stroke
                    copy.id = "layer-copy-\(UUID().uuidString)"
                    copy.boardLayer = target
                    return copy
                }
            canvasState.strokes.append(contentsOf: copies)
            canvasState.activeBoardLayer = target
        }
    }

    private func deleteActiveCustomLayer() {
        automaticallySelectedAIRasterLayer = nil
        let target = canvasState.activeBoardLayer
        guard !BoardLayers.defaultOrder.contains(target), canvasState.layerOrder.count > 1 else { return }
        mutateLayers("Slett lag") {
            canvasState.strokes.removeAll { ($0.boardLayer ?? "Drawing") == target }
            canvasState.layerOrder.removeAll { $0 == target }
            canvasState.hiddenLayers.remove(target)
            canvasState.lockedLayers.remove(target)
            canvasState.layerOpacity.removeValue(forKey: target)
            canvasState.layerBlendModes.removeValue(forKey: target)
            canvasState.activeBoardLayer = canvasState.layerOrder.first ?? "Drawing"
        }
    }

    private func selectBoardLayer(_ layer: String) {
        automaticallySelectedAIRasterLayer = nil
        canvasState.activeBoardLayer = layer
    }

    private func moveLayer(_ layer: String, offset: Int) {
        guard let index = canvasState.layerOrder.firstIndex(of: layer) else { return }
        let destination = min(canvasState.layerOrder.count - 1, max(0, index + offset))
        guard destination != index else { return }
        mutateLayers("Flytt lag") {
            canvasState.layerOrder.remove(at: index)
            canvasState.layerOrder.insert(layer, at: destination)
        }
    }

    private static let layerIcons: [String: String] = [
        "Drawing": "paintbrush.pointed.fill",
        "Color": "paintpalette.fill",
        "Atmosphere": "cloud.fog.fill",
        "Camera / Arrows": "arrow.up.right.square",
        "Dialog": "text.bubble",
        "Notes": "note.text",
    ]

    private func productionPaletteButton(
        _ label: String, accessibilityName: String,
        color: String, brush: BrushType
    ) -> some View {
        let active = canvasState.brushColor == color && canvasState.brushType == brush
        return Button {
            canvasState.selectBrush(brush)
            canvasState.brushColor = color
            boardTool = .draw
        } label: {
            HStack(spacing: 3) {
                Circle().fill(Color(hex: color) ?? .white)
                    .frame(width: 9, height: 9)
                Text(label).font(.system(size: 8, weight: .bold))
                    .foregroundStyle(active ? .white : BoardBrand.dim)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(active ? BoardBrand.accent.opacity(0.3) : Color.white.opacity(0.05),
                        in: RoundedRectangle(cornerRadius: 5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityName)
        .accessibilityValue(active ? "valgt" : "ikke valgt")
    }

    private var layersPanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                panelLabel("Layers")
                Spacer()
                Menu {
                    Button("Nytt lag", systemImage: "plus") { showNewLayerPrompt = true }
                    Button("Dupliser aktivt lag", systemImage: "plus.square.on.square") {
                        duplicateActiveLayer()
                    }
                    Button("Slett aktivt lag", systemImage: "trash", role: .destructive) {
                        deleteActiveCustomLayer()
                    }
                    .disabled(BoardLayers.defaultOrder.contains(canvasState.activeBoardLayer))
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Laghandlinger")
            }
            ScrollView(.vertical, showsIndicators: true) {
                LazyVStack(spacing: 2) {
                    ForEach(canvasState.layerOrder, id: \.self) { layer in
                let active = canvasState.activeBoardLayer == layer
                let hidden = canvasState.hiddenLayers.contains(layer)
                let locked = canvasState.lockedLayers.contains(layer)
                HStack(spacing: 4) {
                    Button {
                        mutateLayers(hidden ? "Vis lag" : "Skjul lag") {
                            if hidden { canvasState.hiddenLayers.remove(layer) }
                            else { canvasState.hiddenLayers.insert(layer) }
                        }
                    } label: {
                        Image(systemName: hidden ? "eye.slash" : "eye")
                            .font(.system(size: 11))
                            .foregroundStyle(hidden ? BoardBrand.label : BoardBrand.dim)
                            .frame(width: 36, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Vis \(layer)")
                    Image(systemName: Self.layerIcons[layer] ?? "square")
                        .font(.system(size: 9))
                        .foregroundStyle(active ? .white : BoardBrand.label)
                    Button { selectBoardLayer(layer) } label: {
                        Text(layer)
                            .font(.system(size: 11, weight: active ? .bold : .regular))
                            .foregroundStyle(active ? .white : BoardBrand.dim)
                            .lineLimit(1)
                    }
                    .buttonStyle(.plain)
                    .accessibilityValue(active ? "valgt" : "ikke valgt")
                    Spacer(minLength: 0)
                    VStack(spacing: 0) {
                        Button { moveLayer(layer, offset: -1) } label: {
                            Image(systemName: "chevron.up").frame(width: 24, height: 20)
                        }
                        .disabled(canvasState.layerOrder.first == layer)
                        Button { moveLayer(layer, offset: 1) } label: {
                            Image(systemName: "chevron.down").frame(width: 24, height: 20)
                        }
                        .disabled(canvasState.layerOrder.last == layer)
                    }
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(BoardBrand.label)
                    Button {
                        mutateLayers(locked ? "Lås opp lag" : "Lås lag") {
                            if locked { canvasState.lockedLayers.remove(layer) }
                            else { canvasState.lockedLayers.insert(layer) }
                        }
                    } label: {
                        Image(systemName: locked ? "lock.fill" : "lock.open")
                            .font(.system(size: 10))
                            .foregroundStyle(locked ? BoardBrand.accent : BoardBrand.label)
                            .frame(width: 36, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Lås \(layer)")
                }
                .padding(.horizontal, 4)
                .frame(minHeight: 44)
                        .background(active ? BoardBrand.accent.opacity(0.22) : .clear,
                                    in: RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
            .frame(maxHeight: .infinity)
            // Blend-modus og opacity lagres med dokumentet og brukes av Metal
            // både på lerretet og i eksport.
            HStack(spacing: 8) {
                Menu {
                    ForEach(BoardLayerBlendMode.allCases) { mode in
                        Button {
                            guard canvasState.layerBlendModes[canvasState.activeBoardLayer] != mode else {
                                return
                            }
                            mutateLayers("Endre blend mode") {
                                canvasState.layerBlendModes[canvasState.activeBoardLayer] = mode
                            }
                        } label: {
                            if (canvasState.layerBlendModes[canvasState.activeBoardLayer] ?? .normal) == mode {
                                Label(mode.label, systemImage: "checkmark")
                            } else {
                                Text(mode.label)
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text((canvasState.layerBlendModes[canvasState.activeBoardLayer] ?? .normal).label)
                            .font(.system(size: 10, weight: .semibold)).foregroundStyle(.white)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 7, weight: .bold)).foregroundStyle(BoardBrand.dim)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))
                }
                Slider(value: activeLayerOpacityBinding, in: 0.05...1) { editing in
                    if editing { canvasState.captureUndo("Juster lagopasitet") }
                    else {
                        canvasState.revision += 1
                        canvasState.persistHistory()
                    }
                }
                    .tint(BoardBrand.accent)
                Text("\(Int((canvasState.layerOpacity[canvasState.activeBoardLayer] ?? 1) * 100))%")
                    .font(.system(size: 9).monospacedDigit()).foregroundStyle(BoardBrand.dim)
                    .frame(width: 28, alignment: .trailing)
            }
            .padding(.top, 2)
        }
        .padding(12)
        .frame(width: 200)
    }

    private var navigatorPanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            panelLabel("Navigator")
            // Minimap av arket: alle shots i scenen, aktiv i fiolett;
            // tap hopper til raden.
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 3),
                      spacing: 4) {
                ForEach(Array((board.scene?.frames ?? []).enumerated()), id: \.element.id) { index, frame in
                    Button { scrollTarget = index } label: {
                        ZStack {
                            Color.black.opacity(0.22)
                            if let image = shotPreviewImages[frame.id]
                                ?? safeDirectRasterFallback(for: frame) {
                                Image(uiImage: image)
                                    .resizable()
                                    .interpolation(.high)
                                    .scaledToFit()
                            } else {
                                Color.white.opacity(0.07)
                            }
                        }
                        .frame(height: 24)
                        .clipShape(RoundedRectangle(cornerRadius: 3))
                        .overlay(RoundedRectangle(cornerRadius: 3)
                            .stroke(index == board.activeFrameIndex ? BoardBrand.accent : BoardBrand.border,
                                    lineWidth: index == board.activeFrameIndex ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Gå til shot \(frame.shotNumber)")
                }
            }
            Spacer(minLength: 0)
            // Zoom styrer arkbredden (reflow — canvas skalerer med)
            HStack(spacing: 6) {
                Button { sheetZoom = max(0.5, sheetZoom - 0.1) } label: {
                    Image(systemName: "minus").font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                }
                Slider(value: $sheetZoom, in: 0.5...1.4).tint(BoardBrand.accent)
                Button { sheetZoom = min(1.4, sheetZoom + 0.1) } label: {
                    Image(systemName: "plus").font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                }
                Text("\(Int(sheetZoom * 100))%")
                    .font(.system(size: 9).monospacedDigit()).foregroundStyle(BoardBrand.dim)
                    .frame(width: 30, alignment: .trailing)
            }
        }
        .padding(12)
        .frame(width: 200)
    }
}

// MARK: Animatic — scene-avspilling med per-shot varighet (native AnimaticLite)

// Voiceover per shot: m4a i Documents/voiceover/<frameId>.m4a — lokalt
// på enheten (server-synk er bevisst utelatt; animatic-lyd er arbeidslyd).
enum VoiceoverStore {
    enum PersistedVoiceoverError: Error, Sendable, Equatable {
        case malformedDataURL
        case emptyAudio
    }

    static var directory: URL {
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("voiceover", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func url(frameId: String) -> URL {
        directory.appendingPathComponent("\(frameId).m4a")
    }

    static func exists(frameId: String) -> Bool {
        FileManager.default.fileExists(atPath: url(frameId: frameId).path)
    }

    static func delete(frameId: String) {
        try? FileManager.default.removeItem(at: url(frameId: frameId))
    }

    /// Decodes only the audio/base64 form written by Storyboard Room. A
    /// non-empty persisted value is authoritative production data, so a
    /// malformed payload must never be treated as if the shot had no audio.
    static func persistedAudioData(from dataURL: String) throws -> Data {
        let trimmed = dataURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.lowercased().hasPrefix("data:audio/"),
              let comma = trimmed.firstIndex(of: ","),
              trimmed[..<comma].lowercased().hasSuffix(";base64"),
              let data = Data(base64Encoded: String(
                trimmed[trimmed.index(after: comma)...]))
        else { throw PersistedVoiceoverError.malformedDataURL }
        guard !data.isEmpty else { throw PersistedVoiceoverError.emptyAudio }
        return data
    }

    /// Materializes synced audio before playback/export. Existing local
    /// recordings win during their pending sync window, but every declared
    /// server payload is still validated fail-closed.
    static func materializePersistedAudio(for frames: [FrameSummary]) throws {
        for frame in frames {
            guard let raw = frame.voiceoverDataURL?
                    .trimmingCharacters(in: .whitespacesAndNewlines),
                  !raw.isEmpty else { continue }
            let data = try persistedAudioData(from: raw)
            let destination = url(frameId: frame.id)
            guard !FileManager.default.fileExists(atPath: destination.path)
            else { continue }
            try data.write(to: destination, options: .atomic)
        }
    }
}

/// Shared geometry for every fixed-size storyboard surface. Images are scaled
/// uniformly and centered, so portrait, CinemaScope and legacy formats keep
/// their authored pixel aspect instead of being stretched to the container.
enum StoryboardAspectLayout {
    static func aspectFitRect(sourceSize: CGSize, in container: CGRect) -> CGRect {
        guard sourceSize.width.isFinite, sourceSize.height.isFinite,
              container.width.isFinite, container.height.isFinite,
              sourceSize.width > 0, sourceSize.height > 0,
              container.width > 0, container.height > 0 else {
            return container
        }
        let scale = min(
            container.width / sourceSize.width,
            container.height / sourceSize.height)
        let fittedSize = CGSize(
            width: sourceSize.width * scale,
            height: sourceSize.height * scale)
        return CGRect(
            x: container.midX - fittedSize.width / 2,
            y: container.midY - fittedSize.height / 2,
            width: fittedSize.width,
            height: fittedSize.height)
    }
}

enum AnimaticTimelineError: Error, Sendable, Equatable {
    case emptyTimeline
    case nonPositiveDuration(frameIndex: Int)
    case inexactDuration(frameIndex: Int, timelineTimescale: Int32)
    case inconsistentStoryboardTiming(frameIndex: Int)
    case arithmeticOverflow
}

enum AnimaticExportError: Error, Sendable, Equatable {
    case cancelled
    case missingVideoTrack
    case cannotCreateCompositionTrack
    case invalidVoiceover(frameId: String)
    case exportSessionUnavailable
    case exportFailed
}

struct AnimaticTimelinePlan: Sendable, Equatable {
    struct Entry: Sendable, Equatable {
        let startValue: Int64
        let durationValue: Int64
    }

    let timescale: Int32
    let entries: [Entry]
    let totalValue: Int64
}

/// Builds one integer-tick edit timeline. Conversion is deliberately exact:
/// a project such as 24000/1001 cannot be exported on a 600 Hz timeline and
/// must choose a compatible timebase instead of accumulating rounded drift.
enum AnimaticTimelinePlanner {
    static func resolveTiming(
        frames: [FrameSummary],
        explicit: StoryboardTiming? = nil
    ) throws -> StoryboardTiming {
        let timing = explicit ?? frames.first?.storyboardTiming
            ?? .legacyDefault
        for (index, frame) in frames.enumerated()
        where frame.storyboardTiming != timing {
            throw AnimaticTimelineError.inconsistentStoryboardTiming(
                frameIndex: index)
        }
        return timing
    }

    static func make(
        durations: [MediaTime],
        timing: StoryboardTiming
    ) throws -> AnimaticTimelinePlan {
        guard !durations.isEmpty else {
            throw AnimaticTimelineError.emptyTimeline
        }
        var entries: [AnimaticTimelinePlan.Entry] = []
        entries.reserveCapacity(durations.count)
        var cursor: Int64 = 0
        for (index, duration) in durations.enumerated() {
            guard duration > .zero else {
                throw AnimaticTimelineError.nonPositiveDuration(
                    frameIndex: index)
            }
            let ticks: Int64
            do {
                ticks = try duration.scaledValueExactly(
                    to: timing.timelineTimescale)
            } catch {
                throw AnimaticTimelineError.inexactDuration(
                    frameIndex: index,
                    timelineTimescale: timing.timelineTimescale)
            }
            guard ticks > 0 else {
                throw AnimaticTimelineError.nonPositiveDuration(
                    frameIndex: index)
            }
            entries.append(.init(
                startValue: cursor, durationValue: ticks))
            let next = cursor.addingReportingOverflow(ticks)
            guard !next.overflow else {
                throw AnimaticTimelineError.arithmeticOverflow
            }
            cursor = next.partialValue
        }
        return AnimaticTimelinePlan(
            timescale: timing.timelineTimescale,
            entries: entries,
            totalValue: cursor)
    }
}

/// Distinguishes an intentionally blank shot (which receives a slate) from a
/// shot that claims artwork but lost it somewhere in cache/coordinator/render.
/// Malformed non-empty stroke payloads count as declared content and therefore
/// fail closed rather than being mistaken for a creative blank.
enum AnimaticFrameContentPolicy {
    static func declaresVisualContent(_ frame: FrameSummary) -> Bool {
        if hasText(frame.imageUrl)
            || hasText(frame.thumbnailDataURL)
            || hasText(frame.aiVideoURL)
            || frame.aiPaintoverState?.colorHasContent == true
            || frame.aiPaintoverState?.atmosphereHasContent == true {
            return true
        }
        guard let raw = frame.strokesJSON?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty else { return false }
        guard let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data)
        else { return true }
        if let strokes = object as? [Any] { return !strokes.isEmpty }
        return !(object is NSNull)
    }

    static func acceptsRenderAvailability(
        frames: [FrameSummary],
        rendered: [Bool]
    ) -> Bool {
        guard frames.count == rendered.count else { return false }
        return zip(frames, rendered).allSatisfy { frame, isAvailable in
            !declaresVisualContent(frame) || isAvailable
        }
    }

    private static func hasText(_ value: String?) -> Bool {
        guard let value else { return false }
        return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

// Animatic → MP4 på prosjektets eksakte frame-grid (H.264 1280×720).
// Samme rasjonelle localTime som previewen bruker evaluerer kamerabanen; en
// lagret thumbnail er aldri eksportkilde og bare bevisst tomme shots får slate.
@MainActor
enum AnimaticVideoExporter {
    static func export(
        sceneHeading: String,
        frames: [FrameSummary],
        storyboardTiming explicitTiming: StoryboardTiming? = nil
    ) async -> URL? {
        guard !frames.isEmpty, !Task.isCancelled else { return nil }
        let timing: StoryboardTiming
        let plan: AnimaticTimelinePlan
        let samplePlans: [StoryboardFrameSamplePlan]
        do {
            timing = try AnimaticTimelinePlanner.resolveTiming(
                frames: frames, explicit: explicitTiming)
            plan = try AnimaticTimelinePlanner.make(
                durations: frames.map(\.effectiveShotDuration),
                timing: timing)
            samplePlans = try zip(frames, plan.entries).map { frame, entry in
                try StoryboardFrameSamplePlan.make(
                    shotDuration: frame.effectiveShotDuration,
                    timing: timing,
                    shotStart: MediaTime(
                        value: entry.startValue,
                        timescale: plan.timescale))
            }
        } catch {
            return nil
        }

        do {
            try VoiceoverStore.materializePersistedAudio(for: frames)
        } catch {
            return nil
        }
        await FrameImageCache.prefetch(frames: frames)
        guard !Task.isCancelled else { return nil }
        let declaresContent = frames.map(
            AnimaticFrameContentPolicy.declaresVisualContent)
        for frame in frames {
            guard FrameRenderCoordinator.canPlayCameraMotion(frame: frame)
            else { return nil }
        }
        for (frame, hasContent) in zip(frames, declaresContent) where hasContent {
            guard let snapshot = try? FrameRenderCoordinator.snapshot(
                for: frame,
                at: .zero),
                  FrameRenderCoordinator.canRender(
                    frame: frame, snapshot: snapshot) else { return nil }
        }
        let tZeroRendered: [UIImage?] = zip(frames, declaresContent).map {
            frame, hasContent in
            guard hasContent else { return nil }
            return FrameRenderCoordinator.image(
                for: frame, maxWidth: 1280, at: .zero)
        }
        guard AnimaticFrameContentPolicy.acceptsRenderAvailability(
            frames: frames,
            rendered: tZeroRendered.map { $0 != nil }) else { return nil }

        let videoSize = CGSize(width: 1280, height: 720)
        let safeHeading = sceneHeading
            .replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(
                "\(safeHeading)-\(UUID().uuidString)-animatic.mp4")
        try? FileManager.default.removeItem(at: url)
        guard let writer = try? AVAssetWriter(
            outputURL: url, fileType: .mp4) else { return nil }
        var completed = false
        defer {
            if !completed {
                if writer.status == .writing { writer.cancelWriting() }
                try? FileManager.default.removeItem(at: url)
            }
        }
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(videoSize.width),
            AVVideoHeightKey: Int(videoSize.height),
        ])
        input.expectsMediaDataInRealTime = false
        input.mediaTimeScale = timing.timelineTimescale
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: Int(videoSize.width),
                kCVPixelBufferHeightKey as String: Int(videoSize.height),
            ])
        guard writer.canAdd(input) else { return nil }
        writer.add(input)
        guard writer.startWriting() else { return nil }
        writer.startSession(atSourceTime: .zero)

        func append(
            _ buffer: CVPixelBuffer,
            at presentationTime: CMTime
        ) async -> Bool {
            while !input.isReadyForMoreMediaData {
                guard !Task.isCancelled, writer.status == .writing else {
                    return false
                }
                do {
                    try await Task.sleep(nanoseconds: 20_000_000)
                } catch {
                    return false
                }
            }
            guard !Task.isCancelled, writer.status == .writing else {
                return false
            }
            return adaptor.append(
                buffer, withPresentationTime: presentationTime)
        }

        for (index, frame) in frames.enumerated() {
            guard !Task.isCancelled else { return nil }
            let entry = plan.entries[index]
            let framePlan = samplePlans[index]
            let hasMotion = frame.renderableCameraMotionTrack.map {
                $0.enabled && !$0.keyframes.isEmpty
            } ?? false
            let transition = (frame.transition ?? "").lowercased()
            let usesBlend = index + 1 < frames.count
                && (transition.contains("dissolve")
                    || transition.contains("fade"))
                && entry.durationValue > framePlan.frameDurationValue
            let fadeWindow = usesBlend
                ? min(
                    entry.durationValue - framePlan.frameDurationValue,
                    max(framePlan.frameDurationValue,
                        Int64(plan.timescale) / 2))
                : 0
            let fadeStart = entry.durationValue - fadeWindow

            for sample in framePlan.samples {
                guard !Task.isCancelled else { return nil }
                let image: UIImage?
                if declaresContent[index] {
                    image = hasMotion
                        ? FrameRenderCoordinator.image(
                            for: frame,
                            maxWidth: 1280,
                            at: sample.localTime)
                        : tZeroRendered[index]
                    guard image != nil else { return nil }
                } else {
                    image = nil
                }

                var presentedImage = image
                guard let localValue = try? sample.localTime
                    .scaledValueExactly(to: plan.timescale),
                      let presentationValue = try? sample.presentationTime
                        .scaledValueExactly(to: plan.timescale)
                else { return nil }
                if usesBlend,
                   fadeWindow > 0,
                   localValue >= fadeStart,
                   let currentImage = image,
                   let nextImage = tZeroRendered[index + 1] {
                    let alpha = CGFloat(localValue - fadeStart)
                        / CGFloat(fadeWindow)
                    let format = UIGraphicsImageRendererFormat()
                    format.scale = 1
                    presentedImage = UIGraphicsImageRenderer(
                        size: videoSize, format: format)
                        .image { context in
                            UIColor.white.setFill()
                            context.fill(CGRect(
                                origin: .zero, size: videoSize))
                            currentImage.draw(
                                in: aspectFit(currentImage, in: videoSize),
                                blendMode: .normal, alpha: 1 - alpha)
                            nextImage.draw(
                                in: aspectFit(nextImage, in: videoSize),
                                blendMode: .normal, alpha: alpha)
                        }
                }
                guard let buffer = pixelBuffer(
                    image: presentedImage,
                    shotNumber: frame.shotNumber,
                    size: videoSize),
                      await append(buffer, at: CMTime(
                        value: presentationValue,
                        timescale: plan.timescale)) else { return nil }
            }
        }
        input.markAsFinished()
        writer.endSession(atSourceTime: CMTime(
            value: plan.totalValue, timescale: plan.timescale))
        await withCheckedContinuation { continuation in
            writer.finishWriting { continuation.resume() }
        }
        guard writer.status == .completed, !Task.isCancelled else {
            return nil
        }
        do {
            let finalURL = try await mixVoiceover(
                videoURL: url, frames: frames, plan: plan)
            completed = true
            return finalURL
        } catch {
            return nil
        }
    }

    /// Legg voiceover-klippene inn på shot-tidene (composition + re-eksport).
    /// Uten voiceover returneres videofilen urørt.
    private static func mixVoiceover(
        videoURL: URL,
        frames: [FrameSummary],
        plan: AnimaticTimelinePlan
    ) async throws -> URL {
        let voicedFrames = frames.filter {
            VoiceoverStore.exists(frameId: $0.id)
        }
        guard !voicedFrames.isEmpty else { return videoURL }
        guard !Task.isCancelled else { throw AnimaticExportError.cancelled }

        let composition = AVMutableComposition()
        let videoAsset = AVURLAsset(url: videoURL)
        let videoTracks = try await videoAsset.loadTracks(
            withMediaType: .video)
        guard let videoTrack = videoTracks.first else {
            throw AnimaticExportError.missingVideoTrack
        }
        let videoDuration = try await videoAsset.load(.duration)
        guard let compositionVideo = composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID: kCMPersistentTrackID_Invalid),
              let compositionAudio = composition.addMutableTrack(
                withMediaType: .audio,
                preferredTrackID: kCMPersistentTrackID_Invalid) else {
            throw AnimaticExportError.cannotCreateCompositionTrack
        }
        try compositionVideo.insertTimeRange(
            CMTimeRange(start: .zero, duration: videoDuration),
            of: videoTrack,
            at: .zero)

        for (frame, entry) in zip(frames, plan.entries) {
            guard !Task.isCancelled else {
                throw AnimaticExportError.cancelled
            }
            guard VoiceoverStore.exists(frameId: frame.id) else { continue }
            let audioAsset = AVURLAsset(
                url: VoiceoverStore.url(frameId: frame.id))
            let audioTracks = try await audioAsset.loadTracks(
                withMediaType: .audio)
            guard let audioTrack = audioTracks.first else {
                throw AnimaticExportError.invalidVoiceover(frameId: frame.id)
            }
            let audioDuration = try await audioAsset.load(.duration)
            guard audioDuration.isValid,
                  !audioDuration.isIndefinite,
                  CMTimeCompare(audioDuration, .zero) > 0 else {
                throw AnimaticExportError.invalidVoiceover(frameId: frame.id)
            }
            let time = CMTime(
                value: entry.startValue, timescale: plan.timescale)
            let shotDuration = CMTime(
                value: entry.durationValue, timescale: plan.timescale)
            let clip = CMTimeMinimum(audioDuration, shotDuration)
            try compositionAudio.insertTimeRange(
                CMTimeRange(start: .zero, duration: clip),
                of: audioTrack,
                at: time)
        }

        guard !Task.isCancelled else { throw AnimaticExportError.cancelled }
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(
                "\(UUID().uuidString)-animatic-voiceover.mp4")
        try? FileManager.default.removeItem(at: outputURL)
        var keepOutput = false
        defer {
            if !keepOutput { try? FileManager.default.removeItem(at: outputURL) }
        }
        guard let export = AVAssetExportSession(
            asset: composition,
            presetName: AVAssetExportPresetHighestQuality) else {
            throw AnimaticExportError.exportSessionUnavailable
        }
        export.outputURL = outputURL
        export.outputFileType = .mp4
        await withCheckedContinuation { continuation in
            export.exportAsynchronously { continuation.resume() }
        }
        guard !Task.isCancelled else { throw AnimaticExportError.cancelled }
        guard export.status == .completed else {
            throw AnimaticExportError.exportFailed
        }
        keepOutput = true
        // The mixed file supersedes the silent intermediate; keeping both for
        // every export would leak large temporary assets over a work session.
        try? FileManager.default.removeItem(at: videoURL)
        return outputURL
    }

    private static func aspectFit(_ image: UIImage?, in size: CGSize) -> CGRect {
        guard let image, image.size.width > 0, image.size.height > 0 else {
            return CGRect(origin: .zero, size: size)
        }
        return StoryboardAspectLayout.aspectFitRect(
            sourceSize: image.size,
            in: CGRect(origin: .zero, size: size))
    }

    /// Aspekt-fit på hvit flate; shots uten tegning får plakat med shot-nr.
    private static func pixelBuffer(image: UIImage?, shotNumber: String,
                                    size: CGSize) -> CVPixelBuffer? {
        var buffer: CVPixelBuffer?
        CVPixelBufferCreate(kCFAllocatorDefault, Int(size.width), Int(size.height),
                            kCVPixelFormatType_32BGRA, nil, &buffer)
        guard let buffer else { return nil }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let context = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer),
            width: Int(size.width), height: Int(size.height), bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue
                | CGImageAlphaInfo.premultipliedFirst.rawValue) else { return nil }
        UIGraphicsPushContext(context)
        context.translateBy(x: 0, y: size.height)
        context.scaleBy(x: 1, y: -1)
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: size))
        if let image {
            image.draw(in: StoryboardAspectLayout.aspectFitRect(
                sourceSize: image.size,
                in: CGRect(origin: .zero, size: size)))
        } else {
            let text = "SHOT \(shotNumber)" as NSString
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 44),
                .foregroundColor: UIColor(white: 0.55, alpha: 1),
            ]
            let textSize = text.size(withAttributes: attributes)
            text.draw(at: CGPoint(x: (size.width - textSize.width) / 2,
                                  y: (size.height - textSize.height) / 2),
                      withAttributes: attributes)
        }
        UIGraphicsPopContext()
        return buffer
    }
}

struct AnimaticView: View {
    let sceneHeading: String
    let frames: [FrameSummary]
    let storyboardTiming: StoryboardTiming
    // Synk: kalles ved opptak-stopp (dataURL) og sletting (nil) —
    // boardet PATCHer framen så lyden følger prosjektet på tvers av enheter.
    var onVoiceoverChanged: ((String, String?) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        sceneHeading: String,
        frames: [FrameSummary],
        storyboardTiming: StoryboardTiming? = nil,
        onVoiceoverChanged: ((String, String?) -> Void)? = nil
    ) {
        self.sceneHeading = sceneHeading
        self.frames = frames
        self.storyboardTiming = storyboardTiming
            ?? frames.first?.storyboardTiming
            ?? .legacyDefault
        self.onVoiceoverChanged = onVoiceoverChanged
    }

    @State private var index = 0
    @State private var playing = true
    @State private var playheadSampleIndex = 0
    @State private var exporting = false
    @State private var exportURL: URL?
    @State private var audioRecorder: AVAudioRecorder?
    @State private var recordingFrameId: String?
    @State private var voiceoverPlayer: AVAudioPlayer?
    @State private var voiceoverRevision = 0

    @State private var exportFailed = false
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 16) {
                HStack {
                    Text(sceneHeading.uppercased())
                        .font(.system(size: 12, weight: .bold)).kerning(1.2)
                        .foregroundStyle(.white.opacity(0.6))
                    Spacer()
                    Button {
                        exporting = true
                        Task {
                            let result = await AnimaticVideoExporter.export(
                                sceneHeading: sceneHeading,
                                frames: frames,
                                storyboardTiming: storyboardTiming)
                            if let result {
                                exportURL = result
                            } else {
                                exportFailed = true
                            }
                            exporting = false
                        }
                    } label: {
                        if exporting {
                            ProgressView().tint(.white)
                        } else {
                            Label("Eksporter video", systemImage: "film")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.8))
                        }
                    }
                    .disabled(exporting || frames.isEmpty)
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").foregroundStyle(.white.opacity(0.7))
                    }
                }
                .padding(.horizontal, 24)
                ZStack {
                    if let frame = frames.indices.contains(index) ? frames[index] : nil {
                        // Preview, frame stepping and MP4 export all consume
                        // the exact same evaluated storyboard compositor.
                        // Generated videos remain available in their own
                        // review surface and never replace this timebase.
                        if let image = FrameRenderCoordinator.image(
                            for: frame,
                            maxWidth: 1600,
                            at: previewTime(for: frame)) {
                            Image(uiImage: image).resizable().scaledToFit()
                                .id(frame.id)
                                .transition(.opacity)
                        } else {
                            RoundedRectangle(cornerRadius: 8).fill(Color(white: 0.94))
                                .aspectRatio(2.39, contentMode: .fit)
                                .overlay(Text("SHOT \(frame.shotNumber)")
                                    .font(.system(size: 22, weight: .bold))
                                    .foregroundStyle(Color(white: 0.55)))
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, 24)
                HStack(spacing: 14) {
                    Button { playing.toggle() } label: {
                        Image(systemName: playing ? "pause.fill" : "play.fill")
                            .font(.system(size: 17)).foregroundStyle(.white)
                    }
                    // Fremdrift: én segmentert stripe per shot, aktiv i fiolett.
                    HStack(spacing: 4) {
                        ForEach(Array(frames.enumerated()), id: \.element.id) { i, _ in
                            Capsule()
                                .fill(i == index ? BoardBrand.accent : Color.white.opacity(0.18))
                                .frame(height: 4)
                        }
                    }
                    if let frame = frames.indices.contains(index) ? frames[index] : nil {
                        Text("\(frame.shotNumber) · \(Int(frame.effectiveShotDuration.seconds))s")
                            .font(.system(size: 12).monospacedDigit())
                            .foregroundStyle(.white.opacity(0.6))
                        // Voiceover: opptak per shot (lokalt, mikses i MP4)
                        Button {
                            toggleRecording(frameId: frame.id)
                        } label: {
                            Image(systemName: recordingFrameId == frame.id
                                  ? "stop.circle.fill" : "mic.circle")
                                .font(.system(size: 18))
                                .foregroundStyle(recordingFrameId == frame.id ? .red
                                                 : VoiceoverStore.exists(frameId: frame.id)
                                                 ? BoardBrand.accent : .white.opacity(0.6))
                        }
                        .accessibilityLabel("Voiceover")
                        .id(voiceoverRevision)
                        if VoiceoverStore.exists(frameId: frame.id), recordingFrameId == nil {
                            Button {
                                VoiceoverStore.delete(frameId: frame.id)
                                voiceoverRevision += 1
                                onVoiceoverChanged?(frame.id, nil)
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                            }
                            .accessibilityLabel("Slett voiceover")
                        }
                    }
                }
                .padding(.horizontal, 24)
                if let frame = frames.indices.contains(index)
                    ? frames[index] : nil,
                   let framePlan = try? StoryboardFrameSamplePlan.make(
                    shotDuration: frame.effectiveShotDuration,
                    timing: storyboardTiming) {
                    HStack(spacing: 10) {
                        Button {
                            playing = false
                            playheadSampleIndex = max(0, playheadSampleIndex - 1)
                        } label: {
                            Image(systemName: "backward.frame.fill")
                                .frame(width: 44, height: 44)
                        }
                        .accessibilityLabel("Forrige bilde")
                        Slider(
                            value: Binding(
                                get: { Double(min(
                                    playheadSampleIndex,
                                    max(0, framePlan.samples.count - 1))) },
                                set: { value in
                                    playing = false
                                    playheadSampleIndex = min(
                                        max(0, Int(value.rounded())),
                                        max(0, framePlan.samples.count - 1))
                                }),
                            in: 0...Double(max(1, framePlan.samples.count - 1)),
                            step: 1)
                            .tint(BoardBrand.accent)
                            .accessibilityLabel("Animatic-tidslinje")
                            .accessibilityValue(timecode(for: frame))
                        Button {
                            playing = false
                            playheadSampleIndex = min(
                                max(0, framePlan.samples.count - 1),
                                playheadSampleIndex + 1)
                        } label: {
                            Image(systemName: "forward.frame.fill")
                                .frame(width: 44, height: 44)
                        }
                        .accessibilityLabel("Neste bilde")
                        Text(timecode(for: frame))
                            .font(.system(size: 11).monospacedDigit())
                            .foregroundStyle(.white.opacity(0.65))
                    }
                    .padding(.horizontal, 24)
                }
                Spacer().frame(height: 4)
                    .padding(.bottom, 12)
            }
        }
        .sheet(item: $exportURL) { url in
            ShareSheet(items: [url])
        }
        .alert("Animatic-eksport stoppet", isPresented: $exportFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(
                "Kontroller at prosjektets tidsbase representerer alle "
                + "shot-varigheter eksakt, og at shots med deklarert "
                + "bildeinnhold fortsatt kan rendres.")
        }
        .onAppear {
            // Server-voiceover → lokale filer (andre enheters opptak).
            try? VoiceoverStore.materializePersistedAudio(for: frames)
            voiceoverRevision += 1
            if reduceMotion { playing = false }
        }
        .onChange(of: playing) {
            if playing { voiceoverPlayer?.play() }
            else { voiceoverPlayer?.pause() }
        }
        .task(id: "\(index)-\(playing)") {
            guard playing, frames.indices.contains(index) else { return }
            let frame = frames[index]
            guard FrameRenderCoordinator.canPlayCameraMotion(frame: frame),
                  let framePlan = try? StoryboardFrameSamplePlan.make(
                    shotDuration: frame.effectiveShotDuration,
                    timing: storyboardTiming),
                  !framePlan.samples.isEmpty else {
                playing = false
                exportFailed = true
                return
            }
            let startIndex = min(
                max(0, playheadSampleIndex),
                framePlan.samples.count - 1)
            let startTime = framePlan.samples[startIndex].localTime
            let frameId = frame.id
            if VoiceoverStore.exists(frameId: frameId), recordingFrameId == nil {
                voiceoverPlayer = try? AVAudioPlayer(
                    contentsOf: VoiceoverStore.url(frameId: frameId))
                voiceoverPlayer?.currentTime = startTime.seconds
                voiceoverPlayer?.play()
            }

            let clock = ContinuousClock()
            let origin = clock.now
            for sampleIndex in startIndex..<framePlan.samples.count {
                let sample = framePlan.samples[sampleIndex]
                let offset = sample.localTime.seconds - startTime.seconds
                guard offset.isFinite, offset >= 0 else {
                    playing = false
                    exportFailed = true
                    return
                }
                do {
                    try await clock.sleep(
                        until: origin.advanced(
                            by: .nanoseconds(Int64(
                                (offset * 1_000_000_000).rounded()))),
                        tolerance: .milliseconds(2))
                } catch { return }
                guard playing, frames.indices.contains(index),
                      frames[index].id == frameId else { return }
                playheadSampleIndex = sampleIndex
            }
            let remaining = frame.effectiveShotDuration.seconds
                - startTime.seconds
            do {
                try await clock.sleep(
                    until: origin.advanced(by: .nanoseconds(Int64(
                        (remaining * 1_000_000_000).rounded()))),
                    tolerance: .milliseconds(2))
            } catch { return }
            if playing {
                let transition = (frame.transition ?? "").lowercased()
                let next = (index + 1) % max(1, frames.count)
                playheadSampleIndex = 0
                if !reduceMotion
                    && (transition.contains("dissolve")
                        || transition.contains("fade")) {
                    withAnimation(.easeInOut(duration: 0.45)) { index = next }
                } else {
                    index = next
                }
                if next == index && frames.count == 1 {
                    playing = false
                }
            }
        }
    }

    private func previewTime(for frame: FrameSummary) -> MediaTime {
        guard let plan = try? StoryboardFrameSamplePlan.make(
            shotDuration: frame.effectiveShotDuration,
            timing: storyboardTiming),
              !plan.samples.isEmpty else { return .zero }
        let safeIndex = min(
            max(0, playheadSampleIndex),
            plan.samples.count - 1)
        return plan.samples[safeIndex].localTime
    }

    private func timecode(for frame: FrameSummary) -> String {
        let current = previewTime(for: frame)
        let fps = storyboardTiming.projectFrameRate.seconds
        let totalFrames = fps > 0
            ? Int((current.seconds * fps).rounded(.towardZero)) : 0
        let nominalFPS = max(1, Int(fps.rounded()))
        let framesPart = totalFrames % nominalFPS
        let totalSeconds = totalFrames / nominalFPS
        let seconds = totalSeconds % 60
        let minutes = (totalSeconds / 60) % 60
        let hours = totalSeconds / 3_600
        return String(
            format: "%02d:%02d:%02d:%02d",
            hours, minutes, seconds, framesPart)
    }

}
private struct StoryboardVideoPanel: View {
    let url: URL
    let playing: Bool
    @State private var player: AVPlayer

    init(url: URL, playing: Bool) {
        self.url = url
        self.playing = playing
        _player = State(initialValue: AVPlayer(url: url))
    }

    var body: some View {
        VideoPlayer(player: player)
            .aspectRatio(16 / 9, contentMode: .fit)
            .onAppear { if playing { player.play() } }
            .onChange(of: playing) { playing ? player.play() : player.pause() }
            .onDisappear { player.pause() }
    }
}

// Mini-diagram i shot-radens venstrekolonne: strek-render av Notes-lag-strøk
// (mockupens NOTES/DIAGRAM-skisse). Skjules når laget er tomt.
// Decode-cache: JSON-parsing per rad per render er dyrt — nøkkel er selve
// json-strengen (endres kun når strøkene endres). Enkel cap i stedet for LRU.
@MainActor
private enum NoteStrokeCache {
    static var store: [String: [PencilStroke]] = [:]

    static func noteStrokes(for json: String) -> [PencilStroke] {
        if let hit = store[json] { return hit }
        let parsed = ((try? StrokeSerialization.decodeFromWebJSON(json)) ?? [])
            .filter { $0.boardLayer == "Notes" && $0.textAnnotation == nil }
        if store.count > 60 { store.removeAll(keepingCapacity: true) }
        store[json] = parsed
        return parsed
    }
}

private struct NotesDiagramMini: View {
    let strokesJSON: String?
    let contentWidth: Double

    private var noteStrokes: [PencilStroke] {
        strokesJSON.map { NoteStrokeCache.noteStrokes(for: $0) } ?? []
    }

    var body: some View {
        let strokes = noteStrokes
        if !strokes.isEmpty {
            Canvas { context, size in
                let scale = size.width / CGFloat(max(1, contentWidth))
                for stroke in strokes {
                    guard let first = stroke.points.first else { continue }
                    var path = Path()
                    path.move(to: CGPoint(x: first.x * scale, y: first.y * scale))
                    for point in stroke.points.dropFirst() {
                        path.addLine(to: CGPoint(x: point.x * scale, y: point.y * scale))
                    }
                    context.stroke(
                        path,
                        with: .color(Color(hex: stroke.color) ?? Color(white: 0.4)),
                        style: StrokeStyle(lineWidth: max(1, stroke.width * scale * 0.6),
                                           lineCap: .round, lineJoin: .round))
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .background(Color.white.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(white: 0.75), lineWidth: 1))
            .padding(.top, 4)
        }
    }
}

// Shot List-fanen (mockup): tabellvisning av scenens shots.
struct ShotListSheet: View {
    let sceneHeading: String
    let frames: [FrameSummary]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(frames) { frame in
                    HStack(spacing: 12) {
                        Text(frame.shotNumber)
                            .font(.system(.subheadline, design: .monospaced).bold())
                            .frame(width: 44, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(frame.description.isEmpty ? "—" : frame.description)
                                .font(.subheadline).lineLimit(1)
                            Text([frame.shotType, frame.lensMm.map { "\($0)mm" },
                                  frame.movement, frame.transition]
                                .compactMap(\.self).joined(separator: " · "))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let beat = frame.beatTag {
                            Text(beat).font(.caption2.bold())
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color.purple.opacity(0.18), in: Capsule())
                        }
                        Text(String(format: "%.1fs", frame.effectiveShotDuration.seconds))
                            .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Shot List — \(sceneHeading)")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
    }
}

// Pensel-tupp-glyf (mockup: form-bokser, ikke tekst). Tegner stav + tupp
// der tuppformen skiller penslene.
private struct BrushTipGlyph: View {
    let type: BrushType

    var body: some View {
        Canvas { context, size in
            let cx = size.width / 2
            let white = Color.white.opacity(0.85)
            var shaft = Path()
            var tip = Path()
            switch type {
            case .pencil:
                shaft.addRect(CGRect(x: cx - 2.5, y: 5, width: 5, height: 16))
                tip.move(to: CGPoint(x: cx - 2.5, y: 21))
                tip.addLine(to: CGPoint(x: cx + 2.5, y: 21))
                tip.addLine(to: CGPoint(x: cx, y: 32))
                tip.closeSubpath()
            case .graphite:
                shaft.addRect(CGRect(x: cx - 3, y: 5, width: 6, height: 15))
                tip.move(to: CGPoint(x: cx - 3, y: 20))
                tip.addLine(to: CGPoint(x: cx + 3, y: 20))
                tip.addLine(to: CGPoint(x: cx + 3, y: 31))
                tip.closeSubpath()
            case .charcoal:
                shaft.addRect(CGRect(x: cx - 4.5, y: 5, width: 9, height: 14))
                tip.move(to: CGPoint(x: cx - 4.5, y: 19))
                tip.addLine(to: CGPoint(x: cx + 4.5, y: 19))
                tip.addLine(to: CGPoint(x: cx + 2, y: 31))
                tip.addLine(to: CGPoint(x: cx - 2, y: 31))
                tip.closeSubpath()
            case .conte:
                shaft.addRect(CGRect(x: cx - 4, y: 6, width: 8, height: 15))
                tip.move(to: CGPoint(x: cx - 4, y: 21))
                tip.addLine(to: CGPoint(x: cx + 4, y: 21))
                tip.addLine(to: CGPoint(x: cx + 4, y: 29))
                tip.addLine(to: CGPoint(x: cx - 4, y: 25))
                tip.closeSubpath()
            case .pen, .ink:
                shaft.addRect(CGRect(x: cx - 1.5, y: 5, width: 3, height: 18))
                tip.move(to: CGPoint(x: cx - 1.5, y: 23))
                tip.addLine(to: CGPoint(x: cx + 1.5, y: 23))
                tip.addLine(to: CGPoint(x: cx, y: 32))
                tip.closeSubpath()
            case .marker:
                shaft.addRect(CGRect(x: cx - 4, y: 5, width: 8, height: 16))
                tip.addRoundedRect(in: CGRect(x: cx - 2.5, y: 21, width: 5, height: 10),
                                   cornerSize: CGSize(width: 2, height: 2))
            case .highlighter:
                shaft.addRect(CGRect(x: cx - 5, y: 5, width: 10, height: 16))
                tip.addRect(CGRect(x: cx - 4, y: 21, width: 8, height: 9))
            case .smudge:
                tip.addEllipse(in: CGRect(x: cx - 7, y: 10, width: 14, height: 18))
            case .eraser:
                tip.addRoundedRect(in: CGRect(x: cx - 7, y: 8, width: 14, height: 20),
                                   cornerSize: CGSize(width: 3, height: 3))
            case .layout:
                shaft.addRect(CGRect(x: cx - 1.5, y: 6, width: 3, height: 16))
                tip.move(to: CGPoint(x: cx - 1.5, y: 22))
                tip.addLine(to: CGPoint(x: cx + 1.5, y: 22))
                tip.addLine(to: CGPoint(x: cx, y: 30))
                tip.closeSubpath()
            case .heavy:
                shaft.addRect(CGRect(x: cx - 4, y: 5, width: 8, height: 15))
                tip.move(to: CGPoint(x: cx - 4, y: 20))
                tip.addLine(to: CGPoint(x: cx + 4, y: 20))
                tip.addLine(to: CGPoint(x: cx, y: 31))
                tip.closeSubpath()
            case .detail:
                shaft.addRect(CGRect(x: cx - 1, y: 5, width: 2, height: 19))
                tip.move(to: CGPoint(x: cx - 1, y: 24))
                tip.addLine(to: CGPoint(x: cx + 1, y: 24))
                tip.addLine(to: CGPoint(x: cx, y: 31))
                tip.closeSubpath()
            case .hatch:
                for i in 0..<4 {
                    let base = CGFloat(i) * 8
                    tip.move(to: CGPoint(x: cx - 12 + base, y: 26))
                    tip.addLine(to: CGPoint(x: cx - 6 + base, y: 10))
                }
            case .crosshatch:
                for i in 0..<3 {
                    let base = CGFloat(i) * 9
                    tip.move(to: CGPoint(x: cx - 11 + base, y: 26))
                    tip.addLine(to: CGPoint(x: cx - 4 + base, y: 10))
                    tip.move(to: CGPoint(x: cx - 4 + base, y: 26))
                    tip.addLine(to: CGPoint(x: cx - 11 + base, y: 10))
                }
            case .shade:
                tip.addEllipse(in: CGRect(x: cx - 12, y: 13, width: 24, height: 11))
            case .graintex:
                // Deterministisk spredning (Canvas redraw skal ikke flimre)
                for i in 0..<14 {
                    let px = cx - 12 + CGFloat((i * 37) % 24)
                    let py = 10 + CGFloat((i * 23 + 7) % 16)
                    tip.addEllipse(in: CGRect(x: px, y: py, width: 1.6, height: 1.6))
                }
            case .kneaded:
                tip.addRoundedRect(in: CGRect(x: cx - 8, y: 10, width: 16, height: 16),
                                   cornerSize: CGSize(width: 6, height: 6))
            case .lightlift:
                tip.addEllipse(in: CGRect(x: cx - 9, y: 9, width: 18, height: 18))
            case .forest:
                // Gran: stamme + skrå grener
                tip.move(to: CGPoint(x: cx, y: 28)); tip.addLine(to: CGPoint(x: cx, y: 8))
                tip.move(to: CGPoint(x: cx, y: 12)); tip.addLine(to: CGPoint(x: cx - 6, y: 18))
                tip.move(to: CGPoint(x: cx, y: 12)); tip.addLine(to: CGPoint(x: cx + 6, y: 18))
                tip.move(to: CGPoint(x: cx, y: 18)); tip.addLine(to: CGPoint(x: cx - 9, y: 26))
                tip.move(to: CGPoint(x: cx, y: 18)); tip.addLine(to: CGPoint(x: cx + 9, y: 26))
            case .debris:
                tip.move(to: CGPoint(x: cx - 10, y: 24)); tip.addLine(to: CGPoint(x: cx - 2, y: 20))
                tip.move(to: CGPoint(x: cx + 1, y: 25)); tip.addLine(to: CGPoint(x: cx + 9, y: 23))
                tip.move(to: CGPoint(x: cx - 5, y: 15)); tip.addLine(to: CGPoint(x: cx + 3, y: 12))
                tip.addEllipse(in: CGRect(x: cx + 5, y: 13, width: 4, height: 3))
            case .organictex:
                tip.move(to: CGPoint(x: cx - 9, y: 22)); tip.addLine(to: CGPoint(x: cx - 5, y: 14))
                tip.addLine(to: CGPoint(x: cx - 1, y: 22))
                tip.move(to: CGPoint(x: cx + 1, y: 20)); tip.addLine(to: CGPoint(x: cx + 5, y: 12))
                tip.addLine(to: CGPoint(x: cx + 9, y: 20))
            case .fur:
                for i in 0..<4 {
                    let base = CGFloat(i) * 6
                    tip.move(to: CGPoint(x: cx - 9 + base, y: 25))
                    tip.addLine(to: CGPoint(x: cx - 6 + base, y: 12))
                }
            case .toneblock:
                tip.addRect(CGRect(x: cx - 10, y: 10, width: 20, height: 16))
            case .speedlines:
                for i in 0..<3 {
                    let y = 13.0 + Double(i) * 5
                    tip.move(to: CGPoint(x: cx - 12, y: y))
                    tip.addLine(to: CGPoint(x: cx + 12, y: y - 2))
                }
            case .airbrush:
                tip.addEllipse(in: CGRect(x: cx - 9, y: 9, width: 18, height: 18))
                shaft.addEllipse(in: CGRect(x: cx - 5, y: 13, width: 10, height: 10))
            case .wethair:
                for i in 0..<3 {
                    let base = CGFloat(i) * 7
                    tip.move(to: CGPoint(x: cx - 8 + base, y: 10))
                    tip.addQuadCurve(to: CGPoint(x: cx - 3 + base, y: 26),
                                     control: CGPoint(x: cx - 11 + base, y: 20))
                }
            case .softfocus:
                tip.addEllipse(in: CGRect(x: cx - 10, y: 8, width: 20, height: 20))
                tip.addEllipse(in: CGRect(x: cx - 6, y: 12, width: 12, height: 12))
            case .skintex:
                for i in 0..<12 {
                    let px = cx - 10 + CGFloat((i * 31) % 20)
                    let py = 10 + CGFloat((i * 17 + 3) % 15)
                    tip.addEllipse(in: CGRect(x: px, y: py, width: 2.2, height: 2.2))
                }
            case .rocktex:
                tip.move(to: CGPoint(x: cx - 9, y: 24))
                tip.addLine(to: CGPoint(x: cx - 5, y: 12))
                tip.addLine(to: CGPoint(x: cx + 2, y: 17))
                tip.addLine(to: CGPoint(x: cx + 8, y: 10))
                tip.addLine(to: CGPoint(x: cx + 10, y: 24))
                tip.closeSubpath()
            case .wash:
                tip.addEllipse(in: CGRect(x: cx - 12, y: 12, width: 24, height: 11))
                shaft.addRect(CGRect(x: cx - 8, y: 25, width: 16, height: 2))
            case .spikes:
                for i in 0..<4 {
                    let base = CGFloat(i) * 7
                    tip.move(to: CGPoint(x: cx - 12 + base, y: 25))
                    tip.addLine(to: CGPoint(x: cx - 9 + base, y: 11))
                    tip.addLine(to: CGPoint(x: cx - 6 + base, y: 25))
                }
            case .gloss:
                // Dråpe
                tip.move(to: CGPoint(x: cx, y: 9))
                tip.addQuadCurve(to: CGPoint(x: cx + 6, y: 20),
                                 control: CGPoint(x: cx + 7, y: 13))
                tip.addArc(center: CGPoint(x: cx, y: 20), radius: 6,
                           startAngle: .zero, endAngle: .radians(.pi), clockwise: false)
                tip.addQuadCurve(to: CGPoint(x: cx, y: 9),
                                 control: CGPoint(x: cx - 7, y: 13))
            default:
                shaft.addRect(CGRect(x: cx - 3, y: 5, width: 6, height: 16))
                tip.addEllipse(in: CGRect(x: cx - 3, y: 21, width: 6, height: 10))
            }
            context.fill(shaft, with: .color(white.opacity(0.5)))
            switch type {
            case .smudge:
                context.fill(tip, with: .color(white.opacity(0.35)))
            case .hatch, .crosshatch, .forest, .debris, .organictex, .fur, .speedlines, .wethair, .spikes:
                context.stroke(tip, with: .color(white), lineWidth: 1.4)
            case .airbrush, .softfocus:
                context.fill(tip, with: .color(white.opacity(0.25)))
                context.fill(shaft, with: .color(white.opacity(0.45)))
            case .lightlift:
                context.stroke(tip, with: .color(white.opacity(0.6)), lineWidth: 2)
            case .shade, .graintex, .kneaded:
                context.fill(tip, with: .color(white.opacity(0.6)))
            default:
                context.fill(tip, with: .color(white))
            }
        }
    }
}

// Strøk-forhåndsvisning: hvit S-kurve på svart, bredde/dekning følger valget.
// Ekte forhåndsvisning: S-kurve med trykksvell rendret gjennom motoren
// (samme dab-pipeline som canvasen) — viser penselens faktiske karakter.
// Delt offscreen-renderer; siste render caches på pensel-spec.
private struct StrokePreview: View {
    let brush: BrushSpec

    var body: some View {
        Group {
            if let image = Self.render(brush: brush) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Color.white
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(BoardBrand.border, lineWidth: 1))
    }

    @MainActor private static var cache: (key: String, image: UIImage?)?

    @MainActor private static func render(brush: BrushSpec) -> UIImage? {
        let key = (try? JSONEncoder().encode(brush))
            .map { String(decoding: $0, as: UTF8.self) } ?? UUID().uuidString
        if let cached = cache, cached.key == key { return cached.image }
        guard let renderer = FrameRenderService.renderer else { return nil }
        let width = 236.0, height = 244.0
        var points: [StrokePoint] = []
        let sampleCount = 48
        for i in 0...sampleCount {
            let t = Double(i) / Double(sampleCount)
            points.append(StrokePoint(
                x: width * (0.1 + 0.8 * t),
                y: height * (0.5 + 0.2 * sin(t * .pi * 2)),
                pressure: 0.25 + 0.75 * sin(t * .pi),
                tiltX: 30, tiltY: 20,
                timestamp: t * 400))
        }
        let stroke = PencilStroke(
            id: "brush-preview", points: points, inputType: "pencil",
            color: brush.color, width: brush.size, opacity: brush.opacity,
            brush: brush, boardLayer: nil, textAnnotation: nil)
        renderer.resizeCanvas(width: Int(width), height: Int(height))
        renderer.rebuild(strokes: [stroke], scale: 1)
        let image = renderer.thumbnailDataURL(maxWidth: width).flatMap(decodeDataURL)
        cache = (key, image)
        return image
    }
}

// Fullskjerm tegnemodus: pinch/slider-zoom (bredde-reflow → skarp
// re-rendring), finger panorerer, Pencil tegner (palm rejection),
// «Finger tegner»-toggle for enheter uten Pencil. Deler CanvasState med
// boardet (strokes/autosynk følger med); egen renderer-instans så inline-
// canvasens akkumulator ikke thrashes av to layouts.
struct FullscreenDrawView: View {
    @ObservedObject var canvasState: CanvasState
    let frame: FrameSummary
    // Komponert av boardet — panelbildet er redigerbar base, mens et rent
    // referanseunderlag forblir skjerm-only.
    // Perspektiv-overlay følger bevisst IKKE med hit: fullskjerm zoomer i
    // UIScrollView-rommet der et SwiftUI-overlay ikke ville fulgt canvasen.
    let background: BoardCanvasBackground
    @State private var renderer = MetalStrokeRenderer()
    @State private var fingerDraws = false
    @Environment(\.dismiss) private var dismiss

    private var aspect: CGFloat {
        CGFloat(canvasState.shotFraming.aspectRatio)
    }

    private func applyUnderlay() {
        renderer?.setEditableBase(cgImage: background.editableBase)
        renderer?.setViewportPreview(cgImage: background.viewportPreview)
        renderer?.setUnderlay(cgImage: background.referenceUnderlay,
                              opacity: background.referenceOpacity)
        canvasState.backgroundRevision += 1
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text("SHOT \(frame.shotNumber)")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                Spacer()
                Toggle(isOn: $fingerDraws) {
                    Text("Finger tegner").font(.system(size: 12))
                }
                .toggleStyle(.switch)
                .frame(width: 150)
                Button { dismiss() } label: {
                    Text("Ferdig").font(.system(size: 13, weight: .semibold))
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
            .background(.bar)
            BrushToolbar(canvasState: canvasState, onExport: nil)
            // Ekte UIScrollView-zoom: pinch ankrer rundt fingrene,
            // skarp re-rendring ved zoom-slutt.
            ZoomablePencilCanvas(state: canvasState, renderer: renderer,
                                 baseSize: CGSize(width: 1100, height: 1100 / aspect),
                                 fingerDraws: fingerDraws)
        }
        .background(Color.black)
        .onAppear { applyUnderlay() }
    }
}

extension AnimaticView {
    /// Start/stopp opptak for et shot (AVAudioRecorder → m4a).
    fileprivate func toggleRecording(frameId: String) {
        if recordingFrameId == frameId {
            audioRecorder?.stop()
            audioRecorder = nil
            recordingFrameId = nil
            voiceoverRevision += 1
            if let data = try? Data(contentsOf: VoiceoverStore.url(frameId: frameId)) {
                onVoiceoverChanged?(frameId, "data:audio/m4a;base64," + data.base64EncodedString())
            }
            return
        }
        audioRecorder?.stop()
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, options: [.defaultToSpeaker])
        try? session.setActive(true)
        AVAudioApplication.requestRecordPermission { granted in
            guard granted else { return }
            Task { @MainActor in
                let settings: [String: Any] = [
                    AVFormatIDKey: kAudioFormatMPEG4AAC,
                    AVSampleRateKey: 44_100,
                    AVNumberOfChannelsKey: 1,
                    AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
                ]
                audioRecorder = try? AVAudioRecorder(
                    url: VoiceoverStore.url(frameId: frameId), settings: settings)
                audioRecorder?.record()
                recordingFrameId = frameId
                playing = false
            }
        }
    }
}

// Review-modus (web ReviewModeView): status + rollekommentarer per shot.
struct ReviewSheet: View {
    @ObservedObject var board: BoardState
    @State private var commentDrafts: [String: String] = [:]
    @State private var commentRole = "Director"
    @Environment(\.dismiss) private var dismiss

    private static let roles = ["Director", "DP", "Producer", "Editor", "Artist"]
    private static let statusLabels: [String: (String, Color)] = [
        "planned": ("PLANLAGT", .gray),
        "in_review": ("TIL REVIEW", .orange),
        "needs_work": ("TRENGER ARBEID", .red),
        "done": ("GODKJENT", .green),
    ]

    var body: some View {
        NavigationStack {
            List {
                ForEach(board.scene?.frames ?? []) { frame in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) {
                            Text(frame.shotNumber)
                                .font(.system(.subheadline, design: .monospaced).bold())
                            Text(frame.description.isEmpty ? "—" : frame.description)
                                .font(.subheadline).lineLimit(1)
                            Spacer()
                            if let (label, color) = Self.statusLabels[frame.frameStatus ?? "planned"] {
                                Text(label).font(.caption2.bold())
                                    .padding(.horizontal, 7).padding(.vertical, 3)
                                    .background(color.opacity(0.18), in: Capsule())
                                    .foregroundStyle(color)
                            }
                        }
                        HStack(spacing: 8) {
                            Button("Godkjenn") {
                                board.setFrameStatus(frameId: frame.id, status: "done")
                            }
                            .buttonStyle(.borderedProminent).tint(.green).controlSize(.small)
                            Button("Trenger arbeid") {
                                board.setFrameStatus(frameId: frame.id, status: "needs_work")
                            }
                            .buttonStyle(.bordered).tint(.red).controlSize(.small)
                        }
                        ForEach(frame.comments) { comment in
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(comment.role) · \(comment.author)")
                                    .font(.caption2.bold()).foregroundStyle(.secondary)
                                Text(comment.text).font(.caption)
                            }
                            .padding(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.purple.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
                        }
                        HStack(spacing: 6) {
                            Menu(commentRole) {
                                ForEach(Self.roles, id: \.self) { role in
                                    Button(role) { commentRole = role }
                                }
                            }
                            .font(.caption)
                            TextField("Kommentar…", text: Binding(
                                get: { commentDrafts[frame.id] ?? "" },
                                set: { commentDrafts[frame.id] = $0 }))
                                .textFieldStyle(.roundedBorder)
                                .font(.caption)
                            Button {
                                let text = (commentDrafts[frame.id] ?? "").trimmingCharacters(in: .whitespaces)
                                guard !text.isEmpty else { return }
                                board.addComment(frameId: frame.id, role: commentRole, text: text)
                                commentDrafts[frame.id] = ""
                            } label: {
                                Image(systemName: "paperplane.fill").font(.caption)
                            }
                            .disabled((commentDrafts[frame.id] ?? "").trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Review — \(board.scene?.heading ?? "")")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Lukk") { dismiss() } }
            }
        }
    }
}

// PDF-eksport: bransjeleveransen — A4 landskap, én scene per seksjon,
// 3 shot-rader per side (thumb + kode + handling + metadata).
// Perspektiv-hjelpelinjer: stråler fra flyttbare forsvinningspunkter +
// horisont. Ren visning (aldri i strokes/eksport); håndtak kun aktive i
// select-modus så tegning ikke forstyrres.
private struct PerspectiveOverlay: View {
    let mode: Int
    @Binding var points: [CGPoint]   // normalisert 0–1 (kan gå utenfor)
    let editable: Bool
    var onCommit: () -> Void = {}

    private static let defaults: [Int: [CGPoint]] = [
        1: [CGPoint(x: 0.5, y: 0.45)],
        2: [CGPoint(x: 0.06, y: 0.45), CGPoint(x: 0.94, y: 0.45)],
        3: [CGPoint(x: 0.06, y: 0.45), CGPoint(x: 0.94, y: 0.45), CGPoint(x: 0.5, y: 1.6)],
        5: [CGPoint(x: 0.5, y: 0.5)],   // fisheye-senter
    ]

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            let active = activePoints()
            ZStack {
                Canvas { context, _ in
                    let diagonal = hypot(size.width, size.height) * 2.2
                    if mode == 4 {
                        // Isometrisk: tre linjefamilier (30°/150°/vertikal).
                        for angle in [Double.pi / 6, .pi - .pi / 6, .pi / 2] {
                            let step = 46.0
                            let normal = CGVector(dx: -sin(angle), dy: cos(angle))
                            var offset = -diagonal
                            while offset < diagonal {
                                var path = Path()
                                let mid = CGPoint(x: size.width / 2 + normal.dx * offset,
                                                  y: size.height / 2 + normal.dy * offset)
                                path.move(to: CGPoint(x: mid.x - cos(angle) * diagonal,
                                                      y: mid.y - sin(angle) * diagonal))
                                path.addLine(to: CGPoint(x: mid.x + cos(angle) * diagonal,
                                                         y: mid.y + sin(angle) * diagonal))
                                context.stroke(path, with: .color(BoardBrand.accent.opacity(0.16)),
                                               lineWidth: 0.8)
                                offset += step
                            }
                        }
                        return
                    }
                    if mode == 5 {
                        // Fisheye: konsentriske sirkler + buede «vertikaler»
                        // gjennom senteret (flyttbart).
                        let center = active.first ?? CGPoint(x: 0.5, y: 0.5)
                        let origin = CGPoint(x: center.x * size.width, y: center.y * size.height)
                        let maxRadius = hypot(size.width, size.height) * 0.62
                        for step in 1...6 {
                            let radius = maxRadius * Double(step) / 6
                            context.stroke(
                                Path(ellipseIn: CGRect(x: origin.x - radius, y: origin.y - radius,
                                                       width: radius * 2, height: radius * 2)),
                                with: .color(BoardBrand.accent.opacity(0.18)), lineWidth: 0.8)
                        }
                        for step in stride(from: -3, through: 3, by: 1) where step != 0 {
                            let bend = CGFloat(step) * size.width * 0.16
                            var path = Path()
                            path.move(to: CGPoint(x: origin.x + bend, y: 0))
                            path.addQuadCurve(to: CGPoint(x: origin.x + bend, y: size.height),
                                              control: CGPoint(x: origin.x + bend * 1.9, y: origin.y))
                            context.stroke(path, with: .color(BoardBrand.accent.opacity(0.18)),
                                           lineWidth: 0.8)
                            var horizontal = Path()
                            horizontal.move(to: CGPoint(x: 0, y: origin.y + bend))
                            horizontal.addQuadCurve(to: CGPoint(x: size.width, y: origin.y + bend),
                                                    control: CGPoint(x: origin.x, y: origin.y + bend * 1.9))
                            context.stroke(horizontal, with: .color(BoardBrand.accent.opacity(0.18)),
                                           lineWidth: 0.8)
                        }
                        return
                    }
                    for vp in active {
                        let origin = CGPoint(x: vp.x * size.width, y: vp.y * size.height)
                        for step in 0..<36 {
                            let angle = Double(step) / 36 * .pi * 2
                            var path = Path()
                            path.move(to: origin)
                            path.addLine(to: CGPoint(x: origin.x + cos(angle) * diagonal,
                                                     y: origin.y + sin(angle) * diagonal))
                            context.stroke(path, with: .color(BoardBrand.accent.opacity(0.18)),
                                           lineWidth: 0.8)
                        }
                    }
                    // Horisont gjennom de to første VP-ene
                    if active.count >= 2 {
                        var horizon = Path()
                        let a = CGPoint(x: active[0].x * size.width, y: active[0].y * size.height)
                        let b = CGPoint(x: active[1].x * size.width, y: active[1].y * size.height)
                        let direction = CGVector(dx: b.x - a.x, dy: b.y - a.y)
                        let length = max(1, hypot(direction.dx, direction.dy))
                        let unit = CGVector(dx: direction.dx / length, dy: direction.dy / length)
                        horizon.move(to: CGPoint(x: a.x - unit.dx * 4000, y: a.y - unit.dy * 4000))
                        horizon.addLine(to: CGPoint(x: a.x + unit.dx * 4000, y: a.y + unit.dy * 4000))
                        context.stroke(horizon, with: .color(BoardBrand.accent.opacity(0.45)),
                                       style: StrokeStyle(lineWidth: 1.2, dash: [8, 5]))
                    }
                }
                .allowsHitTesting(false)
                if editable {
                    ForEach(active.indices, id: \.self) { index in
                        Circle()
                            .fill(BoardBrand.accent)
                            .frame(width: 14, height: 14)
                            .overlay(Circle().stroke(.white, lineWidth: 2))
                            .position(x: active[index].x * size.width,
                                      y: min(size.height - 8, max(8, active[index].y * size.height)))
                            .gesture(
                                DragGesture()
                                    .onChanged { value in
                                        ensureCount()
                                        points[index] = CGPoint(
                                            x: value.location.x / size.width,
                                            y: value.location.y / size.height)
                                    }
                                    .onEnded { _ in onCommit() }
                            )
                    }
                }
            }
        }
        .allowsHitTesting(editable)
    }

    private func activePoints() -> [CGPoint] {
        let wanted = Self.defaults[mode] ?? []
        if points.count != wanted.count { return wanted }
        return points
    }

    private func ensureCount() {
        let wanted = Self.defaults[mode] ?? []
        if points.count != wanted.count { points = wanted }
    }
}

// Drag-reorder av shots: droppes grip-håndtaket på en annen rad flyttes
// shotet dit (server-side moveFrame med offset).
private struct ShotDropDelegate: DropDelegate {
    let targetIndex: Int
    @Binding var draggedFrameId: String?
    let board: BoardState

    func performDrop(info: DropInfo) -> Bool {
        guard let frameId = draggedFrameId else { return false }
        draggedFrameId = nil
        board.moveShot(frameId: frameId, toIndex: targetIndex)
        return true
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }
}

// Presentasjons-footer: fire tema-spalter (TONE/BUDSKAP/MÅL/… i pitch-
// formatet). Lagres som JSON på første scene; web ignorerer feltet.
enum PresentationFooter {
    struct Section: Identifiable {
        var id = UUID()
        var title: String
        var itemsText: String   // ett punkt per linje
    }

    static let defaults: [Section] = [
        Section(title: "TONE", itemsText: ""),
        Section(title: "BUDSKAP", itemsText: ""),
        Section(title: "MÅL", itemsText: ""),
        Section(title: "VIDERE IDEER", itemsText: ""),
    ]

    static func encode(_ sections: [Section]) -> String {
        let payload = sections.map { ["title": $0.title, "items": $0.itemsText
            .split(separator: "\n").map(String.init)] }
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return "[]" }
        return String(data: data, encoding: .utf8) ?? "[]"
    }

    static func decode(_ json: String?) -> [Section] {
        guard let json, let data = json.data(using: .utf8),
              let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]],
              !list.isEmpty else { return defaults }
        return list.map { entry in
            Section(title: (entry["title"] as? String) ?? "",
                    itemsText: ((entry["items"] as? [String]) ?? []).joined(separator: "\n"))
        }
    }
}

/// Felles preview-policy for scene-listen. Bildekilden kommer før en lagret
/// thumbnail fordi eldre iPad-versjoner kunne lagre en hvit thumbnail før
/// det eksterne originalbildet var ferdig lastet.
enum StoryboardPreviewPolicy {
    static func sourceURLs(for frame: FrameSummary) -> [String] {
        var seen = Set<String>()
        return [frame.imageUrl, frame.thumbnailDataURL]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
    }

    /// Legacy projects sometimes retained only a scene-list poster after the
    /// authoritative drawing/raster was lost. It is safe to display that
    /// artifact solely at an identity camera. It remains declared content so
    /// production export fails and asks for migration/regeneration.
    static func legacyThumbnailOnlyPosterURL(
        for frame: FrameSummary
    ) -> String? {
        guard hasEmptyStrokeDocument(frame.strokesJSON),
              FrameDocumentProjection.normalizedRasterURL(frame.imageUrl) == nil,
              let thumbnail = frame.thumbnailDataURL?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !thumbnail.isEmpty,
              !frame.aiOutputStale,
              !StoryboardFrameImagePolicy.isApprovedAIOutput(frame),
              frame.drawingWidth.isFinite,
              frame.drawingHeight.isFinite,
              frame.drawingWidth > 0,
              frame.drawingHeight > 0 else { return nil }
        let sourceAspect = frame.drawingWidth / frame.drawingHeight
        let framing = (frame.shotFraming ?? ShotFramingState(
            shotSize: frame.shotType,
            angle: frame.angle,
            lensMm: frame.lensMm,
            aspectRatio: sourceAspect)).normalized()
        let epsilon = 0.000_001
        guard abs(framing.centerX - 0.5) <= epsilon,
              abs(framing.centerY - 0.5) <= epsilon,
              abs(framing.zoom - 1) <= epsilon,
              abs(framing.rollDegrees) <= epsilon,
              abs(framing.aspectRatio - sourceAspect) <= epsilon else {
            return nil
        }
        return thumbnail
    }

    private static func hasEmptyStrokeDocument(_ raw: String?) -> Bool {
        guard let raw else { return true }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return true }
        guard let data = trimmed.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(
                with: data),
              let strokes = object as? [Any]
        else { return false }
        return strokes.isEmpty
    }

    static func representativeFrame(in frames: [FrameSummary]) -> FrameSummary? {
        frames.first(where: hasVisualContent) ?? frames.first
    }

    private static func hasVisualContent(_ frame: FrameSummary) -> Bool {
        if !sourceURLs(for: frame).isEmpty { return true }
        guard let strokes = frame.strokesJSON?.trimmingCharacters(in: .whitespacesAndNewlines)
        else { return false }
        return !strokes.isEmpty && strokes != "[]"
    }
}

/// One provenance-aware resolver for every non-editing thumbnail surface.
/// It first asks the t=0 coordinator, then permits only an exact cached raster
/// under the direct-camera gate or an explicitly preview-only legacy poster.
@MainActor
enum StoryboardFramePreviewResolver {
    static func loadTaskKey(for frame: FrameSummary) -> String {
        let payload = [
            frame.id,
            frame.updatedAt ?? "",
            frame.imageUrl ?? "",
            frame.aiSourceRevision.map(String.init) ?? "legacy",
            frame.thumbnailDataURL ?? "",
        ].joined(separator: "\u{1F}")
        return SHA256.hash(data: Data(payload.utf8)).map {
            String(format: "%02x", $0)
        }.joined()
    }

    static func image(
        for frame: FrameSummary,
        maxWidth: CGFloat,
        includeReviewLayer: Bool = false
    ) -> UIImage? {
        if let rendered = FrameRenderCoordinator.image(
            for: frame,
            maxWidth: maxWidth,
            includeReviewLayer: includeReviewLayer) {
            return rendered
        }
        if frame.imageUrl != nil {
            guard FrameRenderCoordinator.allowsDirectRasterFallback(
                for: frame) else { return nil }
            return FrameImageCache.image(for: frame)
        }
        guard let posterURL = StoryboardPreviewPolicy
            .legacyThumbnailOnlyPosterURL(for: frame) else { return nil }
        return FrameImageCache.image(for: posterURL)
    }

    static func load(
        for frame: FrameSummary,
        maxWidth: CGFloat,
        includeReviewLayer: Bool = false
    ) async -> UIImage? {
        await FrameImageCache.prefetchPreviewSources(frames: [frame])
        guard !Task.isCancelled else { return nil }
        return image(
            for: frame,
            maxWidth: maxWidth,
            includeReviewLayer: includeReviewLayer)
    }
}

/// Declares which coordinate space a frame raster occupies. Imported images
/// are source-space artwork. Approved AI stages are already generated for the
/// canonical camera viewport and must be reconstructed through their archived
/// placement before applying a later presentation camera.
enum StoryboardFrameImagePolicy {
    static func isImportedPencilSource(_ frame: FrameSummary) -> Bool {
        guard frame.imageUrl != nil else { return false }
        let source = frame.imageSource?.lowercased()
        if let source,
           ["imported", "uploaded", "captured", "drawn", "placeholder"]
            .contains(source) { return true }
        // Legacy imports predate imageSource. AI viewport provenance has
        // explicit pipeline fingerprints, so an unlabelled raster without
        // those fields remains a source-space import.
        return source == nil
            && (frame.aiStoryboardId == nil
                || frame.aiSourceFramingFingerprint == nil)
    }

    static func isApprovedAIOutput(_ frame: FrameSummary) -> Bool {
        let source = frame.imageSource?.lowercased() ?? ""
        return source.hasPrefix("ai-")
            || source == "ai" || source == "generated"
            || source == "ai-generated"
            || (frame.aiStoryboardId != nil
                && frame.aiSourceFramingFingerprint != nil
                && !isImportedPencilSource(frame))
    }

    static func isAIViewportEncoded(_ frame: FrameSummary) -> Bool {
        frame.imageUrl != nil && isApprovedAIOutput(frame)
    }

    /// Camera transform that authored an approved viewport raster. New
    /// approvals persist the complete pose; legacy records may reconstruct it
    /// only while their fingerprint still equals the current t=0 camera.
    static func rasterPlacementFraming(
        for frame: FrameSummary
    ) -> ShotFramingState? {
        guard isAIViewportEncoded(frame),
              let sourceFingerprint = frame.aiSourceFramingFingerprint else {
            return nil
        }
        if let archived = frame.aiRasterPlacementFraming {
            return archived.normalized()
        }
        let framing = (frame.shotFraming ?? ShotFramingState(
            shotSize: frame.shotType, angle: frame.angle, lensMm: frame.lensMm,
            aspectRatio: frame.drawingWidth / max(1, frame.drawingHeight)
        )).normalized()
        return sourceFingerprint == framing.canonicalFingerprint
            ? framing : nil
    }

    static func usesViewportCoordinates(_ frame: FrameSummary) -> Bool {
        rasterPlacementFraming(for: frame) != nil
    }
}

enum StoryboardVideoPlaybackPolicy {
    static func sourceIdentityMatches(_ frame: FrameSummary) -> Bool {
        let framing = (frame.shotFraming ?? ShotFramingState(
            shotSize: frame.shotType, angle: frame.angle, lensMm: frame.lensMm,
            aspectRatio: frame.drawingWidth / max(1, frame.drawingHeight)
        )).normalized()
        return sourceIdentityMatches(
            videoStatus: frame.aiVideoStatus,
            isOutputStale: frame.aiOutputStale,
            videoFraming: frame.aiVideoSourceFramingFingerprint,
            currentFraming: framing.canonicalFingerprint,
            videoRevision: frame.aiVideoSourceRevision,
            sourceRevision: frame.aiSourceRevision,
            videoSourceUpdatedAt: frame.aiVideoSourceUpdatedAt,
            sourceUpdatedAt: frame.sourceUpdatedAt,
            paintoverState: frame.aiPaintoverState,
            videoBaseVersionId: frame.aiVideoSourceBaseVersionId,
            videoStage: frame.aiVideoSourceStage,
            videoFrameUpdatedAt: frame.aiVideoSourceFrameUpdatedAt,
            videoColorRevision: frame.aiVideoSourceColorRevision,
            videoAtmosphereRevision: frame.aiVideoSourceAtmosphereRevision,
            videoColorFingerprint: frame.aiVideoSourceColorFingerprint,
            videoAtmosphereFingerprint:
                frame.aiVideoSourceAtmosphereFingerprint,
            videoColorHasContent: frame.aiVideoSourceColorHasContent,
            videoAtmosphereHasContent:
                frame.aiVideoSourceAtmosphereHasContent,
            videoCompositeFingerprint:
                frame.aiVideoSourceCompositeFingerprint)
    }

    static func sourceIdentityMatches(
        videoStatus: String?,
        isOutputStale: Bool,
        videoFraming: String?,
        currentFraming: String,
        videoRevision: Int?,
        sourceRevision: Int?,
        videoSourceUpdatedAt: String?,
        sourceUpdatedAt: String?,
        paintoverState: StoryboardPaintoverState? = nil,
        videoBaseVersionId: String? = nil,
        videoStage: String? = nil,
        videoFrameUpdatedAt: String? = nil,
        videoColorRevision: Int? = nil,
        videoAtmosphereRevision: Int? = nil,
        videoColorFingerprint: String? = nil,
        videoAtmosphereFingerprint: String? = nil,
        videoColorHasContent: Bool? = nil,
        videoAtmosphereHasContent: Bool? = nil,
        videoCompositeFingerprint: String? = nil
    ) -> Bool {
        guard !isOutputStale,
              videoStatus?.lowercased() == "completed",
              let videoFraming,
              let videoRevision,
              let sourceRevision,
              let videoSourceUpdatedAt,
              let sourceUpdatedAt,
              let paintoverState,
              !paintoverState.videoStale,
              let videoBaseVersionId,
              UUID(uuidString: videoBaseVersionId) != nil,
              videoStage == "color" || videoStage == "atmosphere",
              videoStage != "atmosphere" || !paintoverState.atmosphereStale,
              let videoFrameUpdatedAt, !videoFrameUpdatedAt.isEmpty,
              let videoColorRevision,
              let videoAtmosphereRevision,
              let videoColorFingerprint,
              let videoAtmosphereFingerprint,
              let videoColorHasContent,
              let videoAtmosphereHasContent,
              let videoCompositeFingerprint,
              isSHA256(videoCompositeFingerprint) else { return false }
        return videoFraming == currentFraming
            && videoRevision == sourceRevision
            && videoSourceUpdatedAt == sourceUpdatedAt
            && videoColorRevision == paintoverState.colorRevision
            && videoAtmosphereRevision == paintoverState.atmosphereRevision
            && videoColorFingerprint.lowercased()
                == paintoverState.colorFingerprint.lowercased()
            && videoAtmosphereFingerprint.lowercased()
                == paintoverState.atmosphereFingerprint.lowercased()
            && videoColorHasContent == paintoverState.colorHasContent
            && videoAtmosphereHasContent == paintoverState.atmosphereHasContent
    }

    private static func isSHA256(_ value: String) -> Bool {
        value.count == 64 && value.unicodeScalars.allSatisfy {
            (48...57).contains($0.value)
                || (65...70).contains($0.value)
                || (97...102).contains($0.value)
        }
    }

    static func belongsToCurrentSource(_ frame: FrameSummary) -> Bool {
        frame.aiVideoURL != nil && sourceIdentityMatches(frame)
    }

    @MainActor
    static func currentURL(_ frame: FrameSummary) -> URL? {
        // A provider video may have valid provenance yet belong to a frame
        // whose current immutable document cannot render safely. Keep every
        // presentation surface on the same fail-closed t=0 contract.
        guard let snapshot = try? FrameRenderCoordinator.snapshot(
            for: frame, at: .zero),
              FrameRenderCoordinator.canRender(frame: frame, snapshot: snapshot),
              belongsToCurrentSource(frame), let value = frame.aiVideoURL else {
            return nil
        }
        return URL(string: value)
    }
}

/// Canonicalizes a final-viewport AI raster back into the immutable document
/// coordinate space. Applying the same camera once then reconstructs the
/// approved pixels exactly, while the resulting base remains erasable and can
/// receive Color/Atmosphere paintover strokes.
@MainActor
enum StoryboardViewportRasterMapper {
    private static let cache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 12
        cache.totalCostLimit = 220 * 1_024 * 1_024
        return cache
    }()

    static func sourceSpaceImage(
        viewportImage: UIImage,
        frame: FrameSummary,
        framing: ShotFramingState,
        rasterSourceIdentity: String,
        maximumDimension: CGFloat = 8_192
    ) -> UIImage? {
        guard viewportImage.size.width > 0, viewportImage.size.height > 0,
              frame.drawingWidth > 0, frame.drawingHeight > 0,
              !rasterSourceIdentity.isEmpty else { return nil }
        let normalizedFraming = framing.normalized()
        guard let geometry = ShotFramingGeometry(
                sourceSize: ShotFramingSize(
                    width: frame.drawingWidth, height: frame.drawingHeight),
                viewportSize: ShotFramingSize(
                    width: viewportImage.size.width,
                    height: viewportImage.size.height),
                state: normalizedFraming) else { return nil }
        let requestedScale = geometry.sourceScale
        let capScale = min(
            maximumDimension / frame.drawingWidth,
            maximumDimension / frame.drawingHeight)
        let renderScale = max(0.01, min(requestedScale, capScale))
        let outputSize = CGSize(
            width: frame.drawingWidth * renderScale,
            height: frame.drawingHeight * renderScale)
        func exact(_ value: Double) -> String {
            String(value.bitPattern, radix: 16)
        }
        let pixelWidth = viewportImage.cgImage?.width
            ?? Int((viewportImage.size.width * viewportImage.scale).rounded())
        let pixelHeight = viewportImage.cgImage?.height
            ?? Int((viewportImage.size.height * viewportImage.scale).rounded())
        let key = [
            "viewport-source-v2",
            rasterSourceIdentity,
            normalizedFraming.canonicalFingerprint,
            "source:\(exact(frame.drawingWidth))x\(exact(frame.drawingHeight))",
            "viewport:\(exact(Double(viewportImage.size.width)))"
                + "x\(exact(Double(viewportImage.size.height)))"
                + "@\(pixelWidth)x\(pixelHeight)",
            "output:\(exact(Double(outputSize.width)))"
                + "x\(exact(Double(outputSize.height)))",
            "cap:\(exact(Double(maximumDimension)))",
        ].joined(separator: "|") as NSString
        if let cached = cache.object(forKey: key) { return cached }

        func destination(_ viewport: ShotFramingPoint) -> CGPoint {
            let source = geometry.sourcePoint(fromViewportPoint: viewport)
            return CGPoint(x: source.x * renderScale, y: source.y * renderScale)
        }
        let origin = destination(ShotFramingPoint(x: 0, y: 0))
        let xAxis = destination(ShotFramingPoint(x: viewportImage.size.width, y: 0))
        let yAxis = destination(ShotFramingPoint(x: 0, y: viewportImage.size.height))
        let transform = CGAffineTransform(
            a: (xAxis.x - origin.x) / viewportImage.size.width,
            b: (xAxis.y - origin.y) / viewportImage.size.width,
            c: (yAxis.x - origin.x) / viewportImage.size.height,
            d: (yAxis.y - origin.y) / viewportImage.size.height,
            tx: origin.x,
            ty: origin.y)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let mapped = UIGraphicsImageRenderer(size: outputSize, format: format).image { context in
            context.cgContext.setBlendMode(.copy)
            context.cgContext.concatenate(transform)
            viewportImage.draw(in: CGRect(origin: .zero, size: viewportImage.size))
        }
        let cost = max(1, Int(outputSize.width * outputSize.height * 4))
        cache.setObject(mapped, forKey: key, cost: cost)
        return mapped
    }
}

// Minne-cache for remote panel-bilder (B2 download-stier) — de synkrone
// render-veiene (canvas, celler, eksport) leser herfra; async prefetch
// fyller den. dataURL-er dekodes direkte og trenger ikke cachen.
struct FrameRasterIdentity: Hashable, Sendable {
    let imageURL: String
    let sourceRevision: Int?

    init?(frame: FrameSummary) {
        guard let imageURL = frame.imageUrl?.trimmingCharacters(
            in: .whitespacesAndNewlines), !imageURL.isEmpty else { return nil }
        self.imageURL = imageURL
        sourceRevision = frame.aiSourceRevision
    }
}

@MainActor
enum FrameImageCache {
    private struct PrefetchRequest: Hashable, Sendable {
        let imageURL: String
        let cacheKey: String
    }

    private static let images: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 96
        cache.totalCostLimit = 180 * 1_024 * 1_024
        return cache
    }()

    private static func cost(_ image: UIImage) -> Int {
        let pixels = Int(image.size.width * image.scale * image.size.height * image.scale)
        return max(1, pixels * 4)
    }

    private static func cacheKey(for identity: FrameRasterIdentity) -> String {
        let source = "\(identity.sourceRevision.map(String.init) ?? "legacy")\u{1F}\(identity.imageURL)"
        let digest = SHA256.hash(data: Data(source.utf8))
            .map { String(format: "%02x", $0) }.joined()
        return "frame:\(digest)"
    }

    static func image(for imageUrl: String?) -> UIImage? {
        guard let imageUrl else { return nil }
        if imageUrl.hasPrefix("data:") {
            let digest = SHA256.hash(data: Data(imageUrl.utf8))
                .map { String(format: "%02x", $0) }.joined()
            let key = "inline:\(digest)" as NSString
            if let cached = images.object(forKey: key) { return cached }
            guard let decoded = decodeDataURL(imageUrl) else { return nil }
            images.setObject(decoded, forKey: key, cost: cost(decoded))
            return decoded
        }
        return images.object(forKey: imageUrl as NSString)
    }

    /// Exact frame raster. Remote bytes are keyed by URL + authoritative AI
    /// source revision so a reused storage path cannot bind old pixels to a
    /// newer approval identity.
    static func image(for frame: FrameSummary) -> UIImage? {
        guard let identity = FrameRasterIdentity(frame: frame) else { return nil }
        if identity.imageURL.hasPrefix("data:") { return image(for: identity.imageURL) }
        return images.object(forKey: cacheKey(for: identity) as NSString)
    }

    static func store(_ image: UIImage, for imageUrl: String) {
        images.setObject(image, forKey: imageUrl as NSString, cost: cost(image))
    }

    /// Hent remote-bilder som mangler i cachen (før render/eksport).
    static func prefetch(frames: [FrameSummary]) async {
        let requests = frames.compactMap { frame -> PrefetchRequest? in
            guard let identity = FrameRasterIdentity(frame: frame) else { return nil }
            return PrefetchRequest(
                imageURL: identity.imageURL,
                cacheKey: cacheKey(for: identity))
        }
        await prefetch(requests: requests)
    }

    static func prefetch(imageURLs: [String]) async {
        await prefetch(requests: imageURLs.map {
            PrefetchRequest(imageURL: $0, cacheKey: $0)
        })
    }

    /// Scene-preview trenger også remote thumbnailUrl for eldre/drawn-only
    /// frames. Kildene dedupliseres før sekvensiell nedlasting.
    static func prefetchPreviewSources(frames: [FrameSummary]) async {
        await prefetch(frames: frames)
        await prefetch(imageURLs: frames.compactMap { frame in
            frame.thumbnailDataURL
        })
    }

    private static func prefetch(requests: [PrefetchRequest]) async {
        var seen = Set<String>()
        let missing = requests.filter { request in
            !request.imageURL.hasPrefix("data:")
                && seen.insert(request.cacheKey).inserted
                && images.object(forKey: request.cacheKey as NSString) == nil
        }
        // Fire samtidige requests holder scenelisten rask uten å oversvømme
        // radiosamband eller dekodingsminne på eldre iPad-er.
        for start in stride(from: 0, to: missing.count, by: 4) {
            guard !Task.isCancelled else { return }
            let chunk = Array(missing[start..<min(start + 4, missing.count)])
            let payloads: [(PrefetchRequest, Data)] = await withTaskGroup(
                of: (PrefetchRequest, Data?).self,
                returning: [(PrefetchRequest, Data)].self
            ) { group in
                for request in chunk {
                    group.addTask {
                        let data = await RoleRoomAPIClient.shared.fetchRemoteImageData(
                            path: request.imageURL)
                        return (request, data)
                    }
                }
                var result: [(PrefetchRequest, Data)] = []
                for await (request, data) in group {
                    if let data { result.append((request, data)) }
                }
                return result
            }
            for (request, data) in payloads {
                guard let image = UIImage(data: data) else { continue }
                images.setObject(
                    image, forKey: request.cacheKey as NSString, cost: cost(image))
                // Generic consumers (asset browser/legacy thumbnail paths)
                // may reuse the latest bytes, but render/export use exact key.
                images.setObject(
                    image, forKey: request.imageURL as NSString, cost: cost(image))
            }
        }
    }
}


@MainActor
enum BoardPDFExporter {
    /// Async: frames pre-rendres med Task.yield mellom hver (UI forblir
    /// responsiv på store prosjekter) og progress rapporteres «N/M».
    static func export(projectTitle: String, scenes: [SceneSummary],
                       includeUnderlay: Bool = false,
                       progress: ((Int, Int) -> Void)? = nil) async -> URL? {
        // Pre-render all authoritative frame composites. Stored thumbnails
        // are preview artifacts and must never silently enter a deliverable.
        let allFrames = scenes.flatMap(\.frames)
        await FrameImageCache.prefetch(frames: allFrames)
        guard !Task.isCancelled else { return nil }
        let declaresContent = allFrames.map(
            AnimaticFrameContentPolicy.declaresVisualContent)
        for (frame, hasContent) in zip(allFrames, declaresContent)
        where hasContent {
            guard let snapshot = try? FrameRenderCoordinator.snapshot(
                for: frame,
                at: .zero),
                  FrameRenderCoordinator.canRender(
                    frame: frame, snapshot: snapshot) else { return nil }
        }
        var images: [String: UIImage] = [:]
        for (index, pair) in zip(allFrames, declaresContent).enumerated() {
            let (frame, hasContent) = pair
            guard !Task.isCancelled else { return nil }
            progress?(index + 1, allFrames.count)
            if let image = FrameRenderCoordinator.image(
                for: frame,
                maxWidth: 1120,
                includeUnderlay: includeUnderlay) {
                images[frame.id] = image
            } else if hasContent {
                return nil
            }
            await Task.yield()
        }

        let pageRect = CGRect(x: 0, y: 0, width: 842, height: 595) // A4 landskap pt
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(projectTitle.replacingOccurrences(of: "/", with: "-")) storyboard.pdf")
        do {
            try renderer.writePDF(to: url) { context in
                drawTitlePage(context: context, projectTitle: projectTitle,
                              scenes: scenes, in: pageRect)
                for scene in scenes where !scene.frames.isEmpty {
                    let shotsPerPage = 3
                    let pages = stride(from: 0, to: scene.frames.count, by: shotsPerPage).map {
                        Array(scene.frames[$0..<min($0 + shotsPerPage, scene.frames.count)])
                    }
                    for (pageIndex, pageFrames) in pages.enumerated() {
                        context.beginPage()
                        drawHeader(scene: scene, projectTitle: projectTitle,
                                   pageIndex: pageIndex, pageCount: pages.count, in: pageRect)
                        for (rowIndex, frame) in pageFrames.enumerated() {
                            drawShotRow(frame, rowIndex: rowIndex, in: pageRect,
                                        image: images[frame.id])
                        }
                    }
                }
            }
            return url
        } catch {
            return nil
        }
    }

    /// Forside: prosjekt, dato, omfang — produksjonskontorets førsteside.
    private static func drawTitlePage(context: UIGraphicsPDFRendererContext,
                                      projectTitle: String, scenes: [SceneSummary],
                                      in page: CGRect) {
        context.beginPage()
        let shotCount = scenes.reduce(0) { $0 + $1.frames.count }
        let totalSeconds = scenes.flatMap(\.frames).reduce(0.0) { $0 + $1.effectiveShotDuration.seconds }
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.locale = Locale(identifier: "nb_NO")
        (projectTitle.uppercased() as NSString).draw(
            at: CGPoint(x: 72, y: 200),
            withAttributes: [.font: UIFont.boldSystemFont(ofSize: 34),
                             .foregroundColor: UIColor.black])
        ("STORYBOARD" as NSString).draw(
            at: CGPoint(x: 72, y: 244),
            withAttributes: [.font: UIFont.systemFont(ofSize: 16, weight: .medium),
                             .foregroundColor: UIColor.darkGray])
        let meta = [
            formatter.string(from: Date()),
            "\(scenes.count) scener · \(shotCount) shots",
            String(format: "Estimert lengde %.0f sek", totalSeconds),
        ].joined(separator: "\n")
        (meta as NSString).draw(
            in: CGRect(x: 72, y: 300, width: 500, height: 120),
            withAttributes: [.font: UIFont.systemFont(ofSize: 13),
                             .foregroundColor: UIColor.black])
    }

    /// Presentasjons-mal (pitch-dokument): 4×3-grid per side, nummer-
    /// badge, caption (description) under hvert panel, tittel-header og
    /// enkel footer — i motsetning til produksjons-PDF-en (metadata-rader).
    static func exportPresentation(projectTitle: String, scenes: [SceneSummary],
                                   progress: ((Int, Int) -> Void)? = nil) async -> URL? {
        let allFrames = scenes.flatMap(\.frames)
        guard !allFrames.isEmpty else { return nil }
        await FrameImageCache.prefetch(frames: allFrames)
        guard !Task.isCancelled else { return nil }
        let declaresContent = allFrames.map(
            AnimaticFrameContentPolicy.declaresVisualContent)
        for (frame, hasContent) in zip(allFrames, declaresContent)
        where hasContent {
            guard let snapshot = try? FrameRenderCoordinator.snapshot(
                for: frame,
                at: .zero),
                  FrameRenderCoordinator.canRender(
                    frame: frame, snapshot: snapshot) else { return nil }
        }
        var images: [String: UIImage] = [:]
        for (index, pair) in zip(allFrames, declaresContent).enumerated() {
            let (frame, hasContent) = pair
            guard !Task.isCancelled else { return nil }
            progress?(index + 1, allFrames.count)
            if let image = FrameRenderCoordinator.image(
                for: frame,
                maxWidth: 640) {
                images[frame.id] = image
            } else if hasContent {
                return nil
            }
            await Task.yield()
        }
        let pageRect = CGRect(x: 0, y: 0, width: 842, height: 595)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(projectTitle.replacingOccurrences(of: "/", with: "-")) presentasjon.pdf")
        let columns = 4, rows = 3
        let perPage = columns * rows
        let margin = 36.0
        let cellWidth = (pageRect.width - margin * 2 - Double(columns - 1) * 14) / Double(columns)
        let panelHeight = cellWidth * 9 / 16
        let cellHeight = panelHeight + 34
        do {
            try renderer.writePDF(to: url) { context in
                let pages = stride(from: 0, to: allFrames.count, by: perPage).map {
                    Array(allFrames[$0..<min($0 + perPage, allFrames.count)])
                }
                for (pageIndex, pageFrames) in pages.enumerated() {
                    context.beginPage()
                    // Header + konsept-linje
                    (projectTitle.uppercased() as NSString).draw(
                        at: CGPoint(x: margin, y: 16),
                        withAttributes: [.font: UIFont.boldSystemFont(ofSize: 20),
                                         .foregroundColor: UIColor(red: 0.1, green: 0.3, blue: 0.75, alpha: 1)])
                    if let concept = scenes.first?.presentationConcept, !concept.isEmpty {
                        ("KONSEPT: \(concept)" as NSString).draw(
                            in: CGRect(x: margin, y: 40, width: pageRect.width - margin * 2, height: 14),
                            withAttributes: [.font: UIFont.systemFont(ofSize: 8.5),
                                             .foregroundColor: UIColor.darkGray])
                    }
                    let formatter = DateFormatter()
                    formatter.dateStyle = .medium
                    formatter.locale = Locale(identifier: "nb_NO")
                    let headerRight = "\(formatter.string(from: Date()))  ·  side \(pageIndex + 1)/\(pages.count)"
                    let rightAttributes: [NSAttributedString.Key: Any] = [
                        .font: UIFont.systemFont(ofSize: 9), .foregroundColor: UIColor.darkGray]
                    let rightSize = (headerRight as NSString).size(withAttributes: rightAttributes)
                    (headerRight as NSString).draw(
                        at: CGPoint(x: pageRect.width - margin - rightSize.width, y: 28),
                        withAttributes: rightAttributes)
                    // Grid
                    for (slot, frame) in pageFrames.enumerated() {
                        let column = slot % columns, row = slot / columns
                        let x = margin + Double(column) * (cellWidth + 14)
                        let y = 58.0 + Double(row) * (cellHeight + 16)
                        let panelRect = CGRect(x: x, y: y, width: cellWidth, height: panelHeight)
                        UIColor.white.setFill()
                        UIBezierPath(rect: panelRect).fill()
                        if let image = images[frame.id] {
                            image.draw(in: StoryboardAspectLayout.aspectFitRect(
                                sourceSize: image.size,
                                in: panelRect))
                        }
                        UIColor.black.setStroke()
                        let border = UIBezierPath(rect: panelRect)
                        border.lineWidth = 1
                        border.stroke()
                        // Nummer-badge
                        let badge = CGRect(x: x + 4, y: y + 4, width: 22, height: 16)
                        UIColor.white.setFill()
                        UIBezierPath(rect: badge).fill()
                        UIColor.black.setStroke()
                        UIBezierPath(rect: badge).stroke()
                        let number = "\(pageIndex * perPage + slot + 1)" as NSString
                        number.draw(in: badge.insetBy(dx: 5, dy: 2),
                                    withAttributes: [.font: UIFont.boldSystemFont(ofSize: 10),
                                                     .foregroundColor: UIColor.black])
                        // Caption: description, to linjer
                        (frame.description as NSString).draw(
                            in: CGRect(x: x, y: y + panelHeight + 4, width: cellWidth, height: 28),
                            withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                                             .foregroundColor: UIColor.black])
                    }
                    // Footer: fire tema-spalter når satt, ellers enkel linje
                    let sections = PresentationFooter.decode(scenes.first?.presentationFooter)
                        .filter { !$0.itemsText.isEmpty }
                    if sections.isEmpty {
                        let footer = "\(projectTitle)  ·  \(scenes.count) scener  ·  \(allFrames.count) paneler"
                        (footer as NSString).draw(
                            at: CGPoint(x: margin, y: pageRect.height - 22),
                            withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                                             .foregroundColor: UIColor.gray])
                    } else {
                        let footerTop = pageRect.height - 64
                        UIColor.lightGray.setStroke()
                        let divider = UIBezierPath()
                        divider.move(to: CGPoint(x: margin, y: footerTop - 6))
                        divider.addLine(to: CGPoint(x: pageRect.width - margin, y: footerTop - 6))
                        divider.lineWidth = 0.5
                        divider.stroke()
                        let columnWidth = (pageRect.width - margin * 2) / CGFloat(sections.count)
                        for (index, section) in sections.enumerated() {
                            let x = margin + CGFloat(index) * columnWidth
                            (section.title.uppercased() as NSString).draw(
                                at: CGPoint(x: x, y: footerTop),
                                withAttributes: [.font: UIFont.boldSystemFont(ofSize: 8),
                                                 .foregroundColor: UIColor(red: 0.1, green: 0.3, blue: 0.75, alpha: 1)])
                            let items = section.itemsText.split(separator: "\n")
                                .map { "•  \($0)" }.joined(separator: "\n")
                            (items as NSString).draw(
                                in: CGRect(x: x, y: footerTop + 11,
                                           width: columnWidth - 10, height: 50),
                                withAttributes: [.font: UIFont.systemFont(ofSize: 6.5),
                                                 .foregroundColor: UIColor.black])
                        }
                    }
                }
            }
            return url
        } catch {
            return nil
        }
    }

    /// Shot-liste som CSV (semikolon — Excel-NO) for produksjonsplanlegging.
    static func exportCSV(projectTitle: String, scenes: [SceneSummary]) -> URL? {
        var rows = ["Scene;Shot;Beskrivelse;Type;Lens;Bevegelse;Varighet (s);Beat;Status;Tags"]
        for scene in scenes {
            for frame in scene.frames {
                let cells = [
                    scene.heading, frame.shotNumber, frame.description,
                    frame.shotType ?? "", frame.lensMm.map { "\($0)mm" } ?? "",
                    frame.movement ?? "", String(format: "%.1f", frame.effectiveShotDuration.seconds),
                    frame.beatTag ?? "", frame.frameStatus ?? "",
                    frame.tags.joined(separator: ", "),
                ].map { $0.replacingOccurrences(of: ";", with: ",") }
                rows.append(cells.joined(separator: ";"))
            }
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(projectTitle.replacingOccurrences(of: "/", with: "-")) shotliste.csv")
        guard let data = ("\u{FEFF}" + rows.joined(separator: "\n")).data(using: .utf8) else { return nil }
        try? data.write(to: url)
        return url
    }

    private static func drawHeader(scene: SceneSummary, projectTitle: String,
                                   pageIndex: Int, pageCount: Int, in page: CGRect) {
        let title = "\(projectTitle)  ·  \(String(format: "%02d", scene.sceneNumber ?? 0)) \(scene.heading)"
            + (pageCount > 1 ? "  (\(pageIndex + 1)/\(pageCount))" : "")
        (title as NSString).draw(
            at: CGPoint(x: 36, y: 24),
            withAttributes: [.font: UIFont.boldSystemFont(ofSize: 13),
                             .foregroundColor: UIColor.black])
    }

    private static func drawShotRow(_ frame: FrameSummary, rowIndex: Int, in page: CGRect,
                                    image: UIImage?) {
        let top = 56.0 + Double(rowIndex) * 172
        let thumbRect = CGRect(x: 156, y: top, width: 280, height: 157.5)
        // Kodeboks
        (frame.shotNumber as NSString).draw(
            at: CGPoint(x: 36, y: top + 4),
            withAttributes: [.font: UIFont.monospacedSystemFont(ofSize: 14, weight: .bold),
                             .foregroundColor: UIColor.black])
        // Handling
        (frame.description as NSString).draw(
            in: CGRect(x: 36, y: top + 28, width: 110, height: 130),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9),
                             .foregroundColor: UIColor.darkGray])
        // Frame
        UIColor.black.setStroke()
        UIColor.white.setFill()
        UIBezierPath(rect: thumbRect).fill()
        if let image {
            image.draw(in: StoryboardAspectLayout.aspectFitRect(
                sourceSize: image.size,
                in: thumbRect))
        }
        let border = UIBezierPath(rect: thumbRect)
        border.lineWidth = 1
        border.stroke()
        // Metadata-kolonne
        let meta = [
            "CAM/SHOT  \(frame.shotType ?? "—")",
            "LENS  \(frame.lensMm.map { "\($0)mm" } ?? "—")",
            "MOVE  \(frame.movement ?? "—")",
            "DUR  \(String(format: "%.1f", frame.effectiveShotDuration.seconds)) s",
            frame.beatTag.map { "BEAT  \($0)" } ?? "",
            frame.frameStatus.map { "STATUS  \($0)" } ?? "",
        ].filter { !$0.isEmpty }.joined(separator: "\n")
        (meta as NSString).draw(
            in: CGRect(x: 452, y: top + 4, width: 160, height: 150),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9),
                             .foregroundColor: UIColor.black])
        // Notater høyre
        if let notes = frame.notes, !notes.isEmpty {
            ("NOTES  " + notes as NSString).draw(
                in: CGRect(x: 620, y: top + 4, width: 186, height: 150),
                withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                                 .foregroundColor: UIColor.darkGray])
        }
    }
}

// URL Identifiable for .sheet(item:)
extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

// UIActivityViewController-bro for deling av PDF.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

// Mini pensel-editor (spec §25-ånden): overstyr tekstur-parametre for valgt
// pensel. Overrides gjelder nye strøk til penselen byttes.
private func productionStampVariantLabel(_ type: BrushType) -> String {
    switch type {
    case .crowdStamp: return "Blocking / positur"
    case .treeStamp: return "Tretype / tilstand"
    case .windowStamp: return "Vindu / tilstand"
    case .carStamp: return "Kjøretøy / kameravinkel"
    case .chairStamp: return "Stoltype / vinkel"
    case .faceExpressionStamp: return "Uttrykk"
    case .handPoseStamp: return "Håndpositur"
    case .cameraRigStamp: return "Rigg / bevegelse"
    case .characterPoseStamp: return "Karakterpositur"
    case .doorStamp: return "Dør / åpning"
    case .tableStamp: return "Bordtype"
    case .sofaStamp: return "Sofatype"
    case .buildingStamp: return "Bygningstype"
    case .streetLightStamp: return "Lysarmatur"
    case .boomMicStamp: return "Lydrigg"
    case .filmLightStamp: return "Filmlys / modifier"
    case .bedStamp: return "Sengetype"
    case .staircaseStamp: return "Trappetype"
    case .counterStamp: return "Disk / benk"
    case .workstationStamp: return "Arbeidsstasjon"
    case .communicationStamp: return "Kommunikasjonsenhet"
    case .luggageStamp: return "Bagasje / utstyr"
    case .publicTransportStamp: return "Transporttype"
    case .animalStamp: return "Dyretype / pose"
    case .rockTerrainStamp: return "Terrengform"
    case .waterStamp: return "Vannform"
    case .fireSmokeStamp: return "Brann / røykeffekt"
    case .weatherFXStamp: return "Væreffekt"
    default: return "Variant"
    }
}

private struct BoardAIButtonStyle: ButtonStyle {
    var accent = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Color.white)
            .padding(.horizontal, 8).padding(.vertical, 6)
            .background(
                accent ? BoardBrand.accent.opacity(configuration.isPressed ? 0.65 : 1)
                    : Color.white.opacity(configuration.isPressed ? 0.12 : 0.06),
                in: RoundedRectangle(cornerRadius: 7))
    }
}

private struct AIImageStagePreviewSheet: View {
    let version: StoryboardAIImageVersionSummary
    let sourceImage: UIImage?
    let resultImage: UIImage?
    let onCancel: () -> Void
    let onRegenerate: () -> Void
    let onApprove: () -> Void

    private var title: String {
        version.stage == "atmosphere" ? "AI Atmosphere" : "AI Color"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                HStack(spacing: 12) {
                    preview(sourceImage, label: version.stage == "color"
                            ? "Original Pencil" : "Approved Color")
                    Image(systemName: "arrow.right")
                        .font(.title2.weight(.semibold)).foregroundStyle(.secondary)
                    preview(resultImage, label: title + " · Candidate")
                }
                .padding(.horizontal)

                Label("Originalen er låst. Kandidaten påvirker ikke storyboardet før du godkjenner.",
                      systemImage: "lock.shield.fill")
                    .font(.callout).foregroundStyle(.secondary)

                HStack {
                    Button("Behold uten godkjenning", action: onCancel)
                    Spacer()
                    Button("Regenerer", action: onRegenerate)
                    Button("Godkjenn \(title)", action: onApprove)
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("approve-ai-image-stage")
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
            .navigationTitle("\(title) · før / etter")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    @ViewBuilder
    private func preview(_ image: UIImage?, label: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold)).foregroundStyle(.secondary)
            Group {
                if let image {
                    Image(uiImage: image).resizable().scaledToFit()
                } else {
                    ContentUnavailableView("Ingen forhåndsvisning",
                                           systemImage: "photo")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: 420)
            .background(Color(white: 0.96), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.black.opacity(0.12)))
        }
        .frame(maxWidth: .infinity)
    }
}

private struct PromptInspectorSheet: View {
    let compilation: StoryboardPromptCompilationSummary?
    let status: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let compilation {
                    List {
                        Section("Oppsummering") {
                            LabeledContent("Modell", value: compilation.modelLabel)
                            LabeledContent("Leverandør", value: compilation.modelProvider)
                            LabeledContent("Stil", value: compilation.styleLabel)
                            if let scenario = compilation.scenarioLabel {
                                LabeledContent("Scenario", value: scenario)
                            }
                            LabeledContent("Arvede constraints",
                                           value: "\(compilation.inheritedConstraintCount)")
                            Label(compilation.valid ? "Gyldig prompt" : "Må kontrolleres",
                                  systemImage: compilation.valid
                                    ? "checkmark.shield.fill" : "exclamationmark.triangle.fill")
                                .foregroundStyle(compilation.valid ? Color.green : Color.orange)
                        }
                        if !compilation.lockedProperties.isEmpty {
                            Section("Låst") {
                                Text(compilation.lockedProperties.joined(separator: " · "))
                            }
                        }
                        if !compilation.issues.isEmpty {
                            Section("Validering") {
                                ForEach(compilation.issues) { issue in
                                    Label(issue.message, systemImage: issue.severity == "error"
                                          ? "xmark.octagon.fill" : "exclamationmark.triangle")
                                        .foregroundStyle(issue.severity == "error"
                                                         ? Color.red : Color.orange)
                                }
                            }
                        }
                        ForEach(compilation.modules.filter { !$0.constraints.isEmpty }) { module in
                            Section(module.label) {
                                ForEach(module.constraints) { constraint in
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack {
                                            Text(constraint.source.uppercased())
                                                .font(.caption2.monospaced())
                                                .foregroundStyle(.secondary)
                                            if constraint.locked {
                                                Image(systemName: "lock.fill").font(.caption2)
                                            }
                                        }
                                        Text(constraint.text).font(.subheadline)
                                    }
                                }
                            }
                        }
                        Section("Compiled prompt") {
                            Text(compilation.compiledPrompt)
                                .font(.system(.caption, design: .monospaced))
                                .textSelection(.enabled)
                        }
                    }
                } else {
                    ContentUnavailableView(
                        status ?? "Ingen prompt kompilert",
                        systemImage: "doc.text.magnifyingglass",
                        description: Text("Velg Prompt Inspector på et shot."))
                }
            }
            .navigationTitle("Prompt Inspector")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                }
            }
        }
    }
}

private struct AnimationPreflightSheet: View {
    let preflight: StoryboardAnimationPreflightSummary
    let sourceImage: UIImage?
    let sourceStage: String
    let onCancel: () -> Void
    let onConfirm: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let sourceImage {
                        Image(uiImage: sourceImage)
                            .resizable()
                            .scaledToFit()
                            .background(Color(uiColor: .systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.secondary.opacity(0.25)))
                            .accessibilityLabel("Eksakt animasjonskilde")
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        Label("Dette eksakte bildet sendes til leverandøren",
                              systemImage: "checkmark.shield.fill")
                            .font(.headline).foregroundStyle(Color.green)
                        LabeledContent("Kilde", value: sourceStage)
                        LabeledContent("Modell", value: preflight.model)
                        LabeledContent("Leverandør", value: preflight.provider.capitalized)
                        LabeledContent("Kostnad",
                                       value: String(format: "$%.2f", preflight.estimatedCostUsd))
                            .accessibilityElement(children: .combine)
                            .accessibilityLabel(String(
                                format: "Autoritativ kostnad $%.2f",
                                preflight.estimatedCostUsd))
                        if let credits = preflight.providerCredits {
                            LabeledContent("Provider credits",
                                           value: String(format: "%.2f", credits))
                        }
                        LabeledContent("Kilde-ID", value: preflight.sourceFingerprint)
                            .font(.caption.monospaced())
                        LabeledContent("Prompt-ID", value: preflight.compilationFingerprint)
                            .font(.caption.monospaced())
                    }
                    Text("Grafittlinjer, valgt farge og atmosfære er bakt inn i kilden. Prompt enhancement er slått av, slik at Higgsfield ikke omskriver uttrykket mot foto eller concept art.")
                        .font(.footnote).foregroundStyle(.secondary)
                    HStack {
                        Button("Avbryt", role: .cancel, action: onCancel)
                            .buttonStyle(.bordered)
                        Spacer()
                        Button(action: onConfirm) {
                            Label(String(format: "Start · $%.2f", preflight.estimatedCostUsd),
                                  systemImage: "play.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .accessibilityLabel("Bekreft og start animasjon")
                    }
                }
                .padding(24)
            }
            .navigationTitle("Kontroller før animasjon")
        }
    }
}

private func productionStampControlHelp(_ type: BrushType) -> String {
    switch type {
    case .crowdStamp:
        return "Bytt mellom bakgrunnsgruppe, bevegelse, tett crowd og reaksjonsblocking."
    case .faceExpressionStamp:
        return "Bytt uttrykk uten å endre karakteridentitet, kameravinkel eller stil."
    case .handPoseStamp:
        return "Bytt håndpositur; roter og speilvend etter karakterens blocking."
    case .cameraRigStamp:
        return "Bytt mellom stativ, håndholdt, dolly og kran."
    case .characterPoseStamp:
        return "Bytt mellom stående, løp, lav huk og pekerpositur; roter og speilvend etter blocking."
    case .doorStamp:
        return "Bytt dørtype og åpningstilstand; perspektivjustering beholder lesbar karm og svingretning."
    case .boomMicStamp:
        return "Bytt lydrigg; produksjonsoverlayet holdes separat fra ren storyboard-artwork."
    case .filmLightStamp:
        return "Bytt fixture og modifier; produksjonsoverlayet kan plasseres som et lysdiagram."
    case .staircaseStamp:
        return "Bytt trappetype og bruk rotasjon/perspektiv for å låse stigning og blocking."
    case .workstationStamp:
        return "Bytt fra enkel kontorplass til klippesuite eller kontrollrom uten å miste skjermsemantikken."
    case .communicationStamp:
        return "Bytt kommunikasjonsprop; valgt enhet og tilstand sendes videre som AI-kontekst."
    case .publicTransportStamp:
        return "Bytt transportmiddel og behold reiseretning, skala, dører og passasjerkontekst."
    case .animalStamp:
        return "Bytt art og pose; blikk, bevegelse og skala lagres for videre generering."
    case .fireSmokeStamp, .weatherFXStamp:
        return "Bytt effekt og bruk dybde, skala og opacity for kontinuitet gjennom sekvensen."
    default:
        return "Variantene beholder samme Story Pencil-stil og kan transformeres fritt."
    }
}

private func productionStampAtlasName(_ type: BrushType) -> String? {
    switch type {
    case .crowdStamp: return "StampCrowdAtlas"
    case .treeStamp: return "StampTreeAtlas"
    case .windowStamp: return "StampWindowAtlas"
    case .carStamp: return "StampCarAtlas"
    case .chairStamp: return "StampChairAtlas"
    case .faceExpressionStamp: return "StampFaceAtlas"
    case .handPoseStamp: return "StampHandAtlas"
    case .cameraRigStamp: return "StampCameraRigAtlas"
    case .characterPoseStamp: return "StampCharacterPoseAtlas"
    case .doorStamp: return "StampDoorAtlas"
    case .tableStamp: return "StampTableAtlas"
    case .sofaStamp: return "StampSofaAtlas"
    case .buildingStamp: return "StampBuildingAtlas"
    case .streetLightStamp: return "StampStreetLightAtlas"
    case .boomMicStamp: return "StampBoomMicAtlas"
    case .filmLightStamp: return "StampFilmLightAtlas"
    case .bedStamp: return "StampBedAtlas"
    case .staircaseStamp: return "StampStaircaseAtlas"
    case .counterStamp: return "StampCounterAtlas"
    case .workstationStamp: return "StampWorkstationAtlas"
    case .communicationStamp: return "StampCommunicationAtlas"
    case .luggageStamp: return "StampLuggageAtlas"
    case .publicTransportStamp: return "StampPublicTransportAtlas"
    case .animalStamp: return "StampAnimalAtlas"
    case .rockTerrainStamp: return "StampRockTerrainAtlas"
    case .waterStamp: return "StampWaterAtlas"
    case .fireSmokeStamp: return "StampFireSmokeAtlas"
    case .weatherFXStamp: return "StampWeatherFXAtlas"
    default: return nil
    }
}

/// Viser bare valgt atlasrute. Dette er en inspector-preview; lerretet
/// fortsetter å bruke Metal-masken og kan derfor farges, viskes og transformeres.
private struct ProductionStampAtlasPreview: View {
    let brushType: BrushType
    let variant: Int

    var body: some View {
        if let assetName = productionStampAtlasName(brushType) {
            GeometryReader { geometry in
                let normalized = ProductionStampCatalog.normalizedVariant(
                    variant, for: brushType)
                let column = normalized % 2
                let row = normalized / 2
                Image(assetName)
                    .resizable()
                    .interpolation(.high)
                    .frame(width: geometry.size.width * 2,
                           height: geometry.size.height * 2)
                    .offset(x: -CGFloat(column) * geometry.size.width,
                            y: -CGFloat(row) * geometry.size.height)
            }
            .clipped()
            .background(Color(red: 0.98, green: 0.975, blue: 0.955))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10)
                .stroke(Color.primary.opacity(0.12)))
            .accessibilityLabel("Forhåndsvisning av "
                + productionStampVariantLabel(brushType))
        }
    }
}

struct BrushEditorSheet: View {
    @ObservedObject var canvasState: CanvasState
    @Environment(\.dismiss) private var dismiss

    private func overrideBinding(
        _ keyPath: ReferenceWritableKeyPath<CanvasState, Double?>, default defaultValue: Double
    ) -> Binding<Double> {
        Binding(
            get: { canvasState[keyPath: keyPath] ?? defaultValue },
            set: { canvasState[keyPath: keyPath] = $0 }
        )
    }

    private var isHatchBrush: Bool {
        canvasState.brushType == .hatch || canvasState.brushType == .crosshatch
    }

    private var isEnvironmentalBrush: Bool {
        switch canvasState.brushType {
        case .forest, .debris, .organictex, .fur, .wethair, .spikes: return true
        default: return false
        }
    }

    private var isWetBrush: Bool {
        [.watercolor, .wash, .sumi, .gouache, .oil, .brush].contains(canvasState.brushType)
    }

    private var isFilamentBrush: Bool {
        (BrushSpec.preset(canvasState.brushType, size: 1, color: "#000000", opacity: 1)
            .tipModel ?? .stamp) == .filament
    }

    private var isProductionStamp: Bool {
        canvasState.brushType.isProductionStamp
    }

    private var stampVariantBinding: Binding<Int> {
        Binding(
            get: { canvasState.stampVariantOverride ?? -1 },
            set: { canvasState.stampVariantOverride = $0 < 0 ? nil : $0 }
        )
    }

    private var stampDepthBinding: Binding<String> {
        Binding(
            get: { canvasState.stampDepthOverride?.rawValue ?? "auto" },
            set: { canvasState.stampDepthOverride = ProductionStampDepth(rawValue: $0) }
        )
    }

    private func paperBinding(default defaultValue: PaperProfile) -> Binding<PaperProfile> {
        Binding(
            get: { canvasState.paperProfileOverride ?? defaultValue },
            set: { canvasState.paperProfileOverride = $0 }
        )
    }

    var body: some View {
        let preset = BrushSpec.preset(canvasState.brushType, size: canvasState.brushSize,
                                      color: canvasState.brushColor, opacity: canvasState.brushOpacity)
        NavigationStack {
            Form {
                Section("Tekstur") {
                    LabeledContent("Hardhet") {
                        Slider(value: overrideBinding(\.hardnessOverride, default: preset.hardness), in: 0...1)
                    }
                    LabeledContent("Grain") {
                        Slider(value: overrideBinding(\.grainOverride, default: preset.grain), in: 0...1)
                    }
                    LabeledContent("Flow") {
                        Slider(value: overrideBinding(\.flowOverride, default: preset.flow), in: 0.02...1)
                    }
                    LabeledContent("Fargevariasjon") {
                        Slider(value: overrideBinding(\.hueJitterOverride, default: 0), in: 0...1)
                    }
                }
                Section("Materiale") {
                    Picker("Papir", selection: paperBinding(default: preset.paperProfile ?? .storyboard)) {
                        ForEach(PaperProfile.allCases, id: \.self) { paper in
                            Text(paper.rawValue.capitalized).tag(paper)
                        }
                    }
                    if isWetBrush {
                        LabeledContent("Våthet") {
                            Slider(value: overrideBinding(\.wetnessOverride, default: preset.wetness), in: 0...1)
                        }
                        LabeledContent("Blødning") {
                            Slider(value: overrideBinding(\.bleedOverride, default: preset.bleed ?? 0), in: 0...1)
                        }
                    }
                    LabeledContent("Pigmentuttømming") {
                        Slider(value: overrideBinding(\.pigmentDepletionOverride,
                                                      default: preset.pigmentDepletion ?? 0), in: 0...1)
                    }
                    if isFilamentBrush {
                        LabeledContent("Bust (Int(canvasState.bristleCountOverride ?? Double(preset.bristleCount ?? 5)))") {
                            Slider(value: overrideBinding(\.bristleCountOverride,
                                                          default: Double(preset.bristleCount ?? 5)), in: 1...16, step: 1)
                        }
                    }
                }
                // §48: parametre per kategori — vis kun det penselen støtter
                if isHatchBrush {
                    Section("Skravering") {
                        LabeledContent("Vinkel \(Int(canvasState.hatchAngleOverride ?? 35))°") {
                            Slider(value: overrideBinding(\.hatchAngleOverride, default: 35), in: 0...180)
                        }
                        LabeledContent("Tetthet") {
                            Slider(value: overrideBinding(\.hatchDensityOverride, default: 1), in: 0.3...2.5)
                        }
                        LabeledContent("Lengde") {
                            Slider(value: overrideBinding(\.hatchLengthOverride, default: 1), in: 0.4...2.5)
                        }
                    }
                }
                if isEnvironmentalBrush {
                    Section("Struktur") {
                        LabeledContent("Tetthet") {
                            Slider(value: overrideBinding(\.envDensityOverride, default: 1), in: 0.3...2.5)
                        }
                        LabeledContent("Skala") {
                            Slider(value: overrideBinding(\.envScaleOverride, default: 1), in: 0.4...2.5)
                        }
                    }
                }
                if isProductionStamp {
                    Section("Posering og form") {
                        Picker(productionStampVariantLabel(canvasState.brushType),
                               selection: stampVariantBinding) {
                            Text("Auto · unik per plassering").tag(-1)
                            ForEach(ProductionStampCatalog.variants(
                                for: canvasState.brushType)) { variant in
                                Text(variant.name).tag(variant.id)
                            }
                        }
                        Text(productionStampControlHelp(canvasState.brushType))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Picker("Dybde", selection: stampDepthBinding) {
                            Text("Auto fra plassering").tag("auto")
                            ForEach(ProductionStampDepth.allCases, id: \.self) { depth in
                                Text(depth.displayName).tag(depth.rawValue)
                            }
                        }
                        Toggle("Speilvend horisontalt",
                               isOn: $canvasState.stampFlipX)
                        Picker("Stil", selection: $canvasState.stampStyleProfileId) {
                            ForEach(ProductionStampStyleCatalog.options) { style in
                                Text(style.name).tag(style.id)
                            }
                        }
                        TextField("Continuity-ID (valgfritt)",
                                  text: $canvasState.stampContinuityId)
                            .textInputAutocapitalization(.never)
                        if let selected = canvasState.stampVariantOverride,
                           let variant = ProductionStampCatalog.variant(
                            selected, for: canvasState.brushType) {
                            LabeledContent("AI-kontekst") {
                                Text(variant.parameters.sorted { $0.key < $1.key }
                                    .map { "\($0.key): \($0.value)" }
                                    .joined(separator: " · "))
                                    .font(.caption.monospaced())
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        Text("Tap plasserer. Drag bestemmer størrelse og rotasjon. "
                             + "Velg stampen med lasso for direkte flytt-, skaler- "
                             + "og rotasjonshåndtak.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Section {
                    Button("Tilbakestill til preset") {
                        canvasState.grainOverride = nil
                        canvasState.flowOverride = nil
                        canvasState.hardnessOverride = nil
                        canvasState.wetnessOverride = nil
                        canvasState.bleedOverride = nil
                        canvasState.pigmentDepletionOverride = nil
                        canvasState.bristleCountOverride = nil
                        canvasState.paperProfileOverride = nil
                        canvasState.hatchAngleOverride = nil
                        canvasState.hatchDensityOverride = nil
                        canvasState.hatchLengthOverride = nil
                        canvasState.envDensityOverride = nil
                        canvasState.envScaleOverride = nil
                        canvasState.stampVariantOverride = nil
                        canvasState.stampDepthOverride = nil
                        canvasState.stampFlipX = false
                    }
                }
            }
            .navigationTitle("Pensel-editor")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Ferdig") { dismiss() } }
            }
        }
    }
}

/// Inspector for et allerede plassert stempel. Endringer committes samlet
/// som én undo-operasjon og beholder stroke-ID/continuity gjennom synk.
struct PlacedStampInspectorSheet: View {
    @ObservedObject var canvasState: CanvasState
    let strokeID: String
    @Environment(\.dismiss) private var dismiss
    @State private var draft: ProductionStampInstance
    @State private var draftCenterX: Double
    @State private var draftCenterY: Double
    private let brushType: BrushType

    init(canvasState: CanvasState, strokeID: String) {
        self.canvasState = canvasState
        self.strokeID = strokeID
        let stroke = canvasState.strokes.first(where: { $0.id == strokeID })
        let type = stroke?.brush?.type ?? .crowdStamp
        brushType = type
        let variant = ProductionStampCatalog.variant(0, for: type)
        let center = stroke?.points.first
            ?? StrokePoint(x: 0, y: 0, pressure: 1,
                           tiltX: 0, tiltY: 0, timestamp: 0)
        _draftCenterX = State(initialValue: center.x)
        _draftCenterY = State(initialValue: center.y)
        _draft = State(initialValue: stroke?.stampInstance
            ?? ProductionStampInstance(
                variant: 0, variantName: variant?.name ?? "Variant 1",
                seed: ProductionStampCatalog.stableSeed(for: strokeID),
                parameters: variant?.parameters ?? [:]))
    }

    private var continuityBinding: Binding<String> {
        Binding(
            get: { draft.continuityId ?? "" },
            set: {
                let cleaned = $0.trimmingCharacters(in: .whitespacesAndNewlines)
                draft.continuityId = cleaned.isEmpty ? nil : String(cleaned.prefix(120))
            }
        )
    }

    private func preparedDraft() -> ProductionStampInstance {
        var prepared = draft
        let variantIndex = ProductionStampCatalog.normalizedVariant(
            prepared.variant, for: brushType)
        if let variant = ProductionStampCatalog.variant(variantIndex, for: brushType) {
            prepared.variant = variantIndex
            prepared.variantName = variant.name
            prepared.parameters = variant.parameters
        }
        prepared.scale = min(8, max(0.1, prepared.scale))
        prepared.styleProfileId = String(prepared.styleProfileId.prefix(100))
        prepared.perspectiveSkew = min(0.45, max(-0.45,
            prepared.perspectiveSkew ?? 0))
        prepared.compoundGeometry = ProductionStampGeometryCatalog.geometry(
            for: brushType, variant: prepared.variant, seed: prepared.seed)
        return prepared
    }

    private func apply() {
        guard let index = canvasState.strokes.firstIndex(where: { $0.id == strokeID }) else {
            dismiss()
            return
        }
        let prepared = preparedDraft()
        canvasState.captureUndo("Rediger stamp")
        if let anchor = canvasState.strokes[index].points.first {
            let dx = draftCenterX - anchor.x
            let dy = draftCenterY - anchor.y
            canvasState.strokes[index].points = canvasState.strokes[index].points.map { point in
                var moved = point
                moved.x += dx
                moved.y += dy
                return moved
            }
        }
        canvasState.strokes[index].stampInstance = prepared
        canvasState.strokes[index].boardLayer = prepared.renderLayer == .productionOverlay
            ? "Camera / Arrows"
            : "Drawing"
        canvasState.revision += 1
        dismiss()
    }

    private func releaseToEditableStrokes() {
        guard let index = canvasState.strokes.firstIndex(where: { $0.id == strokeID }) else {
            dismiss()
            return
        }
        var source = canvasState.strokes[index]
        if let anchor = source.points.first {
            let dx = draftCenterX - anchor.x
            let dy = draftCenterY - anchor.y
            source.points = source.points.map { point in
                var moved = point
                moved.x += dx
                moved.y += dy
                return moved
            }
        }
        let prepared = preparedDraft()
        let released = ProductionStampGeometryCatalog.releasedStrokes(
            from: source, using: prepared)
        guard !released.isEmpty else { return }
        canvasState.captureUndo("Frigi stamp til strøk")
        canvasState.strokes.replaceSubrange(index...index, with: released)
        canvasState.revision += 1
        dismiss()
    }

    var body: some View {
        let canvasWidth = max(1, Double(canvasState.contentSize?.width ?? 1_920))
        let canvasHeight = max(1, Double(canvasState.contentSize?.height ?? 1_080))
        NavigationStack {
            Form {
                Section("Posering og uttrykk") {
                    LabeledContent("Type", value: BrushCatalog.displayName(brushType))
                    ProductionStampAtlasPreview(
                        brushType: brushType, variant: draft.variant)
                        .frame(height: 220)
                    Picker(productionStampVariantLabel(brushType),
                           selection: $draft.variant) {
                        ForEach(ProductionStampCatalog.variants(for: brushType)) { variant in
                            Text(variant.name).tag(variant.id)
                        }
                    }
                    Text(productionStampControlHelp(brushType))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("Ny seedet variasjon", systemImage: "dice") {
                        draft.seed &+= 1
                    }
                    LabeledContent("Seed", value: String(draft.seed))
                        .font(.caption.monospaced())
                }
                Section("Transformasjon") {
                    LabeledContent("Posisjon X \(draftCenterX, specifier: "%.0f")") {
                        Slider(value: $draftCenterX, in: 0...canvasWidth)
                    }
                    LabeledContent("Posisjon Y \(draftCenterY, specifier: "%.0f")") {
                        Slider(value: $draftCenterY, in: 0...canvasHeight)
                    }
                    HStack {
                        Button("Venstre", systemImage: "arrow.left") {
                            draftCenterX = max(0, draftCenterX - 12)
                        }
                        Button("Opp", systemImage: "arrow.up") {
                            draftCenterY = max(0, draftCenterY - 12)
                        }
                        Button("Ned", systemImage: "arrow.down") {
                            draftCenterY = min(canvasHeight, draftCenterY + 12)
                        }
                        Button("Høyre", systemImage: "arrow.right") {
                            draftCenterX = min(canvasWidth, draftCenterX + 12)
                        }
                    }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.bordered)
                    LabeledContent("Skala \(draft.scale, specifier: "%.2f")×") {
                        Slider(value: $draft.scale, in: 0.1...8)
                    }
                    LabeledContent("Rotasjon \(draft.rotationDegrees, specifier: "%.0f")°") {
                        Slider(value: $draft.rotationDegrees, in: -180...180)
                    }
                    HStack {
                        Button("Roter 15° mot venstre", systemImage: "rotate.left") {
                            draft.rotationDegrees = max(-180, draft.rotationDegrees - 15)
                        }
                        Button("Rett opp", systemImage: "arrow.up.to.line") {
                            draft.rotationDegrees = 0
                        }
                        Button("Roter 15° mot høyre", systemImage: "rotate.right") {
                            draft.rotationDegrees = min(180, draft.rotationDegrees + 15)
                        }
                    }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.bordered)
                    LabeledContent("Perspektiv \(draft.perspectiveSkew ?? 0, specifier: "%.2f")") {
                        Slider(value: Binding(
                            get: { draft.perspectiveSkew ?? 0 },
                            set: { draft.perspectiveSkew = $0 }
                        ), in: -0.45...0.45)
                    }
                    Toggle("Speilvend horisontalt", isOn: $draft.flipX)
                    Picker("Dybde", selection: $draft.depth) {
                        ForEach(ProductionStampDepth.allCases, id: \.self) { depth in
                            Text(depth.displayName).tag(depth)
                        }
                    }
                }
                Section("Produksjonskontekst") {
                    Picker("Stil", selection: $draft.styleProfileId) {
                        ForEach(ProductionStampStyleCatalog.options) { style in
                            Text(style.name).tag(style.id)
                        }
                    }
                    TextField("Continuity-ID", text: continuityBinding)
                        .textInputAutocapitalization(.never)
                    Picker("Lag", selection: $draft.renderLayer) {
                        Text("Storyboard-tegning")
                            .tag(ProductionStampRenderLayer.artwork)
                        Text("Produksjonsoverlay")
                            .tag(ProductionStampRenderLayer.productionOverlay)
                    }
                    ForEach(draft.parameters.keys.sorted(), id: \.self) { key in
                        LabeledContent(key, value: draft.parameters[key] ?? "")
                    }
                }
                Section("Redigerbar geometri") {
                    LabeledContent("Renderkilde", value: "High-fidelity · 512 px variant")
                    LabeledContent("Vektorbaner") {
                        Text(String((draft.compoundGeometry
                            ?? ProductionStampGeometryCatalog.geometry(
                                for: brushType, variant: draft.variant,
                                seed: draft.seed)).paths.count))
                            .monospacedDigit()
                    }
                    Button("Frigjør til penselstrøk",
                           systemImage: "square.3.layers.3d") {
                        releaseToEditableStrokes()
                    }
                    Text("Stampen kan flyttes, roteres, skaleres, speilvendes, "
                         + "viskes i og tegnes over. Frigjøring gjør kontrollgeometrien "
                         + "til individuelle Story Pencil-strøk og kan angres.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Stamp Inspector")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Bruk") { apply() }.fontWeight(.semibold)
                }
            }
        }
    }
}

// Tonal-analyse (spec §42–§43): fordeling lys/mellom/mørk for aktivt shot,
// med flathetsvarsel. Kun analyse — foreslår, tvinger aldri.
struct ToneReportSheet: View {
    let report: ToneReport?
    var hero: HeroReport?
    @Environment(\.dismiss) private var dismiss

    private func bar(_ label: String, _ value: Double, hint: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(label).font(.system(size: 12, weight: .bold))
                Spacer()
                Text("\(Int(value * 100)) %")
                    .font(.system(size: 12).monospacedDigit()).foregroundStyle(.secondary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule().fill(color).frame(width: max(3, geo.size.width * value))
                }
            }
            .frame(height: 10)
            Text(hint).font(.caption2).foregroundStyle(.secondary)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let report {
                    List {
                        Section {
                            bar("LYS (bakgrunn)", report.lightPct,
                                hint: "Fjell, tåke, fjern skog — 10–30 % mørkhet",
                                color: Color(white: 0.75))
                            bar("MELLOM (midtplan)", report.midPct,
                                hint: "Trær, kjøretøy, terreng — 30–55 %",
                                color: Color(white: 0.5))
                            bar("MØRK (forgrunn/hero)", report.darkPct,
                                hint: "Hovedfigurer, silhuetter — 60–90 %",
                                color: Color(white: 0.22))
                        } header: {
                            Text("Tonefordeling · \(Int(report.coveragePct * 100)) % av flaten dekket")
                        }
                        // Fokal klarhet (§73–§74 forenklet): står noe frem?
                        Section("Fokus") {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text("Fokal kontrast").font(.system(size: 12, weight: .bold))
                                    Spacer()
                                    Text("\(Int(report.focalContrast * 100)) %")
                                        .font(.system(size: 12).monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                                if report.isDiffuse {
                                    Label("Diffust: ingen sone står tydelig frem — vurder å mørkne hero-området eller lette omgivelsene.",
                                          systemImage: "exclamationmark.triangle")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                } else if report.focalZone != nil {
                                    Text("Tyngdepunktet er markert i tetthetskartet under.")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                // §74 hero-separasjon (Vision-saliency)
                                if let hero {
                                    HStack {
                                        Text("Hero-separasjon").font(.system(size: 12, weight: .bold))
                                        Spacer()
                                        Text("\(Int(hero.separation * 100)) %")
                                            .font(.system(size: 12).monospacedDigit())
                                            .foregroundStyle(.secondary)
                                    }
                                    if hero.isWeak {
                                        Label("Hero-regionen drukner i omgivelsene — øk verdikontrasten rundt hovedmotivet.",
                                              systemImage: "exclamationmark.triangle")
                                            .font(.caption)
                                            .foregroundStyle(.orange)
                                    }
                                }
                            }
                        }
                        // Density map (§70–§72): heatmap + hvilesoner
                        Section("Tetthetskart") {
                            VStack(alignment: .leading, spacing: 6) {
                                VStack(spacing: 2) {
                                    ForEach(0..<ToneReport.gridRows, id: \.self) { row in
                                        HStack(spacing: 2) {
                                            ForEach(0..<ToneReport.gridColumns, id: \.self) { col in
                                                let isPeak = report.focalZone.map { $0.row == row && $0.col == col } ?? false
                                                RoundedRectangle(cornerRadius: 2)
                                                    .fill(Color.primary.opacity(0.06 + report.densityGrid[row][col] * 0.9))
                                                    .overlay(RoundedRectangle(cornerRadius: 2)
                                                        .stroke(isPeak ? BoardBrand.accent : .clear, lineWidth: 2))
                                                    .aspectRatio(1.6, contentMode: .fit)
                                            }
                                        }
                                    }
                                }
                                Text("\(report.restZoneCount) av \(ToneReport.gridRows * ToneReport.gridColumns) soner er hvileflater (øyet trenger pauser — helt fullt bilde blir støy).")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        if report.isFlat {
                            Section {
                                Label("Flat tonefordeling: nesten alt ligger i ett bånd. Vurder å skille bakgrunn/midtplan/forgrunn med Vask, Skygge eller Tone.",
                                      systemImage: "exclamationmark.triangle")
                                    .font(.footnote)
                                    .foregroundStyle(.orange)
                            }
                        } else if report.coveragePct > 0.05 {
                            Section {
                                Label("God spredning over tonebåndene — dybden leses.",
                                      systemImage: "checkmark.circle")
                                    .font(.footnote)
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                } else {
                    ContentUnavailableView("Ingen tegning å analysere",
                                           systemImage: "chart.bar")
                }
            }
            .navigationTitle("Tone-analyse")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Lukk") { dismiss() } }
            }
        }
    }
}

// Krasj-vern: usynkede strøk skrives til disk ved hver endring og slettes
// først når serveren har bekreftet. Overlever app-kill.
struct ActiveFrameSaveSnapshot: Sendable, Equatable {
    var manuscriptId: String
    var sceneId: String
    var frameId: String
    var revision: Int
    var strokesJSON: String
    var thumbnailDataURL: String?
    var layerState: BoardLayerState
    var shotFraming: ShotFramingState
    var baseUpdatedAt: String?
    var baseStrokesJSON: String?
    var baseLayerState: BoardLayerState?
    var baseShotFraming: ShotFramingState?
}

struct AISourceSnapshotAcknowledgement: Sendable, Equatable {
    var frameUpdatedAt: String
    var sourceUpdatedAt: String
    /// Nil is valid for a brand-new frame before ensureStoryboard creates its
    /// normalized row. Generation still requires the final ensured revision.
    var sourceRevision: Int?
    var strokesJSON: String
    var layerState: BoardLayerState
    var shotFraming: ShotFramingState
    var paintoverState: StoryboardPaintoverState
}

/// Everything that can change the paid image-stage result. The context hash
/// includes the composed production prompt inputs while the explicit source
/// and framing fields make review/debugging unambiguous.
struct AIImageGenerationOperationIdentity: Codable, Sendable, Equatable {
    let projectId: String
    let storyboardId: String
    let frameId: String
    let stage: String
    let sourceRevision: Int
    let sourceUpdatedAt: String
    let framingFingerprint: String
    let requestFingerprint: String
    /// Nil for Color/Pencil generation. Atmosphere retries include the hash
    /// of the full immutable PNG + binding object, so an app restart cannot
    /// reuse a provider key for different overlay pixels.
    let paintoverCompositeFingerprint: String?

    static func contextFingerprint(
        _ context: [String: any Sendable]
    ) throws -> String {
        guard JSONSerialization.isValidJSONObject(context) else {
            throw NSError(
                domain: "StoryboardAIImageOperation", code: 1,
                userInfo: [NSLocalizedDescriptionKey:
                    "Produksjonskonteksten kunne ikke låses. Ingen AI-kostnad er utløst."])
        }
        let data = try JSONSerialization.data(
            withJSONObject: context, options: [.sortedKeys])
        return SHA256.hash(data: data)
            .map { String(format: "%02x", $0) }.joined()
    }
}

enum AIImageGenerationOperationRetentionPolicy {
    static func shouldClearAfterTerminalResponse(_ error: Error) -> Bool {
        guard let syncError = error as? SyncError else { return false }
        guard case .serverResponse(let code, _) = syncError else { return false }
        // Generic/provider/5xx responses can arrive after candidate commit but
        // before a complete reply; replaying the same key is the recovery path.
        // Only these codes prove that this key can never yield a candidate.
        return [
            "generation_attempt_failed",
            "idempotency_key_reused",
            "idempotency_payload_changed",
        ].contains(code)
    }
}

private struct PendingAIImageGenerationOperation: Codable, Sendable, Equatable {
    let identity: AIImageGenerationOperationIdentity
    let operationKey: String
    let createdAt: Date
}

/// Disk-backed paid-operation token. It is intentionally MainActor-isolated:
/// every native generation already starts there, which also prevents two
/// same-process taps from racing the initial atomic write.
@MainActor
enum AIImageGenerationOperationStore {
    private static let maximumRetentionAge: TimeInterval = 30 * 24 * 60 * 60

    private static var directory: URL {
        FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(
                "pending-ai-image-operations", isDirectory: true)
    }

    private static func fileURL(
        for identity: AIImageGenerationOperationIdentity
    ) throws -> URL {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(identity)
        let filename = SHA256.hash(data: data)
            .map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent("\(filename).json")
    }

    static func operationKey(
        for identity: AIImageGenerationOperationIdentity,
        now: Date = Date()
    ) throws -> String {
        let url = try fileURL(for: identity)
        if let data = try? Data(contentsOf: url),
           let pending = try? JSONDecoder().decode(
                PendingAIImageGenerationOperation.self, from: data),
           pending.identity == identity {
            prune(excluding: url, now: now)
            return pending.operationKey
        }
        try FileManager.default.createDirectory(
            at: directory, withIntermediateDirectories: true,
            attributes: [.protectionKey:
                FileProtectionType.completeUntilFirstUserAuthentication])
        let pending = PendingAIImageGenerationOperation(
            identity: identity,
            operationKey: "ios-\(UUID().uuidString.lowercased())",
            createdAt: now)
        let data = try JSONEncoder().encode(pending)
        try data.write(
            to: url,
            options: [.atomic,
                .completeFileProtectionUntilFirstUserAuthentication])
        prune(excluding: url, now: now)
        return pending.operationKey
    }

    private static func prune(excluding retainedURL: URL, now: Date) {
        let manager = FileManager.default
        let files = (try? manager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles])) ?? []
        let cutoff = now.addingTimeInterval(-maximumRetentionAge)
        for url in files where url.pathExtension == "json" && url != retainedURL {
            let createdAt = (try? Data(contentsOf: url))
                .flatMap { try? JSONDecoder().decode(
                    PendingAIImageGenerationOperation.self, from: $0) }
                .map(\.createdAt) ?? .distantPast
            if createdAt < cutoff {
                try? manager.removeItem(at: url)
            }
        }
    }

    static var retainedOperationCount: Int {
        ((try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles])) ?? [])
            .filter { $0.pathExtension == "json" }.count
    }

    /// Compare-and-clear means an older completion can never remove a newer
    /// operation record for the same logical slot.
    @discardableResult
    static func clear(
        _ identity: AIImageGenerationOperationIdentity,
        ifOperationKeyMatches operationKey: String
    ) -> Bool {
        guard let url = try? fileURL(for: identity),
              let data = try? Data(contentsOf: url),
              let pending = try? JSONDecoder().decode(
                PendingAIImageGenerationOperation.self, from: data),
              pending.identity == identity,
              pending.operationKey == operationKey else { return false }
        do {
            try FileManager.default.removeItem(at: url)
            return true
        } catch {
            return false
        }
    }
}

/// Stage-aware paintover binding for candidate/approved image versions.
/// Color depends on Pencil/framing only. Atmosphere additionally depends on
/// the exact acknowledged Color overlay whenever that overlay has content.
enum AIImageStagePaintoverPolicy {
    static func matches(
        stage: String,
        isApproved: Bool,
        capturedColorRevision: Int?,
        capturedColorFingerprint: String?,
        state: StoryboardPaintoverState?,
        localChanges: StoryboardPaintoverChangeSet
    ) -> Bool {
        guard !localChanges.pencilChanged else { return false }
        guard stage == "atmosphere" else { return true }
        guard !localChanges.colorChanged else { return false }

        if let capturedColorRevision, let state {
            return capturedColorRevision == state.colorRevision
                && capturedColorFingerprint?.lowercased()
                    == state.colorFingerprint.lowercased()
        }
        if isApproved { return true }
        // A generated Atmosphere response may omit composite metadata only
        // when the authoritative Color layer is provably empty.
        return state?.colorHasContent == false
    }
}

/// Pure fail-closed policy for binding fetched AI versions to the live source.
/// Kept outside SwiftUI so autosync/cache regressions are deterministic tests.
enum AIImageVersionRevisionPolicy {
    static func matches(
        candidateSourceRevision: Int?,
        authoritativeSourceRevision: Int?,
        generatedDocumentRevision: Int?,
        currentDocumentRevision: Int,
        loadedDocumentRevision: Int,
        isApproved: Bool,
        frameIsStale: Bool
    ) -> Bool {
        if let authoritativeSourceRevision {
            guard candidateSourceRevision == authoritativeSourceRevision else {
                return false
            }
        }
        if let generatedDocumentRevision {
            return generatedDocumentRevision == currentDocumentRevision
        }
        if authoritativeSourceRevision != nil {
            return currentDocumentRevision == loadedDocumentRevision
        }
        // Legacy approved projects remain reviewable only while the local
        // document is clean. Generated/unapproved versions never get this
        // compatibility escape hatch.
        return isApproved
            && !frameIsStale
            && currentDocumentRevision == loadedDocumentRevision
    }
}

struct FrameSaveCompletionPlan: Sendable, Equatable {
    var updateActiveBaselines: Bool
    var clearPendingDocument: Bool
    var scheduleLatestActiveSave: Bool
}

/// Pure policy kept outside SwiftUI so save-completion ordering can be tested
/// without a network or timing-dependent UI test.
enum FrameSaveRacePolicy {
    static func pendingMatches(
        _ pending: PendingStoryboardDocument,
        represents snapshot: ActiveFrameSaveSnapshot
    ) -> Bool {
        let revisionMatches = pending.localRevision.map {
            $0 == snapshot.revision
        } ?? true // v1-v3 WAL files had no revision sidecar.
        let optimisticBaseMatches = pending.version < 6
            || (pending.baseUpdatedAt == snapshot.baseUpdatedAt
                && pending.baseStrokesJSON == snapshot.baseStrokesJSON
                && pending.baseLayerState == snapshot.baseLayerState
                && pending.baseShotFraming == snapshot.baseShotFraming)
        return revisionMatches
            && optimisticBaseMatches
            && pending.strokesJSON == snapshot.strokesJSON
            && pending.layerState == snapshot.layerState
            && pending.shotFraming == snapshot.shotFraming
    }

    static func completionPlan(
        snapshot: ActiveFrameSaveSnapshot,
        loadedFrameId: String?,
        currentRevision: Int,
        pendingDocument: PendingStoryboardDocument?
    ) -> FrameSaveCompletionPlan {
        let isActiveFrame = loadedFrameId == snapshot.frameId
        let pendingIsSavedSnapshot = pendingDocument.map {
            pendingMatches($0, represents: snapshot)
        } ?? false
        let activeDocumentAdvanced = isActiveFrame
            && (currentRevision != snapshot.revision
                || (pendingDocument != nil && !pendingIsSavedSnapshot))
        return FrameSaveCompletionPlan(
            updateActiveBaselines: isActiveFrame,
            clearPendingDocument: pendingIsSavedSnapshot,
            scheduleLatestActiveSave: activeDocumentAdvanced
        )
    }
}

struct PendingStoryboardDocument: Codable, Sendable, Equatable {
    static let schemaVersion = 7
    var version = Self.schemaVersion
    var strokesJSON: String
    var layerState: BoardLayerState?
    var shotFraming: ShotFramingState?
    var localRevision: Int? = nil
    var thumbnailDataURL: String? = nil
    var baseUpdatedAt: String? = nil
    var baseStrokesJSON: String? = nil
    var baseLayerState: BoardLayerState? = nil
    var baseShotFraming: ShotFramingState? = nil
    var savedAt = Date()
}

enum PendingStrokeStore {
    private static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("pending-strokes", isDirectory: true)
    }

    private static func fileURL(_ frameId: String) -> URL {
        directory.appendingPathComponent("\(frameId).json")
    }

    static func save(_ json: String, frameId: String,
                     layerState: BoardLayerState? = nil,
                     shotFraming: ShotFramingState? = nil,
                     localRevision: Int? = nil,
                     thumbnailDataURL: String? = nil,
                     baseUpdatedAt: String? = nil,
                     baseStrokesJSON: String? = nil,
                     baseLayerState: BoardLayerState? = nil,
                     baseShotFraming: ShotFramingState? = nil) {
        try? FileManager.default.createDirectory(
            at: directory, withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        let document = PendingStoryboardDocument(
            strokesJSON: json, layerState: layerState,
            shotFraming: shotFraming, localRevision: localRevision,
            thumbnailDataURL: thumbnailDataURL,
            baseUpdatedAt: baseUpdatedAt,
            baseStrokesJSON: baseStrokesJSON,
            baseLayerState: baseLayerState,
            baseShotFraming: baseShotFraming)
        guard let data = try? JSONEncoder().encode(document) else { return }
        try? data.write(to: fileURL(frameId),
                        options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    /// Backward-compatible accessor used by older call sites/tests.
    static func load(frameId: String) -> String? {
        loadDocument(frameId: frameId)?.strokesJSON
    }

    static func loadDocument(frameId: String) -> PendingStoryboardDocument? {
        guard let data = try? Data(contentsOf: fileURL(frameId)) else { return nil }
        if let document = try? JSONDecoder().decode(PendingStoryboardDocument.self, from: data) {
            return document
        }
        // v1 files contained the raw strokes JSON string.
        guard let raw = String(data: data, encoding: .utf8) else { return nil }
        return PendingStoryboardDocument(
            version: 1, strokesJSON: raw, layerState: nil,
            shotFraming: nil, localRevision: nil,
            thumbnailDataURL: nil, baseUpdatedAt: nil,
            baseStrokesJSON: nil, baseLayerState: nil,
            baseShotFraming: nil)
    }

    static func clear(frameId: String) {
        try? FileManager.default.removeItem(at: fileURL(frameId))
    }

    /// Compare-and-clear prevents a completed older upload from deleting a
    /// newer write-ahead log created for the same frame during its await.
    @discardableResult
    static func clear(
        frameId: String,
        ifUnchangedFrom savedDocument: PendingStoryboardDocument
    ) -> Bool {
        guard loadDocument(frameId: frameId) == savedDocument else { return false }
        do {
            try FileManager.default.removeItem(at: fileURL(frameId))
            return true
        } catch {
            return false
        }
    }

    /// Frame-id-er med usynkede strøk på disk (indikator-grunnlag).
    static func pendingFrameIds() -> Set<String> {
        let files = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
        return Set(files.filter { $0.hasSuffix(".json") }.map { String($0.dropLast(5)) })
    }
}

struct FlowTags: View {
    let tags: [String]
    var onRemove: ((String) -> Void)?

    var body: some View {
        // Wrap-layout: chips brytes over linjer (maks 3 per rad i 250pt-panelet)
        let rows = stride(from: 0, to: tags.count, by: 3).map { Array(tags[$0..<min($0 + 3, tags.count)]) }
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 6) {
                    ForEach(row, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text(tag)
                                .font(.system(size: 10, weight: .bold)).kerning(0.5)
                                .foregroundStyle(.white)
                            if let onRemove {
                                Button { onRemove(tag) } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundStyle(.white.opacity(0.55))
                                        .frame(width: 20, height: 20)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Fjern \(tag)")
                            }
                        }
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.white.opacity(0.08), in: Capsule())
                    }
                }
            }
        }
    }
}

// Script-fanen: manusvisning av scenene (slugline + handling + karakterer).
struct ScriptSheet: View {
    let scenes: [SceneSummary]
    let activeIndex: Int
    // Lesemodus (fullskjerm): manus-typografi i smal kolonne med
    // justerbar tekststørrelse — for gjennomlesing, ikke redigering.
    var readingMode = false
    var onEnterReadingMode: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @AppStorage("sb.scriptFontSize") private var readingFontSize = 16.0

    private func slugline(_ scene: SceneSummary, index: Int) -> String {
        let parts = [scene.intExt?.uppercased(),
                     scene.location?.uppercased(),
                     scene.timeOfDay.map { "— \($0.uppercased())" }]
            .compactMap(\.self)
        let head = parts.isEmpty ? scene.heading.uppercased() : parts.joined(separator: " ")
        return "\(scene.sceneNumber ?? index + 1). \(head)"
    }

    private var baseSize: Double { readingMode ? readingFontSize : 13 }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: readingMode ? 34 : 26) {
                        ForEach(Array(scenes.enumerated()), id: \.element.id) { index, scene in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(slugline(scene, index: index))
                                    .font(.system(size: baseSize + 1, weight: .bold, design: .monospaced))
                                if let text = scene.descriptionText, !text.isEmpty {
                                    Text(text)
                                        .font(.system(size: baseSize, design: .monospaced))
                                        .lineSpacing(readingMode ? 6 : 3)
                                }
                                if !scene.characters.isEmpty {
                                    // Karakterfeltet kan inneholde rolle-ID-er
                                    // («…-ROLE-NORA») — vis bare navnedelen.
                                    Text(scene.characters
                                        .map { $0.components(separatedBy: "-ROLE-").last ?? $0 }
                                        .map { $0.uppercased() }
                                        .joined(separator: " · "))
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                }
                                Text("\(scene.frames.count) \(scene.frames.count == 1 ? "SHOT" : "SHOTS") PÅ BOARDET")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(Color.purple)
                            }
                            .id(index)
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(index == activeIndex ? Color.purple.opacity(0.08) : Color.clear,
                                        in: RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    .padding(20)
                    .frame(maxWidth: readingMode ? 680 : .infinity)
                    .frame(maxWidth: .infinity)
                }
                .onAppear { proxy.scrollTo(activeIndex, anchor: .top) }
            }
            .navigationTitle(readingMode ? "Script — lesemodus" : "Script")
            .toolbar {
                if readingMode {
                    ToolbarItemGroup(placement: .topBarLeading) {
                        Button {
                            readingFontSize = max(12, readingFontSize - 2)
                        } label: { Image(systemName: "textformat.size.smaller") }
                        Button {
                            readingFontSize = min(30, readingFontSize + 2)
                        } label: { Image(systemName: "textformat.size.larger") }
                    }
                } else if let onEnterReadingMode {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            onEnterReadingMode()
                        } label: {
                            Label("Fullskjerm", systemImage: "arrow.up.left.and.arrow.down.right")
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Lukk") { dismiss() } }
            }
        }
    }
}
