import Foundation
import SwiftUI

/// Opening another app only initiates contact. Leadgrid must never turn that
/// OS hand-off into a completed CRM activity without an explicit user answer.
enum LeadgridExternalContactLifecycle: Equatable, Sendable {
    case initiated
    case completed
    case cancelled
}

enum LeadgridExternalContactChannel: String, Equatable, Sendable {
    case phone
    case sms
    case whatsapp
    case email

    var title: String {
        switch self {
        case .phone: return "telefonsamtalen"
        case .sms: return "SMS-en"
        case .whatsapp: return "WhatsApp-meldingen"
        case .email: return "e-posten"
        }
    }
}

enum LeadgridExternalContactCopy {
    /// The external message is never sent by the offline queue. Only the
    /// user-confirmed CRM activity is awaiting synchronization.
    static let queuedLoggingMessage =
        "Loggføringen ligger i offline-køen og synkroniseres automatisk når forbindelsen er tilbake."
}

/// Captured CRM identity for one external hand-off. The active workspace is
/// checked again before persistence so a project switch while Phone or Mail
/// is open cannot attribute the activity to the wrong customer project.
struct LeadgridExternalContactScope: Equatable, Sendable {
    let organizationId: String
    let projectId: String
    let leadId: String

    static func resolve(
        activeOrganizationId: String?,
        activeProjectId: String?,
        leadId: String?,
        leadProjectId: String?
    ) -> Self? {
        guard let organizationId = normalized(activeOrganizationId),
              let projectId = normalized(activeProjectId),
              let scopedLeadId = normalized(leadId),
              let scopedLeadProjectId = normalized(leadProjectId),
              scopedLeadProjectId == projectId else { return nil }
        return .init(
            organizationId: organizationId,
            projectId: projectId,
            leadId: scopedLeadId)
    }

    func isStillActive(
        organizationId activeOrganizationId: String?,
        projectId activeProjectId: String?
    ) -> Bool {
        Self.normalized(activeOrganizationId) == organizationId
            && Self.normalized(activeProjectId) == projectId
    }

    private static func normalized(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed
    }
}

/// One external app handoff maps to one logical CRM write. A retry reuses the
/// same UUID, while a genuinely new handoff receives a new UUID.
struct LeadgridExternalContactAttempt: Equatable, Sendable {
    private(set) var channel: LeadgridExternalContactChannel?
    private(set) var actionId: UUID?
    private(set) var occurredAt: Date?
    private(set) var scope: LeadgridExternalContactScope?
    private(set) var isFinalized = false

    var canConfirmOrRetry: Bool {
        channel != nil && actionId != nil && occurredAt != nil && !isFinalized
    }

    mutating func begin(
        channel: LeadgridExternalContactChannel,
        actionId: UUID = UUID(),
        occurredAt: Date = Date(),
        scope: LeadgridExternalContactScope? = nil
    ) {
        self.channel = channel
        self.actionId = actionId
        self.occurredAt = occurredAt
        self.scope = scope
        isFinalized = false
    }

    mutating func cancel() {
        channel = nil
        actionId = nil
        occurredAt = nil
        scope = nil
        isFinalized = false
    }

    mutating func finalize() {
        channel = nil
        actionId = nil
        occurredAt = nil
        scope = nil
        isFinalized = true
    }
}

/// Keeps the post-handoff question pending while Leadgrid is inactive.
struct LeadgridExternalContactPresentationState: Equatable, Sendable {
    private(set) var hasPendingConfirmation = false
    private(set) var isAwaitingExternalResult = false
    private(set) var observedInactiveSinceHandoff = false

    mutating func beginHandoff() {
        hasPendingConfirmation = false
        isAwaitingExternalResult = true
        observedInactiveSinceHandoff = false
    }

    mutating func sceneActivityDidChange(isActive: Bool) {
        guard isAwaitingExternalResult || hasPendingConfirmation else { return }
        if !isActive {
            observedInactiveSinceHandoff = true
        }
    }

    mutating func externalAppDidOpen() {
        isAwaitingExternalResult = false
        hasPendingConfirmation = true
    }

    mutating func consumeConfirmationIfActive(_ isSceneActive: Bool) -> Bool {
        guard isSceneActive,
              hasPendingConfirmation,
              observedInactiveSinceHandoff else { return false }
        hasPendingConfirmation = false
        observedInactiveSinceHandoff = false
        return true
    }

    mutating func consumeContinuousActiveFallback(_ isSceneActive: Bool) -> Bool {
        guard isSceneActive,
              hasPendingConfirmation,
              !observedInactiveSinceHandoff else { return false }
        hasPendingConfirmation = false
        return true
    }

    mutating func cancel() {
        hasPendingConfirmation = false
        isAwaitingExternalResult = false
        observedInactiveSinceHandoff = false
    }
}

struct LeadgridExternalContactRecord: Equatable, Sendable {
    let actionId: UUID
    let visitType: String
    let activityKind: String?
    let conversationSummary: String
    let occurredAt: Date

