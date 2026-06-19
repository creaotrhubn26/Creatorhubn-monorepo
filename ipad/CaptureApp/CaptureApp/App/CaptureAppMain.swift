import SwiftUI

/// App entry. Kept deliberately tiny — the actual launch-surface
/// routing lives in ``RootView`` so the ``App`` struct doesn't host
/// view logic + doesn't need ``@ViewBuilder`` gymnastics on a
/// computed property.
///
/// ``SignInService.shared`` is injected into the scene's environment
/// so every nested view can read the current session via
/// ``@Environment`` without threading the service through manually.
@main
struct CaptureAppMain: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(SignInService.shared)
                .task {
                    // `--record-session` turns on the CCAPI HTTP log
                    // (see ``CCAPISessionRecorder``). Used by the
                    // community-validation loaner program — photographer
                    // runs a diagnostic shoot, sends us the JSONL log,
                    // we replay it against new adapters without ever
                    // holding their camera. Off by default.
                    if ProcessInfo.processInfo.arguments.contains("--record-session") {
                        _ = try? await CCAPISessionRecorder.shared.start(label: "launch")
                    }

                    // Annonser denne iPad-en via Bonjour så Creatorhub
                    // One Desk (Mac-companion) kan finne den under
                    // shoot. Idempotent — multiple start()-kall no-op.
                    // Spec: docs/capture/desk-pairing.md.
                    PairingAdvertiser.shared.start()
                }
        }
    }
}

/// Picks one of three root surfaces at launch + whenever the
/// onboarding flag flips:
///
///   * **Legacy capture** — ``LiveCaptureView`` behind the
///     ``--legacy-capture-only`` launch argument. Kept for UI tests
///     that target the tether surface deterministically without the
///     tab bar in the way.
///   * **Onboarding** — ``OnboardingView`` on first launch, or when
///     ``--reset-onboarding`` forces it (screenshot tests). Dismissal
///     flips ``hasOnboarded`` which re-routes to the main shell.
///   * **Main shell** — ``CreatorHubOneRootView`` for the
///     steady-state photographer workflow.
struct RootView: View {
    @State private var hasOnboarded: Bool = OnboardingCompletionFlag().isComplete

    /// Snapshot the launch arguments once. Reading ``ProcessInfo``
    /// on every render is cheap, but pinning the value here makes
    /// the route stable across a single launch — a UI test toggling
    /// an argument mid-run wouldn't silently switch surfaces under
    /// the user.
    private let launchArguments = ProcessInfo.processInfo.arguments

    var body: some View {
        Group {
            switch resolvedSurface {
            case .legacyCapture:
                LiveCaptureView()
            case .onboardingForced:
                // Dev/test-only: wipe the persisted flag so the flow
                // runs even on a previously-completed install. ``.task``
                // runs once when the view mounts, so screenshot
                // recorders can count on the reset happening before
                // the first snapshot.
                OnboardingView(onFinish: finishOnboarding)
                    .task { OnboardingCompletionFlag().reset() }
            case .onboarding:
                OnboardingView(onFinish: finishOnboarding)
            case .mainShell:
                CreatorHubOneRootView()
            }
        }
        // Globalt overlegg som dukker opp uansett hvilken surface som
        // er aktiv. Drives av PairingRequestStore.shared som
        // PairingConnection setter ved innkommende Desk-pair-request.
        .sheet(item: pairingBinding) { request in
            PairWithDeskPromptView(
                request: request,
                onAccept: { PairingRequestStore.shared.accept() },
                onReject: { PairingRequestStore.shared.reject() },
            )
        }
    }

    /// SwiftUI .sheet(item:) krever Identifiable — wrappes så
    /// activeRequest blir bundet via dens id (deskId).
    private var pairingBinding: Binding<IdentifiablePairRequest?> {
        Binding(
            get: {
                PairingRequestStore.shared.activeRequest.map(IdentifiablePairRequest.init)
            },
            set: { new in
                if new == nil {
                    // Sheet dismissed uten knapp — behandle som avvist
                    // for protokoll-konsistens.
                    PairingRequestStore.shared.reject(reason: "dismissed")
                }
            },
        )
    }

    // MARK: - Routing

    private enum Surface {
        case legacyCapture
        case onboardingForced
        case onboarding
        case mainShell
    }

    private var resolvedSurface: Surface {
        if launchArguments.contains("--legacy-capture-only") {
            return .legacyCapture
        }
        if launchArguments.contains("--reset-onboarding") {
            return .onboardingForced
        }
        return hasOnboarded ? .mainShell : .onboarding
    }

    private func finishOnboarding() {
        hasOnboarded = true
    }
}

/// PairRequest er ikke Identifiable selv (struct fra protokoll-laget).
/// Wrapper'en gir den en id slik at SwiftUI .sheet(item:) kan binde
/// den, og pairingBinding kan oversette mellom store og sheet-API.
private struct IdentifiablePairRequest: Identifiable {
    let request: PairingProtocol.PairRequest
    var id: String { request.deskId }
    init(_ request: PairingProtocol.PairRequest) {
        self.request = request
    }
}

extension PairWithDeskPromptView {
    fileprivate init(
        request: IdentifiablePairRequest,
        onAccept: @escaping () -> Void,
        onReject: @escaping () -> Void,
    ) {
        self.init(request: request.request, onAccept: onAccept, onReject: onReject)
    }
}
