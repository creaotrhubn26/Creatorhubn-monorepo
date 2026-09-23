// ChapterPromptTests.swift
//
// Spørsmål underveis (pakke 3): dekoding fra backend-fixturen og den rene
// tidslogikken i ChapterPromptTracker / ChapterPromptController.

import XCTest
@testable import Reiseguide

final class ChapterPromptTests: XCTestCase {
    private func loadFixture() throws -> AreaResponse {
        let bundle = Bundle(for: ChapterPromptTests.self)
        let url = try XCTUnwrap(bundle.url(forResource: "area-nb", withExtension: "json"))
        return try JSONDecoder().decode(AreaResponse.self, from: Data(contentsOf: url))
    }

    private func look(_ id: String, at fraction: Double) -> ChapterPrompt {
        ChapterPrompt(id: id, kind: "look", atFraction: fraction, text: "Se opp: \(id)", options: nil, answerIndex: nil, revealText: nil)
    }

    private func guess(_ id: String, at fraction: Double) -> ChapterPrompt {
        ChapterPrompt(id: id, kind: "guess", atFraction: fraction, text: "Gjett \(id)?", options: ["A", "B", "C"], answerIndex: 1, revealText: "B.")
    }

    // MARK: - Dekoding

    func testFixtureHasOneLookAndOneGuessPerPoiOnNarrationOnly() throws {
        let response = try loadFixture()
        for poi in response.pois {
            let narration = try XCTUnwrap(poi.variants.narration, poi.slug)
            let prompts = narration.chapters.flatMap(\.promptList)
            XCTAssertEqual(prompts.compactMap(\.promptKind).map(\.rawValue).sorted(), ["guess", "look"], poi.slug)
            XCTAssertTrue(prompts.allSatisfy(\.isValid), poi.slug)
            for chapter in poi.variants.audioDescription?.chapters ?? [] {
                XCTAssertTrue(chapter.promptList.isEmpty, "synstolking har ingen innslag")
            }
        }
        let akershus = try XCTUnwrap(response.pois.first { $0.slug == "akershus-festning" })
        let first = try XCTUnwrap(akershus.variants.narration?.chapters.first?.promptList.first)
        XCTAssertEqual(first.promptKind, .guess)
        XCTAssertEqual(first.atFraction, 0.26, accuracy: 0.0001)
        XCTAssertEqual(first.correctOption, "Han brant hele byen ned")
        XCTAssertEqual(first.id, "poi_akershus_festning_nb_prompt_1_1")
    }

    func testChapterWithoutPromptsFromOlderCacheDecodes() throws {
        let json = """
        {"no":1,"title":null,"scriptText":"Tekst.","imageUrl":null,"imageAlt":null,"version":1,
         "editorialStatus":"draft","estimatedDurationS":60,"audio":null,"captions":null}
        """
        let chapter = try JSONDecoder().decode(GuideChapter.self, from: Data(json.utf8))
        XCTAssertNil(chapter.prompts)
        XCTAssertTrue(chapter.promptList.isEmpty)
    }

    func testUnknownKindDecodesButIsNeverShown() throws {
        let json = """
        {"id":"x","kind":"poll","atFraction":0.5,"text":"Hva synes du?","options":null,"answerIndex":null,"revealText":null}
        """
        let prompt = try JSONDecoder().decode(ChapterPrompt.self, from: Data(json.utf8))
        XCTAssertNil(prompt.promptKind)
        XCTAssertFalse(prompt.isValid)
        var tracker = ChapterPromptTracker()
        tracker.load(prompts: [prompt], durationS: 10)
        XCTAssertNil(tracker.advance(to: 5.1))
    }

    func testValidityRules() {
        XCTAssertTrue(look("a", at: 0).isValid)
        XCTAssertFalse(look("a", at: 1).isValid)
        XCTAssertFalse(look("a", at: -0.1).isValid)
        XCTAssertTrue(guess("g", at: 0.5).isValid)
        let noAnswer = ChapterPrompt(id: "g", kind: "guess", atFraction: 0.5, text: "?", options: ["A", "B"], answerIndex: 2, revealText: nil)
        XCTAssertFalse(noAnswer.isValid)
        let oneOption = ChapterPrompt(id: "g", kind: "guess", atFraction: 0.5, text: "?", options: ["A"], answerIndex: 0, revealText: nil)
        XCTAssertFalse(oneOption.isValid)
        let blank = ChapterPrompt(id: "l", kind: "look", atFraction: 0.5, text: "  ", options: nil, answerIndex: nil, revealText: nil)
        XCTAssertFalse(blank.isValid)
    }

    // MARK: - Tidslogikk

    func testTriggersWhenPlaybackCrossesFractionOfDuration() {
        var tracker = ChapterPromptTracker()
        tracker.load(prompts: [look("l", at: 0.5)], durationS: 100)
        XCTAssertNil(tracker.advance(to: 49.8))
        XCTAssertEqual(tracker.advance(to: 50.05)?.id, "l")
        XCTAssertNil(tracker.advance(to: 50.3), "vises bare én gang")
    }

    func testPromptAtZeroShowsOnFirstTick() {
        var tracker = ChapterPromptTracker()
        tracker.load(prompts: [look("start", at: 0)], durationS: 60)
        XCTAssertEqual(tracker.advance(to: 0.25)?.id, "start")
    }

