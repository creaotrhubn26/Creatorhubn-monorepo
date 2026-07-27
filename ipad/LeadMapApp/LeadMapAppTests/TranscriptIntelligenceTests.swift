// TranscriptIntelligenceTests.swift
//
// Tier 0-verifisering (jf. docs/apple-intelligence-vision-integrasjonsplan §9):
// rute-/fallback-logikken i TranscriptIntelligence testes deterministisk med
// injiserte mocks — INGEN Foundation Models-modell, INGEN nettverk. Kjørbart
// i CI på Xcode 26.6 / iOS 26.5.

import XCTest
@testable import LeadMapApp

final class TranscriptIntelligenceTests: XCTestCase {

    // MARK: - Testdoubler

    private struct MockChecker: OnDeviceAvailabilityChecking {
        let availability: OnDeviceModelAvailability
    }

    private struct FakeAnalyzer: OnDeviceTranscriptAnalyzing {
        let result: TranscriptAnalysis?
        let shouldThrow: Bool
        struct Boom: Error {}
        func analyze(transcript: String, leadName: String) async throws -> TranscriptAnalysis {
            if shouldThrow { throw Boom() }
            return result ?? makeAnalysis("EMPTY")
        }
    }

    // MARK: - Helpers

    private func makeIntel(
        availability: OnDeviceModelAvailability,
        onDevice: OnDeviceTranscriptAnalyzing?,
        maxChars: Int = 6000
    ) -> TranscriptIntelligence {
        let backendMarker = makeAnalysis("BACKEND")
        return TranscriptIntelligence(
            availability: MockChecker(availability: availability),
            onDevice: onDevice,
            maxCharsForOnDevice: maxChars,
            backend: { _, _ in backendMarker }
        )
    }

    private func onDeviceAnalyzer() -> FakeAnalyzer {
        FakeAnalyzer(result: makeAnalysis("ONDEVICE"), shouldThrow: false)
    }

    // MARK: - Tester

    func testAvailableShortTranscript_usesOnDevice() async throws {
        let intel = makeIntel(availability: .available, onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "kort besøksnotat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .onDevice)
        XCTAssertEqual(r.analysis.resolved_text, "ONDEVICE")
    }

    func testDeviceNotEligible_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.deviceNotEligible), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
        XCTAssertEqual(r.analysis.resolved_text, "BACKEND")
    }

    func testAppleIntelligenceNotEnabled_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.appleIntelligenceNotEnabled), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testModelNotReady_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.modelNotReady), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testUnsupportedLanguage_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.unsupportedLanguage), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testOSUnsupported_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.osUnsupported), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testAvailableButTooLong_routesToBackend() async throws {
        let intel = makeIntel(availability: .available, onDevice: onDeviceAnalyzer(), maxChars: 10)
        let long = String(repeating: "a", count: 50)
        let r = try await intel.analyze(transcript: long, leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testOnDeviceThrows_fallsBackToBackend() async throws {
        let throwing = FakeAnalyzer(result: nil, shouldThrow: true)
        let intel = makeIntel(availability: .available, onDevice: throwing)
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
        XCTAssertEqual(r.analysis.resolved_text, "BACKEND")
    }

    func testNoOnDeviceStack_usesBackend() async throws {
        let intel = makeIntel(availability: .available, onDevice: nil)
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testPrefersOnDevice_matrix() {
        let withDevice = makeIntel(availability: .available, onDevice: onDeviceAnalyzer(), maxChars: 100)
        XCTAssertTrue(withDevice.prefersOnDevice(transcriptLength: 50))
        XCTAssertFalse(withDevice.prefersOnDevice(transcriptLength: 200))   // for langt

        let unavailable = makeIntel(availability: .unavailable(.modelNotReady), onDevice: onDeviceAnalyzer())
        XCTAssertFalse(unavailable.prefersOnDevice(transcriptLength: 10))

        let noStack = makeIntel(availability: .available, onDevice: nil)
        XCTAssertFalse(noStack.prefersOnDevice(transcriptLength: 10))
    }
}

// Fri hjelpefunksjon (utenfor klassen så testdoublene kan bruke den).
private func makeAnalysis(_ marker: String) -> TranscriptAnalysis {
    TranscriptAnalysis(
        resolved_text: marker,
        action_items: [],
        follow_up_date: nil,
        calendar_suggestion: nil,
        sentiment: "nøytral"
    )
}
