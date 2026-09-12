// APIClient+PondusQuiz.swift
//
// Pondus-quiz (Akademiets kapittel «Test deg selv» → ekte baseline-profil).
// Backend: leadgrid-pondus-quiz-routes.ts (mig 0410). Klienten regner
// dimensjons-scorene fra spørsmålsbanken (PondusQuiz.swift); backend
// persisterer og serverer profiler.
//
// 🔑 Backend-DTO er allerede camelCase → egne plain codere UTEN key-strategi
// via `_request` direkte (samme mønster som APIClient+LeadgridMileage; de
// delte _get/_post ville rørt snake_case-konvertering).

import Foundation

struct PondusQuizResult: Decodable, Identifiable, Hashable {
    let id: Int
    let userId: String
    let userName: String?
    let autoritet: Int
    let klarhet: Int
    let troverdighet: Int
    let trygghet: Int
    let fremdrift: Int
    let total: Int
    let scoringVersion: String?
    let createdAt: String?
}

private struct PondusQuizSubmitBody: Encodable {
    let answers: [String: Int]
}

private struct PondusQuizSubmitResponse: Decodable {
    let result: PondusQuizResult
}

private struct PondusQuizMineResponse: Decodable {
    let latest: PondusQuizResult?
    let history: [PondusQuizResult]
    let attempts: Int
}

private struct PondusQuizOrgResponse: Decodable {
    let profiles: [PondusQuizResult]
}

extension APIClient {
    private static let _pondusQuizDecoder = JSONDecoder()
    private static let _pondusQuizEncoder = JSONEncoder()

    /// Selger: lagre en quiz-gjennomføring (alle scorer 0-100).
    @discardableResult
    func submitPondusQuiz(
        answers: [String: Int],
        organizationId: String? = nil
    ) async throws -> PondusQuizResult {
        let body = PondusQuizSubmitBody(answers: answers)
        let payload = try Self._pondusQuizEncoder.encode(body)
        let data = try await _request(
            pondusQuizPath("/api/leadgrid/pondus/quiz", organizationId: organizationId),
            method: "POST",
            body: payload
        )
        return try Self._pondusQuizDecoder.decode(PondusQuizSubmitResponse.self, from: data).result
    }

    /// Selger: siste profil + antall gjennomføringer.
    func fetchPondusQuizMine(
        organizationId: String? = nil
    ) async throws -> (latest: PondusQuizResult?, history: [PondusQuizResult], attempts: Int) {
        let data = try await _request(
            pondusQuizPath("/api/leadgrid/pondus/quiz/mine", organizationId: organizationId),
            method: "GET"
        )
        let resp = try Self._pondusQuizDecoder.decode(PondusQuizMineResponse.self, from: data)
        return (resp.latest, resp.history, resp.attempts)
    }

    /// Leder: siste profil per selger i org-en (manager-gate — 403 ellers).
    /// Brukes av coaching-forberedelsen («Ny 1-til-1»).
    func fetchPondusQuizOrg(organizationId: String? = nil) async throws -> [PondusQuizResult] {
        let data = try await _request(
            pondusQuizPath("/api/leadgrid/pondus/quiz/org", organizationId: organizationId),
            method: "GET"
        )
        return try Self._pondusQuizDecoder.decode(PondusQuizOrgResponse.self, from: data).profiles
    }
}
    private func pondusQuizPath(_ path: String, organizationId: String?) -> String {
        guard let organizationId, !organizationId.isEmpty,
              let encoded = organizationId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        else { return path }
        return path + (path.contains("?") ? "&" : "?") + "organization_id=\(encoded)"
    }
