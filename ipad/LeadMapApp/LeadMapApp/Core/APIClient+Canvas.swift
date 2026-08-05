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
                            delt: Bool = false) async throws -> String {
        struct Body: Encodable {
            let tittel: String
            let kategori: String
            let selskap: String?
            let leadId: String?
            let drawingBase64: String
            let delt: Bool
        }
        struct Resp: Decodable { let id: String }
        let r: Resp = try await _post(
            "/api/leadgrid/canvas",
            body: Body(tittel: tittel, kategori: kategori, selskap: selskap,
                       leadId: leadId, drawingBase64: drawingBase64, delt: delt))
        return r.id
    }

    func oppdaterCanvasNotat(id: String, tittel: String, kategori: String,
                             selskap: String?, leadId: String?,
                             drawingBase64: String,
                             delt: Bool = false) async throws {
        struct Body: Encodable {
            let tittel: String
            let kategori: String
            let selskap: String?
            let leadId: String?
            let drawingBase64: String
            let delt: Bool
        }
        let data = try JSONEncoder().encode(
            Body(tittel: tittel, kategori: kategori, selskap: selskap,
                 leadId: leadId, drawingBase64: drawingBase64, delt: delt))
        // _request tar rå JSON — feltene her er allerede snake-frie
        // bortsett fra leadId/drawingBase64; backend godtar begge former.
        _ = try await _request("/api/leadgrid/canvas/\(id)",
                               method: "PUT", body: data)
    }

    func slettCanvasNotat(id: String) async throws {
        _ = try await _request("/api/leadgrid/canvas/\(id)",
                               method: "DELETE", body: nil)
    }
}
