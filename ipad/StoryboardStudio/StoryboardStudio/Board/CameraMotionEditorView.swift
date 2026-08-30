import SwiftUI

/// Standalone, transactional fly-through editor. The host supplies the same
/// canvas renderer it uses on the board, parameterized by evaluated framing.
/// This keeps preview pixels authoritative without coupling the editor to
/// NativeBoardView or PencilCanvasView.
struct CameraMotionEditorView<CanvasContent: View>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.scenePhase) private var scenePhase

    @StateObject private var model: CameraMotionEditorModel
    @StateObject private var playback = CameraMotionPlaybackController()
    @State private var interactionBaseline: ShotFramingState?
    @State private var operationError: String?
    @State private var showPerformReplacementConfirmation = false
    @State private var interruptedPerform = false
    @State private var isFinishing = false

    private let shotNumber: String
    private let shotTitle: String?
    private let sourceSize: ShotFramingSize
    private let canvas: (ShotFramingState) -> CanvasContent
    private let onPresentationFramingChanged: (ShotFramingState?) -> Void
    private let onSave: (CameraMotionEditorCommit) -> Void
    private let onCancel: () -> Void

    init(
        shotNumber: String,
        shotTitle: String? = nil,
        sourceSize: ShotFramingSize,
        model: CameraMotionEditorModel,
        @ViewBuilder canvas: @escaping (ShotFramingState) -> CanvasContent,
        onPresentationFramingChanged: @escaping (
            ShotFramingState?
        ) -> Void = { _ in },
        onSave: @escaping (CameraMotionEditorCommit) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.shotNumber = shotNumber
        self.shotTitle = shotTitle
        self.sourceSize = sourceSize
        _model = StateObject(wrappedValue: model)
        self.canvas = canvas
        self.onPresentationFramingChanged = onPresentationFramingChanged
        self.onSave = onSave
        self.onCancel = onCancel
    }

    var body: some View {
        GeometryReader { proxy in
            let isWide = horizontalSizeClass == .regular
                && proxy.size.width >= 900
            VStack(spacing: 0) {
                header
                Divider().overlay(CameraMotionEditorPalette.border)
                if isWide {
                    wideLayout
                } else {
                    compactLayout(availableHeight: proxy.size.height)
                }
            }
            .background(CameraMotionEditorPalette.chrome)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            onPresentationFramingChanged(model.presentationFraming)
        }
        .onChange(of: model.presentationFraming) { _, framing in
            onPresentationFramingChanged(framing)
        }
        .onChange(of: reduceMotion) { _, _ in
            playback.stop()
            if model.isPerforming {
                model.cancelPerform()
                interactionBaseline = nil
                operationError =
                    "The camera take was cancelled because Reduce Motion changed. Your previous draft was restored."
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                playback.stop()
                if model.isPerforming {
                    model.cancelPerform()
                    interactionBaseline = nil
                    interruptedPerform = true
                }
            } else if interruptedPerform {
                interruptedPerform = false
                operationError =
                    "The camera take was cancelled when Storyboard Room became inactive. Your previous draft was restored."
            }
        }
        .onDisappear {
            playback.stop()
            if model.isPerforming { model.cancelPerform() }
            onPresentationFramingChanged(nil)
        }
        .alert(
            "Camera move needs attention",
            isPresented: Binding(
                get: { operationError != nil },
                set: { if !$0 { operationError = nil } }
            )
        ) {
            Button("OK", role: .cancel) { operationError = nil }
        } message: {
            Text(operationError ?? "Please review the camera move.")
        }
        .alert(
            "Replace camera move?",
            isPresented: $showPerformReplacementConfirmation
        ) {
            Button("Keep current", role: .cancel) {}
            Button("Replace and record", role: .destructive) {
                startPerform(replacingExisting: true)
            }
        } message: {
            Text(
                "Perform records the full shot and replaces every current camera key. Cancel Take restores this draft exactly."
            )
        }
    }

}

