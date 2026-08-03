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
}

struct MoteBriefDTO: Decodable, Hashable {
    let brief: MoteBriefKjerneDTO
    let fakta: MoteBriefFaktaDTO
}

extension APIClient {

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
