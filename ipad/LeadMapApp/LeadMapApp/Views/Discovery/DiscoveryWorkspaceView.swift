// DiscoveryWorkspaceView.swift

import SwiftUI

private enum DiscoveryWorkspaceSection: String, CaseIterable, Identifiable {
    case candidates, marketing
    var id: String { rawValue }
}

private enum DiscoveryAreaMode: String, CaseIterable, Identifiable {
    case nationwide
    case municipalities
    case mapArea
    case city

    var id: String { rawValue }
    var title: String {
        switch self {
        case .nationwide: return "Norge"
        case .municipalities: return "Kommuner"
        case .mapArea: return "Kart-radius"
        case .city: return "By"
        }
    }
}

private enum DiscoveryOptionalBoolean: String, CaseIterable, Identifiable {
    case any
    case required
    case excluded

    var id: String { rawValue }
    var title: String {
        switch self {
        case .any: return "Alle"
        case .required: return "Ja"
        case .excluded: return "Nei"
        }
    }

    init(_ value: Bool?) {
        self = switch value {
        case true: .required
        case false: .excluded
        case nil: .any
        }
    }

    var value: Bool? {
        switch self {
        case .any: return nil
        case .required: return true
        case .excluded: return false
        }
    }
}

private enum DiscoveryEmployeeBoundary {
    case minimum
    case maximum
}

