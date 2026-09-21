@preconcurrency import AVFoundation
import Foundation
import Observation
import SwiftUI
import UIKit

struct CapturedVideoRecording: Sendable {
    let fileURL: URL
    let recordedAt: Date
    let durationMs: Int64
    let frameRate: Double?
    let width: Int?
    let height: Int?
    let timecodeStart: String?
    let sourceType: VideoCaptureAsset.SourceType
    let cameraName: String

    static func recordingsDirectory() throws -> URL {
        let root = try FileManager.default
            .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("CreatorHubVideo/Recordings", isDirectory: true)
        try FileManager.default.createDirectory(
            at: root,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableRoot = root
        try? mutableRoot.setResourceValues(values)
        return root
    }

    static func inspect(
        fileURL: URL,
        recordedAt: Date,
        fallbackDurationMs: Int64,
        sourceType: VideoCaptureAsset.SourceType,
        cameraName: String
    ) async -> Self {
        let media = AVURLAsset(url: fileURL)
        let duration = (try? await media.load(.duration)).map { CMTimeGetSeconds($0) }
        let track = try? await media.loadTracks(withMediaType: .video).first
        let size = try? await track?.load(.naturalSize)
        let frameRate = try? await track?.load(.nominalFrameRate)
        let timecodeStart = await readSourceTimecode(from: media)
        let measuredDurationMs = duration.flatMap { value in
            value.isFinite && value > 0 ? Int64(value * 1000) : nil
        }
        return Self(
            fileURL: fileURL,
            recordedAt: recordedAt,
            durationMs: measuredDurationMs ?? fallbackDurationMs,
            frameRate: frameRate.map(Double.init),
            width: size.map { Int(abs($0.width)) },
            height: size.map { Int(abs($0.height)) },
            timecodeStart: timecodeStart,
            sourceType: sourceType,
            cameraName: cameraName
        )
    }

    /// Reads the first QuickTime/SMPTE timecode sample when the camera wrote
    /// a real `tmcd`/`tc64` track. Files without a timecode track remain nil;
    /// CreatorHub never invents a source timecode from file creation time.
    private static func readSourceTimecode(from asset: AVURLAsset) async -> String? {
        guard let track = try? await asset.loadTracks(withMediaType: .timecode).first,
              let reader = try? AVAssetReader(asset: asset)
        else { return nil }
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
        guard reader.canAdd(output) else { return nil }
        reader.add(output)
        guard reader.startReading(),
              let sample = output.copyNextSampleBuffer(),
              let format = CMSampleBufferGetFormatDescription(sample),
              let block = CMSampleBufferGetDataBuffer(sample)
        else { return nil }

        let length = CMBlockBufferGetDataLength(block)
        guard length >= 4 else { return nil }
        var bytes = [UInt8](repeating: 0, count: min(length, 8))
        let copyStatus = bytes.withUnsafeMutableBytes { buffer in
            CMBlockBufferCopyDataBytes(
                block,
                atOffset: 0,
                dataLength: buffer.count,
                destination: buffer.baseAddress!
            )
        }
        guard copyStatus == kCMBlockBufferNoErr else { return nil }

        let subtype = CMFormatDescriptionGetMediaSubType(format)
        let frameNumber: Int64
        if subtype == kCMTimeCodeFormatType_TimeCode64, bytes.count >= 8 {
            let bits = bytes.reduce(UInt64(0)) { ($0 << 8) | UInt64($1) }
            frameNumber = Int64(bitPattern: bits)
        } else {
            let bits = bytes.prefix(4).reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
            frameNumber = Int64(Int32(bitPattern: bits))
        }
        let quanta = Int(CMTimeCodeFormatDescriptionGetFrameQuanta(format))
        guard quanta > 0 else { return nil }
        let flags = CMTimeCodeFormatDescriptionGetTimeCodeFlags(format)
        let dropFrame = flags & UInt32(kCMTimeCodeFlag_DropFrame) != 0
        return formatTimecode(frameNumber: frameNumber, framesPerSecond: quanta, dropFrame: dropFrame)
    }

    static func formatTimecode(
        frameNumber: Int64,
        framesPerSecond: Int,
        dropFrame: Bool
    ) -> String? {
        guard framesPerSecond > 0 else { return nil }
        let negative = frameNumber < 0
        var frames = abs(frameNumber)
        if dropFrame, framesPerSecond == 30 || framesPerSecond == 60 {
            let dropped = Int64(framesPerSecond == 60 ? 4 : 2)
            let fps = Int64(framesPerSecond)
            let framesPer10Minutes = fps * 600 - dropped * 9
            let tenMinuteBlocks = frames / framesPer10Minutes
            let remainder = frames % framesPer10Minutes
            frames += dropped * 9 * tenMinuteBlocks
            if remainder >= dropped {
                frames += dropped * ((remainder - dropped) / (fps * 60 - dropped))
            }
        }
        let fps = Int64(framesPerSecond)
        let frame = frames % fps
        let totalSeconds = frames / fps
        let seconds = totalSeconds % 60
        let minutes = (totalSeconds / 60) % 60
        let hours = (totalSeconds / 3600) % 24
        let separator = dropFrame ? ";" : ":"
        return String(
            format: "%@%02lld:%02lld:%02lld%@%02lld",
            negative ? "-" : "", hours, minutes, seconds, separator, frame
        )
    }
}

@MainActor
@Observable
final class VideoCameraController: NSObject {
    struct Source: Identifiable, Equatable, Sendable {
        let id: String
        let name: String
        let isExternal: Bool
    }

