import Foundation
import AuthenticationServices
import UIKit

// Google Sign-In via The Role Rooms egen OAuth-flyt:
// Role Room start → Google → Role Room callback → storyboardstudio://oauth
// → engangs-transfer → Role Room-sesjon. Ingen Leadgrid-endepunkter brukes.

@MainActor
final class StoryboardGoogleSignIn: NSObject {
    static let shared = StoryboardGoogleSignIn()
    private var currentSession: ASWebAuthenticationSession?

    enum SignInError: LocalizedError {
        case noURL, cancelled, missingTransfer
        case backend(String)

        var errorDescription: String? {
            switch self {
            case .noURL: return "Kunne ikke åpne Google-innlogging"
            case .cancelled: return "Avbrutt"
            case .missingTransfer: return "Role Room returnerte ingen gyldig innlogging"
            case .backend(let message): return message
            }
        }
    }

    struct SessionResult: Sendable {
        let token: String
        let userName: String
    }

    /// Full flyt: Role Room start → Google → native callback → Role Room-sesjon.
    func signIn(server: String) async throws -> SessionResult {
        guard let base = URL(string: server),
              let browserOrigin = Self.browserOrigin(for: base) else {
            throw SignInError.noURL
        }

        let startPayload = try await requestJSONObject(
            url: base.appendingPathComponent("api/role-room/google/oauth/start"),
            method: "POST",
            body: [
                "mode": "login",
                "browserOrigin": browserOrigin,
                "returnPath": "/theroleroom",
                "nativeClient": "storyboard-room",
            ]
        )
        guard let authorizationURLString = startPayload["authorizationUrl"] as? String,
              let authorizationURL = URL(string: authorizationURLString) else {
            throw SignInError.backend(Self.errorMessage(from: startPayload)
                ?? "Role Room returnerte ingen Google-adresse")
        }

        let callbackURL: URL = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<URL, Error>) in
            let handler: @Sendable (URL?, Error?) -> Void = { url, error in
                if let error = error as? ASWebAuthenticationSessionError,
                   error.code == .canceledLogin {
                    continuation.resume(throwing: SignInError.cancelled)
                } else if let error {
                    continuation.resume(throwing: error)
                } else if let url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: SignInError.noURL)
                }
            }
            let session = ASWebAuthenticationSession(
                url: authorizationURL,
                callbackURLScheme: "storyboardstudio",
                completionHandler: handler
            )
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            self.currentSession = session
            session.start()
        }
        currentSession = nil

        let transferID = try Self.transferID(from: callbackURL)
        let sessionPayload = try await requestJSONObject(
            url: base
                .appendingPathComponent("api/role-room/google/oauth/session-result")
                .appendingPathComponent(transferID),
            method: "GET"
        )
        guard let token = sessionPayload["sessionToken"] as? String,
              !token.isEmpty else {
            throw SignInError.backend(Self.errorMessage(from: sessionPayload)
                ?? "Role Room returnerte ingen sesjon")
        }

        let user = sessionPayload["user"] as? [String: Any]
        let name = (user?["name"] as? String)
            ?? (user?["display_name"] as? String)
            ?? (user?["email"] as? String)
            ?? ""
        return SessionResult(token: token, userName: name)
    }

    static func transferID(from callbackURL: URL) throws -> String {
        guard let components = URLComponents(
            url: callbackURL,
            resolvingAgainstBaseURL: false
        ) else {
            throw SignInError.missingTransfer
        }
        let queryItems = components.queryItems ?? []
        func value(_ name: String) -> String? {
            queryItems.first(where: { $0.name == name })?.value
        }

        let status = value("rrGoogleStatus")
        if status == "needs_2fa" {
            throw SignInError.backend(
                "Denne Role Room-kontoen krever 2FA. Fullfør innloggingen på theroleroom.com først."
            )
        }
        guard status == "success" else {
            throw SignInError.backend(
                value("rrGoogleMessage") ?? "Google-innloggingen i Role Room feilet"
            )
        }
        guard let transferID = value("rrGoogleTransfer"), !transferID.isEmpty else {
            throw SignInError.missingTransfer
        }
        return transferID
    }

    private static func browserOrigin(for baseURL: URL) -> String? {
        guard var components = URLComponents(
            url: baseURL,
            resolvingAgainstBaseURL: false
        ), components.scheme != nil, components.host != nil else {
            return nil
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        return components.url?.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    private static func errorMessage(from payload: [String: Any]) -> String? {
        (payload["message"] as? String) ?? (payload["error"] as? String)
    }

    private func requestJSONObject(
        url: URL,
        method: String,
        body: [String: Any]? = nil
    ) async throws -> [String: Any] {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200..<300).contains(status) else {
            throw SignInError.backend(
                Self.errorMessage(from: payload) ?? "Role Room svarte HTTP \(status)"
            )
        }
        return payload
    }
}

extension StoryboardGoogleSignIn: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first?.windows.first ?? ASPresentationAnchor()
        }
    }
}
