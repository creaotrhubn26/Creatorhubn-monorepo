import Foundation

/// Kontrakt mellom fotograf og klient — speil av `legacy.contracts`-
/// raden fra backend. Brukes av Apple Pencil-signing-flowen og
/// context-panelet under shoot ("Backup-fotograf godkjent ✓").
///
/// `pdfLocalPath` peker på cached PDF som rendres i PDFKit;
/// `pdfDriveFileId` er canonical Drive-fila signing skriver tilbake
/// til. `signatureDataRef` er en opaque referanse til arkivert
/// PKDrawing — selve binæren ligger utenfor GRDB (i SignatureStorage).
///
/// `FetchableRecord` + `PersistableRecord`-conformance lever i
/// ``DatabaseSchema`` — denne fila holder bare model + status-enum.
struct Contract: Codable, Sendable, Equatable, Identifiable {
    /// Kontrakt-livssyklus. Lagres som rå string i SQLite (`status`-
    /// kolonnen er TEXT) for å matche serverens fritekst-felt, men
    /// modellen typer det som enum så Swift-kallesteder ikke kan
    /// stave feil mellom `signed` og `Signed`.
    enum Status: String, Codable, Sendable, Equatable {
        case draft
        case sent
        case signed
        case expired
    }

    var id: String
    var ownerUserId: String

    /// Kontrakter kan eksistere uavhengig av prosjekt (frittstående
    /// klient-avtaler) — så projectId er optional og bruker SET NULL
    /// on cascade i schema.
    var projectId: String?

    var clientName: String
    var clientEmail: String?

    var status: Status

    /// JSON-blob med kontrakts-vilkår (price, deliverables, deposit,
    /// special clauses). Parses ad-hoc av context-panelet på samme
    /// måte som `Project.metadataJson`.
    var termsJson: String

    var pdfLocalPath: String?
    var pdfDriveFileId: String?

    /// Opaque referanse til lagret PKDrawing-fil. Settes av
    /// ``ContractStore.applySignature`` og slettes når kontrakten
    /// re-signeres eller status flippes tilbake til draft.
    var signatureDataRef: String?

    var signedAt: Date?
    var updatedAt: Date
    var lastSyncedAt: Date?

    init(
        id: String,
        ownerUserId: String,
        projectId: String? = nil,
        clientName: String,
        clientEmail: String? = nil,
        status: Status = .draft,
        termsJson: String = "{}",
        pdfLocalPath: String? = nil,
        pdfDriveFileId: String? = nil,
        signatureDataRef: String? = nil,
        signedAt: Date? = nil,
        updatedAt: Date = Date(),
        lastSyncedAt: Date? = nil,
    ) {
        self.id = id
        self.ownerUserId = ownerUserId
        self.projectId = projectId
        self.clientName = clientName
        self.clientEmail = clientEmail
        self.status = status
        self.termsJson = termsJson
        self.pdfLocalPath = pdfLocalPath
        self.pdfDriveFileId = pdfDriveFileId
        self.signatureDataRef = signatureDataRef
        self.signedAt = signedAt
        self.updatedAt = updatedAt
        self.lastSyncedAt = lastSyncedAt
    }
}
