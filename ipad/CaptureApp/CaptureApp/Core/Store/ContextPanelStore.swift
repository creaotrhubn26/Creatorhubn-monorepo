import Foundation
import GRDB

/// Read-only aggregator for the project-context panel. Joins
/// project + shot list + contracts + parsed metadata into one DTO so
/// the SwiftUI view doesn't have to stitch three loads together.
///
/// Context is deliberately read-only from the iPad — mid-shoot the
/// photographer needs to *see* the contract status, the client's
/// special requests, the venue note. Editing those happens on web
/// where a full keyboard and a bigger screen are available.
struct ContextPanelStore: Sendable {
    let database: AppDatabase

    struct Snapshot: Sendable {
        let project: Project
        let shotList: ShotList?
        let contracts: [Contract]
        /// Free-form photographer-facing notes pulled from the
        /// project's metadata JSON. The web ``ProjectCreationWithMemoryCards``
        /// saves these under ``metadata.specialRequests`` +
        /// ``metadata.notes`` — we prefer specialRequests when both
        /// exist because it's the client-originated field.
        let specialRequests: String?
        /// Optional link to a pinterest board / Google Drive mood
        /// folder the photographer attached on the web. Rendered as
        /// a tap-to-open row.
        let moodBoardURL: URL?
        /// Comma-separated list of co-workers (seconds, videographer,
        /// etc.) pulled from metadata. Shows up as "Teammates: Maria,
        /// Lars" — saves the photographer texting before the shoot.
        let teammates: [String]
    }

    func load(
        projectId: String,
        ownerUserId: String,
    ) async throws -> Snapshot? {
        try await database.dbWriter.read { db in
            guard let project = try Project
                .filter(Column("id") == projectId)
                .filter(Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
            else {
                return nil
            }
            let shotList = try ShotList
                .filter(Column("projectId") == projectId)
                .filter(Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
            let contracts = try Contract
                .filter(Column("projectId") == projectId)
                .filter(Column("ownerUserId") == ownerUserId)
                .order(Column("updatedAt").desc)
                .fetchAll(db)

            let parsed = Self.parseMetadata(project.metadataJson)
            return Snapshot(
                project: project,
                shotList: shotList,
                contracts: contracts,
                specialRequests: parsed.specialRequests,
                moodBoardURL: parsed.moodBoardURL,
                teammates: parsed.teammates,
            )
        }
    }

    // MARK: - Metadata parsing

    /// Pull a few known keys out of ``metadataJson``. We do this
    /// defensively — web evolves the metadata shape over time, so we
    /// use keyed subscripts and silent fall-backs rather than strict
    /// Codable decode. Photographer shouldn't lose shot-day context
    /// just because web added a new unexpected field.
    struct ParsedMetadata {
        var specialRequests: String?
        var moodBoardURL: URL?
        var teammates: [String] = []
    }

    static func parseMetadata(_ json: String) -> ParsedMetadata {
        guard let data = json.data(using: .utf8),
              let raw = try? JSONSerialization.jsonObject(with: data),
              let dict = raw as? [String: Any]
        else {
            return ParsedMetadata()
        }

        var result = ParsedMetadata()
        // Prefer specialRequests (client-originated) over notes
        // (photographer-originated) when both exist.
        if let requests = dict["specialRequests"] as? String, !requests.isEmpty {
            result.specialRequests = requests
        } else if let notes = dict["notes"] as? String, !notes.isEmpty {
            result.specialRequests = notes
        }

        if let link = dict["moodBoardUrl"] as? String, let url = URL(string: link) {
            result.moodBoardURL = url
        } else if let link = dict["moodBoard"] as? String, let url = URL(string: link) {
            result.moodBoardURL = url
        }

        // Teammates can live under multiple keys depending on the
        // project type — ``collaborators`` on weddings,
        // ``crew`` on commercial shoots. Accept both.
        let teammateSources: [[String: Any]?] = [
            dict["collaborators"] as? [[String: Any]],
            dict["crew"] as? [[String: Any]],
        ].compactMap { (arr: [[String: Any]]?) -> [String: Any]? in
            guard let arr, !arr.isEmpty else { return nil }
            return ["_wrap": arr]
        }
        for wrapper in teammateSources {
            guard let arr = wrapper?["_wrap"] as? [[String: Any]] else { continue }
            for entry in arr {
                if let name = entry["name"] as? String, !name.isEmpty {
                    result.teammates.append(name)
                } else if let name = entry["displayName"] as? String, !name.isEmpty {
                    result.teammates.append(name)
                }
            }
        }
        return result
    }
}
