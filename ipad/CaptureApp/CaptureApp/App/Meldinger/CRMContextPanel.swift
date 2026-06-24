import SwiftUI

/// Self-contained CRM context panel for the CreatorHub iPad chat. Drop it
/// alongside a conversation and it resolves the CRM relationship for that
/// chat (`/api/universal-crm/context/by-conversation`) and renders:
///
/// - **linked**: customer header, active deal, commercial docs (quote +
///   contract with status pills + amounts), recent activities, open tasks,
///   and a short summary (next follow-up).
/// - **match_available**: the recommended/suggested customers with a
///   "Koble" button that links + reloads.
/// - **unlinked**: a "Koble til kunde" flow — search existing customers to
///   link, or "Opprett ny kunde" with name/email.
///
/// Every state offers "Logg aktivitet" (call/email/meeting/note) which
/// posts the activity and reloads. CreatorHub dark brand throughout
/// (``CHTheme`` + ``CHCard``); loading/error/empty states mirror
/// ``GalleriView``.
struct CRMContextPanel: View {
    let conversationId: String
    let provider: String
    var hintName: String?
    var hintEmail: String?

    @State private var model = CRMPanelModel()
    @State private var showLogActivity = false

    init(
        conversationId: String,
        provider: String,
        hintName: String? = nil,
        hintEmail: String? = nil,
    ) {
        self.conversationId = conversationId
        self.provider = provider
        self.hintName = hintName
        self.hintEmail = hintEmail
    }

    var body: some View {
        Group {
            switch model.phase {
            case .loading where model.context == nil:
                ProgressView("Laster CRM…")
                    .tint(CHTheme.accent)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case let .error(message) where model.context == nil:
                ContentUnavailableView {
                    Label("Kunne ikke laste CRM", systemImage: "exclamationmark.icloud")
                } description: {
                    Text(message)
                } actions: {
                    Button("Prøv igjen") { Task { await reload() } }
                        .buttonStyle(.borderedProminent)
                        .tint(CHTheme.accent)
                }
            default:
                content
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .chBranded()
        .sheet(isPresented: $showLogActivity) {
            LogActivitySheet { type, subject, note, direction in
                await model.logActivity(
                    conversationId: conversationId,
                    provider: provider,
                    type: type,
                    subject: subject,
                    note: note,
                    direction: direction,
                )
            }
        }
        .task { await model.loadIfNeeded(conversationId: conversationId, provider: provider, hintName: hintName, hintEmail: hintEmail) }
    }

    private func reload() async {
        await model.load(conversationId: conversationId, provider: provider, hintName: hintName, hintEmail: hintEmail)
    }

    // MARK: - State router

    @ViewBuilder
    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header

                switch model.context?.state ?? .unknown {
                case .linked:
                    linkedBody
                case .matchAvailable:
                    matchBody
                case .unlinked, .unknown:
                    unlinkedBody
                }

                if let banner = model.actionBanner {
                    Text(banner)
                        .font(.caption)
                        .foregroundStyle(CHTheme.danger)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(16)
        }
        .scrollContentBackground(.hidden)
        .refreshable { await reload() }
    }

    private var header: some View {
        HStack {
            Label("CRM", systemImage: "person.crop.rectangle.stack")
                .font(.headline)
                .foregroundStyle(CHTheme.textPrimary)
            Spacer()
            Button {
                showLogActivity = true
            } label: {
                Label("Logg aktivitet", systemImage: "square.and.pencil")
                    .font(.caption.weight(.semibold))
            }
            .buttonStyle(.bordered)
            .tint(CHTheme.accent)

            Button {
                Task { await reload() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .tint(CHTheme.textSecondary)
        }
    }

    // MARK: - Linked

    @ViewBuilder
    private var linkedBody: some View {
        if let customer = model.context?.customer {
            CustomerHeaderCard(customer: customer)
        }
        if let deal = model.context?.activeDeal {
            DealCard(deal: deal)
        }
        if let commercial = model.context?.commercial, !commercial.isEmpty {
            CommercialCard(commercial: commercial)
        }
        if let activities = model.context?.recentActivities, !activities.isEmpty {
            ActivitiesCard(activities: activities)
        }
        if let tasks = model.context?.openTasks, !tasks.isEmpty {
            TasksCard(tasks: tasks)
        }
        if let summary = model.context?.summary {
            SummaryCard(summary: summary)
        }
    }

    // MARK: - Match available

    @ViewBuilder
    private var matchBody: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                Label("Mulig kundematch", systemImage: "sparkles")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.accent)
                Text("Vi fant en kunde som ser ut til å passe denne samtalen.")
                    .font(.caption)
                    .foregroundStyle(CHTheme.textSecondary)

                if let recommended = model.context?.recommendedCustomer {
                    MatchRow(customer: recommended, highlighted: true) {
                        await model.link(conversationId: conversationId, customerId: recommended.id, provider: provider)
                    }
                }

                ForEach(model.suggestedExcludingRecommended) { customer in
                    Divider().overlay(CHTheme.border)
                    MatchRow(customer: customer, highlighted: false) {
                        await model.link(conversationId: conversationId, customerId: customer.id, provider: provider)
                    }
                }
            }
        }