private extension CameraMotionEditorView {
    private var header: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 14) {
                headerCancelButton
                headerTitle(lineLimit: 1)
                    .fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: 8)
                validationBadge
                    .fixedSize(horizontal: true, vertical: false)
                headerSaveButton
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    headerCancelButton
                    Spacer(minLength: 8)
                    headerSaveButton
                }
                headerTitle(lineLimit: 2)
                validationBadge
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: 64)
        .background(CameraMotionEditorPalette.panel)
    }

    private var headerCancelButton: some View {
        Button("Cancel") {
            playback.stop()
            guard !isFinishing else { return }
            isFinishing = true
            model.discardChanges()
            onCancel()
        }
        .buttonStyle(CameraMotionHeaderButtonStyle())
        .disabled(isFinishing)
        .keyboardShortcut(.escape, modifiers: [])
        .accessibilityIdentifier("camera-motion.cancel")
        .fixedSize(horizontal: true, vertical: false)
    }

    private var headerSaveButton: some View {
        Button("Save") { save() }
            .buttonStyle(CameraMotionPrimaryButtonStyle())
            .disabled(!model.canSave || isFinishing)
            .keyboardShortcut("s", modifiers: .command)
            .accessibilityIdentifier("camera-motion.save")
            .accessibilityHint(
                model.canSave
                    ? "Commits the camera move to this shot"
                    : model.validation.detail
            )
            .fixedSize(horizontal: true, vertical: false)
    }

    private func headerTitle(lineLimit: Int) -> some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text("CAMERA MOVE · SHOT \(shotNumber)")
                    .font(.caption.weight(.bold))
                    .tracking(0.9)
                    .foregroundStyle(CameraMotionEditorPalette.label)
                Text(shotTitle?.isEmpty == false ? shotTitle! : "Fly-through")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(lineLimit)
            }
        }
    }

    private var validationBadge: some View {
        Label(
            model.validation.severity.shortLabel,
            systemImage: model.validation.severity.systemImage
        )
        .font(.caption.weight(.semibold))
        .foregroundStyle(model.validation.severity.color)
        .padding(.horizontal, 10)
        .frame(minHeight: 34)
        .background(
            model.validation.severity.color.opacity(0.12),
            in: Capsule()
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Camera move status: \(model.validation.title). \(model.validation.detail)"
        )
        .accessibilityIdentifier("camera-motion.validation-badge")
    }

    private var wideLayout: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                stage
                    .padding(24)
                Divider().overlay(CameraMotionEditorPalette.border)
                transport
                    .padding(.horizontal, 22)
                    .padding(.vertical, 14)
            }
            Divider().overlay(CameraMotionEditorPalette.border)
            ScrollView {
                controls
                    .padding(18)
            }
            .frame(width: 374)
            .background(CameraMotionEditorPalette.panel)
            .accessibilityIdentifier("camera-motion.inspector")
        }
    }

    private func compactLayout(availableHeight: CGFloat) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                stage
                    .frame(
                        minHeight: 260,
                        idealHeight: max(280, availableHeight * 0.42),
                        maxHeight: 480
                    )
                    .padding(16)
                Divider().overlay(CameraMotionEditorPalette.border)
                transport
                    .padding(16)
                Divider().overlay(CameraMotionEditorPalette.border)
                controls
                    .padding(16)
            }
        }
    }

    private var stage: some View {
        GeometryReader { proxy in
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(CameraMotionEditorPalette.workspace)

                canvas(model.presentationFraming)
                    .allowsHitTesting(false)
                    .aspectRatio(
                        CGFloat(model.initialFraming.aspectRatio),
                        contentMode: .fit
                    )
                    .clipShape(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                    )
                    .overlay { cameraGuides }
                    .padding(20)

                VStack {
                    HStack {
                        endpointReadout
                        Spacer()
                        Text(model.currentTimeLabel)
                            .font(.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 9)
                            .frame(minHeight: 30)
                            .background(.black.opacity(0.62), in: Capsule())
                    }
                    Spacer()
                    Text(stageInstruction)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 9)
                        .frame(minHeight: 28)
                        .background(.black.opacity(0.58), in: Capsule())
                }
                .padding(12)
                .allowsHitTesting(false)
            }
            .contentShape(Rectangle())
            .gesture(transformGesture(viewportSize: proxy.size))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(CameraMotionEditorPalette.border, lineWidth: 1)
                    .allowsHitTesting(false)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Camera preview")
            .accessibilityValue(stageAccessibilityValue)
            .accessibilityHint(stageAccessibilityHint)
            .accessibilityIdentifier("camera-motion.stage")
        }
        .frame(minHeight: 260)
    }

    private var endpointReadout: some View {
        Label(
            stageReadout,
            systemImage: model.isPerforming
                ? "record.circle.fill"
                : (model.performPhase == .review
                    ? "checkmark.circle.fill"
                    : (model.selectedEndpoint == .start
                        ? "circle.fill"
                        : "diamond.fill"))
        )
        .font(.caption.weight(.semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, 9)
        .frame(minHeight: 30)
        .background(
            CameraMotionEditorPalette.accent.opacity(0.9),
            in: Capsule()
        )
    }

    private var stageReadout: String {
        switch model.performPhase {
        case .ready: "Editing \(model.selectedEndpoint.label)"
        case .recording: "Recording"
        case .review: "Review take"
        }
    }

    private var stageInstruction: String {
        model.isPerforming
            ? "Perform · one-finger pan · pinch · rotate"
            : "Drag · Pinch · Rotate"
    }

    private var stageAccessibilityValue: String {
        "\(model.performPhase.label), \(model.framePositionLabel)"
    }

    private var stageAccessibilityHint: String {
        model.isPerforming
            ? "Use the accessible position, zoom, and roll controls to record precise camera changes"
            : "Use the transform controls below for precise accessible editing"
    }

    private var cameraGuides: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let height = proxy.size.height
            Path { path in
                path.move(to: CGPoint(x: width / 3, y: 0))
                path.addLine(to: CGPoint(x: width / 3, y: height))
                path.move(to: CGPoint(x: width * 2 / 3, y: 0))
                path.addLine(to: CGPoint(x: width * 2 / 3, y: height))
                path.move(to: CGPoint(x: 0, y: height / 3))
                path.addLine(to: CGPoint(x: width, y: height / 3))
                path.move(to: CGPoint(x: 0, y: height * 2 / 3))
                path.addLine(to: CGPoint(x: width, y: height * 2 / 3))
            }
            .stroke(.white.opacity(0.17), lineWidth: 0.75)

            RoundedRectangle(cornerRadius: 2)
                .stroke(
                    .white.opacity(0.28),
                    style: StrokeStyle(lineWidth: 0.75, dash: [5, 5])
                )
                .padding(min(width, height) * 0.05)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

}

