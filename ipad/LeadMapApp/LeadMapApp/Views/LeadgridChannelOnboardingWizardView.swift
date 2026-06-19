// LeadgridChannelOnboardingWizardView.swift
//
// 5/7-stegs wizard som kundens admin går gjennom for å sette opp
// Leadgrid-varslings-kanaler (e-post + WhatsApp). Paritet m/ web's
// NotificationChannelsOnboardingWizard (PR #737).
//
// Modeller:
//   shared   → 4 steg: choose_model → email_branding → verify_email → activate
//   own_waba → 7 steg: choose_model → email_branding → waba_credentials
//               → validate_waba → sync_templates → test_send → activate

import SwiftUI

struct LeadgridChannelOnboardingWizardView: View {
    let api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var state: ChannelOnboardingStateResponse?
    @State private var loading = true
    @State private var errorText: String?
    @State private var snackText: String?

    private var sharedSteps: [(key: String, label: String)] {
        [("choose_model", "Velg modell"),
         ("email_branding", "E-post-branding"),
         ("verify_email", "Test-sending"),
         ("activate", "Aktiver")]
    }
    private var ownWabaSteps: [(key: String, label: String)] {
        [("choose_model", "Velg modell"),
         ("email_branding", "E-post-branding"),
         ("waba_credentials", "WABA-credentials"),
         ("validate_waba", "Valider WABA"),
         ("sync_templates", "Sync templates"),
         ("test_send", "Send test"),
         ("activate", "Aktiver")]
    }

    private var currentSteps: [(key: String, label: String)] {
        state?.state.deliveryModel == "own_waba" ? ownWabaSteps : sharedSteps
    }
    private var currentStepIndex: Int {
        guard let cur = state?.state.currentStep else { return 0 }
        return currentSteps.firstIndex(where: { $0.key == cur }) ?? 0
    }

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else if let s = state {
                    if s.state.activated {
                        activatedView(s)
                    } else {
                        wizardBody(s)
                    }
                } else if let errorText {
                    ContentUnavailableView(
                        "Kunne ikke laste",
                        systemImage: "exclamationmark.triangle",
                        description: Text(errorText),
                    )
                }
            }
            .navigationTitle("Sett opp varslings-kanaler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
            .overlay(alignment: .bottom) {
                if let snackText {
                    Text(snackText)
                        .padding()
                        .background(.thinMaterial, in: Capsule())
                        .padding(.bottom, 20)
                        .transition(.move(edge: .bottom))
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let res = try await api.fetchOnboardingChannelState()
            await MainActor.run {
                state = res
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste status: \(error.localizedDescription)"
                loading = false
            }
        }
    }

    @ViewBuilder
    private func activatedView(_ s: ChannelOnboardingStateResponse) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
            Text("Varslings-kanalene er aktivert")
                .font(.title2.bold())
            Text("Leadgrid sender nå klient-varsler via "
                  + (s.state.deliveryModel == "own_waba"
                     ? "ditt eget WhatsApp Business-nummer"
                     : "Leadgrids delte WhatsApp Business-nummer") + ".")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Label("Modell: " + (s.state.deliveryModel == "own_waba"
                                  ? "Eget nummer" : "Delt nummer"),
                   systemImage: "checkmark.circle")
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(Color.green.opacity(0.15), in: Capsule())
        }
        .padding()
    }

    @ViewBuilder
    private func wizardBody(_ s: ChannelOnboardingStateResponse) -> some View {
        VStack(spacing: 0) {
            stepperBar(s)
            Divider()
            ScrollView {
                stepContent(s)
                    .padding()
            }
        }
    }

    @ViewBuilder
    private func stepperBar(_ s: ChannelOnboardingStateResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Steg \(currentStepIndex + 1) av \(currentSteps.count)")
                .font(.caption).foregroundStyle(.secondary)
            Text(currentSteps[safe: currentStepIndex]?.label ?? "")
                .font(.title3.bold())
            ProgressView(value: Double(currentStepIndex),
                          total: Double(currentSteps.count - 1))
                .tint(.purple)
        }
        .padding()
    }

    @ViewBuilder
    private func stepContent(_ s: ChannelOnboardingStateResponse) -> some View {
        switch s.state.currentStep {
        case "choose_model":
            ChooseModelStep(api: api) { await advance(from: "choose_model") }
        case "email_branding":
            EmailBrandingStep(state: s) { await advance(from: "email_branding") }
        case "verify_email":
            VerifyEmailStep(api: api,
                             onSent: { msg in
                                 flash(msg)
                             }) {
                await advance(from: "verify_email")
            }
        case "waba_credentials":
            WabaCredentialsStep { await advance(from: "waba_credentials") }
        case "validate_waba":
            ValidateWabaStep(state: s) { await advance(from: "validate_waba") }
        case "sync_templates":
            SyncTemplatesStep { await advance(from: "sync_templates") }
        case "test_send":
            TestSendStep(api: api, onSent: { msg in flash(msg) }) {
                await advance(from: "test_send")
            }
        case "activate":
            ActivateStep { await activate() }
        default:
            Text("Ukjent steg: \(s.state.currentStep)")
        }
    }

    private func advance(from step: String) async {
        do {
            _ = try await api.advanceOnboardingStep(fromStep: step)
            await load()
        } catch {
            flash("Steg-overgang feilet: \(error.localizedDescription)")
        }
    }

    private func activate() async {
        do {
            try await api.activateOnboarding()
            await load()
        } catch {
            flash("Aktivering feilet: \(error.localizedDescription)")
        }
    }

    private func flash(_ text: String) {
        Task { @MainActor in
            withAnimation { snackText = text }
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            withAnimation { snackText = nil }
        }
    }
}

