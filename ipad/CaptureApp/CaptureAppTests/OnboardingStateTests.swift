import XCTest
@testable import CaptureApp

/// State-machine tests for the first-launch onboarding. The view
/// layer is a thin switch-on-``currentStep``, so pinning the
/// transitions here is enough to guarantee the flow doesn't skip
/// screens or expose un-navigable dead ends.
///
/// Covered:
///   - Linear advance through welcome → valueProps → permissions →
///     signIn → done.
///   - ``canGoBack`` rules: hidden on welcome + signIn + done,
///     visible on middle steps.
///   - ``rewind`` is a no-op on non-backable steps (view layer can
///     disable the button without duplicating the rules).
///   - ``signInCompleted`` jumps straight to done, skipping manual
///     advance (callers get one less thing to remember).
///   - CTA title + visibility flags match the step.
final class OnboardingStateTests: XCTestCase {

    // MARK: - Advance

    func testStartsAtWelcome() {
        let state = OnboardingState()
        XCTAssertEqual(state.currentStep, .welcome)
    }

    func testAdvancesLinearlyThroughAllSteps() {
        var state = OnboardingState()
        state.advance()
        XCTAssertEqual(state.currentStep, .valueProps)
        state.advance()
        XCTAssertEqual(state.currentStep, .permissions)
        state.advance()
        XCTAssertEqual(state.currentStep, .signIn)
        state.advance()
        XCTAssertEqual(state.currentStep, .done)
    }

    func testAdvanceFromDoneIsNoOp() {
        var state = OnboardingState()
        for _ in 0..<4 { state.advance() }
        XCTAssertEqual(state.currentStep, .done)
        state.advance()
        XCTAssertEqual(state.currentStep, .done,
            "advance from terminal state must not wrap around")
    }

    // MARK: - Rewind

    func testRewindFromWelcomeIsNoOp() {
        var state = OnboardingState()
        state.rewind()
        XCTAssertEqual(state.currentStep, .welcome)
    }

    func testRewindFromValuePropsReturnsToWelcome() {
        var state = OnboardingState()
        state.advance()
        state.rewind()
        XCTAssertEqual(state.currentStep, .welcome)
    }

    func testRewindFromPermissionsReturnsToValueProps() {
        var state = OnboardingState()
        state.advance(); state.advance()
        state.rewind()
        XCTAssertEqual(state.currentStep, .valueProps)
    }

    func testRewindFromSignInIsBlocked() {
        var state = OnboardingState()
        state.advance(); state.advance(); state.advance()
        XCTAssertEqual(state.currentStep, .signIn)
        state.rewind()
        XCTAssertEqual(state.currentStep, .signIn,
            "signing in isn't a step you un-do with back — that's sign-out")
    }

    // MARK: - canGoBack contract

    func testCanGoBackIsFalseForWelcome() {
        let state = OnboardingState()
        XCTAssertFalse(state.canGoBack)
    }

    func testCanGoBackIsTrueForMiddleSteps() {
        var state = OnboardingState()
        state.advance() // valueProps
        XCTAssertTrue(state.canGoBack)
        state.advance() // permissions
        XCTAssertTrue(state.canGoBack)
    }

    func testCanGoBackIsFalseForSignInAndDone() {
        var state = OnboardingState()
        state.advance(); state.advance(); state.advance()
        XCTAssertFalse(state.canGoBack, "signIn hides back")
        state.signInCompleted()
        XCTAssertFalse(state.canGoBack, "done hides back")
    }

    // MARK: - Sign-in shortcut

    func testSignInCompletedJumpsDirectlyToDone() {
        var state = OnboardingState()
        state.signInCompleted()
        XCTAssertEqual(state.currentStep, .done,
            "signing in at any step must terminate onboarding")
    }

    // MARK: - CTA visibility + label

    func testShowsNextCTAOnlyForPreSignInSteps() {
        var state = OnboardingState()
        XCTAssertTrue(state.showsNextCTA, "welcome has a next CTA")
        state.advance()
        XCTAssertTrue(state.showsNextCTA, "valueProps has a next CTA")
        state.advance()
        XCTAssertTrue(state.showsNextCTA, "permissions has a next CTA")
        state.advance()
        XCTAssertFalse(state.showsNextCTA,
            "signIn's CTA is owned by the embedded SignInView")
        state.signInCompleted()
        XCTAssertFalse(state.showsNextCTA, "done has no CTA")
    }

    func testNextCTATitleMatchesStep() {
        var state = OnboardingState()
        XCTAssertEqual(state.nextCTATitle, "Kom i gang")
        state.advance()
        XCTAssertEqual(state.nextCTATitle, "Sett opp kameraet")
        state.advance()
        XCTAssertEqual(state.nextCTATitle, "Logg inn")
        state.advance()
        XCTAssertEqual(state.nextCTATitle, "",
            "signIn has no onboarding-owned CTA — SignInView provides one")
    }

    // MARK: - Completion flag persistence

    func testCompletionFlagDefaultsFalse() {
        let defaults = UserDefaults(suiteName: "onboarding-test-\(UUID())")!
        defaults.removePersistentDomain(forName: defaults.dictionaryRepresentation().description)
        let flag = OnboardingCompletionFlag(defaults: defaults, key: "t")
        XCTAssertFalse(flag.isComplete)
    }

    func testCompletionFlagPersistsMarkAndReset() {
        let defaults = UserDefaults(suiteName: "onboarding-test-\(UUID())")!
        let flag = OnboardingCompletionFlag(defaults: defaults, key: "t")
        flag.markComplete()
        XCTAssertTrue(flag.isComplete)
        flag.reset()
        XCTAssertFalse(flag.isComplete)
    }
}
