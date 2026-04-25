import Foundation

/// Drives the Live Set dashboard — joins a project's shot list against
/// the current capture session's uploaded assets so each planned shot
/// renders either as a captured thumbnail tile (with rating + pick
/// state) or as a missing-slot tile (with priority + scene description).
///
/// Slice 1 scope: static fetch + computed tile state. Pull-to-refresh
/// triggers a re-fetch; no realtime subscription yet. Subsequent slices
/// layer on coverage-check AI, realtime push, and collage export.
@MainActor
@Observable
final class LiveSetDashboardModel {
    // MARK: - State the view binds to

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    private(set) var loadState: LoadState = .idle
    private(set) var tiles: [CoverageTile] = []
    private(set) var summary: CoverageSummary = .empty
    private(set) var projectTitle: String?

    /// Latest coverage-check result, if the photographer has run one.
    /// Slice 2 exposes a manual "AI-sjekk dekning"-button on the view
    /// rather than auto-firing, since each call is a Claude credit +
    /// 3-10s of latency we don't want to burn on every refresh.
    private(set) var coverageCheck: CoverageCheckResult?
    private(set) var coverageCheckState: CoverageCheckState = .idle

    enum CoverageCheckState: Equatable {
        case idle
        case running
        case completed
        case failed(String)
    }

    // MARK: - Dependencies

    private let backend: BackendClient
    private let aiService: LiveSetAIService
    private let projectId: String
    private let sessionId: UUID?

    init(backend: BackendClient, projectId: String, sessionId: UUID?) {
        self.backend = backend
        self.aiService = LiveSetAIService(backend: backend)
        self.projectId = projectId
        self.sessionId = sessionId
    }

    // MARK: - Load

