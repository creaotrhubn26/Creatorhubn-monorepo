import AuthenticationServices
import UIKit

/// Åpner bankens godkjennings-URL (BankID) i en sikker web-sesjon og fanger
/// redirect-en tilbake. Brukes til PIS-betaling og (senere) ID-porten.
@MainActor
final class WebAuth: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuth()
    private var session: ASWebAuthenticationSession?

    /// Presenterer `url`; fullfører når banken redirecter til en URL med `callbackScheme`
    /// eller (for https-callback) når sesjonen lukkes.
    func present(url: URL, callbackScheme: String?) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            let s = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { _, _ in
                cont.resume()
            }
            s.presentationContextProvider = self
            s.prefersEphemeralWebBrowserSession = false
            self.session = s
            if !s.start() { cont.resume() }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first ?? ASPresentationAnchor()
    }
}
