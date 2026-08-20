import SwiftUI

struct LoginView: View {
    @Environment(Session.self) private var session
    @State private var email = ""
    @State private var sent = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image("ReknarenMark")
                .resizable()
                .scaledToFit()
                .frame(width: 84, height: 84)
                .accessibilityLabel("Reknaren")
            Text("Reknaren").font(.largeTitle.bold())
            Text("Regnskapet ditt, forklart på vanlig norsk.\nPassordløs innlogging med engangslenke på e-post.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if sent {
                ContentUnavailableView("Sjekk e-posten din",
                                       systemImage: "envelope.badge",
                                       description: Text("Vi sendte en innloggingslenke til \(email). Åpne den for å logge inn."))
                    .frame(maxWidth: 360)
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
                        if busy { ProgressView() } else { Text("Send innloggingslenke").frame(maxWidth: .infinity) }
                    }
                    .buttonStyle(.borderedProminent)
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
