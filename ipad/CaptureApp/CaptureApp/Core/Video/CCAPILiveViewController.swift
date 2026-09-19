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
    private(set) var batteryLevel: String?
    private(set) var isDiscovering = false
    private(set) var localNetworkPermissionDenied = false

    @ObservationIgnored private let discovery: CameraDiscovery
    @ObservationIgnored private var discoverySubscriptions = Set<AnyCancellable>()
    @ObservationIgnored private var frameTask: Task<Void, Never>?
    @ObservationIgnored private var telemetryTask: Task<Void, Never>?
    @ObservationIgnored private var client: CCAPIClient?
    @ObservationIgnored private var recordingStartedAt: Date?
    @ObservationIgnored private var manualCamera: CameraDiscovery.Found?
    #if DEBUG
    @ObservationIgnored private var demoCamera: FakeCanonCamera?
    #endif

    init(discovery: CameraDiscovery = CameraDiscovery()) {
        self.discovery = discovery
        discovery.$cameras
            .sink { [weak self] cameras in
                Task { @MainActor in self?.cameras = cameras }
            }
            .store(in: &discoverySubscriptions)
        discovery.$isSearching
            .sink { [weak self] isSearching in
                Task { @MainActor in self?.isDiscovering = isSearching }
            }
            .store(in: &discoverySubscriptions)
        discovery.$permissionDenied
            .sink { [weak self] denied in
                Task { @MainActor in self?.localNetworkPermissionDenied = denied }
            }
            .store(in: &discoverySubscriptions)
    }

    var selectedCamera: CameraDiscovery.Found? {
        cameras.first { $0.id == selectedCameraId }
            ?? (manualCamera?.id == selectedCameraId ? manualCamera : nil)
    }

    var isReady: Bool {
        phase == .ready && frame != nil
    }

    var canRecordMovie: Bool {
        capabilities.canRecordMovie && isReady && !isImporting
    }

    var batteryStatus: CCAPIBatteryStatus? {
        batteryLevel.flatMap(CCAPIBatteryStatus.init(rawValue:))
    }

    func startDiscovery() {
        discovery.start()
    }

    func refreshDiscovery() {
        discovery.refresh()
    }

    /// Connect to the exact base URL displayed on the camera's CCAPI screen.
    /// This is the reliable fallback when a custom port cannot be discovered.
    func connectManually(address: String) async throws {
        guard let baseURL = Self.normalizedCameraURL(address) else {
            throw ControlFailure.invalidAddress
        }
        let camera = CameraDiscovery.Found(
            id: "manual:\(baseURL.absoluteString)",
            serviceName: baseURL.host ?? "Canon CCAPI",
            baseURL: baseURL,
            deviceName: nil,
            firmware: nil,
            serial: nil
        )
        await select(camera)
        if case .failed(let message) = phase {
            throw ControlFailure.connectionFailed(message)
        }
    }

    static func normalizedCameraURL(_ rawAddress: String) -> URL? {
        let trimmed = rawAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let withScheme = trimmed.contains("://") ? trimmed : "http://\(trimmed)"
        guard var components = URLComponents(string: withScheme),
              let scheme = components.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              components.host != nil
        else { return nil }
        if ["/", "/ccapi", "/ccapi/"].contains(components.path) {
            components.path = ""
        }
        components.query = nil
        components.fragment = nil
        return components.url
    }

    func select(_ camera: CameraDiscovery.Found) async {
        await stopCurrent()
        if camera.id.hasPrefix("manual:") {
            manualCamera = camera
        }
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
            if let initialEvent = try? await client.pollEvents() {
                applyTelemetry(initialEvent)
            }
            try await client.startLiveView(size: "small")
            phase = .waitingForFrame
            startFrameLoop(client: client)
            startTelemetryLoop(client: client)
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
        telemetryTask?.cancel()
        telemetryTask = nil
        if let snapshot = try? await client.pollEvents() {
            batteryLevel = snapshot.batteryLevel ?? batteryLevel
        }
        do {
            try await client.setMovieRecording(true)
        } catch {
            startTelemetryLoop(client: client)
            throw error
        }
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
        defer {
            isImporting = false
            startTelemetryLoop(client: client)
        }

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
        telemetryTask?.cancel()
        telemetryTask = nil
        if let client {
            if isRecording { try? await client.setMovieRecording(false) }
            await client.stopLiveView()
        }
        client = nil
        selectedCameraId = nil
        manualCamera = nil
        frame = nil
        capabilities = CCAPIVideoCapabilities(canRecordMovie: false, writableSettings: [])
        shootingSettings = [:]
        isRecording = false
        isImporting = false
        batteryLevel = nil
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
                applyTelemetry(event)
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

    private func startTelemetryLoop(client: CCAPIClient) {
        telemetryTask?.cancel()
        telemetryTask = Task { [weak self] in
            while !Task.isCancelled {
                do {
                    let event = try await client.pollEvents()
                    guard !Task.isCancelled else { return }
                    self?.applyTelemetry(event)
                } catch CCAPIError.cameraBusy {
                    // Live view and camera housekeeping may temporarily own the body.
                } catch CCAPIError.timedOut {
                    // A timeout is a missed sample, not a lost camera connection.
                } catch {
                    guard !Task.isCancelled else { return }
                }
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

    private func applyTelemetry(_ event: CCAPIPollingResponse) {
        if let batteryLevel = event.batteryLevel {
            self.batteryLevel = batteryLevel
        }
    }

    enum ControlFailure: LocalizedError {
        case notReady
        case notRecording
        case movieNotFound
        case invalidAddress
        case connectionFailed(String)

        var errorDescription: String? {
            switch self {
            case .notReady:
                "Canon-kameraet annonserer ikke fjernstyrt videoopptak i denne modusen."
            case .notRecording:
                "Canon-kameraet tar ikke opp nå."
            case .movieNotFound:
                "Kameraet stoppet opptaket, men rapporterte ikke det nye videoklippet innen 45 sekunder."
            case .invalidAddress:
                "Skriv inn CCAPI-adressen kameraet viser, for eksempel http://192.168.1.42:8080."
            case .connectionFailed(let message):
                "Kunne ikke koble til Canon-kameraet: \(message)"
            }
        }
    }
}
