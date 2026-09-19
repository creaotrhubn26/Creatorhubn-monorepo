import Foundation

/// Drives the "import from memory card" flow:
///   pick files → review → import locally (copy + checksum + dedup) → pick a
///   project → back up originals to CreatorHub S3 → hand off to cull / Redigering.
@MainActor
@Observable
final class CardImportModel {
    enum Phase: Equatable {
        case picking
        case review
        case importing
        case backingUp
        case done
        case failed(String)
    }

    var phase: Phase = .picking
    var groups: [CardMediaGroup] = []
    var duplicateCount = 0
    var sessionName = ""

    /// Local session the import landed in — drives the cull/Redigering handoff.
    var importedSessionId: UUID?
    var ownerUserId: String?

    var progressDone = 0
    var progressTotal = 0
    var statusLine = ""
    var successfulImportCount = 0

    private var scopedURLs: [URL] = []
    private var pendingBackupItems: [DeliveryService.CardBackupItem] = []
    private var pendingProjectId: String?
    private var pendingProjectTitle: String?
    private var pendingSessionStartedAt: Date?
    private var pendingDelivery: DeliveryService?
    private var pendingJobId: UUID?
    private var pendingJobStore: CardBackupJobStore?

    var canRetryBackup: Bool {
        !pendingBackupItems.isEmpty && pendingProjectId != nil && pendingSessionStartedAt != nil
    }

    var totalBytes: Int64 { groups.reduce(0) { $0 + $1.totalBytes } }
    var rawCount: Int { groups.filter { $0.raw != nil }.count }
    var jpegCount: Int { groups.filter { $0.jpeg != nil }.count }
    var fractionComplete: Double {
        progressTotal > 0 ? Double(progressDone) / Double(progressTotal) : 0
    }

    // MARK: - Pick

