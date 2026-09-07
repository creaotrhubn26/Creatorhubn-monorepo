import SwiftUI

struct DiscoveryMarketingInsightsView: View {
    let api: APIClient?
    let projectId: String
    let runId: String
    let canGenerate: Bool
    let canReview: Bool

    @State private var report: DiscoveryMarketingReport?
    @State private var isLoading = false
    @State private var isGenerating = false
    @State private var busyInsightIds: Set<String> = []
    @State private var errorMessage: String?
    @State private var hasLoaded = false
    @State private var correctionDraft: CorrectionDraft?

    var body: some View {
        ScrollView {
            Group {
                if isLoading && !hasLoaded {
                    loadingState
                } else if let report {
                    reportView(report)
                } else {
                    emptyState
                }
            }
            .frame(maxWidth: 920)
            .padding(20)
            .frame(maxWidth: .infinity)
        }
        .background(LeadgridDiscoveryTheme.background)
        .task(id: runId) { await load() }
        .sheet(item: $correctionDraft) { draft in
            DiscoveryInsightCorrectionSheet(draft: draft) { correction, note in
                correctionDraft = nil
                Task {
                    await review(
                        draft.insight,
                        decision: "correct",
                        reason: "marketer_correction",
                        note: note,
                        correction: correction)
                }
            }
            .presentationDetents([.large])
        }
    }

    private var loadingState: some View {
        VStack(spacing: 14) {
            ProgressView()
            Text("Henter markedsinnsikt …")
                .font(.headline)
            Text("Rapporten er knyttet til denne Discovery-kjøringen.")
                .font(.caption)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .discoverySurface()
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.xyaxis.line")
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
            Text("Gjør kandidatene om til markedsinnsikt")
                .font(.title3.bold())
                .multilineTextAlignment(.center)
            Text("Leadgrid analyserer dokumenterte mønstre i målgruppe, bransje, geografi og ICP-match. Fakta, analyse og hypoteser vises separat.")
                .font(.subheadline)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 560)
            if let errorMessage {
                errorLabel(errorMessage)
            }
            if canGenerate {
                Button {
                    Task { await generate() }
                } label: {
                    Label(
                        isGenerating ? "Bygger rapport …" : "Bygg markedsinnsikt",
                        systemImage: "sparkles")
                        .frame(maxWidth: 320)
                }
                .buttonStyle(.borderedProminent)
                .tint(LeadgridDiscoveryTheme.accent)
                .disabled(isGenerating)
                .accessibilityIdentifier("discovery.marketing.generate")
            } else {
                Text("Du har lesetilgang, men mangler tillatelse til å generere rapporten.")
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 38)
        .discoverySurface()
    }