        unlinkedBody // also allow manual search / create as a fallback
    }

    // MARK: - Unlinked

    @ViewBuilder
    private var unlinkedBody: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("Koble til kunde", systemImage: "link")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textPrimary)
                Text("Søk opp en eksisterende kunde, eller opprett en ny.")
                    .font(.caption)
                    .foregroundStyle(CHTheme.textSecondary)

                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(CHTheme.textMuted)
                    TextField("Søk navn, e-post eller firma", text: $model.searchQuery)
                        .textFieldStyle(.plain)
                        .foregroundStyle(CHTheme.textPrimary)
                        .autocorrectionDisabled()
                        .onSubmit { Task { await model.search() } }
                    if model.searching { ProgressView().controlSize(.small) }
                }
                .padding(10)
                .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10))

                if !model.searchResults.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(model.searchResults) { customer in
                            MatchRow(customer: customer, highlighted: false) {
                                await model.link(conversationId: conversationId, customerId: customer.id, provider: provider)
                            }
                            if customer.id != model.searchResults.last?.id {
                                Divider().overlay(CHTheme.border)
                            }
                        }
                    }
                } else if model.didSearch && !model.searching {
                    Text("Ingen treff.")
                        .font(.caption)
                        .foregroundStyle(CHTheme.textMuted)
                }
            }
        }

        CreateCustomerCard(initialName: hintName, initialEmail: hintEmail) { name, email, phone in
            await model.createCustomer(
                conversationId: conversationId,
                provider: provider,
                name: name,
                email: email,
                phone: phone,
            )
        }
    }
}

// MARK: - Model

@MainActor
@Observable
final class CRMPanelModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case error(String)
    }

    private(set) var context: CRMContext?
    private(set) var phase: Phase = .loading

    var searchQuery: String = ""
    private(set) var searchResults: [CRMCustomer] = []
    private(set) var searching = false
    private(set) var didSearch = false

    /// Transient error surfaced after a mutation (link/create/log) without
    /// nuking the already-loaded panel.
    private(set) var actionBanner: String?

    var suggestedExcludingRecommended: [CRMCustomer] {
        let recommendedId = context?.recommendedCustomer?.id
        return (context?.suggestedCustomers ?? []).filter { $0.id != recommendedId }
    }

    func loadIfNeeded(conversationId: String, provider: String, hintName: String?, hintEmail: String?) async {
        guard context == nil else { return }
        await load(conversationId: conversationId, provider: provider, hintName: hintName, hintEmail: hintEmail)
    }

    func load(conversationId: String, provider: String, hintName: String?, hintEmail: String?) async {
        if context == nil { phase = .loading }
        actionBanner = nil
        guard let client = DashboardClient.make() else {
            phase = .error(DashboardError.signedOut.localizedDescription)
            return
        }
        do {
            let ctx = try await client.crmContext(
                conversationId: conversationId,
                provider: provider,
                hintName: hintName,
                hintEmail: hintEmail,
            )
            context = ctx
            phase = .loaded
        } catch {
            if context == nil {
                phase = .error(message(error))
            } else {
                actionBanner = message(error)
            }
        }
    }

    func search() async {
        let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            searchResults = []
            didSearch = false
            return
        }
        guard let client = DashboardClient.make() else { return }
        searching = true
        defer { searching = false }
        didSearch = true
        do {
            searchResults = try await client.searchCustomers(query: trimmed)
        } catch {
            searchResults = []
            actionBanner = message(error)
        }
    }

    func link(conversationId: String, customerId: String, provider: String) async {
        guard let client = DashboardClient.make() else { return }
        do {
            try await client.linkCustomer(conversationId: conversationId, customerId: customerId, provider: provider)
            await reload(conversationId: conversationId, provider: provider)
        } catch {
            actionBanner = message(error)
        }
    }

    func createCustomer(conversationId: String, provider: String, name: String, email: String?, phone: String?) async {
        guard let client = DashboardClient.make() else { return }
        do {
            let ctx = try await client.createCustomerLink(
                conversationId: conversationId,
                name: name,
                email: email,
                phone: phone,
                provider: provider,
            )
            context = ctx
            phase = .loaded
        } catch {
            actionBanner = message(error)
        }
    }

    func logActivity(conversationId: String, provider: String, type: String, subject: String, note: String?, direction: String?) async {
        guard let client = DashboardClient.make() else { return }
        do {
            try await client.logActivity(
                conversationId: conversationId,
                type: type,
                subject: subject,
                description: note,
                direction: direction,
                provider: provider,
            )
            await reload(conversationId: conversationId, provider: provider)
        } catch {
            actionBanner = message(error)
        }
    }

    private func reload(conversationId: String, provider: String) async {
        await load(conversationId: conversationId, provider: provider, hintName: nil, hintEmail: nil)
    }

    private func message(_ error: Error) -> String {
        (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
    }
}

