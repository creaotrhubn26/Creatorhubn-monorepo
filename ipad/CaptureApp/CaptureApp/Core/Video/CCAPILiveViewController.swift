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

    @ObservationIgnored private let discovery: CameraDiscovery
    @ObservationIgnored private var cameraSubscription: AnyCancellable?
    @ObservationIgnored private var frameTask: Task<Void, Never>?
    @ObservationIgnored private var client: CCAPIClient?

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

    func startDiscovery() {
        discovery.start()
    }

    func select(_ camera: CameraDiscovery.Found) async {
        await stopCurrent()
        selectedCameraId = camera.id
        phase = .connecting
        frame = nil
        let session = CCAPIClient.makeInsecureSession(trustingHostOf: camera.baseURL)
        let client = CCAPIClient(baseURL: camera.baseURL, session: session)
        self.client = client
        do {
            _ = try await client.connect()
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

    private func stopCurrent() async {
        frameTask?.cancel()
        frameTask = nil
        if let client { await client.stopLiveView() }
        client = nil
        selectedCameraId = nil
        frame = nil
        phase = .idle
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
}
