import Combine
import Foundation
import Observation
import UIKit

@MainActor
@Observable
final class CCAPILiveViewController {
    enum Phase: Equatable {
        case idle
        case connecting
        case waitingForFrame
        case ready
        case failed(String)
    }

    private(set) var cameras: [CameraDiscovery.Found] = []
    private(set) var selectedCameraId: String?
    private(set) var frame: UIImage?
    private(set) var phase: Phase = .idle
    private(set) var capabilities = CCAPIVideoCapabilities(
        canRecordMovie: false,
        writableSettings: []
    )
    private(set) var shootingSettings: [CCAPIShootingSettingKey: CCAPIChoiceSetting] = [:]
    private(set) var isRecording = false
    private(set) var isImporting = false
    private(set) var lastImportMessage: String?
    private(set) var updatingSetting: CCAPIShootingSettingKey?

    @ObservationIgnored private let discovery: CameraDiscovery
    @ObservationIgnored private var cameraSubscription: AnyCancellable?
    @ObservationIgnored private var frameTask: Task<Void, Never>?
    @ObservationIgnored private var client: CCAPIClient?
    @ObservationIgnored private var recordingStartedAt: Date?
    #if DEBUG
    @ObservationIgnored private var demoCamera: FakeCanonCamera?
    #endif

    init(discovery: CameraDiscovery = CameraDiscovery()) {
        self.discovery = discovery
        cameraSubscription = discovery.$cameras.sink { [weak self] cameras in
            Task { @MainActor in self?.cameras = cameras }
        }
    }

    var selectedCamera: CameraDiscovery.Found? {
        cameras.first { $0.id == selectedCameraId }
    }

    var isReady: Bool {
        phase == .ready && frame != nil
    }

    var canRecordMovie: Bool {
        capabilities.canRecordMovie && isReady && !isImporting
    }

    func startDiscovery() {
        discovery.start()
    }

