// PondusStore.swift
//
// Backend-backed observable store for Leadgrid Pondus-maler.
//
// Bruk:
//   @State private var pondusStore = PondusStore()
//   .task { await pondusStore.load(api: appState.api) }
//
// Store-en holder både publiserte og utkast (utkast kun tilgjengelig
// hvis SuperAdmin — backend håndhever). Views filtrer på isPublished
// for empty-state vs. innhold.

import SwiftUI

@MainActor
@Observable
final class PondusStore {
    // Rå templates fra backend (siste hentede).
    private(set) var templates: [PondusTemplateDTO] = []
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?
    private(set) var lastLoadedAt: Date?
    private var organizationId: String?

    init() {}

    #if DEBUG
    /// Deterministisk live-lik fixture for UI-test. Den bruker samme DTO og
    /// samme coach som produksjon, men opprettes bare ved eksplisitt QA_TOUR.
    func seedForQACoach(organizationId: UUID) {
        self.organizationId = organizationId.uuidString.lowercased()
        templates = [PondusTemplateDTO(
            id: UUID(uuidString: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")!,
            name: "QA møteåpning",
            description: "Verifiserer den kanoniske Pondus-coachen.",
            category: PondusCategory.meetingOpen,
            kind: PondusKind.telephone.rawValue,
            score: 84,
            steps: [
                PondusStepDTO(id: "purpose", title: "Sett retning", prompt: "Forklar formålet kort.", order: 0),
                PondusStepDTO(id: "need", title: "Avdekk behov", prompt: "Still ett åpent spørsmål.", order: 1),
            ],
            objections: [],
            analysis: PondusAnalysisDTO(authority: 86, clarity: 84, trust: 82, safety: 83, momentum: 85),
            analysisMeta: PondusAnalysisMetaDTO(
                rubricVersion: "pondus-rubric-2026-09-1",
                confidence: 0.9,
                evidence: ["clarity": ["To konkrete steg"]],
                recommendations: ["Avtal et tydelig neste steg."]
            ),
            createdBy: "qa",
            orgId: organizationId,
            isPublished: true,
            publishedAt: "2026-09-03T00:00:00Z",
            publishedBy: "qa",
            version: 2,
            archivedAt: nil,
            createdAt: "2026-09-03T00:00:00Z",
            updatedAt: "2026-09-03T00:00:00Z"
        )]
    }
    #endif

    // MARK: - Filter helpers

    /// Publiserte maler.
    var published: [PondusTemplateDTO] {
        templates.filter { $0.isPublished }
    }

    /// Utkast (SuperAdmin ser disse).
    var drafts: [PondusTemplateDTO] {
        templates.filter { !$0.isPublished }
    }

    // MARK: - Load

    /// Last inn alle Pondus-maler synlig for gjeldende session. Kaller
    /// backend med `published=all` slik at SuperAdmin også ser utkast;
    /// backend håndhever filter for vanlige brukere uansett.
    func load(
        api: APIClient?,
        organizationId: String? = nil,
        includeDrafts: Bool = true
    ) async {
        if self.organizationId != organizationId {
            resetForOrganization(organizationId)
        }
        guard let api else {
            lastError = "no_api_client"
            return
        }
        isLoading = true
        let requestedOrganizationId = organizationId
        do {
            let list = try await api.pondusListTemplates(
                category: nil,
                kind: nil,
                publishedOnly: !includeDrafts,
                organizationId: organizationId
            )
            guard requestedOrganizationId == self.organizationId else { return }
            self.isLoading = false
            self.templates = list
            self.lastLoadedAt = Date()
            self.lastError = nil
            // Push til Apple Watch (Pondus overalt — trinn 1).
            // Trimmer til topp 8 publiserte maler.
            PondusWatchSync.shared.pushTemplatesToWatch(list.filter { $0.isPublished })
        } catch {
            guard requestedOrganizationId == self.organizationId else { return }
            self.isLoading = false
            self.lastError = String(describing: error)
        }
    }

    func resetForOrganization(_ newOrganizationId: String?) {
        organizationId = newOrganizationId
        templates = []
        isLoading = false
        lastError = nil
        lastLoadedAt = nil
    }

    func resetForSignOut() {
        organizationId = nil
        templates = []
        isLoading = false
        lastError = nil
        lastLoadedAt = nil
    }

    // MARK: - Mutations (SuperAdmin only — backend returnerer 403 hvis ikke)

    @discardableResult
    func create(_ payload: CreatePondusTemplatePayload, api: APIClient?) async -> PondusTemplateDTO? {
        guard let api else { return nil }
        do {
            let created = try await api.pondusCreateTemplate(
                payload,
                organizationId: organizationId
            )
            templates.insert(created, at: 0)
            return created
        } catch {
            lastError = String(describing: error)
            return nil
        }
    }

    @discardableResult
    func update(id: UUID, _ payload: UpdatePondusTemplatePayload, api: APIClient?) async -> PondusTemplateDTO? {
        guard let api else { return nil }
        do {
            var versionedPayload = payload
            if versionedPayload.expectedVersion == nil {
                versionedPayload.expectedVersion = templates.first(where: { $0.id == id })?.version
            }
            let updated = try await api.pondusUpdateTemplate(
                id: id.uuidString.lowercased(),
                versionedPayload,
                organizationId: organizationId
            )
            replace(updated)
            return updated
        } catch {
            lastError = String(describing: error)
            return nil
        }
    }

    @discardableResult
    func publish(id: UUID, published: Bool, api: APIClient?) async -> PondusTemplateDTO? {
        guard let api else { return nil }
        do {
            let updated = try await api.pondusPublishTemplate(
                id: id.uuidString.lowercased(),
                published: published,
                expectedVersion: templates.first(where: { $0.id == id })?.version ?? 1,
                organizationId: organizationId
            )
            replace(updated)
            return updated
        } catch {
            lastError = String(describing: error)
            return nil
        }
    }

    /// Legg samme innvending til alle maler i én kategori. Returnerer
    /// antall oppdaterte maler (0 = ingen maler i kategorien ennå — ikke
    /// en feil, bare et ærlig tomt resultat).
    @discardableResult
    func bulkAttachObjection(category: String, prompt: String, response: String, api: APIClient?) async -> Int? {
        guard let api else { return nil }
        do {
            let updated = try await api.pondusBulkAttachObjection(
                category: category,
                prompt: prompt,
                response: response,
                organizationId: organizationId
            )
            for t in updated { replace(t) }
            return updated.count
        } catch {
            lastError = String(describing: error)
            return nil
        }
    }

    func delete(id: UUID, api: APIClient?) async {
        guard let api else { return }
        do {
            try await api.pondusDeleteTemplate(
                id: id.uuidString.lowercased(),
                organizationId: organizationId
            )
            // Soft-delete → backend setter is_published = false, ikke sletter.
            // Hard-delete → rad forsvinner. Reload for korrekt tilstand.
            await load(api: api, organizationId: organizationId)
        } catch {
            lastError = String(describing: error)
        }
    }

    /// Per-mal drill-down (utfalls-fordeling/per-selger/siste logger).
    func usageDetail(templateId: UUID, api: APIClient?) async -> PondusTemplateUsageDetailDTO? {
        guard let api else { return nil }
        do {
            return try await api.pondusTemplateUsageDetail(
                templateId: templateId.uuidString.lowercased(),
                organizationId: organizationId
            )
        } catch {
            lastError = String(describing: error)
            return nil
        }
    }

    // MARK: - Private

    private func replace(_ updated: PondusTemplateDTO) {
        if let idx = templates.firstIndex(where: { $0.id == updated.id }) {
            templates[idx] = updated
        } else {
            templates.insert(updated, at: 0)
        }
    }
}

// MARK: - Views (backend-list + empty-state)

/// Render publiserte backend-maler i mørkt Leadbook-tema. SuperAdmin
/// får inline «Rediger»-knapper + «Ny mal»-CTA på toppen.
struct PondusBackendListView: View {
    let templates: [PondusTemplateDTO]
    let isSuperAdmin: Bool
    let onOpen: (PondusTemplateDTO) -> Void
    let onEdit: (PondusTemplateDTO) -> Void
    let onNew: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            if isSuperAdmin {
                HStack {
                    Text("SuperAdmin — du kan opprette og publisere Leadgrid-maler.")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(LBrand.textSecondary)
                    Spacer()
                    Button(action: onNew) {
                        HStack(spacing: 6) {
                            Image(systemName: "plus")
                                .font(.appScaled(size: 11, weight: .bold))
                            Text("Ny mal")
                                .font(.appScaled(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight], startPoint: .leading, endPoint: .trailing),
                            in: Capsule()
                        )
                    }.buttonStyle(.plain)
                }
                .padding(12)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
            }

