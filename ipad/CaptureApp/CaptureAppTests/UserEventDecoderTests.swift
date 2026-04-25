import XCTest
@testable import CaptureApp

/// Tests for ``UserEvent.decode``. The decoder is a narrow contract
/// with the backend's ``realtime-user-events`` broadcaster —
/// breaking it silently would mean the iPad goes quiet when the
/// client hearts a photo, the most user-visible realtime event.
/// Covers:
///   - Every known kind decodes into its typed case.
///   - Malformed frames (missing required fields, wrong type
///     wrapper, empty strings) return nil rather than partial data.
///   - Unknown kinds decode to ``.unknown`` so older clients stay
///     connected when the backend adds new event types.
///   - Timestamps with and without fractional seconds both parse
///     (Node emits plain ISO, but any manual test may include ms).
final class UserEventDecoderTests: XCTestCase {

    // MARK: - Known kinds

    func testDecodesAssetHearted() throws {
        let json = """
        {"type":"user_event","event":{"kind":"asset.hearted","assetId":"img-1","sessionId":"sess-1","clientName":"Olav","hearted":true,"timestamp":"2026-04-19T10:00:00Z"},"serverTime":"2026-04-19T10:00:00Z"}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .assetHearted(let a) = event else {
            XCTFail("expected assetHearted, got \(event)")
            return
        }
        XCTAssertEqual(a.assetId, "img-1")
        XCTAssertEqual(a.sessionId, "sess-1")
        XCTAssertEqual(a.clientName, "Olav")
        XCTAssertTrue(a.hearted)
    }

    func testDecodesAssetUnhearted() throws {
        let json = """
        {"type":"user_event","event":{"kind":"asset.hearted","assetId":"img-1","sessionId":"sess-1","clientName":null,"hearted":false,"timestamp":"2026-04-19T10:00:00Z"}}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .assetHearted(let a) = event else {
            XCTFail("wrong case")
            return
        }
        XCTAssertFalse(a.hearted)
        XCTAssertNil(a.clientName)
    }

    func testDecodesAssetCommented() throws {
        let json = """
        {"type":"user_event","event":{"kind":"asset.commented","assetId":"img-1","sessionId":"sess-1","clientName":"Bea","preview":"Elsker denne!","timestamp":"2026-04-19T10:00:00Z"}}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .assetCommented(let a) = event else {
            XCTFail("wrong case")
            return
        }
        XCTAssertEqual(a.preview, "Elsker denne!")
        XCTAssertEqual(a.clientName, "Bea")
    }

    func testDecodesQuoteSigned() throws {
        let json = """
        {"type":"user_event","event":{"kind":"quote.signed","quoteId":"q-7","clientName":"Bea","signerKind":"client","timestamp":"2026-04-19T10:00:00Z"}}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .quoteSigned(let s) = event else {
            XCTFail("wrong case")
            return
        }
        XCTAssertEqual(s.documentId, "q-7")
        XCTAssertEqual(s.signerKind, .client)
    }

    func testDecodesContractSigned() throws {
        let json = """
        {"type":"user_event","event":{"kind":"contract.signed","contractId":"c-3","clientName":null,"signerKind":"photographer","timestamp":"2026-04-19T10:00:00Z"}}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .contractSigned(let s) = event else {
            XCTFail("wrong case")
            return
        }
        XCTAssertEqual(s.documentId, "c-3")
        XCTAssertEqual(s.signerKind, .photographer)
    }

    // MARK: - Slice 3.5: shot lifecycle

    func testDecodesShotCaptured_withAssetId() throws {
        let json = """
        {"type":"user_event","event":{"kind":"shot.captured","projectId":"p-1","shotId":"s-7","capturedAssetId":"a-42","timestamp":"2026-04-25T10:00:00Z"}}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .shotCaptured(let payload) = event else {
            XCTFail("expected .shotCaptured, got \(event)")
            return
        }
        XCTAssertEqual(payload.projectId, "p-1")
        XCTAssertEqual(payload.shotId, "s-7")
        XCTAssertEqual(payload.capturedAssetId, "a-42")
    }

    func testDecodesShotCaptured_withNullAssetId_unlink() throws {
        // Photographer un-linked an asset — payload nulls capturedAssetId.
        // The decoder treats both `null` and missing as "unlinked".
        let json = """
        {"type":"user_event","event":{"kind":"shot.captured","projectId":"p-1","shotId":"s-7","capturedAssetId":null,"timestamp":"2026-04-25T10:00:00Z"}}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .shotCaptured(let payload) = event else {
            XCTFail("expected .shotCaptured")
            return
        }
        XCTAssertNil(payload.capturedAssetId)
    }

    func testDecodesShotCompletionToggled() throws {
        let json = """
        {"type":"user_event","event":{"kind":"shot.completion-toggled","projectId":"p-1","shotId":"s-3","isCompleted":true,"timestamp":"2026-04-25T10:00:00Z"}}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .shotCompletionToggled(let payload) = event else {
            XCTFail("expected .shotCompletionToggled")
            return
        }
        XCTAssertEqual(payload.projectId, "p-1")
        XCTAssertEqual(payload.shotId, "s-3")
        XCTAssertTrue(payload.isCompleted)
    }