struct DiscoveryWorkspaceView: View {
    @Bindable var coordinator: DiscoveryRunCoordinator
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dismiss) private var dismiss
    @State private var rejectingCandidate: DiscoveryV2Candidate?
    @State private var rejectionReason: DiscoveryV2ReasonCode = .notRelevant
    @State private var placeDetailsCandidate: DiscoveryV2Candidate?
    @State private var selectedSection: DiscoveryWorkspaceSection = .candidates

    var body: some View {
        NavigationStack {
            workspaceContent
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(LeadgridDiscoveryTheme.background.ignoresSafeArea())
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") {
                        coordinator.dismissWorkspace()
                        dismiss()
                    }
                        .accessibilityIdentifier("discovery.close")
                }
                if coordinator.run != nil, !coordinator.campaigns.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            coordinator.showCampaignOverview()
                        } label: {
                            Label("Kampanje", systemImage: "rectangle.stack")
                        }
                        .accessibilityIdentifier("discovery.campaign.overview")
                        .disabled(!coordinator.canNavigateToCampaignOverview)
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let message = coordinator.errorMessage {
                    errorBar(message)
                } else if coordinator.isOfflinePaused {
                    offlineBar
                }
            }
        }
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled(coordinator.isBusy)
        .sheet(item: $rejectingCandidate) { candidate in
            DiscoveryRejectSheet(
                candidate: candidate,
                reason: $rejectionReason,
                onConfirm: {
                    rejectingCandidate = nil
                    Task {
                        _ = await coordinator.decide(
                            candidateId: candidate.id,
                            decision: .reject,
                            reason: rejectionReason)
                    }
                })
            .presentationDetents([.medium])
        }
        .sheet(item: $placeDetailsCandidate) { candidate in
            DiscoveryPlaceDetailsSheet(
                candidate: candidate,
                confirmedMatch: coordinator.confirmedPlaceMatches[candidate.id],
                load: {
                    try await coordinator.fetchTransientPlaceDetails(
                        candidateId: candidate.id)
                },
                onConfirmMatch: { match in
                    coordinator.confirmPlaceMatch(match, candidateId: candidate.id)
                },
                onClearConfirmation: {
                    coordinator.clearConfirmedPlaceMatch(candidateId: candidate.id)
                })
            .presentationDetents([.medium, .large])
        }
    }


    @ViewBuilder
    private var workspaceContent: some View {
        if showsMarketingSwitcher {
            VStack(spacing: 0) {
                Picker("Discovery-visning", selection: $selectedSection) {
                    Text("Kandidater").tag(DiscoveryWorkspaceSection.candidates)
                    Text("Markedsinnsikt").tag(DiscoveryWorkspaceSection.marketing)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .accessibilityIdentifier("discovery.workspace.section")
                Divider().overlay(LeadgridDiscoveryTheme.stroke)
                if selectedSection == .marketing {
                    marketingInsightsView
                } else {
                    phaseContent
                }
            }
        } else {
            phaseContent
        }
    }

    @ViewBuilder
    private var phaseContent: some View {
        switch coordinator.phase {
        case .brief: briefView
        case .preview: previewView
        case .running: runningView
        case .review: reviewView
        case .completed: completedView
        }
    }

    @ViewBuilder
    private var marketingInsightsView: some View {
        if let projectId = coordinator.projectId, let runId = coordinator.run?.id {
            DiscoveryMarketingInsightsView(
                api: appState.api,
                projectId: projectId,
                runId: runId,
                canGenerate: appState.permissions.contains("marketing.discovery_insights.run"),
                canReview: appState.permissions.contains("marketing.discovery_insights.review"))
        } else {
            EmptyView()
        }
    }

    private var showsMarketingSwitcher: Bool {
        guard appState.permissions.contains("marketing.discovery_insights.view") else {
            return false
        }
        switch coordinator.phase {
        case .review, .completed: return coordinator.run != nil
        default: return false
        }
    }

    private var navigationTitle: String {
        if selectedSection == .marketing && showsMarketingSwitcher {
            return "Markedsinnsikt"
        }
        switch coordinator.phase {
        case .brief: return "Hvem vil du finne?"
        case .preview: return "Se planen før du starter"
        case .running: return "Discovery arbeider"
        case .review: return "Vurder kandidater"
        case .completed: return "Discovery fullført"
        }
    }

    private var briefView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                introCard
                DiscoveryProfileManagerView(coordinator: coordinator)
                fieldSection("Kundetyper", detail: "Én per linje. Bruk konkrete beskrivelser markedet selv bruker.") {
                    TextEditor(text: industryQueriesBinding)
                        .frame(minHeight: 96)
                        .scrollContentBackground(.hidden)
                        .padding(10)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
                        .accessibilityLabel("Kundetyper")
                        .accessibilityIdentifier("discovery.brief.queries")
                }
                fieldSection("Organisasjonsnavn", detail: "Valgfritt navnesøk i Brreg. Brukes når segmentet ikke har en presis næringskode, for eksempel casting.") {
                    TextEditor(text: organizationNameQueriesBinding)
                        .frame(minHeight: 72)
                        .scrollContentBackground(.hidden)
                        .padding(10)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
                        .accessibilityLabel("Organisasjonsnavn-søk")
                        .accessibilityIdentifier("discovery.brief.organization-name-queries")
                }
                fieldSection("Område", detail: "Hele Norge søker nasjonalt. Kommuner er et hardt utvalg; by og kart-radius er lokale alternativer.") {
                    Picker("Område", selection: areaModeBinding) {
                        ForEach(DiscoveryAreaMode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    switch areaModeBinding.wrappedValue {
                    case .nationwide:
                        Label(
                            "Søket dekker virksomheter i hele Norge.",
                            systemImage: "map.fill"
                        )
                        .foregroundStyle(LeadgridDiscoveryTheme.success)
                    case .municipalities:
                        VStack(alignment: .leading, spacing: 7) {
                            TextEditor(text: municipalitiesBinding)
                                .frame(minHeight: 100)
                                .scrollContentBackground(.hidden)
                                .padding(10)
                                .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
                                .accessibilityLabel("Kommuner")
                                .accessibilityIdentifier("discovery.brief.municipalities")
                            Text("Én kommune per linje: Bærum | 3201. Du kan også skrive bare offisielt kommunenavn; serveren verifiserer det før søket.")
                                .font(.caption2)
                                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                            Label("Hardt kommuneutvalg: kandidater utenfor valgte kommuner tas ikke med.", systemImage: "checkmark.shield")
                                .font(.caption)
                                .foregroundStyle(LeadgridDiscoveryTheme.success)
                        }
                    case .mapArea:
                        HStack {
                            Image(systemName: "scope")
                            Text("Radius")
                            Spacer()
                            Stepper(
                                "\(Int(coordinator.brief.geo?.radiusKm ?? 10)) km",
                                value: radiusBinding,
                                in: 1...50)
                        }
                        .accessibilityIdentifier("discovery.brief.radius")
                    case .city:
                        TextField("For eksempel Oslo", text: cityBinding)
                            .textFieldStyle(.roundedBorder)
                            .accessibilityIdentifier("discovery.brief.city")
                    }

                    Divider().overlay(LeadgridDiscoveryTheme.stroke)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Territorium-tag")
                            .font(.subheadline.bold())
                        TextField("for eksempel vest eller ost-nord", text: territoryCodeBinding)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .accessibilityIdentifier("discovery.brief.territory-code")
                        Text("En stabil kode som følger profilen og gjør regionene sammenlignbare i kjøringer, kandidater og rapporter.")
                            .font(.caption2)
                            .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                    }
                }
                fieldSection("Idealkunde", detail: "Beskriv signalene som gjør en bedrift verdt tiden deres.") {
                    TextEditor(text: optionalTextBinding(\.idealCustomer))
                        .frame(minHeight: 84)
                        .scrollContentBackground(.hidden)
                        .padding(10)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
                        .accessibilityIdentifier("discovery.brief.icp")
                }
                fieldSection("Ekskluder", detail: "Ord som alltid betyr at en kandidat ikke passer, separert med komma.") {
                    TextField("forbruker, konkurrent, franchise", text: exclusionsBinding)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("discovery.brief.exclusions")
                }
                fitFiltersCard
                countsCard

                if let validationMessage = coordinator.brief.validationMessage {
                    Label(validationMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.subheadline)
                        .foregroundStyle(LeadgridDiscoveryTheme.warning)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .discoverySurface()
                        .accessibilityIdentifier("discovery.brief.validation")
                }

                Button {
                    Task { await coordinator.requestPreview() }
                } label: {
                    Label(coordinator.isBusy ? "Bygger plan …" : "Forhåndsvis søkeplan", systemImage: "sparkles")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .tint(LeadgridDiscoveryTheme.accent)
                .disabled(coordinator.isBusy || coordinator.brief.validationMessage != nil)
                .accessibilityIdentifier("discovery.preview")
            }
            .frame(maxWidth: horizontalSizeClass == .regular ? 720 : .infinity)
            .padding(20)
            .frame(maxWidth: .infinity)
        }
    }

    private var introCard: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "scope")
                .font(.title2.bold())
                .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                .frame(width: 44, height: 44)
                .background(LeadgridDiscoveryTheme.accent.opacity(0.18), in: Circle())
            VStack(alignment: .leading, spacing: 5) {
                Text(coordinator.projectName ?? "Aktivt prosjekt")
                    .font(.headline)
                Text("Leadgrid finner kandidater først. Ingenting blir et CRM-lead før du godkjenner det.")
                    .font(.subheadline)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
        }
        .discoverySurface()
    }

    private var fitFiltersCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Label("Kvalifiseringsfilter", systemImage: "line.3.horizontal.decrease.circle")
                    .font(.headline)
                Text("Filtrene avgrenser markedet før scoring. Resultatet skal kunne forklares med registrerte foretaksdata.")
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }

            Stepper(
                "Minimum match: \(coordinator.brief.minimumFitScore)",
                value: $coordinator.brief.minimumFitScore,
                in: 0...100,
                step: 5)
                .accessibilityIdentifier("discovery.brief.minimum-fit-score")

            Divider().overlay(LeadgridDiscoveryTheme.stroke)

            VStack(alignment: .leading, spacing: 6) {
                Text("Foretaksformer")
                    .font(.subheadline.bold())
                TextField("AS, ENK", text: organizationFormsBinding)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.characters)
                    .accessibilityIdentifier("discovery.brief.organization-forms")
                Text("Tomt felt inkluderer alle foretaksformer.")
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Antall ansatte")
                    .font(.subheadline.bold())
                HStack(spacing: 12) {
                    TextField("Minimum", text: employeeCountBinding(.minimum))
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                        .accessibilityIdentifier("discovery.brief.employee-minimum")
                    TextField("Maksimum", text: employeeCountBinding(.maximum))
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                        .accessibilityIdentifier("discovery.brief.employee-maximum")
                }
                Text("Brønnøysund støtter minimum 0, 1 eller 5+ og maksimum 0, 4 eller 5+.")
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }

            Picker("Brreg-konserntilknytning", selection: $coordinator.brief.organizationStructure) {
                ForEach(DiscoveryV2OrganizationStructure.allCases, id: \.self) { value in
                    Text(value.title).tag(value)
                }
            }
            .pickerStyle(.menu)
            .accessibilityIdentifier("discovery.brief.organization-structure")
            Text(DiscoveryV2OrganizationStructure.evidenceNotice)
                .font(.caption2)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)

            Picker("Nettsted", selection: websiteRequirementBinding) {
                ForEach(DiscoveryV2WebsiteRequirement.allCases, id: \.self) { value in
                    Text(value.title).tag(value)
                }
            }
            .pickerStyle(.menu)
            .accessibilityIdentifier("discovery.brief.website-requirement")

            VStack(alignment: .leading, spacing: 8) {
                Toggle("Vurder nettsidekvalitet", isOn: websiteQualityEnabledBinding)
                    .accessibilityIdentifier("discovery.brief.website-quality-enabled")
                if coordinator.brief.websiteQuality.minimumScore != nil {
                    Stepper(
                        "Minimum nettsidescore: \(coordinator.brief.websiteQuality.minimumScore ?? 60)",
                        value: websiteQualityScoreBinding,
                        in: 0...100,
                        step: 5)
                        .accessibilityIdentifier("discovery.brief.website-quality-score")
                }
                Text("Leadgrid vurderer bare Brønnøysund-registrert URL med et avgrenset, sikkert oppslag. Utilgjengelige eller utrygge nettsteder beholdes som ukjent for manuell vurdering.")
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }

            Divider().overlay(LeadgridDiscoveryTheme.stroke)

            VStack(alignment: .leading, spacing: 8) {
                Text("Kommersielle signaler")
                    .font(.subheadline.bold())
                Picker(
                    "MVA-registeret",
                    selection: commercialSignalBinding(\.registeredInVatRegister)
                ) {
                    ForEach(DiscoveryOptionalBoolean.allCases) { value in
                        Text(value.title).tag(value)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("discovery.brief.vat-register")

                Picker(
                    "Foretaksregisteret",
                    selection: commercialSignalBinding(\.registeredInBusinessRegister)
                ) {
                    ForEach(DiscoveryOptionalBoolean.allCases) { value in
                        Text(value.title).tag(value)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("discovery.brief.business-register")
            }
        }
        .discoverySurface()
    }

    private var countsCard: some View {
        VStack(spacing: 14) {
            countRow(
                title: "Kandidater",
                detail: "Hvor mange markedstreff som skal samles",
                value: $coordinator.brief.targetCount,
                range: 1...60)
            Divider().overlay(LeadgridDiscoveryTheme.stroke)
            countRow(
                title: "Registrerte nettsider (maks)",
                detail: coordinator.brief.websiteAssessmentLimitDescription,
                value: enrichmentCountBinding,
                range: 1...coordinator.brief.targetCount,
                isEnabled: coordinator.brief.effectiveWebsiteAssessmentLimit != nil)
            Divider().overlay(LeadgridDiscoveryTheme.stroke)
            Toggle(isOn: placesDetailsBinding) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Google Maps-detaljer")
                        .font(.subheadline.bold())
                    Text("Kun ved trykk på en kandidat. Opplysningene lagres ikke og påvirker ikke score.")
                        .font(.caption)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
            }
            .tint(LeadgridDiscoveryTheme.accent)
            .disabled(coordinator.isBusy)
            .accessibilityIdentifier("discovery.profile.places-details")
        }
        .discoverySurface()
    }

    private var previewView: some View {
        ScrollView {
            if let preview = coordinator.preview {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        metric("Treff", "\(preview.plan.requestedCandidates)")
                        if preview.brief.effectiveWebsiteAssessmentLimit != nil {
                            metric("Nettsider (maks)", "\(preview.plan.enrichmentCandidates)")
                        }
                        metric("Søk", "\(preview.plan.queries.count)")
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Dette vil Leadgrid søke etter", systemImage: "magnifyingglass")
                            .font(.headline)
                        ForEach(preview.plan.queries) { query in
                            HStack(alignment: .top, spacing: 9) {
                                Image(systemName: query.hardGeoFilter ? "scope" : "mappin.and.ellipse")
                                    .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                                Text(query.textQuery)
                                Spacer()
                                if query.hardGeoFilter {
                                    Text("fast område").font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                                }
                            }
                        }
                    }
                    .discoverySurface()
                    previewRunLineageCard
                    if let sources = preview.sources, !sources.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("Datagrunnlag", systemImage: "checkmark.seal")
                                .font(.headline)
                            ForEach(sources) { source in
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack {
                                        Text(source.provider).font(.subheadline.bold())
                                        Spacer()
                                        if let url = URL(string: source.providerUri) {
                                            Link("Åpne kilde", destination: url)
                                                .font(.caption)
                                        }
                                    }
                                    Text(source.notice)
                                        .font(.caption)
                                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                                    Text(source.license)
                                        .font(.caption2)
                                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                                }
                            }
                        }
                        .discoverySurface()
                    }
                    ForEach(preview.plan.warnings) { warning in
                        Label(warning.message, systemImage: "info.circle.fill")
                            .font(.subheadline)
                            .foregroundStyle(LeadgridDiscoveryTheme.warning)
                            .discoverySurface()
                    }
                    HStack {
                        Button("Tilbake og rediger") { coordinator.editBrief() }
                            .buttonStyle(.bordered)
                        Spacer()
                        Button {
                            Task { await coordinator.startRun() }
                        } label: {
                            Label(coordinator.isBusy ? "Starter …" : "Bekreft og start", systemImage: "play.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(LeadgridDiscoveryTheme.accent)
                        .disabled(!coordinator.canStart)
                        .accessibilityIdentifier("discovery.start")
                    }
                }
                .frame(maxWidth: 760)
                .padding(20)
                .frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder
    private var previewRunLineageCard: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: coordinator.previewRunProfile == nil ? "doc.badge.plus" : "link.circle.fill")
                .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                .font(.title3)
            VStack(alignment: .leading, spacing: 4) {
                if let profile = coordinator.previewRunProfile {
                    Text("Knyttet til «\(profile.name)»")
                        .font(.subheadline.bold())
                    Text("Resultater og tilbakemeldinger blir knyttet til versjon \(profile.version) av den lagrede profilen.")
                        .font(.caption)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                } else {
                    Text("Enkeltstående kjøring")
                        .font(.subheadline.bold())
                    Text(coordinator.selectedProfile == nil
                         ? "Denne søkeplanen kjøres uten en lagret profil."
                         : "Søkeplanen har usavede endringer og kjøres derfor som ad hoc. Lagre profilen først hvis resultatene skal følge profilen.")
                        .font(.caption)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
            }
            Spacer(minLength: 0)
        }
        .discoverySurface()
        .accessibilityIdentifier("discovery.preview.profile-lineage")
    }

    private var runningView: some View {
        VStack(spacing: 24) {
            Spacer()
            ZStack {
                Circle().stroke(Color.white.opacity(0.08), lineWidth: 10)
                Circle()
                    .trim(from: 0, to: max(0.04, coordinator.run?.progress ?? 0.04))
                    .stroke(LeadgridDiscoveryTheme.accent, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .frame(width: 126, height: 126)
            .overlay(Text("\(Int((coordinator.run?.progress ?? 0) * 100)) %").font(.title2.bold()))
            Text(coordinator.bannerTitle).font(.title2.bold())
            Text(coordinator.bannerDetail)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            if let activeTerritoryCode {
                Label("Kjøring #\(activeTerritoryCode)", systemImage: "tag.fill")
                    .font(.caption.bold())
                    .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
            }
            Text("Du kan lukke denne visningen. Discovery fortsetter på tjeneren og kan åpnes igjen fra kartet.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                .frame(maxWidth: 460)
            HStack {
                Button("Kjør i bakgrunnen") {
                    coordinator.dismissWorkspace()
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .tint(LeadgridDiscoveryTheme.accent)
                Button("Avbryt", role: .destructive) { Task { await coordinator.cancelRun() } }
                    .buttonStyle(.bordered)
                    .disabled(coordinator.isBusy)
            }
            Spacer()
        }
        .padding(24)
    }

    private var reviewView: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(topLevelCandidates.count) forslag klare")
                        .font(.headline)
                    Text(reviewSummary)
                        .font(.caption)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
                Spacer()
            }
            .padding()
            if let activeTerritoryCode {
                Label("Kandidater fra #\(activeTerritoryCode)", systemImage: "tag.fill")
                    .font(.caption.bold())
                    .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                    .padding(.horizontal)
                    .padding(.bottom, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Divider().overlay(LeadgridDiscoveryTheme.stroke)

            ScrollView {
                LazyVStack(spacing: 12) {
                    if coordinator.candidates.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: coordinator.isBusy ? "hourglass" : "arrow.clockwise.circle")
                                .font(.system(size: 34))
                                .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                            Text(coordinator.isBusy ? "Henter kandidater …" : "Kandidatlisten er ikke lastet")
                                .font(.headline)
                            Text("Kjøringen er bevart. Hent listen på nytt uten å starte et nytt søk.")
                                .font(.caption)
                                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                                .multilineTextAlignment(.center)
                            Button("Hent kandidater") { Task { await coordinator.resumeOrRetry() } }
                                .buttonStyle(.borderedProminent)
                                .disabled(coordinator.isBusy)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 36)
                        .discoverySurface()
                    }
                    ForEach(topLevelCandidates) { candidate in
                        DiscoveryCandidateRow(
                            candidate: candidate,
                            territoryCode: activeTerritoryCode,
                            confirmedPlaceMatch: coordinator.confirmedPlaceMatches[candidate.id],
                            selected: coordinator.selectedCandidateIds.contains(candidate.id),
                            busy: coordinator.busyCandidateIds.contains(candidate.id),
                            canShowPlaceDetails: coordinator.placesDetailsEnabled
                                && !(candidate.clinicGroup?.role == .practitionerContact
                                     && candidate.clinicGroup?.clinicLeadId != nil),
                            onShowPlaceDetails: { placeDetailsCandidate = candidate },
                            onToggleSelection: {
                                if coordinator.selectedCandidateIds.contains(candidate.id) {
                                    coordinator.selectedCandidateIds.remove(candidate.id)
                                } else { coordinator.selectedCandidateIds.insert(candidate.id) }
                            },
                            onApprove: {
                                Task {
                                    let imported = await coordinator.decide(
                                        candidateId: candidate.id,
                                        decision: .approve,
                                        reason: .goodFit)
                                    if imported { await appState.refreshLeads() }
                                }
                            },
                            onReject: {
                                rejectionReason = .notRelevant
                                rejectingCandidate = candidate
                            })
                    }
                    if coordinator.hasMoreCandidates {
                        Button(coordinator.isLoadingMore ? "Laster …" : "Last flere") {
                            Task { await coordinator.loadCandidates(replace: false) }
                        }
                        .buttonStyle(.bordered)
                        .disabled(coordinator.isLoadingMore)
                    }
                }
                .padding()
            }
            if !coordinator.selectedCandidateIds.isEmpty {
                HStack {
                    Text("\(coordinator.selectedCandidateIds.count) valgt")
                    Spacer()
                    Button("Avvis valgte", role: .destructive) {
                        rejectionReason = .notRelevant
                        Task { _ = await coordinator.decideSelected(.reject, reason: rejectionReason) }
                    }
                    .buttonStyle(.bordered)
                    Button("Godkjenn valgte") {
                        Task {
                            let imported = await coordinator.decideSelected(.approve, reason: .goodFit)
                            if imported > 0 { await appState.refreshLeads() }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(LeadgridDiscoveryTheme.success)
                }
                .padding()
                .background(.ultraThinMaterial)
            }
        }
    }

    private var topLevelCandidates: [DiscoveryV2Candidate] {
        coordinator.candidates.filter { candidate in
            candidate.clinicGroup?.role != .practitionerContact
                || candidate.clinicGroup?.clinicLeadId != nil
                || !coordinator.candidates.contains {
                    $0.id == candidate.clinicGroup?.clinicCandidateId
                }
        }
    }

    private var groupedPractitionerCount: Int {
        topLevelCandidates.reduce(0) {
            $0 + ($1.clinicGroup?.practitioners.count ?? 0)
        }
    }

    private var reviewSummary: String {
        let contactsForExistingClinics = topLevelCandidates.filter {
            $0.clinicGroup?.role == .practitionerContact
                && $0.clinicGroup?.clinicLeadId != nil
        }.count
        if contactsForExistingClinics > 0 {
            return "\(contactsForExistingClinics) tannlegekontakter kan godkjennes inn på klinikker som allerede ligger i Leadbook."
        }
        if groupedPractitionerCount > 0 {
            return "\(groupedPractitionerCount) tannlegevirksomheter er samlet under klinikkene. Én godkjenning oppretter én lead med kontakter."
        }
        return "Match og datakvalitet vises separat – svak dokumentasjon blir aldri fremstilt som fakta."
    }

    private var completedView: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: coordinator.run?.status == .failed ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(coordinator.run?.status == .failed ? LeadgridDiscoveryTheme.danger : LeadgridDiscoveryTheme.success)
            Text(coordinator.bannerTitle).font(.title2.bold())
            Text(coordinator.bannerDetail).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            if let activeTerritoryCode {
                Label("Kjøring #\(activeTerritoryCode)", systemImage: "tag.fill")
                    .font(.caption.bold())
                    .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
            }
            HStack {
                Button("Lukk") {
                    coordinator.dismissWorkspace()
                    dismiss()
                }
                .buttonStyle(.bordered)
                Button("Nytt søk") { coordinator.beginAnotherSearch() }
                    .buttonStyle(.borderedProminent)
                    .tint(LeadgridDiscoveryTheme.accent)
                    .accessibilityIdentifier("discovery.new.search")
            }
            Spacer()
        }
    }

    private func fieldSection<Content: View>(
        _ title: String,
        detail: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            Text(detail).font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            content()
        }
        .discoverySurface()
    }

    private func countRow(
        title: String,
        detail: String,
        value: Binding<Int>,
        range: ClosedRange<Int>,
        isEnabled: Bool = true
    ) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.bold())
                Text(detail).font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
            Spacer()
            if isEnabled {
                Stepper("\(value.wrappedValue)", value: value, in: range)
                    .fixedSize()
                    .accessibilityLabel(title)
                    .accessibilityHint(detail)
            } else {
                Text("Ikke aktiv")
                    .font(.caption.bold())
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
        }
    }

    private func metric(_ title: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.title2.bold())
            Text(title).font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .discoverySurface()
    }

    private func errorBar(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(LeadgridDiscoveryTheme.warning)
            Text(message).font(.subheadline)
            Spacer()
            if coordinator.errorIsRetryable {
                Button("Prøv igjen") { Task { await coordinator.resumeOrRetry() } }
            }
            Button { coordinator.clearError() } label: { Image(systemName: "xmark") }
                .accessibilityLabel("Lukk feilmelding")
        }
        .padding()
        .background(LeadgridDiscoveryTheme.surfaceRaised)
    }

    private var offlineBar: some View {
        Label("Frakoblet – utkast og siste status er tilgjengelig lokalt", systemImage: "wifi.slash")
            .font(.subheadline)
            .frame(maxWidth: .infinity)
            .padding()
            .background(LeadgridDiscoveryTheme.surfaceRaised)
    }

    private var industryQueriesBinding: Binding<String> {
        Binding(
            get: { coordinator.brief.industryQueries.joined(separator: "\n") },
            set: { coordinator.brief.industryQueries = $0.components(separatedBy: .newlines) })
    }

    private var organizationNameQueriesBinding: Binding<String> {
        Binding(
            get: { coordinator.brief.organizationNameQueries.joined(separator: "\n") },
            set: {
                coordinator.brief.organizationNameQueries =
                    $0.components(separatedBy: .newlines)
            })
    }

    private var territoryCodeBinding: Binding<String> {
        Binding(
            get: { coordinator.brief.territoryCode ?? "" },
            set: { coordinator.brief.territoryCode = $0.lowercased() })
    }

    private var activeTerritoryCode: String? {
        coordinator.run?.briefSnapshot?.normalized.territoryCode
            ?? coordinator.selectedProfile?.brief.normalized.territoryCode
            ?? coordinator.brief.normalized.territoryCode
    }

    private var exclusionsBinding: Binding<String> {
        Binding(
            get: { coordinator.brief.exclusionTerms.joined(separator: ", ") },
            set: { coordinator.brief.exclusionTerms = $0.split(separator: ",").map(String.init) })
    }

    private var cityBinding: Binding<String> {
        Binding(
            get: { coordinator.brief.city ?? "" },
            set: {
                coordinator.brief.city = $0
                coordinator.brief.countryCode = nil
                coordinator.brief.geo = nil
                coordinator.brief.municipalityNames = []
                coordinator.brief.municipalityNumbers = []
            })
    }

    private var areaModeBinding: Binding<DiscoveryAreaMode> {
        Binding(
            get: {
                if coordinator.brief.countryCode == "NO" { return .nationwide }
                if !coordinator.brief.municipalityNames.isEmpty
                    || !coordinator.brief.municipalityNumbers.isEmpty {
                    return .municipalities
                }
                if coordinator.brief.geo != nil { return .mapArea }
                return .city
            },
            set: { mode in
                switch mode {
                case .nationwide:
                    coordinator.brief.countryCode = "NO"
                    coordinator.brief.geo = nil
                    coordinator.brief.city = nil
                    coordinator.brief.municipalityNames = []
                    coordinator.brief.municipalityNumbers = []
                case .municipalities:
                    coordinator.brief.countryCode = nil
                    coordinator.brief.geo = nil
                    coordinator.brief.city = nil
                case .mapArea:
                    coordinator.brief.countryCode = nil
                    coordinator.brief.geo = coordinator.brief.geo
                        ?? .init(latitude: 59.9139, longitude: 10.7522, radiusKm: 10)
                    coordinator.brief.city = nil
                    coordinator.brief.municipalityNames = []
                    coordinator.brief.municipalityNumbers = []
                case .city:
                    coordinator.brief.countryCode = nil
                    coordinator.brief.geo = nil
                    coordinator.brief.city = coordinator.brief.city ?? ""
                    coordinator.brief.municipalityNames = []
                    coordinator.brief.municipalityNumbers = []
                }
            })
    }

    private var municipalitiesBinding: Binding<String> {
        Binding(
            get: {
                DiscoveryV2MunicipalityTextCodec.text(
                    names: coordinator.brief.municipalityNames,
                    numbers: coordinator.brief.municipalityNumbers)
            },
            set: { text in
                let municipalities = DiscoveryV2MunicipalityTextCodec.values(from: text)
                coordinator.brief.municipalityNames = municipalities.names
                coordinator.brief.municipalityNumbers = municipalities.numbers
                coordinator.brief.city = nil
                coordinator.brief.geo = nil
                coordinator.brief.countryCode = nil
            })
    }

    private var radiusBinding: Binding<Int> {
        Binding(
            get: { Int(coordinator.brief.geo?.radiusKm ?? 10) },
            set: { coordinator.brief.geo?.radiusKm = Double($0) })
    }

    private var enrichmentCountBinding: Binding<Int> {
        Binding(
            get: { coordinator.brief.enrichmentCount },
            set: { coordinator.brief.enrichmentCount = min(coordinator.brief.targetCount, $0) })
    }

    private var placesDetailsBinding: Binding<Bool> {
        Binding(
            get: { coordinator.placesDetailsEnabled },
            set: { enabled in
                Task { await coordinator.setPlacesDetailsEnabled(enabled) }
            })
    }

    private var organizationFormsBinding: Binding<String> {
        Binding(
            get: { coordinator.brief.organizationForms.joined(separator: ", ") },
            set: { value in
                coordinator.brief.organizationForms = value
                    .components(separatedBy: CharacterSet(charactersIn: ",\n"))
            })
    }

    private var websiteQualityEnabledBinding: Binding<Bool> {
        Binding(
            get: { coordinator.brief.websiteQuality.minimumScore != nil },
            set: { enabled in
                if enabled && coordinator.brief.websiteRequirement == .missing {
                    coordinator.brief.websiteRequirement = .present
                }
                coordinator.brief.websiteQuality.minimumScore = enabled
                    ? coordinator.brief.websiteQuality.minimumScore ?? 60
                    : nil
            })
    }

    private var websiteRequirementBinding: Binding<DiscoveryV2WebsiteRequirement> {
        Binding(
            get: { coordinator.brief.websiteRequirement },
            set: { requirement in
                coordinator.brief.websiteRequirement = requirement
                if requirement == .missing {
                    coordinator.brief.websiteQuality.minimumScore = nil
                }
            })
    }

    private var websiteQualityScoreBinding: Binding<Int> {
        Binding(
            get: { coordinator.brief.websiteQuality.minimumScore ?? 60 },
            set: { coordinator.brief.websiteQuality.minimumScore = min(100, max(0, $0)) })
    }

    private func employeeCountBinding(_ boundary: DiscoveryEmployeeBoundary) -> Binding<String> {
        Binding(
            get: {
                let value = switch boundary {
                case .minimum: coordinator.brief.employeeCount?.minimum
                case .maximum: coordinator.brief.employeeCount?.maximum
                }
                return value.map(String.init) ?? ""
            },
            set: { text in
                var filter = coordinator.brief.employeeCount
                    ?? .init(minimum: nil, maximum: nil)
                let value = Int(text.trimmingCharacters(in: .whitespacesAndNewlines))
                switch boundary {
                case .minimum: filter.minimum = value
                case .maximum: filter.maximum = value
                }
                coordinator.brief.employeeCount = filter.minimum == nil && filter.maximum == nil
                    ? nil
                    : filter
            })
    }

    private func commercialSignalBinding(
        _ keyPath: WritableKeyPath<DiscoveryV2CommercialSignals, Bool?>
    ) -> Binding<DiscoveryOptionalBoolean> {
        Binding(
            get: { DiscoveryOptionalBoolean(coordinator.brief.commercialSignals[keyPath: keyPath]) },
            set: { selection in
                coordinator.brief.commercialSignals[keyPath: keyPath] = selection.value
            })
    }

    private func optionalTextBinding(_ keyPath: WritableKeyPath<DiscoveryV2Brief, String?>) -> Binding<String> {
        Binding(
            get: { coordinator.brief[keyPath: keyPath] ?? "" },
            set: { coordinator.brief[keyPath: keyPath] = $0 })
    }
}