    func testSeekingPastAPromptDoesNotShowIt() {
        var tracker = ChapterPromptTracker()
        tracker.load(prompts: [look("l", at: 0.5)], durationS: 100)
        XCTAssertNil(tracker.advance(to: 10))
        tracker.seek(to: 70)
        XCTAssertNil(tracker.advance(to: 70.25))
        // Spoler tilbake og spiller forbi: nå vises det.
        tracker.seek(to: 49)
        XCTAssertNil(tracker.advance(to: 49.5))
        XCTAssertEqual(tracker.advance(to: 50.2)?.id, "l")
    }

    func testLargeJumpWithoutSeekIsTreatedAsSkip() {
        var tracker = ChapterPromptTracker()
        tracker.load(prompts: [look("l", at: 0.5)], durationS: 100)
        XCTAssertNil(tracker.advance(to: 40))
        XCTAssertNil(tracker.advance(to: 55), "hopp på 15 s er spoling, ikke avspilling")
    }

    func testTwoPromptsCrossedInOneTickShowOneAfterTheOther() {
        var tracker = ChapterPromptTracker()
        tracker.load(prompts: [look("b", at: 0.502), look("a", at: 0.501)], durationS: 100)
        XCTAssertNil(tracker.advance(to: 50))
        XCTAssertEqual(tracker.advance(to: 50.3)?.id, "a")
        XCTAssertEqual(tracker.advance(to: 50.55)?.id, "b")
        XCTAssertNil(tracker.advance(to: 50.8))
    }

    func testShownPromptsStayShownAcrossChaptersUntilNewPlace() {
        var tracker = ChapterPromptTracker()
        let prompt = look("l", at: 0.1)
        tracker.load(prompts: [prompt], durationS: 10)
        XCTAssertEqual(tracker.advance(to: 1.1)?.id, "l")
        // Tilbake til samme kapittel: ikke igjen.
        tracker.load(prompts: [prompt], durationS: 10)
        XCTAssertNil(tracker.advance(to: 1.1))
        // Nytt sted: vises igjen.
        tracker.resetSession()
        tracker.load(prompts: [prompt], durationS: 10)
        XCTAssertEqual(tracker.advance(to: 1.1)?.id, "l")
    }

    // MARK: - Kontroller

    @MainActor
    func testGuessPausesAndLookDoesNot() {
        let controller = ChapterPromptController()
        let chapter = GuideChapter(
            no: 1, title: nil, scriptText: "Tekst.", imageUrl: nil, imageAlt: nil, version: 1,
            editorialStatus: "draft", estimatedDurationS: 100, audio: nil, captions: nil,
            prompts: [look("l", at: 0.2), guess("g", at: 0.6)]
        )
        controller.load(chapter: chapter)
        XCTAssertFalse(controller.advance(to: 0.25, enabled: true))
        XCTAssertNil(controller.active)
        controller.seek(to: 19.9)
        XCTAssertFalse(controller.advance(to: 20.1, enabled: true), "look pauser ikke")
        XCTAssertEqual(controller.active?.id, "l")
        XCTAssertFalse(controller.advance(to: 20.4, enabled: true))
        XCTAssertEqual(controller.active?.id, "l", "kortet står til det lukkes")
        controller.seek(to: 59.9)
        XCTAssertTrue(controller.advance(to: 60.2, enabled: true), "guess pauser")
        XCTAssertEqual(controller.active?.id, "g")
        XCTAssertEqual(controller.presentationCount, 2)

        controller.choose(0)
        XCTAssertEqual(controller.chosenIndex, 0)
        controller.choose(1)
        XCTAssertEqual(controller.chosenIndex, 0, "svaret låses")
        controller.dismiss()
        XCTAssertNil(controller.active)
        XCTAssertNil(controller.chosenIndex)
    }

    @MainActor
    func testDisabledSettingShowsNothingAndDoesNotQueue() {
        let controller = ChapterPromptController()
        let chapter = GuideChapter(
            no: 1, title: nil, scriptText: "Tekst.", imageUrl: nil, imageAlt: nil, version: 1,
            editorialStatus: "draft", estimatedDurationS: 10, audio: nil, captions: nil,
            prompts: [guess("g", at: 0.5)]
        )
        controller.load(chapter: chapter)
        controller.seek(to: 4.9)
        XCTAssertFalse(controller.advance(to: 5.1, enabled: false))
        XCTAssertNil(controller.active)
        XCTAssertFalse(controller.advance(to: 5.3, enabled: true), "passert mens av: vises ikke i ettertid")
    }

    @MainActor
    func testNewChapterRemovesCard() {
        let controller = ChapterPromptController()
        let chapter = GuideChapter(
            no: 1, title: nil, scriptText: "Tekst.", imageUrl: nil, imageAlt: nil, version: 1,
            editorialStatus: "draft", estimatedDurationS: 10, audio: nil, captions: nil,
            prompts: [look("l", at: 0)]
        )
        controller.load(chapter: chapter)
        _ = controller.advance(to: 0.25, enabled: true)
        XCTAssertNotNil(controller.active)
        controller.load(chapter: nil)
        XCTAssertNil(controller.active)
    }
}