    func select(_ camera: CameraDiscovery.Found) async {
        await stopCurrent()
        selectedCameraId = camera.id
        phase = .connecting
        frame = nil
        let session: URLSession
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--canon-video-demo") {
            let fake = FakeCanonCamera()
            fake.install()
            demoCamera = fake
            session = fake.makeSession()
        } else {
            session = CCAPIClient.makeInsecureSession(trustingHostOf: camera.baseURL)
        }
        #else
        session = CCAPIClient.makeInsecureSession(trustingHostOf: camera.baseURL)
        #endif
        let client = CCAPIClient(baseURL: camera.baseURL, session: session)
        self.client = client
        do {
            _ = try await client.connect()
            capabilities = try await client.videoCapabilities()
            shootingSettings = (try? await client.videoShootingSettings()) ?? [:]
            try await client.startLiveView(size: "small")
            phase = .waitingForFrame
            startFrameLoop(client: client)
        } catch {
            phase = .failed(error.localizedDescription)
            self.client = nil
        }
    }

    func stop() async {
        discovery.stop()
        await stopCurrent()
    }

    func refreshShootingSettings() async {
        guard let client, !isRecording else { return }
        do {
            shootingSettings = try await client.videoShootingSettings()
        } catch {
            lastImportMessage = "Kamerainnstillingene kunne ikke leses i denne modusen."
        }
    }

    func updateShootingSetting(_ key: CCAPIShootingSettingKey, value: String) async throws {
        guard let client, !isRecording else { throw ControlFailure.notReady }
        updatingSetting = key
        defer { updatingSetting = nil }
        let confirmed = try await client.updateVideoShootingSetting(key, value: value)
        shootingSettings[key] = confirmed
    }

    func startMovieRecording() async throws {
        guard let client, canRecordMovie, !isRecording else { throw ControlFailure.notReady }
        _ = try? await client.pollEvents() // drain the pre-recording snapshot
        try await client.setMovieRecording(true)
        recordingStartedAt = Date()
        isRecording = true
        lastImportMessage = nil
    }

    func stopMovieRecording() async throws -> CapturedVideoRecording {
        guard let client, isRecording, let camera = selectedCamera else {
            throw ControlFailure.notRecording
        }
        let startedAt = recordingStartedAt ?? Date()
        try await client.setMovieRecording(false)
        isRecording = false
        recordingStartedAt = nil
        isImporting = true
        lastImportMessage = "Venter på at kameraet ferdigstiller klippet…"
        defer { isImporting = false }

        let contentPath = try await waitForNewMovieContent(client: client)
        lastImportMessage = "Henter klippet direkte fra kameraet…"
        let fileURL = try await client.downloadContentToDirectory(
            contentPath: contentPath,
            directory: CapturedVideoRecording.recordingsDirectory()
        )
        let fallbackDuration = Int64(max(0, Date().timeIntervalSince(startedAt)) * 1000)
        let recording = await CapturedVideoRecording.inspect(
            fileURL: fileURL,
            recordedAt: startedAt,
            fallbackDurationMs: fallbackDuration,
            sourceType: .canonCCAPI,
            cameraName: camera.displayName
        )
        lastImportMessage = "Klippet er hentet fra kameraet og sikres i CreatorHub."
        return recording
    }

    private func stopCurrent() async {
        frameTask?.cancel()
        frameTask = nil
        if let client {
            if isRecording { try? await client.setMovieRecording(false) }
            await client.stopLiveView()
        }
        client = nil
        selectedCameraId = nil
        frame = nil
        capabilities = CCAPIVideoCapabilities(canRecordMovie: false, writableSettings: [])
        shootingSettings = [:]
        isRecording = false
        isImporting = false
        recordingStartedAt = nil
        phase = .idle
        #if DEBUG
        demoCamera = nil
        #endif
    }

    private func waitForNewMovieContent(client: CCAPIClient) async throws -> String {
        let deadline = Date().addingTimeInterval(45)
        while Date() < deadline, !Task.isCancelled {
            do {
                let event = try await client.pollEvents()
                if let path = event.addedcontents?.last(where: Self.isMovieContent) {
                    return path
                }
            } catch CCAPIError.cameraBusy {
                // The camera can remain busy while it closes a large movie.
            }
            try await Task.sleep(for: .milliseconds(350))
        }
        throw ControlFailure.movieNotFound
    }

    private static func isMovieContent(_ path: String) -> Bool {
        let ext = URL(string: path)?.pathExtension.lowercased()
            ?? URL(fileURLWithPath: path).pathExtension.lowercased()
        return ["mp4", "mov", "mxf", "crm"].contains(ext)
    }

    private func startFrameLoop(client: CCAPIClient) {
        frameTask?.cancel()
        frameTask = Task { [weak self] in
            while !Task.isCancelled {
                do {
                    let data = try await client.liveViewFrame()
                    guard !Task.isCancelled else { return }
                    if let image = UIImage(data: data) {
                        self?.frame = image
                        self?.phase = .ready
                    }
                    try? await Task.sleep(for: .milliseconds(30))
                } catch CCAPIError.timedOut {
                    continue
                } catch CCAPIError.cameraBusy {
                    try? await Task.sleep(for: .milliseconds(200))
                } catch {
                    guard !Task.isCancelled else { return }
                    self?.phase = .failed(error.localizedDescription)
                    try? await Task.sleep(for: .seconds(1))
                }
            }
        }
    }

    enum ControlFailure: LocalizedError {
        case notReady
        case notRecording
        case movieNotFound

        var errorDescription: String? {
            switch self {
            case .notReady:
                "Canon-kameraet annonserer ikke fjernstyrt videoopptak i denne modusen."
            case .notRecording:
                "Canon-kameraet tar ikke opp nå."
            case .movieNotFound:
                "Kameraet stoppet opptaket, men rapporterte ikke det nye videoklippet innen 45 sekunder."
            }
        }
    }
}
