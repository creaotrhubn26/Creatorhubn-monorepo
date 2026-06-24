// PairExchangeService.swift
//
// Bytter pair-token (kort kode eller full token) mot et permanent
// bearer-token via POST /api/ipad-tokens/exchange.
//
// Beriker request med deviceInfo (model, OS, app-versjon, device-navn)
// så backend kan logge hvilken iPad som ble paret — vises i web-admin
// for revocation.

import Foundation
import UIKit

struct PairedUser: Codable, Hashable {
    let id: String
    let email: String?
}

struct PairExchangeResponse: Codable {
    let bearer: String
    let user: PairedUser
}

struct PairExchangeError: Error, LocalizedError {
    let code: String
    var errorDescription: String? {
        switch code {
        case "ukjent_kode":
            return "Koden er ikke gyldig. Sjekk at du skrev den riktig."
        case "kode_allerede_brukt":
            return "Koden er allerede brukt. Generer en ny i web."
        case "kode_utlopt":
            return "Koden utløp. Generer en ny i web."
        case "network_error":
            return "Nettverksfeil. Sjekk forbindelsen og prøv igjen."
        default:
            return "Uventet feil (\(code))."
        }
    }
}

actor PairExchangeService {
    static let shared = PairExchangeService()
    private let baseURL = URL(string: "https://creatorhub-backend-rtbl.onrender.com")!

    func exchange(shortCode: String) async throws -> PairExchangeResponse {
        let cleaned = shortCode
            .uppercased()
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "-", with: "")
        // Server forventer XXXX-XXXX-format
        let formatted: String
        if cleaned.count == 8 {
            formatted = "\(cleaned.prefix(4))-\(cleaned.suffix(4))"
        } else {
            formatted = cleaned
        }
        let info = await MainActor.run { Self.deviceInfo() }
        return try await postExchange(body: [
            "shortCode": formatted,
            "deviceInfo": info,
        ])
    }

    /// Bytter et Google id_token mot et Leadgrid bearer-token.
    /// Backend (/api/leadgrid/auth/google/exchange) verifiserer JWT mot
    /// Google, oppretter Solo Free-org hvis ny bruker, og returnerer
    /// samme PairExchangeResponse-format som koden-flyt.
    func exchangeGoogleToken(idToken: String) async throws -> PairExchangeResponse {
        var req = URLRequest(url: baseURL.appendingPathComponent("/api/leadgrid/auth/google/exchange"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let info = await MainActor.run { Self.deviceInfo() }
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "id_token": idToken,
            "deviceInfo": info,
            "platform": "ios_native_app",
        ])
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw PairExchangeError(code: "network_error")
        }
        if (200..<300).contains(http.statusCode) {
            return try JSONDecoder().decode(PairExchangeResponse.self, from: data)
        }
        throw PairExchangeError(code: "google_auth_failed")
    }

    func exchange(qrPayload: String) async throws -> PairExchangeResponse {
        // QR-payload-format: ROLE-ROOM-PAIR:<token>
        let prefix = "ROLE-ROOM-PAIR:"
        guard qrPayload.hasPrefix(prefix) else {
            throw PairExchangeError(code: "ukjent_kode")
        }
        let token = String(qrPayload.dropFirst(prefix.count))
        let info = await MainActor.run { Self.deviceInfo() }
        return try await postExchange(body: [
            "token": token,
            "deviceInfo": info,
        ])
    }

    // MARK: - Internal

    private func postExchange(body: [String: Any]) async throws -> PairExchangeResponse {
        var req = URLRequest(url: baseURL.appendingPathComponent("/api/ipad-tokens/exchange"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw PairExchangeError(code: "network_error")
        }
        if (200..<300).contains(http.statusCode) {
            return try JSONDecoder().decode(PairExchangeResponse.self, from: data)
        }
        // Backend returnerer { "error": "kode_utlopt" } osv
        if let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let code = body["error"] as? String {
            throw PairExchangeError(code: code)
        }
        throw PairExchangeError(code: "http_\(http.statusCode)")
    }

    @MainActor
    private static func deviceInfo() -> [String: String] {
        let device = UIDevice.current
        let bundle = Bundle.main
        let appVersion = (bundle.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "?"
        let build = (bundle.infoDictionary?["CFBundleVersion"] as? String) ?? "?"
        return [
            "model": device.model,
            "name": device.name,
            "osVersion": "\(device.systemName) \(device.systemVersion)",
            "appVersion": "\(appVersion) (\(build))",
        ]
    }
}
