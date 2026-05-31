import SwiftUI

/// Modal som vises når Creatorhub One Desk (Mac) sender en paring-request.
/// Fotografen ser navnet på Desk-en + den 4-sifrede PIN-en Desk har
/// generert, og bekrefter at samme PIN står på Desk-skjermen.
///
/// PIN-en er ikke "tast inn" — den er "verifiser". Out-of-band-channelen
/// er øynene til fotografen som leser PIN på Desk-skjermen og matcher
/// den mot tallene som vises i denne prompten.
///
/// Sheet er ikke-dismissable utenfra (no swipe-down) — bruker MÅ trykke
/// "Godta" eller "Avvis" så Desk får respons. Time-out i
/// ``PairingConnection`` rejecter automatisk hvis fotografen ignorerer.
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
                Text("Par med Desk")
                    .font(.title2.weight(.semibold))
            }
            .padding(.top, 12)

            Text("\(deskDisplayName) vil pares med denne iPaden for live mirror under shoot.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            VStack(spacing: 12) {
                Text("Sjekk at PIN-en under matcher det som vises på Desk:")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Text(request.pin)
                    .font(.system(size: 56, weight: .heavy, design: .rounded).monospacedDigit())
                    .tracking(12)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 32)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(uiColor: .secondarySystemBackground))
                    )
            }

            VStack(spacing: 8) {
                Button(action: onAccept) {
                    Text("Godta paring")
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
            ? "Creatorhub One Desk"
            : request.deskName
    }
}