// ============================================================
// MARK: - Steg-komponenter
// ============================================================

private struct ChooseModelStep: View {
    let api: APIClient
    let onContinue: () async -> Void
    @State private var picked: String = "shared"
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Hvordan vil dere sende WhatsApp-meldinger?")
                .font(.headline)
            modelCard(
                key: "shared",
                title: "Delt nummer (anbefalt)",
                subtitle: "3 trinn · ~0,15 NOK/melding",
                body: "Bruk Leadgrids felles WhatsApp Business-nummer m/ din branding.",
            )
            modelCard(
                key: "own_waba",
                title: "Eget telefonnummer (egen WABA)",
                subtitle: "5 trinn · ~0,12 NOK/melding direkte til Meta",
                body: "Egen Meta WhatsApp Business-konto. Krever firma-nummer + verifisering.",
            )
            Button {
                Task {
                    busy = true
                    defer { busy = false }
                    do {
                        try await api.selectOnboardingModel(picked)
                        await onContinue()
                    } catch {
                        // Errors håndteres på parent.
                    }
                }
            } label: {
                if busy { ProgressView() }
                else { Text("Neste →").frame(maxWidth: .infinity).bold() }
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
    }

    @ViewBuilder
    private func modelCard(key: String, title: String, subtitle: String, body: String) -> some View {
        let selected = picked == key
        Button { picked = key } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: selected ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(selected ? .purple : .secondary)
                    .font(.title3)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.body.bold())
                    Text(subtitle).font(.caption).foregroundStyle(.purple)
                    Text(body).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding()
            .background(selected ? Color.purple.opacity(0.10) : Color(.systemGray6))
            .overlay(RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(selected ? Color.purple : Color.clear))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

private struct EmailBrandingStep: View {
    let state: ChannelOnboardingStateResponse
    let onContinue: () async -> Void

