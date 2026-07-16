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
    @State private var showGetStarted = false

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
                .frame(maxWidth: 460)
        }
    }

    private var paringContent: some View {
        VStack(spacing: 24) {
            // Topp-Spacer sentrerer alt vertikalt — sammen med den
            // eksisterende `Spacer()` foran footeren blir logo + knapper
            // sentrert både på iPad-portrait og Mac Catalyst store vinduer.
            Spacer(minLength: 24)
            // Lockup-en (2026-07-04) inneholder wordmarken — erstatter
            // kvadrat-ikonet + separat «Leadgrid»-tittel.
            Image("LeadgridLockup")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 320)
                .shadow(color: .black.opacity(0.45), radius: 18, x: 0, y: 6)
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

            // Footer: «Kom i gang» — interessenter blir LEADS for Leadgrid
            // (ingen konto-opprettelse her; salg tar kontakt). Nettside: leadgrid.no.
            VStack(spacing: 4) {
                Text("Ny her?")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
                Button {
                    showGetStarted = true
                } label: {
                    Text("Kom i gang med Leadgrid")
                        .font(.caption.bold())
                        .foregroundStyle(.tint)
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 24)
            .sheet(isPresented: $showGetStarted) {
                LeadgridGetStartedSheet()
                    .presentationDetents([.height(340)])
            }
        }
        // Topp-padding fjernet — Spacer() øverst og Spacer() foran footer
        // sentrerer nå innholdet vertikalt.
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var instructionsCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Slik henter du koden", systemImage: "info.circle")
                .font(.caption.bold())
                .foregroundStyle(.tint)
            Text("1. Logg inn på leadgrid.no")
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

// MARK: - «Kom i gang» — interessent-e-post blir lead for Leadgrid

/// Vist fra login-footeren: e-post inn → POST /api/leadgrid/signup-interest
/// (offentlig endepunkt — ingen sesjon finnes her) → Leadgrid-salg tar kontakt.
struct LeadgridGetStartedSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var sending = false
    @State private var sent = false
    @State private var errorMessage: String?

    private var emailLooksValid: Bool {
        let t = email.trimmingCharacters(in: .whitespaces)
        return t.contains("@") && t.contains(".") && t.count >= 6
    }

    var body: some View {
        VStack(spacing: 16) {
            Capsule().fill(.white.opacity(0.25)).frame(width: 40, height: 5).padding(.top, 10)
            if sent {
                Spacer()
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 44)).foregroundStyle(.green)
                Text("Takk for interessen!")
                    .font(.title3.bold()).foregroundStyle(.white)
                Text("Vi tar kontakt på \(email.trimmingCharacters(in: .whitespaces)) for å komme i gang.")
                    .font(.callout).foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center).padding(.horizontal, 28)
                Text("Les mer på leadgrid.no")
                    .font(.caption).foregroundStyle(.white.opacity(0.45))
                Spacer()
                Button("Lukk") { dismiss() }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .padding(.bottom, 20)
            } else {
                Text("Kom i gang med Leadgrid")
                    .font(.title3.bold()).foregroundStyle(.white)
                Text("Legg igjen e-posten din, så tar vi kontakt og setter opp bedriften deres.")
                    .font(.callout).foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center).padding(.horizontal, 28)
                TextField("din@bedrift.no", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .font(.body.monospaced())
                    .foregroundStyle(.white)
                    .padding(14)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 24)
                if let errorMessage {
                    Text(errorMessage).font(.caption).foregroundStyle(.red)
                }
                Button {
                    Task { await submit() }
                } label: {
                    if sending {
                        ProgressView().tint(.white).frame(maxWidth: .infinity)
                    } else {
                        Text("Kom i gang").fontWeight(.bold).frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.horizontal, 24)
                .disabled(!emailLooksValid || sending)
                Spacer()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.05, green: 0.04, blue: 0.10))
        .preferredColorScheme(.dark)
    }

    private func submit() async {
        sending = true; errorMessage = nil
        defer { sending = false }
        struct Body: Encodable { let email: String; let source: String }
        guard let url = URL(string: "\(APIClient.baseURL)/api/leadgrid/signup-interest") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONEncoder().encode(
            Body(email: email.trimmingCharacters(in: .whitespaces), source: "app_login"))
        do {
            let (_, resp) = try await URLSession.shared.data(for: req)
            if let http = resp as? HTTPURLResponse, http.statusCode == 200 {
                sent = true
            } else {
                errorMessage = "Sjekk at e-posten er riktig og prøv igjen."
            }
        } catch {
            errorMessage = "Fikk ikke kontakt med serveren — prøv igjen."
        }
    }
}
