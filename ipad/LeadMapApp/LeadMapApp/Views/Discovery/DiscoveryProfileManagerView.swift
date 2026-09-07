import SwiftUI

private enum DiscoveryProfileEditorMode: String, Identifiable {
    case create
    case edit

    var id: String { rawValue }
}

struct DiscoveryProfileManagerView: View {
    @Bindable var coordinator: DiscoveryRunCoordinator

    @State private var editorMode: DiscoveryProfileEditorMode?
    @State private var editorName = ""
    @State private var editorIsDefault = false
    @State private var pendingSelection: DiscoveryV2Profile?
    @State private var pendingDeletion: DiscoveryV2Profile?
    @State private var showingRegionPreset = false
    @State private var showingCampaignStartConfirmation = false
    @State private var pendingCampaignCancellation: DiscoveryV2CampaignRun?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header

            if coordinator.profiles.isEmpty {
                ContentUnavailableView(
                    "Ingen lagrede profiler",
                    systemImage: "rectangle.stack.badge.plus",
                    description: Text("Lagre egne profiler for hvert marked eller territorium i dette kundeprosjektet."))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(coordinator.profiles) { profile in
                            profileCard(profile)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            HStack(spacing: 10) {
                Button {
                    prepareEditor(.create)
                } label: {
                    Label("Ny profil", systemImage: "plus")
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("discovery.profile.new")

                if coordinator.selectedProfile != nil {
                    Button {
                        Task { await coordinator.updateSelectedProfile() }
                    } label: {
                        Label(
                            coordinator.hasUnsavedProfileChanges ? "Lagre endringer" : "Profil lagret",
                            systemImage: coordinator.hasUnsavedProfileChanges ? "square.and.arrow.down" : "checkmark.circle")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(LeadgridDiscoveryTheme.accent)
                    .disabled(!coordinator.hasUnsavedProfileChanges || coordinator.isBusy)
                    .accessibilityIdentifier("discovery.profile.update")
                } else {
                    Button {
                        prepareEditor(.create)
                    } label: {
                        Label("Lagre utkast som profil", systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(LeadgridDiscoveryTheme.accent)
                    .disabled(coordinator.brief.validationMessage != nil || coordinator.isBusy)
                    .accessibilityIdentifier("discovery.profile.save-draft")
                }
            }

            Button {
                showingRegionPreset = true
            } label: {
                Label("Oslo og omegn – opprett 4 profiler", systemImage: "square.grid.2x2")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.bordered)
            .disabled(coordinator.isBusy)
            .accessibilityIdentifier("discovery.profile.preset.oslo-region")

            Divider()
                .overlay(LeadgridDiscoveryTheme.stroke)

            campaignSection
        }
        .discoverySurface()
        .sheet(item: $editorMode) { mode in
            DiscoveryProfileEditorSheet(
                mode: mode,
                name: editorName,
                isDefault: editorIsDefault,
                onSave: { name, isDefault in
                    if mode == .create {
                        Task { await coordinator.createProfile(named: name, isDefault: isDefault) }
                    } else {
                        Task { await coordinator.updateSelectedProfile(named: name, isDefault: isDefault) }
                    }
                })
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $showingRegionPreset) {
            DiscoveryProfilePresetConfirmationSheet(
                preset: .osloRegionClinicPilot,
                baseBrief: coordinator.brief,
                existingProfiles: coordinator.profiles,
                projectName: coordinator.projectName ?? coordinator.projectId ?? "Ukjent kundeprosjekt",
                onConfirm: { idempotencyKey in
                    await coordinator.createProfilePreset(
                        .osloRegionClinicPilot,
                        copying: coordinator.brief,
                        idempotencyKey: idempotencyKey)
                })
            .presentationDetents([.large])
        }
        .confirmationDialog(
            "Ulagrede endringer",
            isPresented: Binding(
                get: { pendingSelection != nil },
                set: { if !$0 { pendingSelection = nil } })) {
                    Button("Forkast og bytt profil", role: .destructive) {
                        if let profile = pendingSelection { coordinator.selectProfile(profile) }
                        pendingSelection = nil
                    }
                    Button("Behold utkast", role: .cancel) { pendingSelection = nil }
                } message: {
                    Text("Lagre profilen først dersom du vil beholde endringene.")
                }
        .confirmationDialog(
            "Slett Discovery-profil?",
            isPresented: Binding(
                get: { pendingDeletion != nil },
                set: { if !$0 { pendingDeletion = nil } })) {
                    Button("Slett profil", role: .destructive) {
                        guard let profile = pendingDeletion else { return }
                        pendingDeletion = nil
                        Task { await coordinator.deleteProfile(profile) }
                    }
                    Button("Avbryt", role: .cancel) { pendingDeletion = nil }
                } message: {
                    Text("Kjøringer og leads beholdes. Bare den lagrede søkeprofilen arkiveres.")
                }
        .confirmationDialog(
            "Start prioritert kampanje?",
            isPresented: $showingCampaignStartConfirmation,
            titleVisibility: .visible
        ) {
            Button("Start Oslo → Vest → Øst/nord → Sør") {
                let profiles = campaignProfiles
                Task {
                    await coordinator.startCampaign(
                        name: campaignName,
                        profiles: profiles)
                }
            }
            Button("Avbryt", role: .cancel) {}
        } message: {
            Text("Profilene kjøres én om gangen på serveren. Kampanjen fortsetter selv om du lukker appen.")
        }
        .confirmationDialog(
            "Avbryt hele kampanjen?",
            isPresented: Binding(
                get: { pendingCampaignCancellation != nil },
                set: { if !$0 { pendingCampaignCancellation = nil } }),
            titleVisibility: .visible
        ) {
            Button("Avbryt kampanje", role: .destructive) {
                guard let campaign = pendingCampaignCancellation else { return }
                pendingCampaignCancellation = nil
                Task { await coordinator.cancelCampaign(campaign) }
            }
            Button("Behold kampanjen", role: .cancel) {
                pendingCampaignCancellation = nil
            }
        } message: {
            Text("Pågående profilkjøring stoppes først, og resten av profilene startes ikke.")
        }
        .task { await coordinator.refreshCampaigns() }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Discovery-profiler")
                    .font(.headline)
                Text("Én kunde kan ha flere tydelige markeder, for eksempel Oslo kjerne, Vest og Sør.")
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
            Spacer()
            Text("\(coordinator.profiles.count)")
                .font(.caption.bold().monospacedDigit())
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(LeadgridDiscoveryTheme.accent.opacity(0.18), in: Capsule())
                .accessibilityLabel("\(coordinator.profiles.count) profiler")
        }
    }

    private var campaignProfiles: [DiscoveryV2Profile] {
        coordinator.orderedProfiles(
            for: .osloRegionClinicPilot,
            copying: coordinator.brief)
    }

    private var campaignConflictNames: [String] {
        DiscoveryV2ProfilePreset.osloRegionClinicPilot
            .drafts(copying: coordinator.brief)
            .filter {
                DiscoveryRunCoordinator.conflictingProfile(
                    for: $0,
                    in: coordinator.profiles) != nil
            }
            .map(\.name)
    }

    private var campaignPausedNames: [String] {
        campaignPausedProfiles.map(\.name)
    }

    private var campaignPausedProfiles: [DiscoveryV2Profile] {
        DiscoveryV2ProfilePreset.osloRegionClinicPilot
            .drafts(copying: coordinator.brief)
            .compactMap {
                DiscoveryRunCoordinator.pausedMatchingProfile(
                    for: $0,
                    in: coordinator.profiles)
            }
    }

    private var campaignName: String {
        "\(coordinator.projectName ?? "Kundeprosjekt") – klinikkpilot Oslo og omegn"
    }

    private var historicalCampaigns: [DiscoveryV2CampaignRun] {
        coordinator.campaigns.filter { $0.id != coordinator.activeCampaign?.id }
    }

    @ViewBuilder
    private var campaignSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Kampanjekjøring")
                        .font(.headline)
                    Text("Kjør Oslo → Vest → Øst/nord → Sør som én prosjektavgrenset serverjobb.")
                        .font(.caption)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
                Spacer()
                if coordinator.isCampaignBusy {
                    ProgressView()
                        .controlSize(.small)
                }
            }

            Label(
                "Kampanjen fortsetter selv om appen lukkes. Bare én profil kjører om gangen.",
                systemImage: "server.rack")
                .font(.caption)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)

            if campaignProfiles.count == 4 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(campaignProfiles.indices, id: \.self) { index in
                            let profile = campaignProfiles[index]
                            Text("\(index + 1). \(profile.brief.territoryCode ?? profile.name)")
                                .font(.caption2.bold())
                                .padding(.horizontal, 7)
                                .padding(.vertical, 7)
                                .background(LeadgridDiscoveryTheme.accent.opacity(0.13), in: Capsule())
                        }
                    }
                    .padding(.vertical, 1)
                }
                .accessibilityElement(children: .combine)
            } else if !campaignConflictNames.isEmpty {
                Label(
                    "Konflikt i territorium: \(campaignConflictNames.joined(separator: ", ")). Profilen har en annen kundetype, ICP eller andre filtre og må oppdateres eller arkiveres først.",
                    systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.warning)
                    .fixedSize(horizontal: false, vertical: true)
            } else if !campaignPausedNames.isEmpty {
                VStack(alignment: .leading, spacing: 7) {
                    Label(
                        "Pauset profil: \(campaignPausedNames.joined(separator: ", ")). Aktiver før kampanjen startes.",
                        systemImage: "pause.circle.fill")
                        .font(.caption)
                        .foregroundStyle(LeadgridDiscoveryTheme.warning)
                        .fixedSize(horizontal: false, vertical: true)
                    ForEach(campaignPausedProfiles) { profile in
                        Button {
                            Task { await coordinator.activateProfile(profile) }
                        } label: {
                            Label("Aktiver \(profile.name)", systemImage: "play.circle")
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .disabled(coordinator.isBusy)
                    }
                }
            } else {
                Label(
                    "Opprett eller fullfør de fire territoriumprofilene før kampanjen kan startes.",
                    systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.warning)
            }

            Button {
                showingCampaignStartConfirmation = true
            } label: {
                Label("Start prioritert kampanje", systemImage: "play.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(LeadgridDiscoveryTheme.accent)
            .disabled(
                campaignProfiles.count != 4
                    || coordinator.activeCampaign != nil
                    || coordinator.isCampaignBusy)
            .accessibilityIdentifier("discovery.campaign.start")

            Text("Kundetype, næringskode/søk, ICP, kommuner og filtre fryses i hver profils kampanjesnapshot. Profilendringer gjelder neste kampanje.")
                .font(.caption2)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)

            if let active = coordinator.activeCampaign {
                campaignCard(active, expanded: true)
            }

            if !historicalCampaigns.isEmpty {
                DisclosureGroup("Kampanjehistorikk (\(historicalCampaigns.count))") {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(historicalCampaigns) { campaign in
                            campaignCard(campaign, expanded: false)
                        }
                    }
                    .padding(.top, 8)
                }
                .font(.subheadline.bold())
                .tint(LeadgridDiscoveryTheme.accentSoft)
            }
        }
    }

    private func campaignCard(
        _ campaign: DiscoveryV2CampaignRun,
        expanded: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(campaign.name)
                        .font(.subheadline.bold())
                        .lineLimit(2)
                    Text("\(campaign.finishedProfileCount) av \(campaign.totalProfiles) profiler · \(campaign.candidateCount) kandidater · \(campaign.reviewReadyCount) klare")
                        .font(.caption)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
                Spacer()
                Text(campaign.status.title.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(campaignStatusColor(campaign.status))
            }

            ProgressView(value: campaign.progress)
                .tint(campaignStatusColor(campaign.status))

            if let current = campaign.currentItem, campaign.status.isActive {
                Label(
                    "Nå: \(current.profileName) – \(current.status.title.lowercased())",
                    systemImage: "scope")
                    .font(.caption.bold())
                    .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
            }

            if campaign.status == .failed && campaign.linkedRunIsActive {
                Label(
                    "Stopper den forrige profilkjøringen før kampanjen kan prøves igjen.",
                    systemImage: "hourglass")
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.warning)
                    .fixedSize(horizontal: false, vertical: true)
            }

            ForEach(campaign.items) { item in
                campaignItemRow(
                    campaign: campaign,
                    item: item,
                    showAttempts: expanded || !campaign.status.isActive)
            }

            HStack(spacing: 10) {
                if campaign.status.isActive {
                    Button(role: .destructive) {
                        pendingCampaignCancellation = campaign
                    } label: {
                        Label("Avbryt kampanje", systemImage: "stop.circle")
                    }
                    .buttonStyle(.bordered)
                    .disabled(coordinator.isCampaignBusy)
                } else if campaign.status == .failed && !campaign.linkedRunIsActive {
                    Button {
                        Task { await coordinator.retryCampaign(campaign) }
                    } label: {
                        Label("Prøv profilen igjen", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.bordered)
                    .disabled(coordinator.isCampaignBusy)
                }
            }

            if let message = campaign.errorMessage, !message.isEmpty {
                Label(message, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.warning)
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LeadgridDiscoveryTheme.stroke))
        .accessibilityIdentifier("discovery.campaign.\(campaign.id)")
    }

    private func campaignItemRow(
        campaign: DiscoveryV2CampaignRun,
        item: DiscoveryV2CampaignItem,
        showAttempts: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(item.position + 1)")
                    .font(.caption2.bold().monospacedDigit())
                    .frame(width: 22, height: 22)
                    .background(LeadgridDiscoveryTheme.accent.opacity(0.18), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.profileName)
                        .font(.caption.bold())
                    Text("\(item.candidateCount) kandidater · \(item.reviewReadyCount) klare for vurdering")
                        .font(.caption2)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
                Spacer()
                Text(item.status.title)
                    .font(.caption2.bold())
                    .foregroundStyle(campaignItemStatusColor(item.status))
            }

            let snapshot = item.briefSnapshot.normalized
            Text("Snapshot: \(snapshot.industryQueries.joined(separator: ", ")) · ICP: \(snapshot.idealCustomer ?? "ikke beskrevet")")
                .font(.caption2)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                .lineLimit(3)

            if let runId = item.currentRunId {
                Button {
                    Task {
                        await coordinator.openCampaignRun(
                            campaign: campaign,
                            item: item,
                            runId: runId)
                    }
                } label: {
                    Label("Se kandidater", systemImage: "person.3.sequence")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(coordinator.isBusy)
                .accessibilityIdentifier("discovery.campaign.item.open.\(item.position)")
            }

            if showAttempts && item.attempts.count > 1 {
                DisclosureGroup("Tidligere forsøk (\(item.attempts.count))") {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(item.attempts) { attempt in
                            Button {
                                Task {
                                    await coordinator.openCampaignRun(
                                        campaign: campaign,
                                        item: item,
                                        runId: attempt.runId)
                                }
                            } label: {
                                HStack {
                                    Text("Forsøk \(attempt.attemptNo) · \(attempt.status.rawValue)")
                                    Spacer()
                                    Text("\(attempt.reviewReadyCount) klare")
                                }
                                .font(.caption2)
                            }
                            .buttonStyle(.plain)
                            .disabled(coordinator.isBusy)
                        }
                    }
                    .padding(.top, 5)
                }
                .font(.caption2.bold())
                .tint(LeadgridDiscoveryTheme.accentSoft)
            }
        }
        .padding(.vertical, 3)
    }

    private func campaignStatusColor(_ status: DiscoveryV2CampaignStatus) -> Color {
        switch status {
        case .completed: LeadgridDiscoveryTheme.success
        case .failed, .cancelled: LeadgridDiscoveryTheme.danger
        case .partial, .cancelRequested: LeadgridDiscoveryTheme.warning
        default: LeadgridDiscoveryTheme.accentSoft
        }
    }

    private func campaignItemStatusColor(_ status: DiscoveryV2CampaignItemStatus) -> Color {
        switch status {
        case .completed: LeadgridDiscoveryTheme.success
        case .failed, .cancelled: LeadgridDiscoveryTheme.danger
        case .partial: LeadgridDiscoveryTheme.warning
        default: LeadgridDiscoveryTheme.accentSoft
        }
    }

    private func profileCard(_ profile: DiscoveryV2Profile) -> some View {
        let selected = coordinator.selectedProfile?.id == profile.id
        return Button {
            if coordinator.hasUnsavedProfileChanges,
               coordinator.selectedProfile?.id != profile.id {
                pendingSelection = profile
            } else {
                coordinator.selectProfile(profile)
            }
        } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 6) {
                    Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(selected ? LeadgridDiscoveryTheme.accentSoft : LeadgridDiscoveryTheme.secondaryText)
                    Text(profile.name)
                        .font(.subheadline.bold())
                        .lineLimit(1)
                    if profile.isDefault {
                        Text("STANDARD")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                    }
                    if !profile.isActive {
                        Text("PAUSET")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(LeadgridDiscoveryTheme.warning)
                    }
                }
                Label(profile.brief.areaSummary, systemImage: "mappin.and.ellipse")
                    .font(.caption)
                    .lineLimit(1)
                if let territoryCode = profile.brief.normalized.territoryCode {
                    Label("#\(territoryCode)", systemImage: "tag.fill")
                        .font(.caption2.bold())
                        .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                        .lineLimit(1)
                        .accessibilityLabel("Territorium \(territoryCode)")
                }
                Text(profile.brief.fitFilterSummary.prefix(3).joined(separator: " · "))
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                    .lineLimit(2)
            }
            .foregroundStyle(.primary)
            .frame(width: 230, alignment: .leading)
            .padding(12)
            .background(
                selected ? LeadgridDiscoveryTheme.accent.opacity(0.14) : Color.white.opacity(0.035),
                in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(selected ? LeadgridDiscoveryTheme.accentSoft.opacity(0.7) : LeadgridDiscoveryTheme.stroke))
        }
        .buttonStyle(.plain)
        .contextMenu {
            if !profile.isActive {
                Button {
                    Task { await coordinator.activateProfile(profile) }
                } label: {
                    Label("Aktiver profil", systemImage: "play.circle")
                }
            }
            Button {
                coordinator.selectProfile(profile)
                prepareEditor(.edit)
            } label: {
                Label("Gi nytt navn", systemImage: "pencil")
            }
            Button {
                coordinator.selectProfile(profile)
                editorName = profile.name + " – kopi"
                editorIsDefault = false
                editorMode = .create
            } label: {
                Label("Dupliser", systemImage: "plus.square.on.square")
            }
            Button(role: .destructive) { pendingDeletion = profile } label: {
                Label("Slett", systemImage: "trash")
            }
        }
        .accessibilityIdentifier("discovery.profile.\(profile.id)")
    }

    private func prepareEditor(_ mode: DiscoveryProfileEditorMode) {
        editorName = mode == .edit ? coordinator.selectedProfile?.name ?? "" : ""
        editorIsDefault = mode == .edit
            ? coordinator.selectedProfile?.isDefault == true
            : coordinator.profiles.isEmpty
        editorMode = mode
    }
}

