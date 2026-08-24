// APIClient+LeadbookRecording.swift
//
// Leadbook lydopptak fase 2 — samtykke, sletting, org-compliance.
// Backend: backend/server/leadbook-recording-consent-routes.ts
// Se docs/leadgrid-gdpr-lydopptak.md.

import Foundation

struct LeadbookRecordingConsentDTO: Decodable, Sendable {
    let id: String
    let consentedAt: String
}

struct LeadbookComplianceAckDTO: Decodable, Sendable {
    let acknowledgedByName: String?
    let acknowledgedAt: String?
    let checklist: [String: Bool]?
}

struct LeadbookComplianceStatusDTO: Decodable, Sendable {
    let acknowledged: Bool
    let ack: LeadbookComplianceAckDTO?
}

struct LeadbookDeletionQueueRowDTO: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let sellerName: String?
    let deleteRequestedAt: String?
    let anonymizedAt: String?
}

extension APIClient {
    /// Logg samtykke FØR mikrofonen startes (§4). `consentVersion` er
    /// ordlyd-versjonen av samtykke-teksten som ble vist/lest opp.
    func leadbookLogRecordingConsent(
        consentVersion: String, customerLabel: String
    ) async throws -> LeadbookRecordingConsentDTO {
        struct Payload: Encodable { let consentVersion: String; let customerLabel: String }
        return try await _post(
            "/api/leadgrid/leadbook/recording-consent",
            body: Payload(consentVersion: consentVersion, customerLabel: customerLabel)
        )
    }

    /// Kladd (aldri delt) slettes umiddelbart; publisert flagges + varsler ledere.
    func leadbookRequestExampleDeletion(exampleId: String) async throws {
        struct Ignored: Decodable {}
        let _: Ignored = try await _postEmpty("/api/leadgrid/leadbook/examples/\(exampleId)/request-deletion")
    }

    /// Leder/admin: anonymiser + arkiver en sletteforespørsel.
    func leadbookApproveExampleDeletion(exampleId: String) async throws {
        struct Ignored: Decodable {}
        let _: Ignored = try await _postEmpty("/api/leadgrid/admin/leadbook/examples/\(exampleId)/approve-deletion")
    }

    func leadbookDeletionQueue() async throws -> [LeadbookDeletionQueueRowDTO] {
        struct Resp: Decodable { let pendingDeletions: [LeadbookDeletionQueueRowDTO] }
        let r: Resp = try await _get("/api/leadgrid/admin/leadbook/deletion-queue")
        return r.pendingDeletions
    }

    func leadbookLydopptakComplianceStatus() async throws -> LeadbookComplianceStatusDTO {
        try await _get("/api/leadgrid/org/leadbook-lydopptak-compliance")
    }

    /// Alle 4 punkter må være `true` — backend avviser delvis bekreftelse.
    /// Åpner leadbookLydopptak-entitlementet for org-en ved suksess.
    func leadbookAcknowledgeLydopptakCompliance(checklist: [String: Bool]) async throws {
        struct Payload: Encodable { let checklist: [String: Bool] }
        try await _post("/api/leadgrid/org/leadbook-lydopptak-compliance", body: Payload(checklist: checklist))
    }
}