    /// Fetch project detail (for the shot list) and the current session's
    /// assets (for thumbnails + ratings) in parallel, then join them.
    /// Tolerates an absent session — tiles still render as "missing" so
    /// the photographer can see the plan before they've shot anything.
    func refresh() async {
        loadState = .loading
        do {
            async let detailTask = backend.fetchProject(projectId: projectId)
            async let assetsTask: [BackendAsset] = {
                guard let sessionId else { return [] }
                return try await backend.listSessionAssets(sessionId: sessionId)
            }()
            let (detail, assets) = try await (detailTask, assetsTask)
            let joined = Self.join(shotList: detail.shotList, assets: assets)
            self.projectTitle = detail.title
            self.tiles = joined
            self.summary = Self.summarize(tiles: joined)
            self.loadState = .loaded
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    // MARK: - AI coverage check

    /// Trigger the Claude-backed coverage analysis. Reads the current
    /// tile state to figure out what's planned vs. captured, sends to
    /// the backend, stores the result for the view to render.
    /// Photographer triggers manually (button on the dashboard) since
    /// each call is ~3-10s of latency + a Claude credit; we don't
    /// auto-fire on refresh.
    func runCoverageCheck() async {
        guard !tiles.isEmpty else { return } // Nothing to analyse yet.
        coverageCheckState = .running
        let request = Self.buildCoverageRequest(
            projectId: projectId,
            projectTitle: projectTitle,
            tiles: tiles,
        )
        do {
            let result = try await aiService.checkCoverage(request: request)
            self.coverageCheck = result
            self.coverageCheckState = .completed
        } catch {
            self.coverageCheckState = .failed(error.localizedDescription)
        }
    }

    /// Pure builder — separate so it can be unit-tested without spinning
    /// up MainActor. Translates the iPad-side ``CoverageTile`` shapes
    /// into the film/script-supervisor schema the backend AI expects:
    /// each captured/manually-completed tile becomes a ``shotsCompleted``
    /// entry, the rest go into ``plannedShots``.
    nonisolated static func buildCoverageRequest(
        projectId: String,
        projectTitle: String?,
        tiles: [CoverageTile],
    ) -> CoverageCheckRequest {
        var completed: [CoverageCheckRequest.ShotShape] = []
        var planned: [CoverageCheckRequest.ShotShape] = []
        for tile in tiles {
            let shape = CoverageCheckRequest.ShotShape(
                id: tile.shotId,
                shotType: nil,
                cameraAngle: nil,
                description: tile.description ?? tile.scene,
                notes: nil,
                priority: priorityWord(tile.priority),
                status: tile.state.isDone ? "completed" : "planned",
                completedAt: nil,
            )
            if tile.state.isDone {
                completed.append(shape)
            } else {
                planned.append(shape)
            }
        }
        return CoverageCheckRequest(
            projectId: projectId,
            // Slice 2 treats the entire project as one synthetic
            // "scene" — coverage-check rolls up across all shots.
            // Per-scene rollups land when iPad gets scene-grouping
            // in the shot list (Slice 3+).
            sceneId: "project:\(projectId)",
            scene: .init(
                id: "project:\(projectId)",
                sceneNumber: nil,
                heading: projectTitle,
                description: nil,
                intExt: nil,
                timeOfDay: nil,
                characters: nil,
            ),
            shotsCompleted: completed,
            plannedShots: planned,
        )
    }

    private nonisolated static func priorityWord(_ priority: Priority) -> String? {
        switch priority {
        case .critical: return "critical"
        case .mustHave: return "must-have"
        case .high:     return "high"
        case .medium:   return "medium"
        case .low:      return "low"
        case .unknown:  return nil
        }
    }

    // MARK: - Joining logic (pure — unit-tested separately)

    /// For each planned shot, find the asset it was linked to (via
    /// ``BackendShotListItem.capturedAssetId``) and build a tile. Shots
    /// without a linked asset become missing-slot tiles.
    ///
    /// Ordering mirrors the photographer's shot-list order: the planner
    /// already sorted shots the way they wanted to execute them, so the
    /// dashboard respects that sequencing instead of re-sorting by
    /// priority — otherwise the UI would shuffle shots around every
    /// time a new one gets marked captured.
    nonisolated static func join(
        shotList: [BackendShotListItem],
        assets: [BackendAsset],
    ) -> [CoverageTile] {
        let assetsById = Dictionary(uniqueKeysWithValues: assets.map { ($0.id, $0) })
        return shotList.map { shot -> CoverageTile in
            if let assetId = shot.capturedAssetId,
               let asset = assetsById[assetId] {
                return CoverageTile(
                    shotId: shot.id,
                    scene: shot.scene,
                    description: shot.description,
                    priority: Priority(raw: shot.priority),
                    state: .captured(
                        previewUrl: asset.previewUrl,
                        rating: asset.rating ?? 0,
                        isFlagged: asset.flaggedForClient ?? false,
                        isRejected: asset.rejected ?? false,
                    ),
                )
            }
            return CoverageTile(
                shotId: shot.id,
                scene: shot.scene,
                description: shot.description,
                priority: Priority(raw: shot.priority),
                state: .missing(isCompleted: shot.isCompleted ?? false),
            )
        }
    }

    /// Aggregate counters for the top status line — "X av Y shots
    /// skutt, Z kritiske gjenstår". Treats a tile as "done" when the
    /// shot has either a captured asset OR is manually marked completed
    /// (the iPad `ShotListPanel` can flip completion without linking an
    /// asset — see ``capture-projects-service.setShotCompletion``).
    nonisolated static func summarize(tiles: [CoverageTile]) -> CoverageSummary {
        var captured = 0
        var completedWithoutAsset = 0
        var criticalMissing = 0
        var mustHaveMissing = 0
        for tile in tiles {
            switch tile.state {
            case .captured:
                captured += 1
            case .missing(let isCompleted):
                if isCompleted {
                    completedWithoutAsset += 1
                } else {
                    switch tile.priority {
                    case .critical: criticalMissing += 1
                    case .mustHave, .high: mustHaveMissing += 1
                    case .medium, .low, .unknown: break
                    }
                }
            }
        }
        return CoverageSummary(
            total: tiles.count,
            capturedCount: captured,
            completedWithoutAsset: completedWithoutAsset,
            criticalMissing: criticalMissing,
            mustHaveMissing: mustHaveMissing,
        )
    }
}

// MARK: - Tile + support types

struct CoverageTile: Identifiable, Hashable, Sendable {
    let shotId: String
    let scene: String
    let description: String?
    let priority: Priority
    let state: State

    var id: String { shotId }

    enum State: Hashable, Sendable {
        case captured(previewUrl: String?, rating: Int, isFlagged: Bool, isRejected: Bool)
        case missing(isCompleted: Bool)

        /// Coverage-aware "is this shot done from the photographer's
        /// perspective?" — matches the summary-aggregation logic so
        /// the AI receives the same view the dashboard renders.
        var isDone: Bool {
            switch self {
            case .captured: return true
            case .missing(let isCompleted): return isCompleted
            }
        }
    }
}

enum Priority: Hashable, Sendable {
    case critical
    case mustHave
    case high
    case medium
    case low
    case unknown

    init(raw: String?) {
        switch raw?.lowercased() {
        case "critical":                    self = .critical
        case "must", "must-have", "must_have", "musthave": self = .mustHave
        case "high":                        self = .high
        case "medium", "normal":            self = .medium
        case "low":                         self = .low
        default:                            self = .unknown
        }
    }
}

struct CoverageSummary: Equatable, Sendable {
    let total: Int
    let capturedCount: Int
    let completedWithoutAsset: Int
    let criticalMissing: Int
    let mustHaveMissing: Int

    static let empty = CoverageSummary(
        total: 0, capturedCount: 0, completedWithoutAsset: 0,
        criticalMissing: 0, mustHaveMissing: 0,
    )

    /// Combined "done" count for the top status line. Captured +
    /// completion-flag-without-asset both count as done because the
    /// shot-list service treats them equivalently in its counters.
    var doneCount: Int { capturedCount + completedWithoutAsset }
}
