// LeadgridResearchTab.swift
//
// Bunntab-flate for "Research" (Pakke 9, Daniels Research-trio).
//
// Hele Role Room Agent gjort lead-fokusert — 3 segmenter:
//
//   • Finn leads     — AI-discovery for valgt prosjekt (Pakke 9 main).
//                       Bygger query fra projekt-kontekst, kjører Places
//                       Text Search, kjører batch-research, viser hero-
//                       banner "Vi fant 12 leads for MedSide!" + auto-
//                       zoom-knapp.
//   • Brand scan     — URL → draft → orchestrator (eksisterende
//                       LeadResearchStartView mountes herfra).
//   • Markedsskann   — Region + bransje + målgruppe → market-scan
//                       (eksisterende LeadgridMarketScanFormView).
//
// "Chat med Agent" er flyttet til en oppfølgings-PR — vi har ikke HTTP-
// rutene for threads-CRUD eksponert ennå, og det er bedre å bygge når
// vi har full stack å spille mot enn å implementere en delvis chat-UI.
//
// Alle handlinger er gated av samme RBAC som "Finn nye leads"-menyen i
// MapScreen — `permissions.contains("lead_research.run")`. Hvis bruker
// mangler tillatelse vises en informativ tom-tilstand i stedet.

import SwiftUI
import CoreLocation

@MainActor
struct LeadgridResearchTab: View {
    @Environment(AppState.self) private var appState

    @State private var selectedSegment: ResearchSegment = .findLeads
    @State private var brandScanSheetOpen = false
    @State private var marketScanSheetOpen = false

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    enum ResearchSegment: String, CaseIterable, Identifiable {
        case findLeads = "Finn leads"
        case brandScan = "Brand scan"
        case marketScan = "Markedsskann"
        var id: String { rawValue }

        var icon: String {
            switch self {
            case .findLeads:   return "sparkles.rectangle.stack.fill"
            case .brandScan:   return "link.circle.fill"
            case .marketScan:  return "chart.line.uptrend.xyaxis.circle.fill"
            }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                segmentPicker
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        switch selectedSegment {
                        case .findLeads:
                            FindLeadsSegment()
                        case .brandScan:
                            brandScanSegment
                        case .marketScan:
                            marketScanSegment
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Research")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $brandScanSheetOpen) {
                LeadResearchStartView()
            }
            .sheet(isPresented: $marketScanSheetOpen) {
                if let api = appState.api {
                    LeadgridMarketScanFormView(
                        api: api,
                        organizationId: appState.activeOrganizationId,
                        onStarted: { _ in marketScanSheetOpen = false }
                    )
                }
            }
        }
    }

    // MARK: - Segment picker

