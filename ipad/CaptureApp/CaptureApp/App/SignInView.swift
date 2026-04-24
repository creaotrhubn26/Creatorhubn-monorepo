import SwiftUI

/// Sign-in surface. Three paths, in preference order:
/// 1. **Sign in with Google** (primary) — opens Google's OAuth flow in
///    ``ASWebAuthenticationSession`` via ``GoogleOAuthCoordinator``.
///    Returns an ID token that the backend exchanges via
///    ``/api/auth/google/token``. Only shown when the Info.plist
///    contains a ``GoogleOAuthClientID`` (see
///    ``GoogleOAuthCoordinator`` for the one-time setup steps).
/// 2. **Paste Google ID token** — fallback for builds without an iOS
///    OAuth client registered yet; paste a token from Google OAuth
///    Playground or any ID-token source. Same backend route as (1).
/// 3. **CreatorHub bearer** — paste an already-issued session bearer
///    directly. Useful for staging environments where Google OAuth
///    isn't wired yet or for running tests against a pre-issued
///    session.
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
    @State private var googleOAuth = GoogleOAuthCoordinator()

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
                        if googleOAuth.isConfigured {
                            Button {
                                Task { await signInWithGoogleNative() }
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: "g.circle.fill")
                                        .font(.title3)
                                    Text("Sign in with Google")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(isWorking)
                            Text("Opens Google in a secure system sheet. No credentials touch the app — only the resulting ID token, which the backend exchanges for a CreatorHub session.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        } else {
                            Text("Native Google sign-in isn't configured on this build. Set `GoogleOAuthClientID` in Info.plist (see GoogleOAuthCoordinator for the one-time Google Cloud Console steps), or paste a Google ID token below — backend exchanges it via /api/auth/google/token.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
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

    /// Kick off the native Google OAuth flow. We obtain a Google
    /// ``id_token`` from ``GoogleOAuthCoordinator`` + pipe it into the
    /// existing ``signInWithGoogleIDToken`` pipeline — so the backend
    /// contract is identical to the paste flow.
    private func signInWithGoogleNative() async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        guard let baseURL = URL(string: backendBaseURLString) else {
            errorMessage = "Invalid backend URL"
            return
        }
        do {
            let idToken = try await googleOAuth.obtainIDToken()
            try await auth.signInWithGoogleIDToken(
                backendBaseURL: baseURL,
                googleIDToken: idToken,
            )
            dismiss()
        } catch GoogleOAuthCoordinator.OAuthError.userCancelled {
            // Silent — cancelling isn't a failure worth a banner.
        } catch {
            errorMessage = error.localizedDescription
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
