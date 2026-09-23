// GuideModelsTests.swift
//
// Dekoder et ekte svar fra GET /api/guide/areas/:slug?lang=nb (fixture tatt
// 18.09.2026 fra backend/server/reiseguide-routes.ts mot demo-seed med manus
// v1 og quiz, migrasjon 0640 + 0641) og sjekker at modellene matcher kontrakten.
// `prompts` på kapitlene (0662, spørsmål underveis) ble lagt inn 23.09.2026 med
// backendens buildChapterPrompts over demo-dataene; se ChapterPromptTests.
// `heroImageCredit` (0663, Commons-kreditering) ble lagt inn som null
// 23.09.2026; fixturen har fortsatt ingen bilder.

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
            XCTAssertNil(poi.heroImageCredit, "ingen bilder i fixturen")
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
        XCTAssertNil(poi.heroImageCredit, "svar fra før 0663 har ikke feltet")
    }

    func testDecodesHeroImageCreditFromCommons() throws {
        let json = """
        {"id":"p","slug":"s","areaId":"a","categoryId":null,"lat":59.9,"lng":10.7,"triggerRadiusM":40,"priority":0,
         "sortOrder":0,"freePreview":true,
         "heroImageUrl":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Akershus.jpg/1600px-Akershus.jpg",
         "heroImageAlt":"Foto av Akershus festning",
         "heroImageCredit":{"author":"Ola Nordmann","license":"CC BY-SA 4.0",
           "licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0",
           "sourceUrl":"https://commons.wikimedia.org/wiki/File:Akershus.jpg"},
         "title":"T","subtitle":null,"summary":null,"locationLabel":null,"practicalInfo":[],
         "lang":{"requested":"nb","resolved":"nb","fallbackUsed":false,"autoTranslated":false,"editorialStatus":"draft","available":["nb"]},
         "variants":{"narration":null,"audioDescription":null}}
        """
        let poi = try JSONDecoder().decode(GuidePOI.self, from: Data(json.utf8))
        let credit = try XCTUnwrap(poi.heroImageCredit)
        XCTAssertEqual(credit.author, "Ola Nordmann")
        XCTAssertEqual(credit.license, "CC BY-SA 4.0")
        XCTAssertEqual(credit.sourceURL?.host(), "commons.wikimedia.org")
        XCTAssertEqual(poi.heroImageAlt, "Foto av Akershus festning")

        let minimal = try JSONDecoder().decode(
            HeroImageCredit.self,
            from: Data(#"{"author":"Kari","license":null,"licenseUrl":null,"sourceUrl":null}"#.utf8)
        )
        XCTAssertNil(minimal.license)
        XCTAssertNil(minimal.sourceURL)

        let data = try JSONEncoder().encode(poi)
        XCTAssertEqual(try JSONDecoder().decode(GuidePOI.self, from: data), poi)
    }

    func testRoundTripsThroughCacheEncoding() throws {
        let response = try loadFixture()
        let data = try JSONEncoder().encode(response)
        let decoded = try JSONDecoder().decode(AreaResponse.self, from: data)
        XCTAssertEqual(decoded, response)
    }
}
