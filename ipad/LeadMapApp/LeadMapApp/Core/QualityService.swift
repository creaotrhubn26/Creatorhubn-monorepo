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

// MARK: - Demo-data (Kvalitet)

/// In-memory demo-kø for demo-modus (salgsmøter): Kvalitet fylles ellers kun
/// av EKTE vunnede salg og ville stått tom. Verdikt muterer kun denne listen —
/// aldri backend — så «ring kunden → verdikt»-flyten kan demonstreres live og
/// KPI-tallene flytter seg underveis. Kundenavnene speiler demo-leadsene og
/// selgerne speiler demo-teamet.
@MainActor
final class KvalitetDemoStore {
    static let shared = KvalitetDemoStore()

    private(set) var items: [SalesVerification]
    let templates: [VerificationTemplate]

    private init() {
        let iso = ISO8601DateFormatter()
        func daysAgo(_ d: Int) -> String {
            iso.string(from: Calendar.current.date(byAdding: .day, value: -d, to: Date()) ?? Date())
        }
        func sale(
            _ id: String, _ customer: String, _ phone: String?, _ seller: String,
            _ amount: Double, _ wonDaysAgo: Int, _ status: String,
            reason: String? = nil, verifiedBy: String? = nil
        ) -> SalesVerification {
            SalesVerification(
                id: id, customerId: "demo-c-\(id)", customerName: customer,
                customerPhone: phone, sellerUserId: "demo-s-\(seller)",
                sellerName: seller, dealAmount: amount, dealCurrency: "kr",
                wonAt: daysAgo(wonDaysAgo), status: status, reasonCode: reason,
                note: nil, callOutcome: status == "needs_followup" ? "no_answer" : nil,
                verifiedByName: verifiedBy,
                verifiedAt: verifiedBy != nil ? daysAgo(max(0, wonDaysAgo - 1)) : nil
            )
        }
        items = [
            sale("demo-v1", "Sandvika Service AS", "+47 22 77 88 99", "Espen Berg",     280_000, 0, "pending"),
            sale("demo-v2", "Holy Crust AS",       "+47 22 41 52 63", "Marit Johansen", 240_000, 1, "pending"),
            sale("demo-v3", "Frogner Tannlege",    "+47 22 66 77 88", "Lars Erik Moen", 210_000, 1, "pending"),
            sale("demo-v4", "Vesuvio Pizzeria",    "+47 22 44 55 66", "Helena Dahl",     75_000, 2, "needs_followup"),
            sale("demo-v5", "Nordic Elektro AS",   "+47 22 12 34 56", "Espen Berg",     350_000, 4, "verified", verifiedBy: "Aaron Nilsen"),
            sale("demo-v6", "Grünerløkka Café",    nil,               "Lars Erik Moen",  45_000, 5, "rejected",
                 reason: "kunde_angret", verifiedBy: "Aaron Nilsen"),
        ]
        templates = [
            VerificationTemplate(
                id: "demo-mal-1",
                name: "Standard velkomstsamtale",
                productName: "Strømavtale Bedrift",
                introScript: "Hei, du snakker med kvalitetsavdelingen. Gratulerer med ny avtale! Jeg ringer bare for å ønske velkommen og bekrefte at alt stemmer — det tar to minutter.",
                questions: [
                    TemplateQuestion(id: "q1", question: "Stemmer det at dere har inngått avtale med oss?",
                                     checkHint: "Kunden skal bekrefte uten å nøle — nøling = mulig feilinformering."),
                    TemplateQuestion(id: "q2", question: "Fikk du oppgitt totalprisen, inkludert alle gebyrer?",
                                     checkHint: "Sammenlign med beløpet i salgsdataene."),
                    TemplateQuestion(id: "q3", question: "Er du kjent med angreretten på 14 dager?",
                                     checkHint: "Lovpålagt — mangler denne er salget mangelfullt dokumentert."),
                    TemplateQuestion(id: "q4", question: "Har du fått avtalen skriftlig på e-post?",
                                     checkHint: "Be kunden sjekke innboksen mens dere snakker."),
                ],
                outroScript: "Tusen takk for tiden din — velkommen som kunde! Du hører fra oss ved oppstart.",
                isActive: true
            ),
        ]
    }

    var counts: [String: Int] {
        Dictionary(grouping: items, by: \.status).mapValues(\.count)
    }

    /// Historikk-baserte stats (litt større tall enn køen — køen er «denne uka»).
    var sellerStats: [QualitySellerStat] {
        func stat(_ name: String, _ total: Int, _ verified: Int, _ rejected: Int,
                  _ pending: Int, _ followup: Int) -> QualitySellerStat {
            QualitySellerStat(sellerUserId: "demo-s-\(name)", sellerName: name,
                              total: total, verified: verified, rejected: rejected,
                              pending: pending, followup: followup)
        }
        return [
            stat("Espen Berg",     14, 11, 1, 2, 0),
            stat("Marit Johansen", 11,  9, 0, 1, 1),
            stat("Lars Erik Moen", 12,  8, 2, 1, 1),
            stat("Helena Dahl",     8,  6, 0, 1, 1),
        ]
    }

    var reasonStats: [QualityReasonStat] {
        [QualityReasonStat(reasonCode: "kunde_angret", count: 2),
         QualityReasonStat(reasonCode: "feil_pris", count: 1)]
    }

    /// Demo-verdikt: bytt status på raden (structen er all-let → rebuild).
    func apply(id: String, status: String, reason: String?) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        let v = items[i]
        items[i] = SalesVerification(
            id: v.id, customerId: v.customerId, customerName: v.customerName,
            customerPhone: v.customerPhone, sellerUserId: v.sellerUserId,
            sellerName: v.sellerName, dealAmount: v.dealAmount,
            dealCurrency: v.dealCurrency, wonAt: v.wonAt, status: status,
            reasonCode: reason, note: v.note, callOutcome: v.callOutcome,
            verifiedByName: "Deg (demo)",
            verifiedAt: ISO8601DateFormatter().string(from: Date())
        )
    }
}
