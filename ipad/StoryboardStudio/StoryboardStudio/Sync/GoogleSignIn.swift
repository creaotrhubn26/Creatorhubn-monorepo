import Foundation
import AuthenticationServices
import UIKit

// Google Sign-In via ASWebAuthenticationSession — samme backend-flyt som
// LeadMapApp (leadgrid-google-auth-routes), men med platform=ios-storyboard
// → callback storyboardstudio://oauth, og id_token byttes mot en ekte
// Role Room-SESJON via /api/auth/google/session-exchange (krever at
// artisten allerede har Role Room-konto).

@MainActor
final class StoryboardGoogleSignIn: NSObject {
    static let shared = StoryboardGoogleSignIn()
    private var currentSession: ASWebAuthenticationSession?

    enum SignInError: LocalizedError {
        case noURL, cancelled, missingCode
        case backend(String)

        var errorDescription: String? {
            switch self {
            case .noURL: return "Kunne ikke åpne Google-innlogging"
            case .cancelled: return "Avbrutt"
            case .missingCode: return "Ingen kode mottatt"
            case .backend(let message): return message
            }
        }
    }

    struct SessionResult: Sendable {
        let token: String
        let userName: String
    }

    /// Full flyt: start → ASWebAuthenticationSession → code → id_token →
    /// Role Room-sesjonstoken.
    func signIn(server: String) async throws -> SessionResult {
        guard let base = URL(string: server) else { throw SignInError.noURL }

        // 1) Hent OAuth-URL
        let startURL = base.appendingPathComponent("/api/leadgrid/auth/google/start")
            .appending(queryItems: [URLQueryItem(name: "platform", value: "ios-storyboard")])
        let (startData, _) = try await URLSession.shared.data(from: startURL)
        struct StartResponse: Decodable { let auth_url: String; let state: String }
        let start = try JSONDecoder().decode(StartResponse.self, from: startData)
        guard let authURL = URL(string: start.auth_url) else { throw SignInError.noURL }

        // 2) Web-auth-session (callback: storyboardstudio://oauth?code=…)
        let callbackURL: URL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let handler: @Sendable (URL?, Error?) -> Void = { url, error in
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
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
                url: authURL,
                callbackURLScheme: "storyboardstudio",
                completionHandler: handler
            )
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            self.currentSession = session
            session.start()
        }

        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
            if let backendError = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "error" })?.value {
                throw SignInError.backend(backendError)
            }
            throw SignInError.missingCode
        }

        // 3) code → id_token
        let idToken = try await postJSON(
            url: base.appendingPathComponent("/api/leadgrid/auth/google/callback"),
            body: ["code": code, "state": start.state],
            extract: { ($0["id_token"] as? String) }
        )

        // 4) id_token → Role Room-sesjon
        var name = ""
        let token = try await postJSON(
            url: base.appendingPathComponent("/api/auth/google/session-exchange"),
            body: ["id_token": idToken],
            extract: { payload in
                if let user = payload["user"] as? [String: Any] {
                    name = (user["name"] as? String) ?? ""
                }
                return payload["token"] as? String
            }
        )
        return SessionResult(token: token, userName: name)
    }

    private func postJSON(
        url: URL,
        body: [String: String],
        extract: ([String: Any]) -> String?
    ) async throws -> String {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard status == 200, let value = extract(payload) else {
            let message = (payload["message"] as? String)
                ?? (payload["error"] as? String)
                ?? "HTTP \(status)"
            throw SignInError.backend(message)
        }
        return value
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
