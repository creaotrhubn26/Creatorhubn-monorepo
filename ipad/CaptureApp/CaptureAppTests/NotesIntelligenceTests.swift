// NotesIntelligenceTests.swift
//
// Tier 0-verifisering: rute-/tilgjengelighetslogikken + foto-videreføring i
// NotesIntelligence, og EXIF-formatering i PhotoMetadata — deterministisk,
// uten modell/nettverk.

import XCTest
@testable import CaptureApp

final class NotesIntelligenceTests: XCTestCase {

    private struct MockChecker: NoteAvailabilityChecking {
        let availability: NoteModelAvailability
    }

    private struct FakeGenerator: NoteInsightGenerating {
        let insights: NoteInsights
        func generate(from body: String, photo: PhotoMetadata?) async throws -> NoteInsights {
            // Ekko foto-tilstedeværelse så vi kan verifisere at den sendes ned.
            NoteInsights(
                summary: photo == nil ? insights.summary : insights.summary + " [foto]",
                tasks: insights.tasks
            )
        }
    }

    private var sample: NoteInsights { NoteInsights(summary: "Oppsummering", tasks: ["Følg opp"]) }

    private func make(_ a: NoteModelAvailability, gen: NoteInsightGenerating?) -> NotesIntelligence {
        NotesIntelligence(availability: MockChecker(availability: a), generator: gen)
    }

    func testAvailableReturnsInsights() async throws {
        let r = try await make(.available, gen: FakeGenerator(insights: sample)).insights(for: "notat")
        XCTAssertEqual(r.summary, "Oppsummering")
        XCTAssertEqual(r.tasks, ["Følg opp"])
    }

    func testPhotoIsPassedToGenerator() async throws {
        let photo = PhotoMetadata(iso: 3200)
        let r = try await make(.available, gen: FakeGenerator(insights: sample)).insights(for: "notat", photo: photo)
        XCTAssertTrue(r.summary.contains("[foto]"))
    }

    func testEmptyNoteThrows() async {
        await assertThrows(make(.available, gen: FakeGenerator(insights: sample)), body: "   ", expected: .emptyNote)
    }

    func testUnavailableThrowsReason() async {
        await assertThrows(
            make(.unavailable(.appleIntelligenceNotEnabled), gen: FakeGenerator(insights: sample)),
            body: "notat", expected: .unavailable(.appleIntelligenceNotEnabled))
    }

    func testNoGeneratorThrowsOSUnsupported() async {
        await assertThrows(make(.available, gen: nil), body: "notat", expected: .unavailable(.osUnsupported))
    }

    func testIsAvailableMatrix() {
        XCTAssertTrue(make(.available, gen: FakeGenerator(insights: sample)).isAvailable)
        XCTAssertFalse(make(.available, gen: nil).isAvailable)
        XCTAssertFalse(make(.unavailable(.modelNotReady), gen: FakeGenerator(insights: sample)).isAvailable)
    }

    private func assertThrows(
        _ intel: NotesIntelligence, body: String,
        expected: NotesIntelligence.Failure,
        file: StaticString = #filePath, line: UInt = #line
    ) async {
        do {
            _ = try await intel.insights(for: body)
            XCTFail("forventet kast", file: file, line: line)
        } catch let failure as NotesIntelligence.Failure {
            XCTAssertEqual(failure, expected, file: file, line: line)
        } catch {
            XCTFail("feil feiltype: \(error)", file: file, line: line)
        }
    }
}

final class PhotoMetadataTests: XCTestCase {
    func testSummaryLine() {
        let m = PhotoMetadata(
            fileName: "IMG_2043.CR3", cameraModel: "Canon EOS R5",
            lens: "RF50mm F1.2", focalLengthMM: 50, aperture: 1.4,
            shutter: "1/250", iso: 400)
        let s = m.summaryLine
        XCTAssertTrue(s.contains("IMG_2043.CR3"))
        XCTAssertTrue(s.contains("Canon EOS R5"))
        XCTAssertTrue(s.contains("50mm"))
        XCTAssertTrue(s.contains("f/1.4"))
        XCTAssertTrue(s.contains("1/250s"))
        XCTAssertTrue(s.contains("ISO 400"))
    }

    func testFormatShutter() {
        XCTAssertEqual(PhotoMetadataExtractor.formatShutter(0.004), "1/250")
        XCTAssertEqual(PhotoMetadataExtractor.formatShutter(2), "2")
    }

    func testIsEmpty() {
        XCTAssertTrue(PhotoMetadata().isEmpty)
        XCTAssertFalse(PhotoMetadata(iso: 100).isEmpty)
    }
}