    func handlePick(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            phase = .failed(error.localizedDescription)
        case .success(let urls):
            releaseScopedAccess()
            scopedURLs = urls
            for url in urls { _ = url.startAccessingSecurityScopedResource() }
            let files = CardImportService.scan(urls: urls)
            groups = CardImportService.group(files)
            if groups.isEmpty {
                phase = .failed("Fant ingen bilder eller RAW-filer på det valgte mediet.")
            } else {
                if sessionName.isEmpty { sessionName = Self.defaultSessionName() }
                phase = .review
            }
        }
    }

    // MARK: - Run

    func runImport(project: BackendProjectSummary) async {
        guard let session = SignInService.shared.session else {
            phase = .failed("Du må være innlogget for å importere.")
            return
        }
        let owner = session.userId

        let database: AppDatabase
        let service: CardImportService
        do {
            let url = try AppDatabase.defaultDiskURL()
            database = try AppDatabase.openOnDisk(at: url)
            service = CardImportService(database: database)
        } catch {
            phase = .failed("Kunne ikke åpne lokal database: \(error.localizedDescription)")
            return
        }

        let name = sessionName.isEmpty ? Self.defaultSessionName() : sessionName

        // 1. Local session + import (copy + checksum + dedup).
        phase = .importing
        progressTotal = groups.count
        progressDone = 0
        duplicateCount = 0

        let importSession: Session
        do {
            importSession = try await service.createImportSession(name: name, ownerUserId: owner)
        } catch {
            phase = .failed("Kunne ikke opprette økt: \(error.localizedDescription)")
            return
        }
        importedSessionId = importSession.id
        ownerUserId = owner

        var seen = (try? await service.existingChecksums(ownerUserId: owner)) ?? []
        var backupItems: [DeliveryService.CardBackupItem] = []

        for group in groups {
            statusLine = "Importerer \(group.display.filename) …"
            do {
                let result = try await service.importGroup(group, into: importSession.id, seenChecksums: seen)
                if let checksum = result.checksum { seen.insert(checksum) }
                if let imported = result.imported {
                    backupItems.append(contentsOf: imported.backupItems)
                } else {
                    duplicateCount += 1
                }
            } catch {
                AppLog.capture.error("[CardImport] group \(group.baseName, privacy: .public) failed: \(error.localizedDescription, privacy: .public)")
            }
            progressDone += 1
        }

        guard !backupItems.isEmpty else {
            releaseScopedAccess()
            // Everything was a duplicate — still a success (nothing new to back up).
            statusLine = duplicateCount > 0 ? "Alt lå allerede inne (\(duplicateCount) duplikater)." : ""
            phase = .done
            return
        }
        successfulImportCount = groups.count - duplicateCount

        // 2. Link to project + back up ORIGINALS to CreatorHub S3.
        phase = .backingUp
        progressTotal = backupItems.count
        progressDone = 0
        statusLine = "Sikkerhetskopierer til skyen …"

        // Keep a retryable snapshot after the card files have been copied into
        // app storage. A network/S3 failure must not force a second card scan.
        pendingBackupItems = backupItems
        pendingProjectId = project.id
        pendingProjectTitle = project.title
        pendingSessionStartedAt = importSession.startsAt
        pendingJobId = importSession.id

        let jobStore = CardBackupJobStore(database: database)
        pendingJobStore = jobStore
        do {
            try await jobStore.save(.init(
                id: importSession.id,
                ownerUserId: owner,
                sessionName: name,
                sessionStartedAt: importSession.startsAt,
                projectId: project.id,
                projectTitle: project.title,
                items: backupItems,
                assetCount: successfulImportCount,
                duplicateCount: duplicateCount,
            ))
        } catch {
            phase = .failed("Kunne ikke lagre backup-checkpoint: \(error.localizedDescription)")
            return
        }

        let backend = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"],
        )
        let delivery = DeliveryService(
            backend: backend,
            uploadStore: PersistentUploadStore(database: database),
            partUploader: BackgroundMultipartUploader.shared,
        )
        pendingDelivery = delivery
        do {
            _ = try await delivery.backupCard(
                sessionName: name,
                sessionStartedAt: importSession.startsAt,
                items: backupItems,
                projectId: project.id,
            ) { done, total in
                Task { @MainActor in
                    self.progressDone = done
                    self.progressTotal = total
                }
            }
        } catch {
            releaseScopedAccess()
            phase = .failed("Backup til skyen feilet: \(error.localizedDescription). Bildene er importert lokalt — prøv backup igjen.")
            return
        }

        releaseScopedAccess()
        await finishPendingBackup()
        phase = .done
    }

    func retryBackup() async {
        guard let session = SignInService.shared.session,
              let projectId = pendingProjectId,
              let startedAt = pendingSessionStartedAt,
              !pendingBackupItems.isEmpty
        else {
            phase = .failed("Fant ingen avbrutt backup å fortsette.")
            return
        }

        phase = .backingUp
        progressDone = 0
        progressTotal = pendingBackupItems.count
        statusLine = "Fortsetter sikkerhetskopiering til CreatorHub S3 …"
        let backend = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"],
        )
        let delivery: DeliveryService
        if let pendingDelivery {
            delivery = pendingDelivery
        } else {
            do {
                let database = try AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL())
                pendingJobStore = pendingJobStore ?? CardBackupJobStore(database: database)
                delivery = DeliveryService(
                    backend: backend,
                    uploadStore: PersistentUploadStore(database: database),
                    partUploader: BackgroundMultipartUploader.shared,
                )
            } catch {
                phase = .failed("Kunne ikke åpne backup-checkpoint: \(error.localizedDescription)")
                return
            }
        }
        pendingDelivery = delivery
        do {
            _ = try await delivery.backupCard(
                sessionName: sessionName.isEmpty ? Self.defaultSessionName() : sessionName,
                sessionStartedAt: startedAt,
                items: pendingBackupItems,
                projectId: projectId,
            ) { done, total in
                Task { @MainActor in
                    self.progressDone = done
                    self.progressTotal = total
                }
            }
            await finishPendingBackup()
            phase = .done
        } catch {
            phase = .failed("Backup til skyen feilet igjen: \(error.localizedDescription). De lokale filene er fortsatt trygge.")
        }
    }

    /// Called when the card-import sheet opens. Reconstructs the latest
    /// unfinished job for this account from SQLite and copied local originals.
    func restorePendingBackup() async {
        guard phase == .picking,
              let session = SignInService.shared.session
        else { return }
        do {
            let database = try AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL())
            let jobStore = CardBackupJobStore(database: database)
            guard let job = try await jobStore.latestPending(ownerUserId: session.userId) else { return }
            // Keep the handle even when copied originals have disappeared, so
            // Reset can remove the orphaned job instead of rediscovering it on
            // every sheet presentation.
            pendingJobId = job.id
            pendingJobStore = jobStore
            guard job.items.allSatisfy({
                FileManager.default.fileExists(atPath: $0.path)
            }) else {
                phase = .failed("Fant en avbrutt backup, men én eller flere lokale originalfiler mangler.")
                return
            }

            pendingBackupItems = job.items
            pendingProjectId = job.projectId
            pendingProjectTitle = job.projectTitle
            pendingSessionStartedAt = job.sessionStartedAt
            sessionName = job.sessionName
            importedSessionId = job.id
            ownerUserId = job.ownerUserId
            duplicateCount = job.duplicateCount
            successfulImportCount = job.assetCount
            progressTotal = job.items.count
            progressDone = 0
            pendingDelivery = DeliveryService(
                backend: BackendClient(
                    baseURL: session.backendBaseURL,
                    authHeaders: ["Authorization": "Bearer \(session.bearer)"],
                ),
                uploadStore: PersistentUploadStore(database: database),
                partUploader: BackgroundMultipartUploader.shared,
            )
            phase = .failed("Fant en avbrutt backup for «\(job.projectTitle)». Fortsett fra siste fullførte del.")
        } catch {
            AppLog.sync.error("[CardImport] restore checkpoint failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func reset() {
        releaseScopedAccess()
        phase = .picking
        groups = []
        duplicateCount = 0
        importedSessionId = nil
        progressDone = 0
        progressTotal = 0
        statusLine = ""
        successfulImportCount = 0
        let store = pendingJobStore
        let jobId = pendingJobId
        clearPendingMemory()
        if let store, let jobId {
            Task { try? await store.delete(id: jobId) }
        }
    }

    private func releaseScopedAccess() {
        for url in scopedURLs { url.stopAccessingSecurityScopedResource() }
        scopedURLs = []
    }

    private func finishPendingBackup() async {
        if let pendingJobStore, let pendingJobId {
            try? await pendingJobStore.delete(id: pendingJobId)
        }
        clearPendingMemory()
    }

    private func clearPendingMemory() {
        pendingBackupItems = []
        pendingProjectId = nil
        pendingProjectTitle = nil
        pendingSessionStartedAt = nil
        pendingDelivery = nil
        pendingJobId = nil
        pendingJobStore = nil
    }

    private static func defaultSessionName() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d. MMM yyyy HH:mm"
        formatter.locale = Locale(identifier: "nb_NO")
        return "Kort-import \(formatter.string(from: Date()))"
    }
}