    func testShotCaptured_missingProjectId_returnsNil() throws {
        // Defensive: if backend ever forgets to include projectId
        // (regression guard) the decoder should drop the frame rather
        // than crash or silently mis-route. Same posture as the rest
        // of the decoder for missing required fields.
        let json = """
        {"type":"user_event","event":{"kind":"shot.captured","shotId":"s","capturedAssetId":"a","timestamp":"2026-04-25T10:00:00Z"}}
        """
        XCTAssertNil(UserEvent.decode(jsonText: json))
    }

    // MARK: - Unknown + forward-compat

    func testUnknownKindDecodesToUnknown() throws {
        let json = """
        {"type":"user_event","event":{"kind":"project.invited","projectId":"p-1","timestamp":"2026-04-19T10:00:00Z"}}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .unknown(let kind) = event else {
            XCTFail("expected .unknown")
            return
        }
        XCTAssertEqual(kind, "project.invited")
    }

    // MARK: - Filters

    func testConnectionEstablishedFrameIsDropped() {
        let json = """
        {"type":"connection_established","serverTime":"2026-04-19T10:00:00Z"}
        """
        XCTAssertNil(UserEvent.decode(jsonText: json),
            "connection_established is a control frame, not a user event")
    }

    func testNonUserEventTypeIsDropped() {
        let json = """
        {"type":"pong","serverTime":"2026-04-19T10:00:00Z"}
        """
        XCTAssertNil(UserEvent.decode(jsonText: json))
    }

    // MARK: - Malformed

    func testMissingAssetIdReturnsNil() {
        let json = """
        {"type":"user_event","event":{"kind":"asset.hearted","sessionId":"s","hearted":true,"timestamp":"2026-04-19T10:00:00Z"}}
        """
        XCTAssertNil(UserEvent.decode(jsonText: json))
    }

    func testEmptyAssetIdReturnsNil() {
        let json = """
        {"type":"user_event","event":{"kind":"asset.hearted","assetId":"","sessionId":"s","hearted":true,"timestamp":"2026-04-19T10:00:00Z"}}
        """
        XCTAssertNil(UserEvent.decode(jsonText: json))
    }

    func testMissingTimestampReturnsNil() {
        let json = """
        {"type":"user_event","event":{"kind":"asset.hearted","assetId":"a","sessionId":"s","hearted":true}}
        """
        XCTAssertNil(UserEvent.decode(jsonText: json))
    }

    func testUnknownSignerKindReturnsNil() {
        let json = """
        {"type":"user_event","event":{"kind":"quote.signed","quoteId":"q","signerKind":"agent","timestamp":"2026-04-19T10:00:00Z"}}
        """
        XCTAssertNil(UserEvent.decode(jsonText: json))
    }

    func testGarbageJsonReturnsNil() {
        XCTAssertNil(UserEvent.decode(jsonText: "{not-json"))
    }

    func testEmptyStringReturnsNil() {
        XCTAssertNil(UserEvent.decode(jsonText: ""))
    }

    // MARK: - Timestamp tolerance

    func testTimestampWithFractionalSecondsParses() throws {
        let json = """
        {"type":"user_event","event":{"kind":"asset.hearted","assetId":"a","sessionId":"s","hearted":true,"timestamp":"2026-04-19T10:00:00.123Z"}}
        """
        XCTAssertNotNil(UserEvent.decode(jsonText: json))
    }

    func testTimestampWithoutFractionalSecondsParses() throws {
        // This is the shape Node's ``new Date().toISOString()`` emits.
        let json = """
        {"type":"user_event","event":{"kind":"asset.hearted","assetId":"a","sessionId":"s","hearted":true,"timestamp":"2026-04-19T10:00:00Z"}}
        """
        XCTAssertNotNil(UserEvent.decode(jsonText: json))
    }

    // MARK: - Empty-string clientName → nil

    func testEmptyClientNameDecodesToNil() throws {
        let json = """
        {"type":"user_event","event":{"kind":"asset.hearted","assetId":"a","sessionId":"s","clientName":"","hearted":true,"timestamp":"2026-04-19T10:00:00Z"}}
        """
        let event = try XCTUnwrap(UserEvent.decode(jsonText: json))
        guard case .assetHearted(let a) = event else {
            XCTFail("wrong case")
            return
        }
        XCTAssertNil(a.clientName,
            "empty string from the web form must surface as nil so the UI falls back to 'klienten'")
    }
}
