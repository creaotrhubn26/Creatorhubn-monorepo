import XCTest
@testable import CaptureApp

final class DashboardSubmissionsTests: XCTestCase {
    private var session: URLSession!
    private let baseURL = URL(string: "https://backend.local")!

    override func setUp() {
        super.setUp()
        session = MockURLProtocol.makeSession()
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        session = nil
        super.tearDown()
    }

    private func makeClient() -> DashboardClient {
        DashboardClient(
            baseURL: baseURL,
            session: session,
            authHeaders: ["Authorization": "Bearer session-token"],
            userId: "owner-1"
        )
    }

    func testInquiryListUsesCanonicalOwnerScopedEndpointAndDecodesReadState() async throws {
        let captured = RequestBox()
        MockURLProtocol.handler = { request in
            captured.value = request
            return MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"items":[{"id":"inquiry-1","name":"Kari","email":"kari@example.test","projectType":"wedding","description":"Bryllup","status":"new","isRead":false,"isStarred":true,"quoteSent":false,"contractSent":false,"depositReceived":false}],"unreadCount":1,"total":1}"#
            )
        }

        let items = try await makeClient().listSubmissions(status: "open", search: "Kari Kunde")

        XCTAssertEqual(items.map(\.id), ["inquiry-1"])
        XCTAssertTrue(items[0].isNew)
        XCTAssertTrue(items[0].isStarred)
        XCTAssertEqual(captured.value?.url?.path, "/api/inquiries")
        let query = URLComponents(url: try XCTUnwrap(captured.value?.url), resolvingAgainstBaseURL: false)?.queryItems
        XCTAssertEqual(query?.first(where: { $0.name == "status" })?.value, "open")
        XCTAssertEqual(query?.first(where: { $0.name == "search" })?.value, "Kari Kunde")
        XCTAssertEqual(captured.value?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
    }

    func testReplyPostsOnlyInquiryIdSubjectAndBody() async throws {
        let captured = RequestBox()
        MockURLProtocol.handler = { request in
            captured.value = request
            return MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"inquiry":{"id":"inquiry-1","name":"Kari","email":"kari@example.test","projectType":"wedding","description":"Bryllup","status":"replied","isRead":true,"isStarred":false,"quoteSent":false,"contractSent":false,"depositReceived":false},"messageId":"message-1"}"#
            )
        }

        let inquiry = try await makeClient().replyToInquiry(
            id: "inquiry-1",
            subject: "Takk for forespørselen",
            body: "Vi er ledige."
        )

        XCTAssertEqual(inquiry.status, "replied")
        XCTAssertTrue(inquiry.isRead)
        XCTAssertEqual(captured.value?.httpMethod, "POST")
        XCTAssertEqual(captured.value?.url?.path, "/api/inquiries/inquiry-1/reply")
        let body = try XCTUnwrap(captured.value?.httpBody ?? captured.value?.bodyStreamData())
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(json["subject"] as? String, "Takk for forespørselen")
        XCTAssertEqual(json["body"] as? String, "Vi er ledige.")
        XCTAssertNil(json["recipient"])
        XCTAssertNil(json["ownerUserId"])
    }

    func testRealtimeTicketUsesTheSharedAuthenticatedUserStream() async throws {
        let captured = RequestBox()
        MockURLProtocol.handler = { request in
            captured.value = request
            return MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"ticket":"ticket-1","expiresAt":"2026-09-21T12:00:00.000Z","websocketPath":"/api/ipad/ws/events","protocolVersion":1}"#,
                status: 201
            )
        }

        let ticket = try await makeClient().createRealtimeTicket()

        XCTAssertEqual(ticket.ticket, "ticket-1")
        XCTAssertEqual(captured.value?.url?.path, "/api/realtime/user-events-ticket")
        XCTAssertEqual(captured.value?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        XCTAssertEqual(captured.value?.value(forHTTPHeaderField: "X-CreatorHub-Client"), "capture-ios")
    }

    func testInquiryRealtimeEventDecodesAsAnInvalidationHint() throws {
        let event = try XCTUnwrap(UserEvent.decode(jsonText: #"{"version":1,"type":"user_event","event":{"kind":"inquiry.updated","inquiryId":"inquiry-42","reason":"replied","timestamp":"2026-09-21T10:00:00.000Z"}}"#))

        guard case .inquiryUpdated(let update) = event else {
            return XCTFail("Expected inquiry.updated")
        }
        XCTAssertEqual(update.inquiryId, "inquiry-42")
        XCTAssertEqual(update.reason, "replied")
    }

    @MainActor
    func testInquiryPushRoutesToTheRequestedInboxItemOnly() {
        let router = CaptureDeepLinkRouter()

        router.route(type: "message", inquiryId: "ignored")
        XCTAssertNil(router.inquiryId)

        router.route(type: "inquiry", inquiryId: "inquiry-42")
        XCTAssertEqual(router.inquiryId, "inquiry-42")
    }
}

private final class RequestBox: @unchecked Sendable {
    var value: URLRequest?
}

private extension URLRequest {
    func bodyStreamData() -> Data? {
        guard let stream = httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var result = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            result.append(buffer, count: count)
        }
        return result
    }
}
