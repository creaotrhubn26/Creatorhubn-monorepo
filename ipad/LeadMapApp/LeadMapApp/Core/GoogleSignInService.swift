// GoogleSignInService.swift
//
// Google Sign-In via ASWebAuthenticationSession.
// Bytter access_token mot et Leadgrid bearer-token via
// /api/leadgrid/auth/google. Opprettes som Solo Free-org hvis ny bruker.

import Foundation
import AuthenticationServices

@MainActor
final class GoogleSignInService: NSObject, ObservableObject {
    static let shared = GoogleSignInService()

    private var currentSession: ASWebAuthenticationSession?

    // Backend genererer state-parameter + redirect-URL. Vi kontakter
    // /api/leadgrid/auth/google/start, får en OAuth-URL tilbake, åpner
    // den i ASWebAuthenticationSession, og fanger callback.
    enum SignInError: LocalizedError {
        case noURL
        case cancelled
        case missingCode
        case backend(String)

        var errorDescription: String? {
            switch self {
            case .noURL:          return "Kunne ikke åpne Google-innlogging"
            case .cancelled:      return "Avbrutt"
            case .missingCode:    return "Ingen kode mottatt"
            case .backend(let m): return m
            }
        }
    }

    /// Returnerer id_token (JWT) som backend kan verifisere mot Google.
    func signIn() async throws -> String {
        // Steg 1: hent OAuth-URL fra backend
        let startURL = URL(string: "\(APIClient.baseURL)/api/leadgrid/auth/google/start?platform=ios")!
        let (data, _) = try await URLSession.shared.data(from: startURL)
        struct StartResp: Decodable { let auth_url: String; let state: String }
        let resp = try JSONDecoder().decode(StartResp.self, from: data)
        guard let authURL = URL(string: resp.auth_url) else { throw SignInError.noURL }

        // Steg 2: åpne ASWebAuthenticationSession
        let callbackScheme = "leadgrid"
        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: callbackScheme
            ) { url, error in
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
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.currentSession = session
            session.start()
        }

        // Steg 3: hent ut code fra callback (leadgrid://oauth?code=...)
        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
            throw SignInError.missingCode
        }
        if let err = components.queryItems?.first(where: { $0.name == "error" })?.value {
            throw SignInError.backend(err)
        }

        // Steg 4: send code + state til backend som returnerer id_token
        let exchangeURL = URL(string: "\(APIClient.baseURL)/api/leadgrid/auth/google/callback")!
        var req = URLRequest(url: exchangeURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "code": code, "state": resp.state,
        ])
        let (excData, excResp) = try await URLSession.shared.data(for: req)
        guard let http = excResp as? HTTPURLResponse, http.statusCode == 200 else {
            let body = String(data: excData, encoding: .utf8) ?? "ukjent feil"
            throw SignInError.backend("\(body)")
        }
        struct ExchangeResp: Decodable { let id_token: String }
        let exchanged = try JSONDecoder().decode(ExchangeResp.self, from: excData)
        return exchanged.id_token
    }
}

extension GoogleSignInService: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        DispatchQueue.main.sync {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first?.windows.first ?? ASPresentationAnchor()
        }
    }
}
