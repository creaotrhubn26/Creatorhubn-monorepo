import SwiftUI
import UIKit

/// First-launch CreatorHub One onboarding. Renders four step-screens
/// backed by ``OnboardingState``:
///
///   1. Welcome — brand + one-sentence pitch.
///   2. Value props — three cards explaining what the app does.
///   3. Permissions — primes the user for the camera + local-network
///      system prompts they'll see inside the Shoot tab.
///   4. Sign-in — wraps the existing ``SignInView``.
///
/// State transitions live in the ``OnboardingState`` struct so the
/// full flow is unit-testable without a SwiftUI host. This view is
/// essentially a switch-on-step + a toolbar + a CTA button.
struct OnboardingView: View {
    @State private var state = OnboardingState()
    @Environment(SignInService.self) private var auth
    /// Called when onboarding is complete so the parent can tear it
    /// down and swap in ``CreatorHubOneRootView``.
    var onFinish: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            progressBar

            Group {
                switch state.currentStep {
                case .welcome: welcomeStep
                case .valueProps: valuePropsStep
                case .permissions: permissionsStep
                case .signIn: signInStep
                case .done: Color.clear.onAppear { finish() }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 32)

            if state.showsNextCTA {
                nextCTA
                    .padding(.horizontal, 32)
                    .padding(.bottom, 32)
            }
        }
        .background(Color(uiColor: .systemBackground))
        .onChange(of: auth.session?.userId ?? "") { _, userId in
            // Sign-in writes a session into SignInService. As soon as
            // one lands, advance the state so the view can dismiss.
            if !userId.isEmpty, state.currentStep == .signIn {
                state.signInCompleted()
            }
        }
        .overlay(alignment: .topLeading) {
            if state.canGoBack {
                Button {
                    state.rewind()
                } label: {
                    Label("Tilbake", systemImage: "chevron.left")
                        .labelStyle(.titleAndIcon)
                        .font(.body.weight(.medium))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                }
                .padding()
            }
        }
    }

    // MARK: - Step screens

    private var welcomeStep: some View {
        VStack(spacing: 24) {
            Spacer()
            Image("CreatorHubOneLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 180, height: 180)
                .accessibilityLabel("CreatorHub One")
            Text("CreatorHub One")
                .font(.system(size: 44, weight: .bold))
            // Parent-brand attribution: CreatorHub One is one product
            // in the CreatorHub family (alongside Academy + Community).
            // The small master logo keeps the relationship visible on
            // first launch without competing with the C1 primary mark.
            HStack(spacing: 8) {
                Image("CreatorHubLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 20, height: 20)
                    .accessibilityHidden(true)
                Text("av CreatorHub")
                    .font(.callout.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Et produkt fra CreatorHub")
            Text("Én app for hele fotograf-arbeidsdagen — fra shoot til levert.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Spacer()
        }
    }

    private var valuePropsStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Text("Hva du får")
                .font(.largeTitle.bold())
                .frame(maxWidth: .infinity, alignment: .leading)
            valuePropCard(
                icon: "camera.on.rectangle",
                title: "Tether + Live Cull",
                body: "Koble til Canon CCAPI-kameraet ditt og kull i sanntid med swipe-gester. Ergonomi-tracker hjelper deg unngå decision fatigue.",
            )
            valuePropCard(
                icon: "pencil.tip",
                title: "Apple Pencil markup",
                body: "Kontrakts-signaturer og bilde-markup med Apple Pencil — alt lagret offline og synket når nettet er tilbake.",
            )
            valuePropCard(
                icon: "envelope.arrow.triangle.branch",
                title: "Levering + tilbud",
                body: "Send kvikk-teaser til klienten rett fra shooten, bygg tilbud med Pencil-signatur, administrer kontrakter — alt koblet til CreatorHub-skyen.",
            )
            Spacer()
        }
    }

    private var permissionsStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "wifi.router")
                .font(.system(size: 72))
                .foregroundStyle(.tint)
            Text("Finn kameraet ditt")
                .font(.largeTitle.bold())
            Text("CreatorHub One finner Canon-kameraet ditt over lokalnettet. Første gang du åpner Shoot-fanen spør iPad om tillatelse — si ja for å hoppe manuell konfigurasjon.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
            VStack(alignment: .leading, spacing: 12) {
                permissionRow(
                    icon: "network",
                    title: "Lokalnett",
                    body: "Oppdager kameraet på samme WiFi.",
                )
                permissionRow(
                    icon: "square.and.arrow.down",
                    title: "Bilder",
                    body: "Brukes kun hvis du eksporterer en shoot til Bilder-appen.",
                )
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(uiColor: .secondarySystemBackground)),
            )
            Spacer()
        }
    }

    private var signInStep: some View {
        VStack(spacing: 16) {
            Text("Logg inn")
                .font(.largeTitle.bold())
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Logg inn med CreatorHub-kontoen din. Samme konto som fotografdashboardet på web.")
                .font(.body)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            SignInView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    // MARK: - Helpers

    private var progressBar: some View {
        let total = Double(OnboardingState.Step.allCases.count - 1) // exclude .done
        let current = Double(state.currentStep.rawValue)
        return ProgressView(value: min(current, total) / total)
            .progressViewStyle(.linear)
            .tint(.accentColor)
            .padding(.top, 8)
            .padding(.horizontal, 16)
    }

    private var nextCTA: some View {
        Button {
            state.advance()
        } label: {
            Text(state.nextCTATitle)
                .font(.title3.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
        }
        .buttonStyle(.borderedProminent)
    }

    private func valuePropCard(icon: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 36))
                .frame(width: 56, height: 56)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.headline)
                Text(body)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(uiColor: .secondarySystemBackground)),
        )
    }

    private func permissionRow(icon: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.tint)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(body).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func finish() {
        OnboardingCompletionFlag().markComplete()
        onFinish()
    }
}
