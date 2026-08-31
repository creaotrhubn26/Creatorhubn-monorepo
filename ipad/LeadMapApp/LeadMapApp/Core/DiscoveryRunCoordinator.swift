// DiscoveryRunCoordinator.swift
//
// App-global owner for Discovery v2. A sheet is only a projection of this
// state; dismissing or rotating the UI never cancels a backend run.

import Foundation
import Observation
import CoreLocation

enum DiscoveryV2WorkspacePhase: Equatable, Sendable {
    case brief, preview, running, review, completed
}

struct DiscoveryV2PersistedState: Codable, Equatable, Sendable {
    var organizationId: String
    var projectId: String
    var projectName: String?
    var brief: DiscoveryV2Brief
    var preview: DiscoveryV2Preview?
    var run: DiscoveryV2Run?
    var nextCursor: String?
    var selectedProfile: DiscoveryV2Profile?
    var pendingRunIdempotencyKey: String?
    var savedAt: Date
}

@MainActor
@Observable
final class DiscoveryRunCoordinator {
    private(set) var organizationId: String?
    private(set) var projectId: String?
    private(set) var projectName: String?
    private(set) var preview: DiscoveryV2Preview?
    private(set) var run: DiscoveryV2Run?
    private(set) var candidates: [DiscoveryV2Candidate] = []
    private(set) var nextCursor: String?
    private(set) var profiles: [DiscoveryV2Profile] = []
    private(set) var selectedProfile: DiscoveryV2Profile?
    private(set) var isBusy = false
    private(set) var isLoadingMore = false
    private(set) var busyCandidateIds: Set<String> = []
    private(set) var isOfflinePaused = false
    private(set) var errorMessage: String?
    private(set) var errorIsRetryable = false