// MARK: - Cards

private struct CustomerHeaderCard: View {
    let customer: CRMCustomer

    var body: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text(customer.displayName)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(CHTheme.textPrimary)
                    Spacer()
                    if let status = customer.status, !status.isEmpty {
                        CRMPill(text: status, kind: .neutral)
                    }
                }
                if let company = customer.company, !company.isEmpty {
                    InfoLine(icon: "building.2", text: company)
                }
                if let email = customer.email, !email.isEmpty {
                    InfoLine(icon: "envelope", text: email)
                }
                if let phone = customer.phone, !phone.isEmpty {
                    InfoLine(icon: "phone", text: phone)
                }
                if let profession = customer.profession, !profession.isEmpty {
                    InfoLine(icon: "briefcase", text: profession)
                }
                if let projectType = customer.projectType, !projectType.isEmpty {
                    InfoLine(icon: "camera", text: projectType)
                }
                if let notes = customer.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundStyle(CHTheme.textSecondary)
                        .padding(.top, 2)
                }
            }
        }
    }
}

private struct DealCard: View {
    let deal: CRMDeal

    var body: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 8) {
                Label("Aktiv avtale", systemImage: "chart.line.uptrend.xyaxis")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textSecondary)
                HStack(alignment: .firstTextBaseline) {
                    Text(deal.title ?? "Avtale")
                        .font(.headline)
                        .foregroundStyle(CHTheme.textPrimary)
                    Spacer()
                    if let stage = deal.stage, !stage.isEmpty {
                        CRMPill(text: stage, kind: .accent)
                    }
                }
                HStack(spacing: 16) {
                    if let value = deal.value {
                        Text(CRMFormat.money(value, currency: deal.currency))
                            .font(.title3.weight(.bold).monospacedDigit())
                            .foregroundStyle(CHTheme.accent)
                    }
                    if let prob = deal.probability {
                        InfoLine(icon: "percent", text: "\(Int(prob.rounded())) % sannsynlig")
                    }
                }
                if let close = deal.expectedCloseDate, !close.isEmpty {
                    InfoLine(icon: "calendar", text: "Forventet lukket \(CRMFormat.day(close))")
                }
            }
        }
    }
}

private struct CommercialCard: View {
    let commercial: CRMCommercial

    var body: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("Kommersielt", systemImage: "doc.text")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textSecondary)

                if let quote = commercial.quote {
                    DocRow(
                        title: quote.title ?? "Tilbud",
                        number: quote.quoteNumber,
                        amount: quote.totalAmount,
                        currency: quote.currency,
                        status: quote.status,
                        statusKind: CRMPill.Kind(quoteStatus: quote.status),
                        icon: "doc.plaintext",
                    )
                }
                if commercial.quote != nil && commercial.contract != nil {
                    Divider().overlay(CHTheme.border)
                }
                if let contract = commercial.contract {
                    DocRow(
                        title: contract.title ?? "Kontrakt",
                        number: contract.contractNumber,
                        amount: contract.totalAmount,
                        currency: nil,
                        status: contract.signatureStatus ?? contract.status,
                        statusKind: CRMPill.Kind(contractStatus: contract.signatureStatus ?? contract.status),
                        icon: "signature",
                    )
                }
            }
        }
    }
}

