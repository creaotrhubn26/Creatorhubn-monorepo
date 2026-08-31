// LeadgridRealtimeClient.swift
//
// WebSocket-subscriber for backend's /ws/leadgrid-endpoint (PR #874).
// Broadcaster events via NotificationCenter slik at SwiftUI-views kan
// lytte uten å koble seg direkte til klienten.
//
// Auto-reconnect m/ exponential backoff. Every connection attempt obtains a
// fresh, short-lived single-use ticket over authenticated HTTPS; the bearer
// token is never embedded in a WebSocket URL.

import Foundation
import Observation

struct LeadgridRealtimeTicket: Decodable, Equatable, Sendable {
    let ticket: String
    let expiresAt: String
    let websocketPath: String
}

extension APIClient {
    func fetchLeadgridRealtimeTicket() async throws -> LeadgridRealtimeTicket {
        let data = try await executeRaw(
            method: "POST",
            path: "/api/leadgrid/realtime/ticket",
            body: Data("{}".utf8)
        )
        let response = try JSONDecoder().decode(LeadgridRealtimeTicket.self, from: data)
        guard !response.ticket.isEmpty,
              response.websocketPath == "/ws/leadgrid" else {
            throw APIError.invalidResponse
        }
        return response
    }
}

@MainActor
@Observable
final class LeadgridRealtimeClient {
    static let shared = LeadgridRealtimeClient()

    private var task: URLSessionWebSocketTask?
    private var session: URLSession?
    private var subscribedChannels: Set<String> = []
    private var baseURL: String = ""
    private var sessionIdentity: String = ""
    private var ticketAPI: APIClient?
    private(set) var isConnected: Bool = false
    private(set) var lastEventAt: Date?
    private var reconnectAttempts = 0
    private var heartbeatTimer: Timer?
    private var reconnectTask: Task<Void, Never>?
    private var ticketTask: Task<Void, Never>?
    private var connectionGeneration: UInt64 = 0

    private init() {}

    func connect(
        baseURL: String,
        sessionIdentity: String,
        channels: [String],
        api: APIClient
    ) {
        let requestedChannels = Set(channels)
        guard Self.requiresReconnect(
            currentBaseURL: self.baseURL,
            currentSessionIdentity: self.sessionIdentity,
            currentChannels: subscribedChannels,
            requestedBaseURL: baseURL,
            requestedSessionIdentity: sessionIdentity,
            requestedChannels: requestedChannels,
            hasActiveConnection: task != nil || ticketTask != nil
        ) else { return }

        // Backend subscribe is additive (UNION). Reusing a socket on org
        // change would retain the previous tenant feed, so replace the socket.
        disconnect()
        self.baseURL = baseURL
        self.sessionIdentity = sessionIdentity
        self.ticketAPI = api
        self.subscribedChannels = requestedChannels
        beginConnectionAttempt()
    }

    nonisolated static func requiresReconnect(
        currentBaseURL: String,
        currentSessionIdentity: String,
        currentChannels: Set<String>,
        requestedBaseURL: String,
        requestedSessionIdentity: String,
        requestedChannels: Set<String>,
        hasActiveConnection: Bool
    ) -> Bool {
        !hasActiveConnection
            || currentBaseURL != requestedBaseURL
            || currentSessionIdentity != requestedSessionIdentity
            || currentChannels != requestedChannels
    }

    nonisolated static func webSocketURL(
        baseURL: String,
        websocketPath: String,
        ticket: String
    ) -> URL? {
        guard websocketPath == "/ws/leadgrid", !ticket.isEmpty,
              var components = URLComponents(string: baseURL) else { return nil }
        if components.scheme == "https" {
            components.scheme = "wss"
        } else if components.scheme == "http" {
            components.scheme = "ws"
        } else {
            return nil
        }
        components.path = websocketPath
        components.query = nil
        components.fragment = nil
        components.queryItems = [URLQueryItem(name: "ticket", value: ticket)]
        return components.url
    }

    nonisolated static func isCurrentConnection(
        callbackGeneration: UInt64,
        activeGeneration: UInt64,
        hasMatchingTask: Bool
    ) -> Bool {
        callbackGeneration == activeGeneration && hasMatchingTask
    }

    func disconnect() {
        connectionGeneration &+= 1
        ticketTask?.cancel()
        ticketTask = nil
        reconnectTask?.cancel()
        reconnectTask = nil
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        session?.invalidateAndCancel()
        session = nil
        subscribedChannels.removeAll()
        baseURL = ""
        sessionIdentity = ""
        ticketAPI = nil
        isConnected = false
    }