            ForEach(templates) { t in
                PondusBackendCard(
                    template: t,
                    isSuperAdmin: isSuperAdmin,
                    onOpen: { onOpen(t) },
                    onEdit: { onEdit(t) }
                )
            }
        }
    }
}

private struct PondusBackendCard: View {
    let template: PondusTemplateDTO
    let isSuperAdmin: Bool
    let onOpen: () -> Void
    let onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9)
                        .fill(kindTint.opacity(0.22))
                    Image(systemName: kindIcon)
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(kindTint)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 3) {
                    Text(template.name)
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 6) {
                        Text(kindLabel).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(kindTint)
                        Text("•").foregroundStyle(LBrand.textTertiary).font(.appScaled(size: 10))
                        Text(categoryLabel).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                        Text("•").foregroundStyle(LBrand.textTertiary).font(.appScaled(size: 10))
                        Text("Score \(template.score)")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(scoreColor)
                            .monospacedDigit()
                    }
                }
                Spacer(minLength: 8)
                if isSuperAdmin {
                    Button(action: onEdit) {
                        HStack(spacing: 4) {
                            Image(systemName: "pencil").font(.appScaled(size: 10, weight: .bold))
                            Text("Rediger").font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(LBrand.purpleLight)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(LBrand.purple.opacity(0.20), in: Capsule())
                    }.buttonStyle(.plain)
                }
            }
            if let desc = template.description, !desc.isEmpty {
                Text(desc)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
            }
            HStack(spacing: 6) {
                ForEach(template.orderedSteps.prefix(6)) { step in
                    Text(step.title)
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.75))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(LBrand.cardHi, in: Capsule())
                }
                if template.steps.count > 6 {
                    Text("+\(template.steps.count - 6)")
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                Spacer(minLength: 0)
                Button(action: onOpen) {
                    Label("Bruk mal", systemImage: "play.fill")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(LBrand.green, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pondus-use-\(template.id.uuidString.lowercased())")
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var kindTint: Color {
        switch template.kindEnum {
        case .telephone: return LBrand.green
        case .video: return LBrand.orange
        case .email: return LBrand.blue
        case .meeting: return LBrand.purpleLight
        case .field: return LBrand.pink
        }
    }
    private var kindIcon: String {
        switch template.kindEnum {
        case .telephone: return "phone.fill"
        case .video: return "video.fill"
        case .email: return "envelope.fill"
        case .meeting: return "calendar"
        case .field: return "person.crop.circle.fill"
        }
    }
    private var kindLabel: String {
        switch template.kindEnum {
        case .telephone: return "Telefon"
        case .video: return "Video"
        case .email: return "E-post"
        case .meeting: return "Møte"
        case .field: return "Felt"
        }
    }
    private var categoryLabel: String {
        switch template.category {
        case PondusCategory.firstContact: return "Første kontakt"
        case PondusCategory.meetingOpen: return "Møteåpning"
        case PondusCategory.priceObjection: return "Prisinnvending"
        case PondusCategory.decisionMaker: return "Beslutningstaker"
        case PondusCategory.followUp: return "Oppfølging"
        default: return template.category
        }
    }
    private var scoreColor: Color {
        if template.score >= 85 { return LBrand.green }
        if template.score >= 70 { return LBrand.orange }
        return LBrand.yellow
    }
}

/// Empty-state når backend har 0 publiserte maler.
struct PondusEmptyStateView: View {
    let isSuperAdmin: Bool
    let isLoading: Bool
    var error: String? = nil
    var onRetry: () -> Void = {}
    let onNew: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            if isLoading {
                ProgressView().tint(LBrand.purpleLight)
            } else {
                Image(systemName: "book.pages.fill")
                    .font(.appScaled(size: 44, weight: .semibold))
                    .foregroundStyle(LBrand.purpleLight.opacity(0.7))
            }
            Text("Ingen publiserte pondus-maler enda")
                .font(.appScaled(size: 22, weight: .heavy))
                .foregroundStyle(.white)
            if let error, !isLoading {
                Text("Kunne ikke hente maler: \(error)")
                    .font(.appScaled(size: 12)).foregroundStyle(LBrand.orange)
                    .multilineTextAlignment(.center)
                Button("Prøv igjen", action: onRetry).buttonStyle(.bordered)
            }
            if isSuperAdmin {
                Text("Legg til første mal og publiser den slik at alle brukere får tilgang.")
                    .font(.appScaled(size: 13))
                    .foregroundStyle(LBrand.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                Button(action: onNew) {
                    HStack(spacing: 6) {
                        Image(systemName: "plus.circle.fill").font(.appScaled(size: 12, weight: .bold))
                        Text("Legg til første mal")
                            .font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight], startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }.buttonStyle(.plain)
            } else {
                Text("Din SuperAdmin publiserer maler her.")
                    .font(.appScaled(size: 13))
                    .foregroundStyle(LBrand.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 70)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }
}

/// Kanonisk brukerflyt for live Pondus-maler. Samme usageSessionId følger
/// start og utfall, og alle writes går via den tenant-scopede offline-køen.
struct PondusCoachView: View {
    let template: PondusTemplateDTO
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var currentStep: Int
    @State private var selectedLeadId: String?
    @State private var usageSessionId = UUID()
    @State private var hasStarted = false
    @State private var isSaving = false
    @State private var statusMessage: String?
    @State private var savedOutcome: String?

    init(template: PondusTemplateDTO, initialStep: Int = 0) {
        self.template = template
        let upper = max(0, template.orderedSteps.count - 1)
        _currentStep = State(initialValue: min(max(0, initialStep), upper))
    }

    private var steps: [PondusStepDTO] { template.orderedSteps }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        analysisCard
                        if hasStarted { activeCoach } else { startCard }
                        if let statusMessage {
                            Label(statusMessage, systemImage: savedOutcome == nil ? "arrow.triangle.2.circlepath" : "checkmark.circle.fill")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(savedOutcome == nil ? LBrand.textSecondary : LBrand.green)
                                .accessibilityIdentifier("pondus-save-status")
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle(template.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
            .preferredColorScheme(.dark)
            .onReceive(NotificationCenter.default.publisher(for: .pondusStepAdvance)) { _ in
                guard hasStarted, currentStep < steps.count - 1 else { return }
                currentStep += 1
            }
        }
    }

    private var analysisCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Pondus \(template.score)")
                    .font(.appScaled(size: 18, weight: .heavy))
                    .foregroundStyle(.white)
                Spacer()
                if let meta = template.analysisMeta {
                    Text(meta.rubricVersion)
                        .font(.appScaled(size: 9, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
            }
            if let recommendation = template.analysisMeta?.recommendations.first {
                Text(recommendation)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
            } else if let description = template.description {
                Text(description)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var startCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Klargjør samtalen")
                .font(.appScaled(size: 17, weight: .bold))
                .foregroundStyle(.white)
            Picker("Lead", selection: $selectedLeadId) {
                Text("Ingen lead valgt").tag(String?.none)
                ForEach(appState.leads) { lead in
                    Text(lead.company ?? lead.name).tag(Optional(lead.id))
                }
            }
            .pickerStyle(.menu)
            .tint(LBrand.purpleLight)
            .accessibilityIdentifier("pondus-lead-picker")
            Button {
                Task { await startSession() }
            } label: {
                HStack {
                    if isSaving { ProgressView().tint(.white) }
                    Label("Start samtale", systemImage: "play.fill")
                }
                .font(.appScaled(size: 14, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(.white)
                .background(LBrand.green, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.plain)
            .disabled(isSaving || steps.isEmpty)
            .accessibilityIdentifier("pondus-start-session")
        }
        .padding(16)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
    }

    private var activeCoach: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !steps.isEmpty {
                ProgressView(value: Double(currentStep + 1), total: Double(steps.count))
                    .tint(LBrand.purpleLight)
                Text("Steg \(currentStep + 1) av \(steps.count)")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LBrand.textTertiary)
                    .accessibilityIdentifier("pondus-active-coach")
                let step = steps[currentStep]
                Text(step.title)
                    .font(.appScaled(size: 22, weight: .heavy))
                    .foregroundStyle(.white)
                if let subtitle = step.subtitle, !subtitle.isEmpty {
                    Text(subtitle).font(.appScaled(size: 13)).foregroundStyle(LBrand.textSecondary)
                }
                if let prompt = step.prompt, !prompt.isEmpty {
                    Text(prompt)
                        .font(.appScaled(size: 17, weight: .medium))
                        .foregroundStyle(.white)
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
                }
                stepControls
            }
            outcomeButtons
        }
        .padding(16)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var stepControls: some View {
        HStack {
            Button("Forrige") { currentStep = max(0, currentStep - 1) }
                .disabled(currentStep == 0)
            Spacer()
            Button(currentStep == steps.count - 1 ? "Siste steg" : "Neste") {
                currentStep = min(steps.count - 1, currentStep + 1)
            }
            .disabled(currentStep == steps.count - 1)
            .accessibilityIdentifier("pondus-next-step")
        }
        .buttonStyle(.bordered)
        .tint(LBrand.purpleLight)
    }

    private var outcomeButtons: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Registrer utfall")
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
            HStack {
                outcomeButton("Møte", value: "meeting_booked", icon: "calendar.badge.checkmark")
                outcomeButton("Tilbud", value: "proposal_sent", icon: "doc.text.fill")
                outcomeButton("Ikke svar", value: "no_answer", icon: "phone.down.fill")
            }
        }
    }

    private func outcomeButton(_ label: String, value: String, icon: String) -> some View {
        Button {
            Task { await saveOutcome(value) }
        } label: {
            Label(label, systemImage: icon)
                .font(.appScaled(size: 11, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
        }
        .buttonStyle(.bordered)
        .tint(savedOutcome == value ? LBrand.green : LBrand.purpleLight)
        .disabled(isSaving)
        .accessibilityIdentifier("pondus-outcome-\(value)")
    }

    @MainActor
    private func startSession() async {
        guard let api = appState.api, let orgId = appState.activeOrganizationId else {
            statusMessage = "Mangler aktiv organisasjon eller innlogging."
            return
        }
        isSaving = true
        let disposition = await OfflineResilientActions.logPondusUsage(
            api: api, organizationId: orgId, templateId: template.id,
            usageSessionId: usageSessionId, leadId: selectedLeadId, outcome: "used"
        )
        isSaving = false
        apply(disposition)
        if case .rejected = disposition { return }
        hasStarted = true
    }

    @MainActor
    private func saveOutcome(_ outcome: String) async {
        guard let api = appState.api, let orgId = appState.activeOrganizationId else { return }
        isSaving = true
        let disposition = await OfflineResilientActions.logPondusUsage(
            api: api, organizationId: orgId, templateId: template.id,
            usageSessionId: usageSessionId, leadId: selectedLeadId, outcome: outcome
        )
        isSaving = false
        apply(disposition)
        if case .rejected = disposition { return }
        savedOutcome = outcome
    }

    private func apply(_ disposition: OfflineResilientActions.WriteDisposition) {
        switch disposition {
        case .sent: statusMessage = "Lagret i Leadgrid."
        case .queued: statusMessage = "Lagret offline og sendes automatisk ved reconnect."
        case .rejected(let reason): statusMessage = reason
        }
    }
}
