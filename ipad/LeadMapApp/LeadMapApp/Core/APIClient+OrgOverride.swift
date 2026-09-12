// APIClient+OrgOverride.swift
//
// Org-modus-velger (mig 0365): super_admin (Daniel) kan se appen i
// valgfri modus — solo ('self') eller en hvilken som helst org. Alle
// Leadgrid-org-oppslag i backend respekterer valget.
//
//   GET  /api/leadgrid/org-override   → gjeldende modus + tilgjengelige
//   POST /api/leadgrid/org-override   → { org_id: "self"|"<id>"|null }

import Foundation

struct OrgModeDTO: Decodable, Identifiable, Hashable {
    let id: String        // "self" eller org-id
    let label: String
    let isCurrent: Bool
}

struct OrgOverrideResponse: Decodable {
    let currentOrgId: String
    let canSwitch: Bool
    let modes: [OrgModeDTO]
}

extension APIClient {
    func fetchOrgModes() async throws -> OrgOverrideResponse {
        try await _get("/api/leadgrid/org-override")
    }

    /// Sett modus ('self'/org-id) eller fjern override (nil).
    func setOrgMode(_ orgId: String?) async throws {
        struct Payload: Encodable { let orgId: String? }
        try await _post("/api/leadgrid/org-override", body: Payload(orgId: orgId))
    }
}