    private func beginConnectionAttempt() {
        guard let ticketAPI else { return }

        reconnectTask?.cancel()
        reconnectTask = nil
        ticketTask?.cancel()
        ticketTask = nil
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        session?.invalidateAndCancel()
        session = nil
        isConnected = false

        connectionGeneration &+= 1
        let generation = connectionGeneration
        ticketTask = Task { @MainActor [weak self] in
            do {
                let credential = try await ticketAPI.fetchLeadgridRealtimeTicket()
                guard !Task.isCancelled, let self,
                      generation == self.connectionGeneration else { return }
                self.ticketTask = nil
                self.openSocket(credential: credential, generation: generation)
            } catch {
                guard !Task.isCancelled, let self,
                      generation == self.connectionGeneration else { return }
                self.ticketTask = nil
                self.isConnected = false
                print("[leadgrid-rt] Ticket request failed: \(error.localizedDescription)")
                self.scheduleReconnect(generation: generation)
            }
        }
    }

    private func openSocket(
        credential: LeadgridRealtimeTicket,
        generation: UInt64
    ) {
        guard generation == connectionGeneration else { return }
        guard let url = Self.webSocketURL(
            baseURL: baseURL,
            websocketPath: credential.websocketPath,
            ticket: credential.ticket
        ) else {
            print("[leadgrid-rt] Ugyldig URL: \(baseURL)")
            scheduleReconnect(generation: generation)
            return
        }
        let s = URLSession(configuration: .default)
        session = s
        let t = s.webSocketTask(with: url)
        task = t
        t.resume()
        receiveLoop(task: t, generation: generation)
        startHeartbeat(task: t, generation: generation)
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

    private func receiveLoop(task socketTask: URLSessionWebSocketTask, generation: UInt64) {
        socketTask.receive { [weak self] result in
            guard let self else { return }
            Task { @MainActor in
                guard Self.isCurrentConnection(
                    callbackGeneration: generation,
                    activeGeneration: self.connectionGeneration,
                    hasMatchingTask: self.task === socketTask
                ) else { return }
                switch result {
                case .success(let message):
                    if !self.isConnected {
                        self.isConnected = true
                        self.reconnectAttempts = 0
                        self.sendSubscription()
                    }
                    self.handle(message: message, task: socketTask, generation: generation)
                    self.receiveLoop(task: socketTask, generation: generation)
                case .failure(let error):
                    print("[leadgrid-rt] receive failed: \(error.localizedDescription)")
                    self.isConnected = false
                    self.scheduleReconnect(generation: generation, task: socketTask)
                }
            }
        }
    }

    private func handle(
        message: URLSessionWebSocketTask.Message,
        task socketTask: URLSessionWebSocketTask,
        generation: UInt64
    ) {
        guard Self.isCurrentConnection(
            callbackGeneration: generation,
            activeGeneration: connectionGeneration,
            hasMatchingTask: task === socketTask
        ) else { return }
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
        if type.hasPrefix("discovery.") || type.hasPrefix("leadgrid.discovery.") {
            NotificationCenter.default.post(
                name: .leadgridDiscoveryRealtimeEvent,
                object: nil,
                userInfo: safe
            )
        }
    }

    private func startHeartbeat(task socketTask: URLSessionWebSocketTask, generation: UInt64) {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                guard Self.isCurrentConnection(
                    callbackGeneration: generation,
                    activeGeneration: self.connectionGeneration,
                    hasMatchingTask: self.task === socketTask
                ) else { return }
                self.send(["type": "pong"])
            }
        }
    }

    private func scheduleReconnect(
        generation: UInt64,
        task socketTask: URLSessionWebSocketTask? = nil
    ) {
        guard generation == connectionGeneration else { return }
        if let socketTask, task !== socketTask { return }
        reconnectTask?.cancel()
        reconnectAttempts += 1
        let delay = min(pow(2.0, Double(reconnectAttempts)), 32.0)
        reconnectTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            guard let self else { return }
            guard !Task.isCancelled else { return }
            guard generation == self.connectionGeneration else { return }
            if let socketTask, self.task !== socketTask { return }
            self.beginConnectionAttempt()
        }
    }
}

extension Notification.Name {
    /// Backend pushet et Leadgrid real-time event via WebSocket.
    /// userInfo: ["type": String, "channel": String, "data.<key>": String]
    /// Mulige types: lead.scored, recommendation.created, nba.updated,
    /// followup.due, lead.created, url_research.batch.progress.
    static let leadgridRealtimeEvent = Notification.Name("LeadMapApp.leadgridRealtimeEvent")
    static let leadgridDiscoveryRealtimeEvent = Notification.Name("LeadMapApp.leadgridDiscoveryRealtimeEvent")
}