private extension CameraMotionEditorView {
    private var transport: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                transportButton(
                    systemImage: "backward.frame.fill",
                    label: "Previous frame"
                ) {
                    playback.stop()
                    model.stepFrame(by: -1)
                }
                .keyboardShortcut(.leftArrow, modifiers: [])
                .accessibilityIdentifier("camera-motion.previous-frame")
                .disabled(model.isPerforming)

                transportButton(
                    systemImage: previewButtonSystemImage,
                    label: previewButtonLabel,
                    prominent: true
                ) {
                    togglePreview()
                }
                .keyboardShortcut(.space, modifiers: [])
                .accessibilityIdentifier("camera-motion.play-pause")
                .disabled(model.isPerforming)

                transportButton(
                    systemImage: "forward.frame.fill",
                    label: "Next frame"
                ) {
                    playback.stop()
                    model.stepFrame(by: 1)
                }
                .keyboardShortcut(.rightArrow, modifiers: [])
                .accessibilityIdentifier("camera-motion.next-frame")
                .disabled(model.isPerforming && !reduceMotion)

                Button("S") {
                    playback.stop()
                    model.selectEndpoint(.start)
                }
                .buttonStyle(CameraMotionMarkerButtonStyle(
                    selected: model.currentTime == .zero
                ))
                .accessibilityLabel("Go to start pose")
                .accessibilityIdentifier("camera-motion.goto-start")
                .disabled(model.isPerforming)

                Button("E") {
                    playback.stop()
                    model.selectEndpoint(.end)
                }
                .buttonStyle(CameraMotionMarkerButtonStyle(
                    selected: model.currentTime == model.shotDuration
                ))
                .accessibilityLabel("Go to end pose")
                .accessibilityIdentifier("camera-motion.goto-end")
                .disabled(model.isPerforming)

