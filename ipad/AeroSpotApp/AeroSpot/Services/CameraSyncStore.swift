// CameraSyncStore.swift — binder eksisterende CCAPIClient (delt fra
// CaptureApp) til AeroSpot-UI. Direkte kamera-tilkobling over lokalt
// Wi-Fi — ingen backend-proxy nødvendig på iPhone.
//
// Ansvar: connection state, event-polling (settings + addedcontents =
// capture events), normalisering, reconnect. Ingen UI-logikk.

import Foundation
import Observation

struct ConnectedCameraState: Sendable, Equatable {
    var connected = false
    var reconnecting = false
    var model: String?
    var lensName: String?
    var batteryLevel: String?
    var settings = CameraSettingsSnapshot()
    var lastCaptureAt: Date?
}

@MainActor
@Observable
final class CameraSyncStore {
    private(set) var state = ConnectedCameraState()
    /// Kalles på hvert capture-event (addedcontents fra CCAPI-polling).
    var onCapture: (() -> Void)?
    var ipAddress: String {
        didSet { UserDefaults.standard.set(ipAddress, forKey: "aerospot.cameraIP") }
    }

    private(set) var client: CCAPIClient?
    private var pollTask: Task<Void, Never>?
    private var insecureSession: URLSession?
    private var cameraBaseURL: URL?
    /// Kalles med nye content-URL-er (absolutte) når kameraet tar bilde.
    var onNewContents: (([URL], URLSession) -> Void)?

    init() {
        ipAddress = UserDefaults.standard.string(forKey: "aerospot.cameraIP") ?? ""
    }

    func connect() async {
        disconnect()
        guard let url = URL(string: "https://\(ipAddress):443") else { return }
        state = ConnectedCameraState(reconnecting: true)

        // Kameraets self-signed cert: trust kun for kameraets host —
        // samme mønster som CaptureApp.
        let session = CCAPIClient.makeInsecureSession(trustingHostOf: url)
        self.insecureSession = session
        self.cameraBaseURL = url
        let client = CCAPIClient(baseURL: url, session: session)
        self.client = client
        do {
            _ = try await client.connect()
            let info = try await client.deviceInformation()
            state.connected = true
            state.reconnecting = false
            state.model = info.productname
            startPolling(client: client)
        } catch {
            state = ConnectedCameraState()
        }
    }

    func disconnect() {
        pollTask?.cancel()
        pollTask = nil
        client = nil
        state = ConnectedCameraState()
    }

    /// Long-poll CCAPI-events: settings-endringer, batteri, lens og
    /// addedcontents (= bilde tatt).
    private func startPolling(client: CCAPIClient) {
        pollTask = Task { [weak self] in
            var failures = 0
            while !Task.isCancelled {
                do {
                    let events = try await client.longPollEvents(timeout: 30)
                    failures = 0
                    await self?.apply(events)
                } catch {
                    failures += 1
                    if failures >= 3 {
                        await self?.markReconnecting()
                    }
                    try? await Task.sleep(for: .seconds(3))
                }
            }
        }
    }

    private func apply(_ events: CCAPIPollingResponse) {
        if let shutter = events.shutterSpeed { state.settings.shutterSpeed = shutter }
        if let aperture = events.apertureValue {
            state.settings.aperture = aperture.hasPrefix("f") ? aperture : "f/\(aperture)"
        }
        if let iso = events.isoValue { state.settings.iso = iso }
        if let lens = events.lensName { state.lensName = lens }
        if let battery = events.batteryLevel { state.batteryLevel = battery }
        if let added = events.addedcontents, !added.isEmpty {
            state.lastCaptureAt = Date()
            for _ in added { onCapture?() }
            // addedcontents er content-stier; bygg absolutte URL-er for last-ned.
            if let base = cameraBaseURL, let session = insecureSession {
                let urls = added.compactMap { path -> URL? in
                    if let abs = URL(string: path), abs.scheme != nil { return abs }
                    return URL(string: path, relativeTo: base)?.absoluteURL
                }
                if !urls.isEmpty { onNewContents?(urls, session) }
            }
        }
        if state.reconnecting {
            state.reconnecting = false
            state.connected = true
        }
    }

    private func markReconnecting() {
        if state.connected {
            state.connected = false
            state.reconnecting = true
        }
    }

    /// Skriv anbefalte innstillinger direkte til kameraet (CCAPI PUT).
    /// aperture uten «f/»-prefiks. Returnerer true hvis minst én lyktes.
    func applySettings(shutter: String?, aperture: String?, iso: String?) async -> Bool {
        guard let client else { return false }
        var anyOk = false
        if let shutter {
            if (try? await client.setShootingSetting("tv", value: shutter)) != nil { anyOk = true }
        }
        if let aperture {
            let av = aperture.replacingOccurrences(of: "f/", with: "").replacingOccurrences(of: "f", with: "")
            if (try? await client.setShootingSetting("av", value: av)) != nil { anyOk = true }
        }
        if let iso {
            if (try? await client.setShootingSetting("iso", value: iso)) != nil { anyOk = true }
        }
        return anyOk
    }
}
