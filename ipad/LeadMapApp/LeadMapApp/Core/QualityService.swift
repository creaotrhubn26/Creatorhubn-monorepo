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

    private func scopedPath(_ endpoint: String, projectId: String) -> String? {
        let clean = projectId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty,
              let encoded = clean.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        else { return nil }
        return "\(endpoint)?projectId=\(encoded)"
    }

    /// Maler for det valgte kundeprosjektet (server seeder standardmal ved første kall).
    func templates(projectId: String, using api: APIClient?) async -> [VerificationTemplate] {
        guard let api,
              let path = scopedPath("/api/leadgrid/quality/templates", projectId: projectId)
        else { return [] }
        let r: TemplatesResponse? = try? await api._get(path)
        return r?.templates ?? []
    }

    struct TemplateDraft: Encodable {
        var name: String
        var productName: String = ""
        var introScript: String = ""
        var questions: [TemplateQuestion] = []
        var outroScript: String = ""
        var projectId: String = ""
    }

    func createTemplate(_ draft: TemplateDraft, projectId: String, using api: APIClient?) async -> Bool {
        guard let api, !projectId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        var scoped = draft
        scoped.projectId = projectId
        do { let _: Ack = try await api._post("/api/leadgrid/quality/templates", body: scoped); return true }
        catch { return false }
    }

    struct TemplatePatch: Encodable {
        var name: String?
        var productName: String?
        var introScript: String?
        var questions: [TemplateQuestion]?
        var outroScript: String?
        var isActive: Bool?
        var projectId: String?
    }

    func updateTemplate(id: String, _ patch: TemplatePatch, projectId: String, using api: APIClient?) async -> Bool {
        guard let api, !projectId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        var scoped = patch
        scoped.projectId = projectId
        do { try await api._patch("/api/leadgrid/quality/templates/\(id)", body: scoped); return true }
        catch { return false }
    }

    /// Køen (server backfiller pending for vunnede salg). Nil ved 403/feil.
    func queue(projectId: String, using api: APIClient?) async -> (items: [SalesVerification], counts: [String: Int])? {
        guard let api,
              let path = scopedPath("/api/leadgrid/quality/queue", projectId: projectId)
        else { return nil }
        guard let r: QueueResponse = try? await api._get(path) else { return nil }
        return (r.verifications, r.counts)
    }

    private struct StatsResponse: Decodable {
        let sellers: [QualitySellerStat]
        let reasons: [QualityReasonStat]
    }

    /// Kvalitetsgrad per selger + årsaksfordeling. Nil ved 403/feil.
    func stats(projectId: String, using api: APIClient?) async -> (sellers: [QualitySellerStat], reasons: [QualityReasonStat])? {
        guard let api,
              let path = scopedPath("/api/leadgrid/quality/stats", projectId: projectId)
        else { return nil }
        guard let r: StatsResponse = try? await api._get(path) else { return nil }
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
        var projectId: String?
    }

    /// Fell verdikt. Returnerer nil ved suksess, ellers feilkode.
    func submitVerdict(id: String, _ body: VerdictBody, projectId: String, using api: APIClient?) async -> String? {
        guard let api, !projectId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return "project_required" }
        var scoped = body
        scoped.projectId = projectId
        do {
            let r: Ack = try await api._post("/api/leadgrid/quality/verifications/\(id)/verdict", body: scoped)
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
        if DemoModeManager.isDentumTour {
            // The approved Dentum lead has not been won yet. An empty queue is
            // truthful; a fabricated completed sale would hide a scope leak.
            items = []
            templates = [VerificationTemplate(
                id: "dentum-mal-1",
                name: "Dentum klinikkprofil",
                productName: "Dentum-pilot",
                introScript: "Hei, jeg ringer fra Dentum for å bekrefte at klinikkprofilen og pilotoppsettet stemmer.",
                questions: [
                    TemplateQuestion(id: "dentum-q1", question: "Er klinikknavn, adresse og kontaktperson riktig?", checkHint: "Bekreft mot klinikkens egne opplysninger."),
                    TemplateQuestion(id: "dentum-q2", question: "Har klinikken godkjent veiledende priser og hvilke behandlinger som vises?", checkHint: "Profilen publiseres ikke før klinikken har godkjent innholdet."),
                    TemplateQuestion(id: "dentum-q3", question: "Hvem skal motta pasientforespørsler fra Dentum?", checkHint: "Registrer avtalt e-post eller telefon på klinikken."),
                ],
                outroScript: "Takk — vi oppdaterer Dentum-profilen og sender en bekreftelse før publisering.",
                isActive: true,
            )]
        } else {
            items = [
                sale("demo-v1", "Sandvika Service AS", "+47 22 77 88 99", "Espen Berg",     280_000, 0, "pending"),
                sale("demo-v2", "Holy Crust AS",       "+47 22 41 52 63", "Marit Johansen", 240_000, 1, "pending"),
                sale("demo-v3", "Frogner Tannlege",    "+47 22 66 77 88", "Lars Erik Moen", 210_000, 1, "pending"),
                sale("demo-v4", "Vesuvio Pizzeria",    "+47 22 44 55 66", "Helena Dahl",     75_000, 2, "needs_followup"),
                sale("demo-v5", "Nordic Elektro AS",   "+47 22 12 34 56", "Espen Berg",     350_000, 4, "verified", verifiedBy: "Aaron Nilsen"),
                sale("demo-v6", "Grünerløkka Café",    nil,               "Lars Erik Moen",  45_000, 5, "rejected",
                     reason: "kunde_angret", verifiedBy: "Aaron Nilsen"),
            ]
            templates = [VerificationTemplate(
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
            )]
        }
    }

    var counts: [String: Int] {
        Dictionary(grouping: items, by: \.status).mapValues(\.count)
    }

    /// Historikk-baserte stats (litt større tall enn køen — køen er «denne uka»).
    var sellerStats: [QualitySellerStat] {
        if DemoModeManager.isDentumTour { return [] }
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
        if DemoModeManager.isDentumTour { return [] }
        return [QualityReasonStat(reasonCode: "kunde_angret", count: 2),
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