                Spacer(minLength: 4)

                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(model.currentTimeLabel) / \(model.durationLabel)")
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.white)
                    Text(model.framePositionLabel)
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(CameraMotionEditorPalette.dim)
                }
                .accessibilityElement(children: .combine)
            }

            Slider(
                value: Binding(
                    get: { model.progress },
                    set: { model.scrub(toProgress: $0) }
                ),
                in: 0...1,
                onEditingChanged: { editing in
                    if editing { playback.stop() }
                }
            )
            .tint(CameraMotionEditorPalette.accent)
            .frame(minHeight: 44)
            .disabled(model.isPerforming && !reduceMotion)
            .accessibilityLabel("Camera timeline")
            .accessibilityValue(
                "\(model.currentTimeLabel), \(model.framePositionLabel)"
            )
            .accessibilityAdjustableAction { direction in
                playback.stop()
                model.stepFrame(by: direction == .increment ? 1 : -1)
            }
            .accessibilityIdentifier("camera-motion.scrubber")

            if model.performPhase == .review {
                CameraMotionReviewMarkerStrip(
                    keyframes: model.motionTrack?.keyframes ?? [],
                    shotDuration: model.shotDuration
                )
                .accessibilityIdentifier(
                    "camera-motion.perform-markers"
                )
            }

            if reduceMotion {
                Label(
                    reduceMotionNote,
                    systemImage: "figure.walk.motion"
                )
                .font(.caption)
                .foregroundStyle(CameraMotionEditorPalette.dim)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("camera-motion.reduce-motion-note")
            }
        }
    }

    private var reduceMotionNote: String {
        if model.isPerforming {
            return "Reduce Motion is on. Advance with Next Frame or the timeline, then transform the camera."
        }
        return "Reduce Motion is on. Preview switches between exact endpoints without continuous movement."
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 22) {
            performControls

            controlSection("PRESET") {
                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 104), spacing: 8)],
                    spacing: 8
                ) {
                    ForEach(CameraMotionEditorPreset.allCases.filter {
                        $0 != .custom
                    }) { preset in
                        Button {
                            playback.stop()
                            model.applyPreset(preset)
                        } label: {
                            VStack(spacing: 5) {
                                Image(systemName: preset.systemImage)
                                    .font(.body.weight(.semibold))
                                Text(preset.label)
                                    .font(.caption.weight(.semibold))
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, minHeight: 52)
                        }
                        .buttonStyle(CameraMotionPresetButtonStyle(
                            selected: model.selectedPreset == preset
                        ))
                        .accessibilityLabel("Camera preset: \(preset.label)")
                        .accessibilityAddTraits(
                            model.selectedPreset == preset ? .isSelected : []
                        )
                        .accessibilityIdentifier(
                            "camera-motion.preset.\(preset.rawValue)"
                        )
                        .disabled(model.performPhase != .ready)
                    }
                }
            }

            controlSection("EDIT POSE") {
                HStack(spacing: 6) {
                    ForEach(CameraMotionEditorEndpoint.allCases) { endpoint in
                        Button {
                            playback.stop()
                            model.selectEndpoint(endpoint)
                        } label: {
                            Label(
                                endpoint.label,
                                systemImage: endpoint == .start
                                    ? "circle.fill"
                                    : "diamond.fill"
                            )
                            .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(CameraMotionSegmentButtonStyle(
                            selected: model.selectedEndpoint == endpoint
                        ))
                        .accessibilityAddTraits(
                            model.selectedEndpoint == endpoint
                                ? .isSelected
                                : []
                        )
                        .accessibilityIdentifier(
                            "camera-motion.endpoint.\(endpoint.rawValue)"
                        )
                        .disabled(model.performPhase != .ready)
                    }
                }

                CameraMotionValueControl(
                    title: "Horizontal center",
                    value: poseBinding(\.centerX),
                    range: 0...1,
                    step: 0.005,
                    format: { String(format: "%.3f", $0) },
                    decrement: { nudgeEditablePose(centerX: -0.01) },
                    increment: { nudgeEditablePose(centerX: 0.01) },
                    identifier: "camera-motion.center-x"
                )
                .disabled(model.performPhase == .review)
                CameraMotionValueControl(
                    title: "Vertical center",
                    value: poseBinding(\.centerY),
                    range: 0...1,
                    step: 0.005,
                    format: { String(format: "%.3f", $0) },
                    decrement: { nudgeEditablePose(centerY: -0.01) },
                    increment: { nudgeEditablePose(centerY: 0.01) },
                    identifier: "camera-motion.center-y"
                )
                .disabled(model.performPhase == .review)
                CameraMotionValueControl(
                    title: "Zoom",
                    value: poseBinding(\.zoom),
                    range: (
                        ShotFramingState.minimumZoom...ShotFramingState.maximumZoom
                    ),
                    step: 0.01,
                    format: { String(format: "%.2f×", $0) },
                    decrement: { nudgeEditablePose(zoom: -0.05) },
                    increment: { nudgeEditablePose(zoom: 0.05) },
                    identifier: "camera-motion.zoom"
                )
                .disabled(model.performPhase == .review)
                CameraMotionValueControl(
                    title: "Roll",
                    value: poseBinding(\.rollDegrees),
                    range: -180...180,
                    step: 0.5,
                    format: { String(format: "%.1f°", $0) },
                    decrement: {
                        nudgeEditablePose(rollDegrees: -0.5)
                    },
                    increment: {
                        nudgeEditablePose(rollDegrees: 0.5)
                    },
                    identifier: "camera-motion.roll"
                )
                .disabled(model.performPhase == .review)
            }

            controlSection("TIMING") {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Easing into End")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.white)
                        Text("Applied to the final segment")
                            .font(.caption)
                            .foregroundStyle(CameraMotionEditorPalette.dim)
                    }
                    Spacer()
                    Picker("Easing", selection: Binding(
                        get: { model.selectedEasing },
                        set: {
                            playback.stop()
                            model.setEasing($0)
                        }
                    )) {
                        ForEach(CameraMotionEasingKind.allCases, id: \.self) {
                            Text($0.editorLabel).tag($0)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.white)
                    .disabled(model.selectedEndpoint != .end)
                    .disabled(model.performPhase != .ready)
                    .accessibilityIdentifier("camera-motion.easing")
                }
                .frame(minHeight: 44)
            }

            validationCard

            Button {
                playback.stop()
                model.discardChanges()
            } label: {
                Label("Reset draft", systemImage: "arrow.counterclockwise")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(CameraMotionSecondaryButtonStyle())
            .disabled(!model.isDirty || model.performPhase != .ready)
            .accessibilityIdentifier("camera-motion.reset")
        }
    }

    private var performControls: some View {
        controlSection("PERFORM") {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: performStatusSystemImage)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(performStatusColor)
                        .frame(width: 28, height: 28)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(model.performPhase.label)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                        Text(model.performStatusDetail)
                            .font(.caption)
                            .foregroundStyle(CameraMotionEditorPalette.dim)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel(
                    "Perform status: \(model.performPhase.label). \(model.performStatusDetail)"
                )
                .accessibilityIdentifier("camera-motion.perform-state")

                switch model.performPhase {
                case .ready:
                    Button {
                        requestPerform()
                    } label: {
                        Label(
                            "Perform camera move",
                            systemImage: "record.circle"
                        )
                        .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(CameraMotionPrimaryButtonStyle())
                    .accessibilityHint(
                        "Records a full-shot move from the current Start pose"
                    )
                    .accessibilityIdentifier("camera-motion.perform")

                case .recording:
                    HStack(spacing: 8) {
                        Button {
                            finishPerform()
                        } label: {
                            Label("Stop", systemImage: "stop.fill")
                                .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(CameraMotionRecordButtonStyle())
                        .accessibilityLabel("Stop camera recording")
                        .accessibilityIdentifier("camera-motion.perform-stop")

                        Button {
                            cancelPerform()
                        } label: {
                            Label("Cancel Take", systemImage: "xmark")
                                .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(CameraMotionSecondaryButtonStyle())
                        .accessibilityHint(
                            "Restores the exact camera draft from before Perform"
                        )
                        .accessibilityIdentifier("camera-motion.perform-cancel")
                    }

                case .review:
                    VStack(alignment: .leading, spacing: 8) {
                        Text(model.performStatusDetail)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(CameraMotionEditorPalette.dim)
                            .accessibilityIdentifier(
                                "camera-motion.perform-key-count"
                            )
                        HStack(spacing: 8) {
                            Button {
                                startPerform(replacingExisting: true)
                            } label: {
                                Label(
                                    "Record again",
                                    systemImage: "arrow.clockwise"
                                )
                                .frame(maxWidth: .infinity, minHeight: 44)
                            }
                            .buttonStyle(CameraMotionSecondaryButtonStyle())
                            .accessibilityIdentifier(
                                "camera-motion.perform-retake"
                            )

                            Button {
                                cancelPerform()
                            } label: {
                                Label("Cancel Take", systemImage: "xmark")
                                    .frame(maxWidth: .infinity, minHeight: 44)
                            }
                            .buttonStyle(CameraMotionSecondaryButtonStyle())
                            .accessibilityHint(
                                "Restores the exact camera draft from before Perform"
                            )
                            .accessibilityIdentifier(
                                "camera-motion.perform-cancel"
                            )
                        }
                    }
                    .accessibilityElement(children: .contain)
                    .accessibilityIdentifier("camera-motion.perform-review")
                }
            }
            .padding(14)
            .background(
                performStatusColor.opacity(0.09),
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(performStatusColor.opacity(0.28), lineWidth: 1)
            }
        }
    }

    private var performStatusSystemImage: String {
        switch model.performPhase {
        case .ready: "video.badge.plus"
        case .recording: "record.circle.fill"
        case .review: "checkmark.circle.fill"
        }
    }

    private var performStatusColor: Color {
        switch model.performPhase {
        case .ready: CameraMotionEditorPalette.accent
        case .recording: CameraMotionEditorPalette.recording
        case .review: Color(red: 0.34, green: 0.82, blue: 0.59)
        }
    }

    private var validationCard: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: model.validation.severity.systemImage)
                .font(.title3.weight(.semibold))
                .foregroundStyle(model.validation.severity.color)
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 4) {
                Text(model.validation.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text(model.validation.detail)
                    .font(.caption)
                    .foregroundStyle(CameraMotionEditorPalette.dim)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            model.validation.severity.color.opacity(0.09),
            in: RoundedRectangle(cornerRadius: 12, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(
                    model.validation.severity.color.opacity(0.28),
                    lineWidth: 1
                )
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("camera-motion.validation-card")
    }

    @ViewBuilder
    private func controlSection<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.caption2.weight(.bold))
                .tracking(1.1)
                .foregroundStyle(CameraMotionEditorPalette.label)
            content()
        }
    }

}

