@preconcurrency import AVFoundation
import Foundation
import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class VideoCameraController: NSObject {
    struct Source: Identifiable, Equatable, Sendable {
        let id: String
        let name: String
        let isExternal: Bool
    }

    struct Recording: Sendable {
        let fileURL: URL
        let recordedAt: Date
        let durationMs: Int64
        let frameRate: Double?
        let width: Int?
        let height: Int?
        let sourceType: VideoCaptureAsset.SourceType
        let cameraName: String
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
    private var completion: CheckedContinuation<Recording, any Error>?
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

    func selectSource(id: String) async {
        guard id != selectedSourceId else { return }
        selectedSourceId = id
        await stop()
        await start()
    }

    func record() async throws -> Recording {
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
        activeSource = Source(
            id: device.uniqueID,
            name: device.localizedName,
            isExternal: device.deviceType == .external
        )
    }

    private static func newRecordingURL() throws -> URL {
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
        let media = AVURLAsset(url: url)
        let duration = (try? await media.load(.duration)).map { CMTimeGetSeconds($0) } ?? 0
        let track = try? await media.loadTracks(withMediaType: .video).first
        let size = try? await track?.load(.naturalSize)
        let frameRate = try? await track?.load(.nominalFrameRate)
        let source = activeSource
        completion?.resume(returning: Recording(
            fileURL: url,
            recordedAt: recordStartedAt ?? Date(),
            durationMs: Int64(max(0, duration) * 1000),
            frameRate: frameRate.map(Double.init),
            width: size.map { Int(abs($0.width)) },
            height: size.map { Int(abs($0.height)) },
            sourceType: source?.isExternal == true ? .uvc : .ipadCamera,
            cameraName: source?.name ?? "Ukjent kamera"
        ))
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
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewSurface {
        let view = PreviewSurface()
        view.previewLayer.videoGravity = .resizeAspect
        view.previewLayer.session = session
        return view
    }

    func updateUIView(_ uiView: PreviewSurface, context: Context) {
        if uiView.previewLayer.session !== session { uiView.previewLayer.session = session }
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