struct DiscoveryCandidateRow: View {
    let candidate: DiscoveryV2Candidate
    let territoryCode: String?
    let confirmedPlaceMatch: DiscoveryV2PlaceMatch?
    let selected: Bool
    let busy: Bool
    let canShowPlaceDetails: Bool
    let onShowPlaceDetails: () -> Void
    let onToggleSelection: () -> Void
    let onApprove: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 12) {
                selectionButton
                identity
                Spacer(minLength: 12)
                scores
            }
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    selectionButton
                    identity
                }
                scores
            }
        }
            if candidate.excluded == true {
                Label("Treffer en eksklusjonsregel", systemImage: "nosign")
                    .font(.caption.bold()).foregroundStyle(LeadgridDiscoveryTheme.danger)
            }
            if candidate.subjectKind == .person {
                Label(
                    "Personprospekt – oppretter aldri en talentkonto automatisk",
                    systemImage: "person.crop.circle.badge.checkmark")
                    .font(.caption.bold())
                    .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
            }
            clinicClassification
            if let reviewNotice = candidate.observation?.reviewNotice {
                VStack(alignment: .leading, spacing: 3) {
                    Label("Approksimert historikk", systemImage: "clock.badge.exclamationmark")
                        .font(.caption.bold())
                        .foregroundStyle(LeadgridDiscoveryTheme.warning)
                    Text(reviewNotice)
                        .font(.caption2)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
                .accessibilityIdentifier("discovery.candidate.observation-warning")
            }
            if let confirmedPlaceMatch {
                VStack(alignment: .leading, spacing: 3) {
                    Label("Google Maps-identitet bekreftet", systemImage: "checkmark.shield.fill")
                        .font(.caption.bold())
                        .foregroundStyle(LeadgridDiscoveryTheme.success)
                    Text("\(confirmedPlaceMatch.displayName) · \(confirmedPlaceMatch.matchQualityTitle)")
                        .font(.caption)
                    Text("Place-ID sendes og lagres først når du godkjenner kandidaten som lead.")
                        .font(.caption2)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
            }
            if let websiteQuality = candidate.scoreExplanation?.websiteQuality ?? candidate.websiteQuality,
               let presentation = websiteQuality.presentation {
                Label(
                    presentation,
                    systemImage: websiteQuality.status == "assessed"
                        ? "globe.badge.chevron.backward"
                        : "questionmark.circle")
                    .font(.caption)
                    .foregroundStyle(
                        websiteQuality.status == "assessed"
                            ? LeadgridDiscoveryTheme.accentSoft
                            : LeadgridDiscoveryTheme.secondaryText)
            }
            if let qualification = candidate.scoreExplanation?.contentQualification {
                Label(
                    qualification.presentation,
                    systemImage: qualification.outcome == "passed"
                        ? "checkmark.seal.fill"
                        : "text.magnifyingglass")
                    .font(.caption)
                    .foregroundStyle(
                        qualification.outcome == "passed"
                            ? LeadgridDiscoveryTheme.success
                            : LeadgridDiscoveryTheme.secondaryText)
            } else if let matchedTerms = candidate.websiteQuality?.qualification?.matchedTerms,
                      !matchedTerms.isEmpty {
                Label(
                    "Bekreftet innhold: \(matchedTerms.joined(separator: ", "))",
                    systemImage: "checkmark.seal.fill")
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.success)
            }
            if let reasons = candidate.reasons, !reasons.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Hvorfor denne kandidaten").font(.caption.bold())
                    ForEach(reasons, id: \.self) { Text("• \($0)").font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText) }
                }
            } else if candidate.fitScore == nil {
                Label("Ikke nok dokumentasjon til å beregne match", systemImage: "questionmark.circle")
                    .font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
            ViewThatFits(in: .horizontal) {
                HStack {
                    Spacer()
                    candidateActions
                }
                VStack(alignment: .trailing, spacing: 8) {
                    candidateActions
                }
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            .disabled(busy)
        }
        .discoverySurface()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("discovery.candidate.\(candidate.id)")
    }

    @ViewBuilder
    private var candidateActions: some View {
        if canShowPlaceDetails {
            Button(action: onShowPlaceDetails) {
                Label("Google Maps", systemImage: "building.2.crop.circle")
            }
            .buttonStyle(.bordered)
            .accessibilityHint("Henter midlertidige detaljer som ikke lagres")
        }
        Button("Avvis", role: .destructive, action: onReject)
            .buttonStyle(.bordered)
        Button(approvalTitle, action: onApprove)
            .buttonStyle(.borderedProminent)
            .tint(LeadgridDiscoveryTheme.success)
            .disabled(approvalBlockedByClinic)
}

