import Foundation

/// Parse deep-links embedded web pages hand back to CreatorHub One.
/// When the photographer taps a project card inside the admin
/// WebView, for example, we don't want the web app to navigate
/// *within* the web bubble — we want to jump back to the native
/// shoot tab for that project.
///
/// The convention is URLs of the form:
///
///     creatorhubone://project/<projectId>
///     creatorhubone://session/<sessionId>
///     creatorhubone://shotlist/<projectId>
///     creatorhubone://cull/<sessionId>
///
/// The web app emits these via plain ``<a href="creatorhubone://…">``
/// links when it detects the ``creatorhub_embedding = 'ipad-native'``
/// localStorage flag the auth bridge sets. WKWebView's navigation
/// delegate catches the custom scheme, we parse here, and route via
/// ``DeepLinkRouter.Intent``.
struct DeepLinkRouter {

    enum Intent: Equatable, Sendable {
        case openProject(id: String)
        case openSession(id: UUID)
        case openShotList(projectId: String)
        case openCull(sessionId: UUID)
    }

    /// The scheme the bridge answers to. Registered in Info.plist
    /// under ``CFBundleURLSchemes`` so other apps can deep-link in
    /// too (e.g. Shortcuts opening a specific project).
    static let scheme = "creatorhubone"

    /// Parse a URL into an ``Intent``. Returns nil when the URL
    /// isn't one of ours or has a malformed path. Never throws —
    /// an unknown deep link should be silently ignored, not crash
    /// the navigation.
    static func parse(_ url: URL) -> Intent? {
        guard url.scheme == scheme else { return nil }

        // ``host`` holds the first path component in custom-scheme
        // URLs (creatorhubone://host/path). We treat it as the
        // intent kind. Remaining path components are the id.
        let kind = url.host ?? ""
        let rawId = url.pathComponents
            .filter { $0 != "/" }
            .first?
            .trimmingCharacters(in: .whitespaces)
        guard let id = rawId, !id.isEmpty else { return nil }

        switch kind {
        case "project":
            return .openProject(id: id)
        case "session":
            return UUID(uuidString: id).map(Intent.openSession)
        case "shotlist":
            return .openShotList(projectId: id)
        case "cull":
            return UUID(uuidString: id).map(Intent.openCull)
        default:
            return nil
        }
    }

    /// Build a deep link URL the web app or another caller can use.
    /// Exposed so native code can also construct a link (e.g. "copy
    /// deep link" in a debug menu) without re-implementing the
    /// schema.
    static func url(for intent: Intent) -> URL? {
        switch intent {
        case let .openProject(id):
            return URL(string: "\(scheme)://project/\(id)")
        case let .openSession(id):
            return URL(string: "\(scheme)://session/\(id.uuidString.lowercased())")
        case let .openShotList(projectId):
            return URL(string: "\(scheme)://shotlist/\(projectId)")
        case let .openCull(sessionId):
            return URL(string: "\(scheme)://cull/\(sessionId.uuidString.lowercased())")
        }
    }
}
