import Foundation

/// Drives the "import from memory card" flow:
///   pick files → review → import locally (copy + checksum + dedup) → pick a
///   project → back up originals to B2 → hand off to cull / Redigering.
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

    private var scopedURLs: [URL] = []

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

        // 2. Link to project + back up ORIGINALS to B2.
        phase = .backingUp
        progressTotal = backupItems.count
        progressDone = 0
        statusLine = "Sikkerhetskopierer til skyen …"

        let backend = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"],
        )
        let delivery = DeliveryService(backend: backend)
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
        phase = .done
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
    }

    private func releaseScopedAccess() {
        for url in scopedURLs { url.stopAccessingSecurityScopedResource() }
        scopedURLs = []
    }

    private static func defaultSessionName() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d. MMM yyyy HH:mm"
        formatter.locale = Locale(identifier: "nb_NO")
        return "Kort-import \(formatter.string(from: Date()))"
    }
}
