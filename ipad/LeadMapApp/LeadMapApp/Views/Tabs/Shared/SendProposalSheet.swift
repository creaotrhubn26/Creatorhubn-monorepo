// SendProposalSheet.swift
//
// Tilbudssending fra lead (funn #7, produktrevisjonen 2026-07-03) —
// selgeren bygger tilbudet her (tittel + linjer + melding + gyldighet)
// og backend sender branded e-post med «Se tilbudet»-PDF-lenke.
// Åpning hos mottaker fyrer proposal.opened-workflow-eventet.
//
// Design-språk følger AssignToTeamMemberSheet (mørke kort + stroke).

import SwiftUI

private enum SPBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.10)
    static let textDim = Color.white.opacity(0.55)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let red = Color(red: 0.95, green: 0.30, blue: 0.30)
}

private struct ProposalLineDraft: Identifiable {
    let id = UUID()
    var description: String = ""
    var amountText: String = ""

    var amount: Double {
        Double(amountText.replacingOccurrences(of: " ", with: "")
                         .replacingOccurrences(of: ",", with: ".")) ?? 0
    }
}

struct SendProposalSheet: View {
    let leadId: String
    let leadName: String
    let leadEmail: String?
    let api: APIClient?
    var onSent: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""
    @State private var message: String = ""
    @State private var lines: [ProposalLineDraft] = [ProposalLineDraft()]
    @State private var hasValidUntil = false
    @State private var validUntil = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
    @State private var overrideEmail: String = ""
    @State private var sending = false
    @State private var errorText: String?
    @State private var sentOK = false

    private var total: Double { lines.reduce(0) { $0 + $1.amount } }

    private var resolvedEmail: String {
        let manual = overrideEmail.trimmingCharacters(in: .whitespaces)
        if !manual.isEmpty { return manual }
        return leadEmail ?? ""
    }