    enum Phase: Equatable {
        case idle
        case requestingPermission
        case configuring
        case ready
        case recording
        case failed(String)
    }

    private final class SessionBox: @unchecked Sendable {
        let session = AVCaptureSession()
        let movieOutput = AVCaptureMovieFileOutput()
    }

    private let box = SessionBox()
    @ObservationIgnored private weak var previewLayer: AVCaptureVideoPreviewLayer?
    @ObservationIgnored private var activeDevice: AVCaptureDevice?
    @ObservationIgnored private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?
    @ObservationIgnored private var rotationObservations: [NSKeyValueObservation] = []
    private var completion: CheckedContinuation<CapturedVideoRecording, any Error>?
    private var activeSource: Source?
    private var recordStartedAt: Date?
    private var expectedRecordingURL: URL?

    private(set) var sources: [Source] = []
    private(set) var selectedSourceId: String?
    private(set) var phase: Phase = .idle

    var captureSession: AVCaptureSession { box.session }
    var isReady: Bool { phase == .ready }
    var isRecording: Bool { phase == .recording }

    override init() {
        super.init()
        refreshSources()
    }

    func refreshSources() {
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.external, .builtInWideAngleCamera],
            mediaType: .video,
            position: .unspecified
        )
        sources = discovery.devices.map { device in
            Source(
                id: device.uniqueID,
                name: device.localizedName,
                isExternal: device.deviceType == .external
            )
        }
        if selectedSourceId == nil || !sources.contains(where: { $0.id == selectedSourceId }) {
            selectedSourceId = sources.first(where: \.isExternal)?.id ?? sources.first?.id
        }
    }

    func start() async {
        phase = .requestingPermission
        guard await requestPermissions() else {
            phase = .failed("CreatorHub One trenger kamera- og mikrofontilgang for videoopptak.")
            return
        }
        do {
            phase = .configuring
            try configureSelectedSource()
            let session = box.session
            await Task.detached(priority: .userInitiated) { session.startRunning() }.value
            phase = .ready
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func stop() async {
        if box.movieOutput.isRecording { box.movieOutput.stopRecording() }
        let session = box.session
        await Task.detached(priority: .utility) { session.stopRunning() }.value
        phase = .idle
    }

    func attachPreviewLayer(_ layer: AVCaptureVideoPreviewLayer) {
        if previewLayer === layer, rotationCoordinator != nil {
            if layer.session !== box.session { layer.session = box.session }
            return
        }
        previewLayer = layer
        layer.session = box.session
        if let activeDevice {
            installRotationCoordinator(device: activeDevice, previewLayer: layer)
        }
    }

    func detachPreviewLayer(_ layer: AVCaptureVideoPreviewLayer) {
        guard previewLayer === layer else { return }
        previewLayer = nil
        if let activeDevice {
            installRotationCoordinator(device: activeDevice, previewLayer: nil)
        } else {
            clearRotationCoordinator()
        }
    }

    func selectSource(id: String) async {
        guard id != selectedSourceId else { return }
        selectedSourceId = id
        await stop()
        await start()
    }

    func record() async throws -> CapturedVideoRecording {
        guard phase == .ready, !box.movieOutput.isRecording else {
            throw CameraFailure.notReady
        }
        let destination = try Self.newRecordingURL()
        expectedRecordingURL = destination
        recordStartedAt = Date()
        phase = .recording
        return try await withCheckedThrowingContinuation { continuation in
            completion = continuation
            box.movieOutput.startRecording(to: destination, recordingDelegate: self)
        }
    }

    func stopRecording() {
        guard box.movieOutput.isRecording else { return }
        box.movieOutput.stopRecording()
    }

    private func requestPermissions() async -> Bool {
        let cameraGranted: Bool
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: cameraGranted = true
        case .notDetermined: cameraGranted = await AVCaptureDevice.requestAccess(for: .video)
        default: cameraGranted = false
        }
        guard cameraGranted else { return false }
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .audio)
        default: return false
        }
    }

    private func configureSelectedSource() throws {
        refreshSources()
        guard let selectedSourceId,
              let device = AVCaptureDevice.DiscoverySession(
                deviceTypes: [.external, .builtInWideAngleCamera],
                mediaType: .video,
                position: .unspecified
              ).devices.first(where: { $0.uniqueID == selectedSourceId })
        else { throw CameraFailure.noCamera }

        let session = box.session
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        for input in session.inputs { session.removeInput(input) }
        for output in session.outputs { session.removeOutput(output) }
        session.sessionPreset = .high

        let videoInput = try AVCaptureDeviceInput(device: device)
        guard session.canAddInput(videoInput) else { throw CameraFailure.unsupportedCamera }
        session.addInput(videoInput)
        if let microphone = AVCaptureDevice.default(for: .audio) {
            let audioInput = try AVCaptureDeviceInput(device: microphone)
            if session.canAddInput(audioInput) { session.addInput(audioInput) }
        }
        guard session.canAddOutput(box.movieOutput) else { throw CameraFailure.unsupportedRecording }
        session.addOutput(box.movieOutput)
        box.movieOutput.movieFragmentInterval = CMTime(seconds: 2, preferredTimescale: 600)
        activeDevice = device
        installRotationCoordinator(device: device, previewLayer: previewLayer)
        activeSource = Source(
            id: device.uniqueID,
            name: device.localizedName,
            isExternal: device.deviceType == .external
        )
    }

    private func installRotationCoordinator(
        device: AVCaptureDevice,
        previewLayer: AVCaptureVideoPreviewLayer?
    ) {
        clearRotationCoordinator()
        let coordinator = AVCaptureDevice.RotationCoordinator(
            device: device,
            previewLayer: previewLayer
        )
        rotationCoordinator = coordinator
        rotationObservations = [
            coordinator.observe(
                \.videoRotationAngleForHorizonLevelPreview,
                options: [.initial, .new]
            ) { [weak self] coordinator, _ in
                Task { @MainActor [weak self] in
                    self?.applyPreviewRotation(coordinator.videoRotationAngleForHorizonLevelPreview)
                }
            },
            coordinator.observe(
                \.videoRotationAngleForHorizonLevelCapture,
                options: [.initial, .new]
            ) { [weak self] coordinator, _ in
                Task { @MainActor [weak self] in
                    self?.applyCaptureRotation(coordinator.videoRotationAngleForHorizonLevelCapture)
                }
            },
        ]
    }

    private func clearRotationCoordinator() {
        rotationObservations.forEach { $0.invalidate() }
        rotationObservations.removeAll()
        rotationCoordinator = nil
    }

    private func applyPreviewRotation(_ angle: CGFloat) {
        guard let connection = previewLayer?.connection,
              connection.isVideoRotationAngleSupported(angle)
        else { return }
        connection.videoRotationAngle = angle
    }

    private func applyCaptureRotation(_ angle: CGFloat) {
        guard let connection = box.movieOutput.connection(with: .video),
              connection.isVideoRotationAngleSupported(angle)
        else { return }
        connection.videoRotationAngle = angle
    }

    private static func newRecordingURL() throws -> URL {
        let root = try CapturedVideoRecording.recordingsDirectory()
        return root.appendingPathComponent("CH-\(UUID().uuidString.lowercased()).mov")
    }

    private func finishRecording(url: URL, error: (any Error)?) async {
        let didSucceed = (error as NSError?)?.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool ?? (error == nil)
        guard didSucceed else {
            completion?.resume(throwing: error ?? CameraFailure.recordingFailed)
            completion = nil
            phase = .ready
            return
        }
        let source = activeSource
        let recording = await CapturedVideoRecording.inspect(
            fileURL: url,
            recordedAt: recordStartedAt ?? Date(),
            fallbackDurationMs: Int64(max(0, Date().timeIntervalSince(recordStartedAt ?? Date())) * 1000),
            sourceType: source?.isExternal == true ? .uvc : .ipadCamera,
            cameraName: source?.name ?? "Ukjent kamera"
        )
        completion?.resume(returning: recording)
        completion = nil
        expectedRecordingURL = nil
        phase = .ready
    }

    enum CameraFailure: LocalizedError {
        case noCamera
        case unsupportedCamera
        case unsupportedRecording
        case notReady
        case recordingFailed

        var errorDescription: String? {
            switch self {
            case .noCamera: "Fant ingen tilgjengelig videokilde."
            case .unsupportedCamera: "Denne videokilden kan ikke kobles til opptaksøkten."
            case .unsupportedRecording: "Denne videokilden støtter ikke filmopptak via iPad."
            case .notReady: "Videokameraet er ikke klart."
            case .recordingFailed: "Videoopptaket kunne ikke fullføres."
            }
        }
    }
}

