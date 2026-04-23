import XCTest
@testable import CaptureApp

/// Tests for the native side of the Apple Pencil ↔ WebView
/// signature bridge. Focused on the two pure-logic surfaces:
///   - ``decode`` (JS message body → typed request). Rejects
///     malformed payloads so a rogue script can't crash the sheet
///     presenter with a nil callbackId.
///   - ``jsString`` (native value → JS literal). Same escape contract
///     as ``WebViewAuthBridge.jsStringLiteral``; double-checking it
///     here keeps the bridge safe if someone refactors one without
///     the other.
final class PencilBridgeTests: XCTestCase {

    // MARK: - decode

    func testDecodeFullPayload() throws {
        let body: [String: Any] = [
            "callbackId": "cb-123",
            "title": "Signer tilbud",
            "prompt": "Fotografens godkjenning",
        ]
        let request = try XCTUnwrap(PencilBridge.decode(body))
        XCTAssertEqual(request.callbackId, "cb-123")
        XCTAssertEqual(request.title, "Signer tilbud")
        XCTAssertEqual(request.prompt, "Fotografens godkjenning")
    }

    func testDecodeDefaultsTitleWhenMissing() throws {
        let request = try XCTUnwrap(PencilBridge.decode([
            "callbackId": "cb-1",
        ]))
        XCTAssertEqual(request.title, "Signatur")
        XCTAssertNil(request.prompt)
    }

    func testDecodeDefaultsTitleWhenEmpty() throws {
        let request = try XCTUnwrap(PencilBridge.decode([
            "callbackId": "cb-1",
            "title": "",
        ]))
        XCTAssertEqual(request.title, "Signatur",
            "empty title must fall back to the default")
    }

    func testDecodeTreatsEmptyPromptAsNil() throws {
        let request = try XCTUnwrap(PencilBridge.decode([
            "callbackId": "cb-1",
            "prompt": "",
        ]))
        XCTAssertNil(request.prompt)
    }

    func testDecodeRejectsNonDictionary() {
        XCTAssertNil(PencilBridge.decode("raw-string"))
        XCTAssertNil(PencilBridge.decode([1, 2, 3]))
        XCTAssertNil(PencilBridge.decode(NSNull()))
    }

    func testDecodeRejectsMissingCallbackId() {
        XCTAssertNil(PencilBridge.decode(["title": "Foo"]))
    }

    func testDecodeRejectsEmptyCallbackId() {
        XCTAssertNil(PencilBridge.decode([
            "callbackId": "",
            "title": "Foo",
        ]))
    }

    func testDecodeRejectsNonStringCallbackId() {
        XCTAssertNil(PencilBridge.decode([
            "callbackId": 42,
            "title": "Foo",
        ]))
    }

    // MARK: - jsString

    func testJsStringWrapsInDoubleQuotes() {
        let out = PencilBridge.jsString("plain")
        XCTAssertEqual(out, "\"plain\"")
    }

    func testJsStringEscapesDoubleQuote() {
        let out = PencilBridge.jsString("say \"hi\"")
        XCTAssertEqual(out, "\"say \\\"hi\\\"\"")
    }

    func testJsStringEscapesBackslash() {
        let out = PencilBridge.jsString("a\\b")
        XCTAssertEqual(out, "\"a\\\\b\"")
    }

    func testJsStringEscapesNewlineAndTab() {
        let out = PencilBridge.jsString("a\nb\tc")
        XCTAssertEqual(out, "\"a\\nb\\tc\"")
    }

    func testJsStringEscapesAngleBracketForScriptSafety() {
        // Critical: `</script>` inside an injected source would
        // close the <script> tag early. We defensively escape the
        // opening angle bracket so the bridge stays safe even if a
        // page embeds the injected script in a DOM `<script>` node.
        let out = PencilBridge.jsString("</script>")
        XCTAssertFalse(out.contains("</script>"),
            "raw </script> must not survive jsString")
        XCTAssertTrue(out.contains("\\u003c/script>"))
    }

    func testJsStringHandlesEmpty() {
        XCTAssertEqual(PencilBridge.jsString(""), "\"\"")
    }

    // MARK: - shim source shape

    func testShimExposesRequestSignature() {
        // Light smoke test — verifies the shim defines the JS API
        // our web form relies on. A rename here would silently break
        // QuoteGeneratorModal's signature button; catching it in a
        // string search is cheaper than full JS evaluation.
        XCTAssertTrue(PencilBridge.shimSource.contains("window.CreatorHubOne"))
        XCTAssertTrue(PencilBridge.shimSource.contains("requestSignature"))
        XCTAssertTrue(PencilBridge.shimSource.contains("isIPadNative"))
        XCTAssertTrue(PencilBridge.shimSource.contains("__creatorhubOnePencilResolve"))
        XCTAssertTrue(PencilBridge.shimSource.contains("pencilBridge"))
    }

    func testShimGuardsAgainstDoubleInstall() {
        // Re-running the shim must be a no-op or the page-side
        // pending-callback map gets reset mid-request.
        XCTAssertTrue(
            PencilBridge.shimSource.contains("__pencilReady"),
            "shim needs an idempotency guard",
        )
    }
}
