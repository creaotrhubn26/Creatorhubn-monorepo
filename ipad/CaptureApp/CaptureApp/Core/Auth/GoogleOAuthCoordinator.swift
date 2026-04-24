import AuthenticationServices
import CryptoKit
import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Native Google sign-in for iPad via ``ASWebAuthenticationSession`` +
/// PKCE. Produces a Google-issued ``id_token`` that
/// ``SignInService.signInWithGoogleIDToken`` already knows how to
/// exchange for a CreatorHub bearer — so we reuse the existing
/// ``POST /api/auth/google/token`` endpoint without any server-side
/// changes.
///
/// Setup checklist (one-time, per environment):
///
///   1. In Google Cloud Console → APIs & Services → Credentials, create
///      an OAuth 2.0 Client ID of type **iOS**. Set bundle ID to
///      ``com.creatorhubn.capture`` (matches `project.yml`).
///   2. Copy the issued client ID (format: ``<num>-<hash>.apps.googleusercontent.com``)
///      into Info.plist under key ``GoogleOAuthClientID``.
///   3. Add the reversed client ID (``com.googleusercontent.apps.<num>-<hash>``)
///      as a URL scheme under ``CFBundleURLTypes → CFBundleURLSchemes``
///      so the OAuth redirect can route back to the app.
///
/// If ``GoogleOAuthClientID`` is missing, empty, or still a placeholder,
/// ``isConfigured`` returns false and the caller should surface the
/// paste-token fallback (``SignInView`` already does this today).
@MainActor
final class GoogleOAuthCoordinator: NSObject, ASWebAuthenticationPresentationContextProviding {
    struct Config: Sendable {
        let clientID: String
        /// Reversed client ID, e.g. ``com.googleusercontent.apps.123-abc``.
        /// Also the URL scheme that must appear in Info.plist.
        let urlScheme: String

        /// Full redirect URI Google sends the user back to after consent.
        var redirectURI: String { "\(urlScheme):/oauthredirect" }
    }

