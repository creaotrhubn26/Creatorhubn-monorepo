import Foundation

/// Typed wrappers over the Google Drive REST API shapes the iPad
/// needs. Kept small on purpose: every field added here implies a
/// parse + test + backwards-compat contract, so we only model what
/// CreatorHub One reads.

/// The photographer's signed-in Google identity + the access token
/// we use to call ``drive.googleapis.com``. Access tokens expire
/// every ~60 minutes so we store the refresh token alongside and
/// roll on demand.
struct DriveCredentials: Equatable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
    /// Google scope list the user granted. We don't use this at
    /// runtime but stash it so a debug surface can show what the
    /// photographer agreed to.
    let scopes: [String]

    /// Cheap expiry check with a safety margin — callers refresh if
    /// under 60 seconds remains so in-flight requests don't race a
    /// 401. Pure so tests can freeze the clock.
    func isExpired(now: Date = Date(), safetyMarginSeconds: TimeInterval = 60) -> Bool {
        expiresAt.addingTimeInterval(-safetyMarginSeconds) <= now
    }
}

/// A file or folder in Drive. We only care about a handful of
/// fields — name, id, mime, size — so we deserialise explicitly
/// rather than inheriting Drive's full schema.
struct DriveFile: Equatable, Sendable {
    let id: String
    let name: String
    let mimeType: String
    /// Size in bytes. Folders have no size, hence optional.
    let size: Int64?
    /// Web link for the photographer to open the file in Drive.
    /// Rendered on the iPad for debugging + "view in Drive" CTAs.
    let webViewLink: URL?

    static let folderMimeType = "application/vnd.google-apps.folder"

    var isFolder: Bool { mimeType == Self.folderMimeType }
}

/// Resumable-upload handshake result. The initial POST returns a
/// ``Location`` header whose URL is the channel for subsequent
/// ``PUT`` chunks. We wrap it in a struct so the adapter's API
/// stays narrow.
struct DriveResumableSession: Equatable, Sendable {
    let uploadURL: URL
    /// The target file name + mime, carried so subsequent chunk
    /// requests can log diagnostics without threading through the
    /// parameters again.
    let fileName: String
    let mimeType: String
    let totalBytes: Int64
}

/// Progress reported by Drive while we're streaming chunks. Drive
/// responds 308 with a ``Range: bytes=0-<last>`` header telling us
/// how many bytes it has buffered. We convert that to a "next offset
/// the client should send" so retry logic doesn't re-upload bytes
/// Drive already accepted.
struct DriveChunkProgress: Equatable, Sendable {
    /// Inclusive byte index of the last byte Drive confirmed.
    let lastByteReceived: Int64
    /// Next byte the client should send on the subsequent PUT.
    var nextByteToSend: Int64 { lastByteReceived + 1 }
}
