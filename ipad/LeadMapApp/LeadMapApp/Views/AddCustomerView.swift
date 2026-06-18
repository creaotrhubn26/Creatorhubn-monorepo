// AddCustomerView.swift
//
// Selv-onboarding-flate: bruker oppgir bare website + kontakt-e-post,
// så gjør Leadgrid resten — BRREG-oppslag, logo-fetch, crawl + Claude
// needs/signals/scoring, lager prosjekt + crm_customer, sender e-post
// til kunden med klient-portal-lenke.
//
// UX-prinsipp: så enkelt som mulig. To felter, ett trykk, og live
// progress.

import SwiftUI

struct AddCustomerView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var websiteUrl = ""
    @State private var contactEmail = ""
    @State private var contactName = ""
    @State private var contactPhone = ""
    @State private var presetId: String? = nil

    @State private var isStarting = false
    @State private var auditId: String?
    @State private var audit: AutoOnboardAudit?
    @State private var pollTimer: Task<Void, Never>?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                // Hero-bakgrunn: Backdrop7 (selger med pin-rute)
                BrandedHeroBackground(.backdrop7, darkenFrom: 0.45, darkenTo: 0.95)
                    .ignoresSafeArea()

                if let a = audit {
                    progressContent(audit: a)
                } else {
                    formContent
                }
            }
            .navigationTitle("Ny kunde")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(audit?.isTerminal == true ? "Ferdig" : "Avbryt") {
                        pollTimer?.cancel()
                        dismiss()
                    }
                }
            }
            .alert("Noe gikk galt", isPresented: errorBinding) {
                Button("OK") { error = nil }
            } message: { Text(error ?? "") }
        }
    }

    // MARK: - Form

    @ViewBuilder
    private var formContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Spacer().frame(height: 40)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Legg til en kunde")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Du gir oss to ting. Leadgrid gjør resten.")
                        .font(.title3)
                        .foregroundStyle(.white.opacity(0.7))
                }

                VStack(alignment: .leading, spacing: 18) {
                    fieldGroup(
                        label: "Nettside *",
                        hint: "Vi tråler den og finner navn, logo og mangler",
                        text: $websiteUrl,
                        keyboard: .URL,
                        placeholder: "https://medside.no"
                    )
                    fieldGroup(
                        label: "Kontakt-e-post *",
                        hint: "Vi sender en lenke til klient-portalen",
                        text: $contactEmail,
                        keyboard: .emailAddress,
                        placeholder: "kontakt@medside.no"
                    )
                    DisclosureGroup("Mer info (valgfritt)") {
                        VStack(spacing: 14) {
                            fieldGroup(
                                label: "Navn på kontaktperson",
                                hint: nil,
                                text: $contactName,
                                keyboard: .default,
                                placeholder: "F.eks. Lege Hansen"
                            )
                            fieldGroup(
                                label: "Telefonnummer",
                                hint: nil,
                                text: $contactPhone,
                                keyboard: .phonePad,
                                placeholder: "+47 ..."
                            )
                        }
                        .padding(.top, 8)
                    }
                    .tint(.white)
                    .foregroundStyle(.white)
                }

                Button {
                    Task { await start() }
                } label: {
                    HStack {
                        if isStarting {
                            ProgressView().controlSize(.small).tint(.black)
                            Text("Starter Leadgrid …")
                        } else {
                            Image(systemName: "wand.and.stars")
                            Text("La Leadgrid gjøre jobben")
                        }
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .font(.headline)
                    .foregroundStyle(.black)
                    .padding()
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .disabled(!canStart || isStarting)
                .opacity(canStart ? 1 : 0.5)

                Group {
                    Text("Det vi gjør for deg:")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.7))
                        .textCase(.uppercase)
                    bullet(icon: "magnifyingglass", text: "Slår opp BRREG (org-nr + offisielt navn)")
                    bullet(icon: "photo", text: "Henter logo automatisk")
                    bullet(icon: "doc.text.magnifyingglass", text: "Tråler websiten og finner mangler")
                    bullet(icon: "envelope", text: "Sender klient-portal-lenke")
                }
                .padding(.top, 14)
                Spacer(minLength: 40)
            }
            .padding(24)
        }
    }

    private func fieldGroup(
        label: String, hint: String?,
        text: Binding<String>, keyboard: UIKeyboardType,
        placeholder: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white)
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(12)
                .background(.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(.white)
                .tint(.white)
            if let h = hint {
                Text(h).font(.caption2).foregroundStyle(.white.opacity(0.55))
            }
        }
    }

    private func bullet(icon: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(.white.opacity(0.7))
                .frame(width: 20)
            Text(text)
                .font(.callout)
                .foregroundStyle(.white.opacity(0.85))
            Spacer()
        }
    }

    private var canStart: Bool {
        let urlOk = websiteUrl.trimmingCharacters(in: .whitespaces).count > 4
        let emailOk = contactEmail.contains("@") && contactEmail.contains(".")
        return urlOk && emailOk
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { error != nil }, set: { if !$0 { error = nil } })
    }

    // MARK: - Progress

    @ViewBuilder
    private func progressContent(audit a: AutoOnboardAudit) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Spacer().frame(height: 40)

                VStack(alignment: .leading, spacing: 8) {
                    Text(headlineFor(audit: a))
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(.white)
                    if let subtitle = subtitleFor(audit: a) {
                        Text(subtitle)
                            .font(.title3)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }

                if a.status == "running" || a.status == "pending" {
                    runningSteps
                } else if a.status == "completed" {
                    completedSummary(audit: a)
                } else if a.status == "duplicate" {
                    duplicateNotice(audit: a)
                } else if a.status == "failed" {
                    failedNotice(audit: a)
                }

                Spacer(minLength: 40)
            }
            .padding(24)
        }
    }

    private func headlineFor(audit a: AutoOnboardAudit) -> String {
        switch a.status {
        case "running", "pending": return "Leadgrid jobber for deg …"
        case "completed":          return "Gjort. \(a.brregName ?? "Ny kunde") er på gridden."
        case "duplicate":          return "Denne kunden finnes allerede"
        case "failed":             return "Noe stoppet oss"
        default:                   return "Status: \(a.status)"
        }
    }

    private func subtitleFor(audit a: AutoOnboardAudit) -> String? {
        switch a.status {
        case "running", "pending":
            return "Vi tråler, scorer og sender en e-post — kommer tilbake om 10–30 sekunder."
        case "completed":
            return "Klient-portalen er sendt til \(a.contactEmail ?? "kontakten").)"
        case "duplicate":
            return "\(a.websiteUrl ?? "") er allerede et prosjekt hos dere."
        case "failed":
            return a.errorMessage ?? "Ukjent feil"
        default: return nil
        }
    }

    private var runningSteps: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(progressSteps, id: \.title) { step in
                HStack(spacing: 14) {
                    if step.done {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    } else if step.active {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "circle")
                            .foregroundStyle(.white.opacity(0.3))
                    }
                    Text(step.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(step.done || step.active ? .white : .white.opacity(0.5))
                    Spacer()
                }
            }
        }
    }

    private var progressSteps: [(title: String, done: Bool, active: Bool)] {
        // Tilnærmet fremdrift basert på audit-data
        let hasBrreg = audit?.brregName != nil
        let hasCustomer = audit?.customerId != nil
        let hasScout = audit?.compositeScore != nil
        let hasToken = audit?.clientToken != nil
        return [
            ("Slår opp BRREG", hasBrreg, !hasBrreg),
            ("Henter logo", hasCustomer, hasBrreg && !hasCustomer),
            ("Tråler website + behovs-analyse", hasScout, hasCustomer && !hasScout),
            ("Sender klient-portal-lenke", hasToken, hasScout && !hasToken),
        ]
    }

    private func completedSummary(audit a: AutoOnboardAudit) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 16) {
                if let logo = a.logoUrl, let u = URL(string: logo) {
                    AsyncImage(url: u) { phase in
                        if case .success(let img) = phase {
                            img.resizable().scaledToFit()
                        }
                    }
                    .frame(width: 64, height: 64)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                VStack(alignment: .leading) {
                    Text(a.brregName ?? "Ny kunde")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(.white)
                    if let orgnr = a.brregOrgNumber {
                        Text("Org-nr \(orgnr)")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.6))
                    }
                }
                Spacer()
            }
            .padding(16)
            .background(.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))

            HStack(spacing: 14) {
                statTile(value: "\(a.compositeScore ?? 0)", label: "Score", color: scoreColor(a.compositeScore ?? 0))
                statTile(value: "\(a.needsCount ?? 0)", label: "Behov", color: .orange)
                statTile(value: "\(a.signalsCount ?? 0)", label: "Signaler", color: .blue)
            }

            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "envelope.badge.fill")
                    .foregroundStyle(.green)
                Text("E-post sendt til \(a.contactEmail ?? "")")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.white)
                Text("De ser klient-portalen så snart de klikker.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.6))
            }
            .padding(14)
            .background(.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))

            Button {
                pollTimer?.cancel()
                dismiss()
            } label: {
                HStack {
                    Text("Vis kunden i porteføljen")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
                .padding()
                .foregroundStyle(.black)
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
        }
    }

    private func statTile(value: String, label: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.6))
                .textCase(.uppercase)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }

    private func duplicateNotice(audit a: AutoOnboardAudit) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Allerede et prosjekt", systemImage: "doc.on.doc")
                .foregroundStyle(.yellow)
            Text("Vi opprettet derfor ikke et nytt — gå til porteføljen for å åpne den eksisterende.")
                .font(.callout)
                .foregroundStyle(.white.opacity(0.8))
        }
        .padding()
        .background(.yellow.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }

    private func failedNotice(audit a: AutoOnboardAudit) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Feil", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(a.errorMessage ?? "Ukjent feil")
                .font(.callout)
                .foregroundStyle(.white.opacity(0.8))
        }
        .padding()
        .background(.red.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }

    private func scoreColor(_ s: Int) -> Color {
        switch s {
        case 80...:    return .green
        case 60..<80:  return .yellow
        case 40..<60:  return .orange
        default:       return .red
        }
    }

    // MARK: - Actions

    private func start() async {
        guard let api = appState.api,
              let orgId = appState.activeOrganizationId else {
            error = "Mangler organisasjon"
            return
        }
        isStarting = true
        defer { isStarting = false }
        do {
            let resp = try await api.autoOnboardCustomer(
                websiteUrl: websiteUrl.trimmingCharacters(in: .whitespaces),
                contactEmail: contactEmail.trimmingCharacters(in: .whitespaces),
                contactName: contactName.isEmpty ? nil : contactName,
                contactPhone: contactPhone.isEmpty ? nil : contactPhone,
                organizationId: orgId,
                presetId: presetId
            )
            auditId = resp.auditId
            // Start polling
            pollTimer = Task { await pollUntilDone(auditId: resp.auditId) }
        } catch {
            self.error = String(describing: error)
        }
    }

    private func pollUntilDone(auditId: String) async {
        guard let api = appState.api else { return }
        while !Task.isCancelled {
            do {
                let resp = try await api.fetchAutoOnboardStatus(auditId: auditId)
                audit = resp.audit
                if resp.audit.isTerminal { break }
            } catch { /* fortsetter */ }
            try? await Task.sleep(nanoseconds: 2_500_000_000)
        }
    }
}
