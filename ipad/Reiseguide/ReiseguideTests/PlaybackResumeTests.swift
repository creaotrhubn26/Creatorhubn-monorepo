// PlaybackResumeTests.swift
//
// «Fortsett der du slapp» (avspiller-redesignet, punkt 3): butikken som
// husker posisjon per sted (UserDefaults), og den rene vurderingen av om en
// lagret posisjon er verdt å tilby gjenopptagelse fra.

import XCTest
@testable import Reiseguide

final class PlaybackResumeTests: XCTestCase {
    // MARK: - PlaybackResumeStore

    func testSavesAndReadsBackAPosition() throws {
        let suite = "PlaybackResumeTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let store = PlaybackResumeStore(defaults: defaults)
        XCTAssertNil(store.position(for: "poi_a"))

        store.save(PlaybackResumePosition(poiId: "poi_a", variantKind: .narration, chapterIndex: 1, positionS: 42, updatedAt: Date()))
        let reloaded = PlaybackResumeStore(defaults: defaults)
        let saved = try XCTUnwrap(reloaded.position(for: "poi_a"))
        XCTAssertEqual(saved.chapterIndex, 1)
        XCTAssertEqual(saved.positionS, 42)
        XCTAssertEqual(saved.variantKind, .narration)
    }

    func testSavingAgainForTheSamePlaceReplacesTheOldPosition() throws {
        let suite = "PlaybackResumeTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let store = PlaybackResumeStore(defaults: defaults)
        store.save(PlaybackResumePosition(poiId: "poi_a", variantKind: .narration, chapterIndex: 0, positionS: 10, updatedAt: Date()))
        store.save(PlaybackResumePosition(poiId: "poi_a", variantKind: .narration, chapterIndex: 2, positionS: 90, updatedAt: Date()))
        XCTAssertEqual(store.position(for: "poi_a")?.chapterIndex, 2)
    }

    func testClearRemovesThePosition() throws {
        let suite = "PlaybackResumeTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let store = PlaybackResumeStore(defaults: defaults)
        store.save(PlaybackResumePosition(poiId: "poi_a", variantKind: .narration, chapterIndex: 0, positionS: 30, updatedAt: Date()))
        store.clear(poiId: "poi_a")
        XCTAssertNil(store.position(for: "poi_a"))
    }

    func testOldestEntryIsDroppedBeyondMaxEntries() throws {
        let suite = "PlaybackResumeTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let store = PlaybackResumeStore(defaults: defaults)
        for index in 0 ..< (PlaybackResumeStore.maxEntries + 1) {
            store.save(PlaybackResumePosition(poiId: "poi_\(index)", variantKind: .narration, chapterIndex: 0, positionS: 10, updatedAt: Date()))
        }
        XCTAssertNil(store.position(for: "poi_0"), "det eldste stedet skal ha falt ut")
        XCTAssertNotNil(store.position(for: "poi_\(PlaybackResumeStore.maxEntries)"))
    }

    // MARK: - PlaybackResumeDecision

    func testDoesNotResumeFromNearTheVeryStart() {
        XCTAssertFalse(PlaybackResumeDecision.shouldResume(positionS: 2, chapterDurationS: 120))
    }

    func testDoesNotResumeWhenPracticallyFinished() {
        XCTAssertFalse(PlaybackResumeDecision.shouldResume(positionS: 118, chapterDurationS: 120))
    }

    func testResumesFromAMeaningfulMidPosition() {
        XCTAssertTrue(PlaybackResumeDecision.shouldResume(positionS: 60, chapterDurationS: 120))
    }

    func testResumePositionRewindsForContext() {
        XCTAssertEqual(PlaybackResumeDecision.resumePositionS(positionS: 60), 57)
    }

    func testResumePositionNeverGoesBelowZero() {
        XCTAssertEqual(PlaybackResumeDecision.resumePositionS(positionS: 1), 0)
    }

    // MARK: - PlaybackResumeDecision.resolve

    func testResolveReturnsNilWithoutASavedPosition() {
        XCTAssertNil(PlaybackResumeDecision.resolve(saved: nil, poi: makePoi(narration: makeVariant(kind: .narration))))
    }

    func testResolveReturnsTheRewoundStartAndTheOriginalSavedPosition() {
        let saved = PlaybackResumePosition(poiId: "poi_a", variantKind: .narration, chapterIndex: 0, positionS: 60, updatedAt: Date())
        let target = PlaybackResumeDecision.resolve(saved: saved, poi: makePoi(narration: makeVariant(kind: .narration)))
        XCTAssertEqual(target?.variantKind, .narration)
        XCTAssertEqual(target?.chapterIndex, 0)
        XCTAssertEqual(target?.startPositionS, 57)
        XCTAssertEqual(target?.savedPositionS, 60)
    }

    func testResolveReturnsNilWhenTheSavedChapterNoLongerExists() {
        let saved = PlaybackResumePosition(poiId: "poi_a", variantKind: .narration, chapterIndex: 9, positionS: 60, updatedAt: Date())
        XCTAssertNil(PlaybackResumeDecision.resolve(saved: saved, poi: makePoi(narration: makeVariant(kind: .narration))))
    }

    func testResolveReturnsNilWhenThePositionIsNoLongerWorthOffering() {
        let saved = PlaybackResumePosition(poiId: "poi_a", variantKind: .narration, chapterIndex: 0, positionS: 1, updatedAt: Date())
        XCTAssertNil(PlaybackResumeDecision.resolve(saved: saved, poi: makePoi(narration: makeVariant(kind: .narration))))
    }

    func testResolveFallsBackToAudioDescriptionWhenNarrationIsMissing() {
        let saved = PlaybackResumePosition(poiId: "poi_a", variantKind: .narration, chapterIndex: 0, positionS: 60, updatedAt: Date())
        let poi = makePoi(narration: nil, audioDescription: makeVariant(kind: .audioDescription))
        XCTAssertEqual(PlaybackResumeDecision.resolve(saved: saved, poi: poi)?.variantKind, .narration)
    }

    // MARK: - Hjelpere

    private func makeVariant(kind: VariantKind, chapterCount: Int = 2, chapterDurationS: Double = 120) -> GuideVariant {
        let chapters = (0 ..< chapterCount).map { index in
            GuideChapter(
                no: index + 1, title: "Kapittel \(index + 1)", scriptText: "Tekst.", imageUrl: nil, imageAlt: nil,
                version: 1, editorialStatus: "published", estimatedDurationS: Int(chapterDurationS), audio: nil, captions: nil
            )
        }
        return GuideVariant(kind: kind, lang: "nb", autoTranslated: false, durationS: chapterDurationS * Double(chapterCount), hasAudio: false, hasCaptions: false, chapters: chapters)
    }

    /// `narration` er ikke valgfri her (i motsetning til GuidePOI selv): en
    /// test som eksplisitt vil ha narration = nil (fallback til synstolking)
    /// skal ikke kunne gjøre det ved et uhell ved å utelate parameteren.
    private func makePoi(narration: GuideVariant?, audioDescription: GuideVariant? = nil) -> GuidePOI {
        GuidePOI(
            id: "poi_a", slug: "a", areaId: "area", categoryId: nil, lat: 59.9, lng: 10.7,
            triggerRadiusM: 40, priority: 0, sortOrder: 0, freePreview: false, heroImageUrl: nil, heroImageAlt: nil,
            title: "A", subtitle: nil, summary: nil, locationLabel: nil, practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: "draft", available: ["nb"]),
            variants: GuideVariants(narration: narration, audioDescription: audioDescription),
            quiz: nil, rating: nil, shareUrl: nil
        )
    }
}
