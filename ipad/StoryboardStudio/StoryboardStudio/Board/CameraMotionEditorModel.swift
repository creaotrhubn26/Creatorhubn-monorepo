import Combine
import Foundation

enum CameraMotionEditorEndpoint: String, CaseIterable, Identifiable, Sendable {
    case start
    case end

    var id: String { rawValue }
    var label: String { self == .start ? "Start" : "End" }
}

enum CameraMotionPerformPhase: String, Sendable, Equatable {
    case ready
    case recording
    case review

    var label: String {
        switch self {
        case .ready: "Ready"
        case .recording: "Recording"
        case .review: "Review"
        }
    }
}

/// Presets are limited to moves the v1 2D viewport model can represent
/// truthfully. Tracking, crane, handheld and physical lens moves require a
/// future spatial/performed-camera contract and are deliberately not listed.
enum CameraMotionEditorPreset: String, CaseIterable, Identifiable, Sendable {
    case staticShot = "static"
    case pushIn = "push-in"
    case pullOut = "pull-out"
    case panLeft = "pan-left"
    case panRight = "pan-right"
    case tiltUp = "tilt-up"
    case tiltDown = "tilt-down"
    case custom

    var id: String { rawValue }

    var label: String {
        switch self {
        case .staticShot: "Static"
        case .pushIn: "Push in"
        case .pullOut: "Pull out"
        case .panLeft: "Pan left"
        case .panRight: "Pan right"
        case .tiltUp: "Tilt up"
        case .tiltDown: "Tilt down"
        case .custom: "Custom"
        }
    }

    var systemImage: String {
        switch self {
        case .staticShot: "pause.fill"
        case .pushIn: "plus.magnifyingglass"
        case .pullOut: "minus.magnifyingglass"
        case .panLeft: "arrow.left"
        case .panRight: "arrow.right"
        case .tiltUp: "arrow.up"
        case .tiltDown: "arrow.down"
        case .custom: "slider.horizontal.3"
        }
    }

    static func resolve(track: CameraMotionTrack?) -> Self {
        guard let track, track.enabled, !track.keyframes.isEmpty else {
            return .staticShot
        }
        guard let presetID = track.presetId,
              let preset = Self(rawValue: presetID) else {
            return .custom
        }
        return preset
    }
}

enum CameraMotionEditorValidationSeverity: Int, Sendable, Comparable {
    case valid
    case warning
    case blocking

    static func < (
        lhs: CameraMotionEditorValidationSeverity,
        rhs: CameraMotionEditorValidationSeverity
    ) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

struct CameraMotionEditorValidation: Sendable, Equatable {
    var severity: CameraMotionEditorValidationSeverity
    var title: String
    var detail: String

    static let ready = CameraMotionEditorValidation(
        severity: .valid,
        title: "Ready to save",
        detail: "The move is valid on the project frame grid."
    )
}

struct CameraMotionEditorCommit: Sendable, Equatable {
    var initialFraming: ShotFramingState
    var motionTrack: CameraMotionTrack?
}

enum CameraMotionEditorError: Error, Equatable {
    case invalidDraft(String)
    case performConfirmationRequired
}

extension CameraMotionEditorError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case let .invalidDraft(detail): detail
        case .performConfirmationRequired:
            "Confirm replacement before recording over the current camera move."
        }
    }
}

/// A transaction-local camera editor. The source document is never mutated by
/// scrub, gesture, preset or playback; the host receives one normalized value
/// only after commit() succeeds.
@MainActor
final class CameraMotionEditorModel: ObservableObject {
    typealias Validator = @MainActor (
        _ initialFraming: ShotFramingState,
        _ motionTrack: CameraMotionTrack?,
        _ shotDuration: MediaTime
    ) -> CameraMotionEditorValidation

    let shotDuration: MediaTime
    let timing: StoryboardTiming

