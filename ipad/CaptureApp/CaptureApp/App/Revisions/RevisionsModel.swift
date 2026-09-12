import Foundation

/// "Revisjoner" — client-requested changes for a project. Locates the requested
/// originals across one or more memory cards (matching by filename), imports
/// them for editing in Redigering, then delivers the revised version or saves
/// locally — marking each request resolved.
@MainActor
@Observable
final class RevisionsModel {
    let project: BackendProjectSummary

    var revisions: [BackendRevisionRequest] = []
    var loading = false
    var working = false
    var errorMessage: String?
    var statusMessage: String?

    /// revisionId → the matching card group (RAW/JPEG) found so far.
    var matchedGroups: [String: CardMediaGroup] = [:]
    var cardsScanned = 0
    var imported = false
    var importedSessionId: UUID?
    var ownerUserId: String?

    private var scopedURLs: [URL] = []
    private var pendingBackupItems: [DeliveryService.CardBackupItem] = []

    init(project: BackendProjectSummary) { self.project = project }

    var openRevisions: [BackendRevisionRequest] { revisions.filter { $0.status != "resolved" } }
    var foundCount: Int { matchedGroups.count }
    var missingCount: Int { max(0, openRevisions.count - foundCount) }
    func isFound(_ revision: BackendRevisionRequest) -> Bool { matchedGroups[revision.id] != nil }

    private func backendClient() -> BackendClient? {
        guard let session = SignInService.shared.session else { return nil }
        return BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"],
        )
    }

    // MARK: - Load

    func load() async {
        guard let backend = backendClient() else { errorMessage = "Du må være innlogget."; return }
        loading = true
        errorMessage = nil
        do {
            revisions = try await backend.listRevisionRequests(projectId: project.id)
        } catch {
            errorMessage = "Kunne ikke hente revisjoner: \(error.localizedDescription)"
        }
        loading = false
    }

    // MARK: - Card matching (across multiple cards)

    func addCard(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            errorMessage = error.localizedDescription
        case .success(let urls):
            for url in urls { _ = url.startAccessingSecurityScopedResource() }
            scopedURLs.append(contentsOf: urls)
            let groups = CardImportService.group(CardImportService.scan(urls: urls))
            for revision in openRevisions where matchedGroups[revision.id] == nil {
                let base = (revision.originalFilename as NSString).deletingPathExtension.lowercased()
                if let match = groups.first(where: { $0.baseName == base }) {
                    matchedGroups[revision.id] = match
                }
            }
            cardsScanned += 1
            statusMessage = missingCount > 0
                ? "Fant \(foundCount) av \(openRevisions.count). \(missingCount) mangler — sett inn neste kort."
                : "Fant alle \(foundCount) bildene."
        }
    }

    // MARK: - Import located originals

    func importAndStage() async {
        guard !matchedGroups.isEmpty else { return }
        guard let session = SignInService.shared.session, let backend = backendClient() else {
            errorMessage = "Du må være innlogget."
            return
        }
        working = true
        let owner = session.userId

        let database: AppDatabase
        let service: CardImportService
        do {
            let url = try AppDatabase.defaultDiskURL()
            database = try AppDatabase.openOnDisk(at: url)
            service = CardImportService(database: database)
        } catch {
            errorMessage = "Kunne ikke åpne lokal database: \(error.localizedDescription)"
            working = false
            return
        }

        let importSession: Session
        do {
            importSession = try await service.createImportSession(name: "Revisjon · \(project.title)", ownerUserId: owner)
        } catch {
            errorMessage = "Kunne ikke opprette økt: \(error.localizedDescription)"
            working = false
            return
        }
        importedSessionId = importSession.id
        ownerUserId = owner

        var seen: Set<String> = []
        var backupItems: [DeliveryService.CardBackupItem] = []
        for (revisionId, group) in matchedGroups {
            do {
                let result = try await service.importGroup(group, into: importSession.id, seenChecksums: seen)
                if let checksum = result.checksum { seen.insert(checksum) }
                if let importedAsset = result.imported {
                    backupItems.append(contentsOf: importedAsset.backupItems)
                }
                try? await backend.setRevisionStatus(id: revisionId, status: "in_progress")
            } catch {
                AppLog.capture.error("[Revisions] import \(group.baseName, privacy: .public) failed: \(error.localizedDescription, privacy: .public)")
            }
        }
        pendingBackupItems = backupItems
        releaseScopedAccess()
        imported = true
        working = false
        statusMessage = "Hentet \(matchedGroups.count) bilde(r). Rediger dem i Redigering-fanen — de ligger øverst."
    }

    // MARK: - Finish

    func finish(deliver: Bool) async {
        guard let backend = backendClient() else { return }
        working = true

        if deliver, !pendingBackupItems.isEmpty {
            let delivery = DeliveryService(backend: backend)
            do {
                _ = try await delivery.backupCard(
                    sessionName: "Revisjon · \(project.title)",
                    sessionStartedAt: Date(),
                    items: pendingBackupItems,
                    projectId: project.id,
                )
            } catch {
                errorMessage = "Levering feilet: \(error.localizedDescription). Bildene ligger lokalt — prøv igjen."
                working = false
                return
            }
        }

        for revisionId in matchedGroups.keys {
            try? await backend.setRevisionStatus(id: revisionId, status: "resolved")
        }
        statusMessage = deliver ? "Levert revidert til kunde." : "Lagret på iPad."
        matchedGroups = [:]
        pendingBackupItems = []
        imported = false
        working = false
        await load()
    }

    private func releaseScopedAccess() {
        for url in scopedURLs { url.stopAccessingSecurityScopedResource() }
        scopedURLs = []
    }
}