@ViewBuilder
private var clinicClassification: some View {
    if let group = candidate.clinicGroup {
        VStack(alignment: .leading, spacing: 7) {
            Label(classificationTitle(group), systemImage: classificationIcon(group))
                .font(.caption.bold())
                .foregroundStyle(classificationColor(group))
            if group.role == .clinicAccount, !group.practitioners.isEmpty {
                Text("Tannleger som blir kontakter")
                    .font(.caption2.bold())
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                ForEach(group.practitioners.prefix(4)) { practitioner in
                    HStack(spacing: 6) {
                        Image(systemName: "person.crop.circle")
                        Text(practitioner.name)
                        if let organizationNumber = practitioner.organizationNumber {
                            Text("· \(organizationNumber)")
                                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                        }
                    }
                    .font(.caption)
                }
                if group.practitioners.count > 4 {
                    Text("+ \(group.practitioners.count - 4) flere")
                        .font(.caption2)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
                Text("Godkjenningen lager én klinikk-lead og \(group.practitioners.count) kontakter.")
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            } else if group.role == .independentPractice {
                Text("Ingen entydig klinikk ble funnet på samme adresse. Kandidaten behandles som en selvstendig praksis.")
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            } else if group.role == .ambiguous {
                Text("Leadgrid fant ikke nok entydig dokumentasjon til å gruppere virksomheten automatisk.")
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            } else if group.role == .practitionerContact,
                      group.clinicLeadId != nil {
                Text("Klinikken ligger allerede i Leadbook. Godkjenning legger tannlegen til som kontakt uten å opprette en ny lead.")
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            } else if group.role == .practitionerContact {
                Text("Tannlegen er knyttet til klinikken, men klinikken må godkjennes først. Ingen separat lead blir opprettet.")
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
        }
        .padding(10)
        .background(LeadgridDiscoveryTheme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .accessibilityIdentifier("discovery.candidate.clinic-group")
    }
}

private var approvalTitle: String {
    if candidate.clinicGroup?.role == .practitionerContact,
       candidate.clinicGroup?.clinicLeadId != nil {
        return "Legg til som kontakt"
    }
    if approvalBlockedByClinic {
        return "Godkjenn klinikken først"
    }
    let contacts = candidate.clinicGroup?.practitioners.count ?? 0
    return contacts > 0 ? "Godkjenn klinikk + \(contacts) kontakter" : "Godkjenn"
}

private var approvalBlockedByClinic: Bool {
    candidate.clinicGroup?.role == .practitionerContact
        && candidate.clinicGroup?.clinicLeadId == nil
}

private func classificationTitle(_ group: DiscoveryV2ClinicGroup) -> String {
    switch group.role {
    case .clinicAccount: return "Klinikk · salgskonto"
    case .practitionerContact: return "Tannlege ved \(group.clinicName ?? "klinikk")"
    case .independentPractice: return "Selvstendig tannlegepraksis"
    case .ambiguous: return "Krever manuell vurdering"
    }
}

private func classificationIcon(_ group: DiscoveryV2ClinicGroup) -> String {
    switch group.role {
    case .clinicAccount: return "building.2.fill"
    case .practitionerContact: return "person.crop.circle.badge.checkmark"
    case .independentPractice: return "person.crop.rectangle"
    case .ambiguous: return "questionmark.diamond"
    }
}

private func classificationColor(_ group: DiscoveryV2ClinicGroup) -> Color {
    switch group.role {
    case .clinicAccount: return LeadgridDiscoveryTheme.accentSoft
    case .practitionerContact: return LeadgridDiscoveryTheme.success
    case .independentPractice: return LeadgridDiscoveryTheme.warning
    case .ambiguous: return LeadgridDiscoveryTheme.warning
    }
}

private var selectionButton: some View {
    Button(action: onToggleSelection) {
        Image(systemName: selected ? "checkmark.square.fill" : "square")
            .font(.title3)
            .foregroundStyle(selected ? LeadgridDiscoveryTheme.accentSoft : LeadgridDiscoveryTheme.secondaryText)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(selected ? "Fjern markering" : "Marker kandidat")
}

private var identity: some View {
    VStack(alignment: .leading, spacing: 4) {
        Text(candidate.name).font(.headline)
        Text([candidate.address, candidate.city].compactMap { $0 }.joined(separator: " · "))
            .font(.caption)
            .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        if let website = candidate.websiteUrl {
            Text(website).font(.caption).foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
        }
        HStack(spacing: 5) {
            Image(systemName: "building.columns")
            Text("Brønnøysundregistrene (NLOD)")
        }
        .font(.caption)
        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        if let organizationNumber = candidate.organizationNumber, !organizationNumber.isEmpty {
            Text("Org.nr. \(organizationNumber)")
            .font(.caption)
            .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
        if let naceDescription = candidate.naceDescription, !naceDescription.isEmpty {
            Text([candidate.naceCode, naceDescription].compactMap { $0 }.joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
        if let employeeCount = candidate.employeeCount {
            Text("\(employeeCount) ansatte registrert")
                .font(.caption)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
        if let primaryTerritoryCode {
            Label(primaryProfileLabel(territoryCode: primaryTerritoryCode), systemImage: "tag.fill")
                .font(.caption2.bold())
                .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
        }
        if !otherTerritoryCodes.isEmpty {
            Text("Også observert i \(otherTerritoryCodes.map { "#\($0)" }.joined(separator: ", "))")
                .font(.caption2)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
    }
}

private var primaryTerritoryCode: String? {
    nonEmpty(candidate.discoveryProfile?.territoryCode) ?? nonEmpty(territoryCode)
}

private var otherTerritoryCodes: [String] {
    var seen = Set<String>()
    if let primaryTerritoryCode { seen.insert(primaryTerritoryCode) }
    return (candidate.observedInProfiles ?? []).compactMap { observation in
        guard let code = nonEmpty(observation.territoryCode),
              seen.insert(code).inserted else { return nil }
        return code
    }
}

private func primaryProfileLabel(territoryCode: String) -> String {
    if let profileName = nonEmpty(candidate.discoveryProfile?.name) {
        return "Funnet via \(profileName) · #\(territoryCode)"
    }
    return "Funnet via #\(territoryCode)"
}

private func nonEmpty(_ value: String?) -> String? {
    guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
          !trimmed.isEmpty else { return nil }
    return trimmed
}

private var scores: some View {
    HStack(spacing: 8) {
        scoreBadge("Match", score: candidate.fitScore, coverage: candidate.fitCoverage, tint: LeadgridDiscoveryTheme.accent)
        scoreBadge("Datagrunnlag", score: candidate.dataQualityScore, coverage: candidate.dataQualityCoverage, tint: LeadgridDiscoveryTheme.success)
    }
}

    private func scoreBadge(_ title: String, score: Int?, coverage: Double?, tint: Color) -> some View {
        VStack(spacing: 2) {
            Text(score.map(String.init) ?? "–").font(.headline.monospacedDigit())
            Text(title).font(.caption2)
            if let coverage {
                Text("\(Int(coverage * 100)) % dekning").font(.caption2).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
        }
        .padding(.horizontal, 9).padding(.vertical, 7)
        .background(tint.opacity(0.13), in: RoundedRectangle(cornerRadius: 9))
        .accessibilityElement(children: .combine)
    }
}

struct DiscoveryRejectSheet: View {
    let candidate: DiscoveryV2Candidate
    @Binding var reason: DiscoveryV2ReasonCode
    let onConfirm: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Hvorfor passer ikke \(candidate.name)?") {
                    Picker("Årsak", selection: $reason) {
                        ForEach(DiscoveryV2ReasonCode.allCases.filter { $0 != .goodFit }) { reason in
                            Text(reason.title).tag(reason)
                        }
                    }
                    .pickerStyle(.inline)
                }
                Section {
                    Text("Tilbakemeldingen lagres som historikk og grunnlag for senere forbedringer. Standardprofilen endres aldri automatisk.")
                        .font(.caption)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
            }
            .navigationTitle("Avvis kandidat")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Avvis", role: .destructive, action: onConfirm) }
            }
        }
    }
}

struct DiscoveryRunBanner: View {
    @Bindable var coordinator: DiscoveryRunCoordinator
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(spacing: 11) {
                if coordinator.run?.status.isRunning == true {
                    ProgressView(value: coordinator.run?.progress ?? 0)
                        .progressViewStyle(.circular)
                        .tint(LeadgridDiscoveryTheme.accentSoft)
                } else {
                    Image(systemName: "sparkles")
                        .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(coordinator.bannerTitle).font(.subheadline.bold())
                    Text(coordinator.bannerDetail).font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
            .padding(12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
            .background(LeadgridDiscoveryTheme.surface.opacity(0.75), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(LeadgridDiscoveryTheme.stroke))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(coordinator.bannerTitle + ". " + coordinator.bannerDetail)
        .accessibilityHint("Åpner Discovery")
        .accessibilityIdentifier("discovery.run.banner")
    }
}