    @ViewBuilder
    private func reportView(_ report: DiscoveryMarketingReport) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            reportHeader(report)
            if let errorMessage {
                errorLabel(errorMessage)
            }
            switch report.status {
            case .insufficientEvidence:
                insufficientEvidence(report)
            case .failed:
                failedReport(report)
            case .generating:
                loadingState
            case .ready:
                if !report.gaps.isEmpty || !report.conflicts.isEmpty {
                    limitsCard(report)
                }
                ForEach(report.insights) { insight in
                    insightCard(insight, report: report)
                }
            }
        }
    }

    private func reportHeader(_ report: DiscoveryMarketingReport) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 16) {
                    reportIdentity(report)
                    Spacer(minLength: 20)
                    reportMetrics(report)
                }
                VStack(alignment: .leading, spacing: 14) {
                    reportIdentity(report)
                    reportMetrics(report)
                }
            }
            if let summary = report.executiveSummary {
                Text(summary)
                    .font(.body)
                    .foregroundStyle(.primary)
            }
            if canGenerate && report.status != .generating {
                Button {
                    Task { await generate() }
                } label: {
                    Label(
                        isGenerating ? "Oppdaterer …" : "Bygg ny versjon",
                        systemImage: "arrow.triangle.2.circlepath")
                }
                .buttonStyle(.bordered)
                .disabled(isGenerating)
            }
        }
        .discoverySurface()
    }

    private func reportIdentity(_ report: DiscoveryMarketingReport) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Label("Markedsinnsikt", systemImage: "chart.xyaxis.line")
                .font(.title3.bold())
                .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
            Text("Skill \(report.skillKey) · v\(report.skillVersion)")
                .font(.caption2.monospaced())
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            Text("Ingen kandidat- eller kundedata sendes til en ekstern AI-tjeneste.")
                .font(.caption)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
    }

    private func reportMetrics(_ report: DiscoveryMarketingReport) -> some View {
        HStack(spacing: 10) {
            metric("Evidens", percentage(report.evidenceCoverage))
            metric("Tillit", percentage(report.overallConfidence))
            metric("Kilder", "\(report.sourceCount)")
        }
    }

    private func metric(_ title: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(value).font(.headline.monospacedDigit())
            Text(title)
                .font(.caption2)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
    }

    private func insufficientEvidence(_ report: DiscoveryMarketingReport) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Ikke nok evidens til forsvarlige råd", systemImage: "exclamationmark.shield")
                .font(.headline)
                .foregroundStyle(LeadgridDiscoveryTheme.warning)
            Text("Leadgrid stoppet analysen i stedet for å fylle tomrommene med antakelser.")
                .font(.subheadline)
            ForEach(report.gaps, id: \.self) { gap in
                Label(gap, systemImage: "circle.dashed")
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
            Text("Kjør Discovery med flere kandidater. Når nettsidekvalitet er aktivert, kan du også øke taket for hvor mange Brreg-registrerte nettsider som vurderes.")
                .font(.caption)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
        .discoverySurface()
    }

    private func failedReport(_ report: DiscoveryMarketingReport) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Rapporten feilet", systemImage: "exclamationmark.triangle.fill")
                .font(.headline)
                .foregroundStyle(LeadgridDiscoveryTheme.danger)
            Text(report.errorMessage ?? "Rapporten kunne ikke bygges.")
                .font(.subheadline)
        }
        .discoverySurface()
    }

    private func limitsCard(_ report: DiscoveryMarketingReport) -> some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(report.gaps, id: \.self) { gap in
                    Label(gap, systemImage: "circle.dashed")
                }
                ForEach(report.conflicts, id: \.self) { conflict in
                    Label(conflict, systemImage: "arrow.left.arrow.right")
                }
            }
            .font(.caption)
            .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            .padding(.top, 8)
        } label: {
            Label("Datagap og motstridende signaler", systemImage: "exclamationmark.bubble")
                .font(.headline)
        }
        .discoverySurface()
    }

    private func insightCard(
        _ insight: DiscoveryMarketingInsight,
        report: DiscoveryMarketingReport
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 12) {
                    insightTitle(insight)
                    Spacer(minLength: 12)
                    confidenceBadge(insight)
                }
                VStack(alignment: .leading, spacing: 10) {
                    insightTitle(insight)
                    confidenceBadge(insight)
                }
            }
            Text(insight.finding).font(.body)
            section("Hvorfor dette er relevant", insight.relevance)
            section("Anbefalt handling", insight.recommendedAction)
            if let experiment = insight.experiment {
                experimentCard(experiment)
            }
            evidenceDisclosure(insight, report: report)
            if !insight.counterEvidence.isEmpty {
                DisclosureGroup("Hva som kan svekke funnet") {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(insight.counterEvidence, id: \.self) { item in
                            Text("• \(item)")
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                    .padding(.top, 6)
                }
                .font(.caption.bold())
            }
            reviewControls(insight)
        }
        .discoverySurface()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("discovery.marketing.insight.\(insight.id)")
    }

    private func insightTitle(_ insight: DiscoveryMarketingInsight) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 7) {
                Text(categoryTitle(insight.category))
                    .font(.caption.bold())
                    .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
                Text(claimTitle(insight.claimType))
                    .font(.caption2.bold())
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(claimColor(insight.claimType).opacity(0.18), in: Capsule())
                    .foregroundStyle(claimColor(insight.claimType))
            }
            Text(insight.title).font(.headline)
        }
    }

    private func confidenceBadge(_ insight: DiscoveryMarketingInsight) -> some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text("Tillit \(percentage(insight.confidence))")
                .font(.caption.bold().monospacedDigit())
            ProgressView(value: insight.confidence)
                .tint(claimColor(insight.claimType))
                .frame(width: 110)
        }
        .accessibilityElement(children: .combine)
    }

    private func section(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption.bold())
            Text(body)
                .font(.subheadline)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
    }

    private func experimentCard(_ experiment: DiscoveryMarketingExperiment) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Målbar test", systemImage: "flask.fill")
                .font(.subheadline.bold())
                .foregroundStyle(LeadgridDiscoveryTheme.accentSoft)
            Text(experiment.hypothesis).font(.subheadline)
            Text(experiment.action)
                .font(.caption)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 14) {
                    testMetric("Metrikk", experiment.metric)
                    testMetric("Mål", experiment.successCriterion)
                    testMetric("Varighet", "\(experiment.durationDays) dager")
                }
                VStack(alignment: .leading, spacing: 6) {
                    testMetric("Metrikk", experiment.metric)
                    testMetric("Mål", experiment.successCriterion)
                    testMetric("Varighet", "\(experiment.durationDays) dager")
                }
            }
        }
        .padding(12)
        .background(LeadgridDiscoveryTheme.accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }

    private func testMetric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            Text(value).font(.caption.bold())
        }
    }

    private func evidenceDisclosure(
        _ insight: DiscoveryMarketingInsight,
        report: DiscoveryMarketingReport
    ) -> some View {
        let evidence = report.evidenceCatalog.filter {
            insight.evidenceReferences.contains($0.id)
        }
        return DisclosureGroup {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(evidence) { item in
                    VStack(alignment: .leading, spacing: 3) {
                        Text("\(item.id) · \(item.label)")
                            .font(.caption.bold())
                        Text(item.value).font(.caption)
                        HStack {
                            Text(item.source)
                            if let rawURL = item.sourceURI,
                               let url = URL(string: rawURL),
                               ["https", "http"].contains(url.scheme?.lowercased() ?? "")
                            {
                                Link("Åpne kilde", destination: url)
                            }
                        }
                        .font(.caption2)
                        .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                    }
                }
            }
            .padding(.top, 8)
        } label: {
            Label("Evidens (\(evidence.count))", systemImage: "checkmark.seal")
                .font(.caption.bold())
        }
    }

    @ViewBuilder
    private func reviewControls(_ insight: DiscoveryMarketingInsight) -> some View {
        Divider().overlay(LeadgridDiscoveryTheme.stroke)
        if insight.reviewStatus != "pending" {
            Label(reviewTitle(insight.reviewStatus), systemImage: reviewIcon(insight.reviewStatus))
                .font(.caption.bold())
                .foregroundStyle(reviewColor(insight.reviewStatus))
        }
        if canReview {
            ViewThatFits(in: .horizontal) {
                HStack {
                    reviewButtons(insight)
                }
                VStack(alignment: .leading, spacing: 8) {
                    reviewButtons(insight)
                }
            }
            .disabled(busyInsightIds.contains(insight.id))
        }
    }

    @ViewBuilder
    private func reviewButtons(_ insight: DiscoveryMarketingInsight) -> some View {
        Button("Godkjenn") {
            Task { await review(insight, decision: "accept", reason: "useful") }
        }
        .buttonStyle(.borderedProminent)
        .tint(LeadgridDiscoveryTheme.success)
        Button("Korriger") {
            correctionDraft = CorrectionDraft(insight: insight)
        }
        .buttonStyle(.bordered)
        Button("Avvis", role: .destructive) {
            Task { await review(insight, decision: "reject", reason: "not_useful") }
        }
        .buttonStyle(.bordered)
    }

    private func errorLabel(_ message: String) -> some View {
        Label(message, systemImage: "exclamationmark.triangle.fill")
            .font(.caption)
            .foregroundStyle(LeadgridDiscoveryTheme.warning)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LeadgridDiscoveryTheme.warning.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
    }

    @MainActor
    private func load() async {
        guard !isLoading else { return }
        guard let api else {
            errorMessage = "API-klienten er ikke klar."
            hasLoaded = true
            return
        }
        isLoading = true
        defer {
            isLoading = false
            hasLoaded = true
        }
        do {
            report = try await api.fetchDiscoveryMarketingIntelligence(
                projectId: projectId,
                runId: runId)
            errorMessage = nil
        } catch let error as DiscoveryV2ServiceError where error.code == "not_found" {
            report = nil
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func generate() async {
        guard !isGenerating, let api else { return }
        isGenerating = true
        errorMessage = nil
        defer { isGenerating = false }
        do {
            report = try await api.generateDiscoveryMarketingIntelligence(
                projectId: projectId,
                runId: runId,
                idempotencyKey: UUID().uuidString)
            hasLoaded = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func review(
        _ insight: DiscoveryMarketingInsight,
        decision: String,
        reason: String,
        note: String? = nil,
        correction: DiscoveryMarketingInsightCorrection? = nil
    ) async {
        guard let api, var currentReport = report else { return }
        guard !busyInsightIds.contains(insight.id) else { return }
        busyInsightIds.insert(insight.id)
        errorMessage = nil
        defer { busyInsightIds.remove(insight.id) }
        do {
            let updated = try await api.reviewDiscoveryMarketingInsight(
                projectId: projectId,
                runId: runId,
                reportId: currentReport.id,
                insightId: insight.id,
                request: .init(
                    decision: decision,
                    reasonCode: reason,
                    note: note,
                    correction: correction),
                idempotencyKey: UUID().uuidString)
            if let index = currentReport.insights.firstIndex(where: { $0.id == updated.id }) {
                currentReport.insights[index] = updated
                report = currentReport
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func percentage(_ value: Double) -> String {
        "\(Int((min(1, max(0, value)) * 100).rounded())) %"
    }

    private func claimTitle(_ value: String) -> String {
        switch value {
        case "fact": "Fakta"
        case "inference": "Analyse"
        default: "Hypotese"
        }
    }

    private func claimColor(_ value: String) -> Color {
        switch value {
        case "fact": LeadgridDiscoveryTheme.success
        case "inference": LeadgridDiscoveryTheme.accentSoft
        default: LeadgridDiscoveryTheme.warning
        }
    }

    private func categoryTitle(_ value: String) -> String {
        switch value {
        case "competition": "Konkurranse"
        case "audience": "Målgruppe"
        case "positioning": "Posisjonering"
        case "messaging": "Budskap"
        case "channels": "Kanaler"
        case "opportunity": "Mulighet"
        case "risk": "Risiko"
        case "experiment": "Eksperiment"
        case "win_loss": "Vunnet/tapt"
        default: value.capitalized
        }
    }

    private func reviewTitle(_ value: String) -> String {
        switch value {
        case "accepted": "Godkjent av markedsfører"
        case "rejected": "Avvist av markedsfører"
        case "corrected": "Korrigert av markedsfører"
        default: "Ikke vurdert"
        }
    }

    private func reviewIcon(_ value: String) -> String {
        switch value {
        case "accepted": "checkmark.circle.fill"
        case "rejected": "xmark.circle.fill"
        case "corrected": "pencil.circle.fill"
        default: "circle"
        }
    }

    private func reviewColor(_ value: String) -> Color {
        value == "rejected" ? LeadgridDiscoveryTheme.danger : LeadgridDiscoveryTheme.success
    }
}

private struct CorrectionDraft: Identifiable {
    let insight: DiscoveryMarketingInsight
    var id: String { insight.id }
}

private struct DiscoveryInsightCorrectionSheet: View {
    let draft: CorrectionDraft
    let onSave: (DiscoveryMarketingInsightCorrection, String?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var finding: String
    @State private var relevance: String
    @State private var action: String
    @State private var note = ""

    init(
        draft: CorrectionDraft,
        onSave: @escaping (DiscoveryMarketingInsightCorrection, String?) -> Void
    ) {
        self.draft = draft
        self.onSave = onSave
        _title = State(initialValue: draft.insight.title)
        _finding = State(initialValue: draft.insight.finding)
        _relevance = State(initialValue: draft.insight.relevance)
        _action = State(initialValue: draft.insight.recommendedAction)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Korrigert innsikt") {
                    TextField("Tittel", text: $title)
                    TextEditor(text: $finding).frame(minHeight: 100)
                }
                Section("Betydning og handling") {
                    TextEditor(text: $relevance).frame(minHeight: 90)
                    TextEditor(text: $action).frame(minHeight: 90)
                }
                Section("Hvorfor ble dette korrigert?") {
                    TextEditor(text: $note).frame(minHeight: 80)
                }
            }
            .navigationTitle("Korriger innsikt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        onSave(
                            .init(
                                title: title,
                                finding: finding,
                                relevance: relevance,
                                recommendedAction: action),
                            note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? nil
                                : note)
                    }
                    .disabled(
                        title.trimmingCharacters(in: .whitespacesAndNewlines).count < 3
                            || finding.trimmingCharacters(in: .whitespacesAndNewlines).count < 10
                            || relevance.trimmingCharacters(in: .whitespacesAndNewlines).count < 10
                            || action.trimmingCharacters(in: .whitespacesAndNewlines).count < 10)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
