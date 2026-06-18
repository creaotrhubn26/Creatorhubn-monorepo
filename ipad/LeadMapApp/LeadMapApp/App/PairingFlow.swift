// PairingFlow.swift
//
// To innloggings-veier for Leadgrid på iPad:
//
//   A. Google Sign-In (anbefalt — standalone)
//      For brukere som ikke har Leadgrid-konto fra før. Logger inn via
//      Google OAuth direkte i appen, opprettes som Solo Free-org hvis
//      ikke finnes.
//
//   B. 8-tegns pairing-kode (for eksisterende Leadgrid-brukere)
//      Generert i webgrensesnittet under Leadgrid Innstillinger → Enheter.
//      Bytter mot permanent bearer-token via /api/ipad-tokens/exchange.
//
// AVCaptureSession QR-scanner kommer i fase 3.

import SwiftUI
import AVFoundation
import AuthenticationServices

struct PairingView: View {
    @Environment(AppState.self) private var appState
    @State private var pairCode: String = ""
    @State private var isPairing = false
    @State private var isGoogleSigning = false
    @State private var errorMessage: String?
    @State private var showManualCode = false

    var body: some View {
        ZStack {
            // Branding-backdrop: vertikal scene som matcher onboarding-følelsen
            Image("Backdrop3")
                .resizable()
                .scaledToFill()
                .ignoresSafeArea()
                .overlay(
                    LinearGradient(
                        colors: [.black.opacity(0.0), .black.opacity(0.55)],
                        startPoint: .top, endPoint: .bottom
                    )
                    .ignoresSafeArea()
                )
            paringContent
        }
    }

    private var paringContent: some View {
        VStack(spacing: 24) {
            Image("LeadgridLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: 22))
                .shadow(color: .black.opacity(0.5), radius: 20, x: 0, y: 8)
            Text("Leadgrid")
                .font(.largeTitle.bold())
                .foregroundStyle(.white)
            Text("Logg inn for å begynne")
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)

            // PRIMÆR: Google Sign-In (standalone, ingen pairing-kode nødvendig)
            Button {
                Task { await signInWithGoogle() }
            } label: {
                HStack(spacing: 12) {
                    if isGoogleSigning {
                        ProgressView().progressViewStyle(.circular).tint(.black)
                    } else {
                        Image(systemName: "g.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.black)
                    }
                    Text("Fortsett med Google")
                        .font(.headline)
                        .foregroundStyle(.black)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .disabled(isGoogleSigning)
            .padding(.horizontal, 32)

            // Separator
            HStack {
                Rectangle().fill(.white.opacity(0.2)).frame(height: 1)
                Text("eller").font(.caption).foregroundStyle(.white.opacity(0.5))
                Rectangle().fill(.white.opacity(0.2)).frame(height: 1)
            }
            .padding(.horizontal, 48)

            // SEKUNDÆR: 8-tegns pairing-kode (for eksisterende web-brukere)
            Button {
                withAnimation { showManualCode.toggle() }
            } label: {
                Text(showManualCode ? "Skjul pairing-kode" : "Jeg har en pairing-kode")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.8))
            }

            if showManualCode {
                instructionsCard
                    .transition(.opacity)

                VStack(spacing: 12) {
                    TextField("XXXX-XXXX", text: $pairCode)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .multilineTextAlignment(.center)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .onChange(of: pairCode) { _, newValue in
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
                            ProgressView().progressViewStyle(.circular).tint(.white)
                        } else {
                            Text("Koble til")
                                .frame(maxWidth: .infinity)
                                .fontWeight(.bold)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(pairCode.replacingOccurrences(of: "-", with: "").count < 8 || isPairing)
                }
                .padding(.horizontal, 32)
                .transition(.opacity)
            }

            if let errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Spacer()

            // Footer m/ link til registrering
            VStack(spacing: 4) {
                Text("Ny her?")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
                Link("Opprett konto på theroleroom.com/leadgrid",
                     destination: URL(string: "https://theroleroom.com/leadgrid")!)
                    .font(.caption.bold())
                    .foregroundStyle(.tint)
            }
            .padding(.bottom, 24)
        }
        .padding(.top, 60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var instructionsCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Slik henter du koden", systemImage: "info.circle")
                .font(.caption.bold())
                .foregroundStyle(.tint)
            Text("1. Logg inn på theroleroom.com/leadgrid")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("2. Innstillinger → Mine enheter → Par ny enhet")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("3. Skriv inn 8-tegns koden under")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(Color.tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal, 32)
    }

    // MARK: - Google Sign-In

    private func signInWithGoogle() async {
        isGoogleSigning = true
        errorMessage = nil
        defer { isGoogleSigning = false }
        do {
            let token = try await GoogleSignInService.shared.signIn()
            let response = try await PairExchangeService.shared.exchangeGoogleToken(idToken: token)
            await appState.signIn(token: response.bearer, email: response.user.email)
        } catch {
            errorMessage = "Google-innlogging feilet: \(error.localizedDescription)"
        }
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