    enum OAuthError: LocalizedError {
        case notConfigured
        case invalidRedirect
        case userCancelled
        case tokenExchangeFailed(status: Int, body: String)
        case missingIdToken
        case transport(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured:
                return "Google sign-in isn't configured on this build — set GoogleOAuthClientID in Info.plist, or paste an ID token manually below."
            case .invalidRedirect:
                return "Google returned a redirect the app couldn't parse."
            case .userCancelled:
                return "Google sign-in was cancelled."
            case .tokenExchangeFailed(let status, let body):
                return "Google token exchange failed (HTTP \(status)): \(body.prefix(200))"
            case .missingIdToken:
                return "Google did not return an ID token."
            case .transport(let message):
                return "Network error: \(message)"
            }
        }
    }

    /// Read the iOS OAuth client ID from Info.plist and derive the URL
    /// scheme. Returns nil when the key is missing, empty, or still the
    /// setup placeholder — caller should hide the native button and
    /// surface the paste fallback in that case.
    static func readConfigFromInfoPlist(bundle: Bundle = .main) -> Config? {
        guard
            let raw = bundle.object(forInfoDictionaryKey: "GoogleOAuthClientID") as? String
        else { return nil }
        let clientID = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clientID.isEmpty, !clientID.hasPrefix("REPLACE_") else { return nil }

        // iOS OAuth client IDs always look like
        // ``<number>-<hash>.apps.googleusercontent.com``. The URL scheme
        // registered with the OS is that same string with its segments
        // reversed — Google auto-generates it when you register the iOS
        // client.
        let segments = clientID.split(separator: ".")
        guard segments.count >= 3 else { return nil }
        let urlScheme = segments.reversed().joined(separator: ".")
        return Config(clientID: clientID, urlScheme: urlScheme)
    }

    /// Whether the current build has the Info.plist entries it needs.
    var isConfigured: Bool { Self.readConfigFromInfoPlist() != nil }

    /// Full Google sign-in round-trip. Returns a Google ``id_token`` on
    /// success; the caller pipes it into
    /// ``SignInService.signInWithGoogleIDToken`` to upgrade it to a
    /// CreatorHub bearer.
    func obtainIDToken() async throws -> String {
        guard let config = Self.readConfigFromInfoPlist() else {
            throw OAuthError.notConfigured
        }
        let verifier = Self.makePKCEVerifier()
        let challenge = Self.makePKCEChallenge(verifier: verifier)
        let code = try await authorize(config: config, codeChallenge: challenge)
        return try await exchangeCodeForIDToken(
            code: code,
            config: config,
            codeVerifier: verifier,
        )
    }

    // MARK: - Step 1: authorize via ASWebAuthenticationSession

    private func authorize(config: Config, codeChallenge: String) async throws -> String {
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            .init(name: "client_id", value: config.clientID),
            .init(name: "redirect_uri", value: config.redirectURI),
            .init(name: "response_type", value: "code"),
            .init(name: "scope", value: "openid email profile"),
            .init(name: "code_challenge", value: codeChallenge),
            .init(name: "code_challenge_method", value: "S256"),
            // ``select_account`` lets a photographer who runs multiple
            // Google identities (personal vs. business) pick at sign-in
            // instead of silently reusing the last session.
            .init(name: "prompt", value: "select_account"),
        ]
        guard let authURL = components.url else {
            throw OAuthError.invalidRedirect
        }

        // Wrap the delegate-based API in a continuation so it reads as a
        // linear async/await call from the view.
        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: config.urlScheme,
            ) { redirectURL, error in
                if let nsError = error as NSError?,
                   nsError.domain == ASWebAuthenticationSessionError.errorDomain,
                   nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                    continuation.resume(throwing: OAuthError.userCancelled)
                    return
                }
                if let error = error {
                    continuation.resume(throwing: OAuthError.transport(error.localizedDescription))
                    return
                }
                guard
                    let redirectURL = redirectURL,
                    let comps = URLComponents(url: redirectURL, resolvingAgainstBaseURL: false),
                    let code = comps.queryItems?.first(where: { $0.name == "code" })?.value
                else {
                    continuation.resume(throwing: OAuthError.invalidRedirect)
                    return
                }
                continuation.resume(returning: code)
            }
            session.presentationContextProvider = self
            // Non-ephemeral so the user's existing Google session cookie
            // is picked up — saves them from re-typing credentials if
            // they're already signed into a Google account in Safari.
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }

    // MARK: - Step 2: exchange authorization code for id_token

    private func exchangeCodeForIDToken(
        code: String,
        config: Config,
        codeVerifier: String,
    ) async throws -> String {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let body = [
            "client_id": config.clientID,
            "code": code,
            "code_verifier": codeVerifier,
            "grant_type": "authorization_code",
            "redirect_uri": config.redirectURI,
        ]
        request.httpBody = body
            .map { "\($0.key)=\(Self.urlEncode($0.value))" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw OAuthError.transport("not HTTPURLResponse")
        }
        guard (200..<300).contains(http.statusCode) else {
            let snippet = String(data: data, encoding: .utf8) ?? ""
            throw OAuthError.tokenExchangeFailed(status: http.statusCode, body: snippet)
        }
        struct TokenResponse: Decodable {
            let id_token: String?
        }
        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        guard let idToken = decoded.id_token, !idToken.isEmpty else {
            throw OAuthError.missingIdToken
        }
        return idToken
    }

    // MARK: - PKCE helpers

    private static func makePKCEVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return base64URLEncode(Data(bytes))
    }

    private static func makePKCEChallenge(verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return base64URLEncode(Data(digest))
    }

    private static func base64URLEncode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func urlEncode(_ value: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        // Google's token endpoint is strict about reserved characters in
        // form-encoded bodies; remove "+" so it encodes as %2B, not a
        // space substitute.
        allowed.remove(charactersIn: "+&=")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    // MARK: - ASWebAuthenticationPresentationContextProviding

    nonisolated func presentationAnchor(
        for session: ASWebAuthenticationSession,
    ) -> ASPresentationAnchor {
        // ASWebAuth calls this synchronously on the main thread already
        // (per Apple's docs), so assumeIsolated is safe. The dummy
        // UIWindow() fallback only runs if no scene is attached — which
        // in practice doesn't happen during an active OAuth start.
        MainActor.assumeIsolated {
            for scene in UIApplication.shared.connectedScenes {
                if let windowScene = scene as? UIWindowScene,
                   let keyWindow = windowScene.windows.first(where: \.isKeyWindow) {
                    return keyWindow
                }
            }
            return UIWindow()
        }
    }
}
