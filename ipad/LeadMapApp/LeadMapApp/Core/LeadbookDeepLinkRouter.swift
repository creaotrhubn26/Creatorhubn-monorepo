import Foundation

enum LeadbookDeepLinkDestination: Equatable, Sendable {
    case example(UUID)
    case template(UUID)
}

enum LeadbookDeepLinkRouter {
    /// Canonical links:
    /// leadgrid://leadbook/examples/<uuid>
    /// leadgrid://leadbook/templates/<uuid>
    /// The old leadgrid://leadbook/<uuid> form remains readable, but only
    /// for a complete UUID. Truncated identifiers are intentionally rejected.
    static func parse(_ url: URL) -> LeadbookDeepLinkDestination? {
        guard url.scheme?.lowercased() == "leadgrid",
              url.host?.lowercased() == "leadbook"
        else { return nil }
        let parts = url.pathComponents.filter { $0 != "/" }
        if parts.count == 2,
           let id = UUID(uuidString: parts[1]) {
            switch parts[0].lowercased() {
            case "examples": return .example(id)
            case "templates": return .template(id)
            default: return nil
            }
        }
        if parts.count == 1, let id = UUID(uuidString: parts[0]) {
            return .template(id)
        }
        return nil
    }
}
