import Foundation

/// In-memory record of a single client-side review action (heart or
/// comment) on an asset in the current capture session. Populated from
/// the user-scoped WebSocket (`asset.hearted` / `asset.commented`
/// events) so the photographer sees client feedback land in real time
/// while still on-set, before they've left the venue.
///
/// The shape mirrors the relevant fields of ``UserEvent.AssetHearted``
/// and ``UserEvent.AssetCommented`` but keyed by the local asset's
/// `UUID` (resolved at receive-time) so the inbox UI can render
/// filenames + jump-to-asset without re-querying.
///
/// Not persisted — these are session-local notifications. The
/// authoritative review record lives on the backend and is queryable
/// via the standalone reviews endpoint.
struct ClientReview: Identifiable, Equatable {
    let id: UUID
    let assetId: UUID
    let assetFilename: String
    let kind: Kind
    let senderKind: SenderKind
    /// Display name. For client-side reviews this is the backend's
    /// `clientLabel` (set when the photographer minted the share
    /// token); nil falls back to "Klient". For photographer replies
    /// it's the signed-in photographer's display name; nil falls back
    /// to "Du".
    let displayName: String?
    let timestamp: Date
    var unread: Bool

    enum Kind: Equatable {
        /// Heart toggled. `on: true` = newly hearted; `on: false` =
        /// hearted-then-unhearted (still surfaced so the photographer
        /// sees the client's intent change in real time).
        case heart(on: Bool)
        /// Free-text comment. For client comments, `preview` is the
        /// backend-truncated first ~140 chars; full body lives on the
        /// review row server-side. For photographer replies, the full
        /// text is kept locally since we just composed it.
        case comment(preview: String)
        /// Phase 5.1 — voice-memo reply. `localPath` points at the
        /// session-local m4a file (lives under `tempDir/reply-memos/`
        /// and survives across stream re-emits). `durationSeconds`
        /// drives the play-button label ("▶ 0:08"). Photographer-only
        /// for now — clients receive these as audio playback widgets
        /// in the web gallery (Phase 5.1 frontend follow-up).
        case audio(localPath: String, durationSeconds: Double)
    }

    /// Who authored this entry. Drives chat-bubble alignment + tinting:
    /// clients align right (orange), photographer aligns left (neutral).
    /// Mirrors backend's `reviewerType` column.
    enum SenderKind: Equatable {
        case client
        case photographer
    }
}