    @Published private(set) var initialFraming: ShotFramingState
    @Published private(set) var motionTrack: CameraMotionTrack?
    @Published private(set) var currentTime: MediaTime = .zero
    @Published private(set) var selectedEndpoint: CameraMotionEditorEndpoint
    @Published private(set) var selectedPreset: CameraMotionEditorPreset
    @Published private(set) var validation: CameraMotionEditorValidation
    @Published private(set) var performPhase: CameraMotionPerformPhase = .ready
    @Published private(set) var performResult: CameraMotionPerformResult?
    @Published private(set) var livePerformFraming: ShotFramingState?

    private let originalInitialFraming: ShotFramingState
    private let originalMotionTrack: CameraMotionTrack?
    private let externalValidator: Validator?
    private let samplePlan: StoryboardFrameSamplePlan?
    private var transientMutationError: String?
    private var performRecorder: CameraMotionPerformRecorder?
    private var performSnapshot: PerformSnapshot?

    private struct PerformSnapshot {
        var initialFraming: ShotFramingState
        var motionTrack: CameraMotionTrack?
        var currentTime: MediaTime
        var selectedEndpoint: CameraMotionEditorEndpoint
        var selectedPreset: CameraMotionEditorPreset
        var performPhase: CameraMotionPerformPhase
        var performResult: CameraMotionPerformResult?
        var transientMutationError: String?
    }

    init(
        initialFraming: ShotFramingState,
        motionTrack: CameraMotionTrack?,
        shotDuration: MediaTime,
        timing: StoryboardTiming,
        selectedEndpoint: CameraMotionEditorEndpoint = .end,
        validator: Validator? = nil
    ) {
        let framing = initialFraming.normalized()
        self.initialFraming = framing
        self.motionTrack = motionTrack
        self.shotDuration = shotDuration
        self.timing = timing
        self.selectedEndpoint = selectedEndpoint
        self.selectedPreset = CameraMotionEditorPreset.resolve(
            track: motionTrack
        )
        self.validation = .ready
        self.originalInitialFraming = framing
        self.originalMotionTrack = motionTrack
        self.externalValidator = validator
        self.samplePlan = try? StoryboardFrameSamplePlan.make(
            shotDuration: shotDuration,
            timing: timing
        )
        self.currentTime = selectedEndpoint == .start
            ? .zero
            : shotDuration
        refreshValidation()
    }

    var presentationFraming: ShotFramingState {
        if performPhase == .recording, let livePerformFraming {
            return livePerformFraming
        }
        guard let plan = try? CameraMotionEvaluationPlan(
            initialFraming: initialFraming,
            track: motionTrack,
            shotDuration: shotDuration
        ) else {
            return initialFraming.normalized()
        }
        return plan.framing(at: currentTime)
    }

    var selectedPose: CameraPose2D {
        switch selectedEndpoint {
        case .start:
            return CameraPose2D(shotFraming: initialFraming)
        case .end:
            return (try? (motionTrack ?? CameraMotionTrack()).endPose(
                initialFraming: initialFraming,
                for: shotDuration
            )) ?? CameraPose2D(shotFraming: initialFraming)
        }
    }

    var selectedFraming: ShotFramingState {
        (try? selectedPose.applying(to: initialFraming))
            ?? initialFraming.normalized()
    }

    var selectedEasing: CameraMotionEasingKind {
        motionTrack?.keyframes.first(where: { $0.time == shotDuration })?
            .easingFromPrevious.kind ?? .linear
    }

    var progress: Double {
        guard shotDuration > .zero else { return 0 }
        return min(1, max(0, currentTime.seconds / shotDuration.seconds))
    }

    /// The explicit endpoint is an inspection position after the half-open
    /// export sample sequence, so its index is samples.count.
    var currentFrameIndex: Int64 {
        guard let samplePlan else { return 0 }
        if currentTime == shotDuration {
            return Int64(samplePlan.samples.count)
        }
        return samplePlan.sample(atOrBeforeLocalTime: currentTime)?.index ?? 0
    }

    var editorFrameCount: Int64 {
        Int64(samplePlan?.samples.count ?? 0) + 1
    }

    var currentTimeLabel: String {
        Self.timeLabel(currentTime)
    }

    var durationLabel: String {
        Self.timeLabel(shotDuration)
    }

