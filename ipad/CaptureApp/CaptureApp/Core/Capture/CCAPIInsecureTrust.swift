import Foundation

/// URLSession delegate that accepts the self-signed TLS certificate served
/// by a Canon CCAPI camera, scoped to a single host. All other TLS challenges
/// fall through to default handling (so typos or other hosts can't silently
/// bypass cert validation).
///
/// This is an **MVP-only** mechanism. The long-term plan is to fetch the
/// camera's CA cert via `GET /ccapi/ver100/functions/ssl/cacert` on first
/// connect, persist it in the keychain, and pin it — which rejects any
/// attacker that stands up a rogue camera on the same AP. Until that lands,
/// use this delegate for local integration testing and beta builds only.
final class CCAPIInsecureTrustDelegate: NSObject, URLSessionDelegate, @unchecked Sendable {
    /// The exact hostname whose server trust we override (no port, no scheme).
    /// Anything else gets `.performDefaultHandling`, which will reject a
    /// self-signed cert on an unrelated host.
    let trustedHost: String

    init(trustedHost: String) {
        self.trustedHost = trustedHost
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        let space = challenge.protectionSpace
        guard
            space.authenticationMethod == NSURLAuthenticationMethodServerTrust,
            space.host == trustedHost,
            let serverTrust = space.serverTrust
        else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        completionHandler(.useCredential, URLCredential(trust: serverTrust))
    }
}
