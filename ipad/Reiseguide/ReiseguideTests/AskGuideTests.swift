// AskGuideTests.swift
//
// «Spør guiden» (pakke 3): instruksjonsbyggingen (grunnlaget i guideteksten),
// availability-fasaden og tilstanden i arket, med falske motorer i stedet for
// Foundation Models.

import XCTest
@testable import Reiseguide

private struct FixedChecker: AskGuideAvailabilityChecking {
    let result: AskGuideAvailability
    func availability(for language: String) -> AskGuideAvailability { result }
}

private struct StubError: Error {}

private struct StubGenerator: GuideAnswerGenerating {
    let reply: String?
    func answer(instructions: String, prompt: String) async throws -> String {
        guard let reply else { throw StubError() }
        return reply
    }
}

final class AskGuideTests: XCTestCase {
    private func akershus() throws -> GuidePOI {
        let bundle = Bundle(for: AskGuideTests.self)
        let url = try XCTUnwrap(bundle.url(forResource: "area-nb", withExtension: "json"))
        let response = try JSONDecoder().decode(AreaResponse.self, from: Data(contentsOf: url))
        return try XCTUnwrap(response.pois.first { $0.slug == "akershus-festning" })
    }

    private func intelligence(_ availability: AskGuideAvailability, answer: String?) -> AskGuideIntelligence {
        AskGuideIntelligence(checker: FixedChecker(result: availability), generator: StubGenerator(reply: answer))
    }

    // MARK: - Grunnlag

    func testInstructionsContainAllGuideTextInOrder() throws {
        let poi = try akershus()
        let instructions = AskGuideGrounding.instructions(poi: poi, answerLanguage: "nb")
        XCTAssertTrue(instructions.contains("Title: Akershus festning"))
        XCTAssertTrue(instructions.contains("Summary: \(poi.summary ?? "")"))
        XCTAssertTrue(instructions.contains("- Festningsområdet: Åpent daglig 06–21, gratis"))
        let chapters = try XCTUnwrap(poi.variants.narration?.chapters)
        XCTAssertEqual(chapters.count, 2)
        for chapter in chapters {
            XCTAssertTrue(instructions.contains(chapter.scriptText), "kapittel \(chapter.no)")
        }
        let description0 = try XCTUnwrap(poi.variants.audioDescription?.chapters.first?.scriptText)
        XCTAssertTrue(instructions.contains(description0))
        // Rekkefølge: praktisk info før fortellingen, synstolking sist (kappes først).
        let practical = try XCTUnwrap(instructions.range(of: "Practical information:"))
        let narration = try XCTUnwrap(instructions.range(of: "Narration, chapter 1"))
        let description = try XCTUnwrap(instructions.range(of: "Audio description"))
        XCTAssertLessThan(practical.lowerBound, narration.lowerBound)
        XCTAssertLessThan(narration.lowerBound, description.lowerBound)
    }

    func testInstructionsDemandGroundingLanguageAndLength() throws {
        let poi = try akershus()
        let norwegian = AskGuideGrounding.instructions(poi: poi, answerLanguage: "nb")
        XCTAssertTrue(norwegian.contains("Answer ONLY from the GUIDE TEXT"))
        XCTAssertTrue(norwegian.contains("\"Det står ikke i guideteksten.\""))
        XCTAssertTrue(norwegian.contains("Answer in Norwegian Bokmål, in 2 to 4 short sentences"))

        let english = AskGuideGrounding.instructions(poi: poi, answerLanguage: "en-GB")
        XCTAssertTrue(english.contains("\"The guide text doesn't say.\""))
        XCTAssertTrue(english.contains("Answer in English"))

        let danish = AskGuideGrounding.instructions(poi: poi, answerLanguage: "da-DK")
        XCTAssertTrue(danish.contains("\"Det fremgår ikke af guideteksten.\""))
        XCTAssertTrue(danish.contains("Answer in Danish"))

        let german = AskGuideGrounding.instructions(poi: poi, answerLanguage: "de")
        XCTAssertTrue(german.contains("that the guide text does not say"))
        XCTAssertTrue(german.contains("Answer in German"))
    }

    func testSourceTextIsCappedOnASentence() {
        let long = Array(repeating: "Dette er en setning.", count: 800).joined(separator: " ")
        let capped = AskGuideGrounding.truncate(long, limit: 1_000)
        XCTAssertLessThanOrEqual(capped.count, 1_002)
        XCTAssertTrue(capped.hasSuffix(". …"))
        XCTAssertEqual(AskGuideGrounding.truncate("Kort.", limit: 1_000), "Kort.")
    }

    func testQuestionNormalization() {
        XCTAssertNil(AskGuideGrounding.normalizedQuestion("  \n "))
        XCTAssertEqual(AskGuideGrounding.normalizedQuestion("  Hvor \n gammelt   er det? "), "Hvor gammelt er det?")
        let long = String(repeating: "a", count: 500)
        XCTAssertEqual(AskGuideGrounding.normalizedQuestion(long)?.count, AskGuideGrounding.maxQuestionCharacters)
        XCTAssertEqual(AskGuideGrounding.prompt(question: "Hvem?"), "Visitor's question: Hvem?")
    }