    static func make(
        channel: LeadgridExternalContactChannel,
        lifecycle: LeadgridExternalContactLifecycle,
        occurredAt: Date = Date(),
        actionId: UUID = UUID()
    ) -> Self? {
        guard lifecycle == .completed else { return nil }
        switch channel {
        case .phone:
            return .init(
                actionId: actionId,
                visitType: "phone",
                activityKind: "call",
                conversationSummary: "Brukeren bekreftet at telefonsamtalen ble gjennomført.",
                occurredAt: occurredAt)
        case .sms:
            return .init(
                actionId: actionId,
                visitType: "sms",
                activityKind: "sms",
                conversationSummary: "Brukeren bekreftet at en SMS ble sendt.",
                occurredAt: occurredAt)
        case .whatsapp:
            return .init(
                actionId: actionId,
                visitType: "whatsapp",
                activityKind: "whatsapp",
                conversationSummary: "Brukeren bekreftet at en WhatsApp-melding ble sendt.",
                occurredAt: occurredAt)
        case .email:
            return .init(
                actionId: actionId,
                visitType: "email",
                activityKind: "email",
                conversationSummary: "Brukeren bekreftet at en e-post ble sendt.",
                occurredAt: occurredAt)
        }
    }

    var requestBody: [String: Any] {
        var body: [String: Any] = [
            "visitType": visitType,
            "visitDatetime": ISO8601DateFormatter().string(from: occurredAt),
            "conversationSummary": conversationSummary,
            "notes": conversationSummary,
        ]
        if let activityKind { body["activityKind"] = activityKind }
        return body
    }

    @MainActor
    func persist(
        api: APIClient,
        organizationId: String,
        projectId: String,
        leadId: String
    ) async -> OfflineResilientActions.WriteDisposition {
        await OfflineResilientActions.logVisit(
            api: api,
            organizationId: organizationId,
            projectId: projectId,
            leadId: leadId,
            payload: .init(
                visitType: visitType,
                conversationSummary: conversationSummary,
                contactPerson: nil,
                notes: conversationSummary,
                newStatus: nil,
                nextAction: nil,
                nextFollowUpAt: nil,
                visitDatetime: ISO8601DateFormatter().string(from: occurredAt),
                activityKind: activityKind),
            actionId: actionId)
    }
}

struct LeadgridExternalContactRequest: Equatable, Sendable {
    let url: URL
    let channel: LeadgridExternalContactChannel
    let leadId: String?
    let leadProjectId: String?
}

/// Hosts the confirmation and persistence lifecycle outside menus and context
/// menus, whose transient content disappears immediately after a selection.
private struct LeadgridContactHandoffModifier: ViewModifier {
    @Binding var request: LeadgridExternalContactRequest?

    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @State private var attempt = LeadgridExternalContactAttempt()
    @State private var confirmationPresentation = LeadgridExternalContactPresentationState()
    @State private var showingConfirmation = false
    @State private var isRecording = false
    @State private var isOpeningExternalApp = false
    @State private var noticeTitle = ""
    @State private var noticeMessage: String?

    func body(content: Content) -> some View {
        content
            .onChange(of: request) { _, newRequest in
                guard let newRequest else { return }
                request = nil
                openExternalApp(newRequest)
            }
            .onChange(of: scenePhase) { _, phase in
                presentPendingConfirmationIfPossible(phase)
            }
            .confirmationDialog(
                confirmationTitle,
                isPresented: $showingConfirmation,
                titleVisibility: .visible
            ) {
                Button("Ja, loggfør") {
                    Task { await persistConfirmedCompletion() }
                }
                .disabled(isRecording)
                Button("Nei, ikke loggfør", role: .cancel) {
                    confirmationPresentation.cancel()
                    attempt.cancel()
                }
            } message: {
                Text("Leadgrid registrerer ingenting før du bekrefter dette.")
            }
            .alert(
                noticeTitle,
                isPresented: Binding(
                    get: { noticeMessage != nil },
                    set: { if !$0 { noticeMessage = nil } }
                )
            ) {
                if attempt.canConfirmOrRetry, attempt.scope != nil {
                    Button("Prøv å loggføre igjen") {
                        Task { await persistConfirmedCompletion() }
                    }
                }
                Button("OK", role: .cancel) {}
            } message: {
                Text(noticeMessage ?? "")
            }
    }

    private var confirmationTitle: String {
        switch attempt.channel {
        case .phone: return "Ble telefonsamtalen gjennomført?"
        case .email: return "Ble e-posten sendt?"
        case .sms: return "Ble SMS-en sendt?"
        case .whatsapp: return "Ble WhatsApp-meldingen sendt?"
        case nil: return "Ble kontakten gjennomført?"
        }
    }

