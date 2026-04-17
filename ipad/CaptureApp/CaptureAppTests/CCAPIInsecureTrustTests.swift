import XCTest
@testable import CaptureApp

/// Verifies the scoped-trust delegate's dispatch logic without hitting the
/// network. We can't easily synthesize a real `URLAuthenticationChallenge`,
/// so we assert the delegate is constructed with the right host and that
/// its handler resolves to the expected disposition for matching/non-matching
/// protection spaces using direct method dispatch.
final class CCAPIInsecureTrustTests: XCTestCase {
    func testDelegateStoresTrustedHost() {
        let delegate = CCAPIInsecureTrustDelegate(trustedHost: "192.168.1.2")
        XCTAssertEqual(delegate.trustedHost, "192.168.1.2")
    }

    func testMakeInsecureSessionInstallsTrustDelegate() {
        let url = URL(string: "https://192.168.1.2/ccapi")!
        let session = CCAPIClient.makeInsecureSession(trustingHostOf: url)
        let delegate = session.delegate as? CCAPIInsecureTrustDelegate
        XCTAssertNotNil(delegate, "expected CCAPIInsecureTrustDelegate, got \(String(describing: session.delegate))")
        XCTAssertEqual(delegate?.trustedHost, "192.168.1.2")
    }

    func testDelegateRejectsMismatchedHost() async {
        let delegate = CCAPIInsecureTrustDelegate(trustedHost: "192.168.1.2")
        let space = URLProtectionSpace(
            host: "attacker.example.com",
            port: 443,
            protocol: "https",
            realm: nil,
            authenticationMethod: NSURLAuthenticationMethodServerTrust
        )
        let challenge = URLAuthenticationChallenge(
            protectionSpace: space,
            proposedCredential: nil,
            previousFailureCount: 0,
            failureResponse: nil,
            error: nil,
            sender: NoopChallengeSender()
        )

        let disposition = await withCheckedContinuation { (cont: CheckedContinuation<URLSession.AuthChallengeDisposition, Never>) in
            delegate.urlSession(URLSession.shared, didReceive: challenge) { d, _ in
                cont.resume(returning: d)
            }
        }
        XCTAssertEqual(disposition, .performDefaultHandling)
    }

    func testDelegateFallsThroughForNonTLSMethods() async {
        let delegate = CCAPIInsecureTrustDelegate(trustedHost: "192.168.1.2")
        let space = URLProtectionSpace(
            host: "192.168.1.2",
            port: 443,
            protocol: "https",
            realm: nil,
            authenticationMethod: NSURLAuthenticationMethodHTTPBasic
        )
        let challenge = URLAuthenticationChallenge(
            protectionSpace: space,
            proposedCredential: nil,
            previousFailureCount: 0,
            failureResponse: nil,
            error: nil,
            sender: NoopChallengeSender()
        )

        let disposition = await withCheckedContinuation { (cont: CheckedContinuation<URLSession.AuthChallengeDisposition, Never>) in
            delegate.urlSession(URLSession.shared, didReceive: challenge) { d, _ in
                cont.resume(returning: d)
            }
        }
        XCTAssertEqual(disposition, .performDefaultHandling)
    }
}

/// Required concrete sender for synthesising an URLAuthenticationChallenge —
/// none of the callbacks are invoked by our delegate, so this is a no-op shim.
private final class NoopChallengeSender: NSObject, URLAuthenticationChallengeSender {
    func use(_ credential: URLCredential, for challenge: URLAuthenticationChallenge) {}
    func continueWithoutCredential(for challenge: URLAuthenticationChallenge) {}
    func cancel(_ challenge: URLAuthenticationChallenge) {}
    func performDefaultHandling(for challenge: URLAuthenticationChallenge) {}
    func rejectProtectionSpaceAndContinue(with challenge: URLAuthenticationChallenge) {}
}
