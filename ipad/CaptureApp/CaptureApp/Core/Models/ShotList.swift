import Foundation

/// Per-prosjekt shot-liste lagret lokalt i GRDB-tabellen `shotList`.
/// Selve shot-arrayen serializeres som JSON-tekst i ``shotsJson`` for
/// å matche server-skjemaet (PostgreSQL `JSONB` på `shot_lists.shots`).
/// Den ergonomiske `shots`-properten gjør encode/decode automatisk så
/// resten av appen bare jobber med `[ShotListItem]`.
///
/// `FetchableRecord` + `PersistableRecord`-conformance lever i
/// ``DatabaseSchema`` for konsistens med Project + Contract.
///
/// Sync-flow er outbox-basert: hver mutasjon i ``ShotListStore``
/// oppdaterer raden lokalt + enqueuer en POST mot
/// `/api/projects/:id/shot-list` i samme write-transaksjon. Hvis app
/// kræsjer mellom DB-skriv og outbox-enqueue, ruller GRDB tilbake
/// begge — lokal state og pending sync kan aldri være uenige.
struct ShotList: Codable, Sendable, Equatable, Identifiable {
    var id: String
    var ownerUserId: String
    var projectId: String
    var listName: String
    var eventType: String

    /// Serializert JSON-array. Brukes direkte av GRDB-roundtrip slik
    /// at vi matcher servers `shots`-JSONB-felt 1:1 uten en custom
    /// column-coding strategy.
    var shotsJson: String

    var updatedAt: Date
    var lastSyncedAt: Date?

    /// Decoded view av ``shotsJson``. Settere round-tripper tilbake til
    /// JSON så GRDB-skriv ser oppdatert string. Getter er defensiv:
    /// hvis JSON ikke kan parses (eldre app-versjoner som migrerer fra
    /// en annen shape, korrupt JSONB osv.) returnerer vi tom liste i
    /// stedet for å kræsje shoot-flowen mid-shoot.
    var shots: [ShotListItem] {
        get {
            guard
                let data = shotsJson.data(using: .utf8),
                let parsed = try? ShotList.decoder.decode([ShotListItem].self, from: data)
            else {
                return []
            }
            return parsed
        }
        set {
            guard
                let data = try? ShotList.encoder.encode(newValue),
                let str = String(data: data, encoding: .utf8)
            else {
                shotsJson = "[]"
                return
            }
            shotsJson = str
        }
    }

    init(
        id: String,
        ownerUserId: String,
        projectId: String,
        listName: String,
        eventType: String,
        shotsJson: String = "[]",
        updatedAt: Date = Date(),
        lastSyncedAt: Date? = nil,
    ) {
        self.id = id
        self.ownerUserId = ownerUserId
        self.projectId = projectId
        self.listName = listName
        self.eventType = eventType
        self.shotsJson = shotsJson
        self.updatedAt = updatedAt
        self.lastSyncedAt = lastSyncedAt
    }

    // MARK: - JSON round-trip helpers

    /// `shots`-decoderen er separat fra GRDB-decoderen så vi kan velge
    /// JSON-strategier uavhengig (her: ingen date-coding nødvendig,
    /// alle ShotListItem-felter er primitiver).
    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()
    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        return e
    }()

    // Computed shots-feltet skal IKKE delta i Codable-roundtrippen mot
    // GRDB (raden lagrer shotsJson, ikke shots). Eksplisitte CodingKeys
    // utelater shots så Codable ikke prøver å serialisere den.
    private enum CodingKeys: String, CodingKey {
        case id, ownerUserId, projectId, listName, eventType, shotsJson, updatedAt, lastSyncedAt
    }
}