private extension CameraMotionEditorView {
    private func poseBinding(
        _ keyPath: WritableKeyPath<CameraPose2D, Double>
    ) -> Binding<Double> {
        Binding(
            get: { editablePose[keyPath: keyPath] },
            set: { newValue in
                var pose = editablePose
                pose[keyPath: keyPath] = newValue
                applyEditablePose(pose)
            }
        )
    }

    private var editablePose: CameraPose2D {
        model.isPerforming
            ? CameraPose2D(shotFraming: model.presentationFraming)
            : model.selectedPose
    }

    private func nudgeEditablePose(
        centerX: Double = 0,
        centerY: Double = 0,
        zoom: Double = 0,
        rollDegrees: Double = 0
    ) {
        var pose = editablePose
        pose.centerX += centerX
        pose.centerY += centerY
        pose.zoom += zoom
        pose.rollDegrees += rollDegrees
        applyEditablePose(pose)
    }

    private func applyEditablePose(_ pose: CameraPose2D) {
        if model.isPerforming {
            do {
                let framing = try pose.applying(to: model.initialFraming)
                try model.recordPerformedFraming(framing)
            } catch {
                operationError = error.localizedDescription
            }
            return
        }
        playback.stop()
        model.setSelectedPose(pose)
    }

    private func transformGesture(
        viewportSize: CGSize
    ) -> some Gesture {
        SimultaneousGesture(
            SimultaneousGesture(
                DragGesture(minimumDistance: 0),
                MagnificationGesture()
            ),
            RotationGesture()
        )
        .onChanged { value in
            if !model.isPerforming { playback.stop() }
            let baseline = interactionBaseline
                ?? (model.isPerforming
                    ? model.presentationFraming
                    : model.selectedFraming)
            if interactionBaseline == nil { interactionBaseline = baseline }
            let translation = value.first?.first?.translation ?? .zero
            let magnification = Double(value.first?.second ?? 1)
            let rotationDegrees = value.second?.degrees ?? 0
            let validSource = sourceSize.isValid
                ? sourceSize
                : ShotFramingSize(width: 1920, height: 1080)
            let fittedViewport = fittedCanvasSize(
                in: viewportSize,
                aspectRatio: model.initialFraming.aspectRatio
            )
            let viewport = ShotFramingSize(
                width: max(1, Double(fittedViewport.width)),
                height: max(1, Double(fittedViewport.height))
            )
            let edited = ShotFramingInteraction.state(
                baseline: baseline,
                panTranslation: ShotFramingSize(
                    width: Double(translation.width),
                    height: Double(translation.height)
                ),
                magnification: magnification,
                rotationDegrees: rotationDegrees,
                sourceSize: validSource,
                viewportSize: viewport
            )
            if model.isPerforming {
                do {
                    try model.recordPerformedFraming(edited)
                } catch {
                    operationError = error.localizedDescription
                }
            } else {
                model.setSelectedFraming(edited)
            }
        }
        .onEnded { _ in
            interactionBaseline = nil
        }
    }

