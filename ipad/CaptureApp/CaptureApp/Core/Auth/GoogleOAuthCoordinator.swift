import Foundation
import GoogleSignIn
import UIKit

/// Native Google sign-in for iPad via Google's supported iOS SDK. Produces
/// a Google-issued ``id_token`` that
/// ``SignInService.signInWithGoogleIDToken`` already knows how to
/// exchange for a CreatorHub bearer through the existing
/// ``POST /api/auth/google/token`` endpoint.
///
/// Setup checklist (one-time, per environment):
///
///   1. In Google Cloud Console → APIs & Services → Credentials, create
///      an OAuth 2.0 Client ID of type **iOS**. Set bundle ID to
///      ``com.creatorhubn.capture`` (matches `project.yml`).
///   2. Copy the issued client ID (format: ``<num>-<hash>.apps.googleusercontent.com``)
///      into Info.plist under key ``GIDClientID``.
///   3. Add the reversed client ID (``com.googleusercontent.apps.<num>-<hash>``)
///      as a URL scheme under ``CFBundleURLTypes → CFBundleURLSchemes``
///      so the OAuth redirect can route back to the app.
///
/// If ``GIDClientID`` is missing, empty, or still a placeholder,
/// ``isConfigured`` returns false and the caller should surface the
/// paste-token fallback (``SignInView`` already does this today).
@MainActor
final class GoogleOAuthCoordinator {
    struct Config: Sendable {
        let clientID: String
    }

    enum OAuthError: LocalizedError {
        case notConfigured
        case missingPresentationContext
        case userCancelled
        case missingIdToken
        case sdk(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured:
                return "Google-innlogging er ikke konfigurert i denne builden."
            case .missingPresentationContext:
                return "Kunne ikke åpne Google-innlogging fra dette vinduet."
            case .userCancelled:
                return "Google-innloggingen ble avbrutt."
            case .missingIdToken:
                return "Google returnerte ikke et gyldig innloggingsbevis."
            case .sdk(let message):
                return "Google-innlogging feilet: \(message)"
            }
        }
    }

    static func validatedClientID(_ raw: Any?) -> String? {
        guard let raw = raw as? String else { return nil }
        let clientID = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            !clientID.isEmpty,
            !clientID.hasPrefix("REPLACE_"),
            clientID.hasSuffix(".apps.googleusercontent.com")
        else { return nil }
        return clientID
    }

    /// Read the official SDK client key from Info.plist. Returns nil when
    /// it is missing, malformed, or still a setup placeholder.
    static func readConfigFromInfoPlist(bundle: Bundle = .main) -> Config? {
        guard
            let clientID = validatedClientID(
                bundle.object(forInfoDictionaryKey: "GIDClientID")
            )
        else { return nil }
        return Config(clientID: clientID)
    }

    /// Whether the current build has the Info.plist entries it needs.
    var isConfigured: Bool { Self.readConfigFromInfoPlist() != nil }

    /// Full Google sign-in round-trip through the official SDK. Returns a
    /// fresh Google ``id_token``; the caller pipes it into
    /// ``SignInService.signInWithGoogleIDToken`` to upgrade it to a
    /// CreatorHub bearer.
    func obtainIDToken() async throws -> String {
        guard let config = Self.readConfigFromInfoPlist() else {
            throw OAuthError.notConfigured
        }
        guard let presentingViewController = Self.presentingViewController() else {
            throw OAuthError.missingPresentationContext
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: config.clientID)
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(
                withPresenting: presentingViewController
            )
            return try await freshIDToken(for: result.user)
        } catch {
            let nsError = error as NSError
            if nsError.domain == kGIDSignInErrorDomain,
               nsError.code == GIDSignInError.canceled.rawValue {
                throw OAuthError.userCancelled
            }
            throw OAuthError.sdk(error.localizedDescription)
        }
    }

    private func freshIDToken(for user: GIDGoogleUser) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            user.refreshTokensIfNeeded { refreshedUser, error in
                if let error {
                    continuation.resume(throwing: OAuthError.sdk(error.localizedDescription))
                    return
                }
                guard let token = refreshedUser?.idToken?.tokenString, !token.isEmpty else {
                    continuation.resume(throwing: OAuthError.missingIdToken)
                    return
                }
                continuation.resume(returning: token)
            }
        }
    }

    private static func presentingViewController() -> UIViewController? {
        let keyWindow = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
        var controller = keyWindow?.rootViewController
        while let presented = controller?.presentedViewController {
            controller = presented
        }
        return controller
    }
}
