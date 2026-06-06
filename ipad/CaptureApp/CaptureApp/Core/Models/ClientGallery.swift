import Foundation

/// iPad-side speil av en klient-gallery-rad (`legacy.client_galleries`
/// eller tilsvarende på backend). Brukes når fotografen vil dele et
/// utvalg med klienten direkte fra iPad-en uten å gå via web.
///
/// `accessToken` er den per-galleri delbare nøkkelen som havner i
/// `shareUrl`. Backend signerer + ratelimter mot tokenet; iPad
/// lagrer det her kun for å kunne vise URL-en + tracke status.
///
/// `FetchableRecord` + `PersistableRecord`-conformance i
/// ``DatabaseSchema`` (samme mønster som Project + Contract).
struct ClientGallery: Codable, Sendable, Equatable, Identifiable {
    var id: String
    var ownerUserId: String

    /// Galleriet kan eksistere uten å være knyttet til et prosjekt
    /// (ad-hoc share av et utvalg fra én session). projectId og
    /// captureSessionId bruker begge SET NULL on cascade i schema.
    var projectId: String?
    var captureSessionId: String?

    var clientName: String
    var clientEmail: String

    /// Cached prosjekt-tittel så vi kan vise "Anna+Per — galleri" i
    /// listen uten å joine project-tabellen ved hver render.
    var projectTitle: String

    /// Per-galleri token som signerer share-URLen. Genereres på
    /// backend ved opprettelse, lagres her opaque.
    var accessToken: String

    /// Full klikkbar URL. nil før backend har bekreftet opprettelse —
    /// vi har token, men URL-rotting kan endres på serveren.
    var shareUrl: String?

    /// "active" | "expired" | "revoked" — fritekst som matcher serverens
    /// fritekst-status.
    var status: String

    var totalImages: Int
    var heartedImages: Int
    var commentedImages: Int

    /// Klientens overall pick-status: "in_progress" | "completed" |
    /// "stuck" osv. nil før klienten har åpnet galleriet.
    var selectionStatus: String?

    var createdAt: Date
    var updatedAt: Date
    var lastSyncedAt: Date?

    init(
        id: String,
        ownerUserId: String,
        projectId: String? = nil,
        captureSessionId: String? = nil,
        clientName: String,
        clientEmail: String,
        projectTitle: String,
        accessToken: String,
        shareUrl: String? = nil,
        status: String = "active",
        totalImages: Int = 0,
        heartedImages: Int = 0,
        commentedImages: Int = 0,
        selectionStatus: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        lastSyncedAt: Date? = nil,
    ) {
        self.id = id
        self.ownerUserId = ownerUserId
        self.projectId = projectId
        self.captureSessionId = captureSessionId
        self.clientName = clientName
        self.clientEmail = clientEmail
        self.projectTitle = projectTitle
        self.accessToken = accessToken
        self.shareUrl = shareUrl
        self.status = status
        self.totalImages = totalImages
        self.heartedImages = heartedImages
        self.commentedImages = commentedImages
        self.selectionStatus = selectionStatus
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.lastSyncedAt = lastSyncedAt
    }
}
