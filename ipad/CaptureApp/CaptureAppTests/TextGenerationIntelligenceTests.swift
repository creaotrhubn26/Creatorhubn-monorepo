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
}