extension VideoCameraController: AVCaptureFileOutputRecordingDelegate {
    nonisolated func fileOutput(
        _ output: AVCaptureFileOutput,
        didFinishRecordingTo outputFileURL: URL,
        from connections: [AVCaptureConnection],
        error: (any Error)?
    ) {
        Task { @MainActor [weak self] in
            await self?.finishRecording(url: outputFileURL, error: error)
        }
    }
}

struct VideoPreviewView: UIViewRepresentable {
    let controller: VideoCameraController

    @MainActor
    final class Coordinator {
        weak var controller: VideoCameraController?

        init(controller: VideoCameraController) {
            self.controller = controller
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(controller: controller)
    }

    func makeUIView(context: Context) -> PreviewSurface {
        let view = PreviewSurface()
        view.previewLayer.videoGravity = .resizeAspect
        controller.attachPreviewLayer(view.previewLayer)
        return view
    }

    func updateUIView(_ uiView: PreviewSurface, context: Context) {
        controller.attachPreviewLayer(uiView.previewLayer)
    }

    static func dismantleUIView(_ uiView: PreviewSurface, coordinator: Coordinator) {
        coordinator.controller?.detachPreviewLayer(uiView.previewLayer)
        uiView.previewLayer.session = nil
    }
}

final class PreviewSurface: UIView {
    override static var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }

    var previewLayer: AVCaptureVideoPreviewLayer {
        guard let previewLayer = layer as? AVCaptureVideoPreviewLayer else {
            preconditionFailure("PreviewSurface must use AVCaptureVideoPreviewLayer")
        }
        return previewLayer
    }
}
