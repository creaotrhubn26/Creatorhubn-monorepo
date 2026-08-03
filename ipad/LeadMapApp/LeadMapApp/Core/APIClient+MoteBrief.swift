// APIClient+MoteBrief.swift — AI-møtebrief («aldri uforberedt til møte»)
//
// POST /api/leadgrid/moter/brief: backend beriker (Brreg, regnskap, aktive
// Doffin-anbud, org-ens egne vunnede case) og Claude komponerer briefen.
// Server-cachet per (org, selskap, dag) — gjentatte kall er gratis.

import Foundation

// MARK: - DTO-er

struct MoteBriefInnvendingDTO: Decodable, Hashable {
    let innvending: String
    let svar: String
}

struct MoteBriefKjerneDTO: Decodable, Hashable {
    let oppsummering: String
    let moteMaal: String
    let sporsmal: [String]
    let innsikt: String
    var innvendinger: [MoteBriefInnvendingDTO]? = nil
    var smalltalkHint: String? = nil
}

struct MoteBriefAnbudDTO: Decodable, Hashable {
    let tittel: String
    let frist: String?
}

struct MoteBriefForrigeMoteDTO: Decodable, Hashable {
    let dato: String
    let notat: String
    let lofter: [String]
}

struct MoteBriefFaktaDTO: Decodable, Hashable {
    let selskap: String
    var orgnr: String? = nil
    var ansatte: Int? = nil
    var naering: String? = nil
    var kommune: String? = nil
    var omsetning: Double? = nil
    var resultat: Double? = nil
    var regnskapAar: Int? = nil
    var aktiveAnbud: [MoteBriefAnbudDTO]? = nil
    /// Fase 3-sløyfen: forrige møtelogg — «hva vi lovte sist».
    var forrigeMote: MoteBriefForrigeMoteDTO? = nil
}

struct MoteBriefDTO: Decodable, Hashable {
    let brief: MoteBriefKjerneDTO
    let fakta: MoteBriefFaktaDTO
}

// MARK: - Etterarbeid (fase 3)

struct EtterarbeidOppgaveDTO: Decodable, Hashable {
    let tittel: String
    var frist: String? = nil
}

struct EtterarbeidEpostDTO: Decodable, Hashable {
    let emne: String
    let brodtekst: String
}

struct EtterarbeidDTO: Decodable, Hashable {
    let notat: String
    var lofter: [String]? = nil
    var oppgaver: [EtterarbeidOppgaveDTO]? = nil
    var statusForslag: String? = nil
    var epost: EtterarbeidEpostDTO? = nil
}

extension APIClient {

    /// Etterarbeid: rå notater/transkripsjon → strukturert notat + løfter +
    /// oppgaver + oppfølgings-epost-UTKAST. Backend logger møtet slik at
    /// NESTE brief åpner med «hva vi lovte sist».
    func sendMoteEtterarbeid(selskap: String, tekst: String,
                             kontakt: String? = nil, moteMaal: String? = nil,
                             orgnr: String? = nil) async throws -> EtterarbeidDTO {
        struct Body: Encodable {
            let selskap: String
            let tekst: String
            let kontakt: String?
            let moteMaal: String?
            let orgnr: String?
        }
        struct Resp: Decodable { let resultat: EtterarbeidDTO }
        let r: Resp = try await _post(
            "/api/leadgrid/moter/etterarbeid",
            body: Body(selskap: selskap, tekst: tekst, kontakt: kontakt,
                       moteMaal: moteMaal, orgnr: orgnr))
        return r.resultat
    }

    /// Hent AI-møtebrief for et selskap/møte. Orgnr er valgfritt — backend
    /// finner det via Brreg-navnesøk når det mangler.
    func hentMoteBrief(selskap: String, orgnr: String? = nil,
                       kontakt: String? = nil, kontaktRolle: String? = nil,
                       motetid: String? = nil, notater: String? = nil,
                       leadStatus: String? = nil) async throws -> MoteBriefDTO {
        struct Body: Encodable {
            let selskap: String
            let orgnr: String?
            let kontakt: String?
            let kontaktRolle: String?
            let motetid: String?
            let notater: String?
            let leadStatus: String?
        }
        return try await _post(
            "/api/leadgrid/moter/brief",
            body: Body(selskap: selskap, orgnr: orgnr, kontakt: kontakt,
                       kontaktRolle: kontaktRolle, motetid: motetid,
                       notater: notater, leadStatus: leadStatus))
    }
}
