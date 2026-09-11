// FollowUpCommSheets.swift
//
// Tre kommunikasjons-pickere som åpnes fra FollowUpDetailSheet:
//   - VideoMeetingPicker:    FaceTime / Google Meet (ekte tjeneste-handoff)
//   - SMSPicker:             Vanlig SMS / WhatsApp
//   - EmailTemplatePicker:   prosjekt- og leadtilpassede maler → ekstern e-postapp

import SwiftUI

private enum FcBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.06)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.45)
}

// MARK: - VideoMeetingPicker (FaceTime / Google Meet)

struct VideoMeetingPicker: View {
    let lead: LeadRow
    @Environment(\.dismiss) private var dismiss
    @State private var selected: Provider = .facetime

    enum Provider: String, CaseIterable, Hashable {
        case facetime = "FaceTime"
        case googleMeet = "Google Meet"
        var icon: String {
            switch self {
            case .facetime:   return "video.circle.fill"
            case .googleMeet: return "video.fill"
            }
        }
        var color: Color {
            switch self {
            case .facetime:   return FcBrand.green
            case .googleMeet: return FcBrand.blue
            }
        }
        var subtitle: String {
            switch self {
            case .facetime:   return "Apple — fungerer på iPhone, iPad, Mac, web"
            case .googleMeet: return "Krever Google-konto eller anonym tilgang"
            }
        }
    }

