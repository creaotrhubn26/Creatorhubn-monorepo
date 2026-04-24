import SwiftUI

/// Sign-in surface. Default UX is a single "Logg inn med Google"-button
/// — the photographer never has to see a URL, token, or bearer. The
/// old backend-URL + paste-token fields are still accessible, but
/// hidden behind an "Avansert"-disclosure so they only surface for
/// staging / dev / troubleshooting.
///
/// When Google OAuth isn't yet configured on the build (iOS OAuth
/// client placeholders still in Info.plist), the view falls back to
/// showing the advanced panel expanded by default — so developer
/// builds stay usable end-to-end.
///
/// This view is intentionally *navigation-free*: callers own the
/// container (onboarding step vs. modal sheet) so they can provide
/// the right title + dismiss affordance. See ``OnboardingView`` and
/// ``LiveCaptureView`` for the two current call-sites.
struct SignInView: View {
    @Environment(SignInService.self) private var auth

    @AppStorage("capture.backendBaseURL") private var backendBaseURLString: String =
        "https://creatorhub-backend-rtbl.onrender.com"

    @State private var isWorking: Bool = false
    @State private var errorMessage: String?
    @State private var googleOAuth = GoogleOAuthCoordinator()

    // Advanced-mode state — only read when the disclosure is open.
    @State private var showAdvanced: Bool = false
    @State private var googleIdToken: String = ""
    @State private var bearer: String = ""
    @State private var manualUserId: String = ""
    @State private var manualEmail: String = ""
    @State private var manualName: String = ""

    var body: some View {
        // Scroll so the advanced panel can grow without clipping on
        // shorter iPad layouts (e.g. split-view).
        ScrollView {
            VStack(spacing: 28) {
                if let session = auth.session {
                    signedInCard(session)
                } else {
                    primaryCTA
                }

                if let errorMessage {
                    errorBanner(errorMessage)
                }

                advancedDisclosure

                if showAdvanced {
                    advancedPanel
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
            .frame(maxWidth: 640) // Cap width so fields don't sprawl on wide iPads.
            .frame(maxWidth: .infinity)
        }
        .onAppear {
            // If the build hasn't wired native Google sign-in yet, open
            // the advanced panel by default — otherwise the screen would
            // present an empty centre with no way forward.
            if !googleOAuth.isConfigured {
                showAdvanced = true
            }
        }
    }

    // MARK: - Primary CTA

    @ViewBuilder
    private var primaryCTA: some View {
        VStack(spacing: 16) {
            Button {
                Task { await signInWithGoogleNative() }
            } label: {
                HStack(spacing: 12) {
                    if isWorking {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "g.circle.fill")
                            .font(.title3)
                    }
                    Text("Logg inn med Google")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(isWorking || !googleOAuth.isConfigured)

            Text(googleOAuth.isConfigured
                 ? "Åpner Google i en sikker system-popup. Passordet ditt berører aldri appen — bare innlogginsbeviset som backend bytter mot en CreatorHub-session."
                 : "Google-innlogging er ikke konfigurert på denne builden. Bruk Avansert-panelet under for å logge inn manuelt.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
        }
    }

    // MARK: - Signed-in state

    @ViewBuilder
    private func signedInCard(_ session: SignInService.StoredSession) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 44))
                .foregroundStyle(.green)
            Text("Du er logget inn")
                .font(.title3.bold())
            VStack(spacing: 2) {
                Text(session.displayName)
                    .font(.body.weight(.semibold))
                Text(session.email)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            Button(role: .destructive) {
                auth.signOut()
            } label: {
                Label("Logg ut", systemImage: "arrow.backward.circle")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.regular)
            .padding(.top, 4)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(uiColor: .secondarySystemBackground)),
        )
    }

    // MARK: - Error banner

