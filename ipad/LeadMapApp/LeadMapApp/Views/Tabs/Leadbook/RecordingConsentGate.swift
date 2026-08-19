// RecordingConsentGate.swift — Samtykke-gate før lydopptak (2026-08-16)
//
// §4 i docs/leadgrid-gdpr-lydopptak.md: HARD gate — opptak kan ikke starte
// uten at selgeren bekrefter at kunden muntlig har samtykket. Ordlyden
// vises for at selgeren skal kunne lese den opp for kunden. Bekreftelsen
// logges server-side (consent_version + consented_at) FØR mikrofonen
// noensinne åpnes.

import SwiftUI

enum RecordingConsentGate {
    /// Bump denne når ordlyden under endres vesentlig — loggføres som
    /// consent_version slik at gamle samtykker kan spores til riktig tekst.
    static let currentVersion = "v1-2026-08-16"

    static let consentText = """
    «Jeg tar opp denne samtalen for å transkribere den til tekst — det \
    hjelper oss med kvalitetssikring og intern opplæring. Opptaket lagres \
    ikke, kun teksten. Du kan når som helst be om at teksten slettes. \
    Er det greit for deg?»
    """
}

struct RecordingConsentGateSheet: View {
    /// Kalt når selger har bekreftet OG samtykket er logget server-side.
    let onConfirmed: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var customerLabel: String = ""
    @State private var customerConfirmed = false
    @State private var isSaving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Les opp for kunden", systemImage: "text.bubble.fill")
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(LBrand.purpleLight)
                        Text(RecordingConsentGate.consentText)
                            .font(.appScaled(size: 15, design: .serif))
                            .foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
                    .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))

                    VStack(alignment: .leading, spacing: 7) {
                        Text("Kunde (valgfritt — anonymiseres uansett ved publisering)")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(LBrand.textSecondary)
                        TextField("F.eks. «byggfirma, Østlandet»", text: $customerLabel)
                            .foregroundStyle(.white).font(.appScaled(size: 13))
                            .padding(.horizontal, 12).padding(.vertical, 10)
                            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.stroke, lineWidth: 1))
                    }

                    Toggle(isOn: $customerConfirmed) {
                        Text("Kunden har muntlig bekreftet samtykke — PÅ opptaket")
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .tint(LBrand.green)

                    if let error {
                        Text(error).font(.appScaled(size: 12)).foregroundStyle(LBrand.red)
                    }

                    Text("Uten bekreftelse kan opptak ikke startes. Rå lyd lagres aldri — kun den transkriberte teksten, som et vanlig utkast du kan redigere/slette før noe deles.")
                        .font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Samtykke til opptak")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(LBrand.textSecondary)
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) { confirmBar }
        }
    }

    private var confirmBar: some View {
        Button { Task { await confirm() } } label: {
            HStack(spacing: 7) {
                if isSaving { ProgressView().tint(.white) }
                else { Image(systemName: "checkmark.shield.fill").font(.appScaled(size: 13, weight: .bold)) }
                Text(isSaving ? "Logger samtykke …" : "Start opptak").font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(
                LinearGradient(colors: customerConfirmed ? [LBrand.green, LBrand.green.opacity(0.7)] : [LBrand.cardHi, LBrand.cardHi],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(customerConfirmed ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!customerConfirmed || isSaving)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(LBrand.bg.opacity(0.95).overlay(Rectangle().fill(LBrand.stroke).frame(height: 1), alignment: .top))
    }

    private func confirm() async {
        guard let api = appState.api else {
            error = "Ikke innlogget mot backend — samtykke kan ikke logges."
            return
        }
        isSaving = true
        error = nil
        do {
            _ = try await api.leadbookLogRecordingConsent(
                consentVersion: RecordingConsentGate.currentVersion,
                customerLabel: customerLabel
            )
            isSaving = false
            dismiss()
            onConfirmed()
        } catch {
            isSaving = false
            self.error = "Kunne ikke logge samtykke — prøv igjen. (\(error.localizedDescription))"
        }
    }
}
