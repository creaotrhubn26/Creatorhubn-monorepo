import Foundation

/// iPad-side speil av `legacy.projects`-raden fra backend, slik den
/// brukes av "I dag"-dashboardet, context-panelet og project-pickeren
/// på shoot-fanen.
///
/// Lagres lokalt via GRDB i `project`-tabellen — kolonner definert i
/// ``DatabaseSchema``-migrasjonen `v3_creatorhub_one_foundation`.
/// `FetchableRecord` + `PersistableRecord`-conformancen lever som en
/// extension i `DatabaseSchema.swift` (sammen med resten av v3-mirrors)
/// for å holde model-filene rene fra DB-implementasjon.
///
/// Synciseres fra `GET /api/capture/projects` + `GET /api/capture/
/// projects/:id` via ``BackendClient``. Mutasjoner skjer på web —
/// iPad-en er read-mostly her (du kan opprette tomme prosjekter via
/// ``ProjectSelectionView``, men ikke redigere felter).
struct Project: Codable, Sendable, Equatable, Identifiable {
    /// Backend UUID-as-text. Brukt som primary key på iPad-en også så
    /// rader matches 1:1 etter sync uten ID-remapping.
    var id: String

    /// Photographer som eier raden. Alltid den signed-in brukeren —
    /// multi-photographer-studio iPad-er bytter ikke mellom kontoer
    /// uten å slette lokal DB først.
    var ownerUserId: String

    var title: String
    var clientName: String?
    var clientEmail: String?

    /// Når selve shoot-en skjer. ISO-8601 på wire, Date her. nil for
    /// prosjekter uten dato satt ennå (rare admin-flows).
    var eventDate: Date?
    var location: String?

    /// "wedding" | "portrait" | "event" | "commercial" | ... — fritekst
    /// som matcher web-wizardens `PROJECT_TYPES`-mapping.
    var projectType: String?

    /// Prosjekt-livssyklus: `active`, `in_progress`, `draft`, `done`,
    /// osv. — vi konstant matcher status mot strings, så enum-isering
    /// ville bare gjort sync-decoder mer skjør for ukjente verdier.
    var status: String

    /// Full metadata-blob serializert som JSON-string. Inneholder ting
    /// som spesielle ønsker, pinterest-link, teammates. Parses ad-hoc
    /// av ``ContextPanelStore`` med defensive fallback-decoders.
    var metadataJson: String

    // Shot-liste-tellere som driver progress-stripene uten å parse
    // selve shot-arrayen. Oppdateres av sync-engine når shot-listen
    // endres på web.
    var totalShots: Int
    var completedShots: Int
    var mustHaveShots: Int
    var completedMustHave: Int

    var updatedAt: Date
    var lastSyncedAt: Date?

    init(
        id: String,
        ownerUserId: String,
        title: String,
        clientName: String? = nil,
        clientEmail: String? = nil,
        eventDate: Date? = nil,
        location: String? = nil,
        projectType: String? = nil,
        status: String = "active",
        metadataJson: String = "{}",
        totalShots: Int = 0,
        completedShots: Int = 0,
        mustHaveShots: Int = 0,
        completedMustHave: Int = 0,
        updatedAt: Date = Date(),
        lastSyncedAt: Date? = nil,
    ) {
        self.id = id
        self.ownerUserId = ownerUserId
        self.title = title
        self.clientName = clientName
        self.clientEmail = clientEmail
        self.eventDate = eventDate
        self.location = location
        self.projectType = projectType
        self.status = status
        self.metadataJson = metadataJson
        self.totalShots = totalShots
        self.completedShots = completedShots
        self.mustHaveShots = mustHaveShots
        self.completedMustHave = completedMustHave
        self.updatedAt = updatedAt
        self.lastSyncedAt = lastSyncedAt
    }
}
