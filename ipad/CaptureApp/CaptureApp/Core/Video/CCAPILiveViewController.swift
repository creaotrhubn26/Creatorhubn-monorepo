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
        case reconnecting(Int)
        case waitingForFrame
        case controlOnly
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
    private(set) var isLiveViewEnabled = true
    private(set) var reconnectAttempt = 0
    private(set) var frameSequence: UInt64 = 0
    private(set) var liveViewGeometry: CCAPILiveViewGeometry?
    private(set) var pendingMovieImportCount = 0
    private(set) var importProgress: CCAPIMediaTransferProgress?

    @ObservationIgnored private let discovery: CameraDiscovery
    @ObservationIgnored private var discoverySubscriptions = Set<AnyCancellable>()
    @ObservationIgnored private var frameTask: Task<Void, Never>?
    @ObservationIgnored private var telemetryTask: Task<Void, Never>?
    @ObservationIgnored private var reconnectTask: Task<Void, Never>?
    @ObservationIgnored private var client: CCAPIClient?
    @ObservationIgnored private var recordingStartedAt: Date?
    @ObservationIgnored private var manualCamera: CameraDiscovery.Found?
    @ObservationIgnored private var connectionCamera: CameraDiscovery.Found?
    @ObservationIgnored private var shouldMaintainConnection = false
    @ObservationIgnored private var pendingMoviePaths: [String] = []
    @ObservationIgnored private var observedMoviePaths: Set<String> = []
    #if DEBUG
    @ObservationIgnored private var demoCamera: FakeCanonCamera?
    #endif

    init(discovery: CameraDiscovery = CameraDiscovery()) {
        self.discovery = discovery
        discovery.$cameras
            .sink { [weak self] cameras in
                Task { @MainActor in
                    self?.cameras = cameras.sorted {
                        $0.displayName.localizedStandardCompare($1.displayName) == .orderedAscending
                    }
                }
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
            ?? (connectionCamera?.id == selectedCameraId ? connectionCamera : nil)
    }

    var isReady: Bool {
        phase == .ready && frame != nil
    }

    var canRecordMovie: Bool {
        capabilities.canRecordMovie && client != nil && !isImporting
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
        CCAPICameraAddress.normalize(rawAddress)
    }

    func select(_ camera: CameraDiscovery.Found) async {
        await stopCurrent()
        if camera.id.hasPrefix("manual:") {
            manualCamera = camera
        }
        connectionCamera = camera
        selectedCameraId = camera.id
        shouldMaintainConnection = true
        phase = .connecting
        frame = nil
        await establishConnection(to: camera)
    }

    private func establishConnection(to camera: CameraDiscovery.Found) async {
        guard shouldMaintainConnection, selectedCameraId == camera.id else { return }
        let session: URLSession
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--canon-video-demo") {
            let fake = FakeCanonCamera()
            if ProcessInfo.processInfo.arguments.contains("--canon-external-movie-demo") {
                _ = fake.simulateMovieCapture()
            }
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
            let identity = try? await client.deviceInformation()
            try CCAPICameraIdentityStore().validateAndRemember(
                baseURL: camera.baseURL,
                serial: identity?.serialnumber ?? camera.serial
            )
            CCAPICameraPreference.remember(camera.baseURL)
            guard shouldMaintainConnection,
                  selectedCameraId == camera.id,
                  !Task.isCancelled
            else {
                self.client = nil
                return
            }
            capabilities = try await client.videoCapabilities()
            shootingSettings = (try? await client.videoShootingSettings()) ?? [:]
            if let initialEvent = try? await client.pollEvents() {
                applyTelemetry(initialEvent)
            }
            if isLiveViewEnabled {
                try await client.startLiveView(size: "small")
                guard shouldMaintainConnection,
                      selectedCameraId == camera.id,
                      !Task.isCancelled
                else {
                    await client.stopLiveView()
                    self.client = nil
                    return
                }
                phase = .waitingForFrame
                liveViewGeometry = try? await client.liveViewGeometry()
                startFrameLoop(client: client)
            } else {
                phase = .controlOnly
            }
            startTelemetryLoop(client: client)
            reconnectAttempt = 0
        } catch {
            phase = .failed(error.localizedDescription)
            self.client = nil
            scheduleReconnect(after: error)
        }
    }

    func stop() async {
        discovery.stop()
        await stopCurrent()
    }

    func setLiveViewEnabled(_ enabled: Bool) async {
        guard enabled != isLiveViewEnabled else { return }
        isLiveViewEnabled = enabled
        guard let client else { return }
        if enabled {
            do {
                try await client.startLiveView(size: "small")
                phase = .waitingForFrame
                startFrameLoop(client: client)
            } catch {
                phase = .failed(error.localizedDescription)
                scheduleReconnect(after: error)
            }
        } else {
            frameTask?.cancel()
            frameTask = nil
            frame = nil
            await client.stopLiveView()
            phase = .controlOnly
        }
    }

    func driveFocus(_ drive: CCAPIFocusDrive) async throws {
        guard let client, capabilities.canDriveFocus, !isRecording else {
            throw ControlFailure.notReady
        }
        try await client.driveFocus(drive)
    }

    func setAutoFocus(_ active: Bool) async throws {
        guard let client, capabilities.canAutoFocus, !isRecording else {
            throw ControlFailure.notReady
        }
        try await client.setAutoFocus(active)
    }

    func setFocusPoint(normalizedX: Double, normalizedY: Double) async throws {
        guard let client,
              capabilities.canSetAFFrame,
              let liveViewGeometry,
              isLiveViewEnabled,
              !isRecording
        else { throw ControlFailure.notReady }
        let position = liveViewGeometry.cameraPosition(
            normalizedX: normalizedX,
            normalizedY: normalizedY
        )
        try await client.setAFFramePosition(x: position.x, y: position.y)
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
        importProgress = nil
        lastImportMessage = "Venter på at kameraet ferdigstiller klippet…"
        defer {
            isImporting = false
            importProgress = nil
            startTelemetryLoop(client: client)
        }

        let contentPath = try await waitForNewMovieContent(client: client)
        removePendingMoviePath(contentPath)
        lastImportMessage = "Henter klippet direkte fra kameraet…"
        let fileURL = try await client.downloadContentToDirectory(
            contentPath: contentPath,
            directory: CapturedVideoRecording.recordingsDirectory(),
            onProgress: transferProgressHandler()
        )
        let fallbackDuration = Int64(max(0, Date().timeIntervalSince(startedAt)) * 1000)
        let recording = await CapturedVideoRecording.inspect(
            fileURL: fileURL,
            recordedAt: startedAt,
            fallbackDurationMs: fallbackDuration,
            sourceType: .canonCCAPI,
            cameraName: camera.displayName
        )
        lastImportMessage = "Klippet er hentet fra kameraet og lagret på iPaden."
        return recording
    }

    /// Imports a movie created with the camera's physical REC button. CCAPI
    /// reports these files through `addedcontents`; the active workspace then
    /// registers them through the same durable local/upload path as remote REC.
    func importNextDetectedMovie() async throws -> CapturedVideoRecording? {
        guard !isImporting,
              !isRecording,
              let client,
              let contentPath = pendingMoviePaths.first
        else { return nil }
        removePendingMoviePath(contentPath)
        isImporting = true
        importProgress = nil
        lastImportMessage = "Henter \(URL(string: contentPath)?.lastPathComponent ?? "kameraklipp")…"
        defer {
            isImporting = false
            importProgress = nil
        }
        do {
            let fileURL = try await client.downloadContentToDirectory(
                contentPath: contentPath,
                directory: CapturedVideoRecording.recordingsDirectory(),
                onProgress: transferProgressHandler()
            )
            let recording = await CapturedVideoRecording.inspect(
                fileURL: fileURL,
                recordedAt: Date(),
                fallbackDurationMs: 0,
                sourceType: .canonCCAPI,
                cameraName: selectedCamera?.displayName ?? "Canon CCAPI"
            )
            lastImportMessage = "\(fileURL.lastPathComponent) er hentet fra kameraet."
            return recording
        } catch {
            // Keep the item available for a deliberate retry after a transient
            // camera/network failure, without duplicating it in the queue.
            pendingMoviePaths.insert(contentPath, at: 0)
            pendingMovieImportCount = pendingMoviePaths.count
            throw error
        }
    }

    private func transferProgressHandler() -> @Sendable (CCAPIMediaTransferProgress) async -> Void {
        { [weak self] progress in
            await MainActor.run { self?.importProgress = progress }
        }
    }

    private func stopCurrent() async {
        shouldMaintainConnection = false
        reconnectTask?.cancel()
        reconnectTask = nil
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
        connectionCamera = nil
        frame = nil
        capabilities = CCAPIVideoCapabilities(canRecordMovie: false, writableSettings: [])
        shootingSettings = [:]
        isRecording = false
        isImporting = false
        batteryLevel = nil
        recordingStartedAt = nil
        reconnectAttempt = 0
        frameSequence = 0
        liveViewGeometry = nil
        pendingMoviePaths = []
        observedMoviePaths = []
        pendingMovieImportCount = 0
        importProgress = nil
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

    private func enqueueAddedMovies(_ paths: [String]?) {
        guard let paths else { return }
        for path in paths where Self.isMovieContent(path) && observedMoviePaths.insert(path).inserted {
            pendingMoviePaths.append(path)
        }
        pendingMovieImportCount = pendingMoviePaths.count
    }

    private func removePendingMoviePath(_ path: String) {
        pendingMoviePaths.removeAll { $0 == path }
        pendingMovieImportCount = pendingMoviePaths.count
    }

    private func startFrameLoop(client: CCAPIClient) {
        frameTask?.cancel()
        frameTask = Task { [weak self] in
            var consecutiveFailures = 0
            while !Task.isCancelled {
                do {
                    let data = try await client.liveViewFrame()
                    guard !Task.isCancelled else { return }
                    consecutiveFailures = 0
                    if let image = UIImage(data: data) {
                        self?.frame = image
                        self?.frameSequence &+= 1
                        self?.phase = .ready
                    }
                    try? await Task.sleep(for: .milliseconds(30))
                } catch CCAPIError.timedOut {
                    continue
                } catch CCAPIError.cameraBusy {
                    try? await Task.sleep(for: .milliseconds(200))
                } catch {
                    guard !Task.isCancelled else { return }
                    consecutiveFailures += 1
                    if consecutiveFailures >= 3 {
                        self?.scheduleReconnect(after: error)
                        return
                    }
                    try? await Task.sleep(for: .milliseconds(350))
                }
            }
        }
    }

    private func scheduleReconnect(after error: Error) {
        guard shouldMaintainConnection,
              selectedCamera != nil,
              reconnectTask == nil,
              !isRecording,
              !isImporting
        else { return }
        frameTask?.cancel()
        frameTask = nil
        telemetryTask?.cancel()
        telemetryTask = nil
        client = nil
        phase = .failed(error.localizedDescription)
        reconnectTask = Task { [weak self] in
            guard let self else { return }
            while self.shouldMaintainConnection, !Task.isCancelled {
                self.reconnectAttempt += 1
                self.phase = .reconnecting(self.reconnectAttempt)
                let delay = min(pow(2.0, Double(self.reconnectAttempt - 1)), 30)
                try? await Task.sleep(for: .seconds(delay))
                guard !Task.isCancelled,
                      self.shouldMaintainConnection,
                      let camera = self.selectedCamera
                else { return }
                await self.establishConnection(to: camera)
                if self.client != nil {
                    self.reconnectTask = nil
                    return
                }
            }
            self.reconnectTask = nil
        }
    }

    private func startTelemetryLoop(client: CCAPIClient) {
        telemetryTask?.cancel()
        telemetryTask = Task { [weak self] in
            var consecutiveFailures = 0
            while !Task.isCancelled {
                do {
                    let event = try await client.pollEvents()
                    guard !Task.isCancelled else { return }
                    consecutiveFailures = 0
                    self?.applyTelemetry(event)
                } catch CCAPIError.cameraBusy {
                    // Live view and camera housekeeping may temporarily own the body.
                } catch CCAPIError.timedOut {
                    // A timeout is a missed sample, not a lost camera connection.
                } catch {
                    guard !Task.isCancelled else { return }
                    consecutiveFailures += 1
                    if consecutiveFailures >= 3 {
                        self?.scheduleReconnect(after: error)
                        return
                    }
                }
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

    func applyTelemetry(_ event: CCAPIPollingResponse) {
        if let batteryLevel = event.batteryLevel {
            self.batteryLevel = batteryLevel
        }
        enqueueAddedMovies(event.addedcontents)
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
