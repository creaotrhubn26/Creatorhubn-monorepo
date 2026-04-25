import Foundation

/// Wraps the Live Set AI endpoints (Claude-backed coverage / replan /
/// continuity / EOD assist). Slice 2 only uses ``coverage-check`` —
/// the rest stub in later slices.
///
/// Error handling: every endpoint can timeout or return a 502 from
/// Claude itself. We surface those as ``LiveSetAIError`` so the view
/// can render a calm "AI utilgjengelig"-state instead of a crash.
actor LiveSetAIService {
    private let backend: BackendClient

    init(backend: BackendClient) {
        self.backend = backend
    }

    enum LiveSetAIError: LocalizedError {
        case backend(status: Int, body: String?)
        case transport(String)
        case decode(String)

        var errorDescription: String? {
            switch self {
            case .backend(let status, let body):
                return "AI-sjekk feilet (HTTP \(status)): \(body?.prefix(180) ?? "")"
            case .transport(let msg):
                return "Nettverksfeil under AI-sjekk: \(msg)"
            case .decode(let msg):
                return "Kunne ikke tolke AI-svaret: \(msg)"
            }
        }
    }

    /// Ask Claude whether coverage of a scene is sufficient or has
    /// gaps. The response carries a ``status`` (complete / gaps /
    /// critical), a list of ``missingCoverage`` entries (each with
    /// severity + reason), and a short summary line for the banner.
    ///
    /// Slice 2 uses one synthetic "scene" per project — future slices
    /// can subdivide once iPad gets per-scene grouping in the shot list.
    /// Errors get re-wrapped into ``LiveSetAIError`` so the view can
    /// distinguish transport failures from backend rejections.
    func checkCoverage(
        request: CoverageCheckRequest,
    ) async throws -> CoverageCheckResult {
        do {
            return try await backend.checkLiveSetCoverage(request: request)
        } catch let error as BackendError {
            switch error {
            case .httpStatus(let code, let body):
                throw LiveSetAIError.backend(status: code, body: body)
            case .transport(let msg):
                throw LiveSetAIError.transport(msg)
            case .decode(let msg):
                throw LiveSetAIError.decode(msg)
            case .unauthorized:
                throw LiveSetAIError.backend(status: 401, body: "unauthorized")
            case .notFound:
                throw LiveSetAIError.backend(status: 404, body: "not_found")
            case .notConfigured:
                throw LiveSetAIError.transport("backend not configured")
            }
        }
    }
}

// MARK: - Request

struct CoverageCheckRequest: Encodable, Sendable {
    let projectId: String
    let sceneId: String
    let scene: SceneShape
    let shotsCompleted: [ShotShape]
    let plannedShots: [ShotShape]

    struct SceneShape: Encodable, Sendable {
        let id: String?
        let sceneNumber: String?
        let heading: String?
        let description: String?
        let intExt: String?
        let timeOfDay: String?
        let characters: [String]?
    }

    struct ShotShape: Encodable, Sendable {
        let id: String
        let shotType: String?
        let cameraAngle: String?
        let description: String?
        let notes: String?
        let priority: String?
        let status: String?
        let completedAt: String?
    }
}

// MARK: - Response

/// Mirrors ``CoverageCheckResult`` from backend/server/live-set-ai-routes.ts.
/// Decoded from the route's JSON; the backend has its own ``sanitiseCoverage``
/// guard so untrusted Claude output can't poison the shape.
struct CoverageCheckResult: Decodable, Sendable, Equatable {
    let status: CoverageStatus
    let summary: String
    let missingCoverage: [MissingCoverageEntry]

    /// Convenience for the dashboard banner — picks the most-severe
    /// missing entry (critical > recommended > nice-to-have) so the
    /// at-a-glance ribbon highlights what actually matters.
    var topMissing: MissingCoverageEntry? {
        missingCoverage.sorted { lhs, rhs in
            severityRank(lhs.severity) < severityRank(rhs.severity)
        }.first
    }

    private func severityRank(_ s: CoverageSeverity) -> Int {
        switch s {
        case .critical: return 0
        case .recommended: return 1
        case .niceToHave: return 2
        }
    }
}

enum CoverageStatus: String, Decodable, Sendable {
    case complete
    case gaps
    case critical
}

enum CoverageSeverity: String, Decodable, Sendable {
    case critical
    case recommended
    case niceToHave = "nice-to-have"
}

struct MissingCoverageEntry: Decodable, Sendable, Equatable, Identifiable {
    let type: String
    let reason: String
    let severity: CoverageSeverity

    /// Synthesized id for SwiftUI ForEach — the backend doesn't return
    /// one. Combination of type + reason is stable enough for tile-level
    /// diffing within a single check result.
    var id: String { "\(type)|\(reason)" }
}