private struct DocRow: View {
    let title: String
    let number: String?
    let amount: Double?
    let currency: String?
    let status: String?
    let statusKind: CRMPill.Kind
    let icon: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(CHTheme.textMuted)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textPrimary)
                if let number, !number.isEmpty {
                    Text(number)
                        .font(.caption2.monospaced())
                        .foregroundStyle(CHTheme.textMuted)
                }
                if let amount {
                    Text(CRMFormat.money(amount, currency: currency))
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                        .foregroundStyle(CHTheme.textSecondary)
                }
            }
            Spacer()
            if let status, !status.isEmpty {
                CRMPill(text: status, kind: statusKind)
            }
        }
    }
}

private struct ActivitiesCard: View {
    let activities: [CRMActivity]

    var body: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                Label("Siste aktivitet", systemImage: "clock.arrow.circlepath")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textSecondary)
                ForEach(activities) { activity in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: CRMIcon.activity(activity.type))
                            .font(.caption)
                            .foregroundStyle(CHTheme.accent)
                            .frame(width: 18)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(activity.subject ?? (activity.type ?? "Aktivitet"))
                                .font(.subheadline)
                                .foregroundStyle(CHTheme.textPrimary)
                            if let desc = activity.description, !desc.isEmpty {
                                Text(desc)
                                    .font(.caption)
                                    .foregroundStyle(CHTheme.textSecondary)
                                    .lineLimit(2)
                            }
                            HStack(spacing: 8) {
                                if let createdAt = activity.createdAt, !createdAt.isEmpty {
                                    Text(DashboardDate.relative(createdAt))
                                }
                                if let outcome = activity.outcome, !outcome.isEmpty {
                                    Text("· \(outcome)")
                                }
                            }
                            .font(.caption2)
                            .foregroundStyle(CHTheme.textMuted)
                        }
                        Spacer()
                    }
                    if activity.id != activities.last?.id {
                        Divider().overlay(CHTheme.border)
                    }
                }
            }
        }
    }
}

private struct TasksCard: View {
    let tasks: [CRMTask]

    var body: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                Label("Åpne oppgaver", systemImage: "checklist")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textSecondary)
                ForEach(tasks) { task in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "circle")
                            .font(.caption)
                            .foregroundStyle(CRMPill.Kind(priority: task.priority).color)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(task.title ?? "Oppgave")
                                .font(.subheadline)
                                .foregroundStyle(CHTheme.textPrimary)
                            if let due = task.dueDate, !due.isEmpty {
                                Text("Frist \(CRMFormat.day(due))")
                                    .font(.caption2)
                                    .foregroundStyle(CHTheme.textMuted)
                            }
                        }
                        Spacer()
                        if let priority = task.priority, !priority.isEmpty {
                            CRMPill(text: priority, kind: CRMPill.Kind(priority: priority))
                        }
                    }
                    if task.id != tasks.last?.id {
                        Divider().overlay(CHTheme.border)
                    }
                }
            }
        }
    }
}

private struct SummaryCard: View {
    let summary: CRMSummary

    var body: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 8) {
                Label("Oppsummering", systemImage: "sparkles")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textSecondary)
                if let next = summary.nextFollowUp, !next.isEmpty {
                    InfoLine(icon: "bell", text: "Neste oppfølging \(CRMFormat.day(next))")
                }
                HStack(spacing: 16) {
                    if let open = summary.openTaskCount {
                        InfoLine(icon: "checklist", text: "\(open) åpne")
                    }
                    if let recent = summary.recentActivityCount {
                        InfoLine(icon: "clock", text: "\(recent) siste")
                    }
                }
                if summary.pendingReplyHint == true {
                    Label("Venter på svar fra deg", systemImage: "exclamationmark.bubble")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(CHTheme.warning)
                }
            }
        }
    }
}

// MARK: - Match / create rows

private struct MatchRow: View {
    let customer: CRMCustomer
    let highlighted: Bool
    let onLink: () async -> Void

