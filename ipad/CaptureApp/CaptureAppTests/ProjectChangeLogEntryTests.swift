import XCTest
@testable import CaptureApp

/// Tests for the iPad side of the project change-log contract. Two
/// surfaces:
///   - ``ProjectChangeLogEntry.decode`` — parses the JSON the backend
///     ``GET /api/projects/:id/change-log`` endpoint returns.
///   - ``ProjectChangeLogHumanizer`` — renders a row into the one-
///     line string the timeline shows. Mirrors the server-side
///     ``humanizeChangeLogEntry`` so notifications sent before the
///     iPad reconnects match the timeline text when it does.
final class ProjectChangeLogEntryTests: XCTestCase {

    // MARK: - Decoder

    func testDecodesListResponse() {
        let json = """
        {"entries":[
          {"id":"e1","projectId":"p1","kind":"asset.hearted","actorKind":"client","actorLabel":"Olav","payload":{"hearted":true,"assetId":"a1"},"createdAt":"2026-04-19T10:00:00Z"},
          {"id":"e2","projectId":"p1","kind":"quote.signed","actorKind":"client","actorLabel":null,"payload":{},"createdAt":"2026-04-19T10:05:00Z"}
        ]}
        """.data(using: .utf8)!
        let entries = ProjectChangeLogEntry.decode(listJSON: json)
        XCTAssertEqual(entries.count, 2)
        XCTAssertEqual(entries[0].id, "e1")
        XCTAssertEqual(entries[0].kind, .assetHearted)
        XCTAssertEqual(entries[0].actorLabel, "Olav")
        XCTAssertEqual(entries[1].kind, .quoteSigned)
        XCTAssertNil(entries[1].actorLabel)
    }

    func testEmptyEntriesArrayYieldsEmptyList() {
        let json = "{\"entries\":[]}".data(using: .utf8)!
        XCTAssertEqual(ProjectChangeLogEntry.decode(listJSON: json).count, 0)
    }

    func testMissingEntriesKeyYieldsEmpty() {
        let json = "{}".data(using: .utf8)!
        XCTAssertEqual(ProjectChangeLogEntry.decode(listJSON: json).count, 0)
    }

    func testGarbageJSONYieldsEmpty() {
        XCTAssertEqual(
            ProjectChangeLogEntry.decode(listJSON: Data("not-json".utf8)).count,
            0,
        )
    }

    func testUnknownKindIsDropped() {
        let json = """
        {"entries":[
          {"id":"e1","projectId":"p1","kind":"asset.hearted","actorKind":"client","payload":{"hearted":true},"createdAt":"2026-04-19T10:00:00Z"},
          {"id":"e2","projectId":"p1","kind":"project.invited","actorKind":"client","payload":{},"createdAt":"2026-04-19T10:05:00Z"}
        ]}
        """.data(using: .utf8)!
        let entries = ProjectChangeLogEntry.decode(listJSON: json)
        XCTAssertEqual(entries.count, 1,
            "unknown kinds must be skipped, not surfaced as garbled rows")
        XCTAssertEqual(entries[0].kind, .assetHearted)
    }

    func testEmptyActorLabelDecodesToNil() {
        let json = """
        {"entries":[
          {"id":"e1","projectId":"p1","kind":"asset.hearted","actorKind":"client","actorLabel":"","payload":{"hearted":true},"createdAt":"2026-04-19T10:00:00Z"}
        ]}
        """.data(using: .utf8)!
        let entries = ProjectChangeLogEntry.decode(listJSON: json)
        XCTAssertNil(entries[0].actorLabel)
    }