private struct DiscoveryProfilePresetConfirmationSheet: View {
    let preset: DiscoveryV2ProfilePreset
    let baseBrief: DiscoveryV2Brief
    let existingProfiles: [DiscoveryV2Profile]
    let projectName: String
    let onConfirm: (String) async -> DiscoveryV2ProfileBatchResult

    @Environment(\.dismiss) private var dismiss
    @State private var creating = false
    @State private var result: DiscoveryV2ProfileBatchResult?
    @State private var batchAttempt = DiscoveryV2ProfileBatchAttempt()

    private var drafts: [DiscoveryV2ProfilePresetDraft] {
        preset.drafts(copying: baseBrief)
    }

    private var invalidMessage: String? {
        if let validation = drafts.compactMap({ $0.brief.validationMessage }).first {
            return validation
        }
        let conflicts = drafts.filter {
            DiscoveryRunCoordinator.conflictingProfile(
                for: $0,
                in: existingProfiles) != nil
        }
        if !conflicts.isEmpty {
            return "Territorium \(conflicts.map(\.name).joined(separator: ", ")) finnes med en annen kundetype, ICP eller andre filtre. Oppdater eller arkiver konfliktprofilen først."
        }
        let paused = drafts.filter {
            DiscoveryRunCoordinator.pausedMatchingProfile(
                for: $0,
                in: existingProfiles) != nil
        }
        guard !paused.isEmpty else { return nil }
        return "Profil \(paused.map(\.name).joined(separator: ", ")) er pauset og må aktiveres før kampanjen kan startes."
    }

