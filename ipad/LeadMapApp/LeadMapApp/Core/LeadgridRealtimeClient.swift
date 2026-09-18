// LeadgridRealtimeClient.swift
//
// WebSocket-subscriber for backend's /ws/leadgrid-endpoint (PR #874).
// Broadcaster events via NotificationCenter slik at SwiftUI-views kan
// lytte uten å koble seg direkte til klienten.
//
// Auto-reconnect m/ exponential backoff. Heartbeat-pong hvert 25s.

import Foundation
import Observation

@MainActor
@Observable
final class LeadgridRealtimeClient {
    static let shared = LeadgridRealtimeClient()

    private struct ConnectionConfiguration: Equatable {
        let baseURL: String
        let authToken: String
        let channels: Set<String>
    }

    private var task: URLSessionWebSocketTask?
    private var session: URLSession?
    private var configuration: ConnectionConfiguration?
    /// Økes før gammel transport kanselleres og før hver ny socket åpnes.
    /// Receive-/reconnect-callbacks må matche generasjonen de ble startet i.
    private var connectionGeneration: UInt64 = 0
    private(set) var isConnected: Bool = false
    private(set) var lastEventAt: Date?
    private var reconnectAttempts = 0
    private var heartbeatTimer: Timer?
    private var reconnectTask: Task<Void, Never>?
    private let shouldStartNetworkTasks: Bool

    private init(startNetworkTasks: Bool) {
        self.shouldStartNetworkTasks = startNetworkTasks
    }

    private convenience init() {
        self.init(startNetworkTasks: true)
    }

    #if DEBUG
    /// Deterministisk test-seam: oppretter socket-objekter, men starter ikke
    /// nettverk, receive-loop eller heartbeat.
    convenience init(testingWithoutNetwork: Bool) {
        self.init(startNetworkTasks: !testingWithoutNetwork)
    }

    var connectionGenerationForTesting: UInt64 { connectionGeneration }
    var configuredChannelsForTesting: Set<String> { configuration?.channels ?? [] }
    var hasConfigurationForTesting: Bool { configuration != nil }
    #endif

    func connect(baseURL: String, token: String, channels: [String]) {
        let next = ConnectionConfiguration(
            baseURL: baseURL,
            authToken: token,
            channels: Set(channels)
        )

        if configuration == next {
            // Samme logiske forbindelse er allerede tilkoblet, i handshake
            // eller venter på kontrollert reconnect. Unngå duplikat socket.
            guard task == nil, reconnectTask == nil else { return }
            openSocket()
            return
        }

        // Token, baseURL eller kanaler er endret. Invalider generasjonen FØR
        // cancel slik at callback fra gammel handshake/socket ikke kan sette
        // state eller planlegge reconnect med den gamle org-kanalen.
        cancelCurrentTransport()
        configuration = next
        reconnectAttempts = 0
        lastEventAt = nil
        openSocket()
    }

    func disconnect() {
        configuration = nil
        reconnectAttempts = 0
        lastEventAt = nil
        cancelCurrentTransport()
    }

    private func cancelCurrentTransport() {
        connectionGeneration &+= 1
        reconnectTask?.cancel()
        reconnectTask = nil
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        let previousTask = task
        task = nil
        previousTask?.cancel(with: .goingAway, reason: nil)
        let previousSession = session
        session = nil
        previousSession?.invalidateAndCancel()
        isConnected = false
    }

    private func openSocket() {
        guard let configuration else { return }
        connectionGeneration &+= 1
        let generation = connectionGeneration
        isConnected = false

        var components = URLComponents(string: configuration.baseURL)
        if components?.scheme == "https" {
            components?.scheme = "wss"
        } else if components?.scheme == "http" {
            components?.scheme = "ws"
        }
        components?.path = "/ws/leadgrid"
        // Bearer må aldri ligge i URL/query: proxy-, access- og crashlogger
        // kan ellers persistere hele tokenet. WebSocket-handshaken bruker
        // samme Authorization-header som ordinære API-kall.
        components?.queryItems = nil
        guard let url = components?.url else {
            print("[leadgrid-rt] Ugyldig URL: \(configuration.baseURL)")
            return
        }
        let s = URLSession(configuration: .default)
        session = s
        var request = URLRequest(url: url)
        request.setValue("Bearer \(configuration.authToken)", forHTTPHeaderField: "Authorization")
        let t = s.webSocketTask(with: request)
        task = t
        guard shouldStartNetworkTasks else { return }
        t.resume()
        receiveLoop(on: t, generation: generation)
        startHeartbeat(generation: generation)
    }