    func testLanguageCodesTreatNorwegianAsOne() {
        XCTAssertEqual(AskGuideGrounding.languageCodes(for: "nb-NO"), ["nb", "nn", "no"])
        XCTAssertEqual(AskGuideGrounding.languageCodes(for: "EN"), ["en"])
        XCTAssertEqual(AskGuideGrounding.primaryLanguage("en-GB"), "en")
    }

    func testHasContent() throws {
        let poi = try akershus()
        XCTAssertTrue(AskGuideGrounding.hasContent(poi))
        let empty = GuidePOI(
            id: "p", slug: "p", areaId: "a", categoryId: nil, lat: 0, lng: 0, triggerRadiusM: 40, priority: 0,
            sortOrder: 0, freePreview: true, heroImageUrl: nil, heroImageAlt: nil, title: "Tom", subtitle: nil,
            summary: nil, locationLabel: nil, practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: nil, available: ["nb"]),
            variants: GuideVariants(narration: nil, audioDescription: nil),
            quiz: nil, rating: nil, shareUrl: nil
        )
        XCTAssertFalse(AskGuideGrounding.hasContent(empty))
    }

    // MARK: - Fasade

    func testAvailabilityAndSettingsMessages() {
        XCTAssertTrue(intelligence(.available, answer: "x").isAvailable(for: "nb"))
        XCTAssertFalse(intelligence(.unavailable(.appleIntelligenceNotEnabled), answer: "x").isAvailable(for: "nb"))
        let noGenerator = AskGuideIntelligence(checker: FixedChecker(result: .available), generator: nil)
        XCTAssertEqual(noGenerator.availability(for: "nb"), .unavailable(.osUnsupported))
        XCTAssertEqual(UnsupportedOSAskGuideChecker().availability(for: "nb"), .unavailable(.osUnsupported))
        XCTAssertEqual(AskGuideAvailability.Reason.modelNotReady.messageKey, "askGuide.unavailable.notReady")
    }

    func testAnswerIsTrimmedAndEmptyAnswerFails() async throws {
        let text = try await intelligence(.available, answer: "  Ni ganger.\n").answer(instructions: "i", prompt: "p", language: "nb")
        XCTAssertEqual(text, "Ni ganger.")
        do {
            _ = try await intelligence(.available, answer: "  ").answer(instructions: "i", prompt: "p", language: "nb")
            XCTFail("tomt svar skal feile")
        } catch let failure as AskGuideIntelligence.Failure {
            XCTAssertEqual(failure, .emptyAnswer)
        }
        do {
            _ = try await intelligence(.unavailable(.deviceNotEligible), answer: "x").answer(instructions: "i", prompt: "p", language: "nb")
            XCTFail("utilgjengelig skal feile")
        } catch let failure as AskGuideIntelligence.Failure {
            XCTAssertEqual(failure, .unavailable(.deviceNotEligible))
        }
    }

    // MARK: - Arket

    @MainActor
    func testSessionAnswersNormalizedQuestion() async throws {
        let poi = try akershus()
        let session = AskGuideSession(poi: poi, language: "nb", intelligence: intelligence(.available, answer: "Ni ganger."))
        session.question = "  Hvor mange  beleiringer? "
        session.ask()
        XCTAssertEqual(session.phase, .thinking)
        XCTAssertTrue(session.isThinking)
        await session.currentTask?.value
        XCTAssertEqual(session.phase, .answered("Ni ganger."))
        XCTAssertEqual(session.askedQuestion, "Hvor mange beleiringer?")
        XCTAssertEqual(session.resultCount, 1)
    }

    @MainActor
    func testSessionSuggestionOverridesField() async throws {
        let poi = try akershus()
        let session = AskGuideSession(poi: poi, language: "en", intelligence: intelligence(.available, answer: "Yes."))
        session.question = "noe annet"
        session.ask("Is there step-free access here?")
        await session.currentTask?.value
        XCTAssertEqual(session.askedQuestion, "Is there step-free access here?")
        XCTAssertEqual(session.phase, .answered("Yes."))
    }

    @MainActor
    func testSessionReportsFailures() async throws {
        let poi = try akershus()
        let empty = AskGuideSession(poi: poi, language: "nb", intelligence: intelligence(.available, answer: "x"))
        empty.ask()
        XCTAssertEqual(empty.phase, .failed(.emptyQuestion))
        XCTAssertEqual(empty.resultCount, 1)

        let broken = AskGuideSession(poi: poi, language: "nb", intelligence: intelligence(.available, answer: nil))
        broken.ask("Hvem bygde den?")
        await broken.currentTask?.value
        XCTAssertEqual(broken.phase, .failed(.generation))
        XCTAssertEqual(AskGuideSession.Failure.generation.messageKey, "askGuide.error.generation")

        let off = AskGuideSession(poi: poi, language: "nb", intelligence: intelligence(.unavailable(.modelNotReady), answer: "x"))
        off.ask("Hvem bygde den?")
        await off.currentTask?.value
        XCTAssertEqual(off.phase, .failed(.unavailable(.modelNotReady)))
    }
}
