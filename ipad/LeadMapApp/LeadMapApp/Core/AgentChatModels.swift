// AgentChatModels.swift
//
// Codable-modeller for Role Room Agent threads + meldinger eksponert
// via /api/role-room/agent/threads/* (PR feat/leadmap-ipad-pulse-workflow-chat).
//
// Streaming-event-typer matcher `handleAgentStream` i
// backend/server/role-room-agent-stream.ts:
//   - start  { model, threadId }
//   - delta  { text }
//   - tool_use { id, name, input }
//   - done   { model, threadId, usage, toolUses, transparency }
//   - error  { message }

import Foundation

struct AgentThread: Decodable, Identifiable, Sendable, Hashable {
    let id: String
    let projectId: String
    let userId: String
    let title: String?
    let createdAt: String
    let lastActiveAt: String
    let archivedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case userId = "user_id"
        case title
        case createdAt = "created_at"
        case lastActiveAt = "last_active_at"
        case archivedAt = "archived_at"
    }

    var displayTitle: String {
        if let t = title, !t.trimmingCharacters(in: .whitespaces).isEmpty {
            return t
        }
        return "Samtale \(id.prefix(6))"
    }
}

struct AgentMessage: Decodable, Identifiable, Sendable, Hashable {
    let id: String
    let threadId: String
    let role: String  // "user" | "assistant" | "system"
    let text: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case threadId = "thread_id"
        case role
        case text
        case createdAt = "created_at"
    }
}

struct AgentThreadsListResponse: Decodable, Sendable {
    let threads: [AgentThread]
}

struct AgentThreadCreateResponse: Decodable, Sendable {
    let thread: AgentThread
}

struct AgentThreadDetailResponse: Decodable, Sendable {
    let thread: AgentThread
    let messages: [AgentMessage]
}

// MARK: - Streaming

/// Et SSE-event som klienten dekoder. Backend bruker SSE-format med
/// "event: <name>\ndata: <json>\n\n". Vi normaliserer til denne typen.
enum AgentStreamEvent: Sendable, Equatable {
    case start(model: String?, threadId: String?)
    case delta(text: String)
    case toolUse(id: String, name: String, inputJSON: String)
    case done(threadId: String?, usage: AgentUsage?)
    case error(message: String)
    case unknown(name: String, raw: String)
}

struct AgentUsage: Sendable, Equatable {
    let inputTokens: Int
    let outputTokens: Int
}

/// Streaming-konfig som driver chat-viewens streaming-task.
struct AgentStreamRequest: Sendable {
    let threadId: String
    let content: String
    let requiredScope: String?

    init(threadId: String, content: String, requiredScope: String? = nil) {
        self.threadId = threadId
        self.content = content
        self.requiredScope = requiredScope
    }
}