    var framePositionLabel: String {
        "Frame \(currentFrameIndex) of \(max(0, editorFrameCount - 1))"
    }

    var isDirty: Bool {
        initialFraming != originalInitialFraming
            || motionTrack != originalMotionTrack
    }

    var canSave: Bool {
        performPhase != .recording
            && validation.severity != .blocking
    }

    var isStatic: Bool {
        guard let motionTrack else { return true }
        return !motionTrack.enabled || motionTrack.keyframes.isEmpty
    }

    var isPerforming: Bool {
        performPhase == .recording
    }

    var requiresPerformReplacementConfirmation: Bool {
        guard let motionTrack else { return false }
        return motionTrack.enabled && !motionTrack.keyframes.isEmpty
    }

    var performKeyframeCount: Int {
        performResult?.track.keyframes.count ?? 0
    }

    var performStatusDetail: String {
        switch performPhase {
        case .ready:
            return "Record one continuous full-shot camera move."
        case .recording:
            return "Pan with one finger, pinch to zoom, and rotate on the canvas."
        case .review:
            guard let performResult else {
                return "Review the performed camera move before saving."
            }
            let keyLabel = performKeyframeCount == 1 ? "key" : "keys"
            return "\(performKeyframeCount) \(keyLabel) from \(performResult.sourceSampleCount) input samples."
        }
    }

}

extension CameraMotionEditorModel {
    func beginPerform(replacingExisting: Bool = false) throws {
        guard performPhase != .recording else {
            throw CameraMotionEditorError.invalidDraft(
                "A camera performance is already recording."
            )
        }
        if requiresPerformReplacementConfirmation && !replacingExisting {
            throw CameraMotionEditorError.performConfirmationRequired
        }

        let initialPose = try CameraPose2D(
            shotFraming: initialFraming
        ).normalized()
        var recorder = try CameraMotionPerformRecorder(
            initialPose: initialPose,
            shotDuration: shotDuration,
            timing: timing
        )
        try recorder.start()

        performSnapshot = PerformSnapshot(
            initialFraming: initialFraming,
            motionTrack: motionTrack,
            currentTime: currentTime,
            selectedEndpoint: selectedEndpoint,
            selectedPreset: selectedPreset,
            performPhase: performPhase,
            performResult: performResult,
            transientMutationError: transientMutationError
        )
        performRecorder = recorder
        performResult = nil
        livePerformFraming = initialFraming.normalized()
        performPhase = .recording
        selectedEndpoint = .start
        currentTime = .zero
        transientMutationError = nil
        validation = CameraMotionEditorValidation(
            severity: .warning,
            title: "Recording camera move",
            detail: "Stop or cancel the take before saving."
        )
    }

    /// Advances only the document clock. A pose is sampled when the operator
    /// manipulates the stage, keeping display refresh frequency out of the
    /// persisted camera path.
    func advancePerformClock(to requestedTime: MediaTime) {
        guard performPhase == .recording else { return }
        setPlaybackTime(requestedTime)
    }

    func recordPerformedFraming(_ framing: ShotFramingState) throws {
        guard performPhase == .recording,
              var recorder = performRecorder else {
            throw CameraMotionEditorError.invalidDraft(
                "Start Perform before moving the camera."
            )
        }
        do {
            let normalized = framing.normalized()
            let pose = try CameraPose2D(
                shotFraming: normalized
            ).normalized()
            try recorder.append(CameraMotionPerformSample(
                time: currentTime,
                pose: pose
            ))
            performRecorder = recorder
            livePerformFraming = normalized
        } catch {
            performRecorder = recorder
            transientMutationError = Self.message(for: error)
            validation = CameraMotionEditorValidation(
                severity: .blocking,
                title: "Camera take interrupted",
                detail: transientMutationError ?? "Cancel this take and try again."
            )
            throw error
        }
    }