    private var canSend: Bool {
        !sending
            && !title.trimmingCharacters(in: .whitespaces).isEmpty
            && lines.contains { !$0.description.trimmingCharacters(in: .whitespaces).isEmpty }
            && resolvedEmail.contains("@")
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SPBrand.bg.ignoresSafeArea()
                if sentOK {
                    sentConfirmation
                } else {
                    form
                }
            }
            .navigationTitle("Send tilbud")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(SPBrand.purpleLight)
                }
            }
            .toolbarBackground(SPBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .macCatalystSheetSize(minWidth: 720, minHeight: 680)
    }

    // MARK: Skjema

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Mottaker
                sectionCard("Mottaker", icon: "envelope.fill") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(leadName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                        if let email = leadEmail, !email.isEmpty {
                            Text(email)
                                .font(.system(size: 12))
                                .foregroundStyle(SPBrand.textDim)
                        } else {
                            TextField("E-postadresse (leaden mangler e-post)", text: $overrideEmail)
                                .textFieldStyle(.plain)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(10)
                                .background(SPBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                                .foregroundStyle(.white)
                        }
                    }
                }

                // Tittel + melding
                sectionCard("Tilbud", icon: "doc.text.fill") {
                    VStack(spacing: 10) {
                        TextField("Tittel — f.eks. «Nettside + drift 2026»", text: $title)
                            .textFieldStyle(.plain)
                            .padding(10)
                            .background(SPBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                            .foregroundStyle(.white)
                        TextField("Melding til mottakeren (valgfri)", text: $message, axis: .vertical)
                            .textFieldStyle(.plain)
                            .lineLimit(3...6)
                            .padding(10)
                            .background(SPBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                            .foregroundStyle(.white)
                    }
                }

                // Linjer
                sectionCard("Tilbudslinjer", icon: "list.bullet.rectangle.fill") {
                    VStack(spacing: 8) {
                        ForEach($lines) { $line in
                            HStack(spacing: 8) {
                                TextField("Beskrivelse", text: $line.description)
                                    .textFieldStyle(.plain)
                                    .padding(9)
                                    .background(SPBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                                    .foregroundStyle(.white)
                                TextField("Beløp", text: $line.amountText)
                                    .textFieldStyle(.plain)
                                    .keyboardType(.numberPad)
                                    .multilineTextAlignment(.trailing)
                                    .frame(width: 110)
                                    .padding(9)
                                    .background(SPBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                                    .foregroundStyle(.white)
                                if lines.count > 1 {
                                    Button {
                                        lines.removeAll { $0.id == line.id }
                                    } label: {
                                        Image(systemName: "minus.circle.fill")
                                            .foregroundStyle(SPBrand.red.opacity(0.8))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        Button {
                            lines.append(ProposalLineDraft())
                        } label: {
                            Label("Legg til linje", systemImage: "plus.circle.fill")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(SPBrand.purpleLight)
                        }
                        .buttonStyle(.plain)
                        .frame(maxWidth: .infinity, alignment: .leading)

                        Divider().background(SPBrand.stroke)
                        HStack {
                            Text("Totalsum eks. mva.")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(SPBrand.textDim)
                            Spacer()
                            Text("\(Self.fmt(total)) kr")
                                .font(.system(size: 17, weight: .bold, design: .rounded))
                                .foregroundStyle(SPBrand.green)
                                .monospacedDigit()
                        }
                    }
                }

                // Gyldighet
                sectionCard("Gyldighet", icon: "calendar.badge.clock") {
                    VStack(alignment: .leading, spacing: 8) {
                        Toggle("Sett gyldig-til-dato", isOn: $hasValidUntil)
                            .tint(SPBrand.purple)
                            .foregroundStyle(.white)
                            .font(.system(size: 13, weight: .semibold))
                        if hasValidUntil {
                            DatePicker("Gyldig til", selection: $validUntil, displayedComponents: .date)
                                .datePickerStyle(.compact)
                                .colorScheme(.dark)
                                .font(.system(size: 13))
                                .foregroundStyle(.white)
                        }
                    }
                }

                if let errorText {
                    Text(errorText)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(SPBrand.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                sendButton
                Color.clear.frame(height: 60)
            }
            .padding(20)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var sendButton: some View {
        Button {
            Task { await send() }
        } label: {
            HStack(spacing: 8) {
                if sending {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 14, weight: .bold))
                }
                Text(sending ? "Sender…" : "Send tilbud")
                    .font(.system(size: 15, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(
                    colors: canSend ? [SPBrand.purple, SPBrand.purpleLight] : [SPBrand.cardHi, SPBrand.cardHi],
                    startPoint: .leading, endPoint: .trailing
                ),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .disabled(!canSend)
    }

    private var sentConfirmation: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle().fill(SPBrand.green.opacity(0.20))
                Image(systemName: "checkmark")
                    .font(.system(size: 28, weight: .heavy))
                    .foregroundStyle(SPBrand.green)
            }
            .frame(width: 72, height: 72)
            Text("Tilbudet er sendt")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(.white)
            Text("«\(title)» er på vei til \(resolvedEmail). Du får proposal.opened-hendelsen i workflows når det åpnes.")
                .font(.system(size: 13))
                .foregroundStyle(SPBrand.textDim)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 380)
            Button("Ferdig") { dismiss() }
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(SPBrand.purpleLight)
                .padding(.top, 6)
        }
        .padding(30)
    }

    // MARK: Send

    private func send() async {
        guard let api else {
            errorText = "Ikke innlogget — prøv igjen."
            return
        }
        sending = true
        errorText = nil
        defer { sending = false }

        let payloadLines = lines
            .filter { !$0.description.trimmingCharacters(in: .whitespaces).isEmpty }
            .map { ProposalLinePayload(description: $0.description.trimmingCharacters(in: .whitespaces), amountNok: $0.amount) }
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let payload = CreateProposalPayload(
            title: title.trimmingCharacters(in: .whitespaces),
            message: message.trimmingCharacters(in: .whitespaces),
            lines: payloadLines,
            validUntil: hasValidUntil ? df.string(from: validUntil) : nil,
            toEmail: overrideEmail.trimmingCharacters(in: .whitespaces).isEmpty ? nil : overrideEmail.trimmingCharacters(in: .whitespaces)
        )
        do {
            let resp = try await api.createProposal(leadId: leadId, payload)
            if resp.emailSent {
                sentOK = true
                #if canImport(UIKit)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                #endif
                onSent?()
            } else {
                errorText = "Tilbudet ble lagret, men e-posten feilet (\(resp.emailError ?? "ukjent")). Prøv på nytt senere."
            }
        } catch {
            errorText = "Kunne ikke sende: \(error.localizedDescription)"
        }
    }

    // MARK: Helpers

    private static func fmt(_ v: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: v)) ?? "\(Int(v))"
    }

    @ViewBuilder
    private func sectionCard<Content: View>(
        _ titleText: String,
        icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(SPBrand.purpleLight)
                Text(titleText)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(SPBrand.textDim)
                    .textCase(.uppercase)
                    .tracking(0.6)
            }
            content()
        }
        .padding(14)
        .background(SPBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(SPBrand.stroke, lineWidth: 1))
    }
}
