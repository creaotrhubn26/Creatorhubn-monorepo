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
    let createdAt: String?
}

private struct PondusQuizSubmitBody: Encodable {
    let autoritet: Int
    let klarhet: Int
    let troverdighet: Int
    let trygghet: Int
    let fremdrift: Int
    let total: Int
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

extension APIClient {
    private static let _pondusQuizDecoder = JSONDecoder()
    private static let _pondusQuizEncoder = JSONEncoder()

    /// Selger: lagre en quiz-gjennomføring (alle scorer 0-100).
    @discardableResult
    func submitPondusQuiz(
        autoritet: Int, klarhet: Int, troverdighet: Int,
        trygghet: Int, fremdrift: Int, total: Int,
        answers: [String: Int]
    ) async throws -> PondusQuizResult {
        let body = PondusQuizSubmitBody(
            autoritet: autoritet, klarhet: klarhet, troverdighet: troverdighet,
            trygghet: trygghet, fremdrift: fremdrift, total: total, answers: answers
        )
        let payload = try Self._pondusQuizEncoder.encode(body)
        let data = try await _request("/api/leadgrid/pondus/quiz", method: "POST", body: payload)
        return try Self._pondusQuizDecoder.decode(PondusQuizSubmitResponse.self, from: data).result
    }

    /// Selger: siste profil + antall gjennomføringer.
    func fetchPondusQuizMine() async throws -> (latest: PondusQuizResult?, attempts: Int) {
        let data = try await _request("/api/leadgrid/pondus/quiz/mine", method: "GET")
        let resp = try Self._pondusQuizDecoder.decode(PondusQuizMineResponse.self, from: data)
        return (resp.latest, resp.attempts)
    }
}