    @MainActor
    private func openExternalApp(_ contactRequest: LeadgridExternalContactRequest) {
        guard !isRecording,
              !isOpeningExternalApp,
              !confirmationPresentation.hasPendingConfirmation,
              !showingConfirmation else { return }
        let scope = LeadgridExternalContactScope.resolve(
            activeOrganizationId: appState.activeOrganizationId,
            activeProjectId: appState.activeLeadgridProjectId,
            leadId: contactRequest.leadId,
            leadProjectId: contactRequest.leadProjectId)
        let actionId = UUID()
        attempt.begin(
            channel: contactRequest.channel,
            actionId: actionId,
            scope: scope)
        confirmationPresentation.beginHandoff()
        isOpeningExternalApp = true
        UIApplication.shared.open(contactRequest.url) { opened in
            Task { @MainActor in
                isOpeningExternalApp = false
                if opened {
                    confirmationPresentation.externalAppDidOpen()
                    confirmationPresentation.sceneActivityDidChange(isActive: scenePhase == .active)
                    presentPendingConfirmationIfPossible(scenePhase)
                    scheduleContinuousActiveFallback(for: actionId)
                } else {
                    confirmationPresentation.cancel()
                    attempt.cancel()
                    noticeTitle = "Kunne ikke åpne appen"
                    noticeMessage = "Kontakten ble ikke startet og er ikke loggført."
                }
            }
        }
    }

    @MainActor
    private func scheduleContinuousActiveFallback(for actionId: UUID) {
        Task { @MainActor in
            do {
                try await Task.sleep(for: .milliseconds(750))
            } catch {
                return
            }
            guard attempt.actionId == actionId, scenePhase == .active else { return }
            if confirmationPresentation.consumeContinuousActiveFallback(true) {
                showingConfirmation = true
            }
        }
    }

    @MainActor
    private func presentPendingConfirmationIfPossible(_ phase: ScenePhase) {
        confirmationPresentation.sceneActivityDidChange(isActive: phase == .active)
        if confirmationPresentation.consumeConfirmationIfActive(phase == .active) {
            showingConfirmation = true
        }
    }

    @MainActor
    private func persistConfirmedCompletion() async {
        guard !isRecording,
              let attemptedChannel = attempt.channel,
              let actionId = attempt.actionId,
              let occurredAt = attempt.occurredAt,
              attempt.canConfirmOrRetry,
              let record = LeadgridExternalContactRecord.make(
                channel: attemptedChannel,
                lifecycle: .completed,
                occurredAt: occurredAt,
                actionId: actionId
              ) else { return }
        guard let scope = attempt.scope else {
            attempt.cancel()
            noticeTitle = "Kan ikke loggføre sikkert"
            noticeMessage =
                "Leaden mangler en entydig kobling til aktivt kundeprosjekt. Kontakten er ikke registrert."
            return
        }
        guard scope.isStillActive(
            organizationId: appState.activeOrganizationId,
            projectId: appState.activeLeadgridProjectId
        ) else {
            noticeTitle = "Kundeprosjektet er byttet"
            noticeMessage =
                "Gå tilbake til prosjektet kontakten ble startet fra og prøv loggføringen igjen."
            return
        }
        guard let api = appState.api else {
            noticeTitle = "Kunne ikke loggføre"
            noticeMessage = "Du må være innlogget. Kontakten er ikke registrert."
            return
        }

        isRecording = true
        defer { isRecording = false }
        switch await record.persist(
            api: api,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            leadId: scope.leadId
        ) {
        case .sent:
            attempt.finalize()
            noticeTitle = "Aktivitet loggført"
            noticeMessage = "Kontakten er lagret på leaden."
            await appState.refreshAll()
        case .queued:
            attempt.finalize()
            noticeTitle = "Lagret for synkronisering"
            noticeMessage = LeadgridExternalContactCopy.queuedLoggingMessage
        case .rejected(let message):
            noticeTitle = "Kunne ikke loggføre"
            noticeMessage = message
        }
    }
}

extension View {
    func leadgridContactHandoff(
        request: Binding<LeadgridExternalContactRequest?>
    ) -> some View {
        modifier(LeadgridContactHandoffModifier(request: request))
    }
}

/// Reusable button for normal lead surfaces. Menus use the same host modifier
/// on their persistent parent view so the confirmation survives menu dismissal.
struct LeadgridContactHandoffButton<Label: View>: View {
    let url: URL
    let channel: LeadgridExternalContactChannel
    let leadId: String?
    let leadProjectId: String?
    private let label: Label

    @State private var request: LeadgridExternalContactRequest?

    init(
        url: URL,
        channel: LeadgridExternalContactChannel,
        leadId: String?,
        projectId: String?,
        @ViewBuilder label: () -> Label
    ) {
        self.url = url
        self.channel = channel
        self.leadId = leadId
        self.leadProjectId = projectId
        self.label = label()
    }

    var body: some View {
        Button {
            request = .init(
                url: url,
                channel: channel,
                leadId: leadId,
                leadProjectId: leadProjectId)
        } label: {
            label
        }
        .leadgridContactHandoff(request: $request)
    }
}
