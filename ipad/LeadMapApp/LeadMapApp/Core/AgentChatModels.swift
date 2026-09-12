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
    let response: AgentMessageResponse?
    let createdAt: String

    init(
        id: String,
        threadId: String,
        role: String,
        text: String,
        response: AgentMessageResponse? = nil,
        createdAt: String
    ) {
        self.id = id
        self.threadId = threadId
        self.role = role
        self.text = text
        self.response = response
        self.createdAt = createdAt
    }
}

struct AgentMessageResponse: Decodable, Sendable, Hashable {
    let toolUses: [AgentToolUse]?
}

/// Persisted tool proposal. `input` remains JSON because every named skill
/// has its own strict decoder in LeadgridAgentSkillExecutor.
struct AgentToolUse: Decodable, Identifiable, Sendable, Hashable {
    let id: String
    let name: String
    let inputJSON: String

    init(id: String, name: String, inputJSON: String) {
        self.id = id
        self.name = name
        self.inputJSON = inputJSON
    }

    private enum CodingKeys: String, CodingKey { case id, name, input }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        let input = try container.decode(AgentJSONValue.self, forKey: .input)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
        inputJSON = String(data: try encoder.encode(input), encoding: .utf8) ?? "{}"
    }
}

indirect enum AgentJSONValue: Codable, Sendable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: AgentJSONValue])
    case array([AgentJSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([String: AgentJSONValue].self) { self = .object(value) }
        else { self = .array(try container.decode([AgentJSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
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

struct AgentLeadContext: Encodable, Sendable {
    let id: String
    let name: String
    let status: String
    let hasPhone: Bool
    let hasEmail: Bool
    let hasWebsite: Bool
    let nextFollowUpAt: String?
    let lastVisitAt: String?
}

struct AgentAIConsent: Decodable, Sendable, Hashable {
    let id: String
    let projectId: String
    let userId: String
    let scope: String
    let processor: String
    let grantedAt: String
    let revokedAt: String?
}

struct AgentAIConsentEnvelope: Decodable, Sendable {
    let consent: AgentAIConsent?
}
