// QualityService.swift
//
// Kvalitet-avdelingen (Sales QA): verifiseringskø for vunnede salg +
// samtale-maler. Kontrolløren ringer kunden med mal, sjekker at alt stemmer
// med produktet, og feller verdikt (verifisert/underkjent/følg opp).
// Backend: /api/leadgrid/quality/* (leadgrid-quality-routes.ts, mig 0377).

import Foundation

@MainActor
final class QualityService {
    static let shared = QualityService()

    private struct TemplatesResponse: Decodable { let templates: [VerificationTemplate] }
    private struct QueueResponse: Decodable {
        let verifications: [SalesVerification]
        let counts: [String: Int]
    }
    private struct Ack: Decodable { let ok: Bool?; let error: String? }

    /// Maler for org-en (server seeder «Standard velkomstsamtale» ved første kall).
    func templates(using api: APIClient?) async -> [VerificationTemplate] {
        guard let api else { return [] }
        let r: TemplatesResponse? = try? await api._get("/api/leadgrid/quality/templates")
        return r?.templates ?? []
    }

    struct TemplateDraft: Encodable {
        var name: String
        var productName: String = ""
        var introScript: String = ""
        var questions: [TemplateQuestion] = []
        var outroScript: String = ""
    }

    func createTemplate(_ draft: TemplateDraft, using api: APIClient?) async -> Bool {
        guard let api else { return false }
        do { let _: Ack = try await api._post("/api/leadgrid/quality/templates", body: draft); return true }
        catch { return false }
    }

    struct TemplatePatch: Encodable {
        var name: String?
        var productName: String?
        var introScript: String?
        var questions: [TemplateQuestion]?
        var outroScript: String?
        var isActive: Bool?
    }

    func updateTemplate(id: String, _ patch: TemplatePatch, using api: APIClient?) async -> Bool {
        guard let api else { return false }
        do { try await api._patch("/api/leadgrid/quality/templates/\(id)", body: patch); return true }
        catch { return false }
    }

    /// Køen (server backfiller pending for vunnede salg). Nil ved 403/feil.
    func queue(using api: APIClient?) async -> (items: [SalesVerification], counts: [String: Int])? {
        guard let api else { return nil }
        guard let r: QueueResponse = try? await api._get("/api/leadgrid/quality/queue") else { return nil }
        return (r.verifications, r.counts)
    }

    private struct StatsResponse: Decodable {
        let sellers: [QualitySellerStat]
        let reasons: [QualityReasonStat]
    }

    /// Kvalitetsgrad per selger + årsaksfordeling. Nil ved 403/feil.
    func stats(using api: APIClient?) async -> (sellers: [QualitySellerStat], reasons: [QualityReasonStat])? {
        guard let api else { return nil }
        guard let r: StatsResponse = try? await api._get("/api/leadgrid/quality/stats") else { return nil }
        return (r.sellers, r.reasons)
    }

    struct VerdictBody: Encodable {
        var status: String                    // verified | rejected | needs_followup
        var answers: [VerificationAnswer]
        var reasonCode: String?
        var note: String
        var callOutcome: String?              // reached | no_answer | callback
        var templateId: String?
        /// «Flagg som eksempel» (2026-07-17): samtalen var verdt å lære av →
        /// backend oppretter draft i Leadbook-eksempel-køen (mig 0379).
        var flagAsExample: Bool?
    }

    /// Fell verdikt. Returnerer nil ved suksess, ellers feilkode.
    func submitVerdict(id: String, _ body: VerdictBody, using api: APIClient?) async -> String? {
        guard let api else { return "no_api" }
        do {
            let r: Ack = try await api._post("/api/leadgrid/quality/verifications/\(id)/verdict", body: body)
            return r.ok == true ? nil : (r.error ?? "failed")
        } catch { return "failed" }
    }
}

// MARK: - Modeller

struct TemplateQuestion: Codable, Identifiable, Hashable {
    var id: String
    var question: String
    var checkHint: String?
}

struct VerificationTemplate: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let productName: String?
    let introScript: String?
    let questions: [TemplateQuestion]
    let outroScript: String?
    let isActive: Bool?
}

struct VerificationAnswer: Codable, Hashable {
    var questionId: String
    var question: String
    var result: String        // ok | avvik | ikke_svart
    var note: String
}

struct SalesVerification: Decodable, Identifiable, Hashable {
    let id: String
    let customerId: String
    let customerName: String
    let customerPhone: String?
    let sellerUserId: String?
    let sellerName: String?
    let dealAmount: Double?
    let dealCurrency: String?
    let wonAt: String?
    let status: String         // pending | verified | rejected | needs_followup
    let reasonCode: String?
    let note: String?
    let callOutcome: String?
    let verifiedByName: String?
    let verifiedAt: String?
}

struct QualitySellerStat: Decodable, Identifiable, Hashable {
    let sellerUserId: String?
    let sellerName: String?
    let total: Int
    let verified: Int
    let rejected: Int
    let pending: Int
    let followup: Int
    var id: String { sellerUserId ?? sellerName ?? "ukjent" }
    /// Andel verifisert av FERDIGBEHANDLEDE (pending teller ikke mot noen).
    var qualityRate: Double? {
        let decided = verified + rejected
        guard decided > 0 else { return nil }
        return Double(verified) / Double(decided)
    }
}

struct QualityReasonStat: Decodable, Identifiable, Hashable {
    let reasonCode: String
    let count: Int
    var id: String { reasonCode }
}

enum QualityReason: String, CaseIterable {
    case feilPris = "feil_pris"
    case kundeAngret = "kunde_angret"
    case mangelfullDokumentasjon = "mangelfull_dokumentasjon"
    case feilinformertKunde = "feilinformert_kunde"
    case ikkeKontakt = "ikke_kontakt"
    case annet = "annet"

    var label: String {
        switch self {
        case .feilPris: return "Feil pris"
        case .kundeAngret: return "Kunden angret"
        case .mangelfullDokumentasjon: return "Mangelfull dokumentasjon"
        case .feilinformertKunde: return "Feilinformert kunde"
        case .ikkeKontakt: return "Fikk ikke kontakt"
        case .annet: return "Annet"
        }
    }

    /// Pondus-kobling: hvilken av de fem dimensjonene årsaken sier noe om.
    /// Brukes som coaching-hint i stats — underkjenninger er ekte data for
    /// dimensjonene Pondus-akademiet trener.
    var pondusDimension: String? {
        switch self {
        case .feilinformertKunde, .mangelfullDokumentasjon: return "Troverdighet"
        case .feilPris: return "Klarhet"
        case .kundeAngret: return "Trygghet"
        case .ikkeKontakt, .annet: return nil
        }
    }
}