    private var missingCount: Int {
        drafts.filter { !DiscoveryRunCoordinator.profile($0, existsIn: existingProfiles) }.count
    }

    private var idealCustomerSummary: String {
        let value = baseBrief.idealCustomer?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? "Beskriv idealkunden i Discovery-utkastet først." : value
    }

    private var industryQuerySummary: String {
        let values = baseBrief.normalized.industryQueries
        return values.isEmpty
            ? "Ingen søkeord eller næringskoder er satt"
            : values.joined(separator: ", ")
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(preset.title)
                            .font(.title3.bold())
                        Text(preset.detail)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section("Kundeprosjekt") {
                    Label {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Opprettes i: \(projectName)")
                                .font(.subheadline.bold())
                            Text("Alle fire er separate Discovery-profiler i dette ene prosjektet.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "folder.fill")
                            .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                    }
                }

                Section("Felles kvalifisering") {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Søkeord og næringskoder")
                            .font(.caption.bold())
                        Text(industryQuerySummary)
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Label("Maks \(preset.targetCount) kandidater per kjøring", systemImage: "person.3")
                    if let limit = drafts.first?.brief.effectiveWebsiteAssessmentLimit {
                        Label(
                            "Maks \(limit) Brreg-registrerte nettsider kan vurderes per kjøring",
                            systemImage: "globe.badge.chevron.backward")
                    } else {
                        Label(
                            "Nettsidetaket brukes ikke før nettsidekvalitet aktiveres",
                            systemImage: "globe")
                    }
                    Label("Minimum match \(preset.minimumFitScore)", systemImage: "scope")
                    Label(
                        "\(preset.requiredOrganizationForms.joined(separator: ", ")) · minst \(preset.minimumEmployees ?? 0) ansatte",
                        systemImage: "building.2")
                    Label("Manuell godkjenning før lead", systemImage: "hand.raised")
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Samme ICP")
                            .font(.caption.bold())
                        Text(idealCustomerSummary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Samme eksklusjoner")
                            .font(.caption.bold())
                        Text(baseBrief.exclusionTerms.isEmpty
                             ? "Ingen eksklusjoner satt"
                             : baseBrief.exclusionTerms.joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Profiler som opprettes") {
                    ForEach(drafts) { draft in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: "mappin.and.ellipse")
                                .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                                .padding(.top, 2)
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(draft.name).font(.subheadline.bold())
                                    Text("#\(draft.brief.territoryCode ?? "")")
                                        .font(.caption2.bold())
                                        .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                                }
                                Text(draft.brief.municipalityNames.joined(separator: ", "))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(draft.brief.municipalityNumbers.joined(separator: " · "))
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if DiscoveryRunCoordinator.conflictingProfile(
                                for: draft,
                                in: existingProfiles) != nil {
                                Text("KONFLIKT")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(LeadgridDiscoveryTheme.warning)
                            } else if DiscoveryRunCoordinator.pausedMatchingProfile(
                                for: draft,
                                in: existingProfiles) != nil {
                                Text("PAUSET")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(LeadgridDiscoveryTheme.warning)
                            } else if DiscoveryRunCoordinator.profile(draft, existsIn: existingProfiles) {
                                Text("FINNES")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                }

                if let invalidMessage {
                    Section {
                        Label(invalidMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(LeadgridDiscoveryTheme.warning)
                    }
                }

                if let result {
                    Section("Resultat") {
                        if result.replayed {
                            Label(
                                "\(result.createdCount) profiler bekreftet fra det samme sikre forsøket",
                                systemImage: "arrow.triangle.2.circlepath.circle.fill")
                                .foregroundStyle(.green)
                        } else if result.createdCount > 0 {
                            Label("\(result.createdCount) opprettet samlet", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                        }
                        if result.existingCount > 0 {
                            Label("\(result.existingCount) fantes fra før", systemImage: "arrow.right.circle")
                        }
                        if !result.failedNames.isEmpty {
                            Label(
                                "Ingen manglende profiler ble opprettet. Prøv samme batch igjen.",
                                systemImage: "exclamationmark.triangle.fill")
                                .foregroundStyle(.orange)
                        }
                    }
                }

                Section {
                    Text("Alle manglende profiler lagres i én atomisk transaksjon. Hvis batchen feiler, opprettes ingen av dem. En nettverksretry bruker samme nøkkel og kan ikke duplisere pakken. Eksisterende territoriumkoder endres ikke.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Bekreft profilpakke")
            .navigationBarTitleDisplayMode(.inline)
            .interactiveDismissDisabled(creating)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(result == nil ? "Avbryt" : "Lukk") { dismiss() }
                        .disabled(creating)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if missingCount == 0 || result?.isComplete == true {
                        Button("Ferdig") { dismiss() }
                            .disabled(creating)
                    } else {
                        Button {
                            Task {
                                creating = true
                                result = await onConfirm(batchAttempt.idempotencyKey)
                                creating = false
                            }
                        } label: {
                            if creating {
                                ProgressView()
                            } else {
                                Text(result == nil ? "Opprett \(missingCount)" : "Prøv igjen")
                            }
                        }
                        .disabled(creating || invalidMessage != nil)
                        .accessibilityIdentifier("discovery.profile.preset.confirm")
                    }
                }
            }
        }
    }
}

private struct DiscoveryProfileEditorSheet: View {
    let mode: DiscoveryProfileEditorMode
    let onSave: (String, Bool) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var isDefault: Bool

    init(
        mode: DiscoveryProfileEditorMode,
        name: String,
        isDefault: Bool,
        onSave: @escaping (String, Bool) -> Void
    ) {
        self.mode = mode
        self.onSave = onSave
        _name = State(initialValue: name)
        _isDefault = State(initialValue: isDefault)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Profil") {
                    TextField("For eksempel Vest – Bærum og Asker", text: $name)
                        .textInputAutocapitalization(.words)
                    Toggle("Bruk som standard for prosjektet", isOn: $isDefault)
                }
                Section {
                    Text(mode == .create
                         ? "Den nye profilen lagrer områdene og fit-filtrene som står i Discovery-utkastet nå."
                         : "Navn, område og filtre gjelder bare dette kundeprosjektet.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle(mode == .create ? "Ny Discovery-profil" : "Rediger profil")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        onSave(name.trimmingCharacters(in: .whitespacesAndNewlines), isDefault)
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