    @State private var linking = false

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(customer.displayName)
                    .font(.subheadline.weight(highlighted ? .bold : .regular))
                    .foregroundStyle(CHTheme.textPrimary)
                let sub = [customer.company, customer.email].compactMap { $0 }.filter { !$0.isEmpty }.first
                if let sub {
                    Text(sub)
                        .font(.caption2)
                        .foregroundStyle(CHTheme.textMuted)
                }
            }
            Spacer()
            Button {
                linking = true
                Task { await onLink(); linking = false }
            } label: {
                if linking {
                    ProgressView().controlSize(.small)
                } else {
                    Text("Koble").font(.caption.weight(.semibold))
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(CHTheme.accent)
            .disabled(linking)
        }
        .padding(.vertical, 4)
    }
}

private struct CreateCustomerCard: View {
    let initialName: String?
    let initialEmail: String?
    let onCreate: (_ name: String, _ email: String?, _ phone: String?) async -> Void

    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var creating = false
    @State private var didPrefill = false

    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                Label("Opprett ny kunde", systemImage: "person.badge.plus")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textPrimary)

                Field(placeholder: "Navn", text: $name)
                Field(placeholder: "E-post (valgfritt)", text: $email, keyboard: .emailAddress)
                Field(placeholder: "Telefon (valgfritt)", text: $phone, keyboard: .phonePad)

                Button {
                    creating = true
                    let e = email.trimmingCharacters(in: .whitespaces)
                    let p = phone.trimmingCharacters(in: .whitespaces)
                    Task {
                        await onCreate(
                            name.trimmingCharacters(in: .whitespaces),
                            e.isEmpty ? nil : e,
                            p.isEmpty ? nil : p,
                        )
                        creating = false
                    }
                } label: {
                    if creating {
                        ProgressView().controlSize(.small).frame(maxWidth: .infinity)
                    } else {
                        Text("Opprett og koble").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(CHTheme.accent)
                .disabled(!canCreate || creating)
            }
        }
        .onAppear {
            guard !didPrefill else { return }
            didPrefill = true
            if let initialName, name.isEmpty { name = initialName }
            if let initialEmail, email.isEmpty { email = initialEmail }
        }
    }
}

// MARK: - Log activity sheet

private struct LogActivitySheet: View {
    let onSubmit: (_ type: String, _ subject: String, _ note: String?, _ direction: String?) async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var type = "call"
    @State private var subject = ""
    @State private var note = ""
    @State private var direction = "outbound"
    @State private var submitting = false

    private let types: [(value: String, label: String, icon: String)] = [
        ("call", "Samtale", "phone"),
        ("email", "E-post", "envelope"),
        ("meeting", "Møte", "person.2"),
        ("note", "Notat", "note.text")
    ]

    private var canSubmit: Bool {
        !subject.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Type")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(CHTheme.textSecondary)
                    Picker("Type", selection: $type) {
                        ForEach(types, id: \.value) { t in
                            Label(t.label, systemImage: t.icon).tag(t.value)
                        }
                    }
                    .pickerStyle(.segmented)

                    if type == "call" || type == "email" {
                        Picker("Retning", selection: $direction) {
                            Text("Utgående").tag("outbound")
                            Text("Innkommende").tag("inbound")
                        }
                        .pickerStyle(.segmented)
                    }

                    Field(placeholder: "Emne", text: $subject)

                    Text("Notat")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(CHTheme.textSecondary)
                    TextEditor(text: $note)
                        .frame(minHeight: 120)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10))
                        .foregroundStyle(CHTheme.textPrimary)
                }
                .padding(16)
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Logg aktivitet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        submitting = true
                        let n = note.trimmingCharacters(in: .whitespaces)
                        let dir = (type == "call" || type == "email") ? direction : nil
                        Task {
                            await onSubmit(
                                type,
                                subject.trimmingCharacters(in: .whitespaces),
                                n.isEmpty ? nil : n,
                                dir,
                            )
                            submitting = false
                            dismiss()
                        }
                    } label: {
                        if submitting { ProgressView().controlSize(.small) } else { Text("Lagre") }
                    }
                    .disabled(!canSubmit || submitting)
                }
            }
        }
        .chBranded()
    }
}

// MARK: - Small shared components

