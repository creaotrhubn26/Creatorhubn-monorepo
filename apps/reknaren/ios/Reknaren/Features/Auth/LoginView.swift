import SwiftUI

struct LoginView: View {
    @Environment(Session.self) private var session
    @State private var email = ""
    @State private var sent = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ZStack {
            LoginBackdrop()
            content
        }
    }

    private var content: some View {
        VStack(spacing: 16) {
            Spacer()
            ReidarView(style: sent ? .success : (busy ? .loading : .idle), size: 132,
                       caption: busy ? "Sender innloggingslenke…" : nil)
            Text("Reknaren").font(.largeTitle.bold())
            Text("Regnskapet ditt, forklart på vanlig norsk.\nPassordløs innlogging med engangslenke på e-post.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if sent {
                VStack(spacing: 6) {
                    Text("Sjekk e-posten din").font(.headline)
                    Text("Vi sendte en innloggingslenke til \(email). Åpne den for å logge inn.")
                        .font(.subheadline).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: 320)
            } else {
                VStack(spacing: 10) {
                    TextField("E-post", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                    Button {
                        Task { await requestLink() }
                    } label: {
                        if busy { ProgressView().tint(.white).frame(maxWidth: .infinity) } else { Text("Send innloggingslenke") }
                    }
                    .buttonStyle(ReknarenPrimaryButtonStyle())
                    .disabled(busy || email.isEmpty)
                    if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                }
                .frame(maxWidth: 360)
            }
            Spacer()
        }
        .padding()
    }

    private func requestLink() async {
        busy = true; error = nil
        do {
            try await session.requestMagicLink(email: email.trimmingCharacters(in: .whitespaces))
            sent = true
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}

/// Branded login-bakgrunn: varm bunn + myk skoggrønn glød oppe, gull-hint nede,
/// og et stort, svakt R-merke som vannmerke. Rolig — ikke støyende.
private struct LoginBackdrop: View {
    var body: some View {
        ZStack {
            Color.reknarenGround.ignoresSafeArea()
            RadialGradient(
                colors: [Color.reknarenGreen.opacity(0.16), .clear],
                center: .init(x: 0.5, y: 0.28), startRadius: 8, endRadius: 360
            )
            .ignoresSafeArea()
            RadialGradient(
                colors: [Color.reknarenGold.opacity(0.10), .clear],
                center: .init(x: 0.9, y: 0.9), startRadius: 8, endRadius: 300
            )
            .ignoresSafeArea()
            Image("ReknarenMark")
                .resizable().scaledToFit()
                .frame(width: 520)
                .opacity(0.04)
                .offset(x: 120, y: -180)
                .ignoresSafeArea()
        }
        .allowsHitTesting(false)
    }
}
