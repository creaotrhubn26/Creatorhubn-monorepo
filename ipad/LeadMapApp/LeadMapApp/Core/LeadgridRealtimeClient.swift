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

    private var task: URLSessionWebSocketTask?
    private var session: URLSession?
    private var subscribedChannels: Set<String> = []
    private var baseURL: String = ""
    private var authToken: String = ""
    private(set) var isConnected: Bool = false
    private(set) var lastEventAt: Date?
    private var reconnectAttempts = 0
    private var heartbeatTimer: Timer?
    private var reconnectTask: Task<Void, Never>?

    private init() {}

    func connect(baseURL: String, token: String, channels: [String]) {
        guard !isConnected else { return }
        self.baseURL = baseURL
        self.authToken = token
        self.subscribedChannels = Set(channels)
        openSocket()
    }

    func disconnect() {
        reconnectTask?.cancel()
        reconnectTask = nil
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        isConnected = false
    }

    private func openSocket() {
        var components = URLComponents(string: baseURL)
        if components?.scheme == "https" {
            components?.scheme = "wss"
        } else if components?.scheme == "http" {
            components?.scheme = "ws"
        }
        components?.path = "/ws/leadgrid"
        components?.queryItems = [URLQueryItem(name: "token", value: authToken)]
        guard let url = components?.url else {
            print("[leadgrid-rt] Ugyldig URL: \(baseURL)")
            return
        }
        let s = URLSession(configuration: .default)
        session = s
        let t = s.webSocketTask(with: url)
        task = t
        t.resume()
        receiveLoop()
        startHeartbeat()
    }

    private func sendSubscription() {
        guard !subscribedChannels.isEmpty else { return }
        send(["type": "subscribe", "channels": Array(subscribedChannels)])
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

    private func receiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            Task { @MainActor in
                switch result {
                case .success(let message):
                    if !self.isConnected {
                        self.isConnected = true
                        self.reconnectAttempts = 0
                        self.sendSubscription()
                    }
                    self.handle(message: message)
                    self.receiveLoop()
                case .failure(let error):
                    print("[leadgrid-rt] receive failed: \(error.localizedDescription)")
                    self.isConnected = false
                    self.scheduleReconnect()
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

    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.send(["type": "pong"])
            }
        }
    }

    private func scheduleReconnect() {
        reconnectTask?.cancel()
        reconnectAttempts += 1
        let delay = min(pow(2.0, Double(reconnectAttempts)), 32.0)
        reconnectTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            guard let self else { return }
            if !Task.isCancelled {
                await MainActor.run {
                    self.openSocket()
                }
            }
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