    private func fittedCanvasSize(
        in containerSize: CGSize,
        aspectRatio: Double
    ) -> CGSize {
        let available = CGSize(
            width: max(1, containerSize.width - 40),
            height: max(1, containerSize.height - 40)
        )
        let aspect = aspectRatio.isFinite && aspectRatio > 0
            ? CGFloat(aspectRatio)
            : CGFloat(ShotFramingState.defaultAspectRatio)
        if available.width / available.height > aspect {
            return CGSize(
                width: available.height * aspect,
                height: available.height
            )
        }
        return CGSize(width: available.width, height: available.width / aspect)
    }

    private func transportButton(
        systemImage: String,
        label: String,
        prominent: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .frame(width: 44, height: 44)
        }
        .buttonStyle(CameraMotionTransportButtonStyle(
            prominent: prominent
        ))
        .accessibilityLabel(label)
    }

    private var previewButtonSystemImage: String {
        if reduceMotion {
            return model.currentTime == model.shotDuration
                ? "backward.end.fill"
                : "forward.end.fill"
        }
        return playback.isPlaying ? "pause.fill" : "play.fill"
    }

    private var previewButtonLabel: String {
        if reduceMotion {
            return model.currentTime == model.shotDuration
                ? "Show start pose"
                : "Show end pose"
        }
        return playback.isPlaying ? "Pause preview" : "Play preview"
    }

    private func requestPerform() {
        playback.stop()
        if model.requiresPerformReplacementConfirmation {
            showPerformReplacementConfirmation = true
        } else {
            startPerform(replacingExisting: false)
        }
    }

    private func startPerform(replacingExisting: Bool) {
        playback.stop()
        interactionBaseline = nil
        do {
            try model.beginPerform(
                replacingExisting: replacingExisting
            )
            guard !reduceMotion else { return }
            playback.play(
                from: .zero,
                through: model.shotDuration,
                timelineTimescale: model.timing.timelineTimescale,
                onTick: { time in
                    model.advancePerformClock(to: time)
                },
                onCompletion: {
                    finishPerform()
                }
            )
        } catch {
            operationError = error.localizedDescription
        }
    }

    private func finishPerform() {
        playback.stop()
        interactionBaseline = nil
        do {
            try model.stopPerform()
        } catch {
            operationError = error.localizedDescription
        }
    }

    private func cancelPerform() {
        playback.stop()
        interactionBaseline = nil
        model.cancelPerform()
    }

    private func togglePreview() {
        guard !model.isPerforming else { return }
        if reduceMotion {
            playback.stop()
            model.setPlaybackTime(
                model.currentTime == model.shotDuration
                    ? .zero
                    : model.shotDuration
            )
            return
        }
        if playback.isPlaying {
            playback.stop()
            return
        }
        let start = model.currentTime >= model.shotDuration
            ? MediaTime.zero
            : model.currentTime
        playback.play(
            from: start,
            through: model.shotDuration,
            timelineTimescale: model.timing.timelineTimescale,
            onTick: { time in model.setPlaybackTime(time) }
        )
    }

    private func save() {
        guard !isFinishing else { return }
        playback.stop()
        do {
            let commit = try model.commit()
            isFinishing = true
            onSave(commit)
        } catch {
            operationError = error.localizedDescription
        }
    }
}