private struct InfoLine: View {
    let icon: String
    let text: String
    var body: some View {
        Label(text, systemImage: icon)
            .font(.caption)
            .foregroundStyle(CHTheme.textSecondary)
            .labelStyle(.titleAndIcon)
    }
}

private struct Field: View {
    let placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default

    var body: some View {
        TextField(placeholder, text: $text)
            .textFieldStyle(.plain)
            .keyboardType(keyboard)
            .autocorrectionDisabled(keyboard == .emailAddress)
            .textInputAutocapitalization(keyboard == .emailAddress ? .never : .sentences)
            .foregroundStyle(CHTheme.textPrimary)
            .padding(10)
            .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10))
    }
}

/// Branded status pill. The `Kind` initializers map raw backend statuses
/// (quote/contract/priority) to the muted CHTheme status palette.
private struct CRMPill: View {
    enum Kind {
        case neutral, accent, success, warning, danger, info

        var color: Color {
            switch self {
            case .neutral: return CHTheme.textSecondary
            case .accent: return CHTheme.accent
            case .success: return CHTheme.success
            case .warning: return CHTheme.warning
            case .danger: return CHTheme.danger
            case .info: return CHTheme.info
            }
        }

        init(quoteStatus: String?) {
            switch (quoteStatus ?? "").lowercased() {
            case "accepted", "approved", "paid": self = .success
            case "sent", "viewed", "pending": self = .info
            case "rejected", "declined", "expired": self = .danger
            case "draft": self = .neutral
            default: self = .neutral
            }
        }

        init(contractStatus: String?) {
            switch (contractStatus ?? "").lowercased() {
            case "signed", "completed", "fully_signed": self = .success
            case "sent", "pending", "awaiting_signature", "partially_signed": self = .warning
            case "declined", "cancelled", "voided", "expired": self = .danger
            case "draft": self = .neutral
            default: self = .neutral
            }
        }

        init(priority: String?) {
            switch (priority ?? "").lowercased() {
            case "high", "urgent", "critical": self = .danger
            case "medium", "normal": self = .warning
            case "low": self = .info
            default: self = .neutral
            }
        }
    }

    let text: String
    let kind: Kind

    private var label: String {
        // Light Norwegianization of the most common statuses; otherwise echo.
        switch text.lowercased() {
        case "draft": return "Utkast"
        case "sent": return "Sendt"
        case "viewed": return "Sett"
        case "pending": return "Avventer"
        case "accepted", "approved": return "Godkjent"
        case "rejected", "declined": return "Avvist"
        case "paid": return "Betalt"
        case "expired": return "Utløpt"
        case "signed", "fully_signed": return "Signert"
        case "partially_signed": return "Delvis signert"
        case "awaiting_signature": return "Venter signering"
        case "completed": return "Fullført"
        case "cancelled", "voided": return "Kansellert"
        case "high": return "Høy"
        case "medium", "normal": return "Middels"
        case "low": return "Lav"
        case "urgent": return "Haster"
        case "active": return "Aktiv"
        case "lead": return "Lead"
        case "won": return "Vunnet"
        case "lost": return "Tapt"
        default: return text
        }
    }

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(kind.color.opacity(0.15), in: Capsule())
            .foregroundStyle(kind.color)
    }
}

// MARK: - Formatting

private enum CRMIcon {
    static func activity(_ type: String?) -> String {
        switch (type ?? "").lowercased() {
        case "call": return "phone"
        case "email": return "envelope"
        case "meeting": return "person.2"
        case "note": return "note.text"
        case "sms", "message", "whatsapp": return "bubble.left"
        default: return "circle.fill"
        }
    }
}

private enum CRMFormat {
    static func money(_ value: Double, currency: String?) -> String {
        let fmt = NumberFormatter()
        fmt.numberStyle = .decimal
        fmt.maximumFractionDigits = value.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
        fmt.locale = Locale(identifier: "nb_NO")
        let number = fmt.string(from: NSNumber(value: value)) ?? String(value)
        let cur = (currency ?? "NOK").uppercased()
        return "\(number) \(cur)"
    }

    /// Short day formatting via DashboardDate, falling back to raw.
    static func day(_ raw: String) -> String {
        guard let date = DashboardDate.parse(raw) else { return raw }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "nb_NO")
        fmt.dateFormat = "d. MMM yyyy"
        return fmt.string(from: date)
    }
}
