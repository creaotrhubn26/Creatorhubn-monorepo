// GuideModelsTests.swift
//
// Dekoder et ekte svar fra GET /api/guide/areas/:slug?lang=nb (fixture tatt
// 18.09.2026 fra backend/server/reiseguide-routes.ts mot demo-seed) og sjekker
// at modellene matcher kontrakten.

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
        XCTAssertEqual(akershus.practicalInfo.count, 4)
        let narration = try XCTUnwrap(akershus.variants.narration)
        XCTAssertEqual(narration.kind, .narration)
        XCTAssertEqual(narration.chapters.count, 1)
        XCTAssertFalse(narration.hasAudio)
        XCTAssertEqual(narration.chapters[0].playbackDurationS, 35)
        XCTAssertNotNil(akershus.variants.audioDescription)
        XCTAssertTrue(akershus.hasAudioDescription)
        XCTAssertFalse(akershus.hasCaptions)
    }

    func testPoiWithoutAudioDescriptionDecodesToNil() throws {
        let response = try loadFixture()
        let bors = try XCTUnwrap(response.pois.first { $0.slug == "oslo-bors" })
        XCTAssertNil(bors.variants.audioDescription)
        XCTAssertNotNil(bors.variants.narration)
        XCTAssertEqual(bors.lang.resolved, "nb")
        XCTAssertFalse(bors.lang.fallbackUsed)
    }

    func testRoundTripsThroughCacheEncoding() throws {
        let response = try loadFixture()
        let data = try JSONEncoder().encode(response)
        let decoded = try JSONDecoder().decode(AreaResponse.self, from: data)
        XCTAssertEqual(decoded, response)
    }
}