    @discardableResult
    func stopPerform() throws -> CameraMotionPerformResult {
        guard performPhase == .recording,
              var recorder = performRecorder else {
            throw CameraMotionEditorError.invalidDraft(
                "No camera performance is recording."
            )
        }
        do {
            let result = try recorder.stop()
            performRecorder = nil
            performResult = result
            livePerformFraming = nil
            motionTrack = result.track
            selectedPreset = .custom
            selectedEndpoint = .end
            currentTime = shotDuration
            performPhase = .review
            transientMutationError = nil
            refreshValidation()
            return result
        } catch {
            performRecorder = recorder
            transientMutationError = Self.message(for: error)
            validation = CameraMotionEditorValidation(
                severity: .blocking,
                title: "Camera take could not be completed",
                detail: transientMutationError ?? "Cancel this take and try again."
            )
            throw error
        }
    }

    /// Both an in-progress take and its review are transactional. Cancelling
    /// restores the exact draft that existed immediately before Perform.
    func cancelPerform() {
        if var recorder = performRecorder {
            recorder.cancel()
        }
        performRecorder = nil
        performResult = nil
        livePerformFraming = nil
        if let snapshot = performSnapshot {
            initialFraming = snapshot.initialFraming
            motionTrack = snapshot.motionTrack
            currentTime = snapshot.currentTime
            selectedEndpoint = snapshot.selectedEndpoint
            selectedPreset = snapshot.selectedPreset
            performPhase = snapshot.performPhase
            performResult = snapshot.performResult
            transientMutationError = snapshot.transientMutationError
        } else {
            performPhase = .ready
        }
        performSnapshot = nil
        refreshValidation()
    }

    func selectEndpoint(_ endpoint: CameraMotionEditorEndpoint) {
        guard performPhase != .recording else { return }
        selectedEndpoint = endpoint
        currentTime = endpoint == .start ? .zero : shotDuration
    }

    func applyPreset(_ preset: CameraMotionEditorPreset) {
        guard performPhase == .ready else { return }
        guard preset != .custom else { return }
        transientMutationError = nil

        if preset == .staticShot {
            motionTrack = nil
            selectedPreset = preset
            selectedEndpoint = .start
            currentTime = .zero
            refreshValidation()
            return
        }

        var start = initialFraming.normalized()
        var end = start
        let panDistance = 0.14 / max(1, sqrt(start.zoom))

        switch preset {
        case .pushIn:
            end.zoom = min(
                ShotFramingState.maximumZoom,
                start.zoom * 1.35
            )
            if end.zoom == start.zoom {
                start.zoom = max(
                    ShotFramingState.minimumZoom,
                    start.zoom / 1.35
                )
            }
        case .pullOut:
            end.zoom = max(
                ShotFramingState.minimumZoom,
                start.zoom / 1.35
            )
            if end.zoom == start.zoom {
                start.zoom = min(
                    ShotFramingState.maximumZoom,
                    start.zoom * 1.35
                )
            }
        case .panLeft:
            end.centerX = max(0, start.centerX - panDistance)
            if end.centerX == start.centerX {
                start.centerX = min(1, start.centerX + panDistance)
            }
        case .panRight:
            end.centerX = min(1, start.centerX + panDistance)
            if end.centerX == start.centerX {
                start.centerX = max(0, start.centerX - panDistance)
            }
        case .tiltUp:
            end.centerY = max(0, start.centerY - panDistance)
            if end.centerY == start.centerY {
                start.centerY = min(1, start.centerY + panDistance)
            }
        case .tiltDown:
            end.centerY = min(1, start.centerY + panDistance)
            if end.centerY == start.centerY {
                start.centerY = max(0, start.centerY - panDistance)
            }
        case .staticShot, .custom:
            return
        }

        start.mode = .manual
        start.normalize()
        end.mode = .manual
        end.normalize()
        initialFraming = start

        do {
            motionTrack = try CameraMotionTrack(
                enabled: true,
                mode: .keyframed,
                presetId: preset.rawValue
            ).upsertingEndPose(
                CameraPose2D(shotFraming: end),
                for: shotDuration,
                easingFromPrevious: CameraMotionEasing(kind: .easeInOut)
            )
            selectedPreset = preset
            selectedEndpoint = .end
            currentTime = shotDuration
        } catch {
            transientMutationError = Self.message(for: error)
        }
        refreshValidation()
    }