    private var segmentPicker: some View {
        VStack(spacing: 12) {
            Picker("", selection: $selectedSegment) {
                ForEach(ResearchSegment.allCases) { seg in
                    Label(seg.rawValue, systemImage: seg.icon).tag(seg)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
        }
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    // MARK: - Brand scan segment

    @ViewBuilder
    private var brandScanSegment: some View {
        VStack(alignment: .leading, spacing: 14) {
            ResearchSegmentHeader(
                title: "Brand scan",
                description: "Lim inn URL eller skriv inn et selskapsnavn — Claude kjører "
                + "Brreg, skraper nettsiden og finner Google Places-treff. Resultatet "
                + "ender som en draft-lead på kartet du kan akseptere eller forkaste.",
                icon: ResearchSegment.brandScan.icon,
                tint: Self.brandPurple,
            )
            Button {
                brandScanSheetOpen = true
            } label: {
                Label("Start brand scan", systemImage: "link")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(Self.brandPurple)
            .disabled(!appState.permissions.contains("lead_research.run")
                       && !appState.permissions.isEmpty)

            ResearchInfoCard(
                items: [
                    ("link", "URL eller orgnr"),
                    ("magnifyingglass", "Brreg + nettsider"),
                    ("sparkles", "Claude synthesis"),
                    ("mappin.and.ellipse", "Pin på kartet"),
                ],
            )
        }
    }

    // MARK: - Market scan segment

    @ViewBuilder
    private var marketScanSegment: some View {
        VStack(alignment: .leading, spacing: 14) {
            ResearchSegmentHeader(
                title: "Markedsskann",
                description: "Claude søker i markedet etter bedrifter som matcher en "
                + "bransje + region + målgruppe. Funnene plottes som pins (auto-import "
                + "kan slås av).",
                icon: ResearchSegment.marketScan.icon,
                tint: Self.brandPurple,
            )
            Button {
                marketScanSheetOpen = true
            } label: {
                Label("Ny markedsskann", systemImage: "chart.line.uptrend.xyaxis")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(Self.brandPurple)

            ResearchInfoCard(
                items: [
                    ("tag.fill", "Bransje + region"),
                    ("person.2.fill", "Målgruppe"),
                    ("magnifyingglass.circle", "Places + Brreg"),
                    ("mappin.and.ellipse", "Bulk-pin"),
                ],
            )

            if let api = appState.api {
                NavigationLink {
                    LeadgridMarketScanListView(api: api)
                } label: {
                    HStack {
                        Label("Mine markedsskan", systemImage: "list.bullet.rectangle")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .padding(14)
                    .background(Color(.secondarySystemBackground),
                                 in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Subcomponents

@MainActor
private struct ResearchSegmentHeader: View {
    let title: String
    let description: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(tint)
                Text(title).font(.title3.bold())
            }
            Text(description)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(tint.opacity(0.25), lineWidth: 1)
        )
    }
}

@MainActor
private struct ResearchInfoCard: View {
    let items: [(String, String)]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("HVA SKJER UNDER PANSER")
                .font(.caption2.bold())
                .tracking(0.6)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(spacing: 10) {
                        Image(systemName: item.0)
                            .frame(width: 22)
                            .foregroundStyle(.purple)
                        Text(item.1).font(.callout)
                        Spacer()
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
    }
}

// =====================================================================
// MARK: - "Finn leads"-segment — hovedflyt
// =====================================================================

@MainActor
private struct FindLeadsSegment: View {
    @Environment(AppState.self) private var appState

    @State private var count: Double = 20
    @State private var industryQuery: String = ""
    @State private var cityQuery: String = ""
    @State private var useCurrentLocation: Bool = false
    @State private var radiusKm: Double = 25
    @State private var isStarting = false
    @State private var errorText: String?
    @State private var startResponse: LeadDiscoveryStartResponse?
    @State private var resultDetail: LeadDiscoveryResultResponse?
    @State private var pollingTask: Task<Void, Never>?
    /// Hint vist i stage 1 ("fotograf i Oslo") — bygges fra inputs idet
    /// vi POST-er; persisteres på state slik at vi kan vise den i progress-
    /// kortet selv etter at config-form er borte.
    @State private var lastDiscoveryQueryHint: String?
    @State private var lastRadiusKmHint: Int?
    /// State-machine for stage-by-stage progress.
    @State private var discoveryState = DiscoveryRunState()

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            switch discoveryState.stage {
            case .idle:
                configForm
            case .starting, .foundCandidates, .processing, .finalizing,
                 .success, .failed:
                DiscoveryProgressView(
                    state: discoveryState,
                    discoveryQueryHint: lastDiscoveryQueryHint,
                    radiusKmHint: lastRadiusKmHint,
                    onCancel: { Task { await cancelBatch() } },
                    onShowOnMap: { showAllPinsOnMap() },
                    onImportMore: { resetForNewRun() },
                    onClose: { resetForNewRun() },
                )
                if let err = errorText {
                    Label(err, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
        .task(id: pollingTask?.hashValue) { /* trigger re-eval at onAppear */ }
    }

    // MARK: - Config form

    @ViewBuilder
    private var configForm: some View {
        let projectName = currentProjectName
        VStack(alignment: .leading, spacing: 14) {
            ResearchSegmentHeader(
                title: projectName != nil
                    ? "Finn nye leads for \(projectName!)"
                    : "Finn nye leads",
                description: projectName != nil
                    ? "Claude bruker prosjektets brand-kit + siste markedsskann som "
                      + "kontekst, og foreslår bedrifter som passer. Du kan overstyre "
                      + "bransje og by under."
                    : "Velg eller opprett et prosjekt først, slik at Claude kan bruke "
                      + "brand-kit og siste markedsskann som kontekst.",
                icon: "sparkles.rectangle.stack.fill",
                tint: Self.brandPurple,
            )

            if projectName == nil {
                Text("Du har ingen aktivt prosjekt. Bytt prosjekt fra Kart-fanen "
                     + "eller opprett ett først.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.orange.opacity(0.10),
                                 in: RoundedRectangle(cornerRadius: 12))
            } else {
                inputCard
                startButton
            }

            if let err = errorText {
                Label(err, systemImage: "exclamationmark.triangle.fill")
                    .font(.callout)
                    .foregroundStyle(.red)
                    .padding(.top, 4)
            }
        }
    }

    @ViewBuilder
    private var inputCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Antall
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Antall").font(.callout.weight(.semibold))
                    Spacer()
                    Text("\(Int(count)) leads")
                        .font(.callout.monospacedDigit())
                        .foregroundStyle(Self.brandPurple)
                }
                Slider(value: $count, in: 5...50, step: 5)
                    .tint(Self.brandPurple)
            }

            Divider()

            // Bransje (override)
            VStack(alignment: .leading, spacing: 6) {
                Text("Bransje (valgfritt)").font(.callout.weight(.semibold))
                TextField("f.eks. tannlege, regnskapsbyrå",
                          text: $industryQuery)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.sentences)
                Text("Tom = bruk prosjektets brand-kit / siste markedsskann.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Divider()

            // By + radius
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("By (valgfritt)").font(.callout.weight(.semibold))
                    Spacer()
                    Toggle("Bruk min posisjon", isOn: $useCurrentLocation)
                        .toggleStyle(.switch)
                        .tint(Self.brandPurple)
                        .labelsHidden()
                    Text("Bruk min posisjon")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if !useCurrentLocation {
                    TextField("f.eks. Bergen, Oslo sentrum",
                              text: $cityQuery)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.sentences)
                } else {
                    HStack {
                        Text("Radius").font(.callout)
                        Spacer()
                        Text("\(Int(radiusKm)) km")
                            .font(.callout.monospacedDigit())
                            .foregroundStyle(Self.brandPurple)
                    }
                    Slider(value: $radiusKm, in: 1...100, step: 1)
                        .tint(Self.brandPurple)
                }
            }
        }
        .padding(14)
        .background(Color(.secondarySystemBackground),
                     in: RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder
    private var startButton: some View {
        Button {
            Task { await startDiscovery() }
        } label: {
            HStack(spacing: 8) {
                if isStarting {
                    ProgressView()
                        .controlSize(.small)
                        .tint(.white)
                } else {
                    Image(systemName: "sparkles")
                }
                Text(isStarting ? "Starter …" : "Start research")
                    .font(.headline)
            }
            .frame(maxWidth: .infinity, minHeight: 50)
        }
        .buttonStyle(.borderedProminent)
        .tint(Self.brandPurple)
        .disabled(isStarting || appState.activeProjectId == nil)
    }

    // MARK: - Helpers

    private var currentProjectName: String? {
        guard let id = appState.activeProjectId else { return nil }
        return appState.projects.first(where: { $0.id == id })?.name
    }

    // MARK: - Actions

    @MainActor
    private func startDiscovery() async {
        errorText = nil
        guard let api = appState.api else {
            errorText = "Ikke innlogget."
            return
        }
        guard let projectId = appState.activeProjectId else {
            errorText = "Velg et prosjekt først."
            return
        }
        var request = LeadDiscoveryRequest()
        request.count = Int(count)
        if !industryQuery.trimmingCharacters(in: .whitespaces).isEmpty {
            request.industryQuery = industryQuery
        }
        if useCurrentLocation,
           let loc = LocationService.shared.currentLocation {
            request.geo = LeadDiscoveryGeo(
                lat: loc.coordinate.latitude,
                lng: loc.coordinate.longitude,
                radiusKm: Int(radiusKm),
            )
        } else if !cityQuery.trimmingCharacters(in: .whitespaces).isEmpty {
            request.city = cityQuery
        }

        // Build stage 1-hint ("fotograf i Oslo") for DiscoveryProgressView
        lastDiscoveryQueryHint = buildQueryHint(request: request)
        lastRadiusKmHint = useCurrentLocation ? Int(radiusKm) : nil

        // Initialize state-machine — stage = .starting, startedAt set.
        discoveryState.begin(projectName: currentProjectName)

        isStarting = true
        defer { isStarting = false }
        do {
            let resp = try await api.discoverLeadsForProject(
                projectId: projectId,
                request: request,
            )
            startResponse = resp
            discoveryState.projectName = resp.projectName ?? currentProjectName
            if let bid = resp.batchId, resp.foundCount > 0 {
                discoveryState.batchId = bid
                discoveryState.total = resp.foundCount
                discoveryState.stage = .foundCandidates(resp.foundCount)
                startPolling(projectId: projectId, batchId: bid)
            } else {
                // foundCount==0 — vis tom hero ("ingen nye …"); brukeren
                // kan kjøre på nytt m/ annen query.
                discoveryState.stage = .success(
                    DiscoverySuccessSummary(
                        totalPinned: 0,
                        totalAttempted: 0,
                        breakdown: .zero,
                        totalDurationSeconds: discoveryState.elapsedSeconds,
                        projectName: discoveryState.projectName,
                    )
                )
            }
        } catch {
            let msg = error.localizedDescription
            errorText = "Kunne ikke starte: \(msg)"
            discoveryState.stage = .failed(msg)
        }
    }

    /// Bygg stage 1-hint som "fotograf i Oslo". Foretrekker industry+city;
    /// faller tilbake til "kandidater" hvis ingen er gitt.
    private func buildQueryHint(request: LeadDiscoveryRequest) -> String? {
        let industry = request.industryQuery?
            .trimmingCharacters(in: .whitespaces) ?? ""
        var locationStr = ""
        if let c = request.city?.trimmingCharacters(in: .whitespaces), !c.isEmpty {
            locationStr = c
        } else if request.geo != nil {
            locationStr = "min posisjon"
        }
        switch (industry.isEmpty, locationStr.isEmpty) {
        case (false, false): return "\(industry) i \(locationStr)"
        case (false, true):  return industry
        case (true, false):  return "bedrifter i \(locationStr)"
        case (true, true):   return nil
        }
    }

    private func startPolling(projectId: String, batchId: String) {
        pollingTask?.cancel()
        pollingTask = Task { @MainActor in
            while !Task.isCancelled {
                guard let api = appState.api else { return }
                do {
                    // Hent lett-vekt progress + full detail (m/ per-item-status).
                    let p = try await api.pollBulkUrlResearchProgress(batchId: batchId)
                    discoveryState.completed = p.progress.completed
                    discoveryState.failed = p.progress.failed
                    discoveryState.pinned = p.progress.pinned
                    discoveryState.total = p.progress.total

                    // Periodisk fetch av full detail for per-URL-listen.
                    // Hent kun hvis status fortsatt aktiv (én siste hentes
                    // i finish-blokken under). Soft-fail på error.
                    if p.status.isActive {
                        do {
                            let d = try await api.fetchBulkUrlResearchBatch(
                                batchId: batchId,
                            )
                            discoveryState.items = d.items
                        } catch {
                            // Stille — vi har counters fra progress.
                        }
                    }

                    // Bytt stage etter hva backend rapporterer.
                    if p.status.isActive {
                        let done = p.progress.completed + p.progress.failed
                        if done > 0 || !discoveryState.items.isEmpty {
                            discoveryState.stage = .processing
                        }
                    } else {
                        // Ferdig — hent full breakdown.
                        discoveryState.stage = .finalizing
                        let result = try? await api.fetchLeadDiscoveryResult(
                            projectId: projectId,
                            batchId: batchId,
                        )
                        resultDetail = result

                        // Forsøk å hente siste items-snapshot også.
                        if let d = try? await api.fetchBulkUrlResearchBatch(
                            batchId: batchId,
                        ) {
                            discoveryState.items = d.items
                        }

                        let breakdown = result.map {
                            DiscoveryConfidenceBreakdown(
                                exact: $0.breakdown.exact,
                                geocoded: $0.breakdown.geocoded,
                                approximate: $0.breakdown.approximate,
                                unknown: $0.breakdown.unknown,
                                failed: $0.breakdown.failed,
                            )
                        } ?? .zero

                        let summary = DiscoverySuccessSummary(
                            totalPinned: p.progress.pinned,
                            totalAttempted: p.progress.total,
                            breakdown: breakdown,
                            totalDurationSeconds: discoveryState.elapsedSeconds,
                            projectName: discoveryState.projectName,
                        )
                        discoveryState.stage = .success(summary)

                        // Trigger en bakgrunns-refresh så MapScreen får
                        // de nye pins-ene synlige uten å vente på user.
                        Task { await appState.refreshAll() }
                        return
                    }
                } catch {
                    // Tolerer transient feil — vent 5s og prøv igjen.
                    errorText = "Poll-feil: \(error.localizedDescription)"
                    try? await Task.sleep(nanoseconds: 5_000_000_000)
                    continue
                }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    private func cancelBatch() async {
        guard let api = appState.api, let batchId = discoveryState.batchId else {
            resetForNewRun()
            return
        }
        do {
            try await api.cancelBulkUrlBatch(batchId: batchId)
            pollingTask?.cancel()
            pollingTask = nil
            resetForNewRun()
        } catch {
            errorText = "Avbryt feilet: \(error.localizedDescription)"
        }
    }

    private func showAllPinsOnMap() {
        // Bygg liste over koordinater fra resultatet
        guard let r = resultDetail else {
            switchToMapTab()
            return
        }
        // resultDetail har items + breakdown, men ikke lat/lng direkte.
        // Vi har crm_customers-ID-er for de pinned-items. Slå dem opp
        // mot appState.leads (etter refreshAll har lagt dem inn).
        let pinnedLeadIds = Set(r.items
            .filter { $0.hasPin && $0.status == .completed }
            .compactMap { $0.draftLeadId }
        )
        let coords: [(Double, Double)] = appState.leads
            .filter { pinnedLeadIds.contains($0.id) }
            .map { ($0.latitude, $0.longitude) }

        if coords.isEmpty {
            switchToMapTab()
            return
        }
        let userInfo: [String: Any] = [
            "coordinates": coords.map { ["lat": $0.0, "lng": $0.1] },
            "batch_id": discoveryState.batchId ?? "",
        ]
        NotificationCenter.default.post(
            name: .leadgridBulkUrlBatchZoomToBounds,
            object: nil,
            userInfo: userInfo,
        )
        switchToMapTab()
    }

    private func switchToMapTab() {
        // Bytt til Kart-fanen via NotificationCenter — RootView (MainTabView)
        // har ikke en delt TabView-selection, så vi bruker en notification
        // som MapScreen / MainTabView kan lytte på i framtidige PR-er.
        NotificationCenter.default.post(name: .leadgridSwitchToMapTab, object: nil)
    }

    /// Tilbakestill alt state slik at "Finn leads"-config-formen vises igjen.
    /// Brukes av "Importer flere", "Lukk" og "Avbryt" — alle reset'er til
    /// .idle slik at view-en re-rendrer config-form.
    private func resetForNewRun() {
        pollingTask?.cancel()
        pollingTask = nil
        discoveryState.reset()
        startResponse = nil
        resultDetail = nil
        errorText = nil
        lastDiscoveryQueryHint = nil
        lastRadiusKmHint = nil
    }
}

// MARK: - Notification names

extension Notification.Name {
    /// Posted av Research-fanen når brukeren trykker "Vis alle på kartet".
    /// MainTabView lytter (i fremtidige PR-er) på dette og bytter selection
    /// til Kart-fanen. Foreløpig er handlingen et hint; brukeren kan også
    /// bytte fane manuelt.
    static let leadgridSwitchToMapTab = Notification.Name(
        "LeadMapApp.leadgridSwitchToMapTab"
    )
}