    private func sendSubscription() {
        guard let channels = configuration?.channels, !channels.isEmpty else { return }
        send(["type": "subscribe", "channels": channels.sorted()])
    }

    private func send(_ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let str = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(str)) { error in
            if let error {
                print("[leadgrid-rt] send failed: \(error.localizedDescription)")
            }
        }
    }

    private func receiveLoop(
        on socket: URLSessionWebSocketTask,
        generation: UInt64
    ) {
        socket.receive { [weak self, weak socket] result in
            guard let self, let socket else { return }
            Task { @MainActor in
                guard self.connectionGeneration == generation,
                      self.task === socket,
                      self.configuration != nil
                else { return }
                switch result {
                case .success(let message):
                    if !self.isConnected {
                        self.isConnected = true
                        self.reconnectAttempts = 0
                        self.sendSubscription()
                    }
                    self.handle(message: message)
                    self.receiveLoop(on: socket, generation: generation)
                case .failure(let error):
                    print("[leadgrid-rt] receive failed: \(error.localizedDescription)")
                    self.isConnected = false
                    self.heartbeatTimer?.invalidate()
                    self.heartbeatTimer = nil
                    self.task = nil
                    self.session?.invalidateAndCancel()
                    self.session = nil
                    self.scheduleReconnect(expectedGeneration: generation)
                }
            }
        }
    }

    private func handle(message: URLSessionWebSocketTask.Message) {
        let text: String
        switch message {
        case .string(let s): text = s
        case .data(let d): text = String(data: d, encoding: .utf8) ?? ""
        @unknown default: return
        }
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        let type = json["type"] as? String ?? ""
        if type == "ping" {
            send(["type": "pong"])
            return
        }
        if type == "ready" || type == "subscribed" {
            return
        }
        lastEventAt = Date()
        let payload = json["data"] as? [String: Any] ?? [:]
        let channel = json["channel"] as? String ?? ""
        // Konverter til Sendable-trygg dictionary før Task.detached
        var safe: [String: String] = ["type": type, "channel": channel]
        for (k, v) in payload {
            if let s = v as? String { safe["data.\(k)"] = s }
            else if let n = v as? NSNumber { safe["data.\(k)"] = n.stringValue }
            else if let b = v as? Bool { safe["data.\(k)"] = b ? "true" : "false" }
        }
        NotificationCenter.default.post(
            name: .leadgridRealtimeEvent,
            object: nil,
            userInfo: safe
        )
    }

    private func startHeartbeat(generation: UInt64) {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self,
                      self.connectionGeneration == generation,
                      self.task != nil
                else { return }
                self.send(["type": "pong"])
            }
        }
    }

    private func scheduleReconnect(expectedGeneration: UInt64) {
        reconnectTask?.cancel()
        reconnectAttempts += 1
        let delay = min(pow(2.0, Double(reconnectAttempts)), 32.0)
        reconnectTask = Task { @MainActor [weak self] in
            do {
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            } catch {
                return
            }
            guard let self,
                  !Task.isCancelled,
                  self.connectionGeneration == expectedGeneration,
                  self.configuration != nil
            else { return }
            self.reconnectTask = nil
            self.openSocket()
        }
    }
}

extension Notification.Name {
    /// Backend pushet et Leadgrid real-time event via WebSocket.
    /// userInfo: ["type": String, "channel": String, "data.<key>": String]
    /// Mulige types: lead.scored, recommendation.created, nba.updated,
    /// followup.due, lead.created, url_research.batch.progress.
    static let leadgridRealtimeEvent = Notification.Name("LeadMapApp.leadgridRealtimeEvent")
}