    func setSelectedFraming(_ framing: ShotFramingState) {
        setSelectedPose(CameraPose2D(shotFraming: framing))
    }

    func setSelectedPose(_ pose: CameraPose2D) {
        guard performPhase == .ready else { return }
        transientMutationError = nil
        do {
            let pose = try pose.normalized()
            switch selectedEndpoint {
            case .start:
                var framing = try pose.applying(to: initialFraming)
                framing.mode = .manual
                framing.normalize()
                initialFraming = framing
                if var track = motionTrack {
                    track.presetId = nil
                    motionTrack = track
                }
                currentTime = .zero
            case .end:
                var track = motionTrack ?? CameraMotionTrack()
                track.presetId = nil
                motionTrack = try track.upsertingEndPose(
                    pose,
                    for: shotDuration,
                    easingFromPrevious: CameraMotionEasing(
                        kind: selectedEasing
                    )
                )
                currentTime = shotDuration
            }
            selectedPreset = .custom
        } catch {
            transientMutationError = Self.message(for: error)
        }
        refreshValidation()
    }

    func setEasing(_ kind: CameraMotionEasingKind) {
        guard performPhase == .ready else { return }
        guard selectedEndpoint == .end else { return }
        transientMutationError = nil
        do {
            var track = motionTrack ?? CameraMotionTrack()
            track.presetId = nil
            motionTrack = try track.upsertingEndPose(
                selectedPose,
                for: shotDuration,
                easingFromPrevious: CameraMotionEasing(kind: kind)
            )
            selectedPreset = .custom
        } catch {
            transientMutationError = Self.message(for: error)
        }
        refreshValidation()
    }

    func nudgeSelectedPose(
        centerX: Double = 0,
        centerY: Double = 0,
        zoom: Double = 0,
        rollDegrees: Double = 0
    ) {
        guard performPhase == .ready else { return }
        var pose = selectedPose
        pose.centerX += centerX
        pose.centerY += centerY
        pose.zoom += zoom
        pose.rollDegrees += rollDegrees
        setSelectedPose(pose)
    }

    func scrub(toProgress requestedProgress: Double) {
        guard requestedProgress.isFinite,
              let samplePlan,
              shotDuration > .zero else {
            if performPhase != .recording {
                currentTime = .zero
            }
            return
        }
        let progress = min(1, max(0, requestedProgress))
        if progress == 1 {
            currentTime = shotDuration
            return
        }
        guard let durationValue = try? shotDuration.scaledValueExactly(
            to: samplePlan.timelineTimescale
        ) else { return }
        let scaled = (Double(durationValue) * progress).rounded(.down)
        guard scaled.isFinite,
              scaled >= 0,
              scaled <= Double(Int64.max),
              let requested = try? MediaTime(
                value: Int64(scaled),
                timescale: samplePlan.timelineTimescale
              ),
              let sample = samplePlan.sample(
                atOrBeforeLocalTime: requested
              ) else { return }
        if performPhase != .recording
            || sample.localTime >= currentTime {
            currentTime = sample.localTime
        }
    }

    func setPlaybackTime(_ requestedTime: MediaTime) {
        guard let samplePlan else { return }
        let nextTime: MediaTime?
        if requestedTime >= shotDuration {
            nextTime = shotDuration
        } else if let sample = samplePlan.sample(
            atOrBeforeLocalTime: requestedTime
        ) {
            nextTime = sample.localTime
        } else {
            nextTime = nil
        }
        if performPhase == .recording,
           let nextTime, nextTime < currentTime { return }
        if let nextTime, nextTime != currentTime { currentTime = nextTime }
    }

