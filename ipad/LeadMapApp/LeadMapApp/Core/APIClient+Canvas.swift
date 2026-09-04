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
    /// Ekte PDF-håndtering: originaldokumentene (JSON-array m/ base64).
    var dokumenter: String? = nil
    /// Papirkurven: når notatet ble slettet (soft delete, 30 dager).
    var slettetAt: String? = nil
    /// Monotont revisjonsnummer for optimistisk låsing ved mutasjoner.
    var revision: Int? = nil
}

struct CanvasMutationResult: Sendable, Equatable {
    let id: String
    let revision: Int
    let created: Bool
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

struct CanvasBibliotekElementDTO: Decodable, Hashable {
    let id: String
    let navn: String
    var innhold: String? = nil
    var delt: Bool? = nil
    var erMin: Bool? = nil
    var eierNavn: String? = nil
}

struct CanvasVersjonDTO: Decodable, Hashable {
    let id: String
    let kategori: String
    var revision: Int? = nil
    var schemaVersion: Int? = nil
    var drawingBase64: String? = nil
    var opprettet: String? = nil
}

/// Absolutte sikkerhetsgrenser avledet fra backend-kontrakten. De er ikke
/// produktgrenser: hvis serveren fortsatt annonserer flere sider ved grensen,
/// er responsen inkonsistent og klienten skal feile i stedet for å avkorte.
enum CanvasPaginationSafetyLimit {
    /// Organisasjonskvoten er 5 000 notater. Byte-budsjettet kan redusere en
    /// side helt ned til ett stort notat, derfor må alle 5 000 sider være lov.
    static let notes = 5_000
    /// Backend beholder maksimalt 40 versjoner og leverer fem per side.
    static let history = 8
    /// Organisasjonskvoten er 5 000 elementer; sidekontrakten leverer ti.
    static let library = 500
}

/// Validerer cursor-progresjon uten å kunne returnere et stille delresultat.
/// En terminal side på selve grensen er gyldig; en ny cursor ved grensen er
/// derimot bevis på at serverkontrakten og klientens sikkerhetsgrense avviker.
struct CanvasPaginationGuard {
    let maximumPageCount: Int
    private(set) var receivedPageCount = 0
    private var seenCursors = Set<String>()

    init(maximumPageCount: Int) {
        precondition(maximumPageCount > 0)
        self.maximumPageCount = maximumPageCount
    }

    mutating func nextCursor(from responseCursor: String?) throws -> String? {
        receivedPageCount += 1
        guard receivedPageCount <= maximumPageCount else {
            throw APIError.invalidResponse
        }
        guard let responseCursor else { return nil }
        guard !responseCursor.isEmpty,
              seenCursors.insert(responseCursor).inserted,
              receivedPageCount < maximumPageCount else {
            throw APIError.invalidResponse
        }
        return responseCursor
    }
}

extension APIClient {

    func hentCanvasNotater(papirkurv: Bool = false) async throws -> [CanvasNotatDTO] {
        struct Resp: Decodable {
            let notater: [CanvasNotatDTO]
            let nextCursor: String?
        }
        var notater: [CanvasNotatDTO] = []
        var cursor: String?
        var pagination = CanvasPaginationGuard(
            maximumPageCount: CanvasPaginationSafetyLimit.notes)
        while true {
            var query = [papirkurv ? "papirkurv=1" : nil, "limit=50"]
                .compactMap { $0 }
            if let cursor { query.append("cursor=\(cursor)") }
            let r: Resp = try await _get(
                "/api/leadgrid/canvas?" + query.joined(separator: "&"))
            notater.append(contentsOf: r.notater)
            guard let nextCursor = try pagination.nextCursor(from: r.nextCursor) else {
                break
            }
            cursor = nextCursor
        }
        return notater
    }

    /// Opprett med klientgenerert UUID. ID-en forblir stabil i faner, async
    /// callbacks og save-køen; serveren returnerer kun autoritativ revisjon.
    func opprettCanvasNotat(id: String, tittel: String, kategori: String,
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
                            sokbarTekst: String = "",
                            dokumenter: String = "[]") async throws -> CanvasMutationResult {
        struct Body: Encodable {
            let id: String
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
            let dokumenter: String
        }
        struct Resp: Decodable {
            let id: String
            let revision: Int
            let created: Bool
        }
        let r: Resp = try await _post(
            "/api/leadgrid/canvas",
            body: Body(id: id, tittel: tittel, kategori: kategori, selskap: selskap,
                       leadId: leadId, drawingBase64: drawingBase64, delt: delt,
                       lat: lat, lon: lon, stempler: stempler,
                       tekstbokser: tekstbokser, figurer: figurer, papir: papir,
                       noder: noder, sider: sider, objekter: objekter,
                       sokbarTekst: sokbarTekst, dokumenter: dokumenter))
        return CanvasMutationResult(
            id: r.id,
            revision: r.revision,
            created: r.created)
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
                             sokbarTekst: String = "",
                             dokumenter: String = "[]",
                             revision: Int) async throws -> Int {
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
            let dokumenter: String
        }
        let data = try JSONEncoder().encode(
            Body(tittel: tittel, kategori: kategori, selskap: selskap,
                 leadId: leadId, drawingBase64: drawingBase64, delt: delt,
                 lat: lat, lon: lon, stempler: stempler,
                 tekstbokser: tekstbokser, figurer: figurer, papir: papir,
                 noder: noder, sider: sider, objekter: objekter,
                 sokbarTekst: sokbarTekst, dokumenter: dokumenter))
        // _request tar rå JSON — feltene her er allerede snake-frie
        // bortsett fra leadId/drawingBase64; backend godtar begge former.
        struct Resp: Decodable { let revision: Int }
        let response = try await _request(
            "/api/leadgrid/canvas/\(id)", method: "PUT", body: data,
            headers: ["If-Match": "W/\"\(revision)\""])
        return try Self._sharedDecoder.decode(Resp.self, from: response).revision
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
        struct Resp: Decodable {
            let versjoner: [CanvasVersjonDTO]
            let nextCursor: String?
        }
        var versjoner: [CanvasVersjonDTO] = []
        var cursor: String?
        var pagination = CanvasPaginationGuard(
            maximumPageCount: CanvasPaginationSafetyLimit.history)
        while true {
            var query = ["limit=5"]
            if let cursor { query.append("cursor=\(cursor)") }
            let r: Resp = try await _get(
                "/api/leadgrid/canvas/\(notatId)/versjoner?"
                    + query.joined(separator: "&"))
            // Serveren beholder eldste→nyeste i hver side, mens neste side er
            // eldre. Prepend gir samme totale rekkefølge som legacy-responsen.
            versjoner.insert(contentsOf: r.versjoner, at: 0)
            guard let nextCursor = try pagination.nextCursor(from: r.nextCursor) else {
                break
            }
            cursor = nextCursor
        }
        return versjoner
    }

