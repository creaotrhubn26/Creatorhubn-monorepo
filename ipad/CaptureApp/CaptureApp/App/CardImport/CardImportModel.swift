import Foundation
import Network
import UIKit

/// Durable, local-first memory-card ingest for both photo and video.
///
/// The removable card is read-only. CreatorHub first creates verified local
/// copies, then releases the card, and only then starts optional cloud work.
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

    enum MediaFilter: String, CaseIterable, Identifiable {
        case all, photo, raw, video, audio
        var id: String { rawValue }
        var title: String {
            switch self {
            case .all: "Alle"
            case .photo: "Foto"
            case .raw: "RAW"
            case .video: "Video"
            case .audio: "Lyd"
            }
        }
    }

    enum ItemSort: String, CaseIterable, Identifiable {
        case oldest, newest, name, size
        var id: String { rawValue }
        var title: String {
            switch self {
            case .oldest: "Eldste først"
            case .newest: "Nyeste først"
            case .name: "Filnavn"
            case .size: "Størrelse"
            }
        }
    }

    enum NetworkTransport: String {
        case offline, wifi, cellular, wired, other

        var title: String {
            switch self {
            case .offline: "Frakoblet"
            case .wifi: "Wi‑Fi"
            case .cellular: "Mobilnett"
            case .wired: "Kablet nett"
            case .other: "Nettverk"
            }
        }
    }

    var phase: Phase = .picking
    var groups: [CardMediaGroup] = []
    var videos: [CardVideoFile] = []
    var audios: [CardAudioFile] = []
    var unsupportedFileCount = 0
    var sidecarFileCount = 0
    var proxyFileCount = 0
    var duplicateCount = 0
    var failedImportCount = 0
    var sessionName = ""
    var storagePolicy: Asset.StoragePolicy = .keepLocalAndCloud
    var cardName = "Minnekort"
    var plannedCardLabel = ""
    var cardIdentifier = "unknown"
    var cardCapacityBytes: Int64?
    var cardAvailableBytes: Int64?
    var manifestItems: [CardImportManifestItem] = []
    var mediaFilter: MediaFilter = .all
    var itemSort: ItemSort = .oldest
    var folderFilter = ""
    var recordedDayFilter = ""
    var searchText = ""
    var manifestReady = false
    var needsCardReselection = false
    var deviceAvailableBytes: Int64?
    var batteryLevel: Float?
    var receipt: CardImportReceipt?
    var recentReceipts: [CardImportReceipt] = []
    var profiles: [CardImportProfile] = []
    var selectedProfileId: UUID?
    var profileName = ""
    var profileScope: CardImportProfileScope = .card
    var includeProxyMedia = false
    var networkTransport: NetworkTransport = .offline
    var networkIsConstrained = false
    var networkIsExpensive = false

    var importedSessionId: UUID?
    var ownerUserId: String?
    var cardCanBeRemoved = false
    var locallyVerifiedAt: Date?

    var progressDone = 0
    var progressTotal = 0
    var copiedBytes: Int64 = 0
    var totalBytes: Int64 = 0
    var statusLine = ""
    var successfulImportCount = 0
    private var originalPhotoCount = 0
    private var originalVideoCount = 0
    private var originalAudioCount = 0

    private var scopedURLs: [URL] = []
    private var pendingBackupItems: [DeliveryService.CardBackupItem] = []
    private var pendingVideoAssetIds: [String] = []
    private var pendingAudioAssetIds: [String] = []
    private var pendingProjectId: String?
    private var pendingProjectTitle: String?
    private var pendingSessionStartedAt: Date?
    private var pendingDelivery: DeliveryService?
    private var pendingJobId: UUID?
    private var pendingJobStore: CardBackupJobStore?
    private var database: AppDatabase?
    private var importStartedAt: Date?
    private var isResumingCard = false
    private var pendingCloudVerifiedAt: Date?
    private var reportPending = false
    private var manifestRunId: UUID?
    private var manifestStore: CardImportManifestStore?
    private var profileStore: CardImportProfileStore?
    private var pickedURLs: [URL] = []
    private var backgroundTaskIdentifier: UIBackgroundTaskIdentifier = .invalid
    @ObservationIgnored private let networkMonitor = NWPathMonitor()
    @ObservationIgnored private let networkQueue = DispatchQueue(label: "com.creatorhub.capture.card-import-network")
    private var isAutomaticResumeRunning = false

    init() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let level = UIDevice.current.batteryLevel
        batteryLevel = level >= 0 ? level : nil
        deviceAvailableBytes = CardImportService.availableCapacity()
        networkMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.networkTransport = Self.transport(for: path)
                self.networkIsConstrained = path.isConstrained
                self.networkIsExpensive = path.isExpensive
                guard path.status == .satisfied else { return }
                await self.resumeNetworkWorkIfPossible()
            }
        }
        networkMonitor.start(queue: networkQueue)
    }

    deinit {
        networkMonitor.cancel()
    }

    var photoCount: Int { originalPhotoCount }
    var videoCount: Int { originalVideoCount }
    var audioCount: Int { originalAudioCount }
    var rawCount: Int { groups.filter { $0.raw != nil }.count }
    var jpegCount: Int { groups.filter { $0.jpeg != nil }.count }
    var selectedProjectTitle: String? { pendingProjectTitle }
    var requiresProjectBinding: Bool {
        storagePolicy != .localOnly
            && pendingProjectId == nil
            && (!pendingBackupItems.isEmpty || !pendingVideoAssetIds.isEmpty || !pendingAudioAssetIds.isEmpty)
    }
    var hasPendingCloudBackup: Bool {
        !pendingBackupItems.isEmpty || !pendingVideoAssetIds.isEmpty || !pendingAudioAssetIds.isEmpty
    }
    var canRetryBackup: Bool {
        hasPendingCloudBackup && pendingProjectId != nil && pendingSessionStartedAt != nil
    }
    var canRetryProjectReport: Bool {
        reportPending && pendingProjectId != nil && pendingCloudVerifiedAt != nil
    }
    var canResumeCard: Bool { needsCardReselection || (importedSessionId != nil && failedImportCount > 0) }
    var selectedItems: [CardImportManifestItem] { manifestItems.filter(\.selected) }
    var selectedFileCount: Int { selectedItems.count }
    var selectedTotalBytes: Int64 { selectedItems.reduce(0) { $0 + $1.sizeBytes } }
    var unreadableCount: Int { manifestItems.filter { $0.inspection.state == .unreadable }.count }
    var limitedMetadataCount: Int { manifestItems.filter { $0.inspection.state == .limited }.count }
    var missingProxyCount: Int {
        manifestItems.filter { $0.inspection.proxyState == .originalMissingProxy }.count
    }
    var duplicateManifestCount: Int { manifestItems.filter { $0.status == .duplicate }.count }
    var duplicateCandidateCount: Int {
        manifestItems.filter { $0.inspection.duplicateCandidate == true && $0.status != .duplicate }.count
    }
    var selectedFormatSummary: String {
        let counts = Dictionary(grouping: selectedItems, by: { $0.fileExtension.uppercased() })
            .mapValues(\.count)
        return counts.keys.sorted().map { "\($0) \(counts[$0] ?? 0)" }.joined(separator: " · ")
    }
    var selectedFolderCount: Int {
        Set(selectedItems.map { ($0.sourceRelativePath as NSString).deletingLastPathComponent })
            .filter { !$0.isEmpty }.count
    }
    var availableFolders: [String] {
        Set(manifestItems.map { ($0.sourceRelativePath as NSString).deletingLastPathComponent })
            .filter { !$0.isEmpty }
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }
    var availableRecordedDays: [(key: String, title: String)] {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "nb_NO")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        let grouped = Dictionary(grouping: manifestItems, by: { Self.dayKey($0.recordedAt, calendar: calendar) })
        return grouped.compactMap { key, items in
            items.map(\.recordedAt).min().map { (key, formatter.string(from: $0)) }
        }.sorted { $0.key < $1.key }
    }
    var selectedRecordedRange: String? {
        guard let first = selectedItems.map(\.recordedAt).min(),
              let last = selectedItems.map(\.recordedAt).max()
        else { return nil }
        if Calendar.current.isDate(first, inSameDayAs: last) {
            return "\(first.formatted(.dateTime.day().month().hour().minute()))–\(last.formatted(.dateTime.hour().minute()))"
        }
        return "\(first.formatted(.dateTime.day().month()))–\(last.formatted(.dateTime.day().month()))"
    }
    var largestSelectedFile: CardImportManifestItem? { selectedItems.max { $0.sizeBytes < $1.sizeBytes } }
    var selectedPhotoGroups: [CardMediaGroup] {
        groups.compactMap { group in
            let jpeg = group.jpeg.flatMap { needsLocalImport($0.url) ? $0 : nil }
            let raw = group.raw.flatMap { needsLocalImport($0.url) ? $0 : nil }
            guard jpeg != nil || raw != nil else { return nil }
            return CardMediaGroup(baseName: group.baseName, jpeg: jpeg, raw: raw)
        }
    }
    var selectedVideos: [CardVideoFile] { videos.filter { needsLocalImport($0.url) } }
    var selectedAudios: [CardAudioFile] { audios.filter { needsLocalImport($0.url) } }
    var visibleManifestItems: [CardImportManifestItem] {
        let filtered = manifestItems.filter { item in
            let matchesKind: Bool
            switch mediaFilter {
            case .all: matchesKind = true
            case .photo: matchesKind = item.mediaKind == .photo
            case .raw: matchesKind = item.mediaKind == .raw
            case .video: matchesKind = item.mediaKind == .video
            case .audio: matchesKind = item.mediaKind == .audio
            }
            let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            let folder = (item.sourceRelativePath as NSString).deletingLastPathComponent
            let matchesFolder = folderFilter.isEmpty || folder == folderFilter
            let matchesDay = recordedDayFilter.isEmpty || Self.dayKey(item.recordedAt) == recordedDayFilter
            return matchesKind && matchesFolder && matchesDay
                && (query.isEmpty || item.filename.localizedCaseInsensitiveContains(query))
        }
        switch itemSort {
        case .oldest: return filtered.sorted { $0.recordedAt < $1.recordedAt }
        case .newest: return filtered.sorted { $0.recordedAt > $1.recordedAt }
        case .name: return filtered.sorted { $0.filename.localizedStandardCompare($1.filename) == .orderedAscending }
        case .size: return filtered.sorted { $0.sizeBytes > $1.sizeBytes }
        }
    }
    var safetyReserveBytes: Int64 { 512 * 1024 * 1024 }
    var requiredDeviceBytes: Int64 { selectedTotalBytes + safetyReserveBytes }
    var hasEnoughDeviceSpace: Bool { deviceAvailableBytes.map { $0 >= requiredDeviceBytes } ?? true }
    var estimatedCopySeconds: TimeInterval {
        Double(selectedTotalBytes) / (80 * 1_024 * 1_024)
    }
    var estimatedUploadSeconds: TimeInterval? {
        guard storagePolicy != .localOnly, networkTransport != .offline else { return nil }
        let bytesPerSecond: Double
        switch networkTransport {
        case .wifi, .wired: bytesPerSecond = networkIsConstrained ? 2.5 * 1_024 * 1_024 : 8 * 1_024 * 1_024
        case .cellular: bytesPerSecond = networkIsConstrained ? 0.75 * 1_024 * 1_024 : 2 * 1_024 * 1_024
        case .other: bytesPerSecond = 3 * 1_024 * 1_024
        case .offline: return nil
        }
        return Double(selectedTotalBytes) / bytesPerSecond
    }
    var policyReadinessMessage: String {
        guard storagePolicy != .localOnly else { return "Kan fullføres helt uten nett." }
        guard SignInService.shared.session != nil else {
            return "CreatorHub-backup krever innlogging. Lokal verifisering kan fortsatt fullføres."
        }
        guard networkTransport != .offline else {
            return "Ingen nettforbindelse. Filene verifiseres lokalt og skybackup fortsetter automatisk senere."
        }
        if networkIsConstrained || networkIsExpensive {
            return "\(networkTransport.title) er begrenset eller kostbart. Lokal import er trygg; skybackup kan ta lenger tid."
        }
        return "Lokal verifisering og CreatorHub-backup kan fullføres nå via \(networkTransport.title)."
    }
    var hasLowBatteryWarning: Bool {
        guard let batteryLevel else { return false }
        return batteryLevel >= 0 && batteryLevel < 0.20
    }
    var fractionComplete: Double {
        switch phase {
        case .importing:
            totalBytes > 0 ? min(1, Double(copiedBytes) / Double(totalBytes)) : 0
        default:
            progressTotal > 0 ? Double(progressDone) / Double(progressTotal) : 0
        }
    }
    var transferSpeedBytesPerSecond: Double? {
        guard phase == .importing, let importStartedAt, copiedBytes > 0 else { return nil }
        return Double(copiedBytes) / max(0.25, Date().timeIntervalSince(importStartedAt))
    }
    var estimatedSecondsRemaining: TimeInterval? {
        guard let speed = transferSpeedBytesPerSecond, speed > 0 else { return nil }
        return Double(max(0, totalBytes - copiedBytes)) / speed
    }

    private static func transport(for path: NWPath) -> NetworkTransport {
        guard path.status == .satisfied else { return .offline }
        if path.usesInterfaceType(.wiredEthernet) { return .wired }
        if path.usesInterfaceType(.wifi) { return .wifi }
        if path.usesInterfaceType(.cellular) { return .cellular }
        return .other
    }

    private static func dayKey(_ date: Date, calendar: Calendar = .current) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }

    // MARK: - Pick and scan

    func handlePick(_ result: Result<[URL], Error>) async {
        switch result {
        case .failure(let error):
            phase = .failed(error.localizedDescription)
        case .success(let urls):
            releaseScopedAccess()
            scopedURLs = urls
            pickedURLs = urls
            for url in urls { _ = url.startAccessingSecurityScopedResource() }
            statusLine = "Skanner kortet uten å endre filer …"
            let scan = await Task.detached(priority: .userInitiated) {
                CardImportService.scanAll(urls: urls)
            }.value

            let owner = SignInService.shared.session?.userId ?? ownerUserId ?? "local-photographer"
            let database: AppDatabase
            let store: CardImportManifestStore
            do {
                database = try AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL())
                store = CardImportManifestStore(database: database)
                self.database = database
                manifestStore = store
                profileStore = CardImportProfileStore(database: database)
            } catch {
                releaseScopedAccess()
                phase = .failed("Kunne ikke lagre importmanifestet: \(error.localizedDescription)")
                return
            }

            let ownerCandidates = [owner, "local-photographer"]
            let directMatch = try? await store.latestUnfinished(
                ownerUserIds: [owner, "local-photographer"],
                cardIdentifier: scan.cardIdentifier
            )
            let provisionalItems = CardImportManifestBuilder.makeItems(
                runId: UUID(), scan: scan, pickedURLs: urls
            )
            let contentMatch = directMatch == nil
                ? try? await store.bestUnfinishedMatch(
                    ownerUserIds: ownerCandidates,
                    sourceFingerprints: Set(provisionalItems.map(\.sourceFingerprint))
                )
                : nil
            let matchingPrevious = directMatch ?? contentMatch
            let runId = matchingPrevious?.id ?? UUID()
            manifestRunId = runId
            isResumingCard = matchingPrevious != nil
            needsCardReselection = false
            groups = scan.photoGroups
            videos = scan.videos
            audios = scan.audios
            originalPhotoCount = scan.photoGroups.count
            originalVideoCount = scan.videos.count
            originalAudioCount = scan.audios.count
            unsupportedFileCount = scan.unsupportedFileCount
            sidecarFileCount = scan.sidecarFileCount
            proxyFileCount = scan.proxyFileCount
            cardName = scan.cardName
            if !isResumingCard { plannedCardLabel = scan.cardName }
            cardIdentifier = scan.cardIdentifier
            cardCapacityBytes = scan.capacityBytes
            cardAvailableBytes = scan.availableBytes
            var scannedItems = CardImportManifestBuilder.makeItems(
                runId: runId,
                scan: scan,
                pickedURLs: urls
            )
            if let signatures = try? await CardImportService(database: database)
                .existingImportSignatures(ownerUserId: owner) {
                for index in scannedItems.indices {
                    let signature = CardImportService.importSignature(
                        filename: scannedItems[index].filename,
                        sizeBytes: scannedItems[index].sizeBytes
                    )
                    scannedItems[index].inspection.duplicateCandidate = signatures.contains(signature)
                }
            }
            if let matchingPrevious,
               let storedItems = try? await store.items(runId: matchingPrevious.id) {
                let storedByFingerprint = Dictionary(uniqueKeysWithValues: storedItems.map { ($0.sourceFingerprint, $0) })
                scannedItems = scannedItems.map { scanned in
                    guard var stored = storedByFingerprint[scanned.sourceFingerprint] else { return scanned }
                    stored.inspection = scanned.inspection
                    return stored
                }
                let scannedFingerprints = Set(scannedItems.map(\.sourceFingerprint))
                let missingItems = storedItems.compactMap { stored -> CardImportManifestItem? in
                    guard stored.selected,
                          !stored.status.isLocallyTerminal,
                          !scannedFingerprints.contains(stored.sourceFingerprint)
                    else { return nil }
                    var missing = stored
                    missing.status = .failed
                    missing.copiedBytes = 0
                    missing.lastError = "Filen finnes ikke på det valgte kortet eller i den valgte mappen."
                    return missing
                }
                scannedItems.append(contentsOf: missingItems)
                importedSessionId = matchingPrevious.sessionId
                pendingProjectId = matchingPrevious.projectId
                pendingProjectTitle = matchingPrevious.projectTitle
                storagePolicy = matchingPrevious.storagePolicy
                plannedCardLabel = matchingPrevious.plannedCardLabel ?? scan.cardName
            }
            manifestItems = scannedItems
            totalBytes = selectedTotalBytes
            copiedBytes = scannedItems.filter { $0.selected }.reduce(0) { $0 + min($1.copiedBytes, $1.sizeBytes) }
            cardCanBeRemoved = false
            locallyVerifiedAt = nil
            deviceAvailableBytes = CardImportService.availableCapacity()
            let level = UIDevice.current.batteryLevel
            batteryLevel = level >= 0 ? level : nil
            if scannedItems.isEmpty {
                phase = .failed("Fant ingen støttede foto-, video- eller lydfiler på det valgte mediet.")
            } else {
                if sessionName.isEmpty { sessionName = Self.defaultSessionName(cardName: scan.cardName) }
                let now = Date()
                let run = CardImportRun(
                    id: runId,
                    ownerUserId: owner,
                    sessionId: importedSessionId,
                    projectId: pendingProjectId,
                    projectTitle: pendingProjectTitle,
                    cardIdentifier: scan.cardIdentifier,
                    cardName: scan.cardName,
                    plannedCardLabel: plannedCardLabel,
                    cardCapacityBytes: scan.capacityBytes,
                    cardAvailableBytes: scan.availableBytes,
                    sourceBookmark: CardSourceBookmark.archive(urls),
                    sourceDisplayPath: urls.first?.lastPathComponent,
                    storagePolicy: storagePolicy,
                    status: .ready,
                    totalFiles: selectedFileCount,
                    totalBytes: selectedTotalBytes,
                    copiedBytes: copiedBytes,
                    completedFiles: scannedItems.filter { $0.selected && $0.status.isLocallyTerminal }.count,
                    duplicateFiles: scannedItems.filter { $0.selected && $0.status == .duplicate }.count,
                    failedFiles: scannedItems.filter { $0.selected && $0.status == .failed }.count,
                    manifestSha256: CardImportManifestBuilder.manifestDigest(items: scannedItems),
                    locallyVerifiedAt: matchingPrevious?.locallyVerifiedAt,
                    cloudVerifiedAt: matchingPrevious?.cloudVerifiedAt,
                    completedAt: matchingPrevious?.completedAt,
                    createdAt: matchingPrevious?.createdAt ?? now,
                    updatedAt: now
                )
                do {
                    try await store.prepare(run: run, items: scannedItems)
                    manifestItems = try await store.items(runId: runId)
                    manifestReady = true
                    includeProxyMedia = manifestItems.contains { $0.selected && $0.inspection.isProxy }
                    await loadProfiles(projectId: pendingProjectId)
                    statusLine = isResumingCard
                        ? "Samme kort er identifisert · ferdige filer hoppes over"
                        : "Kortet er skannet · velg hva som skal importeres"
                    phase = .review
                } catch {
                    releaseScopedAccess()
                    phase = .failed("Kunne ikke sikre importmanifestet før kopiering: \(error.localizedDescription)")
                }
            }
        }
    }

    func toggleItem(_ id: String) {
        guard let index = manifestItems.firstIndex(where: { $0.id == id }),
              [.waiting, .skipped, .failed].contains(manifestItems[index].status)
        else { return }
        manifestItems[index].selected.toggle()
        manifestItems[index].status = manifestItems[index].selected ? .waiting : .skipped
        persistSelection()
    }

    func selectAllVisible(_ selected: Bool) {
        let visibleIds = Set(visibleManifestItems.map(\.id))
        for index in manifestItems.indices where visibleIds.contains(manifestItems[index].id) {
            guard [.waiting, .skipped, .failed].contains(manifestItems[index].status) else { continue }
            manifestItems[index].selected = selected
            manifestItems[index].status = selected ? .waiting : .skipped
        }
        persistSelection()
    }

    // MARK: - Local ingest

    func runImport(project: BackendProjectSummary?) async {
        guard manifestReady, let manifestRunId, let manifestStore else {
            phase = .failed("Importmanifestet er ikke klart. Velg kortet på nytt før du fortsetter.")
            return
        }
        guard selectedFileCount > 0 else {
            phase = .failed("Velg minst én fil som skal importeres.")
            return
        }
        let signedIn = SignInService.shared.session
        if storagePolicy != .localOnly, signedIn == nil {
            phase = .failed("Velg «Kun iPad» eller logg inn før du ber om CreatorHub-backup.")
            return
        }
        let owner = isResumingCard
            ? (ownerUserId ?? signedIn?.userId ?? "local-photographer")
            : (signedIn?.userId ?? "local-photographer")
        let targetProjectId = project?.id ?? pendingProjectId
        let targetProjectTitle = project?.title ?? pendingProjectTitle
        totalBytes = selectedTotalBytes
        deviceAvailableBytes = CardImportService.availableCapacity()
        if let available = deviceAvailableBytes,
           selectedTotalBytes > max(0, available - safetyReserveBytes) {
            phase = .failed(
                "Ikke nok ledig plass på iPaden. Importen trenger \(Self.bytes(selectedTotalBytes)) pluss 512 MB sikkerhetsmargin, men \(Self.bytes(available)) er ledig."
            )
            return
        }

        beginBackgroundTask()
        defer { endBackgroundTask() }

        let database: AppDatabase
        let service: CardImportService
        do {
            database = try AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL())
            service = CardImportService(database: database)
            self.database = database
        } catch {
            phase = .failed("Kunne ikke åpne lokal database: \(error.localizedDescription)")
            return
        }

        let name = sessionName.isEmpty ? Self.defaultSessionName(cardName: cardName) : sessionName
        phase = .importing
        let photoGroupsToImport = selectedPhotoGroups
        let videosToImport = selectedVideos
        let audiosToImport = selectedAudios
        if !isResumingCard {
            originalPhotoCount = photoGroupsToImport.count
            originalVideoCount = videosToImport.count
            originalAudioCount = audiosToImport.count
        }
        progressTotal = photoGroupsToImport.count + videosToImport.count + audiosToImport.count
        progressDone = 0
        copiedBytes = manifestItems.filter { $0.selected && $0.status.isLocallyTerminal }
            .reduce(0) { $0 + $1.sizeBytes }
        if !isResumingCard {
            duplicateCount = 0
            successfulImportCount = 0
        } else {
            duplicateCount = manifestItems.filter { $0.selected && $0.status == .duplicate }.count
            let assetKeys = manifestItems.compactMap { item -> String? in
                guard item.selected, item.status.isLocallyTerminal, item.status != .duplicate else { return nil }
                return item.photoAssetId ?? item.videoAssetId ?? item.audioAssetId
            }
            successfulImportCount = Set(assetKeys).count
        }
        let availablePaths = Set(
            groups.flatMap { [$0.jpeg?.url, $0.raw?.url].compactMap { $0 } }
                .map { CardImportManifestBuilder.relativePath(for: $0, roots: pickedURLs) }
                + videos.map { CardImportManifestBuilder.relativePath(for: $0.url, roots: pickedURLs) }
                + audios.map { CardImportManifestBuilder.relativePath(for: $0.url, roots: pickedURLs) }
        )
        failedImportCount = manifestItems.filter {
            $0.selected && $0.status == .failed && !availablePaths.contains($0.sourceRelativePath)
        }.count
        statusLine = "Forbereder lokal, verifisert kopi …"
        importStartedAt = Date()

        let store = SessionStore(database: database)
        let importSession: Session
        do {
            if isResumingCard,
               let importedSessionId,
               let existing = try await store.fetchSession(id: importedSessionId) {
                importSession = existing
            } else {
                importSession = try await service.createImportSession(name: name, ownerUserId: owner)
            }
        } catch {
            phase = .failed("Kunne ikke opprette lokal feltøkt: \(error.localizedDescription)")
            return
        }
        importedSessionId = importSession.id
        ownerUserId = owner
        do {
            try CardImportService.cleanupInterruptedCopies(sessionId: importSession.id)
        } catch {
            phase = .failed("Kunne ikke rydde en ufullstendig lokal kopi: \(error.localizedDescription)")
            return
        }
        try? await manifestStore.updateRun(
            id: manifestRunId,
            status: .importing,
            sessionId: importSession.id,
            projectId: targetProjectId,
            projectTitle: targetProjectTitle,
            plannedCardLabel: plannedCardLabel,
            storagePolicy: storagePolicy
        )

        var seenPhotos = (try? await service.existingChecksums(ownerUserId: owner)) ?? []
        var seenVideos = (try? await service.existingVideoChecksums(ownerUserId: owner)) ?? []
        var seenAudios = (try? await service.existingAudioChecksums(ownerUserId: owner)) ?? []
        var photoItems: [DeliveryService.CardBackupItem] = isResumingCard ? pendingBackupItems : []
        var videoIds: [String] = isResumingCard ? pendingVideoAssetIds : []
        var audioIds: [String] = isResumingCard ? pendingAudioAssetIds : []
        if isResumingCard, photoItems.isEmpty, videoIds.isEmpty, audioIds.isEmpty {
            let rebuilt = await rebuildPendingMediaFromManifest(database: database)
            photoItems = rebuilt.photos
            videoIds = rebuilt.videoIds
            audioIds = rebuilt.audioIds
        }

        let progress: @Sendable (Int64) -> Void = { [weak self] delta in
            Task { @MainActor in self?.copiedBytes += delta }
        }
        let fileProgress: @Sendable (URL, Int64) -> Void = { [weak self] url, delta in
            Task { @MainActor in self?.incrementItemProgress(for: url, by: delta) }
        }

        for group in photoGroupsToImport {
            statusLine = "Kopierer og verifiserer \(group.display.filename) …"
            await setItemStatus(urls: [group.jpeg?.url, group.raw?.url].compactMap { $0 }, status: .copying)
            do {
                let result = try await service.importGroup(
                    group,
                    into: importSession.id,
                    ownerUserId: owner,
                    seenChecksums: seenPhotos,
                    storagePolicy: storagePolicy,
                    onBytesCopied: progress,
                    onFileBytesCopied: fileProgress
                )
                if let checksum = result.checksum { seenPhotos.insert(checksum) }
                if let imported = result.imported {
                    photoItems.append(contentsOf: imported.backupItems)
                    successfulImportCount += 1
                    for file in [group.jpeg, group.raw].compactMap({ $0 }) {
                        await setItemStatus(
                            urls: [file.url],
                            status: .localVerified,
                            checksum: imported.sourceChecksums[file.url],
                            photoAssetId: imported.asset.id.uuidString.lowercased()
                        )
                    }
                    if storagePolicy != .localOnly, targetProjectId == nil {
                        try? await store.updateAssetCloudState(
                            id: imported.asset.id,
                            state: .waitingForProject
                        )
                    }
                } else {
                    duplicateCount += 1
                    await setItemStatus(
                        urls: [group.jpeg?.url, group.raw?.url].compactMap { $0 },
                        status: .duplicate,
                        checksum: result.checksum
                    )
                }
            } catch {
                failedImportCount += 1
                await setItemStatus(
                    urls: [group.jpeg?.url, group.raw?.url].compactMap { $0 },
                    status: .failed,
                    error: error.localizedDescription
                )
                AppLog.capture.error("[CardImport] photo \(group.baseName, privacy: .public) failed: \(error.localizedDescription, privacy: .public)")
            }
            progressDone += 1
        }

        let videoPolicy = VideoCaptureAsset.StoragePolicy(rawValue: storagePolicy.rawValue)
            ?? .keepLocalAndCloud
        for (index, video) in videosToImport.enumerated() {
            statusLine = "Kopierer og verifiserer \(video.filename) …"
            await setItemStatus(urls: [video.url], status: .copying)
            do {
                let result = try await service.importVideo(
                    video,
                    sessionId: importSession.id,
                    ownerUserId: owner,
                    projectId: targetProjectId,
                    takeNumber: index + 1,
                    storagePolicy: videoPolicy,
                    seenChecksums: seenVideos,
                    onBytesCopied: progress,
                    onFileBytesCopied: fileProgress
                )
                seenVideos.insert(result.checksum)
                if let asset = result.asset {
                    videoIds.append(asset.id)
                    successfulImportCount += 1
                    await setItemStatus(
                        urls: [video.url], status: .localVerified,
                        checksum: result.checksum, videoAssetId: asset.id
                    )
                } else {
                    duplicateCount += 1
                    await setItemStatus(urls: [video.url], status: .duplicate, checksum: result.checksum)
                }
            } catch {
                failedImportCount += 1
                await setItemStatus(urls: [video.url], status: .failed, error: error.localizedDescription)
                AppLog.capture.error("[CardImport] video \(video.filename, privacy: .public) failed: \(error.localizedDescription, privacy: .public)")
            }
            progressDone += 1
        }

        let audioPolicy = ProductionAudioAsset.StoragePolicy(rawValue: storagePolicy.rawValue)
            ?? .keepLocalAndCloud
        for audio in audiosToImport {
            statusLine = "Kopierer og verifiserer \(audio.filename) …"
            await setItemStatus(urls: [audio.url], status: .copying)
            do {
                let result = try await service.importAudio(
                    audio,
                    sessionId: importSession.id,
                    ownerUserId: owner,
                    projectId: targetProjectId,
                    storagePolicy: audioPolicy,
                    seenChecksums: seenAudios,
                    onBytesCopied: progress,
                    onFileBytesCopied: fileProgress
                )
                seenAudios.insert(result.checksum)
                if let asset = result.asset {
                    audioIds.append(asset.id)
                    successfulImportCount += 1
                    await setItemStatus(
                        urls: [audio.url], status: .localVerified,
                        checksum: result.checksum, audioAssetId: asset.id
                    )
                } else {
                    duplicateCount += 1
                    await setItemStatus(urls: [audio.url], status: .duplicate, checksum: result.checksum)
                }
            } catch {
                failedImportCount += 1
                await setItemStatus(urls: [audio.url], status: .failed, error: error.localizedDescription)
                AppLog.capture.error("[CardImport] audio \(audio.filename, privacy: .public) failed: \(error.localizedDescription, privacy: .public)")
            }
            progressDone += 1
        }

        // No reads below this point touch the removable card.
        releaseScopedAccess()
        cardCanBeRemoved = failedImportCount == 0
        locallyVerifiedAt = cardCanBeRemoved ? Date() : nil
        if cardCanBeRemoved { copiedBytes = totalBytes }
        let digest = CardImportManifestBuilder.manifestDigest(items: manifestItems)
        try? await manifestStore.updateRun(
            id: manifestRunId,
            status: failedImportCount == 0 ? .localVerified : .paused,
            sessionId: importSession.id,
            projectId: targetProjectId,
            projectTitle: targetProjectTitle,
            plannedCardLabel: plannedCardLabel,
            storagePolicy: storagePolicy,
            locallyVerifiedAt: locallyVerifiedAt,
            manifestSha256: digest
        )

        if successfulImportCount == 0, failedImportCount == 0, duplicateCount > 0 {
            try? await manifestStore.updateRun(
                id: manifestRunId,
                status: .completed,
                completedAt: Date()
            )
            receipt = try? await manifestStore.receipt(id: manifestRunId)
            statusLine = "Alle valgte filer var allerede importert og kontrollert"
            phase = .done
            return
        }

        guard successfulImportCount > 0 else {
            phase = .failed(
                failedImportCount > 0
                    ? "Ingen filer ble ferdig kopiert. Kortet er ikke endret; kontroller tilkoblingen og prøv igjen."
                    : "Alle filene var allerede importert."
            )
            return
        }

        pendingBackupItems = photoItems
        pendingVideoAssetIds = videoIds
        pendingAudioAssetIds = audioIds
        pendingProjectId = targetProjectId
        pendingProjectTitle = targetProjectTitle
        pendingSessionStartedAt = importSession.startsAt
        pendingJobId = importSession.id
        isResumingCard = failedImportCount > 0

        guard storagePolicy != .localOnly else {
            if let projectId = targetProjectId, let signedIn {
                let backend = BackendClient(
                    baseURL: signedIn.backendBaseURL,
                    authHeaders: ["Authorization": "Bearer \(signedIn.bearer)"]
                )
                _ = await reportCardTransfer(
                    backend: backend,
                    projectId: projectId,
                    status: cardCanBeRemoved ? "local_verified" : "failed"
                )
            }
            clearPendingMemory(keepLocalResult: true)
            try? await manifestStore.updateRun(
                id: manifestRunId,
                status: failedImportCount > 0 ? .paused : .completed,
                completedAt: failedImportCount > 0 ? nil : Date(),
                manifestSha256: digest
            )
            receipt = try? await manifestStore.receipt(id: manifestRunId)
            statusLine = Self.localCompletionMessage(success: successfulImportCount, failed: failedImportCount)
            phase = .done
            return
        }

        let jobStore = CardBackupJobStore(database: database)
        pendingJobStore = jobStore
        do {
            try await persistPendingJob()
        } catch {
            phase = .failed("Filene er trygge lokalt, men backup-køen kunne ikke lagres: \(error.localizedDescription)")
            return
        }

        if let projectId = targetProjectId, let signedIn {
            let backend = BackendClient(
                baseURL: signedIn.backendBaseURL,
                authHeaders: ["Authorization": "Bearer \(signedIn.bearer)"]
            )
            _ = await reportCardTransfer(
                backend: backend,
                projectId: projectId,
                status: cardCanBeRemoved ? "local_verified" : "failed"
            )
        }

        guard targetProjectId != nil else {
            statusLine = "Lokalt verifisert · velg prosjekt når du har nett"
            phase = .done
            return
        }
        await retryBackup()
    }

    // MARK: - Cloud backup

    func applyPlannedCardLabel(_ label: String?) {
        guard let label else { return }
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { plannedCardLabel = trimmed }
    }

    func prepareProject(_ project: BackendProjectSummary) async {
        pendingProjectId = project.id
        pendingProjectTitle = project.title
        await loadProfiles(projectId: project.id)
        statusLine = "Prosjektet «\(project.title)» er valgt. Kontroller utvalget og start importen."
    }

    func setIncludeProxyMedia(_ included: Bool) {
        includeProxyMedia = included
        for index in manifestItems.indices where manifestItems[index].inspection.isProxy {
            guard [.waiting, .skipped, .failed].contains(manifestItems[index].status) else { continue }
            let selectable = manifestItems[index].inspection.state != .unreadable
            manifestItems[index].selected = included && selectable
            manifestItems[index].status = included && selectable ? .waiting : .skipped
        }
        persistSelection()
    }

    func applyProfile(_ profileId: UUID) {
        guard let profile = profiles.first(where: { $0.id == profileId }) else { return }
        selectedProfileId = profileId
        storagePolicy = profile.storagePolicy
        includeProxyMedia = profile.includeProxies
        for index in manifestItems.indices {
            guard [.waiting, .skipped, .failed].contains(manifestItems[index].status) else { continue }
            let selected = profile.includes(manifestItems[index])
            manifestItems[index].selected = selected
            manifestItems[index].status = selected ? .waiting : .skipped
        }
        persistSelection()
        statusLine = "Importprofilen «\(profile.name)» er brukt."
    }

    func saveCurrentProfile() async {
        let trimmed = profileName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            statusLine = "Gi importprofilen et navn før den lagres."
            return
        }
        guard let profileStore else {
            statusLine = "Profilarkivet er ikke tilgjengelig."
            return
        }
        let owner = SignInService.shared.session?.userId ?? ownerUserId ?? "local-photographer"
        let scopeKey: String
        if profileScope == .project {
            guard let pendingProjectId else {
                statusLine = "Velg et prosjekt før du lagrer en prosjektprofil."
                return
            }
            scopeKey = CardImportProfile.projectScopeKey(pendingProjectId)
        } else {
            scopeKey = CardImportProfile.cardScopeKey(capacity: cardCapacityBytes, items: manifestItems)
        }
        let selected = selectedItems
        let now = Date()
        let profile = CardImportProfile(
            id: UUID(), ownerUserId: owner, name: trimmed,
            scope: profileScope, scopeKey: scopeKey,
            mediaKinds: Set(selected.map(\.mediaKind)),
            fileExtensions: Set(selected.map { $0.fileExtension.lowercased() }),
            includedFolders: Set(selected.map { ($0.sourceRelativePath as NSString).deletingLastPathComponent }),
            includeProxies: includeProxyMedia,
            storagePolicy: storagePolicy,
            createdAt: now, updatedAt: now
        )
        do {
            try await profileStore.save(profile)
            profileName = ""
            await loadProfiles(projectId: pendingProjectId)
            selectedProfileId = profiles.first(where: { $0.name == trimmed && $0.scope == profileScope })?.id
            statusLine = "Importprofilen «\(trimmed)» er lagret."
        } catch {
            statusLine = "Kunne ikke lagre importprofilen: \(error.localizedDescription)"
        }
    }

    func deleteSelectedProfile() async {
        guard let selectedProfileId,
              let profile = profiles.first(where: { $0.id == selectedProfileId }),
              let profileStore
        else { return }
        do {
            try await profileStore.delete(id: profile.id, ownerUserId: profile.ownerUserId)
            self.selectedProfileId = nil
            await loadProfiles(projectId: pendingProjectId)
            statusLine = "Importprofilen «\(profile.name)» er slettet."
        } catch {
            statusLine = "Kunne ikke slette importprofilen: \(error.localizedDescription)"
        }
    }

    func bindProjectAndRetry(_ project: BackendProjectSummary) async {
        pendingProjectId = project.id
        pendingProjectTitle = project.title
        do {
            try await persistPendingJob()
        } catch {
            phase = .failed("Kunne ikke lagre prosjektvalget: \(error.localizedDescription)")
            return
        }
        await retryBackup()
    }

    private func loadProfiles(projectId: String?) async {
        guard let profileStore else { return }
        let signedOwner = SignInService.shared.session?.userId
        let owners = Array(Set([signedOwner, ownerUserId, "local-photographer"].compactMap { $0 }))
        let cardKey = CardImportProfile.cardScopeKey(capacity: cardCapacityBytes, items: manifestItems)
        profiles = (try? await profileStore.applicable(
            ownerUserIds: owners,
            cardScopeKey: cardKey,
            projectId: projectId
        )) ?? []
    }

    func retryBackup() async {
        guard let session = SignInService.shared.session,
              let projectId = pendingProjectId,
              let startedAt = pendingSessionStartedAt,
              let sessionId = pendingJobId,
              hasPendingCloudBackup
        else {
            phase = .failed("Velg et CreatorHub-prosjekt før backupen fortsetter.")
            return
        }

        beginBackgroundTask()
        defer { endBackgroundTask() }

        let database: AppDatabase
        do {
            database = try self.database ?? AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL())
            self.database = database
            pendingJobStore = pendingJobStore ?? CardBackupJobStore(database: database)
            let store = manifestStore ?? CardImportManifestStore(database: database)
            manifestStore = store
            if manifestRunId == nil, let run = try? await store.run(sessionId: sessionId) {
                manifestRunId = run.id
                manifestItems = (try? await store.items(runId: run.id)) ?? manifestItems
            }
        } catch {
            phase = .failed("Kunne ikke åpne backup-checkpoint: \(error.localizedDescription)")
            return
        }

        phase = .backingUp
        if let manifestRunId, let manifestStore {
            try? await manifestStore.updateRun(
                id: manifestRunId,
                status: .uploading,
                sessionId: sessionId,
                projectId: projectId,
                projectTitle: pendingProjectTitle,
                plannedCardLabel: plannedCardLabel,
                storagePolicy: storagePolicy
            )
        }
        progressDone = 0
        let photoGroups = Dictionary(grouping: pendingBackupItems, by: \.localId)
        progressTotal = photoGroups.count + pendingVideoAssetIds.count + pendingAudioAssetIds.count
        statusLine = "Sikrer lokalt verifiserte filer i CreatorHub …"

        let backend = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"]
        )
        let delivery = pendingDelivery ?? DeliveryService(
            backend: backend,
            uploadStore: PersistentUploadStore(database: database),
            partUploader: BackgroundMultipartUploader.shared
        )
        pendingDelivery = delivery
        _ = await reportCardTransfer(backend: backend, projectId: projectId, status: "uploading")
        let photoStore = SessionStore(database: database)
        var activePhotoId: UUID?

        do {
            for (assetId, items) in photoGroups.sorted(by: { $0.key.uuidString < $1.key.uuidString }) {
                activePhotoId = assetId
                await setManifestAssetStatus(photoAssetId: assetId.uuidString.lowercased(), status: .uploading)
                try await photoStore.updateAssetCloudState(id: assetId, state: .uploading)
                let result = try await delivery.backupPhoto(
                    sessionName: sessionName,
                    sessionStartedAt: startedAt,
                    items: items,
                    projectId: projectId
                )
                try await photoStore.updateAssetCloudState(
                    id: assetId,
                    state: .secured,
                    backendAssetId: result.backendAssetId,
                    verifiedAt: Date()
                )
                if storagePolicy == .creatorHubOnly,
                   let asset = try await photoStore.fetchAsset(id: assetId) {
                    let root = try CardImportService.storageDirectory(sessionId: sessionId)
                    let released = try PhotoLocalOriginalRetention.releaseVerifiedOriginals(
                        for: asset,
                        managedRoot: root
                    )
                    if !released.isEmpty {
                        try await photoStore.markLocalOriginalReleased(id: assetId, releasedPaths: released)
                    }
                }
                pendingBackupItems.removeAll { $0.localId == assetId }
                await setManifestAssetStatus(photoAssetId: assetId.uuidString.lowercased(), status: .cloudVerified)
                try await persistPendingJob()
                activePhotoId = nil
                progressDone += 1
            }

            let videoStore = VideoCaptureStore(database: database)
            let uploader = VideoCaptureUploader(backend: backend, store: videoStore)
            for videoId in Array(pendingVideoAssetIds) {
                await setManifestAssetStatus(videoAssetId: videoId, status: .uploading)
                try await videoStore.assignProject(
                    id: videoId,
                    ownerUserId: session.userId,
                    projectId: projectId
                )
                guard let asset = try await videoStore.asset(id: videoId, ownerUserId: session.userId) else {
                    throw CardImportError.copyFailed("mangler lokal videorad \(videoId)")
                }
                try await uploader.upload(asset)
                if asset.storagePolicy == .creatorHubOnly,
                   let verified = try await videoStore.asset(id: videoId, ownerUserId: session.userId) {
                    _ = try VideoLocalOriginalRetention.releaseVerifiedOriginal(
                        for: verified,
                        managedRoot: CardImportService.storageDirectory(sessionId: sessionId)
                    )
                }
                pendingVideoAssetIds.removeAll { $0 == videoId }
                await setManifestAssetStatus(videoAssetId: videoId, status: .cloudVerified)
                try await persistPendingJob()
                progressDone += 1
            }

            let audioStore = ProductionAudioStore(database: database)
            let audioUploader = ProductionAudioUploader(backend: backend, store: audioStore)
            for audioId in Array(pendingAudioAssetIds) {
                await setManifestAssetStatus(audioAssetId: audioId, status: .uploading)
                try await audioStore.assignProject(
                    id: audioId,
                    ownerUserId: session.userId,
                    projectId: projectId
                )
                guard let asset = try await audioStore.asset(id: audioId, ownerUserId: session.userId) else {
                    throw CardImportError.copyFailed("mangler lokal lydrad \(audioId)")
                }
                try await audioUploader.upload(asset)
                if asset.storagePolicy == .creatorHubOnly,
                   let verified = try await audioStore.asset(id: audioId, ownerUserId: session.userId) {
                    _ = try ProductionAudioLocalOriginalRetention.releaseVerifiedOriginal(
                        for: verified,
                        managedRoot: CardImportService.storageDirectory(sessionId: sessionId)
                    )
                }
                pendingAudioAssetIds.removeAll { $0 == audioId }
                await setManifestAssetStatus(audioAssetId: audioId, status: .cloudVerified)
                try await persistPendingJob()
                progressDone += 1
            }
        } catch {
            if let activePhotoId {
                try? await photoStore.updateAssetCloudState(
                    id: activePhotoId,
                    state: .failed,
                    error: error.localizedDescription
                )
            }
            statusLine = "Backup pauset · lokale originaler er beholdt"
            _ = await reportCardTransfer(backend: backend, projectId: projectId, status: "paused")
            let cardAdvice = cardCanBeRemoved
                ? "Kortet kan fortsatt fjernes."
                : "Behold kortet til filene som ikke kunne leses er kontrollert."
            phase = .failed("CreatorHub-backup feilet: \(error.localizedDescription). \(cardAdvice) Prøv igjen når nettet er stabilt.")
            return
        }

        let verifiedAt = Date()
        pendingCloudVerifiedAt = verifiedAt
        reportPending = true
        do {
            try await persistPendingJob()
        } catch {
            statusLine = "Mediene er verifisert i CreatorHub · prosjektkvitteringen venter"
            phase = .failed("Backupen er ferdig, men den lokale kvitteringskøen kunne ikke oppdateres: \(error.localizedDescription). Mediene er ikke i fare.")
            return
        }

        let reported = await reportCardTransfer(
            backend: backend,
            projectId: projectId,
            status: "cloud_verified",
            cloudVerifiedAt: verifiedAt
        )
        guard reported else {
            statusLine = "Sikret i CreatorHub · venter på synk til prosjektoversikten"
            phase = .failed("Mediene er verifisert i CreatorHub, men kvitteringen til prosjektoversikten kunne ikke sendes. Prøv kvitteringen igjen; ingen filer lastes opp på nytt.")
            return
        }
        reportPending = false
        await finishPendingBackup()
        if let manifestRunId, let manifestStore {
            try? await manifestStore.updateRun(
                id: manifestRunId,
                status: failedImportCount > 0 ? .paused : .completed,
                cloudVerifiedAt: verifiedAt,
                completedAt: failedImportCount > 0 ? nil : Date(),
                manifestSha256: CardImportManifestBuilder.manifestDigest(items: manifestItems)
            )
            receipt = try? await manifestStore.receipt(id: manifestRunId)
        }
        statusLine = failedImportCount > 0
            ? "\(successfulImportCount) sikret · \(failedImportCount) kunne ikke leses fra kortet"
            : "Alle \(successfulImportCount) filer er verifisert i CreatorHub"
        phase = .done
    }

    /// Reconstruct the latest unfinished cloud job from local SQLite. The
    /// removable card is no longer needed because all paths are local copies.
    func restorePendingBackup() async {
        guard phase == .picking else { return }
        await restoreUnfinishedManifest()
        guard phase == .picking,
              let session = SignInService.shared.session
        else { return }
        do {
            let database = try AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL())
            let cardManifestStore = manifestStore ?? CardImportManifestStore(database: database)
            manifestStore = cardManifestStore
            let jobStore = CardBackupJobStore(database: database)
            guard let job = try await jobStore.latestPending(ownerUserId: session.userId) else { return }
            pendingJobId = job.id
            pendingJobStore = jobStore
            self.database = database
            pendingBackupItems = job.items
            pendingVideoAssetIds = job.videoAssetIds
            pendingAudioAssetIds = job.audioAssetIds
            pendingProjectId = job.projectId
            pendingProjectTitle = job.projectTitle
            pendingSessionStartedAt = job.sessionStartedAt
            sessionName = job.sessionName
            importedSessionId = job.id
            ownerUserId = job.ownerUserId
            duplicateCount = job.duplicateCount
            failedImportCount = job.failedCount
            successfulImportCount = job.assetCount
            originalPhotoCount = job.photoCount
            originalVideoCount = job.videoCount
            originalAudioCount = job.audioCount
            unsupportedFileCount = job.unsupportedCount
            totalBytes = job.totalBytes
            copiedBytes = job.totalBytes
            storagePolicy = job.storagePolicy
            locallyVerifiedAt = job.locallyVerifiedAt
            pendingCloudVerifiedAt = job.cloudVerifiedAt
            reportPending = job.reportPending
            cardCanBeRemoved = job.failedCount == 0
            cardIdentifier = job.cardIdentifier
            cardName = job.cardName
            plannedCardLabel = job.plannedCardLabel ?? job.cardName
            cardCapacityBytes = job.cardCapacityBytes
            cardAvailableBytes = job.cardAvailableBytes
            progressDone = 0
            progressTotal = Set(job.items.map(\.localId)).count + job.videoAssetIds.count + job.audioAssetIds.count
            if let run = try? await cardManifestStore.run(sessionId: job.id) {
                manifestRunId = run.id
                manifestItems = (try? await cardManifestStore.items(runId: run.id)) ?? []
                receipt = try? await cardManifestStore.receipt(id: run.id)
            }

            // An empty durable upload list means every media object reached a
            // verified terminal state before the previous process stopped.
            // Recover the final project acknowledgement without re-uploading.
            if job.items.isEmpty, job.videoAssetIds.isEmpty, job.audioAssetIds.isEmpty, job.projectId != nil {
                pendingCloudVerifiedAt = job.cloudVerifiedAt ?? Date()
                reportPending = true
                try await persistPendingJob()
                statusLine = "Sikret i CreatorHub · bekrefter i prosjektoversikten …"
                phase = .done
                await retryProjectReport()
                return
            }

            let allPhotosExist = job.items.allSatisfy { FileManager.default.fileExists(atPath: $0.path) }
            let videoStore = VideoCaptureStore(database: database)
            var allVideosExist = true
            for id in job.videoAssetIds {
                guard let asset = try await videoStore.asset(id: id, ownerUserId: job.ownerUserId),
                      FileManager.default.fileExists(atPath: asset.localPath)
                else { allVideosExist = false; break }
            }
            let audioStore = ProductionAudioStore(database: database)
            var allAudiosExist = true
            for id in job.audioAssetIds {
                guard let asset = try await audioStore.asset(id: id, ownerUserId: job.ownerUserId),
                      FileManager.default.fileExists(atPath: asset.localPath)
                else { allAudiosExist = false; break }
            }
            guard allPhotosExist && allVideosExist && allAudiosExist else {
                phase = .failed("En ventende backup mangler en lokal original. CreatorHub sletter aldri resten automatisk; behold jobben for manuell kontroll.")
                return
            }

            if job.projectId == nil {
                statusLine = "Lokalt verifisert · velg prosjekt for å fortsette"
                phase = .done
            } else {
                statusLine = "Fant en avbrutt backup · venter på nett"
                phase = .failed("Backupen for «\(job.projectTitle ?? "CreatorHub")» fortsetter automatisk når nettet er tilgjengelig.")
                await resumeNetworkWorkIfPossible()
            }
        } catch {
            AppLog.sync.error("[CardImport] restore checkpoint failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func reset() {
        releaseScopedAccess()
        phase = .picking
        groups = []
        videos = []
        audios = []
        unsupportedFileCount = 0
        sidecarFileCount = 0
        proxyFileCount = 0
        copiedBytes = 0
        totalBytes = 0
        originalPhotoCount = 0
        originalVideoCount = 0
        originalAudioCount = 0
        cardCanBeRemoved = false
        locallyVerifiedAt = nil
        statusLine = ""
        importStartedAt = nil
        isResumingCard = false
        manifestItems = []
        manifestReady = false
        needsCardReselection = false
        receipt = nil
        profiles = []
        selectedProfileId = nil
        folderFilter = ""
        recordedDayFilter = ""
        includeProxyMedia = false
        pickedURLs = []
        // Resetting UI must never discard the durable intent to secure local
        // originals. A pending job stays discoverable on the next opening.
        clearPendingMemory(keepLocalResult: false)
    }

    /// Retries only the lightweight Workspace acknowledgement. Media bytes
    /// have already been verified in CreatorHub and are never uploaded twice.
    func retryProjectReport() async {
        guard reportPending,
              let session = SignInService.shared.session,
              let projectId = pendingProjectId,
              let verifiedAt = pendingCloudVerifiedAt
        else {
            phase = .failed("Prosjektkvitteringen mangler nødvendig lokal informasjon. Mediene er fortsatt sikret i CreatorHub.")
            return
        }
        phase = .backingUp
        progressDone = 0
        progressTotal = 1
        statusLine = "Bekrefter overføringen i prosjektoversikten …"
        let backend = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"]
        )
        let reported = await reportCardTransfer(
            backend: backend,
            projectId: projectId,
            status: "cloud_verified",
            cloudVerifiedAt: verifiedAt
        )
        guard reported else {
            statusLine = "Sikret i CreatorHub · prosjektkvitteringen venter"
            phase = .failed("Kun kvitteringen til prosjektoversikten feilet. Mediene er allerede verifisert i CreatorHub; prøv igjen når nettet er tilgjengelig.")
            return
        }
        progressDone = 1
        reportPending = false
        await finishPendingBackup()
        if let manifestRunId, let manifestStore {
            try? await manifestStore.updateRun(
                id: manifestRunId,
                status: failedImportCount > 0 ? .paused : .completed,
                cloudVerifiedAt: verifiedAt,
                completedAt: failedImportCount > 0 ? nil : Date(),
                manifestSha256: CardImportManifestBuilder.manifestDigest(items: manifestItems)
            )
            receipt = try? await manifestStore.receipt(id: manifestRunId)
        }
        statusLine = "Alle \(successfulImportCount) filer er verifisert i CreatorHub og bekreftet i prosjektoversikten"
        phase = .done
    }

    private func resumeNetworkWorkIfPossible() async {
        guard networkMonitor.currentPath.status == .satisfied,
              !isAutomaticResumeRunning,
              phase != .importing,
              phase != .backingUp
        else { return }
        isAutomaticResumeRunning = true
        defer { isAutomaticResumeRunning = false }
        if canRetryProjectReport {
            await retryProjectReport()
        } else if canRetryBackup {
            await retryBackup()
        }
    }

    // MARK: - Helpers

    private func restoreUnfinishedManifest() async {
        do {
            let database = try AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL())
            let store = CardImportManifestStore(database: database)
            self.database = database
            manifestStore = store
            profileStore = CardImportProfileStore(database: database)
            let signedOwner = SignInService.shared.session?.userId
            let owners = Array(Set([signedOwner, "local-photographer"].compactMap { $0 }))
            recentReceipts = (try? await store.recentReceipts(ownerUserIds: owners)) ?? []
            guard let run = try await store.latestUnfinished(ownerUserIds: owners) else { return }
            let storedItems = try await store.items(runId: run.id)
            manifestRunId = run.id
            manifestItems = storedItems
            importedSessionId = run.sessionId
            ownerUserId = run.ownerUserId
            pendingProjectId = run.projectId
            pendingProjectTitle = run.projectTitle
            cardIdentifier = run.cardIdentifier
            cardName = run.cardName
            plannedCardLabel = run.plannedCardLabel ?? run.cardName
            cardCapacityBytes = run.cardCapacityBytes
            cardAvailableBytes = run.cardAvailableBytes
            storagePolicy = run.storagePolicy
            copiedBytes = run.copiedBytes
            totalBytes = run.totalBytes
            locallyVerifiedAt = run.locallyVerifiedAt
            receipt = try? await store.receipt(id: run.id)

            let needsSource = storedItems.contains {
                $0.selected && [.waiting, .copying, .failed].contains($0.status)
            }
            guard needsSource else { return }

            guard let bookmark = run.sourceBookmark else {
                needsCardReselection = true
                isResumingCard = true
                failedImportCount = run.failedFiles
                phase = .failed("Sett inn «\(run.cardName)» og velg samme kort eller mappe for å fortsette. Ferdige filer kopieres ikke på nytt.")
                return
            }
            let urls = CardSourceBookmark.resolve(bookmark)
            guard !urls.isEmpty else {
                needsCardReselection = true
                isResumingCard = true
                failedImportCount = run.failedFiles
                phase = .failed("iPadOS trenger tilgang til «\(run.cardName)» på nytt. Velg samme kort; CreatorHub fortsetter fra manifestet.")
                return
            }
            await handlePick(.success(urls))
        } catch {
            AppLog.sync.error("[CardImport] manifest restore failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func rebuildPendingMediaFromManifest(
        database: AppDatabase
    ) async -> (photos: [DeliveryService.CardBackupItem], videoIds: [String], audioIds: [String]) {
        let photoStore = SessionStore(database: database)
        let photoIds = Set(manifestItems.compactMap(\.photoAssetId))
        var photos: [DeliveryService.CardBackupItem] = []
        for rawId in photoIds {
            guard let id = UUID(uuidString: rawId),
                  let asset = try? await photoStore.fetchAsset(id: id)
            else { continue }
            if let path = asset.previewKey, FileManager.default.fileExists(atPath: path) {
                photos.append(.init(
                    localId: id, originalFilename: asset.originalFilename,
                    captureTime: asset.captureTime, mime: "image/jpeg", path: path, kind: .preview
                ))
            }
            if let path = asset.fullKey, FileManager.default.fileExists(atPath: path) {
                photos.append(.init(
                    localId: id, originalFilename: asset.originalFilename,
                    captureTime: asset.captureTime, mime: asset.mime, path: path, kind: .full
                ))
            }
            if let path = asset.rawKey, FileManager.default.fileExists(atPath: path) {
                let ext = URL(fileURLWithPath: path).pathExtension
                photos.append(.init(
                    localId: id, originalFilename: asset.originalFilename,
                    captureTime: asset.captureTime,
                    mime: ext.isEmpty ? "application/octet-stream" : "image/x-\(ext.lowercased())",
                    path: path, kind: .raw
                ))
            }
        }
        let videoIds = Array(Set(manifestItems.compactMap(\.videoAssetId))).sorted()
        let audioIds = Array(Set(manifestItems.compactMap(\.audioAssetId))).sorted()
        return (photos, videoIds, audioIds)
    }

    private func persistSelection() {
        totalBytes = selectedTotalBytes
        deviceAvailableBytes = CardImportService.availableCapacity()
        guard let manifestStore, let manifestRunId else { return }
        let ids = Set(manifestItems.filter(\.selected).map(\.id))
        Task {
            do {
                try await manifestStore.setSelection(runId: manifestRunId, selectedIds: ids)
            } catch {
                AppLog.capture.error("[CardImport] selection checkpoint failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private func isSelected(_ url: URL) -> Bool {
        guard let item = manifestItem(for: url) else { return false }
        return item.selected
    }

    private func needsLocalImport(_ url: URL) -> Bool {
        guard let item = manifestItem(for: url) else { return false }
        return item.selected && !item.status.isLocallyTerminal
    }

    private func manifestItem(for url: URL) -> CardImportManifestItem? {
        let relative = CardImportManifestBuilder.relativePath(for: url, roots: pickedURLs)
        return manifestItems.first { $0.sourceRelativePath == relative }
    }

    private func incrementItemProgress(for url: URL, by delta: Int64) {
        let relative = CardImportManifestBuilder.relativePath(for: url, roots: pickedURLs)
        guard let index = manifestItems.firstIndex(where: { $0.sourceRelativePath == relative }) else { return }
        manifestItems[index].copiedBytes = min(
            manifestItems[index].sizeBytes,
            manifestItems[index].copiedBytes + delta
        )
    }

    private func setItemStatus(
        urls: [URL],
        status: CardImportItemStatus,
        checksum: String? = nil,
        photoAssetId: String? = nil,
        videoAssetId: String? = nil,
        audioAssetId: String? = nil,
        error: String? = nil
    ) async {
        guard let manifestStore else { return }
        for url in urls {
            let relative = CardImportManifestBuilder.relativePath(for: url, roots: pickedURLs)
            guard let index = manifestItems.firstIndex(where: { $0.sourceRelativePath == relative }) else { continue }
            manifestItems[index].status = status
            manifestItems[index].lastError = error
            if status == .copying { manifestItems[index].copiedBytes = 0 }
            if let checksum { manifestItems[index].checksumSha256 = checksum }
            if let photoAssetId { manifestItems[index].photoAssetId = photoAssetId }
            if let videoAssetId { manifestItems[index].videoAssetId = videoAssetId }
            if let audioAssetId { manifestItems[index].audioAssetId = audioAssetId }
            if status.isLocallyTerminal { manifestItems[index].copiedBytes = manifestItems[index].sizeBytes }
            try? await manifestStore.updateItem(
                id: manifestItems[index].id,
                status: status,
                copiedBytes: manifestItems[index].copiedBytes,
                checksum: checksum,
                photoAssetId: photoAssetId,
                videoAssetId: videoAssetId,
                audioAssetId: audioAssetId,
                error: error
            )
        }
    }

    private func setManifestAssetStatus(
        photoAssetId: String? = nil,
        videoAssetId: String? = nil,
        audioAssetId: String? = nil,
        status: CardImportItemStatus
    ) async {
        for index in manifestItems.indices {
            let matches = (photoAssetId != nil && manifestItems[index].photoAssetId == photoAssetId)
                || (videoAssetId != nil && manifestItems[index].videoAssetId == videoAssetId)
                || (audioAssetId != nil && manifestItems[index].audioAssetId == audioAssetId)
            if matches { manifestItems[index].status = status }
        }
        try? await manifestStore?.updateItemsForAsset(
            photoAssetId: photoAssetId,
            videoAssetId: videoAssetId,
            audioAssetId: audioAssetId,
            status: status
        )
    }

    private func beginBackgroundTask() {
        guard backgroundTaskIdentifier == .invalid else { return }
        backgroundTaskIdentifier = UIApplication.shared.beginBackgroundTask(withName: "CreatorHub card import") { [weak self] in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.statusLine = "iPadOS pauset importen i bakgrunnen · åpne CreatorHub for å fortsette"
                if let manifestRunId = self.manifestRunId {
                    try? await self.manifestStore?.updateRun(id: manifestRunId, status: .paused)
                }
                self.endBackgroundTask()
            }
        }
    }

    private func endBackgroundTask() {
        guard backgroundTaskIdentifier != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTaskIdentifier)
        backgroundTaskIdentifier = .invalid
    }

    private func persistPendingJob() async throws {
        guard let store = pendingJobStore,
              let id = pendingJobId,
              let ownerUserId,
              let startedAt = pendingSessionStartedAt
        else { return }
        try await store.save(.init(
            id: id,
            ownerUserId: ownerUserId,
            sessionName: sessionName,
            sessionStartedAt: startedAt,
            projectId: pendingProjectId,
            projectTitle: pendingProjectTitle,
            items: pendingBackupItems,
            videoAssetIds: pendingVideoAssetIds,
            audioAssetIds: pendingAudioAssetIds,
            storagePolicy: storagePolicy,
            assetCount: successfulImportCount,
            duplicateCount: duplicateCount,
            failedCount: failedImportCount,
            totalBytes: totalBytes,
            locallyVerifiedAt: locallyVerifiedAt,
            cardIdentifier: cardIdentifier,
            cardName: cardName,
            plannedCardLabel: plannedCardLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? nil
                : plannedCardLabel.trimmingCharacters(in: .whitespacesAndNewlines),
            cardCapacityBytes: cardCapacityBytes,
            cardAvailableBytes: cardAvailableBytes,
            photoCount: originalPhotoCount,
            videoCount: originalVideoCount,
            audioCount: originalAudioCount,
            unsupportedCount: unsupportedFileCount,
            cloudVerifiedAt: pendingCloudVerifiedAt,
            reportPending: reportPending
        ))
    }

    private func reportCardTransfer(
        backend: BackendClient,
        projectId: String,
        status: String,
        cloudVerifiedAt: Date? = nil
    ) async -> Bool {
        guard let transferId = pendingJobId ?? importedSessionId else { return false }
        let formatter = ISO8601DateFormatter()
        let body = BackendCardTransferRequest(
            cardIdentifier: cardIdentifier,
            cardName: cardName,
            plannedCardLabel: plannedCardLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? nil
                : plannedCardLabel.trimmingCharacters(in: .whitespacesAndNewlines),
            capacityBytes: cardCapacityBytes,
            availableBytes: cardAvailableBytes,
            photoCount: originalPhotoCount,
            videoCount: originalVideoCount,
            audioCount: originalAudioCount,
            unsupportedCount: unsupportedFileCount,
            assetCount: successfulImportCount,
            duplicateCount: duplicateCount,
            failedCount: failedImportCount,
            totalBytes: totalBytes,
            copiedBytes: cardCanBeRemoved ? totalBytes : min(copiedBytes, totalBytes),
            manifestSha256: CardImportManifestBuilder.manifestDigest(items: manifestItems),
            storagePolicy: storagePolicy.rawValue,
            status: status,
            locallyVerifiedAt: locallyVerifiedAt.map { formatter.string(from: $0) },
            cloudVerifiedAt: cloudVerifiedAt.map { formatter.string(from: $0) },
            sourceDevice: UIDevice.current.name
        )
        do {
            _ = try await backend.upsertCardTransfer(
                projectId: projectId,
                transferId: transferId,
                body: body
            )
            return true
        } catch {
            // Transfer reporting is evidence/observability, never a reason to
            // block or invalidate locally verified media.
            AppLog.sync.warning("[CardImport] card transfer report deferred: \(error.localizedDescription, privacy: .public)")
            return false
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
        clearPendingMemory(keepLocalResult: true)
    }

    private func clearPendingMemory(keepLocalResult: Bool) {
        pendingBackupItems = []
        pendingVideoAssetIds = []
        pendingAudioAssetIds = []
        pendingProjectId = nil
        pendingProjectTitle = nil
        pendingSessionStartedAt = nil
        pendingDelivery = nil
        pendingJobId = nil
        pendingJobStore = nil
        database = nil
        pendingCloudVerifiedAt = nil
        reportPending = false
        if !keepLocalResult {
            duplicateCount = 0
            failedImportCount = 0
            successfulImportCount = 0
            importedSessionId = nil
            ownerUserId = nil
        }
    }

    private static func localCompletionMessage(success: Int, failed: Int) -> String {
        failed > 0
            ? "\(success) lokalt verifisert · \(failed) kunne ikke leses · behold kortet"
            : "Alle \(success) filer er lokalt verifisert"
    }

    private static func defaultSessionName(cardName: String = "Minnekort") -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d. MMM yyyy HH:mm"
        formatter.locale = Locale(identifier: "nb_NO")
        return "\(cardName) · \(formatter.string(from: Date()))"
    }

    static func bytes(_ value: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: max(0, value))
    }
}
