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

    struct VerdictBody: Encodable {
        var status: String                    // verified | rejected | needs_followup
        var answers: [VerificationAnswer]
        var reasonCode: String?
        var note: String
        var callOutcome: String?              // reached | no_answer | callback
        var templateId: String?
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
}