    @ViewBuilder
    private func errorBanner(_ message: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(message)
                .font(.footnote)
                .foregroundStyle(.red)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.red.opacity(0.08)),
        )
    }

    // MARK: - Advanced disclosure

    private var advancedDisclosure: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                showAdvanced.toggle()
            }
        } label: {
            HStack(spacing: 6) {
                Text(showAdvanced ? "Skjul avansert" : "Avansert innlogging")
                    .font(.callout)
                Image(systemName: showAdvanced ? "chevron.up" : "chevron.down")
                    .font(.caption2.weight(.semibold))
            }
            .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var advancedPanel: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Backend URL — only changes for staging / self-hosted.
            VStack(alignment: .leading, spacing: 6) {
                Text("CreatorHub backend")
                    .font(.subheadline.weight(.semibold))
                TextField("Base URL", text: $backendBaseURLString)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Text("Peker på produksjonsserveren som standard. Endre kun for staging eller lokal backend.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            // Manual Google ID token paste (fallback when native OAuth
            // isn't configured, or for debugging a specific token).
            VStack(alignment: .leading, spacing: 6) {
                Text("Lim inn Google ID-token")
                    .font(.subheadline.weight(.semibold))
                TextEditor(text: $googleIdToken)
                    .frame(minHeight: 70)
                    .font(.caption.monospaced())
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color(uiColor: .separator), lineWidth: 0.5),
                    )
                Text("Fra OAuth Playground eller GoogleSignIn-SDK. Backend bytter den mot en CreatorHub-session.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button {
                    Task { await submitWithPastedToken() }
                } label: {
                    HStack {
                        if isWorking { ProgressView().controlSize(.small) }
                        Text("Logg inn med limt token")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isWorking || googleIdToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            Divider()

            // Direct CreatorHub bearer — staging / test shortcut.
            VStack(alignment: .leading, spacing: 6) {
                Text("CreatorHub session bearer")
                    .font(.subheadline.weight(.semibold))
                SecureField("Bearer", text: $bearer)
                    .textFieldStyle(.roundedBorder)
                TextField("Bruker-ID (UUID)", text: $manualUserId)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("E-post", text: $manualEmail)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("Visningsnavn (valgfritt)", text: $manualName)
                    .textFieldStyle(.roundedBorder)
                Text("Bruk når Google OAuth ikke er wiret — lim inn en forhåndsutstedt session-bearer.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button {
                    Task { await submitWithBearer() }
                } label: {
                    HStack {
                        if isWorking { ProgressView().controlSize(.small) }
                        Text("Logg inn med bearer")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isWorking || bearer.isEmpty || manualUserId.isEmpty || manualEmail.isEmpty)
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(uiColor: .secondarySystemBackground)),
        )
    }

    // MARK: - Actions

    /// Primary CTA — kick off native Google OAuth + pipe the resulting
    /// id-token through the existing exchange endpoint. The photographer
    /// never sees the token.
    private func signInWithGoogleNative() async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        guard let baseURL = URL(string: backendBaseURLString) else {
            errorMessage = "Ugyldig backend-URL"
            return
        }
        do {
            let idToken = try await googleOAuth.obtainIDToken()
            try await auth.signInWithGoogleIDToken(
                backendBaseURL: baseURL,
                googleIDToken: idToken,
            )
        } catch GoogleOAuthCoordinator.OAuthError.userCancelled {
            // Silent — cancelling isn't a failure worth a banner.
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func submitWithPastedToken() async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        guard let baseURL = URL(string: backendBaseURLString) else {
            errorMessage = "Ugyldig backend-URL"
            return
        }
        let trimmed = googleIdToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            try await auth.signInWithGoogleIDToken(
                backendBaseURL: baseURL,
                googleIDToken: trimmed,
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func submitWithBearer() async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        guard let baseURL = URL(string: backendBaseURLString) else {
            errorMessage = "Ugyldig backend-URL"
            return
        }
        let trimmedBearer = bearer.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedUserId = manualUserId.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedEmail  = manualEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedBearer.isEmpty, !trimmedUserId.isEmpty, !trimmedEmail.isEmpty else { return }
        do {
            try auth.signInWithBearer(
                backendBaseURL: baseURL,
                bearer: trimmedBearer,
                userId: trimmedUserId,
                email: trimmedEmail,
                displayName: manualName.isEmpty ? trimmedEmail : manualName,
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
