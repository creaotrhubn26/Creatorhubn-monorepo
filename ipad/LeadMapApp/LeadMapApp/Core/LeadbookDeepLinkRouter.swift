import Foundation

enum LeadbookDeepLinkDestination: Equatable, Sendable {
    case example(UUID)
    case template(UUID)
}

struct LeadbookDeepLinkScope: Equatable, Sendable {
    let projectId: String
    let organizationId: String
}

struct LeadbookDeepLinkRoute: Equatable, Sendable {
    let destination: LeadbookDeepLinkDestination
    let scope: LeadbookDeepLinkScope?
}

enum LeadbookDeepLinkRouter {
    /// Canonical links:
    /// leadgrid://leadbook/examples/<uuid>
    /// leadgrid://leadbook/templates/<uuid>
    /// The old leadgrid://leadbook/<uuid> form remains readable, but only
    /// for a complete UUID. Truncated identifiers are intentionally rejected.
    static func parse(_ url: URL) -> LeadbookDeepLinkRoute? {
        guard url.scheme?.lowercased() == "leadgrid",
              url.host?.lowercased() == "leadbook"
        else { return nil }
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return nil }
        let projectValues = components.queryItems?
            .filter { $0.name == "projectId" }
            .compactMap(\.value) ?? []
        let organizationValues = components.queryItems?
            .filter { $0.name == "organizationId" }
            .compactMap(\.value) ?? []
        guard projectValues.count <= 1, organizationValues.count <= 1 else { return nil }

        let rawProjectId = projectValues.first?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let rawOrganizationId = organizationValues.first?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let hasProject = rawProjectId?.isEmpty == false
        let hasOrganization = rawOrganizationId?.isEmpty == false
        guard hasProject == hasOrganization else { return nil }

        let scope: LeadbookDeepLinkScope?
        if let projectId = rawProjectId,
           let organizationId = rawOrganizationId,
           !projectId.isEmpty,
           projectId.count <= 255,
           !projectId.unicodeScalars.contains(where: {
               CharacterSet.controlCharacters.contains($0)
           }),
           let normalizedOrganizationId = UUID(uuidString: organizationId)?.uuidString.lowercased() {
            scope = LeadbookDeepLinkScope(
                projectId: projectId,
                organizationId: normalizedOrganizationId
            )
        } else if !hasProject && !hasOrganization {
            scope = nil
        } else {
            return nil
        }

        let parts = url.pathComponents.filter { $0 != "/" }
        if parts.count == 2,
           let id = UUID(uuidString: parts[1]) {
            switch parts[0].lowercased() {
            case "examples":
                return LeadbookDeepLinkRoute(destination: .example(id), scope: scope)
            case "templates":
                return LeadbookDeepLinkRoute(destination: .template(id), scope: scope)
            default: return nil
            }
        }
        if parts.count == 1, let id = UUID(uuidString: parts[0]) {
            return LeadbookDeepLinkRoute(destination: .template(id), scope: scope)
        }
        return nil
    }
}
