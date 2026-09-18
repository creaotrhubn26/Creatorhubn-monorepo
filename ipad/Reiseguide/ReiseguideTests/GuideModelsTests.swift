// GuideModelsTests.swift
//
// Dekoder et ekte svar fra GET /api/guide/areas/:slug?lang=nb (fixture tatt
// 18.09.2026 fra backend/server/reiseguide-routes.ts mot demo-seed med manus
// v1 og quiz, migrasjon 0630 + 0631) og sjekker at modellene matcher kontrakten.

import XCTest
@testable import Reiseguide

final class GuideModelsTests: XCTestCase {
    private func loadFixture() throws -> AreaResponse {
        let bundle = Bundle(for: GuideModelsTests.self)
        let url = try XCTUnwrap(bundle.url(forResource: "area-nb", withExtension: "json"))
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(AreaResponse.self, from: data)
    }

    func testDecodesAreaResponseFromBackend() throws {
        let response = try loadFixture()
        XCTAssertEqual(response.requestedLang, "nb")
        XCTAssertEqual(response.area.slug, AreaStore.demoAreaSlug)
        XCTAssertEqual(response.area.defaultLang, "nb")
        XCTAssertEqual(response.area.languages, ["en", "nb"])
        XCTAssertEqual(response.area.poiCount, 6)
        XCTAssertEqual(response.pois.count, 6)
        XCTAssertEqual(response.categories.map(\.id), ["museum", "historisk", "arkitektur"])
    }

    func testAkershusHasNarrationAndAudioDescription() throws {
        let response = try loadFixture()
        let akershus = try XCTUnwrap(response.pois.first { $0.slug == "akershus-festning" })
        XCTAssertTrue(akershus.freePreview)
        XCTAssertEqual(akershus.triggerRadiusM, 120)
        XCTAssertEqual(akershus.title, "Akershus festning")
        XCTAssertEqual(akershus.practicalInfo.count, 5)
        let narration = try XCTUnwrap(akershus.variants.narration)
        XCTAssertEqual(narration.kind, .narration)
        XCTAssertEqual(narration.chapters.count, 2)
        XCTAssertFalse(narration.hasAudio)
        XCTAssertEqual(narration.chapters[0].playbackDurationS, 73)
        XCTAssertNotNil(akershus.variants.audioDescription)
        XCTAssertTrue(akershus.hasAudioDescription)
        XCTAssertFalse(akershus.hasCaptions)
    }

    func testEveryPoiHasQuizShareUrlAndNoRatingsYet() throws {
        let response = try loadFixture()
        for poi in response.pois {
            XCTAssertEqual(poi.quizQuestions.count, 3, poi.slug)
            for question in poi.quizQuestions {
                XCTAssertTrue(question.options.indices.contains(question.correctIndex), question.id)
                XCTAssertGreaterThanOrEqual(question.options.count, 2)
            }
            XCTAssertNil(poi.rating, "ingen vurderinger i demo-seeden")
            XCTAssertEqual(poi.shareURL?.path(), "/api/guide/share/\(poi.slug)")
            XCTAssertEqual(poi.lang.resolved, "nb")
            XCTAssertFalse(poi.lang.fallbackUsed)
        }
        let bors = try XCTUnwrap(response.pois.first { $0.slug == "oslo-bors" })
        XCTAssertEqual(bors.quizQuestions[0].correctIndex, 0)
        XCTAssertEqual(bors.quizQuestions[0].options, ["Christian Heinrich Grosch", "Sverre Fehn", "Ingvar Hjorth"])
    }

    func testOlderCachedResponseWithoutAfterVisitFieldsStillDecodes() throws {
        let json = """
        {"id":"p","slug":"s","areaId":"a","categoryId":null,"lat":59.9,"lng":10.7,"triggerRadiusM":40,"priority":0,
         "sortOrder":0,"freePreview":true,"heroImageUrl":null,"heroImageAlt":null,"title":"T","subtitle":null,
         "summary":null,"locationLabel":null,"practicalInfo":[],
         "lang":{"requested":"nb","resolved":"nb","fallbackUsed":false,"autoTranslated":false,"editorialStatus":"draft","available":["nb"]},
         "variants":{"narration":null,"audioDescription":null}}
        """
        let poi = try JSONDecoder().decode(GuidePOI.self, from: Data(json.utf8))
        XCTAssertTrue(poi.quizQuestions.isEmpty)
        XCTAssertNil(poi.rating)
        XCTAssertNil(poi.shareURL)
    }

    func testRoundTripsThroughCacheEncoding() throws {
        let response = try loadFixture()
        let data = try JSONEncoder().encode(response)
        let decoded = try JSONDecoder().decode(AreaResponse.self, from: data)
        XCTAssertEqual(decoded, response)
    }
}
