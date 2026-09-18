// LinkedInSignInService.swift
//
// Logg inn med LinkedIn via ASWebAuthenticationSession. Speiler
// GoogleSignInService, men backend gjør hele OAuth-utvekslingen:
//
//   1. GET  /api/leadgrid/auth/linkedin/start?platform=ios → { auth_url, state }
//   2. ASWebAuthenticationSession åpner auth_url; LinkedIn → backend-callback
//      → redirect leadgrid://oauth?linkedin_transfer=<id> (eller ?error=…)
//   3. PairExchangeService.exchangeLinkedInTransfer(id) → bearer + user
//
// Brukeren opprettes (Solo Free-org) hvis e-posten er ny, og navn/bilde
// fylles inn i profilen der de mangler.

import Foundation
import AuthenticationServices

@MainActor
final class LinkedInSignInService: NSObject, ObservableObject {
    static let shared = LinkedInSignInService()

    private var currentSession: ASWebAuthenticationSession?

    enum SignInError: LocalizedError {
        case noURL
        case cancelled
        case missingTransfer
        case backend(String)

        var errorDescription: String? {
            switch self {
            case .noURL:            return "Kunne ikke åpne LinkedIn-innlogging"
            case .cancelled:        return "Avbrutt"
            case .missingTransfer:  return "Ingen innlogging mottatt fra LinkedIn"
            case .backend(let m):   return m
            }
        }
    }

    /// Returnerer transfer-id som PairExchangeService bytter mot bearer.
    func signIn() async throws -> String {
        // Steg 1: hent OAuth-URL fra backend
        let startURL = URL(string: "\(APIClient.baseURL)/api/leadgrid/auth/linkedin/start?platform=ios")!
        let (data, startResponse) = try await URLSession.shared.data(from: startURL)
        if let http = startResponse as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let body = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
            throw SignInError.backend((body["message"] as? String) ?? "LinkedIn-innlogging er ikke tilgjengelig")
        }
        struct StartResp: Decodable { let auth_url: String; let state: String }
        let resp = try JSONDecoder().decode(StartResp.self, from: data)
        guard let authURL = URL(string: resp.auth_url) else { throw SignInError.noURL }

        // Steg 2: åpne ASWebAuthenticationSession. Samme trådsikkerhets- og
        // Catalyst-hensyn som GoogleSignInService (se kommentarene der).
        let callbackScheme = "leadgrid"
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
                callbackURLScheme: callbackScheme,
                completionHandler: handler
            )
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            self.currentSession = session
            session.start()
        }

        // Steg 3: les transfer-id (eller feil) fra leadgrid://oauth?…
        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
            throw SignInError.missingTransfer
        }
        if let err = components.queryItems?.first(where: { $0.name == "error" })?.value, !err.isEmpty {
            throw SignInError.backend(err)
        }
        guard let transfer = components.queryItems?.first(where: { $0.name == "linkedin_transfer" })?.value,
              !transfer.isEmpty else {
            throw SignInError.missingTransfer
        }
        return transfer
    }
}

extension LinkedInSignInService: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first?.windows.first ?? ASPresentationAnchor()
        }
    }
}
