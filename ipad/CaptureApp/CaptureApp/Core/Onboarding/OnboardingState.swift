import Foundation

/// Pure state machine for the CreatorHub One first-launch flow.
///
/// Four linear steps. Each step advances via an explicit user
/// action; the back button only rewinds through the steps that
/// make sense to re-visit (you can re-read the welcome, but you
/// can't un-sign-in via the back button — sign-out is a separate
/// deliberate action in settings).
///
/// Exposed as a pure struct so the full flow can be unit-tested
/// without mounting any SwiftUI surface. The view layer just
/// renders ``currentStep`` and calls the transition methods.
struct OnboardingState: Equatable {

    enum Step: Int, CaseIterable, Equatable, Sendable {
        /// "Welkommen til CreatorHub One" — brand + 3-line pitch.
        case welcome = 0
        /// 3 value-prop cards: Tether + Culling, Pencil markup, Deliver.
        case valueProps = 1
        /// Camera permission / LocalNetwork permission explainer
        /// and trigger. We can't grant the permission without a real
        /// network call, so this step just primes expectations.
        case permissions = 2
        /// Sign-in with Google / bearer. Shown last so the user has
        /// already decided the app is worth signing into.
        case signIn = 3
        /// Terminal — onboarding is complete, tear down the view.
        case done = 4
    }

    private(set) var currentStep: Step = .welcome

    /// Whether the "Back" button should be available. We hide it on
    /// the very first step (nowhere to go) and after sign-in (
    /// signing out is a settings-level action, not a back button).
    var canGoBack: Bool {
        switch currentStep {
        case .welcome, .done: return false
        case .signIn: return false
        default: return true
        }
    }

    /// Whether the view should render a "Neste"/"Kom i gang" CTA.
    /// Sign-in is a special step whose CTA is handled by the
    /// embedded ``SignInView`` itself — the onboarding CTA is off.
    var showsNextCTA: Bool {
        switch currentStep {
        case .welcome, .valueProps, .permissions: return true
        case .signIn, .done: return false
        }
    }

    /// Localised title for the next-step CTA. Pure so the view can
    /// render it without duplicating the rendering logic in every
    /// screen-specific case.
    var nextCTATitle: String {
        switch currentStep {
        case .welcome: return "Kom i gang"
        case .valueProps: return "Sett opp kameraet"
        case .permissions: return "Logg inn"
        case .signIn, .done: return ""
        }
    }

    /// Advance to the next linear step. No-op at the terminal state
    /// so the view layer doesn't need to guard the call site.
    mutating func advance() {
        switch currentStep {
        case .welcome: currentStep = .valueProps
        case .valueProps: currentStep = .permissions
        case .permissions: currentStep = .signIn
        case .signIn: currentStep = .done
        case .done: break
        }
    }

    /// Rewind one step. Respects ``canGoBack``: calling this from a
    /// non-backable step is a no-op rather than a crash so the view
    /// layer can disable the button via ``canGoBack`` without
    /// duplicating the rules.
    mutating func rewind() {
        guard canGoBack else { return }
        switch currentStep {
        case .valueProps: currentStep = .welcome
        case .permissions: currentStep = .valueProps
        default: break
        }
    }

    /// Called by the sign-in surface once a session is stored.
    /// Automatically moves to ``.done`` so the view layer can
    /// trigger dismissal.
    mutating func signInCompleted() {
        currentStep = .done
    }
}

/// Persistence for the "has this user completed onboarding" flag.
/// Wrapped in a struct so tests can inject a fake UserDefaults.
struct OnboardingCompletionFlag {
    private let defaults: UserDefaults
    private let key: String

    init(defaults: UserDefaults = .standard, key: String = "creatorhub.one.onboarded") {
        self.defaults = defaults
        self.key = key
    }

    var isComplete: Bool {
        defaults.bool(forKey: key)
    }

    func markComplete() {
        defaults.set(true, forKey: key)
    }

    /// Development/tests only. Ships disabled in release via the
    /// call-site guard (see CaptureAppMain).
    func reset() {
        defaults.removeObject(forKey: key)
    }
}
