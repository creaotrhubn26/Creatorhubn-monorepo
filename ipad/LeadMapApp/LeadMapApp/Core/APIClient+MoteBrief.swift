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
    /// Mål & behov-kjeden: selgerens eget mål + behovsbanken.
    var selgersMaal: String? = nil
    var kjenteBehov: [String]? = nil
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
    /// Mål & behov-kjeden: ærlig vurdering mot selgerens mål + behov som
    /// kom fram i møtet (flettes inn i behovsbanken server-side).
    var maalVurdering: String? = nil
    var nyeBehov: [String]? = nil
}

/// Mål & behov per selskap (leadgrid_mote_maal — datakilden for briefen).
struct MoteMaalDTO: Decodable, Hashable {
    let maal: String
    let behov: [String]
}

/// Hvilke Oversikt-kort er skjult per målgruppe (leadgrid_oversikt_policy).
struct OversiktPolicyDTO: Decodable, Hashable {
    var selger: [String] = []
    var leder: [String] = []
}

/// Persistert oppgave fra møtelogging (leadgrid_oppgaver) — ekte, avhukbar.
struct MoteOppgaveDTO: Decodable, Hashable, Identifiable {
    let id: String
    let selskap: String
    var leadId: String? = nil
    let tittel: String
    var frist: String? = nil
    let status: String
    var createdAt: String? = nil
}

extension APIClient {

    /// Etterarbeid: rå notater/transkripsjon → strukturert notat + løfter +
    /// oppgaver + oppfølgings-epost-UTKAST. Backend logger møtet slik at
    /// NESTE brief åpner med «hva vi lovte sist».
    func sendMoteEtterarbeid(selskap: String, tekst: String,
                             kontakt: String? = nil, moteMaal: String? = nil,
                             orgnr: String? = nil, leadId: String? = nil,
                             meetingAt: Date? = nil, requestId: UUID) async throws -> EtterarbeidDTO {
        struct Body: Encodable {
            let selskap: String
            let tekst: String
            let kontakt: String?
            let moteMaal: String?
            let orgnr: String?
            let leadId: String?
            let meetingAt: String?
            let requestId: String
        }
        struct Resp: Decodable { let resultat: EtterarbeidDTO }
        let r: Resp = try await _post(
            "/api/leadgrid/moter/etterarbeid",
            body: Body(selskap: selskap, tekst: tekst, kontakt: kontakt,
                       moteMaal: moteMaal, orgnr: orgnr, leadId: leadId,
                       meetingAt: meetingAt.map { ISO8601DateFormatter().string(from: $0) },
                       requestId: requestId.uuidString.lowercased()))
        return r.resultat
    }

    /// Åpne oppgaver fra møtelogging (ugated) — Oversikt/Neste handlinger.
    func hentMoteOppgaver() async throws -> [MoteOppgaveDTO] {
        struct Resp: Decodable { let oppgaver: [MoteOppgaveDTO] }
        let r: Resp = try await _get("/api/leadgrid/oppgaver")
        return r.oppgaver
    }

    /// Oversikt-policy: hvilke kort er skjult for selgere/ledere (org-styrt).
    func hentOversiktPolicy() async throws -> OversiktPolicyDTO {
        try await _get("/api/leadgrid/oversikt-policy")
    }

    /// Sett skjulte kort for en målgruppe ("selger" krever leder-rolle,
    /// "leder" krever admin).
    func lagreOversiktPolicy(malgruppe: String, skjulteKort: [String]) async throws {
        struct Body: Encodable {
            let malgruppe: String
            let skjulteKort: [String]
        }
        struct Resp: Decodable { let ok: Bool }
        let _: Resp = try await _put(
            "/api/leadgrid/oversikt-policy",
            body: Body(malgruppe: malgruppe, skjulteKort: skjulteKort))
    }

    /// Huk av / gjenåpne en oppgave.
    func settMoteOppgaveStatus(id: String, ferdig: Bool) async throws {
        struct Body: Encodable { let status: String }
        let data = try JSONEncoder().encode(Body(status: ferdig ? "done" : "open"))
        _ = try await _request("/api/leadgrid/oppgaver/\(id)",
                               method: "PATCH", body: data)
    }

    /// Mål & behov (ugated): hent/lagre per selskap.
    func hentMoteMaal(selskap: String) async throws -> MoteMaalDTO {
        var comps = URLComponents(string: "/api/leadgrid/moter/maal")!
        comps.queryItems = [URLQueryItem(name: "selskap", value: selskap)]
        return try await _get(comps.string ?? "/api/leadgrid/moter/maal")
    }

    func lagreMoteMaal(selskap: String, maal: String, behov: [String]) async throws {
        struct Body: Encodable {
            let selskap: String
            let maal: String
            let behov: [String]
        }
        struct Resp: Decodable { let ok: Bool }
        let _: Resp = try await _put(
            "/api/leadgrid/moter/maal",
            body: Body(selskap: selskap, maal: maal, behov: behov))
    }

    /// Oppdater kalenderens delte møtetid og/eller varighet.
    func oppdaterMote(leadId: String, tidspunkt: Date? = nil,
                      varighetMin: Int? = nil, meetingStatus: String? = nil,
                      note: String? = nil) async throws {
        struct Body: Encodable {
            let datetime: String?
            let durationMinutes: Int?
            let meetingStatus: String?
            let note: String?
        }
        guard tidspunkt != nil || varighetMin != nil || meetingStatus != nil else { return }
        let data = try JSONEncoder().encode(Body(
            datetime: tidspunkt.map { ISO8601DateFormatter().string(from: $0) },
            durationMinutes: varighetMin, meetingStatus: meetingStatus, note: note))
        _ = try await _request(
            "/api/admin-room/lead-map/calendar/\(leadId)",
            method: "PATCH", body: data)
    }

    func flyttMoteTid(leadId: String, til dato: Date) async throws {
        try await oppdaterMote(leadId: leadId, tidspunkt: dato)
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