    var ready: Bool {
        state.emailBrandingExists && state.emailBrandingHasSender
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Konfigurer e-post-branding", systemImage: "envelope.fill")
                .font(.headline)
                .foregroundStyle(.purple)
            Text("Sett opp avsender-info og branding som vises på e-postene Leadgrid sender til klientene dine.")
                .font(.callout)
                .foregroundStyle(.secondary)
            if ready {
                Label("E-post-branding er konfigurert. Du kan gå videre.",
                       systemImage: "checkmark.circle.fill")
                    .padding()
                    .background(Color.green.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
            } else {
                Label("Konfigurer e-post-branding først via web-app'en (superadmin → E-post-branding).",
                       systemImage: "exclamationmark.triangle.fill")
                    .padding()
                    .background(Color.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
            }
            Button {
                Task { await onContinue() }
            } label: {
                Text("Neste →").frame(maxWidth: .infinity).bold()
            }
            .buttonStyle(.borderedProminent)
            .disabled(!ready)
        }
    }
}

private struct VerifyEmailStep: View {
    let api: APIClient
    let onSent: (String) -> Void
    let onContinue: () async -> Void
    @State private var email = ""
    @State private var sending = false
    @State private var sent = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Test e-post-rendering").font(.headline)
            Text("Vi sender en test-e-post til adressen du skriver inn under for å verifisere at logoen og brandingen er som forventet.")
                .font(.callout).foregroundStyle(.secondary)
            HStack {
                TextField("Test-e-postadresse", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .textFieldStyle(.roundedBorder)
                Button {
                    Task {
                        sending = true
                        defer { sending = false }
                        do {
                            let res = try await api.sendOnboardingTest(
                                phone: nil, email: email, name: "Test-mottaker",
                            )
                            if res.sent > 0 {
                                sent = true
                                onSent("Test-e-post sendt!")
                            } else {
                                onSent("Ingen leveranse")
                            }
                        } catch {
                            onSent("Feil: \(error.localizedDescription)")
                        }
                    }
                } label: {
                    if sending { ProgressView() }
                    else { Text("Send test") }
                }
                .buttonStyle(.bordered)
                .disabled(email.isEmpty || sending)
            }
            if sent {
                Label("Sjekk innboksen", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            }
            Button {
                Task { await onContinue() }
            } label: {
                Text("Det ser bra ut — neste →").frame(maxWidth: .infinity).bold()
            }
            .buttonStyle(.borderedProminent)
            .disabled(!sent)
        }
    }
}

private struct WabaCredentialsStep: View {
    let onContinue: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("WABA-credentials", systemImage: "key.fill")
                .font(.headline).foregroundStyle(.purple)
            Text("Du trenger 3 verdier fra Meta Business Manager. Den enkleste måten å konfigurere dette på er via web-superadmin.")
                .font(.callout).foregroundStyle(.secondary)
            Label("Åpne web-superadmin → WABA-config",
                   systemImage: "safari.fill")
                .padding()
                .background(Color.blue.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
            Button {
                Task { await onContinue() }
            } label: {
                Text("Jeg har konfigurert det — neste →").frame(maxWidth: .infinity).bold()
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

private struct ValidateWabaStep: View {
    let state: ChannelOnboardingStateResponse
    let onContinue: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Valider WABA-credentials").font(.headline)
            if state.wabaValidated {
                Label("Validert mot Meta. WABA er klar.",
                       systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)
            } else if let err = state.wabaValidationError {
                Label("Validering feilet: \(err)",
                       systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
            } else {
                Label("Validerer mot Meta...",
                       systemImage: "arrow.clockwise")
                    .foregroundStyle(.secondary)
            }
            Button {
                Task { await onContinue() }
            } label: {
                Text("Neste →").frame(maxWidth: .infinity).bold()
            }
            .buttonStyle(.borderedProminent)
            .disabled(!state.wabaValidated)
        }
    }
}

private struct SyncTemplatesStep: View {
    let onContinue: () async -> Void
    @State private var synced = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sync Leadgrid-templates til WABA").font(.headline)
            Text("Vi sender alle 10 Leadgrid-templates (5 events × NO+EN) til Meta for godkjenning. UTILITY-templates godkjennes typisk innen 5-15 minutter.")
                .font(.callout).foregroundStyle(.secondary)
            if synced {
                Label("Sjekk web-superadmin → WhatsApp-templates for status",
                       systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else {
                Button {
                    // Open web for sync
                    synced = true
                } label: {
                    Label("Åpne web for sync", systemImage: "safari.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            Button {
                Task { await onContinue() }
            } label: {
                Text("Neste →").frame(maxWidth: .infinity).bold()
            }
            .buttonStyle(.borderedProminent)
            .disabled(!synced)
        }
    }
}

private struct TestSendStep: View {
    let api: APIClient
    let onSent: (String) -> Void
    let onContinue: () async -> Void
    @State private var phone = ""
    @State private var sending = false
    @State private var sent = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Send test-WhatsApp").font(.headline)
            HStack {
                TextField("Mobilnummer (+47...)", text: $phone)
                    .keyboardType(.phonePad)
                    .textFieldStyle(.roundedBorder)
                Button {
                    Task {
                        sending = true
                        defer { sending = false }
                        do {
                            let res = try await api.sendOnboardingTest(
                                phone: phone, email: nil, name: "Test-mottaker",
                            )
                            if res.sent > 0 {
                                sent = true
                                onSent("Test-WhatsApp sendt!")
                            } else {
                                onSent("Ingen leveranse")
                            }
                        } catch {
                            onSent("Feil: \(error.localizedDescription)")
                        }
                    }
                } label: {
                    if sending { ProgressView() }
                    else { Text("Send test") }
                }
                .buttonStyle(.bordered)
                .disabled(phone.isEmpty || sending)
            }
            if sent {
                Label("Sjekk WhatsApp", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            }
            Button {
                Task { await onContinue() }
            } label: {
                Text("Det funket — neste →").frame(maxWidth: .infinity).bold()
            }
            .buttonStyle(.borderedProminent)
            .disabled(!sent)
        }
    }
}

private struct ActivateStep: View {
    let onActivate: () async -> Void
    @State private var busy = false

    var body: some View {
        VStack(spacing: 16) {
            Text("Klar til å aktivere?")
                .font(.title2.bold())
            Text("Når du klikker aktiverer Leadgrid heretter klient-varsler via den valgte kanal-strategien.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button {
                busy = true
                Task { await onActivate() }
            } label: {
                Label(busy ? "Aktiverer…" : "Aktiver varslings-kanaler",
                       systemImage: "checkmark.seal.fill")
                    .frame(maxWidth: .infinity).bold()
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .controlSize(.large)
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