    var brief = DiscoveryV2Brief.mapArea(
        center: CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522))
    var isPresented = false
    var selectedCandidateIds: Set<String> = []

    @ObservationIgnored private var api: APIClient?
    @ObservationIgnored private var pollTask: Task<Void, Never>?
    @ObservationIgnored private var pendingRunIdempotencyKey: String?
    @ObservationIgnored private let cache: OfflineCache
    @ObservationIgnored private let networkMonitor: NetworkMonitor
    @ObservationIgnored private var configurationGeneration: UInt64 = 0

    init(
        cache: OfflineCache = .shared,
        networkMonitor: NetworkMonitor = .shared
    ) {
        self.cache = cache
        self.networkMonitor = networkMonitor
    }

    private struct ConfigurationBinding: Equatable, Sendable {
        let generation: UInt64
        let organizationId: String
        let projectId: String
    }

    var phase: DiscoveryV2WorkspacePhase {
        Self.workspacePhase(runStatus: run?.status, hasPreview: preview != nil)
    }

    nonisolated static func workspacePhase(
        runStatus: DiscoveryV2RunStatus?,
        hasPreview: Bool
    ) -> DiscoveryV2WorkspacePhase {
        guard let runStatus else { return hasPreview ? .preview : .brief }
        if runStatus.isRunning { return .running }
        if runStatus.needsReview { return .review }
        return .completed
    }

    nonisolated static func shouldResumeExistingRun(_ status: DiscoveryV2RunStatus) -> Bool {
        status.isRunning || status.needsReview
    }

    nonisolated static func configurationMatches(
        expectedGeneration: UInt64,
        expectedOrganizationId: String,
        expectedProjectId: String,
        activeGeneration: UInt64,
        activeOrganizationId: String?,
        activeProjectId: String?
    ) -> Bool {
        expectedGeneration == activeGeneration
            && expectedOrganizationId == activeOrganizationId
            && expectedProjectId == activeProjectId
    }

    private func isCurrent(_ binding: ConfigurationBinding) -> Bool {
        Self.configurationMatches(
            expectedGeneration: binding.generation,
            expectedOrganizationId: binding.organizationId,
            expectedProjectId: binding.projectId,
            activeGeneration: configurationGeneration,
            activeOrganizationId: organizationId,
            activeProjectId: projectId
        )
    }
    private func currentBinding() -> ConfigurationBinding? {
        guard let organizationId, let projectId else { return nil }
        return ConfigurationBinding(
            generation: configurationGeneration,
            organizationId: organizationId,
            projectId: projectId
        )
    }



    var showsRunBanner: Bool { run != nil && phase != .brief && phase != .preview }
    var hasMoreCandidates: Bool { nextCursor != nil }
    var canStart: Bool { preview != nil && !isBusy && networkMonitor.isOnline }

    var bannerTitle: String {
        guard let run else { return "Discovery" }
        return switch run.status {
        case .planning, .awaitingConfirmation: "Klar til å starte"
        case .queued: "Discovery står i kø"
        case .searching: "Finner bedrifter"
        case .researching: "Undersøker kandidater"
        case .reviewReady: "Kandidater klare for vurdering"
        case .completed: "Discovery er fullført"
        case .partial: "Delvis fullført – se kandidatene"
        case .cancelRequested: "Avbryter Discovery"
        case .cancelled: "Discovery ble avbrutt"
        case .failed: "Discovery feilet"
        case .unknown: "Discovery oppdateres"
        }
    }

    var bannerDetail: String {
        guard let run else { return "" }
        if run.status.needsReview {
            return "\(run.reviewReadyCount ?? candidates.count) til vurdering · \(run.approvedCount ?? 0) godkjent"
        }
        if run.status.isRunning {
            return "\(run.completedWorkCount) av \(run.totalWorkCount) behandlet"
        }
        return run.errorMessage ?? "Trykk for detaljer"
    }

    func configure(
        api: APIClient?,
        organizationId: String?,
        projectId: String?,
        projectName: String?
    ) async {
        let bindingChanged = self.organizationId != organizationId || self.projectId != projectId
        if bindingChanged {
            configurationGeneration &+= 1
        }
        self.api = api
        self.organizationId = organizationId
        self.projectId = projectId
        self.projectName = projectName

        guard let organizationId, let projectId else {
            stopPolling()
            clearInMemory(keepBrief: false)
            return
        }
        if bindingChanged {
            stopPolling()
            clearInMemory(keepBrief: false)
        }
        let binding = ConfigurationBinding(
            generation: configurationGeneration,
            organizationId: organizationId,
            projectId: projectId
        )
        if bindingChanged {
            await restore(binding: binding)
            guard isCurrent(binding) else { return }
        }
        guard api != nil else { return }
        await loadProfilesIfAvailable(
            useDefaultWhenDraftIsEmpty: preview == nil && run == nil,
            binding: binding
        )
        guard isCurrent(binding) else { return }
        await refreshAuthoritative(useServerListFallback: true, binding: binding)
        guard isCurrent(binding) else { return }
    }

    func openBrief(center: CLLocationCoordinate2D, radiusKm: Double) {
        if let status = run?.status, Self.shouldResumeExistingRun(status) {
            isPresented = true
            return
        }
        if run != nil { resetCompletedRunForNewBrief() }
        var draft = selectedProfile?.brief ?? brief
        draft.geo = .init(
            latitude: center.latitude,
            longitude: center.longitude,
            radiusKm: min(50, max(1, radiusKm)))
        draft.city = nil
        brief = draft
        preview = nil
        errorMessage = nil
        isPresented = true
        persistSoon()
    }

    func showWorkspace() { isPresented = true }
    func dismissWorkspace() { isPresented = false }

    func editBrief() {
        preview = nil
        errorMessage = nil
        persistSoon()
    }

    func requestPreview() async {
        guard let binding = currentBinding(), let api, let projectId else {
            showError("Velg et prosjekt før du starter Discovery.", retryable: false)
            return
        }
        let normalized = brief.normalized
        if let validation = normalized.validationMessage {
            showError(validation, retryable: false)
            return
        }
        guard networkMonitor.isOnline else {
            isOfflinePaused = true
            showError("Du er frakoblet. Utkastet er lagret og kan forhåndsvises når nettet er tilbake.", retryable: true)
            persistSoon()
            return
        }
        isBusy = true
        errorMessage = nil
        defer {
            if isCurrent(binding) {
                isBusy = false
            }
        }
        do {
            brief = normalized
            let fetchedPreview = try await api.previewDiscovery(projectId: projectId, brief: normalized)
            guard isCurrent(binding) else { return }
            preview = fetchedPreview
            isOfflinePaused = false
            await persist()
            guard isCurrent(binding) else { return }
        } catch {
            guard isCurrent(binding) else { return }
            handle(error)
        }
    }

    /// Creates an awaiting-confirmation run first, persists its id, then
    /// confirms it. If confirmation loses connectivity the durable run remains
    /// resumable instead of being accidentally duplicated.
    func startRun() async {
        guard let binding = currentBinding(), let api, let projectId, let preview else { return }
        guard networkMonitor.isOnline else {
            isOfflinePaused = true
            showError("Ingen nettforbindelse. Planen er lagret – prøv igjen når du er på nett.", retryable: true)
            return
        }
        isBusy = true
        errorMessage = nil
        defer {
            if isCurrent(binding) {
                isBusy = false
            }
        }
        do {
            let key = pendingRunIdempotencyKey ?? Self.makeIdempotencyKey(projectId: projectId)
            pendingRunIdempotencyKey = key
            var created = try await api.createDiscoveryRun(
                projectId: projectId,
                brief: preview.brief,
                planHash: preview.planHash,
                idempotencyKey: key,
                startImmediately: false,
                profileId: selectedProfile?.id,
                expectedProfileVersion: selectedProfile?.version)
            guard isCurrent(binding) else { return }
            run = created
            await persist()
            guard isCurrent(binding) else { return }
            if created.status == .awaitingConfirmation || created.status == .planning {
                let confirmed = try await api.confirmDiscoveryRun(projectId: projectId, runId: created.id)
                guard isCurrent(binding) else { return }
                created = confirmed
                run = created
            }
            pendingRunIdempotencyKey = nil
            isOfflinePaused = false
            await persist()
            guard isCurrent(binding) else { return }
            startPollingIfNeeded()
        } catch {
            guard isCurrent(binding) else { return }
            handle(error)
            await persist()
            guard isCurrent(binding) else { return }
        }
    }

    func resumeOrRetry() async {
        guard let binding = currentBinding() else { return }
        guard networkMonitor.isOnline else {
            isOfflinePaused = true
            return
        }
        if let run, run.status == .awaitingConfirmation || run.status == .planning,
           let api, let projectId {
            isBusy = true
            defer {
                if isCurrent(binding) {
                    isBusy = false
                }
            }
            do {
                let confirmed = try await api.confirmDiscoveryRun(projectId: projectId, runId: run.id)
                guard isCurrent(binding) else { return }
                self.run = confirmed
                errorMessage = nil
                await persist()
                guard isCurrent(binding) else { return }
                startPollingIfNeeded()
            } catch {
                guard isCurrent(binding) else { return }
                handle(error)
            }
            return
        }
        if preview != nil && run == nil {
            await startRun()
            guard isCurrent(binding) else { return }
        } else {
            await refreshAuthoritative(useServerListFallback: true)
            guard isCurrent(binding) else { return }
        }
    }

    func refreshAuthoritative(useServerListFallback: Bool = false) async {
        guard let organizationId, let projectId else {
            isOfflinePaused = !networkMonitor.isOnline
            return
        }
        let binding = ConfigurationBinding(
            generation: configurationGeneration,
            organizationId: organizationId,
            projectId: projectId
        )
        await refreshAuthoritative(useServerListFallback: useServerListFallback, binding: binding)
    }

    private func refreshAuthoritative(
        useServerListFallback: Bool,
        binding: ConfigurationBinding
    ) async {
        guard isCurrent(binding) else { return }
        guard let api, let projectId, networkMonitor.isOnline else {
            isOfflinePaused = !networkMonitor.isOnline
            return
        }
        do {
            var localFetchFailed = false
            if let current = run {
                do {
                    let fetched = try await api.fetchDiscoveryRun(projectId: projectId, runId: current.id)
                    guard isCurrent(binding) else { return }
                    run = fetched
                } catch {
                    guard isCurrent(binding) else { return }
                    guard useServerListFallback else { throw error }
                    localFetchFailed = true
                }
            }
            if useServerListFallback,
               localFetchFailed || (run.map { !Self.shouldResumeExistingRun($0.status) } ?? true) {
                let localSnapshot = localFetchFailed ? nil : run
                let serverRuns = try await api.listDiscoveryRuns(projectId: projectId)
                guard isCurrent(binding) else { return }
                run = serverRuns.first(where: { $0.status.isRunning })
                    ?? serverRuns.first(where: { $0.status.needsReview })
                    ?? localSnapshot
            }
            guard isCurrent(binding) else { return }
            isOfflinePaused = false
            errorMessage = nil
            if run?.status.needsReview == true {
                await loadCandidates(replace: true, binding: binding)
                guard isCurrent(binding) else { return }
            }
            await persist()
            guard isCurrent(binding) else { return }
            startPollingIfNeeded()
        } catch {
            guard isCurrent(binding) else { return }
            handle(error, silentWhenCached: run != nil)
        }
    }

    func cancelRun() async {
        guard let binding = currentBinding(), let api, let projectId, let run else { return }
        isBusy = true
        defer {
            if isCurrent(binding) {
                isBusy = false
            }
        }
        do {
            let cancelled = try await api.cancelDiscoveryRun(projectId: projectId, runId: run.id)
            guard isCurrent(binding) else { return }
            self.run = cancelled
            await persist()
            guard isCurrent(binding) else { return }
            if self.run?.status == .cancelled { stopPolling() }
            else { startPollingIfNeeded() }
        } catch {
            guard isCurrent(binding) else { return }
            handle(error)
        }
    }

    func loadCandidates(replace: Bool) async {
        guard let organizationId, let projectId else { return }
        let binding = ConfigurationBinding(
            generation: configurationGeneration,
            organizationId: organizationId,
            projectId: projectId
        )
        await loadCandidates(replace: replace, binding: binding)
    }

    private func loadCandidates(
        replace: Bool,
        binding: ConfigurationBinding
    ) async {
        guard isCurrent(binding) else { return }
        guard let api, let projectId, let run else { return }
        if !replace && nextCursor == nil { return }
        if replace { isBusy = true } else { isLoadingMore = true }
        defer {
            if isCurrent(binding) {
                isBusy = false
                isLoadingMore = false
            }
        }
        do {
            let page = try await api.fetchDiscoveryCandidates(
                projectId: projectId,
                runId: run.id,
                cursor: replace ? nil : nextCursor)
            guard isCurrent(binding) else { return }
            candidates = replace ? page.items : candidates + page.items.filter { item in
                !candidates.contains(where: { $0.id == item.id })
            }
            nextCursor = page.nextCursor
            await persist()
            guard isCurrent(binding) else { return }
        } catch {
            guard isCurrent(binding) else { return }
            handle(error, silentWhenCached: !candidates.isEmpty)
        }
    }

    @discardableResult
    func decide(
        candidateId: String,
        decision: DiscoveryV2Decision,
        reason: DiscoveryV2ReasonCode?,
        note: String? = nil
    ) async -> Bool {
        guard let binding = currentBinding(), let api, let projectId, let run, !busyCandidateIds.contains(candidateId) else { return false }
        if decision == .reject && reason == nil {
            showError("Velg hvorfor kandidaten avvises.", retryable: false)
            return false
        }
        busyCandidateIds.insert(candidateId)
        defer {
            if isCurrent(binding) {
                busyCandidateIds.remove(candidateId)
            }
        }
        do {
            _ = try await api.decideDiscoveryCandidate(
                projectId: projectId,
                runId: run.id,
                candidateId: candidateId,
                request: .init(decision: decision, reasonCode: reason, note: note),
                idempotencyKey: "decision-\(run.id)-\(candidateId)-\(decision.rawValue)")
            guard isCurrent(binding) else { return false }
            candidates.removeAll { $0.id == candidateId }
            selectedCandidateIds.remove(candidateId)
            let refreshed = try? await api.fetchDiscoveryRun(projectId: projectId, runId: run.id)
            guard isCurrent(binding) else { return false }
            if let refreshed { self.run = refreshed }
            await persist()
            guard isCurrent(binding) else { return false }
            return decision == .approve
        } catch {
            guard isCurrent(binding) else { return false }
            handle(error)
            return false
        }
    }

    func decideSelected(
        _ decision: DiscoveryV2Decision,
        reason: DiscoveryV2ReasonCode?
    ) async -> Int {
        guard let binding = currentBinding() else { return 0 }
        let ids = selectedCandidateIds
        var imported = 0
        for id in ids where !Task.isCancelled {
            let didImport = await decide(candidateId: id, decision: decision, reason: reason)
            guard isCurrent(binding) else { return imported }
            if didImport { imported += 1 }
        }
        return imported
    }

    func handleRealtimeEvent(_ event: [String: String]) {
        let type = event["type"] ?? ""
        guard type.hasPrefix("discovery.") || type.hasPrefix("leadgrid.discovery.") else { return }
        if let eventOrg = event["data.organization_id"], let organizationId, eventOrg != organizationId { return }
        if let eventProject = event["data.project_id"], let projectId, eventProject != projectId { return }
        if let eventRun = event["data.run_id"], let run, eventRun != run.id { return }
        Task { await refreshAuthoritative(useServerListFallback: run == nil) }
    }

    func saveDefaultProfile(named name: String = "Standard") async {
        guard let binding = currentBinding(), let api, let projectId else { return }
        isBusy = true
        defer {
            if isCurrent(binding) {
                isBusy = false
            }
        }
        do {
            let request = DiscoveryV2ProfileWrite(
                name: name,
                isDefault: true,
                expectedVersion: selectedProfile?.version,
                brief: brief.normalized)
            let saved: DiscoveryV2Profile
            if let selectedProfile {
                saved = try await api.updateDiscoveryProfile(
                    projectId: projectId, profileId: selectedProfile.id, request: request)
            } else {
                saved = try await api.createDiscoveryProfile(projectId: projectId, request: request)
            }
            guard isCurrent(binding) else { return }
            selectedProfile = saved
            if let index = profiles.firstIndex(where: { $0.id == saved.id }) {
                profiles[index] = saved
            } else { profiles.append(saved) }
            await persist()
            guard isCurrent(binding) else { return }
        } catch {
            guard isCurrent(binding) else { return }
            handle(error)
        }
    }

    func beginAnotherSearch() {
        resetCompletedRunForNewBrief()
        isPresented = true
        persistSoon()
    }

    func beginAnotherSearch(center: CLLocationCoordinate2D, radiusKm: Double) {
        resetCompletedRunForNewBrief()
        openBrief(center: center, radiusKm: radiusKm)
    }

    private func resetCompletedRunForNewBrief() {
        stopPolling()
        run = nil
        candidates = []
        nextCursor = nil
        selectedCandidateIds = []
        pendingRunIdempotencyKey = nil
        preview = nil
        errorMessage = nil
    }

    func resetForSignOut() {
        stopPolling()
        configurationGeneration &+= 1
        api = nil
        organizationId = nil
        projectId = nil
        clearInMemory(keepBrief: false)
    }

    private func loadProfilesIfAvailable(
        useDefaultWhenDraftIsEmpty: Bool,
        binding: ConfigurationBinding
    ) async {
        guard isCurrent(binding), let api, let projectId, networkMonitor.isOnline else { return }
        do {
            let loadedProfiles = try await api.listDiscoveryProfiles(projectId: projectId)
            guard isCurrent(binding) else { return }
            profiles = loadedProfiles
            selectedProfile = profiles.first(where: \.isDefault) ?? profiles.first
            if useDefaultWhenDraftIsEmpty, let selectedProfile {
                brief = selectedProfile.brief
            }
        } catch {
            // Profiles improve repeat runs but never block an ad-hoc brief.
        }
    }

    private func startPollingIfNeeded() {
        guard let binding = currentBinding(), run?.status.isRunning == true else {
            stopPolling()
            return
        }
        guard pollTask == nil else { return }
        pollTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(3))
                guard let self, !Task.isCancelled, self.isCurrent(binding) else { return }
                await self.refreshAuthoritative()
                guard self.isCurrent(binding) else { return }
                if self.run?.status.isRunning != true {
                    self.pollTask = nil
                    return
                }
            }
        }
    }

    private func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    private func restore(binding: ConfigurationBinding) async {
        let name = Self.cacheName(organizationId: binding.organizationId, projectId: binding.projectId)
        guard let cached = await cache.load(DiscoveryV2PersistedState.self, named: name)?.value,
              cached.organizationId == binding.organizationId,
              cached.projectId == binding.projectId else { return }
        guard isCurrent(binding) else { return }
        projectName = cached.projectName ?? projectName
        brief = cached.brief
        preview = cached.preview
        run = cached.run
        nextCursor = cached.nextCursor
        selectedProfile = cached.selectedProfile
        pendingRunIdempotencyKey = cached.pendingRunIdempotencyKey
    }

    private func persistSoon() {
        guard let binding = currentBinding() else { return }
        Task { @MainActor [weak self] in
            guard let self, self.isCurrent(binding) else { return }
            await self.persist(binding: binding)
        }
    }

    private func persist() async {
        guard let binding = currentBinding() else { return }
        await persist(binding: binding)
    }

    private func persist(binding: ConfigurationBinding) async {
        guard isCurrent(binding) else { return }
        let state = DiscoveryV2PersistedState(
            organizationId: binding.organizationId,
            projectId: binding.projectId,
            projectName: projectName,
            brief: brief,
            preview: preview,
            run: run,
            nextCursor: nextCursor,
            selectedProfile: selectedProfile,
            pendingRunIdempotencyKey: pendingRunIdempotencyKey,
            savedAt: Date())
        await cache.save(state, named: Self.cacheName(organizationId: binding.organizationId, projectId: binding.projectId))
    }

    private func handle(_ error: Error, silentWhenCached: Bool = false) {
        if let typed = error as? DiscoveryV2ServiceError {
            if !silentWhenCached { showError(typed.message, retryable: typed.retryable) }
            return
        }
        if let apiError = error as? APIError {
            if case .networkFailure = apiError { isOfflinePaused = true }
            if !silentWhenCached { showError(apiError.localizedDescription, retryable: apiError.isRetryable) }
            return
        }
        if !silentWhenCached { showError(error.localizedDescription, retryable: true) }
    }

    private func showError(_ message: String, retryable: Bool) {
        errorMessage = message
        errorIsRetryable = retryable
    }

    func clearError() { errorMessage = nil; errorIsRetryable = false }

    private func clearInMemory(keepBrief: Bool) {
        preview = nil
        run = nil
        candidates = []
        nextCursor = nil
        profiles = []
        selectedProfile = nil
        selectedCandidateIds = []
        pendingRunIdempotencyKey = nil
        errorMessage = nil
        isOfflinePaused = false
        isBusy = false
        isLoadingMore = false
        busyCandidateIds = []
        isPresented = false
        if !keepBrief {
            brief = .mapArea(center: CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522))
        }
    }

    static func cacheName(organizationId: String, projectId: String) -> String {
        let safe = (organizationId + "-" + projectId).map { character in
            character.isLetter || character.isNumber || character == "-" ? character : "-"
        }
        return "discovery-v2-" + String(safe)
    }

    static func makeIdempotencyKey(projectId: String) -> String {
        "ipad-\(projectId)-\(UUID().uuidString.lowercased())"
    }
}
