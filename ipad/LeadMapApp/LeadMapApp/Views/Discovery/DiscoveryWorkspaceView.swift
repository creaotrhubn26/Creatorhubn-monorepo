// DiscoveryWorkspaceView.swift

import SwiftUI

struct DiscoveryWorkspaceView: View {
    @Bindable var coordinator: DiscoveryRunCoordinator
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dismiss) private var dismiss
    @State private var rejectingCandidate: DiscoveryV2Candidate?
    @State private var rejectionReason: DiscoveryV2ReasonCode = .notRelevant

    var body: some View {
        NavigationStack {
            Group {
                switch coordinator.phase {
                case .brief: briefView
                case .preview: previewView
                case .running: runningView
                case .review: reviewView
                case .completed: completedView
                }
            }
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
                if coordinator.phase == .brief {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Lagre som standard") {
                            Task { await coordinator.saveDefaultProfile() }
                        }
                        .disabled(coordinator.brief.validationMessage != nil || coordinator.isBusy)
                        .accessibilityIdentifier("discovery.profile.save")
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
    }

    private var navigationTitle: String {
        switch coordinator.phase {
        case .brief: "Hvem vil du finne?"
        case .preview: "Se planen før du starter"
        case .running: "Discovery arbeider"
        case .review: "Vurder kandidater"
        case .completed: "Discovery fullført"
        }
    }

    private var briefView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                introCard
                fieldSection("Kundetyper", detail: "Én per linje. Bruk konkrete beskrivelser markedet selv bruker.") {
                    TextEditor(text: industryQueriesBinding)
                        .frame(minHeight: 96)
                        .scrollContentBackground(.hidden)
                        .padding(10)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
                        .accessibilityLabel("Kundetyper")
                        .accessibilityIdentifier("discovery.brief.queries")
                }
                fieldSection("Område", detail: "Et kartområde håndheves som en faktisk radius. By gir et bredere tekstsøk.") {
                    Picker("Område", selection: usesMapAreaBinding) {
                        Text("Synlig kartområde").tag(true)
                        Text("By").tag(false)
                    }
                    .pickerStyle(.segmented)
                    if coordinator.brief.geo != nil {
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
                    } else {
                        TextField("For eksempel Oslo", text: cityBinding)
                            .textFieldStyle(.roundedBorder)
                            .accessibilityIdentifier("discovery.brief.city")
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
                countsCard

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

    private var countsCard: some View {
        VStack(spacing: 14) {
            countRow(
                title: "Kandidater",
                detail: "Hvor mange markedstreff som skal samles",
                value: $coordinator.brief.targetCount,
                range: 1...60)
            Divider().overlay(LeadgridDiscoveryTheme.stroke)
            countRow(
                title: "Undersøk grundig",
                detail: "Foretaksinfo og dokumentert match",
                value: enrichmentCountBinding,
                range: 1...coordinator.brief.targetCount)
        }
        .discoverySurface()
    }

    private var previewView: some View {
        ScrollView {
            if let preview = coordinator.preview {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        metric("Treff", "\(preview.plan.requestedCandidates)")
                        metric("Undersøkes", "\(preview.plan.enrichmentCandidates)")
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
                    Text("\(coordinator.candidates.count) kandidater klare")
                        .font(.headline)
                    Text("Match og datakvalitet vises separat – svak dokumentasjon blir aldri fremstilt som fakta.")
                        .font(.caption)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                }
                Spacer()
            }
            .padding()
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
                    ForEach(coordinator.candidates) { candidate in
                        DiscoveryCandidateRow(
                            candidate: candidate,
                            selected: coordinator.selectedCandidateIds.contains(candidate.id),
                            busy: coordinator.busyCandidateIds.contains(candidate.id),
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

    private var completedView: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: coordinator.run?.status == .failed ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(coordinator.run?.status == .failed ? LeadgridDiscoveryTheme.danger : LeadgridDiscoveryTheme.success)
            Text(coordinator.bannerTitle).font(.title2.bold())
            Text(coordinator.bannerDetail).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
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

    private func countRow(title: String, detail: String, value: Binding<Int>, range: ClosedRange<Int>) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.bold())
                Text(detail).font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
            Spacer()
            Stepper("\(value.wrappedValue)", value: value, in: range)
                .fixedSize()
                .accessibilityLabel(title)
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

    private var exclusionsBinding: Binding<String> {
        Binding(
            get: { coordinator.brief.exclusionTerms.joined(separator: ", ") },
            set: { coordinator.brief.exclusionTerms = $0.split(separator: ",").map(String.init) })
    }

    private var cityBinding: Binding<String> {
        Binding(get: { coordinator.brief.city ?? "" }, set: { coordinator.brief.city = $0 })
    }

    private var usesMapAreaBinding: Binding<Bool> {
        Binding(
            get: { coordinator.brief.geo != nil },
            set: { usesMap in
                if usesMap {
                    coordinator.brief.geo = coordinator.brief.geo
                        ?? .init(latitude: 59.9139, longitude: 10.7522, radiusKm: 10)
                    coordinator.brief.city = nil
                } else {
                    coordinator.brief.geo = nil
                    coordinator.brief.city = coordinator.brief.city ?? ""
                }
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

    private func optionalTextBinding(_ keyPath: WritableKeyPath<DiscoveryV2Brief, String?>) -> Binding<String> {
        Binding(
            get: { coordinator.brief[keyPath: keyPath] ?? "" },
            set: { coordinator.brief[keyPath: keyPath] = $0 })
    }
}

struct DiscoveryCandidateRow: View {
    let candidate: DiscoveryV2Candidate
    let selected: Bool
    let busy: Bool
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
            if let reasons = candidate.reasons, !reasons.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Hvorfor denne kandidaten").font(.caption.bold())
                    ForEach(reasons, id: \.self) { Text("• \($0)").font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText) }
                }
            } else if candidate.fitScore == nil {
                Label("Ikke nok dokumentasjon til å beregne match", systemImage: "questionmark.circle")
                    .font(.caption).foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
            HStack {
                Spacer()
                Button("Avvis", role: .destructive, action: onReject).buttonStyle(.bordered)
                Button("Godkjenn", action: onApprove)
                    .buttonStyle(.borderedProminent)
                    .tint(LeadgridDiscoveryTheme.success)
            }
            .disabled(busy)
        }
        .discoverySurface()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("discovery.candidate.\(candidate.id)")
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
    }
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
