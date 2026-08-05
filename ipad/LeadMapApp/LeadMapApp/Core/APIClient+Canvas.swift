// APIClient+Canvas.swift — Leadgrid Canvas (Pencil-notater) mot backend.
// leadgrid_canvas_notater: org+bruker-scopet, PKDrawing som base64.

import Foundation

struct CanvasNotatDTO: Decodable, Hashable {
    let id: String
    let tittel: String
    let kategori: String
    var selskap: String? = nil
    var leadId: String? = nil
    var drawingBase64: String? = nil
    var oppdatert: String? = nil
    /// Fase 2 (deling): delt med teamet + eierskap.
    var delt: Bool? = nil
    var erMin: Bool? = nil
    var eierNavn: String? = nil
    /// Fase 4: stedfesting + stempel-overlay (JSON-array).
    var lat: Double? = nil
    var lon: Double? = nil
    var stempler: String? = nil
    var tekstbokser: String? = nil
    var figurer: String? = nil
    var papir: String? = nil
    var noder: String? = nil
    var sider: Int? = nil
    var objekter: String? = nil
    var sokbarTekst: String? = nil
}

struct CanvasAnalyseOppgaveDTO: Decodable, Hashable {
    let tittel: String
    var frist: String? = nil
}

struct CanvasAnalyseDTO: Decodable, Hashable {
    let oppsummering: String
    var oppgaver: [CanvasAnalyseOppgaveDTO]? = nil
    var lofter: [String]? = nil
}

struct CanvasVersjonDTO: Decodable, Hashable {
    let id: String
    let kategori: String
    var drawingBase64: String? = nil
    var opprettet: String? = nil
}

extension APIClient {

    func hentCanvasNotater() async throws -> [CanvasNotatDTO] {
        struct Resp: Decodable { let notater: [CanvasNotatDTO] }
        let r: Resp = try await _get("/api/leadgrid/canvas")
        return r.notater
    }

    /// Opprett → returnerer backend-id-en (erstatter den lokale).
    func opprettCanvasNotat(tittel: String, kategori: String,
                            selskap: String?, leadId: String?,
                            drawingBase64: String,
                            delt: Bool = false,
                            lat: Double? = nil, lon: Double? = nil,
                            stempler: String = "[]",
                            tekstbokser: String = "[]",
                            figurer: String = "[]",
                            papir: String = "blank",
                            noder: String = "[]",
                            sider: Int = 1,
                            objekter: String = "[]",
                            sokbarTekst: String = "") async throws -> String {
        struct Body: Encodable {
            let tittel: String
            let kategori: String
            let selskap: String?
            let leadId: String?
            let drawingBase64: String
            let delt: Bool
            let lat: Double?
            let lon: Double?
            let stempler: String
            let tekstbokser: String
            let figurer: String
            let papir: String
            let noder: String
            let sider: Int
            let objekter: String
            let sokbarTekst: String
        }
        struct Resp: Decodable { let id: String }
        let r: Resp = try await _post(
            "/api/leadgrid/canvas",
            body: Body(tittel: tittel, kategori: kategori, selskap: selskap,
                       leadId: leadId, drawingBase64: drawingBase64, delt: delt,
                       lat: lat, lon: lon, stempler: stempler,
                       tekstbokser: tekstbokser, figurer: figurer, papir: papir,
                       noder: noder, sider: sider, objekter: objekter,
                       sokbarTekst: sokbarTekst))
        return r.id
    }

