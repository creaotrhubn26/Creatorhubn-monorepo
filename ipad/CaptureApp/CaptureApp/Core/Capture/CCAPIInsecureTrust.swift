import Foundation
import CryptoKit
import Security

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
    private let pinStore: CCAPICertificatePinStore

    init(trustedHost: String, pinStore: CCAPICertificatePinStore = .shared) {
        self.trustedHost = trustedHost
        self.pinStore = pinStore
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
            let serverTrust = space.serverTrust,
            let certificates = SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate],
            let certificate = certificates.first
        else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        let certificateData = SecCertificateCopyData(certificate) as Data
        guard pinStore.matchesOrStoresFirstUse(certificateData, host: trustedHost) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        completionHandler(.useCredential, URLCredential(trust: serverTrust))
    }
}

/// Trust-on-first-use certificate pinning for Canon's self-signed local TLS.
/// The first certificate seen for a host is persisted; later substitutions are
/// rejected before any CCAPI response is accepted. A serial check after the
/// connection provides a second, camera-level identity signal.
final class CCAPICertificatePinStore: @unchecked Sendable {
    static let shared = CCAPICertificatePinStore()

    private let defaults: UserDefaults
    private let lock = NSLock()
    private let keyPrefix = "capture.ccapi.certificate.sha256."

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func matchesOrStoresFirstUse(_ certificateData: Data, host: String) -> Bool {
        let fingerprint = SHA256.hash(data: certificateData)
            .map { String(format: "%02x", $0) }
            .joined()
        let key = keyPrefix + host.lowercased()
        lock.lock()
        defer { lock.unlock() }
        if let existing = defaults.string(forKey: key) {
            return existing == fingerprint
        }
        defaults.set(fingerprint, forKey: key)
        return true
    }

    func forget(host: String) {
        lock.lock()
        defer { lock.unlock() }
        defaults.removeObject(forKey: keyPrefix + host.lowercased())
    }
}
