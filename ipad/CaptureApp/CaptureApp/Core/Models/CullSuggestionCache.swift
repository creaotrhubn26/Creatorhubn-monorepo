import Foundation

/// Cached respons fra `/api/capture/sessions/:id/cull-suggestions` per
/// session + strictness-nivå. Kort TTL (15 min) så å revisitere
/// culling-fanen på iPad ikke re-spender Claude-tokens for hver browse.
///
/// `invalidatedAt` er nil til en asset-mutasjon (rating, flag, reject)
/// bumper den — da regnes raden som stale uavhengig av alder.
///
/// `FetchableRecord` + `PersistableRecord`-conformance i
/// ``DatabaseSchema``. UUID-kolonnen `sessionId` har
/// `uppercaseString`-encoding-strategy så IDene matcher backend-
/// formatet exact.
struct CullSuggestionCache: Codable, Sendable, Equatable, Identifiable {
    /// Sammensatt key på formen `"<sessionUUID>:<strictness>"` — én rad
    /// per (session, strictness)-kombinasjon. UUID i klartekst er
    /// stabilt nok primaty key her siden vi ikke utfører cross-table
    /// joins på id-en.
    var id: String

    /// Capture-session denne suggestionen tilhører. UUID-typed så GRDB
    /// kan håndheve `.uppercaseString`-encoding-strategy mot backendens
    /// canonical UUID-format.
    var sessionId: UUID

    /// "conservative" | "balanced" | "aggressive" — string match
    /// backend-parameteren.
    var strictness: String

    /// Full `CullingSummary` serialisert som JSON. Parses av
    /// ``CullStore`` ved render — vi lagrer rå JSON for å unngå å bake
    /// inn shape-versjonering her.
    var bucketsJson: String

    var fetchedAt: Date

    /// nil = ikke invalidert eksplisitt (vurderes mot TTL). Satt til
    /// en Date av asset-mutasjons-handlere når en rating/flag endring
    /// betyr at culling-suggestionen er foreldet.
    var invalidatedAt: Date?

    /// TTL — overstiger denne, regnes raden som stale uavhengig av
    /// `invalidatedAt`. Matcher schema-kommentaren ("Short TTL (15 min)").
    static let ttl: TimeInterval = 15 * 60

    /// `true` hvis raden er enten eksplisitt invalidated ELLER eldre
    /// enn TTL. Testet i `CreatorHubOneSchemaTests`.
    var isStale: Bool {
        if invalidatedAt != nil { return true }
        return Date().timeIntervalSince(fetchedAt) > Self.ttl
    }

    init(
        id: String,
        sessionId: UUID,
        strictness: String,
        bucketsJson: String,
        fetchedAt: Date = Date(),
        invalidatedAt: Date? = nil,
    ) {
        self.id = id
        self.sessionId = sessionId
        self.strictness = strictness
        self.bucketsJson = bucketsJson
        self.fetchedAt = fetchedAt
        self.invalidatedAt = invalidatedAt
    }
}
