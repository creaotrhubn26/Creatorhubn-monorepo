// GeoAndCaptionTests.swift
//
// Ren logikk uten UI: avstand/sortering (Geo) og tekstingstidslinje
// (CaptionTimeline). PoiEngine-testene på syntetiske GPS-spor kommer i steg 4.

import XCTest
@testable import Reiseguide

final class GeoAndCaptionTests: XCTestCase {
    private let akershus = Coordinate(lat: 59.9075, lng: 10.7364)
    private let operaen = Coordinate(lat: 59.9074, lng: 10.7529)

    func testDistanceBetweenFortressAndOperaIsAboutOneKilometre() {
        let d = Geo.distanceM(from: akershus, to: operaen)
        XCTAssertGreaterThan(d, 850)
        XCTAssertLessThan(d, 1_000)
        XCTAssertEqual(Geo.distanceM(from: akershus, to: akershus), 0, accuracy: 0.001)
    }

    func testBearingFromFortressToOperaIsEast() {
        let bearing = Geo.bearingDegrees(from: akershus, to: operaen)
        XCTAssertGreaterThan(bearing, 80)
        XCTAssertLessThan(bearing, 100)
    }

    func testSortedByDistanceKeepsBackendOrderWithoutOrigin() {
        let pois = [makePoi(slug: "b", lat: 59.91, lng: 10.75), makePoi(slug: "a", lat: 59.9075, lng: 10.7364)]
        XCTAssertEqual(Geo.sortedByDistance(pois, from: nil).map(\.poi.slug), ["b", "a"])
        XCTAssertEqual(Geo.sortedByDistance(pois, from: akershus).map(\.poi.slug), ["a", "b"])
    }

    func testEstimatedCaptionsCoverWholeDuration() {
        let segments = CaptionTimeline.estimate(text: "Første setning. Andre setning! Tredje?", durationS: 30)
        XCTAssertEqual(segments.count, 3)
        XCTAssertEqual(segments.first?.startS, 0)
        XCTAssertEqual(segments.last?.endS ?? 0, 30, accuracy: 0.001)
        XCTAssertEqual(CaptionTimeline.segment(at: 0, in: segments)?.text, "Første setning.")
        XCTAssertNil(CaptionTimeline.segment(at: 30, in: segments))
    }

    func testRealCuesWinOverEstimate() {
        let chapter = GuideChapter(
            no: 1, title: nil, scriptText: "En. To.", imageUrl: nil, imageAlt: nil, version: 1,
            editorialStatus: "approved", estimatedDurationS: 10,
            audio: ChapterAudio(url: "https://media.test/a.m4a", format: "m4a", durationS: 4),
            captions: ChapterCaptions(url: nil, cues: [
                CaptionCue(startS: 2, endS: 4, text: "To."),
                CaptionCue(startS: 0, endS: 2, text: "En."),
                CaptionCue(startS: nil, endS: 5, text: "ugyldig"),
            ])
        )
        let timeline = CaptionTimeline.build(chapter: chapter)
        XCTAssertFalse(timeline.isEstimated)
        XCTAssertEqual(timeline.segments.map(\.text), ["En.", "To."])
        XCTAssertEqual(chapter.playbackDurationS, 4)
    }

    private func makePoi(slug: String, lat: Double, lng: Double) -> GuidePOI {
        GuidePOI(
            id: "poi_\(slug)", slug: slug, areaId: "area", categoryId: nil, lat: lat, lng: lng,
            triggerRadiusM: 40, priority: 0, sortOrder: 0, freePreview: false, heroImageUrl: nil, heroImageAlt: nil,
            title: slug, subtitle: nil, summary: nil, locationLabel: nil, practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: "draft", available: ["nb"]),
            variants: GuideVariants(narration: nil, audioDescription: nil),
            quiz: nil, rating: nil, shareUrl: nil
        )
    }
}
