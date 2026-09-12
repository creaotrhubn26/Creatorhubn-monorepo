import SwiftUI

/// Modal som vises når en datamaskin på samme nettverk ber om å koble seg
/// til denne iPaden. Bruker ser navnet på maskinen + en 4-sifret kode, og
/// bekrefter at samme kode står på maskinens skjerm — det er sjekken som
/// hindrer at en tilfeldig PC på samme Wi-Fi får tilgang til bildene.
///
/// **UX-prinsipp (gap #6):** Tekst er klar nok til at en danser eller
/// klient — ikke bare en fotograf-tech — forstår hva som skjer. Ingen
/// "Desk", "pairing", "Bonjour", "TXT-record" eller andre tech-ord.
///
/// Sheet er ikke-dismissable utenfra (no swipe-down) — bruker MÅ trykke
/// "Tillat" eller "Avvis" så maskinen får respons. Time-out i
/// ``PairingConnection`` rejecter automatisk hvis ingen tar valg.
struct PairWithDeskPromptView: View {
    let request: PairingProtocol.PairRequest
    let onAccept: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 8) {
                Image(systemName: "laptopcomputer.and.iphone")
                    .font(.system(size: 56, weight: .light))
                    .foregroundStyle(.tint)
                Text("Koble til datamaskin?")
                    .font(.title2.weight(.semibold))
            }
            .padding(.top, 12)

            Text("\(deskDisplayName) ber om å koble seg til denne iPaden så bildene kopieres dit etter hvert som du tar dem.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            VStack(spacing: 12) {
                Text("Sjekk at koden under er den samme som vises på datamaskinen:")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                Text(request.pin)
                    .font(.system(size: 56, weight: .heavy, design: .rounded).monospacedDigit())
                    .tracking(12)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 32)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(uiColor: .secondarySystemBackground))
                    )
                Text("Hvis kodene ikke matcher — trykk Avvis.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 8) {
                Button(action: onAccept) {
                    Text("Tillat tilkobling")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)

                Button(role: .cancel, action: onReject) {
                    Text("Avvis")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 16)
        }
        .padding()
        .presentationDetents([.medium])
        .interactiveDismissDisabled(true)
    }

    private var deskDisplayName: String {
        request.deskName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "En datamaskin"
            : request.deskName
    }
}
