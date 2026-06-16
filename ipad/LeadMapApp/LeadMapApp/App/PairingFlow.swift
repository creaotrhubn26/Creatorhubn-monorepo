// PairingFlow.swift
//
// Pair-flow: brukeren skriver inn 8-tegns kode (XXXX-XXXX) som ble
// generert i web. Vi bytter mot et permanent bearer-token via
// /api/ipad-tokens/exchange og lagrer i Keychain.
//
// AVCaptureSession QR-scanner kommer i fase 3.

import SwiftUI
import AVFoundation

struct PairingView: View {
    @Environment(AppState.self) private var appState
    @State private var pairCode: String = ""
    @State private var isPairing = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "map.fill")
                .font(.system(size: 64))
                .foregroundStyle(.tint)
            Text("Lead Map")
                .font(.largeTitle.bold())
            Text("Koble iPad til Lead Map-kontoen din")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            instructionsCard

            QRScannerView(
                onScan: { payload in
                    Task { await exchangeQR(payload) }
                },
                onError: { error in
                    errorMessage = error.localizedDescription
                }
            )
            .frame(maxWidth: 420, maxHeight: 220)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(Color.purple.opacity(0.5), lineWidth: 2)
            )
            .padding(.horizontal, 32)

            VStack(spacing: 12) {
                Text("Eller skriv koden manuelt")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                TextField("XXXX-XXXX", text: $pairCode)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 28, weight: .bold, design: .monospaced))
                    .multilineTextAlignment(.center)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .onChange(of: pairCode) { _, newValue in
                        // Auto-formater: store bokstaver + bindestrek etter 4 tegn
                        let upper = newValue.uppercased().filter { $0.isLetter || $0.isNumber }
                        if upper.count > 4 && !newValue.contains("-") {
                            pairCode = "\(upper.prefix(4))-\(upper.suffix(upper.count - 4))"
                        } else if upper.count <= 4 {
                            pairCode = upper
                        } else {
                            pairCode = newValue.uppercased()
                        }
                    }

                Button {
                    Task { await exchange() }
                } label: {
                    if isPairing {
                        ProgressView().progressViewStyle(.circular)
                            .tint(.white)
                    } else {
                        Text("Koble til")
                            .frame(maxWidth: .infinity)
                            .fontWeight(.bold)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(pairCode.replacingOccurrences(of: "-", with: "").count < 8 || isPairing)

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.caption)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 32)

            Spacer()
        }
        .padding(.top, 60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var instructionsCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Slik kobler du til", systemImage: "info.circle")
                .font(.caption.bold())
                .foregroundStyle(.tint)
            Text("1. Åpne theroleroom.com → Admin Room → Lead Map")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("2. Trykk på iPad-ikonet i toppen")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("3. Skriv inn 8-tegns koden under (eller scan QR senere)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(Color.tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal, 32)
    }

    private func exchange() async {
        let cleaned = pairCode.replacingOccurrences(of: "-", with: "")
        guard cleaned.count == 8 else { return }
        isPairing = true
        errorMessage = nil
        do {
            let response = try await PairExchangeService.shared.exchange(shortCode: pairCode)
            await appState.signIn(token: response.bearer, email: response.user.email)
        } catch let err as PairExchangeError {
            errorMessage = err.errorDescription
        } catch {
            errorMessage = "Uventet feil: \(error.localizedDescription)"
        }
        isPairing = false
    }

    /// Trigget av QR-scanner når en kode oppdages. Forventer
    /// `ROLE-ROOM-PAIR:<token>` payload generert av web.
    private func exchangeQR(_ payload: String) async {
        guard !isPairing else { return }
        isPairing = true
        errorMessage = nil
        do {
            let response = try await PairExchangeService.shared.exchange(qrPayload: payload)
            await appState.signIn(token: response.bearer, email: response.user.email)
        } catch let err as PairExchangeError {
            errorMessage = err.errorDescription
        } catch {
            errorMessage = "Uventet feil: \(error.localizedDescription)"
        }
        isPairing = false
    }
}

// Workaround: Color.tint krever ekstern type — bruker en mild accent.
private extension Color {
    static var tint: Color { Color(red: 0.752, green: 0.518, blue: 0.988) } // #c084fc (samme som web-accent)
}
