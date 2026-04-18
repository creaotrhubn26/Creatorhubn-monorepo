import SwiftUI

/// MVP sign-in surface. Two paths:
/// 1. **Google ID token** — paste an ID token (e.g. from Google OAuth
///    Playground or the GoogleSignIn SDK once integrated). Backend
///    exchanges via /api/auth/google/token and returns a CreatorHub
///    bearer.
/// 2. **CreatorHub bearer** — paste an already-issued session bearer
///    directly. Useful for staging environments where Google OAuth isn't
///    wired yet.
///
/// Once GoogleSignIn-Swift SPM is added (task #73), this view collapses
/// to a single "Sign in with Google" button and the SDK handles the
/// rest. The service contract stays identical so nothing downstream
/// needs to change.
struct SignInView: View {
    @Environment(SignInService.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @AppStorage("capture.backendBaseURL") private var backendBaseURLString: String =
        "https://creatorhub-backend-rtbl.onrender.com"

    @State private var mode: Mode = .googleIdToken
    @State private var googleIdToken: String = ""
    @State private var bearer: String = ""
    @State private var manualUserId: String = ""
    @State private var manualEmail: String = ""
    @State private var manualName: String = ""
    @State private var isWorking: Bool = false
    @State private var errorMessage: String?

    enum Mode: String, CaseIterable, Hashable {
        case googleIdToken = "Google ID token"
        case manualBearer  = "CreatorHub bearer"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("CreatorHub backend") {
                    TextField("Base URL", text: $backendBaseURLString)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section("Sign in") {
                    Picker("Method", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { m in Text(m.rawValue).tag(m) }
                    }
                    .pickerStyle(.segmented)

                    switch mode {
                    case .googleIdToken:
                        Text("Paste a Google ID token. The backend exchanges it via /api/auth/google/token. The native GoogleSignIn SDK lands in a follow-up; for now this lets us validate end-to-end with a token from Google's OAuth Playground.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        TextEditor(text: $googleIdToken)
                            .frame(minHeight: 80)
                            .font(.caption.monospaced())
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    case .manualBearer:
                        Text("Use this when Google OAuth isn't yet configured for the iPad — paste an already-issued CreatorHub session bearer.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        SecureField("Bearer token", text: $bearer)
                        TextField("User id (UUID)", text: $manualUserId)
                            .autocorrectionDisabled().textInputAutocapitalization(.never)
                        TextField("Email", text: $manualEmail)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled().textInputAutocapitalization(.never)
                        TextField("Display name", text: $manualName)
                    }
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Sign in", systemImage: "person.crop.circle.badge.checkmark")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking || !canSubmit)
                }

                if let s = auth.session {
                    Section("Currently signed in as") {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.displayName).font(.body.weight(.semibold))
                            Text(s.email).font(.caption).foregroundStyle(.secondary)
                            Text(s.userId).font(.caption2.monospaced()).foregroundStyle(.tertiary)
                        }
                        Button(role: .destructive) {
                            auth.signOut()
                        } label: {
                            Label("Sign out", systemImage: "arrow.backward.circle")
                        }
                    }
                }
            }
            .navigationTitle("CreatorHub sign-in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var canSubmit: Bool {
        guard URL(string: backendBaseURLString) != nil else { return false }
        switch mode {
        case .googleIdToken:
            return !googleIdToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .manualBearer:
            return !bearer.isEmpty && !manualUserId.isEmpty && !manualEmail.isEmpty
        }
    }

    private func submit() async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        guard let baseURL = URL(string: backendBaseURLString) else {
            errorMessage = "Invalid backend URL"
            return
        }
        do {
            switch mode {
            case .googleIdToken:
                try await auth.signInWithGoogleIDToken(
                    backendBaseURL: baseURL,
                    googleIDToken: googleIdToken.trimmingCharacters(in: .whitespacesAndNewlines),
                )
            case .manualBearer:
                try auth.signInWithBearer(
                    backendBaseURL: baseURL,
                    bearer: bearer.trimmingCharacters(in: .whitespacesAndNewlines),
                    userId: manualUserId.trimmingCharacters(in: .whitespacesAndNewlines),
                    email: manualEmail.trimmingCharacters(in: .whitespacesAndNewlines),
                    displayName: manualName.isEmpty ? manualEmail : manualName,
                )
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
