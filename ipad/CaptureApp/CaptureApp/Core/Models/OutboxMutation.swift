import Foundation

/// En enkelt køet mutasjon som må syncs tilbake til backend. Hver
/// iPad-originert write (cull-beslutning, shot-completion, kontrakt-
/// signatur, ...) appendes hit atomisk med selve den lokale rad-
/// oppdateringen, og ``OutboxWorker`` drainer køen når connectivity
/// kommer tilbake.
///
/// `MutablePersistableRecord`-conformancen i ``DatabaseSchema`` har
/// `didInsert` som stempler `id` etter `INSERT` — derfor er `id`
/// optional og `Int64?` (auto-increment primary key, ikke text-UUID
/// som de andre v3-mirrors).
///
/// Idempotens: `clientMutationId` er en client-generated UUID som
/// sendes som `X-Client-Mutation-Id`-header. Backend deduper retries
/// mot dette så samme mutasjon kan flushes flere ganger uten dobbel-
/// effekt.
struct OutboxMutation: Codable, Sendable, Equatable {
    /// HTTP-metoden mutasjonen mapper til når den flushes. String-
    /// rawValue så de lagres som ren tekst i `method`-kolonnen.
    enum Method: String, Codable, Sendable, Equatable {
        case get = "GET"
        case post = "POST"
        case patch = "PATCH"
        case put = "PUT"
        case delete = "DELETE"
    }

    /// Livssyklus for en kø-rad. `pending` ved insert; `syncing` mens
    /// worker flusher; `succeeded` ved 2xx-response; `failed` ved
    /// network-feil eller 5xx. En rad med `failed` + `attemptCount >=
    /// maxAttempts` parkes — UI viser den så fotografen kan beslutte
    /// retry eller drop.
    enum Status: String, Codable, Sendable, Equatable {
        case pending
        case syncing
        case succeeded
        case failed
    }

    /// Maks antall flush-forsøk før raden parkes som ikke-retryable.
    /// Matchet med schema-kommentaren ("failed count >= 5") og brukes
    /// av både Outbox.requeue og purge-cleanup.
    static let maxAttempts: Int = 5

    /// Auto-increment rowID fra SQLite. nil før insert; stempled av
    /// `didInsert` i `DatabaseSchema.swift`.
    var id: Int64?

    /// Client-generated UUID som backend bruker til å deduplikere
    /// retries. Unique-constraint på kolonnen sikrer at flush ikke
    /// inserter samme klient-token to ganger ved race-conditions.
    var clientMutationId: String

    /// HTTP-endepunktet å POST/PATCH/DELETE mot. Inkluderer hverken
    /// host eller bearer-token (det stampes av ``BackendClient``).
    var endpoint: String

    var method: Method

    /// JSON-encoded request-body. nil for metoder uten body (GET,
    /// DELETE uten payload).
    var bodyJson: String?

    /// GRDB-tabellen som ble mutert lokalt. Brukes til å re-finne
    /// raden ved retry-flows + til status-mapping ("din asset venter
    /// på sync").
    var entityTable: String?
    var entityId: String?

    var status: Status

    var attemptCount: Int
    var lastError: String?

    var createdAt: Date
    var updatedAt: Date

    init(
        id: Int64? = nil,
        clientMutationId: String,
        endpoint: String,
        method: Method,
        bodyJson: String? = nil,
        entityTable: String? = nil,
        entityId: String? = nil,
        status: Status = .pending,
        attemptCount: Int = 0,
        lastError: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
    ) {
        self.id = id
        self.clientMutationId = clientMutationId
        self.endpoint = endpoint
        self.method = method
        self.bodyJson = bodyJson
        self.entityTable = entityTable
        self.entityId = entityId
        self.status = status
        self.attemptCount = attemptCount
        self.lastError = lastError
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
