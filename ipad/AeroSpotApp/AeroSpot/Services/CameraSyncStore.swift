// CameraSyncStore.swift — binder eksisterende CCAPIClient (delt fra
// CaptureApp) til AeroSpot-UI. Direkte kamera-tilkobling over lokalt
// Wi-Fi — ingen backend-proxy nødvendig på iPhone.
//
// Ansvar: connection state, event-polling (settings + addedcontents =
// capture events), normalisering, reconnect. Ingen UI-logikk.

import Foundation
import Observation

enum CameraPhase: Sendable, Equatable {
    case disconnected   // ingen tilkobling
    case connecting     // første forsøk pågår
    case connected      // live
    case reconnecting   // mistet kontakt, prøver automatisk igjen
}

struct ConnectedCameraState: Sendable, Equatable {
    var phase: CameraPhase = .disconnected
    var model: String?
    var lensName: String?
    var batteryLevel: String?
    var settings = CameraSettingsSnapshot()
    var lastCaptureAt: Date?

    // Bevart for eksisterende views.
    var connected: Bool { phase == .connected }
    var reconnecting: Bool { phase == .connecting || phase == .reconnecting }

    /// Norsk status for UI — én kilde, alle states dekket.
    var statusText: String {
        switch phase {
        case .disconnected: return "Ikke tilkoblet"
        case .connecting:   return "Kobler til…"
        case .connected:    return "Tilkoblet"
        case .reconnecting: return "Mistet kontakt — kobler til igjen…"
        }
    }
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
    private var heartbeatTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private var insecureSession: URLSession?
    private var cameraBaseURL: URL?
    /// Kalles med nye content-URL-er (absolutte) når kameraet tar bilde.
    var onNewContents: (([URL], URLSession) -> Void)?

    init() {
        ipAddress = UserDefaults.standard.string(forKey: "aerospot.cameraIP") ?? ""
    }

    /// Bruker-initiert tilkobling. Nullstiller evt. auto-reconnect-løkke.
    func connect() async {
        disconnect()
        state.phase = .connecting
        _ = await establish()
    }

    /// Selve tilkoblingen. Brukes både av connect() og auto-reconnect.
    /// Returnerer true ved suksess. Setter IKKE .disconnected under en
    /// pågående reconnect — da eier reconnect-løkken tilstanden.
    @discardableResult
    private func establish() async -> Bool {
        guard let url = URL(string: "https://\(ipAddress):443") else {
            state.phase = .disconnected
            return false
        }
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
            state.phase = .connected
            state.model = info.productname
            startPolling(client: client)
            return true
        } catch {
            if state.phase != .reconnecting { state.phase = .disconnected }
            return false
        }
    }

    func disconnect() {
        stopLoops()
        reconnectTask?.cancel(); reconnectTask = nil
        client = nil
        state = ConnectedCameraState()
    }

    private func stopLoops() {
        pollTask?.cancel(); pollTask = nil
        heartbeatTask?.cancel(); heartbeatTask = nil
    }

    /// App kom i forgrunn (eller Kamera-fanen ble vist). Hvis vi har en IP og
    /// ikke er live, gjenoppta tilkoblingen sømløst. No-op hvis alt er i orden.
    func resumeIfNeeded() {
        guard !ipAddress.isEmpty else { return }
        switch state.phase {
        case .connected, .connecting, .reconnecting:
            return
        case .disconnected:
            Task { await connect() }
        }
    }

    /// To parallelle løkker holder økten robust:
    ///  1. Long-poll for øyeblikkelige capture-events (addedcontents).
    ///  2. Heartbeat hvert 8s (deviceInformation) — jevn CCAPI-aktivitet som
    ///     hindrer Canon i å auto-avslå (selv 15s-innstilling), og oppdager
    ///     drop innen ~16s uansett hvor long-pollen står.
    private func startPolling(client: CCAPIClient) {
        startEventLoop(client: client)
        startHeartbeat(client: client)
    }

    private func startEventLoop(client: CCAPIClient) {
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                do {
                    let events = try await client.longPollEvents(timeout: 30)
                    await self?.apply(events)
                } catch {
                    // Long-poll kan time ut/avbrytes normalt — la heartbeat
                    // avgjøre om det er et ekte drop. Kort pause, prøv igjen.
                    try? await Task.sleep(for: .seconds(1))
                }
            }
        }
    }

    private func startHeartbeat(client: CCAPIClient) {
        heartbeatTask = Task { [weak self] in
            var failures = 0
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(8))
                if Task.isCancelled { return }
                do {
                    let info = try await client.deviceInformation()
                    failures = 0
                    await self?.heartbeatOK(model: info.productname)
                } catch {
                    failures += 1
                    if failures >= 2 {
                        await self?.handleDrop()
                        return // reconnect-løkken tar over
                    }
                }
            }
        }
    }

    private func heartbeatOK(model: String?) {
        if state.phase == .connected, let model { state.model = model }
    }

    /// Kontakt tapt (kamera sov/forlot nettet). Marker og start auto-reconnect.
    private func handleDrop() {
        guard state.phase == .connected || state.phase == .connecting else { return }
        state.phase = .reconnecting
        stopLoops()
        startReconnect()
    }

    /// Prøv å koble til igjen med eksponentiell backoff (2→30s cap) til det
    /// lykkes eller brukeren kobler fra. Canon slår av CCAPI ved standby, så
    /// dette henter økten tilbake automatisk når kameraet våkner.
    private func startReconnect() {
        reconnectTask?.cancel()
        reconnectTask = Task { [weak self] in
            var delay: Double = 2
            var attempts = 0
            while !Task.isCancelled {
                guard let self else { return }
                if await self.establish() { return } // etablert → polling kjører igjen
                attempts += 1

                // Etter noen mislykkede forsøk på lagret IP: kameraet kan ha
                // fått ny IP (DHCP). Skann subnettet, bytt hvis funnet.
                if attempts == 3 {
                    if let found = await CameraScanner.scanForCanon(),
                       found != self.ipAddress {
                        self.ipAddress = found // didSet persisterer ny IP
                        if await self.establish() { return }
                    }
                }

                try? await Task.sleep(for: .seconds(delay))
                delay = min(delay * 2, 30)
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
