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
    /// Motor som strømmer kumulative snapshots (som Foundation Models gjør).
    private struct StreamingFakeGen: TextGenerating {
        let snapshots: [String]
        func generate(_ prompt: TextGenPrompt) async throws -> String { snapshots.last ?? "" }
        func stream(_ prompt: TextGenPrompt) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { continuation in
                for s in snapshots { continuation.yield(s) }
                continuation.finish()
            }
        }
    }

    private func collect(_ stream: AsyncThrowingStream<String, Error>) async throws -> [String] {
        var out: [String] = []
        for try await v in stream { out.append(v) }
        return out
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

    // MARK: - #5 Streaming (live-progresjon)

    /// Motor uten egen `stream` → default-fallback gir ETT (ferdig) snapshot.
    func testDefaultStreamFallbackYieldsFinalOnce() async throws {
        let intel = TextGenerationIntelligence(
            availability: MockChecker(availability: .available), generator: FakeGen())
        let out = try await collect(intel.stream(.galleryDescription(project: "Bryllup", notes: "sol")))
        XCTAssertEqual(out, ["utkast"])
    }

    /// Strømmende motor → fasaden viderefører alle kumulative snapshots i rekkefølge.
    func testStreamDelegatesCumulativeSnapshots() async throws {
        let snaps = ["Brud", "Brudeportrett", "Brudeportrett\nFørste dans"]
        let intel = TextGenerationIntelligence(
            availability: MockChecker(availability: .available), generator: StreamingFakeGen(snapshots: snaps))
        let out = try await collect(intel.stream(.shotListFromBrief(brief: "bryllup i hagen")))
        XCTAssertEqual(out, snaps)
    }

    /// Utilgjengelig motor → strømmen KASTER (samme grunn som `generate`), ingen snapshots.
    func testStreamThrowsWhenUnavailable() async {
        let intel = TextGenerationIntelligence(
            availability: MockChecker(availability: .unavailable(.appleIntelligenceNotEnabled)),
            generator: StreamingFakeGen(snapshots: ["x"]))
        do {
            _ = try await collect(intel.stream(.shotListFromBrief(brief: "b")))
            XCTFail("forventet kast")
        } catch let failure as TextGenerationIntelligence.Failure {
            XCTAssertEqual(failure, .unavailable(.appleIntelligenceNotEnabled))
        } catch { XCTFail("feil feiltype: \(error)") }
    }

    /// Inkrementell parsing: siste snapshot gir den ferdige, dedupede shot-lista
    /// (samme kontrakt UI-et bruker for å vise shots dukke opp live).
    func testStreamingSnapshotsParseToFinalShotList() async throws {
        let snaps = ["- Brudeportrett", "- Brudeportrett\n- Første dans\n- Brudeportrett"]
        let intel = TextGenerationIntelligence(
            availability: MockChecker(availability: .available), generator: StreamingFakeGen(snapshots: snaps))
        var last: [String] = []
        for try await snap in intel.stream(.shotListFromBrief(brief: "b")) {
            last = ShotListBriefParser.scenes(from: snap)
        }
        XCTAssertEqual(last, ["Brudeportrett", "Første dans"])
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