    func testPayloadPreservesScalars() {
        let json = """
        {"entries":[
          {"id":"e1","projectId":"p1","kind":"asset.commented","actorKind":"client","payload":{"preview":"hei","assetId":"a1","rating":5,"matched":true,"meta":null},"createdAt":"2026-04-19T10:00:00Z"}
        ]}
        """.data(using: .utf8)!
        let entry = ProjectChangeLogEntry.decode(listJSON: json).first!
        XCTAssertEqual(entry.payload["preview"], .string("hei"))
        XCTAssertEqual(entry.payload["assetId"], .string("a1"))
        XCTAssertEqual(entry.payload["rating"], .int(5))
        XCTAssertEqual(entry.payload["matched"], .bool(true))
        XCTAssertEqual(entry.payload["meta"], .null)
    }

    // MARK: - Humanizer (iPad side parity with server)

    private func entry(
        kind: ProjectChangeLogEntry.Kind,
        actorKind: ProjectChangeLogEntry.ActorKind = .client,
        actorLabel: String? = nil,
        payload: [String: ProjectChangeLogEntry.AnyCodableValue] = [:],
    ) -> ProjectChangeLogEntry {
        ProjectChangeLogEntry(
            id: "e",
            projectId: "p",
            kind: kind,
            actorKind: actorKind,
            actorLabel: actorLabel,
            payload: payload,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
        )
    }

    func testHumanizerNamesTheClientForHearts() {
        let out = ProjectChangeLogHumanizer.humanize(
            entry(kind: .assetHearted, actorLabel: "Olav", payload: ["hearted": .bool(true)]),
        )
        XCTAssertEqual(out, "Olav hjertet et bilde")
    }

    func testHumanizerDistinguishesUnheart() {
        let out = ProjectChangeLogHumanizer.humanize(
            entry(kind: .assetHearted, actorLabel: "Olav", payload: ["hearted": .bool(false)]),
        )
        XCTAssertEqual(out, "Olav fjernet hjerte fra et bilde")
    }

    func testHumanizerDefaultsActorToKlienten() {
        let out = ProjectChangeLogHumanizer.humanize(
            entry(kind: .assetHearted, actorKind: .client, payload: ["hearted": .bool(true)]),
        )
        XCTAssertEqual(out, "Klienten hjertet et bilde")
    }

    func testHumanizerDefaultsPhotographerActor() {
        let out = ProjectChangeLogHumanizer.humanize(
            entry(kind: .contractSigned, actorKind: .photographer),
        )
        XCTAssertEqual(out, "Fotografen signerte kontrakten")
    }

    func testHumanizerQuotesComment() {
        let out = ProjectChangeLogHumanizer.humanize(
            entry(kind: .assetCommented, actorLabel: "Bea",
                  payload: ["preview": .string("Elsker denne!")]),
        )
        XCTAssertEqual(out, "Bea kommenterte: \"Elsker denne!\"")
    }

    func testHumanizerTruncatesLongComments() {
        let long = String(repeating: "a", count: 200)
        let out = ProjectChangeLogHumanizer.humanize(
            entry(kind: .assetCommented, actorLabel: "Bea",
                  payload: ["preview": .string(long)]),
        )
        XCTAssertTrue(out.hasSuffix("…\""),
            "long comment must be truncated with an ellipsis")
    }

    func testHumanizerFallsBackForEmptyComment() {
        let out = ProjectChangeLogHumanizer.humanize(
            entry(kind: .assetCommented, actorLabel: "Bea",
                  payload: ["preview": .string("   ")]),
        )
        XCTAssertEqual(out, "Bea la igjen en kommentar")
    }

    func testHumanizerTreatsMissingHeartedFlagAsTrue() {
        let out = ProjectChangeLogHumanizer.humanize(
            entry(kind: .assetHearted, actorLabel: "Olav", payload: [:]),
        )
        XCTAssertEqual(out, "Olav hjertet et bilde",
            "legacy rows without a hearted flag default to positive")
    }

    func testHumanizerQuoteSigned() {
        let out = ProjectChangeLogHumanizer.humanize(
            entry(kind: .quoteSigned, actorLabel: "Bea"),
        )
        XCTAssertEqual(out, "Bea signerte tilbudet")
    }
}
