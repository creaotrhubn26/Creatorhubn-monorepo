import SwiftUI
import UniformTypeIdentifiers

/// Unified memory-card ingest: photo + video → verified local copy → optional
/// CreatorHub backup. Source media is never changed or deleted.
struct CardImportView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model = CardImportModel()
    @State private var showFileImporter = false
    @State private var didAutomaticallyPresentPicker = false
    @State private var showProjectPicker = false
    @State private var cullSessionId: UUID?
    @State private var pendingCardProject: BackendProjectSummary?
    @State private var selectedProject: BackendProjectSummary?
    @State private var showCardLabelPicker = false

    /// Opening the document picker still originates from an explicit user tap,
    /// but callers can skip this screen's second tap when there is no durable
    /// import to resume. iPadOS remains responsible for granting access to the
    /// selected card or folder.
    let presentPickerOnOpen: Bool

    init(presentPickerOnOpen: Bool = false) {
        self.presentPickerOnOpen = presentPickerOnOpen
    }

    var body: some View {
        NavigationStack {
            content
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundStyle(CHTheme.textPrimary)
                .background(CHTheme.bg.ignoresSafeArea())
                .navigationTitle("Importer fra minnekort")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Lukk") { dismiss() }
                    }
                }
                .fileImporter(
                    isPresented: $showFileImporter,
                    allowedContentTypes: Self.allowedContentTypes,
                    allowsMultipleSelection: true,
                ) { result in
                    Task { await model.handlePick(result) }
                }
                .sheet(isPresented: $showProjectPicker) {
                    ProjectSelectionView { project in
                        showProjectPicker = false
                        chooseProjectCardLabel(project)
                    }
                }
                .confirmationDialog(
                    "Hvilket planlagt kort er dette?",
                    isPresented: $showCardLabelPicker,
                    titleVisibility: .visible
                ) {
                    if let project = pendingCardProject {
                        ForEach(project.memoryCardConfigs) { config in
                            Button(Self.cardConfigTitle(config)) {
                                performProjectSelection(project, cardLabel: config.label)
                            }
                        }
                        Button("Behold «\(model.plannedCardLabel)»") {
                            performProjectSelection(project, cardLabel: nil)
                        }
                        Button("Avbryt", role: .cancel) { pendingCardProject = nil }
                    }
                } message: {
                    Text("Etiketten kobler det fysiske kortet til planen fra prosjektopprettelsen.")
                }
                .navigationDestination(item: $cullSessionId) { sessionId in
                    if let owner = model.ownerUserId {
                        LiveCullView(sessionId: sessionId, ownerUserId: owner)
                    }
                }
        }
        .chBranded()
        .task {
            await model.restorePendingBackup()
            guard presentPickerOnOpen,
                  !didAutomaticallyPresentPicker,
                  model.phase == .picking
            else { return }
            didAutomaticallyPresentPicker = true
            // Let the containing sheet finish its presentation before asking
            // SwiftUI to layer iPadOS' document picker above it.
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            showFileImporter = true
        }
    }

    @ViewBuilder private var content: some View {
        switch model.phase {
        case .picking: pickingView
        case .review: reviewView
        case .importing: progressView(title: "Importerer fra kort …")
        case .backingUp: progressView(title: "Sikkerhetskopierer til skyen …")
        case .done: doneView
        case .failed(let message): failedView(message)
        }
    }

    // MARK: - Pick

    private var pickingView: some View {
        ScrollView {
            VStack(spacing: 20) {
                Image(systemName: "sdcard")
                    .font(.system(size: 64))
                    .foregroundStyle(CHTheme.accent)
                    .padding(.top, 28)
                Text("Importer foto, video og lyd")
                    .font(.title2.bold())
                Text("Koble til kortleseren og velg kortet eller DCIM-mappen. CreatorHub kopierer og verifiserer originalene lokalt før kortet kan fjernes. Skybackup kan gjøres senere.")
                    .font(.callout)
                    .foregroundStyle(CHTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                Button {
                    showFileImporter = true
                } label: {
                    Label("Velg fra minnekort", systemImage: "folder")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal, 40)

                if !model.recentReceipts.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Siste importkvitteringer")
                            .font(.headline)
                        ForEach(model.recentReceipts) { receipt in
                            compactReceiptRow(receipt)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 12)
                }
            }
        }
    }

    // MARK: - Review

    private var reviewView: some View {
        ScrollView {
          VStack(alignment: .leading, spacing: 16) {
            Text("Klar til import")
                .font(.title2.bold())
            if !model.statusLine.isEmpty {
                Text(model.statusLine)
                    .font(.caption)
                    .foregroundStyle(CHTheme.textSecondary)
            }

            VStack(spacing: 0) {
                statRow("Kortnavn", model.cardName)
                if let capacity = model.cardCapacityBytes {
                    Divider()
                    statRow("Kapasitet", Self.bytes(capacity))
                }
                if let available = model.cardAvailableBytes {
                    Divider()
                    statRow("Ledig på kortet", Self.bytes(available))
                }
                Divider()
                statRow("Bilder/serier", "\(model.groups.count)")
                Divider()
                statRow("Videoklipp", "\(model.videoCount)")
                Divider()
                statRow("Lydopptak", "\(model.audioCount)")
                Divider()
                statRow("Med RAW", "\(model.rawCount)")
                Divider()
                statRow("Med JPEG", "\(model.jpegCount)")
                Divider()
                statRow("Total størrelse", Self.bytes(model.totalBytes))
                if model.unsupportedFileCount > 0 {
                    Divider()
                    statRow("Andre filer ignoreres", "\(model.unsupportedFileCount)")
                }
                if model.sidecarFileCount > 0 {
                    Divider()
                    statRow("Sidecar-filer ekskludert", "\(model.sidecarFileCount)")
                }
                if model.proxyFileCount > 0 {
                    Divider()
                    statRow("Proxy-filer funnet", "\(model.proxyFileCount)")
                }
            }

            preflightCard
            mediaSelectionPanel
            importProfilePanel

            VStack(alignment: .leading, spacing: 8) {
                Text("Lagring etter import")
                    .font(.caption)
                    .foregroundStyle(CHTheme.textMuted)
                Picker("Lagring", selection: $model.storagePolicy) {
                    ForEach(Asset.StoragePolicy.allCases, id: \.self) { policy in
                        Text(policy.displayName).tag(policy)
                    }
                }
                .pickerStyle(.segmented)
                Text(model.storagePolicy.detail)
                    .font(.caption)
                    .foregroundStyle(CHTheme.textSecondary)
            }
            .background(CHTheme.surface)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(CHTheme.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 6) {
                Text("Kortetikett i prosjektet")
                    .font(.caption)
                    .foregroundStyle(CHTheme.textMuted)
                TextField("For eksempel A, Kamera A eller Dag 1", text: $model.plannedCardLabel)
                    .textFieldStyle(.roundedBorder)
                Text("Bruk samme etikett som i prosjektopprettelsen. Den vises i oversikten over overførte kort.")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)

                Text("Navn på økt")
                    .font(.caption)
                    .foregroundStyle(CHTheme.textMuted)
                TextField("Økt-navn", text: $model.sessionName)
                    .textFieldStyle(.roundedBorder)
            }

            Text("Duplikater (samme fil importert før) hoppes automatisk over.")
                .font(.caption)
                .foregroundStyle(CHTheme.textMuted)

            Spacer()

            if model.storagePolicy == .localOnly {
                Button {
                    Task { await model.runImport(project: nil) }
                } label: {
                    Label("Importer og verifiser på iPad", systemImage: "internaldrive")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!model.manifestReady || model.selectedFileCount == 0 || !model.hasEnoughDeviceSpace)
            } else {
                if let selectedProject {
                    Button {
                        Task { await model.runImport(project: selectedProject) }
                    } label: {
                        Label("Importer til \(selectedProject.title)", systemImage: "arrow.up.to.line")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!model.manifestReady || model.selectedFileCount == 0 || !model.hasEnoughDeviceSpace)
                    Button("Bytt prosjekt") { showProjectPicker = true }
                        .buttonStyle(.bordered)
                } else {
                    Button {
                        showProjectPicker = true
                    } label: {
                        Label("Velg prosjekt", systemImage: "folder.badge.plus")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!model.manifestReady || model.selectedFileCount == 0 || !model.hasEnoughDeviceSpace)
                }

                Button {
                    Task { await model.runImport(project: nil) }
                } label: {
                    Label("Importer lokalt · koble prosjekt senere", systemImage: "externaldrive.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(!model.manifestReady || model.selectedFileCount == 0 || !model.hasEnoughDeviceSpace)
            }
          }
        }
    }

    // MARK: - Progress

    private func progressView(title: String) -> some View {
        VStack(spacing: 20) {
            Spacer()
            ProgressView(value: model.fractionComplete)
                .progressViewStyle(.linear)
                .padding(.horizontal)
            Text(title).font(.headline)
            if model.progressTotal > 0 {
                let detail = model.phase == .importing
                    ? "\(Self.bytes(model.copiedBytes)) av \(Self.bytes(model.totalBytes))"
                    : "\(model.progressDone) av \(model.progressTotal)"
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(CHTheme.textSecondary)
                if model.phase == .importing,
                   let speed = model.transferSpeedBytesPerSecond {
                    Text("\(Self.bytes(Int64(speed)))/s\(model.estimatedSecondsRemaining.map { " · ca. \(Self.duration($0)) igjen" } ?? "")")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(CHTheme.textMuted)
                }
            }
            if model.cardCanBeRemoved {
                safeToRemoveBanner
            } else if model.failedImportCount > 0 {
                keepCardBanner
            }
            if !model.statusLine.isEmpty {
                Text(model.statusLine)
                    .font(.caption)
                    .foregroundStyle(CHTheme.textMuted)
                    .lineLimit(1)
            }
            progressFileList
            Spacer()
        }
    }

    // MARK: - Done

    private var doneView: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64))
                .foregroundStyle(CHTheme.success)
            Text(model.hasPendingCloudBackup ? "Trygt lagret på iPaden" : completionTitle)
                .font(.title2.bold())
            VStack(spacing: 4) {
                Text(model.statusLine)
                if model.duplicateCount > 0 {
                    Text("\(model.duplicateCount) hoppet over (allerede inne).")
                        .foregroundStyle(CHTheme.textSecondary)
                }
                if model.failedImportCount > 0 {
                    Text("\(model.failedImportCount) kunne ikke leses fra kortet.")
                        .foregroundStyle(CHTheme.warning)
                }
            }
            .font(.callout)
            .multilineTextAlignment(.center)

            if model.cardCanBeRemoved {
                safeToRemoveBanner
            } else if model.failedImportCount > 0 {
                keepCardBanner
            }

            if let receipt = model.receipt {
                receiptCard(receipt)
            }

            Spacer()

            if model.canRetryProjectReport {
                Button {
                    Task { await model.retryProjectReport() }
                } label: {
                    Label("Bekreft i prosjektoversikten", systemImage: "checkmark.icloud")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
            } else if model.requiresProjectBinding {
                Button {
                    showProjectPicker = true
                } label: {
                    Label("Velg prosjekt og sikre i CreatorHub", systemImage: "icloud.and.arrow.up")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
            } else if model.canRetryBackup {
                Button("Fortsett backup") {
                    Task { await model.retryBackup() }
                }
                .buttonStyle(.borderedProminent)
            }

            if model.canResumeCard {
                Button {
                    showFileImporter = true
                } label: {
                    Label("Sett inn samme kort og fortsett", systemImage: "sdcard")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }

            if model.importedSessionId != nil, model.photoCount > 0 {
                Button {
                    cullSessionId = model.importedSessionId
                } label: {
                    Label("Start cull", systemImage: "checkmark.circle")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
            }
            Text("Bilder ligger i Cull/Redigering. Videoklipp ligger i Video som importerte takes. Ekstern produksjonslyd bevares separat og kobles til takes med timecode eller senere waveform-synk.")
                .font(.caption)
                .foregroundStyle(CHTheme.textMuted)
            Button("Ferdig") { dismiss() }
                .padding(.top, 4)
        }
    }

    // MARK: - Failed

    private func failedView(_ message: String) -> some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 56))
                .foregroundStyle(CHTheme.warning)
            Text("Noe gikk galt")
                .font(.title3.bold())
            Text(message)
                .font(.callout)
                .foregroundStyle(CHTheme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            if model.cardCanBeRemoved {
                safeToRemoveBanner
            } else if model.failedImportCount > 0 {
                keepCardBanner
            }
            Spacer()
            if model.canRetryProjectReport {
                Button("Bekreft i prosjektoversikten") {
                    Task { await model.retryProjectReport() }
                }
                .buttonStyle(.borderedProminent)
            } else if model.requiresProjectBinding {
                Button("Velg prosjekt og fortsett") { showProjectPicker = true }
                    .buttonStyle(.borderedProminent)
            } else if model.canRetryBackup {
                Button("Fortsett backup") {
                    Task { await model.retryBackup() }
                }
                .buttonStyle(.borderedProminent)
                Button("Start importen på nytt") { model.reset() }
            } else if model.canResumeCard {
                Button("Velg samme kort og fortsett") { showFileImporter = true }
                    .buttonStyle(.borderedProminent)
            } else {
                Button("Prøv igjen") { model.reset() }
                    .buttonStyle(.borderedProminent)
            }
            Button("Lukk") { dismiss() }
                .padding(.top, 4)
        }
    }

    // MARK: - Helpers

    private var completionTitle: String {
        switch model.storagePolicy {
        case .localOnly: "Lokalt verifisert"
        case .keepLocalAndCloud: "Sikret på iPad og i CreatorHub"
        case .creatorHubOnly: "Sikret i CreatorHub"
        }
    }

    private var safeToRemoveBanner: some View {
        Label("Alle valgte medier er verifisert lokalt · kortet kan trygt fjernes", systemImage: "checkmark.shield.fill")
            .font(.caption.weight(.semibold))
            .foregroundStyle(CHTheme.success)
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(CHTheme.success.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
            .accessibilityIdentifier("card-import-safe-to-remove")
    }

    private var keepCardBanner: some View {
        Label("Behold kortet til filene som ikke kunne leses er kontrollert", systemImage: "exclamationmark.triangle.fill")
            .font(.caption.weight(.semibold))
            .foregroundStyle(CHTheme.warning)
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(CHTheme.warning.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
            .accessibilityIdentifier("card-import-keep-card")
    }

    private var preflightCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Forhåndskontroll", systemImage: "checklist")
                .font(.headline)
                .accessibilityIdentifier("card-import-preflight")
            statRow("Valgt", "\(model.selectedFileCount) filer · \(Self.bytes(model.selectedTotalBytes))")
            if !model.selectedFormatSummary.isEmpty {
                statRow("Formater", model.selectedFormatSummary)
            }
            if model.selectedFolderCount > 0 {
                statRow("Kildemapper", "\(model.selectedFolderCount)")
            }
            if let range = model.selectedRecordedRange {
                statRow("Opptaksperiode", range)
            }
            if let largest = model.largestSelectedFile {
                statRow("Største fil", "\(largest.filename) · \(Self.bytes(largest.sizeBytes))")
            }
            statRow("Behov inkl. reserve", Self.bytes(model.requiredDeviceBytes))
            if let available = model.deviceAvailableBytes {
                statRow("Ledig på iPaden", Self.bytes(available))
            }
            statRow("Anslått lokal kopiering", Self.duration(model.estimatedCopySeconds))
            if model.storagePolicy != .localOnly {
                statRow("Nettverk", model.networkTransport.title)
                if let estimate = model.estimatedUploadSeconds {
                    statRow("Anslått CreatorHub-opplasting", Self.duration(estimate))
                } else {
                    statRow("Anslått CreatorHub-opplasting", "Venter på nett")
                }
                Text(model.policyReadinessMessage)
                    .font(.caption2)
                    .foregroundStyle(model.networkTransport == .offline ? CHTheme.warning : CHTheme.textMuted)
            }
            if !model.hasEnoughDeviceSpace {
                Label("Ikke nok plass til valgt innhold og sikkerhetsmargin.", systemImage: "externaldrive.badge.exclamationmark")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(CHTheme.danger)
            }
            if model.hasLowBatteryWarning {
                Label("Lavt batteri · koble iPaden til strøm før store overføringer.", systemImage: "battery.25percent")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(CHTheme.warning)
            }
        }
        .padding(14)
        .background(CHTheme.surface)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(CHTheme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var mediaSelectionPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Filer").font(.headline)
                Spacer()
                Button("Velg viste") { model.selectAllVisible(true) }
                    .font(.caption.weight(.semibold))
                Button("Fjern viste") { model.selectAllVisible(false) }
                    .font(.caption.weight(.semibold))
            }
            TextField("Søk etter filnavn", text: $model.searchText)
                .textFieldStyle(.roundedBorder)
            HStack {
                Picker("Type", selection: $model.mediaFilter) {
                    ForEach(CardImportModel.MediaFilter.allCases) { filter in
                        Text(filter.title).tag(filter)
                    }
                }
                .pickerStyle(.menu)
                Spacer()
                Picker("Sorter", selection: $model.itemSort) {
                    ForEach(CardImportModel.ItemSort.allCases) { sort in
                        Text(sort.title).tag(sort)
                    }
                }
                .pickerStyle(.menu)
            }
            if !model.availableFolders.isEmpty {
                Picker("Mappe", selection: $model.folderFilter) {
                    Text("Alle mapper").tag("")
                    ForEach(model.availableFolders, id: \.self) { folder in
                        Text(folder).tag(folder)
                    }
                }
                .pickerStyle(.menu)
            }
            if model.availableRecordedDays.count > 1 {
                Picker("Opptaksdag", selection: $model.recordedDayFilter) {
                    Text("Alle opptaksdager").tag("")
                    ForEach(model.availableRecordedDays, id: \.key) { day in
                        Text(day.title).tag(day.key)
                    }
                }
                .pickerStyle(.menu)
            }
            if model.proxyFileCount > 0 {
                Toggle("Ta med proxyfiler", isOn: Binding(
                    get: { model.includeProxyMedia },
                    set: { model.setIncludeProxyMedia($0) }
                ))
                .font(.caption)
            }
            if model.unreadableCount > 0 || model.limitedMetadataCount > 0 || model.missingProxyCount > 0 || model.duplicateCandidateCount > 0 {
                Text("\(model.unreadableCount) uleselige · \(model.limitedMetadataCount) med begrenset metadata · \(model.missingProxyCount) uten proxy · \(model.duplicateCandidateCount) mulige duplikater")
                    .font(.caption2)
                    .foregroundStyle(model.unreadableCount > 0 ? CHTheme.danger : CHTheme.textMuted)
            }
            LazyVStack(spacing: 0) {
                ForEach(model.visibleManifestItems) { item in
                    Button { model.toggleItem(item.id) } label: {
                        manifestItemRow(item, showProgress: false)
                    }
                    .buttonStyle(.plain)
                    .disabled(![.waiting, .skipped, .failed].contains(item.status))
                    if item.id != model.visibleManifestItems.last?.id {
                        Divider().overlay(CHTheme.border)
                    }
                }
            }
            .background(CHTheme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private var importProfilePanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Importprofiler", systemImage: "slider.horizontal.3")
                .font(.headline)
            Text("Lagre filtyper, mapper, proxyvalg og lagringspolicy for samme korttype eller prosjekt.")
                .font(.caption2)
                .foregroundStyle(CHTheme.textMuted)

            if !model.profiles.isEmpty {
                ForEach(model.profiles) { profile in
                    Button {
                        model.applyProfile(profile.id)
                    } label: {
                        HStack {
                            Image(systemName: model.selectedProfileId == profile.id ? "checkmark.circle.fill" : "circle")
                            VStack(alignment: .leading, spacing: 2) {
                                Text(profile.name).font(.subheadline.weight(.semibold))
                                Text("\(profile.scope.title) · \(profile.storagePolicy.displayName)")
                                    .font(.caption2)
                                    .foregroundStyle(CHTheme.textMuted)
                            }
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
                if model.selectedProfileId != nil {
                    Button("Slett valgt profil", role: .destructive) {
                        Task { await model.deleteSelectedProfile() }
                    }
                    .font(.caption)
                }
                Divider().overlay(CHTheme.border)
            }

            TextField("Profilnavn", text: $model.profileName)
                .textFieldStyle(.roundedBorder)
            Picker("Lagre for", selection: $model.profileScope) {
                ForEach(CardImportProfileScope.allCases) { scope in
                    Text(scope.title).tag(scope)
                }
            }
            .pickerStyle(.segmented)
            if model.profileScope == .project && model.selectedProjectTitle == nil {
                Text("Velg prosjekt før en prosjektprofil kan lagres.")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.warning)
            }
            Button("Lagre gjeldende importvalg") {
                Task { await model.saveCurrentProfile() }
            }
            .buttonStyle(.bordered)
            .disabled(model.profileName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                      || (model.profileScope == .project && model.selectedProjectTitle == nil))
        }
        .padding(14)
        .background(CHTheme.surface)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(CHTheme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var progressFileList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(model.manifestItems.filter(\.selected)) { item in
                    manifestItemRow(item, showProgress: true)
                    Divider().overlay(CHTheme.border)
                }
            }
        }
        .frame(maxHeight: 280)
        .background(CHTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    private func manifestItemRow(_ item: CardImportManifestItem, showProgress: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: item.selected ? statusIcon(item.status) : "circle")
                .foregroundStyle(item.selected ? statusColor(item.status) : CHTheme.textMuted)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.filename)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(CHTheme.textPrimary)
                    .lineLimit(1)
                Text("\(item.mediaKind.title) · \(item.fileExtension.uppercased()) · \(Self.bytes(item.sizeBytes)) · \(item.recordedAt.formatted(.dateTime.day().month().hour().minute()))")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)
                if !item.inspection.technicalSummary.isEmpty {
                    Text(item.inspection.technicalSummary)
                        .font(.caption2)
                        .foregroundStyle(CHTheme.textSecondary)
                        .lineLimit(1)
                }
                let inspectionFlags = [
                    item.inspection.state == .ready ? nil : item.inspection.state.title,
                    item.inspection.proxyState.title,
                    item.inspection.sidecarCount > 0 ? "\(item.inspection.sidecarCount) sidecar" : nil,
                    item.inspection.duplicateCandidate == true ? "Mulig duplikat · checksum avgjør" : nil
                ].compactMap { $0 }
                if !inspectionFlags.isEmpty {
                    Text(inspectionFlags.joined(separator: " · "))
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(item.inspection.state == .unreadable ? CHTheme.danger : CHTheme.warning)
                }
                if let issue = item.inspection.issue {
                    Text(issue).font(.caption2).foregroundStyle(CHTheme.warning).lineLimit(2)
                }
                if showProgress && item.status == .copying {
                    ProgressView(value: item.progress)
                        .progressViewStyle(.linear)
                }
                if let error = item.lastError, item.status == .failed {
                    Text(error).font(.caption2).foregroundStyle(CHTheme.danger).lineLimit(2)
                }
            }
            Spacer()
            Text(statusTitle(item.status))
                .font(.caption2.weight(.semibold))
                .foregroundStyle(statusColor(item.status))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .contentShape(Rectangle())
        .accessibilityIdentifier("card-import-file-\(item.id)")
    }

    private func receiptCard(_ receipt: CardImportReceipt) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Importkvittering", systemImage: "checkmark.seal.fill")
                .font(.headline)
                .foregroundStyle(CHTheme.success)
            statRow("Kvittering", String(receipt.id.uuidString.prefix(8)).uppercased())
            statRow("Kort", receipt.cardName)
            if let project = receipt.projectTitle { statRow("Prosjekt", project) }
            statRow("Filer", "\(receipt.totalFiles)")
            statRow("Størrelse", Self.bytes(receipt.totalBytes))
            if let locally = receipt.locallyVerifiedAt {
                statRow("Lokalt verifisert", locally.formatted(.dateTime.day().month().hour().minute()))
            }
            if let cloud = receipt.cloudVerifiedAt {
                statRow("CreatorHub verifisert", cloud.formatted(.dateTime.day().month().hour().minute()))
            }
            if let digest = receipt.manifestSha256 {
                statRow("Manifest SHA-256", "\(digest.prefix(12))…")
            }
            if receipt.duplicateFiles > 0 { statRow("Duplikater", "\(receipt.duplicateFiles)") }
            if receipt.failedFiles > 0 { statRow("Mangler / feilet", "\(receipt.failedFiles)") }
        }
        .padding(14)
        .background(CHTheme.success.opacity(0.08))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(CHTheme.success.opacity(0.35), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func compactReceiptRow(_ receipt: CardImportReceipt) -> some View {
        HStack(spacing: 10) {
            Image(systemName: receipt.cloudVerifiedAt == nil ? "internaldrive.fill" : "checkmark.icloud.fill")
                .foregroundStyle(CHTheme.success)
            VStack(alignment: .leading, spacing: 2) {
                Text(receipt.projectTitle ?? receipt.cardName)
                    .font(.subheadline.weight(.semibold))
                Text("\(receipt.totalFiles) filer · \(Self.bytes(receipt.totalBytes)) · \((receipt.completedAt ?? receipt.locallyVerifiedAt)?.formatted(.dateTime.day().month().hour().minute()) ?? "verifisert")")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)
            }
            Spacer()
            Text(receipt.cloudVerifiedAt == nil ? "iPad" : "CreatorHub")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(CHTheme.success)
        }
        .padding(12)
        .background(CHTheme.surface)
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(CHTheme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func statusTitle(_ status: CardImportItemStatus) -> String {
        switch status {
        case .waiting: "Venter"
        case .copying: "Kopierer"
        case .localVerified: "Verifisert"
        case .duplicate: "Allerede inne"
        case .uploading: "Laster opp"
        case .cloudVerified: "Sikret"
        case .failed: "Feilet"
        case .skipped: "Ikke valgt"
        }
    }

    private func statusIcon(_ status: CardImportItemStatus) -> String {
        switch status {
        case .waiting: "checkmark.circle"
        case .copying, .uploading: "arrow.triangle.2.circlepath"
        case .localVerified: "internaldrive.fill"
        case .duplicate: "equal.circle.fill"
        case .cloudVerified: "checkmark.icloud.fill"
        case .failed: "exclamationmark.triangle.fill"
        case .skipped: "circle"
        }
    }

    private func statusColor(_ status: CardImportItemStatus) -> Color {
        switch status {
        case .localVerified, .cloudVerified: CHTheme.success
        case .failed: CHTheme.danger
        case .duplicate: CHTheme.info
        case .copying, .uploading: CHTheme.accent
        case .waiting, .skipped: CHTheme.textMuted
        }
    }

    private func statRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(CHTheme.textSecondary)
            Spacer()
            Text(value).fontWeight(.semibold)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }

    private static func bytes(_ count: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: count, countStyle: .file)
    }

    private static func duration(_ seconds: TimeInterval) -> String {
        let rounded = max(0, Int(seconds.rounded()))
        if rounded < 60 { return "\(rounded) sek" }
        return "\(rounded / 60) min \(rounded % 60) sek"
    }

    private func chooseProjectCardLabel(_ project: BackendProjectSummary) {
        let configs = project.memoryCardConfigs.filter {
            !$0.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        if configs.count > 1 {
            pendingCardProject = project
            Task { @MainActor in
                await Task.yield()
                showCardLabelPicker = true
            }
        } else {
            performProjectSelection(project, cardLabel: configs.first?.label)
        }
    }

    private func performProjectSelection(_ project: BackendProjectSummary, cardLabel: String?) {
        pendingCardProject = nil
        selectedProject = project
        model.applyPlannedCardLabel(cardLabel)
        Task {
            if model.hasPendingCloudBackup {
                await model.bindProjectAndRetry(project)
            } else {
                await model.prepareProject(project)
            }
        }
    }

    private static func cardConfigTitle(_ config: BackendMemoryCardConfig) -> String {
        let details = [config.dayName, config.type, config.capacity]
            .compactMap { value -> String? in
                guard let value, !value.isEmpty else { return nil }
                return value
            }
            .joined(separator: " · ")
        return details.isEmpty ? config.label : "\(config.label) · \(details)"
    }

    private static let allowedContentTypes: [UTType] = {
        var types: [UTType] = [.folder, .image, .rawImage, .movie, .audio]
        let extensions = CardImportService.rawExtensions
            .union(CardImportService.videoExtensions)
            .union(CardImportService.audioExtensions)
        for ext in extensions {
            if let type = UTType(filenameExtension: ext), !types.contains(type) {
                types.append(type)
            }
        }
        return types
    }()
}