    func oppdaterCanvasNotat(id: String, tittel: String, kategori: String,
                             selskap: String?, leadId: String?,
                             drawingBase64: String,
                             delt: Bool = false,
                             lat: Double? = nil, lon: Double? = nil,
                             stempler: String = "[]",
                             tekstbokser: String = "[]",
                             figurer: String = "[]",
                             papir: String = "blank",
                             noder: String = "[]",
                             sider: Int = 1,
                             objekter: String = "[]",
                             sokbarTekst: String = "") async throws {
        struct Body: Encodable {
            let tittel: String
            let kategori: String
            let selskap: String?
            let leadId: String?
            let drawingBase64: String
            let delt: Bool
            let lat: Double?
            let lon: Double?
            let stempler: String
            let tekstbokser: String
            let figurer: String
            let papir: String
            let noder: String
            let sider: Int
            let objekter: String
            let sokbarTekst: String
        }
        let data = try JSONEncoder().encode(
            Body(tittel: tittel, kategori: kategori, selskap: selskap,
                 leadId: leadId, drawingBase64: drawingBase64, delt: delt,
                 lat: lat, lon: lon, stempler: stempler,
                 tekstbokser: tekstbokser, figurer: figurer, papir: papir,
                 noder: noder, sider: sider, objekter: objekter,
                 sokbarTekst: sokbarTekst))
        // _request tar rå JSON — feltene her er allerede snake-frie
        // bortsett fra leadId/drawingBase64; backend godtar begge former.
        _ = try await _request("/api/leadgrid/canvas/\(id)",
                               method: "PUT", body: data)
    }

    /// Fase 3: OCR-tekst fra tegningen → Claude → oppsummering + oppgaver.
    /// Backend lagrer oppgavene (leadgrid_oppgaver, kilde canvas) og
    /// møtelogg-innslag — neste brief åpner med notatet.
    func analyserCanvasNotat(selskap: String?, tekst: String,
                             leadId: String?) async throws -> CanvasAnalyseDTO {
        struct Body: Encodable {
            let selskap: String?
            let tekst: String
            let leadId: String?
        }
        struct Resp: Decodable { let resultat: CanvasAnalyseDTO }
        let r: Resp = try await _post(
            "/api/leadgrid/canvas/analyse",
            body: Body(selskap: selskap, tekst: tekst, leadId: leadId))
        return r.resultat
    }

    /// Apple Intelligence: analysen ble gjort ON-DEVICE — backend skal
    /// bare persistere (oppgaver + møtelogg). Ingen AI-kost, ingen gate.
    func persisterCanvasAnalyse(selskap: String?, leadId: String?,
                                resultat: CanvasAnalyseDTO) async throws {
        struct Ferdig: Encodable {
            let oppsummering: String
            let oppgaver: [[String: String?]]
            let lofter: [String]
        }
        struct Body: Encodable {
            let selskap: String?
            let leadId: String?
            let tekst: String
            let ferdigResultat: Ferdig
        }
        struct Resp: Decodable { let resultat: CanvasAnalyseDTO }
        let ferdig = Ferdig(
            oppsummering: resultat.oppsummering,
            oppgaver: (resultat.oppgaver ?? []).map {
                ["tittel": $0.tittel, "frist": $0.frist]
            },
            lofter: resultat.lofter ?? [])
        let _: Resp = try await _post(
            "/api/leadgrid/canvas/analyse",
            body: Body(selskap: selskap, leadId: leadId, tekst: "",
                       ferdigResultat: ferdig))
    }

    /// Time Travel: notatets versjoner (eldst → nyest).
    func hentCanvasVersjoner(notatId: String) async throws -> [CanvasVersjonDTO] {
        struct Resp: Decodable { let versjoner: [CanvasVersjonDTO] }
        let r: Resp = try await _get("/api/leadgrid/canvas/\(notatId)/versjoner")
        return r.versjoner
    }

    /// Rolle-policy: org styrer salgslederes/selgeres Canvas-funksjoner.
    func hentCanvasRollePolicy() async throws -> OversiktPolicyDTO {
        try await _get("/api/leadgrid/canvas-rolle-policy")
    }

    func lagreCanvasRollePolicy(malgruppe: String,
                                skjulteFunksjoner: [String]) async throws {
        struct Body: Encodable {
            let malgruppe: String
            let skjulteFunksjoner: [String]
        }
        struct Resp: Decodable { let ok: Bool }
        let _: Resp = try await _put(
            "/api/leadgrid/canvas-rolle-policy",
            body: Body(malgruppe: malgruppe, skjulteFunksjoner: skjulteFunksjoner))
    }

    func slettCanvasNotat(id: String) async throws {
        _ = try await _request("/api/leadgrid/canvas/\(id)",
                               method: "DELETE", body: nil)
    }
}