    /// Gjenoppretter hele backend-snapshotet som en ny revisjon. Legacy-
    /// historikk som bare inneholder tegning avvises av serveren.
    func gjenopprettCanvasVersjon(
        notatId: String,
        versionId: String,
        revision: Int
    ) async throws -> CanvasNotatDTO {
        struct Resp: Decodable { let notat: CanvasNotatDTO }
        let data = try await _request(
            "/api/leadgrid/canvas/\(notatId)/versjoner/\(versionId)/gjenopprett",
            method: "POST",
            body: nil,
            headers: ["If-Match": "W/\"\(revision)\""])
        return try Self._sharedDecoder.decode(Resp.self, from: data).notat
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

    /// Slett → papirkurven (30 dager); permanent = borte for godt.
    func slettCanvasNotat(id: String, revision: Int,
                          permanent: Bool = false) async throws {
        _ = try await _request(
            "/api/leadgrid/canvas/\(id)" + (permanent ? "?permanent=1" : ""),
            method: "DELETE", body: nil,
            headers: ["If-Match": "W/\"\(revision)\""])
    }

    /// Last opp dokument-bytes til egen tabell (klient-generert id).
    func lastOppCanvasDokument(notatId: String, dokId: String,
                               navn: String, base64: String) async throws {
        struct Body: Encodable { let id: String; let navn: String; let base64: String }
        let data = try JSONEncoder().encode(Body(id: dokId, navn: navn, base64: base64))
        _ = try await _request("/api/leadgrid/canvas/\(notatId)/dokumenter",
                               method: "POST", body: data)
    }

    /// Hent dokument-bytes on-demand (lazy — lista bærer kun metadata).
    func hentCanvasDokument(dokId: String) async throws -> (navn: String, base64: String) {
        struct Dok: Decodable { let id: String; let navn: String; let base64: String }
        struct Resp: Decodable { let dokument: Dok }
        let r: Resp = try await _get("/api/leadgrid/canvas/dokumenter/\(dokId)")
        return (r.dokument.navn, r.dokument.base64)
    }

    func slettCanvasDokument(dokId: String) async throws {
        _ = try await _request("/api/leadgrid/canvas/dokumenter/\(dokId)",
                               method: "DELETE", body: nil)
    }

    /// Org-delt element-bibliotek: mine + delte elementer.
    func hentCanvasBibliotek() async throws -> [CanvasBibliotekElementDTO] {
        struct Resp: Decodable {
            let elementer: [CanvasBibliotekElementDTO]
            let nextCursor: String?
        }
        var elementer: [CanvasBibliotekElementDTO] = []
        var cursor: String?
        var pagination = CanvasPaginationGuard(
            maximumPageCount: CanvasPaginationSafetyLimit.library)
        while true {
            var query = ["limit=10"]
            if let cursor { query.append("cursor=\(cursor)") }
            let r: Resp = try await _get(
                "/api/leadgrid/canvas/bibliotek?" + query.joined(separator: "&"))
            elementer.append(contentsOf: r.elementer)
            guard let nextCursor = try pagination.nextCursor(from: r.nextCursor) else {
                break
            }
            cursor = nextCursor
        }
        return elementer
    }

    func lagreCanvasBibliotekElement(id: String, navn: String,
                                     innhold: String, delt: Bool) async throws {
        struct Body: Encodable {
            let id: String; let navn: String
            let innhold: String; let delt: Bool
        }
        struct Resp: Decodable { let ok: Bool }
        let _: Resp = try await _post("/api/leadgrid/canvas/bibliotek",
                                      body: Body(id: id, navn: navn,
                                                 innhold: innhold, delt: delt))
    }

    func slettCanvasBibliotekElement(id: String) async throws {
        _ = try await _request("/api/leadgrid/canvas/bibliotek/\(id)",
                               method: "DELETE", body: nil)
    }

    /// Hent notatet tilbake fra papirkurven.
    func gjenopprettCanvasNotat(id: String, revision: Int) async throws -> Int {
        struct Resp: Decodable { let revision: Int }
        let data = try await _request(
            "/api/leadgrid/canvas/\(id)/gjenopprett", method: "POST", body: nil,
            headers: ["If-Match": "W/\"\(revision)\""])
        return try Self._sharedDecoder.decode(Resp.self, from: data).revision
    }
}