    func stepFrame(by offset: Int) {
        if performPhase == .recording && offset < 0 { return }
        guard offset != 0, let samplePlan, !samplePlan.samples.isEmpty else {
            return
        }
        let endpointIndex = samplePlan.samples.count
        let currentIndex: Int
        if currentTime == shotDuration {
            currentIndex = endpointIndex
        } else {
            currentIndex = Int(
                samplePlan.sample(atOrBeforeLocalTime: currentTime)?.index ?? 0
            )
        }
        let targetIndex = min(
            endpointIndex,
            max(0, currentIndex + offset)
        )
        currentTime = targetIndex == endpointIndex
            ? shotDuration
            : samplePlan.samples[targetIndex].localTime
    }

    func discardChanges() {
        if var recorder = performRecorder {
            recorder.cancel()
        }
        performRecorder = nil
        performResult = nil
        livePerformFraming = nil
        performSnapshot = nil
        performPhase = .ready
        initialFraming = originalInitialFraming
        motionTrack = originalMotionTrack
        selectedPreset = CameraMotionEditorPreset.resolve(
            track: originalMotionTrack
        )
        selectedEndpoint = .end
        currentTime = shotDuration
        transientMutationError = nil
        refreshValidation()
    }

    func commit() throws -> CameraMotionEditorCommit {
        guard performPhase != .recording else {
            throw CameraMotionEditorError.invalidDraft(
                "Stop or cancel the camera take before saving."
            )
        }
        refreshValidation()
        guard validation.severity != .blocking else {
            throw CameraMotionEditorError.invalidDraft(validation.detail)
        }
        let normalizedTrack: CameraMotionTrack?
        if let motionTrack,
           motionTrack.enabled,
           !motionTrack.keyframes.isEmpty {
            normalizedTrack = try motionTrack.normalized(
                for: shotDuration
            )
        } else {
            normalizedTrack = nil
        }
        return CameraMotionEditorCommit(
            initialFraming: initialFraming.normalized(),
            motionTrack: normalizedTrack
        )
    }

    private func refreshValidation() {
        let structural = structuralValidation()
        guard structural.severity != .blocking else {
            validation = structural
            return
        }
        guard let externalValidator else {
            validation = structural
            return
        }
        let external = externalValidator(
            initialFraming,
            motionTrack,
            shotDuration
        )
        validation = external.severity > structural.severity
            ? external
            : structural
    }

    private func structuralValidation() -> CameraMotionEditorValidation {
        if let transientMutationError {
            return CameraMotionEditorValidation(
                severity: .blocking,
                title: "Cannot apply camera edit",
                detail: transientMutationError
            )
        }
        guard samplePlan != nil else {
            return CameraMotionEditorValidation(
                severity: .blocking,
                title: "Invalid project timing",
                detail: "The shot duration is not representable on the project frame grid."
            )
        }
        do {
            try CameraMotionTrack.validate(shotDuration: shotDuration)
            _ = try CameraPose2D(
                shotFraming: initialFraming
            ).normalized()
            let track = try motionTrack?.normalized(for: shotDuration)
            guard let track, track.enabled, !track.keyframes.isEmpty else {
                return CameraMotionEditorValidation(
                    severity: .valid,
                    title: "Static frame",
                    detail: "No camera movement will be rendered."
                )
            }
            let start = try track.startPose(initialFraming: initialFraming)
            let end = try track.endPose(
                initialFraming: initialFraming,
                for: shotDuration
            )
            if start == end, track.keyframes.count == 1 {
                return CameraMotionEditorValidation(
                    severity: .warning,
                    title: "No visible movement",
                    detail: "Start and end are identical. Save is allowed, but the shot will appear static."
                )
            }
            return .ready
        } catch {
            return CameraMotionEditorValidation(
                severity: .blocking,
                title: "Invalid camera move",
                detail: Self.message(for: error)
            )
        }
    }

    private static func timeLabel(_ time: MediaTime) -> String {
        String(format: "%.3f s", locale: Locale.current, time.seconds)
    }

    private static func message(for error: Error) -> String {
        if let error = error as? CameraMotionTrackValidationError {
            return "Camera track validation failed: \(String(describing: error))."
        }
        if let error = error as? CameraPose2DValidationError {
            return "Camera pose validation failed: \(String(describing: error))."
        }
        return error.localizedDescription
    }
}
