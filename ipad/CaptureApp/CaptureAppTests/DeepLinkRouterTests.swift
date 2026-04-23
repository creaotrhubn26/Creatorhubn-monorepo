import XCTest
@testable import CaptureApp

/// Tests for the deep-link parser + builder. We verify every
/// supported intent shape round-trips through ``url(for:)`` →
/// ``parse(_:)``, plus the defensive behaviour:
///   - Wrong scheme → nil
///   - Malformed UUID for session/cull → nil (don't crash nav)
///   - Unknown intent kind → nil
///   - Missing id → nil
/// A subtle case: iPad-encoded UUIDs in the asset / session tables
/// are uppercase, but the deep-link emitter uses lowercase (matches
/// iOS URL hygiene). Parse must accept both.
final class DeepLinkRouterTests: XCTestCase {

    // MARK: - Round-trip

    func testOpenProjectRoundTrip() throws {
        let intent = DeepLinkRouter.Intent.openProject(id: "proj-123")
        let url = try XCTUnwrap(DeepLinkRouter.url(for: intent))
        XCTAssertEqual(url.scheme, "creatorhubone")
        let parsed = try XCTUnwrap(DeepLinkRouter.parse(url))
        XCTAssertEqual(parsed, intent)
    }

    func testOpenSessionRoundTrip() throws {
        let uuid = UUID()
        let intent = DeepLinkRouter.Intent.openSession(id: uuid)
        let url = try XCTUnwrap(DeepLinkRouter.url(for: intent))
        let parsed = try XCTUnwrap(DeepLinkRouter.parse(url))
        XCTAssertEqual(parsed, intent)
    }

    func testOpenShotListRoundTrip() throws {
        let intent = DeepLinkRouter.Intent.openShotList(projectId: "proj-xyz")
        let url = try XCTUnwrap(DeepLinkRouter.url(for: intent))
        let parsed = try XCTUnwrap(DeepLinkRouter.parse(url))
        XCTAssertEqual(parsed, intent)
    }

    func testOpenCullRoundTrip() throws {
        let uuid = UUID()
        let intent = DeepLinkRouter.Intent.openCull(sessionId: uuid)
        let url = try XCTUnwrap(DeepLinkRouter.url(for: intent))
        let parsed = try XCTUnwrap(DeepLinkRouter.parse(url))
        XCTAssertEqual(parsed, intent)
    }

    // MARK: - Case tolerance on UUID

    func testParseAcceptsUppercaseUuid() throws {
        let uuid = UUID()
        let url = try XCTUnwrap(URL(
            string: "creatorhubone://session/\(uuid.uuidString.uppercased())",
        ))
        let parsed = try XCTUnwrap(DeepLinkRouter.parse(url))
        XCTAssertEqual(parsed, .openSession(id: uuid))
    }

    // MARK: - Defensive

    func testWrongSchemeReturnsNil() throws {
        let url = try XCTUnwrap(URL(string: "https://example.com/project/abc"))
        XCTAssertNil(DeepLinkRouter.parse(url))
    }

    func testMalformedUuidReturnsNil() throws {
        let url = try XCTUnwrap(URL(
            string: "creatorhubone://session/not-a-uuid",
        ))
        XCTAssertNil(DeepLinkRouter.parse(url))
    }

    func testMissingIdReturnsNil() throws {
        let url = try XCTUnwrap(URL(string: "creatorhubone://project/"))
        XCTAssertNil(DeepLinkRouter.parse(url))
    }

    func testUnknownKindReturnsNil() throws {
        let url = try XCTUnwrap(URL(string: "creatorhubone://invoice/abc"))
        XCTAssertNil(DeepLinkRouter.parse(url))
    }

    func testSchemeOnlyReturnsNil() throws {
        let url = try XCTUnwrap(URL(string: "creatorhubone://"))
        XCTAssertNil(DeepLinkRouter.parse(url))
    }

    // MARK: - JS escape (WebViewAuthBridge)

    func testJsLiteralEscapesBasicChars() {
        let out = WebViewAuthBridge.jsStringLiteral(#"hello "world""#)
        XCTAssertEqual(out, #""hello \"world\"""#)
    }

    func testJsLiteralEscapesBackslash() {
        let out = WebViewAuthBridge.jsStringLiteral(#"a\b"#)
        XCTAssertEqual(out, #""a\\b""#)
    }

    func testJsLiteralEscapesNewlineAndTab() {
        let out = WebViewAuthBridge.jsStringLiteral("line\nnext\ttab")
        XCTAssertEqual(out, "\"line\\nnext\\ttab\"")
    }

    func testJsLiteralEscapesScriptTagOpener() {
        // Critical — lets the injected script survive being embedded
        // inside a <script> tag without premature close.
        let out = WebViewAuthBridge.jsStringLiteral("</script>")
        XCTAssertFalse(out.contains("</script>"),
            "raw </script> must never survive into the injected source")
        XCTAssertTrue(out.contains("\\u003c/script>") || out.contains("\\u003c"),
            "< must be \\u003c-escaped")
    }

    func testJsLiteralIsWrappedInDoubleQuotes() {
        let out = WebViewAuthBridge.jsStringLiteral("plain")
        XCTAssertTrue(out.hasPrefix("\""))
        XCTAssertTrue(out.hasSuffix("\""))
    }

    func testJsLiteralHandlesEmptyString() {
        XCTAssertEqual(WebViewAuthBridge.jsStringLiteral(""), "\"\"")
    }
}
