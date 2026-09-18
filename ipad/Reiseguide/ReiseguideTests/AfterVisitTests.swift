// AfterVisitTests.swift
//
// «Etter besøket»: besøkslogg (lagring, gjenbruk av oppføring, stjerner og
// quiz-resultat), liknende steder i nærheten, quiz-tilstand og deep link.
// Ren logikk uten UI.

import XCTest
@testable import Reiseguide

final class AfterVisitTests: XCTestCase {
    private let tempFile = FileManager.default.temporaryDirectory
        .appendingPathComponent("visits-\(UUID().uuidString)", isDirectory: true)
        .appendingPathComponent("visits.json")

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempFile.deletingLastPathComponent())
        super.tearDown()
    }

    // MARK: - Besøkslogg

    @MainActor
    func testVisitLogPersistsAndReloadsNewestFirst() {
        var clock = Date(timeIntervalSince1970: 1_000_000)
        let store = VisitLogStore(fileURL: tempFile, now: { clock })
        let first = store.recordStart(poi: makePoi(slug: "akershus-festning"))
        clock = clock.addingTimeInterval(4 * 60 * 60)
        let second = store.recordStart(poi: makePoi(slug: "operaen"))
        store.markCompleted(entryId: second.id)
        store.setStars(entryId: second.id, stars: 9)
        store.setQuizResult(entryId: first.id, correct: 2, total: 3)

        let reloaded = VisitLogStore(fileURL: tempFile)
        XCTAssertEqual(reloaded.entries.map(\.poiSlug), ["operaen", "akershus-festning"])
        XCTAssertEqual(reloaded.entries[0].stars, 5, "stjerner klippes til 1–5")
        XCTAssertEqual(reloaded.entries[0].completedAt, clock)
        XCTAssertTrue(reloaded.entries[0].isCompleted)
        XCTAssertEqual(reloaded.entries[1].quizCorrect, 2)
        XCTAssertEqual(reloaded.entries[1].quizTotal, 3)
        XCTAssertFalse(reloaded.entries[1].isCompleted)
        XCTAssertEqual(reloaded.visitedPoiIds, ["poi_operaen", "poi_akershus-festning"])
    }

    @MainActor
    func testRestartWithinWindowReusesEntryAndLaterCreatesNew() {
        var clock = Date(timeIntervalSince1970: 2_000_000)
        let store = VisitLogStore(fileURL: tempFile, now: { clock })
        let first = store.recordStart(poi: makePoi(slug: "akershus-festning"))
        clock = clock.addingTimeInterval(20 * 60)
        let again = store.recordStart(poi: makePoi(slug: "akershus-festning"))
        XCTAssertEqual(again.id, first.id)
        XCTAssertEqual(store.entries.count, 1)

        clock = clock.addingTimeInterval(VisitLogStore.sameVisitWindow + 1)
        let later = store.recordStart(poi: makePoi(slug: "akershus-festning"))
        XCTAssertNotEqual(later.id, first.id)
        XCTAssertEqual(store.entries.count, 2)
        XCTAssertEqual(store.latestEntry(poiId: "poi_akershus-festning")?.id, later.id)

        store.remove(entryId: later.id)
        XCTAssertEqual(store.entries.map(\.id), [first.id])
    }

    @MainActor
    func testCorruptFileStartsEmpty() throws {
        try FileManager.default.createDirectory(at: tempFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("ikke json".utf8).write(to: tempFile)
        XCTAssertTrue(VisitLogStore(fileURL: tempFile).entries.isEmpty)
    }

    // MARK: - Liknende i nærheten

    func testRelatedPrefersSameCategoryThenDistance() {
        let visited = makePoi(slug: "christiania-torv", category: "historisk", lat: 59.9107, lng: 10.7397)
        let all = [
            visited,
            makePoi(slug: "gamle-radhus", category: "historisk", lat: 59.9103, lng: 10.7403),
            makePoi(slug: "bankplassen", category: "museum", lat: 59.9097, lng: 10.7414),
            makePoi(slug: "oslo-bors", category: "historisk", lat: 59.9108, lng: 10.743),
            makePoi(slug: "operaen", category: "arkitektur", lat: 59.9074, lng: 10.7529),
            makePoi(slug: "akershus-festning", category: "historisk", lat: 59.9075, lng: 10.7364)
        ]
        let suggestions = RelatedPlaces.suggest(for: visited, among: all)
        XCTAssertEqual(suggestions.map(\.poi.slug), ["gamle-radhus", "oslo-bors", "akershus-festning"])
        XCTAssertTrue(suggestions.allSatisfy(\.sameCategory))
        XCTAssertLessThan(suggestions[0].distanceM, suggestions[1].distanceM)

        let opera = all[4]
        let fromOpera = RelatedPlaces.suggest(for: opera, among: all, limit: 2)
        XCTAssertEqual(fromOpera.map(\.poi.slug), ["oslo-bors", "bankplassen"], "669 m og 690 m fra Operaen")
        XCTAssertFalse(fromOpera[0].sameCategory)
        XCTAssertTrue(RelatedPlaces.suggest(for: opera, among: [opera]).isEmpty)
    }

    // MARK: - Quiz

    func testQuizSessionLocksAnswersAndCountsCorrect() {
        let questions = [
            QuizQuestion(id: "q1", no: 1, question: "A?", options: ["x", "y"], correctIndex: 1, explanation: nil),
            QuizQuestion(id: "q2", no: 2, question: "B?", options: ["x", "y", "z"], correctIndex: 0, explanation: "fordi")
        ]
        var quiz = QuizSession(questions: questions)
        XCTAssertEqual(quiz.total, 2)
        XCTAssertFalse(quiz.isFinished)
        quiz.next()
        XCTAssertEqual(quiz.index, 0, "kan ikke gå videre uten svar")

        quiz.answer(1)
        quiz.answer(0)
        XCTAssertEqual(quiz.currentAnswer, 1, "første svar låses")
        XCTAssertTrue(quiz.isCorrect(option: 1))
        quiz.next()
        XCTAssertTrue(quiz.isLastQuestion)
        quiz.answer(7)
        XCTAssertNil(quiz.currentAnswer, "ugyldig alternativ ignoreres")
        quiz.answer(2)
        quiz.next()
        XCTAssertTrue(quiz.isFinished)
        XCTAssertEqual(quiz.correctCount, 1)

        quiz.restart()
        XCTAssertEqual(quiz.index, 0)
        XCTAssertEqual(quiz.correctCount, 0)
        XCTAssertTrue(QuizSession(questions: []).isEmpty)
        XCTAssertTrue(QuizSession(questions: []).isFinished)
    }

    // MARK: - Deep link

    func testDeepLinkParsing() throws {
        XCTAssertEqual(
            DeepLink.parse(try XCTUnwrap(URL(string: "senseaidexplore://poi/akershus-festning?lang=EN"))),
            .poi(slug: "akershus-festning", lang: "en")
        )
        XCTAssertEqual(
            DeepLink.parse(try XCTUnwrap(URL(string: "SenseAidExplore://poi/operaen"))),
            .poi(slug: "operaen", lang: nil)
        )
        XCTAssertNil(DeepLink.parse(try XCTUnwrap(URL(string: "https://example.com/poi/operaen"))))
        XCTAssertNil(DeepLink.parse(try XCTUnwrap(URL(string: "senseaidexplore://area/operaen"))))
        XCTAssertNil(DeepLink.parse(try XCTUnwrap(URL(string: "senseaidexplore://poi/"))))
    }

    // MARK: - Hjelpere

    private func makePoi(slug: String, category: String? = "historisk", lat: Double = 59.9, lng: Double = 10.7) -> GuidePOI {
        GuidePOI(
            id: "poi_\(slug)", slug: slug, areaId: "area", categoryId: category, lat: lat, lng: lng,
            triggerRadiusM: 40, priority: 0, sortOrder: 0, freePreview: false, heroImageUrl: nil, heroImageAlt: nil,
            title: slug, subtitle: nil, summary: nil, locationLabel: nil, practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: "draft", available: ["nb"]),
            variants: GuideVariants(narration: nil, audioDescription: nil),
            quiz: nil, rating: nil, shareUrl: nil
        )
    }
}
