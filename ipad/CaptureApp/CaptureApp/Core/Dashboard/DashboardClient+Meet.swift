import Foundation

/// Result of creating a Google Meet — tolerant of the varied field names the
/// backend may return for the join link / browser view URL.
struct MeetResult: Sendable, Hashable {
    var meetLink: String?
    var title: String?
    var webViewUrl: String?
}

extension MeetResult: Decodable {
    private enum CodingKeys: String, CodingKey {
        case meetLink, meet_link, meetingLink, meeting_link, joinUrl, join_url, hangoutLink, hangout_link
        case title, summary
        case webViewUrl, web_view_url, webUrl, web_url, htmlLink, html_link, calendarLink
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Broken into a helper so the type-checker doesn't choke on a long
        // `??` chain ("unable to type-check in reasonable time").
        func first(_ keys: [CodingKeys]) -> String? {
            for key in keys {
                if let v = try? c.decodeIfPresent(String.self, forKey: key) { return v }
            }
            return nil
        }
        meetLink = first([.meetLink, .meet_link, .meetingLink, .meeting_link, .joinUrl, .join_url, .hangoutLink, .hangout_link])
        title = first([.title, .summary])
        webViewUrl = first([.webViewUrl, .web_view_url, .webUrl, .web_url, .htmlLink, .html_link, .calendarLink])
    }
}

/// Google Meet creation endpoint, layered onto ``DashboardClient`` so it shares
/// the same actor isolation, Bearer auth and tolerant error mapping as the rest
/// of the dashboard surface.
///
/// Talks to the Express `/api/google-meet/create` route.
extension DashboardClient {
    /// Schedule a Google Meet and return its join link.
    func createMeet(
        title: String,
        description: String? = nil,
        clientName: String? = nil,
        startISO: String? = nil,
        durationMinutes: Int? = nil,
    ) async throws -> MeetResult {
        struct Body: Encodable {
            let title: String
            let description: String?
            let clientName: String?
            let startDateTime: String?
            let duration: Int?
        }
        return try await postJSON(
            path: "/api/google-meet/create",
            body: Body(
                title: title,
                description: description,
                clientName: clientName,
                startDateTime: startISO,
                duration: durationMinutes,
            ),
        )
    }
}