private struct CameraMotionReviewMarkerStrip: View {
    let keyframes: [CameraMotionKeyframe]
    let shotDuration: MediaTime

    var body: some View {
        VStack(spacing: 3) {
            GeometryReader { proxy in
                let width = max(1, proxy.size.width)
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.16))
                        .frame(height: 2)
                        .position(x: width / 2, y: 9)

                    Circle()
                        .fill(CameraMotionEditorPalette.accent)
                        .frame(width: 8, height: 8)
                        .position(x: 4, y: 9)

                    ForEach(keyframes) { keyframe in
                        Capsule()
                            .fill(Color.white.opacity(0.82))
                            .frame(width: 2, height: 14)
                            .position(
                                x: markerX(
                                    for: keyframe.time,
                                    width: width
                                ),
                                y: 9
                            )
                    }

                    Image(systemName: "diamond.fill")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(CameraMotionEditorPalette.accent)
                        .position(x: width - 5, y: 9)
                }
            }
            .frame(height: 18)

            HStack {
                Text("Start")
                Spacer()
                Text("End")
            }
            .font(.caption2.weight(.semibold))
            .foregroundStyle(CameraMotionEditorPalette.dim)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Performed camera timeline")
        .accessibilityValue(
            "Start, \(keyframes.count) generated camera keys, End"
        )
    }

    private func markerX(for time: MediaTime, width: CGFloat) -> CGFloat {
        guard shotDuration > .zero else { return 4 }
        let progress = min(
            1,
            max(0, time.seconds / shotDuration.seconds)
        )
        return min(width - 4, max(4, width * CGFloat(progress)))
    }
}

private struct CameraMotionValueControl: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let format: (Double) -> String
    let decrement: () -> Void
    let increment: () -> Void
    let identifier: String

    var body: some View {
        VStack(spacing: 5) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white)
                Spacer()
                Text(format(value))
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(CameraMotionEditorPalette.dim)
            }
            HStack(spacing: 8) {
                Button(action: decrement) {
                    Image(systemName: "minus")
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.white)
                .accessibilityLabel("Decrease \(title)")
                Slider(value: $value, in: range, step: step)
                    .tint(CameraMotionEditorPalette.accent)
                    .frame(minHeight: 44)
                    .accessibilityLabel(title)
                    .accessibilityValue(format(value))
                    .accessibilityIdentifier(identifier)
                Button(action: increment) {
                    Image(systemName: "plus")
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.white)
                .accessibilityLabel("Increase \(title)")
            }
        }
    }
}

