// DiscoveryRunCoordinator.swift
//
// App-global owner for Discovery v2. A sheet is only a projection of this
// state; dismissing or rotating the UI never cancels a backend run.

import Foundation
import Observation
import CoreLocation
import CryptoKit

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
    var placesDetailsEnabled: Bool?
    var pendingRunIdempotencyKey: String?
    var campaigns: [DiscoveryV2CampaignRun]?
    var pendingCampaignStartIdempotencyKey: String?
    var pendingCampaignStart: DiscoveryV2PendingCampaignStart?
    var isShowingCampaignOverview: Bool?
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
    private(set) var campaigns: [DiscoveryV2CampaignRun] = []
    private(set) var isCampaignBusy = false
    private(set) var isShowingCampaignOverview = false
    private(set) var selectedProfile: DiscoveryV2Profile?
    private(set) var isBusy = false
    private(set) var isStartingRun = false
    private(set) var isLoadingMore = false
    private(set) var busyCandidateIds: Set<String> = []
    private(set) var isOfflinePaused = false
    private(set) var errorMessage: String?
    private(set) var errorIsRetryable = false
    private(set) var placesDetailsEnabled = false
    /// Transient, user-confirmed Places identities keyed by candidate. These
    /// are deliberately not part of DiscoveryV2PersistedState; the backend
    /// receives one only as part of an explicit approve decision.
    private(set) var confirmedPlaceMatches: [String: DiscoveryV2PlaceMatch] = [:]

    var brief = DiscoveryV2Brief.mapArea(
        center: CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522))
    var isPresented = false
    var selectedCandidateIds: Set<String> = []

    @ObservationIgnored private var api: APIClient?
    @ObservationIgnored private var actorUserId: String?
    @ObservationIgnored private var pollTask: Task<Void, Never>?
    @ObservationIgnored private var campaignPollTask: Task<Void, Never>?
    @ObservationIgnored private var pendingRunIdempotencyKey: String?
    @ObservationIgnored private var pendingCampaignStartIdempotencyKey: String?
    @ObservationIgnored private var pendingCampaignStart: DiscoveryV2PendingCampaignStart?
    @ObservationIgnored private var runSelectionGeneration: UInt64 = 0
    @ObservationIgnored private var campaignRequestGeneration: UInt64 = 0
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
        let actorUserId: String
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
        binding.actorUserId == actorUserId && Self.configurationMatches(
            expectedGeneration: binding.generation,
            expectedOrganizationId: binding.organizationId,
            expectedProjectId: binding.projectId,
            activeGeneration: configurationGeneration,
            activeOrganizationId: organizationId,
            activeProjectId: projectId
        )
    }

    @discardableResult
    private func beginRunSelection() -> UInt64 {
        runSelectionGeneration &+= 1
        // Every run transition owns these flags. Clearing them here prevents
        // a fenced-out request for run A from leaving the overview or run B
        // permanently busy after the user switches selection.
        isBusy = false
        isLoadingMore = false
        busyCandidateIds = []
        return runSelectionGeneration
    }

    private func isCurrentRunSelection(
        _ generation: UInt64,
        expectedRunId: String?
    ) -> Bool {
        Self.runSelectionMatches(
            expectedGeneration: generation,
            expectedRunId: expectedRunId,
            currentGeneration: runSelectionGeneration,
            currentRunId: run?.id)
    }

    nonisolated static func runSelectionMatches(
        expectedGeneration: UInt64,
        expectedRunId: String?,
        currentGeneration: UInt64,
        currentRunId: String?
    ) -> Bool {
        expectedGeneration == currentGeneration && expectedRunId == currentRunId
    }

    nonisolated static func campaignOverviewNavigationAllowed(
        hasCampaigns: Bool,
        isBusy: Bool,
        isStartingRun: Bool
    ) -> Bool {
        hasCampaigns && !isBusy && !isStartingRun
    }

    @discardableResult
    private func beginCampaignRequest() -> UInt64 {
        campaignRequestGeneration &+= 1
        return campaignRequestGeneration
    }

    nonisolated static func shouldApplyCampaignResponse(
        requestGeneration: UInt64,
        currentRequestGeneration: UInt64,
        incomingVersion: Int,
        storedVersion: Int?
    ) -> Bool {
        requestGeneration == currentRequestGeneration
            && incomingVersion >= (storedVersion ?? Int.min)
    }
    private func currentBinding() -> ConfigurationBinding? {
        guard let actorUserId, let organizationId, let projectId else { return nil }
        return ConfigurationBinding(
            generation: configurationGeneration,
            actorUserId: actorUserId,
            organizationId: organizationId,
            projectId: projectId
        )
    }



    var showsRunBanner: Bool { run != nil && phase != .brief && phase != .preview }
    var activeCampaign: DiscoveryV2CampaignRun? {
        campaigns.first(where: \.needsStatusPolling)
    }
    var latestCampaign: DiscoveryV2CampaignRun? { activeCampaign ?? campaigns.first }
    var canNavigateToCampaignOverview: Bool {
        Self.campaignOverviewNavigationAllowed(
            hasCampaigns: !campaigns.isEmpty,
            isBusy: isBusy,
            isStartingRun: isStartingRun)
    }
    var hasMoreCandidates: Bool { nextCursor != nil }
    var canStart: Bool { preview != nil && !isBusy && networkMonitor.isOnline }
    var hasUnsavedProfileChanges: Bool {
        guard let selectedProfile else { return true }
        return brief.normalized != selectedProfile.brief.normalized
            || placesDetailsEnabled != (selectedProfile.placesDetailsEnabled == true)
    }

    /// A run may claim saved-profile lineage only when the exact previewed
    /// configuration still matches that saved profile. Edited drafts remain
    /// runnable, but are deliberately sent as ad-hoc runs.
    var previewRunProfile: DiscoveryV2Profile? {
        guard let preview else { return nil }
        return Self.profileForRun(
            selectedProfile,
            previewBrief: preview.brief,
            placesDetailsEnabled: placesDetailsEnabled)
    }

    nonisolated static func profileForRun(
        _ selectedProfile: DiscoveryV2Profile?,
        previewBrief: DiscoveryV2Brief,
        placesDetailsEnabled: Bool
    ) -> DiscoveryV2Profile? {
        guard let selectedProfile,
              selectedProfile.version > 0,
              previewBrief.normalized == selectedProfile.brief.normalized,
              placesDetailsEnabled == (selectedProfile.placesDetailsEnabled == true)
        else { return nil }
        return selectedProfile
    }

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
        actorUserId: String?,
        organizationId: String?,
        projectId: String?,
        projectName: String?
    ) async {
        let normalizedActorUserId = actorUserId?.trimmingCharacters(in: .whitespacesAndNewlines)
        let verifiedActorUserId = normalizedActorUserId?.isEmpty == false
            ? normalizedActorUserId
            : nil
        let bindingChanged = self.actorUserId != verifiedActorUserId
            || self.organizationId != organizationId
            || self.projectId != projectId
        if bindingChanged {
            configurationGeneration &+= 1
        }
        self.api = api
        self.actorUserId = verifiedActorUserId
        self.organizationId = organizationId
        self.projectId = projectId
        self.projectName = projectName

        guard let verifiedActorUserId, let organizationId, let projectId else {
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
            actorUserId: verifiedActorUserId,
            organizationId: organizationId,
            projectId: projectId
        )
        var restoredLocalState = false
        if bindingChanged {
            restoredLocalState = await restore(binding: binding)
            guard isCurrent(binding) else { return }
        }
        guard api != nil else { return }
        if pendingCampaignStart != nil {
            await resumePendingCampaignStart(binding: binding)
            guard isCurrent(binding) else { return }
        }
        await loadProfilesIfAvailable(
            useDefaultWhenDraftIsEmpty: bindingChanged && !restoredLocalState,
            binding: binding
        )
        guard isCurrent(binding) else { return }
        await refreshCampaigns(binding: binding, silentWhenCached: true)
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
        draft.municipalityNames = []
        draft.municipalityNumbers = []
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
        isShowingCampaignOverview = false
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
        let selectionGeneration = beginRunSelection()
        isShowingCampaignOverview = false
        isStartingRun = true
        isBusy = true
        errorMessage = nil
        defer {
            if isCurrent(binding), runSelectionGeneration == selectionGeneration {
                isStartingRun = false
                isBusy = false
            }
        }
        do {
            let key = pendingRunIdempotencyKey ?? Self.makeIdempotencyKey(projectId: projectId)
            pendingRunIdempotencyKey = key
            let linkedProfile = Self.profileForRun(
                selectedProfile,
                previewBrief: preview.brief,
                placesDetailsEnabled: placesDetailsEnabled)
            var created = try await api.createDiscoveryRun(
                projectId: projectId,
                brief: preview.brief,
                planHash: preview.planHash,
                idempotencyKey: key,
                startImmediately: false,
                profileId: linkedProfile?.id,
                expectedProfileVersion: linkedProfile?.version)
            guard isCurrent(binding),
                  runSelectionGeneration == selectionGeneration,
                  run == nil else { return }
            run = created
            await persist()
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: created.id) else { return }
            if created.status == .awaitingConfirmation || created.status == .planning {
                let confirmed = try await api.confirmDiscoveryRun(projectId: projectId, runId: created.id)
                guard isCurrent(binding),
                      isCurrentRunSelection(selectionGeneration, expectedRunId: created.id) else { return }
                created = confirmed
                run = created
            }
            pendingRunIdempotencyKey = nil
            isOfflinePaused = false
            await persist()
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: created.id) else { return }
            startPollingIfNeeded()
        } catch {
            guard isCurrent(binding), runSelectionGeneration == selectionGeneration else { return }
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
        if pendingCampaignStart != nil {
            await resumePendingCampaignStart(binding: binding)
            return
        }
        if let run, run.status == .awaitingConfirmation || run.status == .planning,
           let api, let projectId {
            let selectionGeneration = runSelectionGeneration
            let expectedRunId = run.id
            isBusy = true
            defer {
                if isCurrent(binding),
                   isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) {
                    isBusy = false
                }
            }
            do {
                let confirmed = try await api.confirmDiscoveryRun(projectId: projectId, runId: run.id)
                guard isCurrent(binding),
                      isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return }
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
        guard let actorUserId, let organizationId, let projectId else {
            isOfflinePaused = !networkMonitor.isOnline
            return
        }
        let binding = ConfigurationBinding(
            generation: configurationGeneration,
            actorUserId: actorUserId,
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
        if isShowingCampaignOverview { return }
        let selectionGeneration = runSelectionGeneration
        let expectedRunId = run?.id
        do {
            var localFetchFailed = false
            if let current = run {
                do {
                    let fetched = try await api.fetchDiscoveryRun(projectId: projectId, runId: current.id)
                    guard isCurrent(binding),
                          isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return }
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
                guard isCurrent(binding),
                      isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return }
                let selectedRun = serverRuns.first(where: { $0.status.isRunning })
                    ?? serverRuns.first(where: { $0.status.needsReview })
                    ?? localSnapshot
                if selectedRun?.id != run?.id {
                    _ = beginRunSelection()
                }
                run = selectedRun
            }
            guard isCurrent(binding) else { return }
            alignSelectedProfileWithRun()
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
        let selectionGeneration = runSelectionGeneration
        let expectedRunId = run.id
        isBusy = true
        defer {
            if isCurrent(binding),
               isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) {
                isBusy = false
            }
        }
        do {
            let cancelled = try await api.cancelDiscoveryRun(projectId: projectId, runId: run.id)
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return }
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
        guard let actorUserId, let organizationId, let projectId else { return }
        let binding = ConfigurationBinding(
            generation: configurationGeneration,
            actorUserId: actorUserId,
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
        let selectionGeneration = runSelectionGeneration
        let expectedRunId = run.id
        if !replace && nextCursor == nil { return }
        if replace { isBusy = true } else { isLoadingMore = true }
        defer {
            if isCurrent(binding),
               isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) {
                isBusy = false
                isLoadingMore = false
            }
        }
        do {
            let page = try await api.fetchDiscoveryCandidates(
                projectId: projectId,
                runId: run.id,
                cursor: replace ? nil : nextCursor)
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return }
            candidates = replace ? page.items : candidates + page.items.filter { item in
                !candidates.contains(where: { $0.id == item.id })
            }
            if replace {
                let visibleCandidateIds = Set(candidates.map(\.id))
                confirmedPlaceMatches = confirmedPlaceMatches.filter {
                    visibleCandidateIds.contains($0.key)
                }
            }
            nextCursor = page.nextCursor
            await persist()
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return }
        } catch {
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return }
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
        let selectionGeneration = runSelectionGeneration
        let expectedRunId = run.id
        if decision == .reject && reason == nil {
            showError("Velg hvorfor kandidaten avvises.", retryable: false)
            return false
        }
        busyCandidateIds.insert(candidateId)
        defer {
            if isCurrent(binding),
               isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) {
                busyCandidateIds.remove(candidateId)
            }
        }
        do {
            let confirmedPlaceMatch = decision == .approve
                ? confirmedPlaceMatches[candidateId]
                : nil
            if let confirmedPlaceMatch,
               !confirmedPlaceMatch.hasFreshConfirmation() {
                confirmedPlaceMatches.removeValue(forKey: candidateId)
                showError(
                    "Google Maps-bekreftelsen er utløpt. Hent detaljene og bekreft virksomheten på nytt.",
                    retryable: false)
                return false
            }
            let confirmedGooglePlaceId = confirmedPlaceMatch?.placeId
            _ = try await api.decideDiscoveryCandidate(
                projectId: projectId,
                runId: run.id,
                candidateId: candidateId,
                request: .init(
                    decision: decision,
                    reasonCode: reason,
                    note: note,
                    confirmedGooglePlaceId: confirmedGooglePlaceId),
                idempotencyKey: Self.decisionIdempotencyKey(
                    runId: run.id,
                    candidateId: candidateId,
                    decision: decision,
                    confirmedGooglePlaceId: confirmedGooglePlaceId,
                    placeConfirmationExpiresAt: confirmedPlaceMatch?.confirmationExpiresAt))
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return false }
            candidates.removeAll { $0.id == candidateId }
            selectedCandidateIds.remove(candidateId)
            confirmedPlaceMatches.removeValue(forKey: candidateId)
            let refreshed = try? await api.fetchDiscoveryRun(projectId: projectId, runId: run.id)
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return false }
            if let refreshed { self.run = refreshed }
            await persist()
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return false }
            return decision == .approve
        } catch let error as DiscoveryV2ServiceError
            where error.code == "place_confirmation_required" {
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return false }
            confirmedPlaceMatches.removeValue(forKey: candidateId)
            showError(
                "Google Maps-bekreftelsen er ikke lenger gyldig. Hent detaljene og velg virksomheten på nytt.",
                retryable: false)
            return false
        } catch {
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return false }
            handle(error)
            return false
        }
    }

    func decideSelected(
        _ decision: DiscoveryV2Decision,
        reason: DiscoveryV2ReasonCode?
    ) async -> Int {
        guard let binding = currentBinding(), let expectedRunId = run?.id else { return 0 }
        let selectionGeneration = runSelectionGeneration
        let ids = selectedCandidateIds
        var imported = 0
        for id in ids where !Task.isCancelled {
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return imported }
            let didImport = await decide(candidateId: id, decision: decision, reason: reason)
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else { return imported }
            if didImport { imported += 1 }
        }
        return imported
    }

    func confirmPlaceMatch(_ match: DiscoveryV2PlaceMatch, candidateId: String) {
        guard placesDetailsEnabled,
              candidates.contains(where: { $0.id == candidateId }),
              !match.placeId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              match.hasFreshConfirmation()
        else {
            showError(
                "Google Maps-bekreftelsen mangler eller er utløpt. Hent detaljene på nytt.",
                retryable: false)
            return
        }
        confirmedPlaceMatches[candidateId] = match
    }

    func clearConfirmedPlaceMatch(candidateId: String) {
        confirmedPlaceMatches.removeValue(forKey: candidateId)
    }

    func handleRealtimeEvent(_ event: [String: String]) {
        let type = event["type"] ?? ""
        guard type.hasPrefix("discovery.") || type.hasPrefix("leadgrid.discovery.") else { return }
        if let eventOrg = event["data.organization_id"], let organizationId, eventOrg != organizationId { return }
        if let eventProject = event["data.project_id"], let projectId, eventProject != projectId { return }
        if isShowingCampaignOverview {
            guard let binding = currentBinding(), let campaignId = activeCampaign?.id else { return }
            Task {
                _ = await refreshCampaign(
                    id: campaignId,
                    binding: binding,
                    silentWhenCached: true)
            }
            return
        }
        if let eventRun = event["data.run_id"], let run, eventRun != run.id { return }
        Task { await refreshAuthoritative(useServerListFallback: run == nil) }
    }

    func selectProfile(_ profile: DiscoveryV2Profile) {
        guard !isBusy, run == nil else { return }
        selectedProfile = profile
        brief = profile.brief
        placesDetailsEnabled = profile.placesDetailsEnabled == true
        preview = nil
        errorMessage = nil
        persistSoon()
    }

    func startUnsavedProfileDraft(copyingCurrentBrief: Bool = true) {
        guard !isBusy, run == nil else { return }
        selectedProfile = nil
        if !copyingCurrentBrief {
            brief = .mapArea(
                center: CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522))
            placesDetailsEnabled = false
        }
        preview = nil
        errorMessage = nil
        persistSoon()
    }

    func createProfile(named name: String, isDefault: Bool) async {
        await saveProfile(named: name, isDefault: isDefault, forceCreate: true)
    }

    func createProfilePreset(
        _ preset: DiscoveryV2ProfilePreset,
        copying baseBrief: DiscoveryV2Brief,
        idempotencyKey: String
    ) async -> DiscoveryV2ProfileBatchResult {
        let drafts = preset.drafts(copying: baseBrief)
        var result = DiscoveryV2ProfileBatchResult(
            createdNames: [],
            existingNames: [],
            failedNames: [])
        guard let binding = currentBinding(), let api, let projectId else {
            result.failedNames = drafts.map(\.name)
            showError("Velg et kundeprosjekt før profilpakken opprettes.", retryable: false)
            return result
        }
        let invalid = drafts.filter { $0.brief.validationMessage != nil }
        guard invalid.isEmpty else {
            result.failedNames = invalid.map(\.name)
            showError(
                invalid.first?.brief.validationMessage
                    ?? "Fyll ut kundetype og ICP før profilpakken opprettes.",
                retryable: false)
            return result
        }

        isBusy = true
        errorMessage = nil
        defer {
            if isCurrent(binding) { isBusy = false }
        }

        var knownProfiles = profiles
        if let fresh = try? await api.listDiscoveryProfiles(projectId: projectId),
           isCurrent(binding) {
            knownProfiles = fresh
            profiles = fresh
        }
        let conflictingDrafts = drafts.filter {
            Self.conflictingProfile(for: $0, in: knownProfiles) != nil
        }
        guard conflictingDrafts.isEmpty else {
            result.failedNames = conflictingDrafts.map(\.name)
            showError(
                "Et eksisterende territorium har en annen kundetype, ICP eller andre filtre. Oppdater eller arkiver konfliktprofilen før pakken opprettes.",
                retryable: false)
            return result
        }
        result.existingNames = drafts
            .filter { Self.profile($0, existsIn: knownProfiles) }
            .map(\.name)
        let missingDrafts = drafts.filter { !Self.profile($0, existsIn: knownProfiles) }

        if !missingDrafts.isEmpty {
            let needsDefaultProfile = !knownProfiles.contains(where: \.isDefault)
            let requests = missingDrafts.enumerated().map { index, draft in
                DiscoveryV2ProfileWrite(
                    name: draft.name,
                    isDefault: needsDefaultProfile && index == 0,
                    expectedVersion: nil,
                    brief: draft.brief.normalized,
                    placesDetailsEnabled: placesDetailsEnabled)
            }
            do {
                let response = try await api.createDiscoveryProfilesBatch(
                    projectId: projectId,
                    request: .init(profiles: requests),
                    idempotencyKey: idempotencyKey)
                guard isCurrent(binding), !Task.isCancelled else { return result }
                result.createdNames = response.profiles.map(\.name)
                result.replayed = response.replayed
                for saved in response.profiles {
                    if let index = knownProfiles.firstIndex(where: { $0.id == saved.id }) {
                        knownProfiles[index] = saved
                    } else {
                        knownProfiles.append(saved)
                    }
                }
            } catch {
                guard isCurrent(binding) else { return result }
                result.failedNames = missingDrafts.map(\.name)
                showError(
                    "Ingen av de manglende profilene ble opprettet. Batchen er atomisk; prøv igjen med samme sikre forsøk.",
                    retryable: true)
                return result
            }
        }

        guard isCurrent(binding), !Task.isCancelled else { return result }
        if let refreshed = try? await api.listDiscoveryProfiles(projectId: projectId),
           isCurrent(binding) {
            knownProfiles = refreshed
        }
        profiles = knownProfiles
        if let firstDraft = drafts.first,
           let firstProfile = knownProfiles.first(where: {
               Self.profile(firstDraft, matches: $0)
           }) {
            selectedProfile = firstProfile
            brief = firstProfile.brief
            placesDetailsEnabled = firstProfile.placesDetailsEnabled == true
            preview = nil
        }
        await persist()
        return result
    }



    func orderedProfiles(
        for preset: DiscoveryV2ProfilePreset,
        copying baseBrief: DiscoveryV2Brief
    ) -> [DiscoveryV2Profile] {
        preset.drafts(copying: baseBrief).compactMap { draft in
            profiles.first(where: {
                $0.isActive && Self.profile(draft, matches: $0)
            })
        }
    }

    func startCampaign(name: String, profiles orderedProfiles: [DiscoveryV2Profile]) async {
        guard let binding = currentBinding(), let api, let projectId else {
            showError("Velg et kundeprosjekt før kampanjen startes.", retryable: false)
            return
        }
        guard !isCampaignBusy else { return }
        if pendingCampaignStart != nil {
            await resumePendingCampaignStart(binding: binding)
            return
        }
        guard activeCampaign == nil else {
            showError("Prosjektet har allerede en aktiv Discovery-kampanje.", retryable: false)
            return
        }
        guard networkMonitor.isOnline else {
            isOfflinePaused = true
            showError("Ingen nettforbindelse. Kampanjen er ikke startet.", retryable: true)
            return
        }
        // Re-read status/version immediately before accepting the confirmed
        // request. A second device may have paused or edited a profile while
        // the confirmation dialog was open.
        isCampaignBusy = true
        do {
            let freshProfiles = try await api.listDiscoveryProfiles(projectId: projectId)
            guard isCurrent(binding) else { return }
            profiles = freshProfiles
            isCampaignBusy = false
        } catch {
            guard isCurrent(binding) else { return }
            isCampaignBusy = false
            handle(error)
            return
        }
        let profileIds = orderedProfiles.map(\.id)
        let confirmedDrafts = DiscoveryV2ProfilePreset.osloRegionClinicPilot
            .drafts(copying: brief)
        guard !orderedProfiles.isEmpty,
              orderedProfiles.count == confirmedDrafts.count,
              profileIds.count == Set(profileIds).count,
              (zip(confirmedDrafts, orderedProfiles).allSatisfy { draft, profile in
                  profile.isActive && Self.profile(draft, matches: profile)
              }),
              orderedProfiles.allSatisfy({ ordered in
                  profiles.contains(where: {
                      $0.id == ordered.id && $0.version == ordered.version
                  })
              })
        else {
            showError(
                "En kampanjeprofil ble endret eller pauset etter bekreftelsen. Se gjennom de fire profilene på nytt.",
                retryable: false)
            return
        }
        let request = DiscoveryV2CampaignCreateRequest(
            name: name,
            profiles: orderedProfiles.map {
                .init(profileId: $0.id, expectedVersion: $0.version)
            })
        let key = Self.makeCampaignStartIdempotencyKey(projectId: projectId)
        pendingCampaignStartIdempotencyKey = key
        pendingCampaignStart = .init(request: request, idempotencyKey: key)
        await persist(binding: binding)
        guard isCurrent(binding) else { return }
        await resumePendingCampaignStart(binding: binding)
    }

    private func resumePendingCampaignStart(binding: ConfigurationBinding) async {
        guard isCurrent(binding), !isCampaignBusy,
              let api, let projectId, let pending = pendingCampaignStart else { return }
        guard networkMonitor.isOnline else {
            isOfflinePaused = true
            showError("Ingen nettforbindelse. Kampanjestarten er lagret og kan prøves igjen.", retryable: true)
            return
        }
        isCampaignBusy = true
        stopCampaignPolling()
        let requestGeneration = beginCampaignRequest()
        errorMessage = nil
        defer {
            if isCurrent(binding) {
                isCampaignBusy = false
                startCampaignPollingIfNeeded()
            }
        }
        do {
            let mutation = try await api.createDiscoveryCampaign(
                projectId: projectId,
                request: pending.request,
                idempotencyKey: pending.idempotencyKey)
            guard isCurrent(binding), requestGeneration == campaignRequestGeneration else { return }
            _ = upsertCampaign(mutation.campaign, requestGeneration: requestGeneration)
            pendingCampaignStartIdempotencyKey = nil
            pendingCampaignStart = nil
            isOfflinePaused = false
            await persist(binding: binding)
            guard isCurrent(binding) else { return }
            startCampaignPollingIfNeeded()
        } catch let error as DiscoveryV2ServiceError {
            guard isCurrent(binding), requestGeneration == campaignRequestGeneration else { return }
            if error.code == "campaign_already_active" {
                if let fetched = try? await api.listDiscoveryCampaigns(
                    projectId: projectId,
                    limit: 10),
                   isCurrent(binding),
                   requestGeneration == campaignRequestGeneration {
                    campaigns = fetched
                }
                pendingCampaignStartIdempotencyKey = nil
                pendingCampaignStart = nil
            } else if !error.retryable {
                pendingCampaignStartIdempotencyKey = nil
                pendingCampaignStart = nil
            }
            handle(error)
            await persist(binding: binding)
        } catch {
            guard isCurrent(binding), requestGeneration == campaignRequestGeneration else { return }
            handle(error)
            await persist(binding: binding)
        }
    }

    func refreshCampaigns() async {
        guard !isCampaignBusy, let binding = currentBinding() else { return }
        await refreshCampaigns(binding: binding, silentWhenCached: !campaigns.isEmpty)
    }

    private func refreshCampaigns(
        binding: ConfigurationBinding,
        silentWhenCached: Bool
    ) async {
        guard isCurrent(binding), let api, let projectId else { return }
        guard networkMonitor.isOnline else {
            isOfflinePaused = true
            return
        }
        let requestGeneration = beginCampaignRequest()
        do {
            let fetched = try await api.listDiscoveryCampaigns(projectId: projectId, limit: 10)
            guard isCurrent(binding), requestGeneration == campaignRequestGeneration else { return }
            campaigns = fetched.map { incoming in
                guard let stored = campaigns.first(where: { $0.id == incoming.id }),
                      !Self.shouldApplyCampaignResponse(
                        requestGeneration: requestGeneration,
                        currentRequestGeneration: campaignRequestGeneration,
                        incomingVersion: incoming.version,
                        storedVersion: stored.version)
                else { return incoming }
                return stored
            }
            isOfflinePaused = false
            await persist(binding: binding)
            guard isCurrent(binding) else { return }
            startCampaignPollingIfNeeded()
        } catch {
            guard isCurrent(binding), requestGeneration == campaignRequestGeneration else { return }
            handle(error, silentWhenCached: silentWhenCached)
        }
    }

    private func refreshCampaign(
        id campaignId: String,
        binding: ConfigurationBinding,
        silentWhenCached: Bool
    ) async -> DiscoveryV2CampaignRun? {
        guard isCurrent(binding), !isCampaignBusy, let api, let projectId else { return nil }
        guard networkMonitor.isOnline else {
            isOfflinePaused = true
            return nil
        }
        let requestGeneration = beginCampaignRequest()
        do {
            let fetched = try await api.fetchDiscoveryCampaign(
                projectId: projectId,
                campaignId: campaignId)
            guard isCurrent(binding),
                  requestGeneration == campaignRequestGeneration,
                  fetched.projectId == projectId else { return nil }
            guard upsertCampaign(fetched, requestGeneration: requestGeneration) else {
                return campaigns.first(where: { $0.id == campaignId })
            }
            isOfflinePaused = false
            await persist(binding: binding)
            return isCurrent(binding) ? fetched : nil
        } catch {
            guard isCurrent(binding), requestGeneration == campaignRequestGeneration else { return nil }
            handle(error, silentWhenCached: silentWhenCached)
            return nil
        }
    }

    nonisolated static func campaignItem(
        _ item: DiscoveryV2CampaignItem,
        containsRunId runId: String
    ) -> Bool {
        item.currentRunId == runId || item.attempts.contains(where: { $0.runId == runId })
    }

    func openCampaignRun(
        campaign: DiscoveryV2CampaignRun,
        item: DiscoveryV2CampaignItem,
        runId: String
    ) async {
        guard let binding = currentBinding(), let api, let projectId, !isBusy else { return }
        guard campaign.projectId == projectId,
              let storedCampaign = campaigns.first(where: { $0.id == campaign.id && $0.projectId == projectId }),
              let storedItem = storedCampaign.items.first(where: {
                  $0.position == item.position && $0.profileId == item.profileId
              }),
              Self.campaignItem(storedItem, containsRunId: runId)
        else {
            showError("Kjøringen tilhører ikke den valgte kampanjen i dette kundeprosjektet.", retryable: false)
            return
        }
        guard networkMonitor.isOnline else {
            isOfflinePaused = true
            showError("Ingen nettforbindelse. Kjøringen kan ikke åpnes ennå.", retryable: true)
            return
        }

        let selectionGeneration = beginRunSelection()
        isBusy = true
        errorMessage = nil
        defer {
            if isCurrent(binding), runSelectionGeneration == selectionGeneration {
                isBusy = false
            }
        }
        do {
            let fetched = try await api.fetchDiscoveryRun(projectId: projectId, runId: runId)
            guard isCurrent(binding),
                  runSelectionGeneration == selectionGeneration,
                  fetched.projectId == nil || fetched.projectId == projectId else { return }

            stopPolling()
            isShowingCampaignOverview = false
            run = fetched
            brief = storedItem.briefSnapshot.normalized
            preview = nil
            candidates = []
            confirmedPlaceMatches = [:]
            selectedCandidateIds = []
            nextCursor = nil
            pendingRunIdempotencyKey = nil
            selectedProfile = profiles.first(where: { $0.id == storedItem.profileId })
            placesDetailsEnabled = selectedProfile?.placesDetailsEnabled == true
            isOfflinePaused = false
            isPresented = true

            if fetched.status.needsReview || (fetched.reviewReadyCount ?? 0) > 0 {
                await loadCandidates(replace: true, binding: binding)
                guard isCurrent(binding),
                      isCurrentRunSelection(selectionGeneration, expectedRunId: runId) else { return }
            } else {
                await persist(binding: binding)
            }
            guard isCurrent(binding),
                  isCurrentRunSelection(selectionGeneration, expectedRunId: runId) else { return }
            startPollingIfNeeded()
        } catch {
            guard isCurrent(binding), runSelectionGeneration == selectionGeneration else { return }
            handle(error)
        }
    }

    func showCampaignOverview() {
        // Do not abandon a create/confirm/candidate mutation between awaits.
        // The operation owns the current run selection until its guarded
        // response has been persisted.
        guard canNavigateToCampaignOverview else { return }
        stopPolling()
        _ = beginRunSelection()
        isShowingCampaignOverview = true
        run = nil
        candidates = []
        confirmedPlaceMatches = [:]
        selectedCandidateIds = []
        nextCursor = nil
        pendingRunIdempotencyKey = nil
        preview = nil
        errorMessage = nil
        isBusy = false
        isLoadingMore = false
        busyCandidateIds = []
        isPresented = true
        persistSoon()
        startCampaignPollingIfNeeded()
    }

    func cancelCampaign(_ campaign: DiscoveryV2CampaignRun) async {
        await performCampaignCommand("cancel", campaign: campaign)
    }

    func retryCampaign(_ campaign: DiscoveryV2CampaignRun) async {
        await performCampaignCommand("retry", campaign: campaign)
    }

    func advanceCampaign(_ campaign: DiscoveryV2CampaignRun) async {
        await performCampaignCommand("advance", campaign: campaign)
    }

    private func performCampaignCommand(
        _ action: String,
        campaign: DiscoveryV2CampaignRun
    ) async {
        guard let binding = currentBinding(), let api, let projectId,
              !isCampaignBusy else { return }
        guard campaigns.contains(where: { $0.id == campaign.id }) else {
            showError("Kampanjen tilhører ikke det aktive kundeprosjektet.", retryable: false)
            return
        }
        guard networkMonitor.isOnline else {
            isOfflinePaused = true
            showError("Ingen nettforbindelse. Handlingen er ikke sendt.", retryable: true)
            return
        }
        isCampaignBusy = true
        stopCampaignPolling()
        let requestGeneration = beginCampaignRequest()
        errorMessage = nil
        defer {
            if isCurrent(binding) {
                isCampaignBusy = false
                startCampaignPollingIfNeeded()
            }
        }
        let key = Self.campaignCommandIdempotencyKey(
            projectId: projectId,
            campaignId: campaign.id,
            action: action,
            version: campaign.version)
        do {
            let mutation: DiscoveryV2CampaignMutation
            switch action {
            case "cancel":
                mutation = try await api.cancelDiscoveryCampaign(
                    projectId: projectId,
                    campaignId: campaign.id,
                    idempotencyKey: key)
            case "retry":
                mutation = try await api.retryDiscoveryCampaign(
                    projectId: projectId,
                    campaignId: campaign.id,
                    idempotencyKey: key)
            default:
                mutation = try await api.advanceDiscoveryCampaign(
                    projectId: projectId,
                    campaignId: campaign.id,
                    idempotencyKey: key)
            }
            guard isCurrent(binding), requestGeneration == campaignRequestGeneration else { return }
            _ = upsertCampaign(mutation.campaign, requestGeneration: requestGeneration)
            isOfflinePaused = false
            await persist(binding: binding)
            guard isCurrent(binding) else { return }
            startCampaignPollingIfNeeded()
        } catch {
            guard isCurrent(binding), requestGeneration == campaignRequestGeneration else { return }
            handle(error)
        }
    }

    private func upsertCampaign(
        _ campaign: DiscoveryV2CampaignRun,
        requestGeneration: UInt64
    ) -> Bool {
        let storedVersion = campaigns.first(where: { $0.id == campaign.id })?.version
        guard Self.shouldApplyCampaignResponse(
            requestGeneration: requestGeneration,
            currentRequestGeneration: campaignRequestGeneration,
            incomingVersion: campaign.version,
            storedVersion: storedVersion
        ) else { return false }
        campaigns.removeAll(where: { $0.id == campaign.id })
        campaigns.append(campaign)
        campaigns.sort { lhs, rhs in
            if lhs.createdAt == rhs.createdAt { return lhs.id > rhs.id }
            return lhs.createdAt > rhs.createdAt
        }
        return true
    }


    nonisolated static func profile(
        _ draft: DiscoveryV2ProfilePresetDraft,
        matches profile: DiscoveryV2Profile
    ) -> Bool {
        let draftBrief = draft.brief.normalized
        let profileBrief = profile.brief.normalized
        let sameIdentity: Bool
        if let territoryCode = draftBrief.territoryCode {
            sameIdentity = profileBrief.territoryCode == territoryCode
        } else {
            sameIdentity = profile.name.compare(
                draft.name,
                options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame
        }
        return sameIdentity && profileBriefsMatch(draftBrief, profileBrief)
    }

    nonisolated static func profileBriefsMatch(
        _ lhs: DiscoveryV2Brief,
        _ rhs: DiscoveryV2Brief
    ) -> Bool {
        func canonicalSets(_ brief: DiscoveryV2Brief) -> DiscoveryV2Brief {
            var value = brief.normalized
            value.municipalityNumbers.sort()
            value.municipalityNames.sort()
            value.organizationForms.sort()
            return value
        }
        return canonicalSets(lhs) == canonicalSets(rhs)
    }

    nonisolated static func profile(
        _ draft: DiscoveryV2ProfilePresetDraft,
        existsIn profiles: [DiscoveryV2Profile]
    ) -> Bool {
        profiles.contains { profile(draft, matches: $0) }
    }

    nonisolated static func conflictingProfile(
        for draft: DiscoveryV2ProfilePresetDraft,
        in profiles: [DiscoveryV2Profile]
    ) -> DiscoveryV2Profile? {
        guard let territoryCode = draft.brief.normalized.territoryCode else { return nil }
        return profiles.first { profile in
            profile.brief.normalized.territoryCode == territoryCode
                && !self.profile(draft, matches: profile)
        }
    }

    nonisolated static func pausedMatchingProfile(
        for draft: DiscoveryV2ProfilePresetDraft,
        in profiles: [DiscoveryV2Profile]
    ) -> DiscoveryV2Profile? {
        profiles.first { profile in
            !profile.isActive && self.profile(draft, matches: profile)
        }
    }

    func updateSelectedProfile(named name: String? = nil, isDefault: Bool? = nil) async {
        await saveProfile(
            named: name ?? selectedProfile?.name ?? "Standard",
            isDefault: isDefault ?? selectedProfile?.isDefault ?? profiles.isEmpty,
            forceCreate: selectedProfile == nil)
    }

    func activateProfile(_ profile: DiscoveryV2Profile) async {
        guard !profile.isActive,
              let binding = currentBinding(), let api, let projectId,
              !isBusy else { return }
        isBusy = true
        errorMessage = nil
        defer {
            if isCurrent(binding) { isBusy = false }
        }
        do {
            let saved = try await api.updateDiscoveryProfile(
                projectId: projectId,
                profileId: profile.id,
                request: .init(
                    name: profile.name,
                    isDefault: profile.isDefault,
                    expectedVersion: profile.version,
                    brief: profile.brief.normalized,
                    placesDetailsEnabled: profile.placesDetailsEnabled == true,
                    status: .active))
            guard isCurrent(binding) else { return }
            if let index = profiles.firstIndex(where: { $0.id == saved.id }) {
                profiles[index] = saved
            }
            if selectedProfile?.id == saved.id { selectedProfile = saved }
            isOfflinePaused = false
            await persist(binding: binding)
        } catch {
            guard isCurrent(binding) else { return }
            handle(error)
        }
    }

    func saveDefaultProfile(named name: String = "Standard") async {
        await saveProfile(named: name, isDefault: true, forceCreate: selectedProfile == nil)
    }

    private func saveProfile(named name: String, isDefault: Bool, forceCreate: Bool) async {
        guard let binding = currentBinding(), let api, let projectId else { return }
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            showError("Gi Discovery-profilen et navn, for eksempel «Oslo kjerne».", retryable: false)
            return
        }
        if let validation = brief.normalized.validationMessage {
            showError(validation, retryable: false)
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
            let request = DiscoveryV2ProfileWrite(
                name: trimmedName,
                isDefault: isDefault,
                expectedVersion: forceCreate ? nil : selectedProfile?.version,
                brief: brief.normalized,
                placesDetailsEnabled: placesDetailsEnabled)
            let saved: DiscoveryV2Profile
            if !forceCreate, let selectedProfile {
                saved = try await api.updateDiscoveryProfile(
                    projectId: projectId, profileId: selectedProfile.id, request: request)
            } else {
                saved = try await api.createDiscoveryProfile(projectId: projectId, request: request)
            }
            guard isCurrent(binding) else { return }
            selectedProfile = saved
            placesDetailsEnabled = saved.placesDetailsEnabled == true
            await reloadProfiles(selecting: saved.id, api: api, projectId: projectId, binding: binding)
            guard isCurrent(binding) else { return }
            await persist()
            guard isCurrent(binding) else { return }
        } catch {
            guard isCurrent(binding) else { return }
            handle(error)
        }
    }

    func deleteProfile(_ profile: DiscoveryV2Profile) async {
        guard let binding = currentBinding(), let api, let projectId else { return }
        guard run?.profileId != profile.id || run?.status.isRunning != true else {
            showError("Profilen brukes av en aktiv Discovery-kjøring og kan ikke slettes ennå.", retryable: false)
            return
        }
        isBusy = true
        errorMessage = nil
        defer {
            if isCurrent(binding) { isBusy = false }
        }
        do {
            try await api.deleteDiscoveryProfile(projectId: projectId, profileId: profile.id)
            guard isCurrent(binding) else { return }
            profiles.removeAll { $0.id == profile.id }
            if selectedProfile?.id == profile.id {
                selectedProfile = profiles.first(where: \.isDefault) ?? profiles.first
                if let selectedProfile {
                    brief = selectedProfile.brief
                    placesDetailsEnabled = selectedProfile.placesDetailsEnabled == true
                } else {
                    startUnsavedProfileDraft(copyingCurrentBrief: false)
                }
            }
            preview = nil
            await persist()
        } catch {
            guard isCurrent(binding) else { return }
            handle(error)
        }
    }

    func setPlacesDetailsEnabled(_ enabled: Bool) async {
        guard selectedProfile != nil else {
            placesDetailsEnabled = enabled
            persistSoon()
            return
        }
        guard let binding = currentBinding(), let api, let projectId else { return }
        let previousValue = placesDetailsEnabled
        placesDetailsEnabled = enabled
        isBusy = true
        defer {
            if isCurrent(binding) {
                isBusy = false
            }
        }
        do {
            let request = DiscoveryV2ProfileWrite(
                name: selectedProfile?.name ?? "Standard",
                isDefault: selectedProfile?.isDefault ?? true,
                expectedVersion: selectedProfile?.version,
                brief: brief.normalized,
                placesDetailsEnabled: enabled)
            let saved: DiscoveryV2Profile
            if let selectedProfile {
                saved = try await api.updateDiscoveryProfile(
                    projectId: projectId,
                    profileId: selectedProfile.id,
                    request: request)
            } else {
                saved = try await api.createDiscoveryProfile(
                    projectId: projectId,
                    request: request)
            }
            guard isCurrent(binding) else { return }
            selectedProfile = saved
            placesDetailsEnabled = saved.placesDetailsEnabled == true
            if let index = profiles.firstIndex(where: { $0.id == saved.id }) {
                profiles[index] = saved
            } else { profiles.append(saved) }
            await persist()
            guard isCurrent(binding) else { return }
        } catch {
            guard isCurrent(binding) else { return }
            placesDetailsEnabled = previousValue
            handle(error)
        }
    }

    func fetchTransientPlaceDetails(
        candidateId: String
    ) async throws -> DiscoveryV2PlaceDetailsResponse {
        guard placesDetailsEnabled else {
            throw DiscoveryV2ServiceError(
                code: "places_details_disabled",
                message: "Aktiver Google Maps-detaljer for Discovery-profilen først.",
                retryable: false,
                field: nil,
                statusCode: 409)
        }
        guard let binding = currentBinding(), let api, let projectId, let run else {
            throw DiscoveryV2ServiceError(
                code: "discovery_not_ready",
                message: "Discovery-kjøringen er ikke klar.",
                retryable: false,
                field: nil,
                statusCode: 409)
        }
        guard networkMonitor.isOnline else {
            throw DiscoveryV2ServiceError(
                code: "offline",
                message: "Google Maps-detaljer krever nettforbindelse.",
                retryable: true,
                field: nil,
                statusCode: 503)
        }
        let selectionGeneration = runSelectionGeneration
        let expectedRunId = run.id
        let details = try await api.fetchDiscoveryPlaceDetails(
            projectId: projectId,
            runId: run.id,
            candidateId: candidateId)
        guard isCurrent(binding),
              isCurrentRunSelection(selectionGeneration, expectedRunId: expectedRunId) else {
            throw CancellationError()
        }
        return details
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
        _ = beginRunSelection()
        isShowingCampaignOverview = false
        run = nil
        candidates = []
        confirmedPlaceMatches = [:]
        nextCursor = nil
        selectedCandidateIds = []
        pendingRunIdempotencyKey = nil
        preview = nil
        errorMessage = nil
        isBusy = false
        isLoadingMore = false
        busyCandidateIds = []
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
            let previousSelectedProfileId = selectedProfile?.id
            let hadUnsavedChanges = hasUnsavedProfileChanges
            let previousPlacesDetailsEnabled = placesDetailsEnabled
            profiles = loadedProfiles
            if let previousSelectedProfileId,
               let refreshedSelection = profiles.first(where: { $0.id == previousSelectedProfileId }) {
                selectedProfile = refreshedSelection
                if hadUnsavedChanges {
                    placesDetailsEnabled = previousPlacesDetailsEnabled
                } else {
                    brief = refreshedSelection.brief
                    placesDetailsEnabled = refreshedSelection.placesDetailsEnabled == true
                }
            } else if useDefaultWhenDraftIsEmpty {
                selectedProfile = profiles.first(where: \.isDefault) ?? profiles.first
                placesDetailsEnabled = selectedProfile?.placesDetailsEnabled == true
            } else {
                // Keep the restored/ad-hoc draft even if no server profile is selected.
                selectedProfile = nil
                placesDetailsEnabled = previousPlacesDetailsEnabled
            }
            if useDefaultWhenDraftIsEmpty, let selectedProfile,
               previousSelectedProfileId == nil {
                brief = selectedProfile.brief
            }
        } catch {
            // Profiles improve repeat runs but never block an ad-hoc brief.
        }
    }

    private func reloadProfiles(
        selecting profileId: String,
        api: APIClient,
        projectId: String,
        binding: ConfigurationBinding
    ) async {
        do {
            let refreshed = try await api.listDiscoveryProfiles(projectId: projectId)
            guard isCurrent(binding) else { return }
            profiles = refreshed
            selectedProfile = refreshed.first(where: { $0.id == profileId }) ?? selectedProfile
        } catch {
            guard isCurrent(binding), let selectedProfile else { return }
            if selectedProfile.isDefault {
                profiles = profiles.map { profile in
                    var updated = profile
                    if updated.id != selectedProfile.id { updated.isDefault = false }
                    return updated
                }
            }
            if let index = profiles.firstIndex(where: { $0.id == selectedProfile.id }) {
                profiles[index] = selectedProfile
            } else {
                profiles.append(selectedProfile)
            }
        }
    }

    private func alignSelectedProfileWithRun() {
        guard let run else { return }
        guard let profileId = run.profileId else {
            placesDetailsEnabled = false
            return
        }
        guard let matchingProfile = profiles.first(where: { $0.id == profileId }) else {
            placesDetailsEnabled = false
            return
        }
        selectedProfile = matchingProfile
        placesDetailsEnabled = matchingProfile.placesDetailsEnabled == true
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

    private func startCampaignPollingIfNeeded() {
        guard let binding = currentBinding(), activeCampaign != nil else {
            stopCampaignPolling()
            return
        }
        guard campaignPollTask == nil else { return }
        campaignPollTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4))
                guard let self, !Task.isCancelled, self.isCurrent(binding) else { return }
                if self.isCampaignBusy { continue }
                guard let campaignId = self.activeCampaign?.id else {
                    self.campaignPollTask = nil
                    return
                }
                let refreshed = await self.refreshCampaign(
                    id: campaignId,
                    binding: binding,
                    silentWhenCached: true)
                guard self.isCurrent(binding) else { return }
                if refreshed?.needsStatusPolling == false {
                    await self.refreshCampaigns(binding: binding, silentWhenCached: true)
                    guard self.isCurrent(binding) else { return }
                    self.campaignPollTask = nil
                    return
                }
            }
        }
    }

    private func stopCampaignPolling() {
        campaignPollTask?.cancel()
        campaignPollTask = nil
    }

    @discardableResult
    private func restore(binding: ConfigurationBinding) async -> Bool {
        let name = Self.cacheName(organizationId: binding.organizationId, projectId: binding.projectId)
        guard let scope = OfflineCache.Scope(
            actorUserId: actorUserId,
            organizationId: binding.organizationId,
            projectId: binding.projectId
        ),
              let cached = await cache.load(
                DiscoveryV2PersistedState.self,
                named: name,
                scope: scope
              )?.value,
              cached.organizationId == binding.organizationId,
              cached.projectId == binding.projectId else { return false }
        guard isCurrent(binding) else { return false }
        projectName = cached.projectName ?? projectName
        brief = cached.brief
        preview = cached.preview
        run = cached.run
        nextCursor = cached.nextCursor
        selectedProfile = cached.selectedProfile
        placesDetailsEnabled = cached.placesDetailsEnabled
            ?? (cached.selectedProfile?.placesDetailsEnabled == true)
        pendingRunIdempotencyKey = cached.pendingRunIdempotencyKey
        campaigns = cached.campaigns ?? []
        pendingCampaignStart = cached.pendingCampaignStart
        // A legacy cache may contain only a key and cannot prove the exact
        // request body. Never reuse that key for a different campaign.
        pendingCampaignStartIdempotencyKey = cached.pendingCampaignStart?.idempotencyKey
        isShowingCampaignOverview = cached.isShowingCampaignOverview ?? false
        if isShowingCampaignOverview {
            run = nil
            nextCursor = nil
        }
        startCampaignPollingIfNeeded()
        return true
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
        guard let scope = OfflineCache.Scope(
            actorUserId: actorUserId,
            organizationId: binding.organizationId,
            projectId: binding.projectId
        ) else { return }
        let state = DiscoveryV2PersistedState(
            organizationId: binding.organizationId,
            projectId: binding.projectId,
            projectName: projectName,
            brief: brief,
            preview: preview,
            run: run,
            nextCursor: nextCursor,
            selectedProfile: selectedProfile,
            placesDetailsEnabled: placesDetailsEnabled,
            pendingRunIdempotencyKey: pendingRunIdempotencyKey,
            campaigns: campaigns,
            pendingCampaignStartIdempotencyKey: pendingCampaignStartIdempotencyKey,
            pendingCampaignStart: pendingCampaignStart,
            isShowingCampaignOverview: isShowingCampaignOverview,
            savedAt: Date())
        await cache.save(
            state,
            named: Self.cacheName(
                organizationId: binding.organizationId,
                projectId: binding.projectId
            ),
            scope: scope
        )
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
        stopCampaignPolling()
        _ = beginRunSelection()
        _ = beginCampaignRequest()
        preview = nil
        run = nil
        candidates = []
        confirmedPlaceMatches = [:]
        nextCursor = nil
        profiles = []
        campaigns = []
        isCampaignBusy = false
        isStartingRun = false
        isShowingCampaignOverview = false
        selectedProfile = nil
        selectedCandidateIds = []
        placesDetailsEnabled = false
        pendingRunIdempotencyKey = nil
        pendingCampaignStartIdempotencyKey = nil
        pendingCampaignStart = nil
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
        _ = organizationId
        _ = projectId
        return "discovery-state"
    }

    static func makeIdempotencyKey(projectId: String) -> String {
        "ipad-\(projectId)-\(UUID().uuidString.lowercased())"
    }

    static func makeCampaignStartIdempotencyKey(projectId: String) -> String {
        "ipad-\(projectId)-campaign-\(UUID().uuidString.lowercased())"
    }

    nonisolated static func campaignCommandIdempotencyKey(
        projectId: String,
        campaignId: String,
        action: String,
        version: Int
    ) -> String {
        "ipad-\(projectId)-campaign-\(campaignId)-\(action)-v\(version)"
    }

    nonisolated static func decisionIdempotencyKey(
        runId: String,
        candidateId: String,
        decision: DiscoveryV2Decision,
        confirmedGooglePlaceId: String?,
        placeConfirmationExpiresAt: String? = nil
    ) -> String {
        let fingerprint = [
            runId,
            candidateId,
            decision.rawValue,
            confirmedGooglePlaceId ?? "",
            placeConfirmationExpiresAt ?? "",
        ].joined(separator: "\u{1F}")
        let digest = SHA256.hash(data: Data(fingerprint.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return "decision-" + digest
    }
}
