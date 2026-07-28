// TextGenerationIntelligenceTests.swift
//
// Tier 0: availability-ruting for on-device tekst-generering.

import XCTest
@testable import CaptureApp

final class TextGenerationIntelligenceTests: XCTestCase {
    private struct MockChecker: NoteAvailabilityChecking {
        let availability: NoteModelAvailability
    }
    private struct FakeGen: TextGenerating {
        func generate(_ prompt: TextGenPrompt) async throws -> String { "utkast" }
    }

    func testAvailableGenerates() async throws {
        let intel = TextGenerationIntelligence(
            availability: MockChecker(availability: .available), generator: FakeGen())
        let out = try await intel.generate(.emailDraft(recipient: "Kari", subject: "Bilder", notes: "levering fredag"))
        XCTAssertEqual(out, "utkast")
        XCTAssertTrue(intel.isAvailable)
    }

    func testUnavailableThrowsReason() async {
        let intel = TextGenerationIntelligence(
            availability: MockChecker(availability: .unavailable(.deviceNotEligible)), generator: FakeGen())
        XCTAssertFalse(intel.isAvailable)
        do {
            _ = try await intel.generate(.galleryDescription(project: "Bryllup", notes: "sommer"))
            XCTFail("forventet kast")
        } catch let failure as TextGenerationIntelligence.Failure {
            XCTAssertEqual(failure, .unavailable(.deviceNotEligible))
        } catch { XCTFail("feil feiltype: \(error)") }
    }

    func testNoGeneratorThrowsOSUnsupported() async {
        let intel = TextGenerationIntelligence(
            availability: MockChecker(availability: .available), generator: nil)
        do {
            _ = try await intel.generate(.emailDraft(recipient: "x", subject: "y", notes: "z"))
            XCTFail("forventet kast")
        } catch let failure as TextGenerationIntelligence.Failure {
            XCTAssertEqual(failure, .unavailable(.osUnsupported))
        } catch { XCTFail("feil feiltype: \(error)") }
    }

    // MARK: - #9 ShotListBriefParser (dedup + tid-strip)

    func testBriefParserStripsBulletsAndNumbering() {
        let raw = "- Brudeportrett i hagen\n1. Detaljer: ringer\n* Første dans"
        XCTAssertEqual(ShotListBriefParser.scenes(from: raw),
                       ["Brudeportrett i hagen", "Detaljer: ringer", "Første dans"])
    }

    func testBriefParserStripsLeadingTimeAndDedupes() {
        let raw = """
        16:00 Brudepar-portretter i hagen
        16:10 Brudepar-portretter i hagen
        16:20 Brudepar-portretter i hagen
        14:30 Vielse i kapellet
        """
        XCTAssertEqual(ShotListBriefParser.scenes(from: raw),
                       ["Brudepar-portretter i hagen", "Vielse i kapellet"])
    }

    func testBriefParserCapsAt24() {
        let raw = (1...40).map { "Unik scene nummer \($0)" }.joined(separator: "\n")
        XCTAssertEqual(ShotListBriefParser.scenes(from: raw).count, 24)
    }

    func testBriefParserKeepsNonLeadingColon() {
        XCTAssertEqual(ShotListBriefParser.scenes(from: "Detaljer: ringer og bukett"),
                       ["Detaljer: ringer og bukett"])
    }
}