    private var providerURL: URL? {
        switch selected {
        case .facetime:
            let destination = lead.displayPhone ?? lead.displayEmail
            guard let destination, !destination.isEmpty else { return nil }
            let encoded = destination.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)
                ?? destination
            return URL(string: "facetime://\(encoded)")
        case .googleMeet:
            return URL(string: "https://meet.google.com/new")
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                leadHeader
                Text("Velg video-tjeneste")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(FcBrand.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                VStack(spacing: 10) {
                    ForEach(Provider.allCases, id: \.self) { p in
                        row(p)
                    }
                }
                .padding(.horizontal, 20)
                Text("Leadgrid lager ikke en syntetisk møtelenke. Tjenesten åpnes og oppretter eller starter møtet selv.")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(FcBrand.textSecondary)
                    .padding(.horizontal, 20)
                Spacer()
                startBar
            }
            .padding(.top, 12)
            .background(FcBrand.bg.ignoresSafeArea())
            .navigationTitle("Video-møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(FcBrand.purpleLight)
                }
            }
            .toolbarBackground(FcBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.medium])
    }

    private var leadHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(lead.companyColor.opacity(0.22))
                Image(systemName: "building.2.fill")
                    .font(.appScaled(size: 16, weight: .semibold))
                    .foregroundStyle(lead.companyColor)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(lead.company)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Med \(lead.contactName)")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(FcBrand.textSecondary)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
    }

    private func row(_ p: Provider) -> some View {
        let isSelected = selected == p
        return Button { selected = p } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(p.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: p.icon)
                        .font(.appScaled(size: 18, weight: .semibold))
                        .foregroundStyle(p.color)
                }
                .frame(width: 46, height: 46)
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.rawValue)
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text(p.subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(FcBrand.textSecondary)
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.appScaled(size: 18))
                    .foregroundStyle(isSelected ? p.color : FcBrand.stroke)
            }
            .padding(12)
            .background(
                isSelected ? p.color.opacity(0.10) : FcBrand.card,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? p.color.opacity(0.45) : FcBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var startBar: some View {
        Button {
            guard let providerURL else { return }
            UIApplication.shared.open(providerURL)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: selected.icon)
                    .font(.appScaled(size: 14, weight: .bold))
                Text("Åpne \(selected.rawValue)")
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [selected.color, selected.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .disabled(providerURL == nil)
        .opacity(providerURL == nil ? 0.45 : 1)
        .padding(.horizontal, 20).padding(.bottom, 20)
    }
}

// MARK: - SMSPicker (SMS / WhatsApp)

struct SMSPicker: View {
    let lead: LeadRow
    let phoneNumber: String
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @State private var selected: Channel = .sms
    @State private var quickMessage: String = ""
    @State private var contactAttempt = LeadgridExternalContactAttempt()
    @State private var completionPresentation = LeadgridExternalContactPresentationState()
    @State private var completionConfirmationPresented = false
    @State private var completionError: String?
    @State private var completionAlertTitle = "Kunne ikke loggføre"
    @State private var isRecordingCompletion = false
    @State private var isOpeningExternalApp = false

    enum Channel: String, CaseIterable, Hashable {
        case sms = "Vanlig SMS"
        case whatsapp = "WhatsApp"
        var icon: String {
            switch self {
            case .sms:      return "message.fill"
            case .whatsapp: return "phone.bubble"
            }
        }
        var color: Color {
            switch self {
            case .sms:      return FcBrand.yellow
            case .whatsapp: return FcBrand.green
            }
        }
        var subtitle: String {
            switch self {
            case .sms:      return "Standard tekstmelding via iPhone-app"
            case .whatsapp: return "Krever WhatsApp installert + tilkoblet konto"
            }
        }
    }

    private let quickMessages = [
        "Hei! Har du tid til en kort prat denne uka?",
        "Hei! Ringer deg om 5 min — fungerer det?",
        "Hei! Sender deg en e-post nå med info. La meg vite hva du tenker!",
        "Hei! Ville bare sjekke om tidspunktet vi avtalte fortsatt passer.",
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    leadHeader
                    channelSelector
                    quickMessagesCard
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(FcBrand.bg.ignoresSafeArea())
            .navigationTitle("SMS")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(FcBrand.purpleLight)
                }
            }
            .toolbarBackground(FcBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { startBar }
        }
        .presentationDetents([.medium, .large])
        .onChange(of: scenePhase) { _, phase in
            presentCompletionConfirmationIfPossible(phase)
        }
        .confirmationDialog(
            contactAttempt.channel.map { "Ble \($0.title) sendt?" } ?? "Ble meldingen sendt?",
            isPresented: $completionConfirmationPresented,
            titleVisibility: .visible
        ) {
            Button("Ja, loggfør som sendt") {
                Task { await recordConfirmedCompletion() }
            }
            Button("Nei, ikke loggfør") {
                isOpeningExternalApp = false
                completionPresentation.cancel()
                contactAttempt.cancel()
                dismiss()
            }
            Button("Tilbake", role: .cancel) {
                isOpeningExternalApp = false
                completionPresentation.cancel()
                contactAttempt.cancel()
            }
        } message: {
            Text("Å åpne en ekstern app betyr ikke at meldingen faktisk ble sendt. Leadgrid logger bare svaret ditt.")
        }
        .alert(completionAlertTitle, isPresented: Binding(
            get: { completionError != nil },
            set: { if !$0 { completionError = nil } }
        )) {
            if contactAttempt.canConfirmOrRetry {
                Button("Prøv igjen") { Task { await recordConfirmedCompletion() } }
            }
            Button(contactAttempt.isFinalized ? "Lukk" : "OK", role: .cancel) {
                if contactAttempt.isFinalized { dismiss() }
            }
        } message: {
            Text(completionError ?? "Ukjent feil")
        }
    }

    private var leadHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(FcBrand.green.opacity(0.22))
                Image(systemName: "phone.fill")
                    .font(.appScaled(size: 16, weight: .semibold))
                    .foregroundStyle(FcBrand.green)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(lead.contactName)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text(phoneNumber)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(FcBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(FcBrand.stroke, lineWidth: 1))
    }

    private var channelSelector: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Velg kanal")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(FcBrand.textSecondary)
            ForEach(Channel.allCases, id: \.self) { c in
                channelRow(c)
            }
        }
    }

    private func channelRow(_ c: Channel) -> some View {
        let isSelected = selected == c
        return Button { selected = c } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(c.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: c.icon)
                        .font(.appScaled(size: 16, weight: .semibold))
                        .foregroundStyle(c.color)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(c.rawValue)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(c.subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(FcBrand.textSecondary)
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.appScaled(size: 17))
                    .foregroundStyle(isSelected ? c.color : FcBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? c.color.opacity(0.10) : FcBrand.card,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? c.color.opacity(0.45) : FcBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var quickMessagesCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Hurtigmeldinger")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(FcBrand.textSecondary)
            VStack(spacing: 6) {
                ForEach(quickMessages, id: \.self) { msg in
                    Button { quickMessage = msg } label: {
                        HStack(spacing: 8) {
                            Image(systemName: quickMessage == msg ? "checkmark.circle.fill" : "circle")
                                .font(.appScaled(size: 13))
                                .foregroundStyle(quickMessage == msg ? FcBrand.green : FcBrand.stroke)
                            Text(msg)
                                .font(.appScaled(size: 12))
                                .foregroundStyle(.white)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(10)
                        .background(
                            quickMessage == msg ? FcBrand.green.opacity(0.08) : FcBrand.cardHi,
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(quickMessage == msg ? FcBrand.green.opacity(0.4) : FcBrand.stroke, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var startBar: some View {
        Button {
            sendMessage()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: selected.icon)
                    .font(.appScaled(size: 14, weight: .bold))
                Text("Åpne \(selected.rawValue)")
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [selected.color, selected.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .disabled(
            isRecordingCompletion
                || isOpeningExternalApp
                || completionPresentation.hasPendingConfirmation
                || completionConfirmationPresented
                || contactAttempt.isFinalized)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            FcBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(FcBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    private func sendMessage() {
        guard !isOpeningExternalApp,
              !completionPresentation.hasPendingConfirmation,
              !completionConfirmationPresented else { return }
        let actionId = UUID()
        let scope = LeadgridExternalContactScope.resolve(
            activeOrganizationId: appState.activeOrganizationId,
            activeProjectId: appState.activeLeadgridProjectId,
            leadId: lead.backendId,
            leadProjectId: lead.projectId)
        let cleaned = phoneNumber.filter { $0.isNumber || $0 == "+" }
        guard !cleaned.isEmpty else {
            completionAlertTitle = "Kunne ikke åpne melding"
            completionError = "Telefonnummeret er ugyldig. Ingenting er loggført."
            return
        }
        let encodedMsg = quickMessage.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let initiatedChannel: LeadgridExternalContactChannel
        let urlString: String
        switch selected {
        case .sms:
            initiatedChannel = .sms
            urlString = "sms:\(cleaned)&body=\(encodedMsg)"
        case .whatsapp:
            initiatedChannel = .whatsapp
            let waPhone = cleaned.hasPrefix("+") ? String(cleaned.dropFirst()) : cleaned
            urlString = "whatsapp://send?phone=\(waPhone)&text=\(encodedMsg)"
        }
        guard let url = URL(string: urlString) else {
            completionAlertTitle = "Kunne ikke åpne melding"
            completionError = "Meldingslenken er ugyldig. Ingenting er loggført."
            return
        }

        completionPresentation.beginHandoff()
        isOpeningExternalApp = true
        UIApplication.shared.open(url) { opened in
            Task { @MainActor in
                if opened {
                    isOpeningExternalApp = false
                    contactAttempt.begin(
                        channel: initiatedChannel,
                        actionId: actionId,
                        scope: scope)
                    completionPresentation.externalAppDidOpen()
                    completionPresentation.sceneActivityDidChange(
                        isActive: scenePhase == .active)
                    presentCompletionConfirmationIfPossible(scenePhase)
                    scheduleCompletionConfirmationFallback(for: actionId)
                    return
                }
                guard initiatedChannel == .whatsapp,
                      let smsURL = URL(string: "sms:\(cleaned)&body=\(encodedMsg)") else {
                    isOpeningExternalApp = false
                    completionPresentation.cancel()
                    contactAttempt.cancel()
                    completionAlertTitle = "Kunne ikke åpne melding"
                    completionError = "Meldingsappen kunne ikke åpnes. Ingenting er loggført."
                    return
                }
                UIApplication.shared.open(smsURL) { smsOpened in
                    Task { @MainActor in
                        guard smsOpened else {
                            isOpeningExternalApp = false
                            completionPresentation.cancel()
                            contactAttempt.cancel()
                            completionAlertTitle = "Kunne ikke åpne melding"
                            completionError =
                                "Verken WhatsApp eller Meldinger kunne åpnes. Ingenting er loggført."
                            return
                        }
                        isOpeningExternalApp = false
                        contactAttempt.begin(
                            channel: .sms,
                            actionId: actionId,
                            scope: scope)
                        completionPresentation.externalAppDidOpen()
                        completionPresentation.sceneActivityDidChange(
                            isActive: scenePhase == .active)
                        presentCompletionConfirmationIfPossible(scenePhase)
                        scheduleCompletionConfirmationFallback(for: actionId)
                    }
                }
            }
        }
    }

    @MainActor
    private func scheduleCompletionConfirmationFallback(for actionId: UUID) {
        Task { @MainActor in
            do {
                try await Task.sleep(for: .milliseconds(750))
            } catch {
                return
            }
            guard contactAttempt.actionId == actionId,
                  scenePhase == .active else { return }
            if completionPresentation.consumeContinuousActiveFallback(true) {
                completionConfirmationPresented = true
            }
        }
    }

    @MainActor
    private func presentCompletionConfirmationIfPossible(_ phase: ScenePhase) {
        completionPresentation.sceneActivityDidChange(isActive: phase == .active)
        if completionPresentation.consumeConfirmationIfActive(phase == .active) {
            completionConfirmationPresented = true
        }
    }

    @MainActor
    private func recordConfirmedCompletion() async {
        guard !isRecordingCompletion,
              let channel = contactAttempt.channel,
              let actionId = contactAttempt.actionId,
              let occurredAt = contactAttempt.occurredAt,
              contactAttempt.canConfirmOrRetry else { return }
        guard let record = LeadgridExternalContactRecord.make(
            channel: channel,
            lifecycle: .completed,
            occurredAt: occurredAt,
            actionId: actionId
        ) else { return }
        guard let scope = contactAttempt.scope else {
            isOpeningExternalApp = false
            completionPresentation.cancel()
            contactAttempt.cancel()
            completionAlertTitle = "Kan ikke loggføre sikkert"
            completionError =
                "Leaden mangler en entydig kobling til aktivt kundeprosjekt. Kontakten er ikke registrert."
            return
        }
        guard scope.isStillActive(
            organizationId: appState.activeOrganizationId,
            projectId: appState.activeLeadgridProjectId
        ) else {
            completionAlertTitle = "Kundeprosjektet er byttet"
            completionError =
                "Gå tilbake til prosjektet kontakten ble startet fra og prøv loggføringen igjen."
            return
        }
        guard let api = appState.api else {
            completionAlertTitle = "Kunne ikke loggføre"
            completionError = "Du må være innlogget. Kontakten er ikke registrert."
            return
        }
        isRecordingCompletion = true
        defer { isRecordingCompletion = false }
        switch await record.persist(
            api: api,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            leadId: scope.leadId
        ) {
        case .sent:
            await appState.refreshAll()
            contactAttempt.finalize()
            dismiss()
        case .queued:
            contactAttempt.finalize()
            completionAlertTitle = "Lagret for synkronisering"
            completionError = LeadgridExternalContactCopy.queuedLoggingMessage
        case .rejected(let message):
            completionAlertTitle = "Kunne ikke loggføre"
            completionError = message
        }
    }
}

// MARK: - Lead-aware outreach templates

enum LeadOutreachAccent: Hashable {
    case purpleLight, blue, green, yellow, orange, purple

    var color: Color {
        switch self {
        case .purpleLight: return FcBrand.purpleLight
        case .blue: return FcBrand.blue
        case .green: return FcBrand.green
        case .yellow: return FcBrand.yellow
        case .orange: return FcBrand.orange
        case .purple: return FcBrand.purple
        }
    }
}

struct LeadOutreachTemplate: Identifiable, Hashable {
    let id: String
    let title: String
    let description: String
    let icon: String
    let accent: LeadOutreachAccent
    let subject: String
    let body: String
}

struct LeadOutreachContext: Hashable {
    let projectName: String
    let company: String
    let category: String
    let contactName: String
    let contactRole: String
    let city: String?
    let websiteURL: String?
    let organizationNumber: String?
    let status: LeadRow.LeadStatus
    let senderName: String

    init(lead: LeadRow, projectName: String?, senderName: String) {
        self.projectName = projectName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.company = lead.company.trimmingCharacters(in: .whitespacesAndNewlines)
        self.category = lead.category.trimmingCharacters(in: .whitespacesAndNewlines)
        self.contactName = lead.contactName.trimmingCharacters(in: .whitespacesAndNewlines)
        self.contactRole = lead.contactRole.trimmingCharacters(in: .whitespacesAndNewlines)
        self.city = lead.city?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        self.websiteURL = lead.websiteURL?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        self.organizationNumber = lead.organizationNumber?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        self.status = lead.status
        let normalizedSender = senderName.trimmingCharacters(in: .whitespacesAndNewlines)
        self.senderName = normalizedSender.isEmpty || normalizedSender == "Gjest"
            ? "Salgsteamet"
            : normalizedSender
    }

    var firstName: String? {
        contactName.split(separator: " ").first.map(String.init)
    }

    var greeting: String {
        firstName.map { "Hei \($0)," } ?? "Hei,"
    }

    var location: String { city ?? "området deres" }
}

struct LeadOutreachKit: Hashable {
    let title: String
    let audience: String
    let isDentum: Bool
    let recommendedTemplateID: String
    let templates: [LeadOutreachTemplate]
    let personalizationFacts: [String]
}

enum LeadOutreachTemplateEngine {
    static func makeKit(context c: LeadOutreachContext) -> LeadOutreachKit {
        let isDentum = c.projectName.localizedCaseInsensitiveContains("dentum")
        if isDentum {
            return LeadOutreachKit(
                title: "Dentum-oppsett",
                audience: "7 maler for tannklinikker",
                isDentum: true,
                recommendedTemplateID: dentumRecommendation(for: c.status),
                templates: dentumTemplates(c),
                personalizationFacts: facts(c)
            )
        }
        return LeadOutreachKit(
            title: c.projectName.isEmpty ? "Standardoppsett" : "\(c.projectName)-oppsett",
            audience: "6 generelle B2B-maler",
            isDentum: false,
            recommendedTemplateID: genericRecommendation(for: c.status),
            templates: genericTemplates(c),
            personalizationFacts: facts(c)
        )
    }

    private static func facts(_ c: LeadOutreachContext) -> [String] {
        [c.company, c.firstName, c.contactRole.nilIfEmpty, c.city, c.websiteURL]
            .compactMap { $0 }
    }

    private static func dentumRecommendation(for status: LeadRow.LeadStatus) -> String {
        switch status {
        case .contacted: return "dentum-follow-up"
        case .interested: return "dentum-next-step"
        case .hot, .warm: return "dentum-short-call"
        case .newLead, .notContacted: return "dentum-pilot"
        }
    }

    private static func genericRecommendation(for status: LeadRow.LeadStatus) -> String {
        switch status {
        case .contacted: return "generic-follow-up"
        case .interested: return "generic-proposal"
        case .hot, .warm: return "generic-short-call"
        case .newLead, .notContacted: return "generic-introduction"
        }
    }

    private static func dentumTemplates(_ c: LeadOutreachContext) -> [LeadOutreachTemplate] {
        let signoff = "Med vennlig hilsen,\n\(c.senderName)\nDentum"
        return [
            LeadOutreachTemplate(
                id: "dentum-pilot",
                title: "Invitasjon til pilot",
                description: "Første kontakt med et konkret og uforpliktende tilbud.",
                icon: "sparkles",
                accent: .purpleLight,
                subject: "Kan \(c.company) bli med i Dentum-piloten?",
                body: """
                \(c.greeting)

                Jeg tar kontakt fra Dentum, en uavhengig markedsplass som hjelper pasienter i \(c.location) med å sammenligne priser, anmeldelser og ledige timer hos tannleger.

                Vi vil gjerne invitere \(c.company) med i pilotperioden. Det er gratis og uforpliktende å være med i piloten. Dere styrer selv veiledende priser og åpningstider, og vi hjelper med å sette opp klinikkprofilen.

                Har du tid til en kort prat på 15 minutter denne uken?

                \(signoff)
                """
            ),
            LeadOutreachTemplate(
                id: "dentum-profile",
                title: "Klinikkprofil",
                description: "Forklarer hva Dentum setter opp for klinikken.",
                icon: "building.2.crop.circle.fill",
                accent: .blue,
                subject: "Vi setter opp Dentum-profilen for \(c.company)",
                body: """
                \(c.greeting)

                En Dentum-profil gjør det enklere for pasienter i \(c.location) å finne \(c.company), se veiledende priser og gå videre til ledige timer eller en uforpliktende forespørsel.

                Oppsettet er enkelt: dere sender oss prisene, åpningstidene og informasjonen dere vil vise. Vi setter opp profilen og sender den til godkjenning før publisering.

                Skal jeg sende en kort oversikt over det vi trenger fra dere?

                \(signoff)
                """
            ),
            LeadOutreachTemplate(
                id: "dentum-demand",
                title: "Synlighet og forespørsler",
                description: "Knytter klinikken til pasienter som aktivt leter.",
                icon: "person.3.fill",
                accent: .green,
                subject: "Mer synlighet for \(c.company) i \(c.location)",
                body: """
                \(c.greeting)

                Pasienter bruker Dentum for å sammenligne tannklinikker, priser og ledige timer før de tar kontakt. Vi ønsker å gjøre \(c.company) synlig når noen aktivt leter etter tannbehandling i \(c.location).

                Klinikken kan motta uforpliktende forespørsler med ønsket behandling og tidspunkt. Dere bestemmer selv om og hvordan dere følger dem opp.

                Kan vi ta en kort gjennomgang av hvordan dette vil se ut for klinikken deres?

                \(signoff)
                """
            ),
            LeadOutreachTemplate(
                id: "dentum-prices",
                title: "Priser og tillit",
                description: "Fokuserer på kontroll og tydelig pristransparens.",
                icon: "list.bullet.clipboard.fill",
                accent: .yellow,
                subject: "Veiledende priser for \(c.company) på Dentum",
                body: """
                \(c.greeting)

                Dentum lar \(c.company) vise egne veiledende priser på vanlige behandlinger. Prisene er deres, kan oppdateres, og endelig pris fastsettes fortsatt av klinikken etter undersøkelse.

                Målet er å gi pasienten et tryggere sammenligningsgrunnlag og klinikken en ryddig profil med tydelige forventninger før første kontakt.

                Vil du at jeg lager et uforpliktende profilutkast med prisfeltene klare?

                \(signoff)
                """
            ),
            LeadOutreachTemplate(
                id: "dentum-short-call",
                title: "Be om kort prat",
                description: "Kort variant for en varm eller prioritert lead.",
                icon: "phone.arrow.up.right.fill",
                accent: .orange,
                subject: "15 minutter om \(c.company) på Dentum?",
                body: """
                \(c.greeting)

                Jeg vil gjerne vise hvordan \(c.company) kan presenteres på Dentum med klinikkprofil, veiledende priser, ledige timer og pasientforespørsler samlet på ett sted.

                Det tar 15 minutter å gå gjennom, og pilotperioden er gratis og uforpliktende. Passer det med en kort prat denne eller neste uke?

                \(signoff)
                """
            ),
            LeadOutreachTemplate(
                id: "dentum-follow-up",
                title: "Vennlig oppfølging",
                description: "Følger opp uten å anta at klinikken har sagt ja.",
                icon: "hand.wave.fill",
                accent: .purple,
                subject: "Følger opp Dentum for \(c.company)",
                body: """
                \(c.greeting)

                Jeg følger kort opp muligheten for å vise \(c.company) på Dentum. Vi hjelper med hele profiloppsettet, og det er gratis og uforpliktende å delta i pilotperioden.

                Er det noe du vil ha avklart før vi eventuelt lager et profilutkast, eller passer det bedre at jeg tar kontakt på et senere tidspunkt?

                \(signoff)
                """
            ),
            LeadOutreachTemplate(
                id: "dentum-next-step",
                title: "Neste steg",
                description: "For en interessert klinikk som vil se oppsettet.",
                icon: "checkmark.seal.fill",
                accent: .green,
                subject: "Neste steg for \(c.company) på Dentum",
                body: """
                \(c.greeting)

                Neste steg er at vi lager et profilutkast for \(c.company). For å gjøre det trenger vi kontaktinformasjon, åpningstider, behandlingsområder, veiledende priser og lenken dere ønsker å bruke for timebestilling.

                Dere får kontrollere alt før noe publiseres. Send gjerne informasjonen i svar på denne e-posten, så setter vi opp første utkast.

                \(signoff)
                """
            ),
        ]
    }

    private static func genericTemplates(_ c: LeadOutreachContext) -> [LeadOutreachTemplate] {
        let signoff = "Med vennlig hilsen,\n\(c.senderName)"
        return [
            .init(id: "generic-introduction", title: "Første kontakt", description: "Kort introduksjon til en ny lead.", icon: "sparkles", accent: .purpleLight, subject: "Kort spørsmål til \(c.company)", body: "\(c.greeting)\n\nJeg tar kontakt fordi jeg gjerne vil forstå prioriteringene til \(c.company) og se om løsningen vår kan være relevant.\n\nHar du tid til en kort og uforpliktende prat denne uken?\n\n\(signoff)"),
            .init(id: "generic-follow-up", title: "Vennlig oppfølging", description: "Følger opp forrige kontakt.", icon: "hand.wave.fill", accent: .purpleLight, subject: "Følger opp — \(c.company)", body: "\(c.greeting)\n\nBare en kort oppfølging for å høre om du ønsker mer informasjon, eller om det passer bedre at jeg tar kontakt senere.\n\nJeg er fleksibel hvis du vil ta en kort prat denne uken.\n\n\(signoff)"),
            .init(id: "generic-proposal", title: "Påminnelse om tilbud", description: "Sjekker at tilbudet kom frem.", icon: "doc.text.fill", accent: .blue, subject: "Tilbud — \(c.company)", body: "\(c.greeting)\n\nJeg ville bare sjekke at tilbudet kom frem og høre om det er noe du vil ha avklart eller justert.\n\nHvis dere ønsker å gå videre, kan vi sammen avklare en realistisk fremdrift.\n\n\(signoff)"),
            .init(id: "generic-short-call", title: "Be om kort prat", description: "Foreslår en 15-minutters avklaring.", icon: "bubble.left.and.bubble.right.fill", accent: .green, subject: "15 minutter om \(c.company)?", body: "\(c.greeting)\n\nHar du tid til en 15-minutters prat denne uken? Jeg vil gjerne høre hva som er viktigst for dere, så vi raskt kan avklare om vi passer.\n\nHvilke tidspunkt passer best?\n\n\(signoff)"),
            .init(id: "generic-missed-call", title: "Returkall", description: "Etter et ubesvart anrop.", icon: "phone.down.fill", accent: .orange, subject: "Prøvde å ringe — \(c.company)", body: "\(c.greeting)\n\nJeg prøvde å ringe, men kom ikke gjennom. Er det et bedre tidspunkt i dag eller i morgen, eller vil du heller ta det på e-post?\n\n\(signoff)"),
            .init(id: "generic-meeting-prep", title: "Møteforberedelse", description: "Sender en enkel agenda før møtet.", icon: "calendar.badge.checkmark", accent: .purple, subject: "Agenda for møtet med \(c.company)", body: "\(c.greeting)\n\nSer frem til møtet. Forslag til kort agenda:\n\n1. Status og behov hos dere\n2. Relevant løsning\n3. Spørsmål og eventuell vei videre\n\nSi gjerne fra om du vil legge til noe.\n\n\(signoff)"),
        ]
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

// MARK: - EmailTemplatePicker (lead-tilpassede maler + app-velger)

struct EmailTemplatePicker: View {
    let lead: LeadRow
    let toEmail: String
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedTemplateID = ""
    @State private var subject: String = ""
    @State private var messageBody: String = ""
    @State private var emailApp: EmailApp = .appleMail
    @State private var customized: Bool = false
    @State private var completionConfirmationPresented = false
    @State private var contactAttempt = LeadgridExternalContactAttempt()
    @State private var completionPresentation = LeadgridExternalContactPresentationState()
    @State private var completionError: String?
    @State private var completionAlertTitle = "Kunne ikke loggføre"
    @State private var isRecordingCompletion = false
    @State private var isOpeningExternalApp = false
    @State private var compliance: LeadgridEmailCompliance?
    @State private var isLoadingCompliance = false
    @State private var complianceError: String?
    @State private var complianceEditorPresented = false

    /// Bruk bare aktivt prosjekts malpakke når leadet faktisk tilhører
    /// prosjektet. Dette hindrer at en stale/mis-skopet rad får Dentum-copy.
    private var outreachProjectName: String? {
        guard let project = appState.activeLeadgridProject else { return nil }
        guard let leadProjectID = lead.projectId else { return project.name }
        return leadProjectID == project.id ? project.name : nil
    }

    private var outreachContext: LeadOutreachContext {
        LeadOutreachContext(
            lead: lead,
            projectName: outreachProjectName,
            senderName: appState.displayName
        )
    }

    private var outreachKit: LeadOutreachKit {
        LeadOutreachTemplateEngine.makeKit(context: outreachContext)
    }

    private var selectedTemplate: LeadOutreachTemplate? {
        outreachKit.templates.first { $0.id == selectedTemplateID }
    }

    enum EmailApp: String, CaseIterable, Hashable {
        case appleMail = "Apple Mail"
        case outlook = "Outlook"
        case gmail = "Gmail"
        var icon: String {
            switch self {
            case .appleMail: return "envelope.fill"
            case .outlook:   return "o.circle.fill"
            case .gmail:     return "g.circle.fill"
            }
        }
        var color: Color {
            switch self {
            case .appleMail: return FcBrand.blue
            case .outlook:   return FcBrand.purpleLight
            case .gmail:     return FcBrand.red
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    leadHeader
                    complianceCard
                    templatesGrid
                    previewCard
                    appPicker
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(FcBrand.bg.ignoresSafeArea())
            .navigationTitle("Klar e-post")
            .accessibilityIdentifier("outreach.email-sheet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(FcBrand.purpleLight)
                }
            }
            .toolbarBackground(FcBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { startBar }
            .onAppear {
                let initial = outreachKit.templates.first {
                    $0.id == outreachKit.recommendedTemplateID
                } ?? outreachKit.templates[0]
                selectedTemplateID = initial.id
                applyTemplate(initial)
            }
            .onChange(of: selectedTemplateID) { _, _ in
                if !customized, let new = selectedTemplate {
                    applyTemplate(new)
                }
            }
            .task(id: complianceTaskID) {
                await loadCompliance()
            }
            .sheet(isPresented: $complianceEditorPresented) {
                LeadgridEmailComplianceEditor(
                    lead: lead,
                    email: toEmail,
                    compliance: $compliance)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            presentCompletionConfirmationIfPossible(phase)
        }
        .confirmationDialog(
            "Ble e-posten sendt?",
            isPresented: $completionConfirmationPresented,
            titleVisibility: .visible
        ) {
            Button("Ja, loggfør som sendt") {
                Task { await recordConfirmedCompletion() }
            }
            Button("Nei, ikke loggfør") {
                isOpeningExternalApp = false
                completionPresentation.cancel()
                contactAttempt.cancel()
                dismiss()
            }
            Button("Tilbake", role: .cancel) {
                isOpeningExternalApp = false
                completionPresentation.cancel()
                contactAttempt.cancel()
            }
        } message: {
            Text("E-postappen gir ikke Leadgrid leveringsstatus. Aktiviteten lagres bare når du bekrefter den.")
        }
        .alert(completionAlertTitle, isPresented: Binding(
            get: { completionError != nil },
            set: { if !$0 { completionError = nil } }
        )) {
            if contactAttempt.canConfirmOrRetry {
                Button("Prøv igjen") { Task { await recordConfirmedCompletion() } }
            }
            Button(contactAttempt.isFinalized ? "Lukk" : "OK", role: .cancel) {
                if contactAttempt.isFinalized { dismiss() }
            }
        } message: {
            Text(completionError ?? "Ukjent feil")
        }
    }

    private func applyTemplate(_ template: LeadOutreachTemplate?) {
        guard let template else { return }
        subject = template.subject
        messageBody = template.body
        customized = false
    }

    private var complianceTaskID: String {
        "\(lead.backendId ?? "missing")|\(lead.projectId ?? "missing")|\(appState.activeOrganizationId ?? "missing")|\(toEmail.lowercased())"
    }

    @MainActor
    private func loadCompliance() async {
        if ProcessInfo.processInfo.environment["QA_TOUR"] == "dentum-outreach" {
            compliance = ProcessInfo.processInfo.environment["QA_OUTREACH_COMPLIANCE"] == "named-person"
                ? .qaNamedPersonBlocked(email: toEmail)
                : .dentumQAVerifiedShared(email: toEmail)
            complianceError = nil
            return
        }
        guard let api = appState.api,
              let leadID = lead.backendId,
              let projectID = lead.projectId,
              let organizationID = appState.activeOrganizationId
        else {
            compliance = nil
            complianceError = "Leadgrid må være innlogget i riktig kundeprosjekt for å kontrollere adressen."
            return
        }
        isLoadingCompliance = true
        defer { isLoadingCompliance = false }
        do {
            let result = try await api.fetchOutreachCompliance(
                leadId: leadID,
                projectId: projectID,
                organizationId: organizationID)
            let returnedEmail = (result.normalizedEmail ?? result.email)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            guard returnedEmail == toEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() else {
                compliance = nil
                complianceError = "E-postadressen er endret. Lukk arket og åpne leaden på nytt."
                return
            }
            compliance = result
            complianceError = nil
        } catch {
            compliance = nil
            complianceError = "Kontrollen kunne ikke hentes. Markedsførings-e-post er blokkert til Leadgrid har kontakt med serveren."
        }
    }

    private var complianceCard: some View {
        let allowed = compliance?.permitsMarketing(to: toEmail) == true
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: allowed ? "checkmark.shield.fill" : "exclamationmark.shield.fill")
                    .font(.appScaled(size: 18, weight: .semibold))
                    .foregroundStyle(allowed ? FcBrand.green : FcBrand.orange)
                VStack(alignment: .leading, spacing: 4) {
                    if isLoadingCompliance {
                        Text("Kontrollerer utsendelsesgrunnlag …")
                            .accessibilityIdentifier("outreach.compliance.loading")
                    } else if let compliance {
                        Text(compliance.statusTitle)
                            .accessibilityIdentifier("outreach.compliance.status")
                        Text(compliance.guidance)
                            .font(.appScaled(size: 10))
                            .foregroundStyle(FcBrand.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        Text("E-post er blokkert")
                            .accessibilityIdentifier("outreach.compliance.status")
                        Text(complianceError ?? "Utsendelsesgrunnlaget er ikke kontrollert.")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(FcBrand.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
                Spacer(minLength: 0)
            }
            Button {
                complianceEditorPresented = true
            } label: {
                Text(allowed ? "Se dokumentasjon og reservasjon" : "Kontroller og dokumenter")
                    .font(.appScaled(size: 11, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.bordered)
            .tint(allowed ? FcBrand.green : FcBrand.orange)
            .accessibilityIdentifier("outreach.compliance.edit")
            Text("Personlige adresser og uavklarte adresser kan fortsatt lagres og kvalifiseres som leads, men de kan ikke brukes til markedsføring.")
                .font(.appScaled(size: 9))
                .foregroundStyle(FcBrand.textTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background((allowed ? FcBrand.green : FcBrand.orange).opacity(0.09), in: RoundedRectangle(cornerRadius: 13))
        .overlay(
            RoundedRectangle(cornerRadius: 13)
                .stroke((allowed ? FcBrand.green : FcBrand.orange).opacity(0.35), lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("outreach.compliance.card")
    }

    private var leadHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(FcBrand.purple.opacity(0.25))
                    Text(initials(lead.contactName))
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(FcBrand.purpleLight)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Til: \(lead.contactName.isEmpty ? lead.company : lead.contactName)")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(toEmail)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(FcBrand.textSecondary)
                }
                Spacer()
            }
            .padding(12)
            .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(FcBrand.stroke, lineWidth: 1))

            // Prosjekt-/bransjemerket er eget innhold, ikke et overlay.
            // Overlayet traff mottakerkortets kant på iPad mini.
            HStack(spacing: 5) {
                Image(systemName: outreachKit.isDentum ? "cross.case.fill" : "wand.and.stars")
                Text(outreachKit.title)
                Text("·")
                Text(outreachContext.category)
            }
            .font(.appScaled(size: 9, weight: .bold))
            .foregroundStyle(FcBrand.purpleLight)
            .padding(.horizontal, 9).padding(.vertical, 5)
            .background(FcBrand.purple.opacity(0.18), in: Capsule())
            .padding(.leading, 10)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(outreachKit.title) · \(outreachContext.category)")
            .accessibilityIdentifier("outreach.kit")
        }
    }

    private var templatesGrid: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "doc.text.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(FcBrand.purpleLight)
                Text("Velg mal")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text(outreachKit.audience)
                    .font(.appScaled(size: 10))
                    .foregroundStyle(FcBrand.textSecondary)
                    .accessibilityIdentifier("outreach.audience")
            }
            let cols = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]
            LazyVGrid(columns: cols, spacing: 8) {
                ForEach(outreachKit.templates) { t in
                    templateCard(t)
                }
            }
        }
    }

    private func templateCard(_ t: LeadOutreachTemplate) -> some View {
        let isSelected = selectedTemplateID == t.id
        return Button {
            customized = false
            selectedTemplateID = t.id
            applyTemplate(t)
        } label: {
            HStack(spacing: 9) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(t.accent.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: t.icon)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(t.accent.color)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.title)
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    if isSelected {
                        Text(t.description)
                            .font(.appScaled(size: 9))
                            .foregroundStyle(FcBrand.textSecondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isSelected ? t.accent.color.opacity(0.5) : FcBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("outreach.template.\(t.id)")
    }

    private var previewCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "eye.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(FcBrand.purpleLight)
                Text("Forhåndsvis + rediger")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                if customized {
                    Button { applyTemplate(selectedTemplate) } label: {
                        Text("Tilbakestill")
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(FcBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("EMNE")
                    .font(.appScaled(size: 9, weight: .bold))
                    .foregroundStyle(FcBrand.textTertiary)
                TextField("", text: $subject)
                    .textFieldStyle(.plain)
                    .foregroundStyle(.white)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .padding(.horizontal, 10).padding(.vertical, 9)
                    .background(FcBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(FcBrand.stroke, lineWidth: 1))
                    .onChange(of: subject) { _, newValue in
                        if newValue != selectedTemplate?.subject { customized = true }
                    }
                    .accessibilityIdentifier("outreach.subject")
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("INNHOLD")
                    .font(.appScaled(size: 9, weight: .bold))
                    .foregroundStyle(FcBrand.textTertiary)
                TextEditor(text: $messageBody)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.appScaled(size: 12))
                    .frame(minHeight: 160)
                    .padding(10)
                    .background(FcBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(FcBrand.stroke, lineWidth: 1))
                    .onChange(of: messageBody) { _, newValue in
                        if newValue != selectedTemplate?.body { customized = true }
                    }
                    .accessibilityIdentifier("outreach.body")
            }
            if !outreachKit.personalizationFacts.isEmpty {
                VStack(alignment: .leading, spacing: 5) {
                    Text("TILPASSET MED")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(FcBrand.textTertiary)
                    Text(outreachKit.personalizationFacts.joined(separator: " · "))
                        .font(.appScaled(size: 10))
                        .foregroundStyle(FcBrand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("outreach.personalization")
                }
            }
        }
        .padding(14)
        .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(FcBrand.stroke, lineWidth: 1))
    }

    private var appPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "app.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(FcBrand.purpleLight)
                Text("Åpne i")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            HStack(spacing: 8) {
                ForEach(EmailApp.allCases, id: \.self) { a in
                    appButton(a)
                }
            }
        }
    }

    private func appButton(_ a: EmailApp) -> some View {
        let isSelected = emailApp == a
        return Button { emailApp = a } label: {
            VStack(spacing: 5) {
                ZStack {
                    Circle().fill(a.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: a.icon)
                        .font(.appScaled(size: 16, weight: .semibold))
                        .foregroundStyle(a.color)
                }
                .frame(width: 38, height: 38)
                Text(a.rawValue)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : FcBrand.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                isSelected ? a.color.opacity(0.10) : FcBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isSelected ? a.color.opacity(0.45) : FcBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var startBar: some View {
        Button {
            Task { await sendEmail() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: emailApp.icon)
                    .font(.appScaled(size: 14, weight: .bold))
                Text("Åpne i \(emailApp.rawValue)")
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [emailApp.color, emailApp.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("outreach.open-mail")
        .disabled(
            isRecordingCompletion
                || isOpeningExternalApp
                || completionPresentation.hasPendingConfirmation
                || completionConfirmationPresented
                || contactAttempt.isFinalized
                || isLoadingCompliance
                || compliance?.permitsMarketing(to: toEmail) != true)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            FcBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(FcBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    @MainActor
    private func sendEmail() async {
        guard !isOpeningExternalApp,
              !completionPresentation.hasPendingConfirmation,
              !completionConfirmationPresented else { return }
        await loadCompliance()
        guard let compliance,
              compliance.permitsMarketing(to: toEmail) else {
            completionAlertTitle = "E-post er blokkert"
            completionError = compliance?.guidance
                ?? complianceError
                ?? "Dokumenter lovlig utsendelsesgrunnlag før e-postappen åpnes."
            return
        }
        let actionId = UUID()
        let scope = LeadgridExternalContactScope.resolve(
            activeOrganizationId: appState.activeOrganizationId,
            activeProjectId: appState.activeLeadgridProjectId,
            leadId: lead.backendId,
            leadProjectId: lead.projectId)
        let encSubj = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let organizationName = appState.activeOrganization?.name ?? "organisasjonen"
        let source = lead.leadSource?.trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfEmpty ?? "Leadgrids CRM-register"
        let processing = compliance.gdprProcessing
        let processingDetails = processing.documented
            ? " Formål: \(processing.purpose ?? "direkte markedsføring"). Opplysningen slettes eller vurderes på nytt senest \(processing.retentionUntil.map { String($0.prefix(10)) } ?? "etter organisasjonens lagringsrutine")."
            : ""
        let footer = "Dette er en markedsføringshenvendelse fra \(organizationName). Kontaktopplysningen er registrert med kilde: \(processing.source ?? source).\(processingDetails) Svar «nei takk» for å reservere deg mot flere markedsføringshenvendelser fra organisasjonen, eller for å be om innsyn eller sletting."
        let completeBody = "\(messageBody)\n\n—\n\(footer)"
        let encBody = completeBody.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString: String
        switch emailApp {
        case .appleMail:
            urlString = "mailto:\(toEmail)?subject=\(encSubj)&body=\(encBody)"
        case .outlook:
            urlString = "ms-outlook://compose?to=\(toEmail)&subject=\(encSubj)&body=\(encBody)"
        case .gmail:
            urlString = "googlegmail://co?to=\(toEmail)&subject=\(encSubj)&body=\(encBody)"
        }
        guard let url = URL(string: urlString) else {
            completionAlertTitle = "Kunne ikke åpne e-post"
            completionError = "E-postlenken er ugyldig. Ingenting er loggført."
            return
        }

        completionPresentation.beginHandoff()
        isOpeningExternalApp = true
        UIApplication.shared.open(url) { opened in
            Task { @MainActor in
                if opened {
                    isOpeningExternalApp = false
                    contactAttempt.begin(
                        channel: .email,
                        actionId: actionId,
                        scope: scope)
                    completionPresentation.externalAppDidOpen()
                    completionPresentation.sceneActivityDidChange(
                        isActive: scenePhase == .active)
                    presentCompletionConfirmationIfPossible(scenePhase)
                    scheduleCompletionConfirmationFallback(for: actionId)
                    return
                }
                guard emailApp != .appleMail,
                      let fallbackURL = URL(
                        string: "mailto:\(toEmail)?subject=\(encSubj)&body=\(encBody)"
                      ) else {
                    isOpeningExternalApp = false
                    completionPresentation.cancel()
                    contactAttempt.cancel()
                    completionAlertTitle = "Kunne ikke åpne e-post"
                    completionError = "E-postappen kunne ikke åpnes. Ingenting er loggført."
                    return
                }
                UIApplication.shared.open(fallbackURL) { fallbackOpened in
                    Task { @MainActor in
                        guard fallbackOpened else {
                            isOpeningExternalApp = false
                            completionPresentation.cancel()
                            contactAttempt.cancel()
                            completionAlertTitle = "Kunne ikke åpne e-post"
                            completionError =
                                "Ingen e-postapp kunne åpnes. Ingenting er loggført."
                            return
                        }
                        isOpeningExternalApp = false
                        contactAttempt.begin(
                            channel: .email,
                            actionId: actionId,
                            scope: scope)
                        completionPresentation.externalAppDidOpen()
                        completionPresentation.sceneActivityDidChange(
                            isActive: scenePhase == .active)
                        presentCompletionConfirmationIfPossible(scenePhase)
                        scheduleCompletionConfirmationFallback(for: actionId)
                    }
                }
            }
        }
    }

    @MainActor
    private func scheduleCompletionConfirmationFallback(for actionId: UUID) {
        Task { @MainActor in
            do {
                try await Task.sleep(for: .milliseconds(750))
            } catch {
                return
            }
            guard contactAttempt.actionId == actionId,
                  scenePhase == .active else { return }
            if completionPresentation.consumeContinuousActiveFallback(true) {
                completionConfirmationPresented = true
            }
        }
    }

    @MainActor
    private func presentCompletionConfirmationIfPossible(_ phase: ScenePhase) {
        completionPresentation.sceneActivityDidChange(isActive: phase == .active)
        if completionPresentation.consumeConfirmationIfActive(phase == .active) {
            completionConfirmationPresented = true
        }
    }

    @MainActor
    private func recordConfirmedCompletion() async {
        guard !isRecordingCompletion,
              let actionId = contactAttempt.actionId,
              let occurredAt = contactAttempt.occurredAt,
              contactAttempt.canConfirmOrRetry,
              let record = LeadgridExternalContactRecord.make(
                channel: .email,
                lifecycle: .completed,
                occurredAt: occurredAt,
                actionId: actionId)
        else { return }
        guard let scope = contactAttempt.scope else {
            isOpeningExternalApp = false
            completionPresentation.cancel()
            contactAttempt.cancel()
            completionAlertTitle = "Kan ikke loggføre sikkert"
            completionError =
                "Leaden mangler en entydig kobling til aktivt kundeprosjekt. E-posten er ikke registrert."
            return
        }
        guard scope.isStillActive(
            organizationId: appState.activeOrganizationId,
            projectId: appState.activeLeadgridProjectId
        ) else {
            completionAlertTitle = "Kundeprosjektet er byttet"
            completionError =
                "Gå tilbake til prosjektet e-posten ble startet fra og prøv loggføringen igjen."
            return
        }
        guard let api = appState.api else {
            completionAlertTitle = "Kunne ikke loggføre"
            completionError = "Du må være innlogget. E-posten er ikke registrert."
            return
        }
        isRecordingCompletion = true
        defer { isRecordingCompletion = false }
        switch await record.persist(
            api: api,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            leadId: scope.leadId
        ) {
        case .sent:
            await appState.refreshAll()
            contactAttempt.finalize()
            dismiss()
        case .queued:
            completionConfirmationPresented = false
            contactAttempt.finalize()
            completionAlertTitle = "Lagret for synkronisering"
            completionError = LeadgridExternalContactCopy.queuedLoggingMessage
        case .rejected(let message):
            completionAlertTitle = "Kunne ikke loggføre"
            completionError = message
        }
    }

    private func initials(_ name: String) -> String {
        name.split(separator: " ").prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }
}

// MARK: - Enkel dokumentasjon av utsendelsesgrunnlag

private struct LeadgridEmailComplianceEditor: View {
    let lead: LeadRow
    let email: String
    @Binding var compliance: LeadgridEmailCompliance?

    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var classificationEvidence = ""
    @State private var consentSource = "Skjema eller skriftlig bekreftelse"
    @State private var consentEvidence = ""
    @State private var consentOccurredAt = Date()
    @State private var relationship = ""
    @State private var similarServices = ""
    @State private var customerEvidence = ""
    @State private var electronicAddressProvidedAt = Date()
    @State private var collectionOptOutOfferedAt = Date()
    @State private var customerAttestationConfirmed = false
    @State private var gdprLegalBasis = "legitimate_interests"
    @State private var gdprPurpose = "Kvalifisere en relevant bedriftskontakt"
    @State private var gdprSource = ""
    @State private var gdprCollectedAt = Date()
    @State private var gdprRetentionUntil = Calendar.current.date(
        byAdding: .day, value: 90, to: Date()) ?? Date()
    @State private var interestGoal = ""
    @State private var necessityAssessment = ""
    @State private var balancingAssessment = ""
    @State private var safeguards = ""
    @State private var privacyNoticeSent = false
    @State private var privacyNoticeReference = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var suppressionConfirmation = false

    private let consentWording =
        "Jeg samtykker til at virksomheten kan sende meg markedsføring på denne e-postadressen. Samtykket kan trekkes tilbake når som helst."

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    statusCard
                    addressTypeCard
                    consentCard
                    gdprCard
                    existingCustomerCard
                    suppressionCard
                }
                .padding(20)
            }
            .background(FcBrand.bg.ignoresSafeArea())
            .navigationTitle("Kan vi sende e-post?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Ferdig") { dismiss() }
                }
            }
            .disabled(isSaving)
            .alert("Kunne ikke lagre", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "Ukjent feil")
            }
            .confirmationDialog(
                "Sperr adressen i hele organisasjonen?",
                isPresented: $suppressionConfirmation,
                titleVisibility: .visible
            ) {
                Button("Ja, registrer «nei takk»", role: .destructive) {
                    Task { await suppress() }
                }
                Button("Avbryt", role: .cancel) {}
            } message: {
                Text("Adressen kan fortsatt ligge på leaden, men kan ikke kontaktes fra dette eller andre prosjekter.")
            }
            .onAppear {
                if gdprSource.isEmpty {
                    gdprSource = lead.leadSource ?? ""
                }
            }
        }
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(email)
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Text(compliance?.statusTitle ?? "Ikke kontrollert")
                .font(.appScaled(size: 15, weight: .bold))
                .foregroundStyle(compliance?.allowed == true ? FcBrand.green : FcBrand.orange)
                .accessibilityIdentifier("outreach.compliance.editor.status")
            Text(compliance?.guidance ?? "Velg riktig dokumentasjon under. Leadgrid tillater ikke markedsføring før kontrollen er fullført.")
                .font(.appScaled(size: 11))
                .foregroundStyle(FcBrand.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if compliance?.addressClassification == .namedPerson {
                Label(
                    compliance?.gdprProcessing.documented == true
                        ? "GDPR-grunnlag er dokumentert"
                        : "GDPR-grunnlag mangler",
                    systemImage: compliance?.gdprProcessing.documented == true
                        ? "checkmark.circle.fill"
                        : "circle.dashed")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(compliance?.gdprProcessing.documented == true
                        ? FcBrand.green : FcBrand.orange)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 13))
    }

    private var addressTypeCard: some View {
        complianceSection(
            number: "1",
            title: "Hvem tilhører adressen?",
            explanation: "At en adresse står på nettet er ikke nok. Kontroller om den faktisk er en felles inngang til virksomheten."
        ) {
            field("Hvor kontrollerte du dette?", text: $classificationEvidence)
            HStack(spacing: 10) {
                actionButton("Fellesadresse", color: FcBrand.green) {
                    await setClassification(.verifiedShared)
                }
                actionButton("Personadresse", color: FcBrand.orange) {
                    await setClassification(.namedPerson)
                }
            }
        }
    }

    private var consentCard: some View {
        complianceSection(
            number: "2",
            title: "Har personen sagt ja?",
            explanation: "Ikke send en salgs-e-post for å spørre om samtykke. Registrer bare et samtykke du allerede kan dokumentere."
        ) {
            Text(consentWording)
                .font(.appScaled(size: 10))
                .foregroundStyle(FcBrand.textSecondary)
                .padding(10)
                .background(FcBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
            field("Kilde, for eksempel signert skjema", text: $consentSource)
            field("Bevis eller referanse", text: $consentEvidence)
            DatePicker(
                "Når ble samtykket gitt?",
                selection: $consentOccurredAt,
                in: ...Date(),
                displayedComponents: [.date, .hourAndMinute])
                .font(.appScaled(size: 11))
                .foregroundStyle(.white)
            actionButton("Lagre dokumentert samtykke", color: FcBrand.blue) {
                await recordConsent()
            }
        }
    }

    private var existingCustomerCard: some View {
        complianceSection(
            number: "4",
            title: "Eksisterende kunde?",
            explanation: "Bruk bare dette snevre unntaket når adressen ble gitt ved et salg, reservasjonsmulighet ble tilbudt, og innholdet gjelder egne tilsvarende tjenester."
        ) {
            field("Beskriv kundeforholdet", text: $relationship)
            field("Hvilke tilsvarende tjenester gjelder det?", text: $similarServices)
            field("Dokumentkilde", text: $customerEvidence)
            DatePicker(
                "Når ble adressen gitt?",
                selection: $electronicAddressProvidedAt,
                in: ...Date(),
                displayedComponents: .date)
                .font(.appScaled(size: 11))
                .foregroundStyle(.white)
            DatePicker(
                "Når ble «nei takk» tilbudt?",
                selection: $collectionOptOutOfferedAt,
                in: ...Date(),
                displayedComponents: .date)
                .font(.appScaled(size: 11))
                .foregroundStyle(.white)
            Toggle(
                "Jeg bekrefter at alle vilkårene over er oppfylt",
                isOn: $customerAttestationConfirmed)
                .font(.appScaled(size: 10, weight: .semibold))
                .tint(FcBrand.purpleLight)
            actionButton("Dokumenter kundeunntaket", color: FcBrand.purpleLight) {
                await recordExistingCustomer()
            }
        }
    }

    private var gdprCard: some View {
        complianceSection(
            number: "3",
            title: "Dokumenter GDPR-grunnlaget",
            explanation: "Dette er separat fra retten til å sende markedsføring. Berettiget interesse gir ikke i seg selv lov til å sende e-post."
        ) {
            Picker("Behandlingsgrunnlag", selection: $gdprLegalBasis) {
                Text("Berettiget interesse").tag("legitimate_interests")
                Text("Samtykke").tag("consent")
                Text("Avtale").tag("contract")
            }
            .pickerStyle(.segmented)
            field("Formålet med behandlingen", text: $gdprPurpose)
            field("Hvor kom opplysningen fra?", text: $gdprSource)
            DatePicker(
                "Innsamlet",
                selection: $gdprCollectedAt,
                in: ...Date(),
                displayedComponents: .date)
                .font(.appScaled(size: 11))
                .foregroundStyle(.white)
            DatePicker(
                "Slett eller vurder på nytt",
                selection: $gdprRetentionUntil,
                in: gdprCollectedAt...,
                displayedComponents: .date)
                .font(.appScaled(size: 11))
                .foregroundStyle(.white)
            if gdprLegalBasis == "legitimate_interests" {
                Text("Treleddet interesseavveining")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(FcBrand.purpleLight)
                field("1. Hvilken legitim interesse?", text: $interestGoal)
                field("2. Hvorfor er behandlingen nødvendig?", text: $necessityAssessment)
                field("3. Hvorfor veier interessen tyngre?", text: $balancingAssessment)
                field("Tiltak som beskytter personen", text: $safeguards)
            }
            Toggle("Personverninformasjon er gitt", isOn: $privacyNoticeSent)
                .font(.appScaled(size: 10, weight: .semibold))
                .tint(FcBrand.green)
            if privacyNoticeSent {
                field("Lenke eller annen dokumentasjon", text: $privacyNoticeReference)
            } else {
                Text("Ved indirekte innsamling må personen få informasjon om formål, kilde, lagringstid og rettigheter senest når opplysningen brukes til kontakt.")
                    .font(.appScaled(size: 9))
                    .foregroundStyle(FcBrand.orange)
                    .fixedSize(horizontal: false, vertical: true)
            }
            actionButton("Lagre behandlingsgrunnlag", color: FcBrand.green) {
                await recordGdprProcessing()
            }
        }
    }

    private var suppressionCard: some View {
        complianceSection(
            number: "5",
            title: "Har mottakeren sagt nei?",
            explanation: "En protest mot direkte markedsføring skal respekteres i hele organisasjonen, på tvers av alle prosjekter."
        ) {
            Button(role: .destructive) {
                suppressionConfirmation = true
            } label: {
                Label("Registrer «nei takk»", systemImage: "hand.raised.fill")
                    .font(.appScaled(size: 12, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
            }
            .buttonStyle(.bordered)
            .tint(FcBrand.red)
            .accessibilityIdentifier("outreach.compliance.suppress")
        }
    }

    private func complianceSection<Content: View>(
        number: String,
        title: String,
        explanation: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 9) {
                Text(number)
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 25, height: 25)
                    .background(FcBrand.purple, in: Circle())
                Text(title)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
            }
            Text(explanation)
                .font(.appScaled(size: 10))
                .foregroundStyle(FcBrand.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            content()
        }
        .padding(14)
        .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(FcBrand.stroke, lineWidth: 1))
    }

    private func field(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .textFieldStyle(.plain)
            .font(.appScaled(size: 11))
            .foregroundStyle(.white)
            .padding(11)
            .background(FcBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(FcBrand.stroke, lineWidth: 1))
    }

    private func actionButton(
        _ title: String,
        color: Color,
        action: @escaping @MainActor () async -> Void
    ) -> some View {
        Button {
            Task { await action() }
        } label: {
            Text(title)
                .font(.appScaled(size: 11, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
        }
        .buttonStyle(.bordered)
        .tint(color)
    }

    @MainActor
    private func scope() throws -> (APIClient, String, String, String) {
        guard let api = appState.api,
              let leadID = lead.backendId,
              let projectID = lead.projectId,
              let organizationID = appState.activeOrganizationId
        else { throw LeadgridOutreachComplianceScopeError.missingProject }
        return (api, leadID, projectID, organizationID)
    }

    @MainActor
    private func setClassification(_ classification: LeadgridEmailAddressClassification) async {
        guard !classificationEvidence.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Skriv hvor du kontrollerte hvem adressen tilhører."
            return
        }
        await save {
            let (api, leadID, projectID, organizationID) = try scope()
            return try await api.setOutreachAddressClassification(
                leadId: leadID,
                projectId: projectID,
                organizationId: organizationID,
                classification: classification,
                source: "manual_verification",
                evidence: classificationEvidence)
        }
    }

    @MainActor
    private func recordConsent() async {
        guard !consentEvidence.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !consentSource.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            errorMessage = "Oppgi både kilde og bevis for samtykket."
            return
        }
        await save {
            let (api, leadID, projectID, organizationID) = try scope()
            return try await api.recordOutreachConsent(
                leadId: leadID,
                projectId: projectID,
                organizationId: organizationID,
                request: .init(
                    action: "grant",
                    contactName: lead.contactName.isEmpty ? lead.company : lead.contactName,
                    purpose: "direct_marketing_email",
                    consentText: consentWording,
                    consentVersion: "leadgrid-2.2-2026-09-10",
                    source: consentSource,
                    evidence: consentEvidence,
                    occurredAt: ISO8601DateFormatter().string(from: consentOccurredAt),
                    expiresAt: nil))
        }
    }

    @MainActor
    private func recordExistingCustomer() async {
        guard !customerEvidence.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !relationship.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !similarServices.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              customerAttestationConfirmed
        else {
            errorMessage = "Beskriv kundeforholdet, tilsvarende tjenester og dokumentkilden."
            return
        }
        await save {
            let (api, leadID, projectID, organizationID) = try scope()
            return try await api.recordOutreachExistingCustomer(
                leadId: leadID,
                projectId: projectID,
                organizationId: organizationID,
                request: .init(
                    source: customerEvidence,
                    relationship: relationship,
                    similarServices: similarServices,
                    electronicAddressProvidedAt: ISO8601DateFormatter().string(
                        from: electronicAddressProvidedAt),
                    collectionOptOutOfferedAt: ISO8601DateFormatter().string(
                        from: collectionOptOutOfferedAt)))
        }
    }

    @MainActor
    private func recordGdprProcessing() async {
        let required = [gdprPurpose, gdprSource]
        guard required.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
              gdprRetentionUntil > gdprCollectedAt
        else {
            errorMessage = "Oppgi formål, kilde og en fremtidig dato for sletting eller ny vurdering."
            return
        }
        if gdprLegalBasis == "legitimate_interests" {
            let assessment = [
                interestGoal, necessityAssessment, balancingAssessment, safeguards,
            ]
            guard assessment.allSatisfy({
                !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            }) else {
                errorMessage = "Fyll ut alle tre delene av interesseavveiningen og beskyttelsestiltakene."
                return
            }
        }
        if privacyNoticeSent,
           privacyNoticeReference.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errorMessage = "Legg inn en lenke eller annen dokumentasjon på personverninformasjonen."
            return
        }
        await save {
            let (api, leadID, projectID, organizationID) = try scope()
            let noticeTime = privacyNoticeSent
                ? ISO8601DateFormatter().string(from: Date())
                : nil
            return try await api.recordOutreachGdprProcessing(
                leadId: leadID,
                projectId: projectID,
                organizationId: organizationID,
                request: .init(
                    dataSubjectName: lead.contactName.isEmpty ? lead.company : lead.contactName,
                    legalBasis: gdprLegalBasis,
                    purpose: gdprPurpose,
                    source: gdprSource,
                    collectedAt: ISO8601DateFormatter().string(from: gdprCollectedAt),
                    retentionUntil: ISO8601DateFormatter().string(from: gdprRetentionUntil),
                    legitimateInterestGoal: gdprLegalBasis == "legitimate_interests" ? interestGoal : nil,
                    necessityAssessment: gdprLegalBasis == "legitimate_interests" ? necessityAssessment : nil,
                    balancingAssessment: gdprLegalBasis == "legitimate_interests" ? balancingAssessment : nil,
                    safeguards: gdprLegalBasis == "legitimate_interests" ? safeguards : nil,
                    indirectCollection: true,
                    privacyNoticeStatus: privacyNoticeSent ? "sent" : "pending",
                    privacyNoticeSentAt: noticeTime,
                    privacyNoticeMethod: privacyNoticeSent ? "documented_notice" : nil,
                    privacyNoticeReference: privacyNoticeSent ? privacyNoticeReference : nil))
        }
    }

    @MainActor
    private func suppress() async {
        await save {
            let (api, leadID, projectID, organizationID) = try scope()
            return try await api.suppressOutreachEmail(
                leadId: leadID,
                projectId: projectID,
                organizationId: organizationID,
                reason: "recipient_objection",
                source: "manual_recipient_request",
                notes: "Mottakeren ba om å ikke motta direkte markedsføring.")
        }
    }

    @MainActor
    private func save(
        _ operation: @escaping @MainActor () async throws -> LeadgridEmailCompliance
    ) async {
        guard !isSaving else { return }
        if ProcessInfo.processInfo.environment["QA_TOUR"] == "dentum-outreach" {
            compliance = .dentumQAVerifiedShared(email: email)
            return
        }
        isSaving = true
        defer { isSaving = false }
        do {
            compliance = try await operation()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