private enum CameraMotionEditorPalette {
    static let accent = Color(red: 0.545, green: 0.361, blue: 0.965)
    static let recording = Color(red: 0.95, green: 0.25, blue: 0.30)
    static let chrome = Color(red: 0.043, green: 0.043, blue: 0.055)
    static let panel = Color(red: 0.078, green: 0.082, blue: 0.098)
    static let workspace = Color(red: 0.16, green: 0.17, blue: 0.19)
    static let border = Color.white.opacity(0.10)
    static let dim = Color.white.opacity(0.64)
    static let label = Color.white.opacity(0.52)
}

private extension CameraMotionEditorValidationSeverity {
    var shortLabel: String {
        switch self {
        case .valid: "Ready"
        case .warning: "Review"
        case .blocking: "Blocked"
        }
    }

    var systemImage: String {
        switch self {
        case .valid: "checkmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        case .blocking: "xmark.octagon.fill"
        }
    }

    var color: Color {
        switch self {
        case .valid: Color(red: 0.34, green: 0.82, blue: 0.59)
        case .warning: Color(red: 0.95, green: 0.70, blue: 0.28)
        case .blocking: Color(red: 0.97, green: 0.38, blue: 0.42)
        }
    }
}

private extension CameraMotionEasingKind {
    var editorLabel: String {
        switch self {
        case .linear: "Linear"
        case .easeIn: "Ease in"
        case .easeOut: "Ease out"
        case .easeInOut: "Ease in/out"
        case .hold: "Hold, then cut"
        }
    }
}

private struct CameraMotionHeaderButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .background(
                Color.white.opacity(configuration.isPressed ? 0.12 : 0.06),
                in: RoundedRectangle(cornerRadius: 10)
            )
    }
}

private struct CameraMotionPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.white.opacity(isEnabled ? 1 : 0.48))
            .padding(.horizontal, 18)
            .frame(minHeight: 44)
            .background(
                CameraMotionEditorPalette.accent.opacity(
                    isEnabled ? (configuration.isPressed ? 0.75 : 1) : 0.3
                ),
                in: RoundedRectangle(cornerRadius: 10)
            )
    }
}

private struct CameraMotionRecordButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.white.opacity(isEnabled ? 1 : 0.48))
            .background(
                CameraMotionEditorPalette.recording.opacity(
                    isEnabled
                        ? (configuration.isPressed ? 0.72 : 1)
                        : 0.3
                ),
                in: RoundedRectangle(cornerRadius: 10)
            )
    }
}

private struct CameraMotionSecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white.opacity(isEnabled ? 1 : 0.4))
            .background(
                Color.white.opacity(configuration.isPressed ? 0.12 : 0.06),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 10)
                    .stroke(CameraMotionEditorPalette.border, lineWidth: 1)
            }
    }
}

private struct CameraMotionPresetButtonStyle: ButtonStyle {
    var selected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(selected ? .white : CameraMotionEditorPalette.dim)
            .background(
                selected
                    ? CameraMotionEditorPalette.accent.opacity(0.24)
                    : Color.white.opacity(configuration.isPressed ? 0.09 : 0.04),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 10)
                    .stroke(
                        selected
                            ? CameraMotionEditorPalette.accent
                            : CameraMotionEditorPalette.border,
                        lineWidth: selected ? 1.5 : 1
                    )
            }
    }
}

private struct CameraMotionSegmentButtonStyle: ButtonStyle {
    var selected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(selected ? .white : CameraMotionEditorPalette.dim)
            .background(
                selected
                    ? CameraMotionEditorPalette.accent
                    : Color.white.opacity(configuration.isPressed ? 0.10 : 0.05),
                in: RoundedRectangle(cornerRadius: 9)
            )
    }
}

private struct CameraMotionTransportButtonStyle: ButtonStyle {
    var prominent: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(.white)
            .background(
                prominent
                    ? CameraMotionEditorPalette.accent.opacity(
                        configuration.isPressed ? 0.72 : 1
                    )
                    : Color.white.opacity(configuration.isPressed ? 0.13 : 0.06),
                in: Circle()
            )
    }
}

private struct CameraMotionMarkerButtonStyle: ButtonStyle {
    var selected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.caption.weight(.heavy))
            .foregroundStyle(selected ? .white : CameraMotionEditorPalette.dim)
            .frame(width: 44, height: 44)
            .background(
                selected
                    ? CameraMotionEditorPalette.accent.opacity(0.75)
                    : Color.white.opacity(configuration.isPressed ? 0.12 : 0.05),
                in: RoundedRectangle(cornerRadius: 9)
            )
    }
}
