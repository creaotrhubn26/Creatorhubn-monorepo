// VisitSyncTests.swift
//
// Speiling av besøksloggen til serveren: ingenting sendes uten samtykke,
// endringer samles og sendes uten tittel, feil lar køen stå, av-bryter
// sletter loggen på serveren, og «slett mine data» gir ny enhets-ID.

import XCTest
@testable import Reiseguide

final class VisitSyncTests: XCTestCase {
    private let tempFile = FileManager.default.temporaryDirectory
        .appendingPathComponent("sync-\(UUID().uuidString)", isDirectory: true)
        .appendingPathComponent("visits.json")
    private var suiteName = ""

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempFile.deletingLastPathComponent())
        UserDefaults.standard.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    @MainActor
    func testNothingIsSentWithoutConsent() async throws {
        let h = try makeSync()
        XCTAssertFalse(h.settings.syncVisitsToServer)
        XCTAssertEqual(h.sync.state, .off)
        h.visits.recordStart(poi: makePoi(slug: "operaen"))
        await h.sync.flush()
        XCTAssertTrue(h.transport.syncCalls.isEmpty)
        XCTAssertTrue(h.sync.pendingIds.isEmpty)
    }

    @MainActor
    func testEnablingSendsWholeLogAndChangesAreBatched() async throws {
        var clock = Date(timeIntervalSince1970: 1_000_000)
        let h = try makeSync(now: { clock })
        let first = h.visits.recordStart(poi: makePoi(slug: "akershus-festning"))

        await h.sync.setEnabled(true)
        XCTAssertTrue(h.settings.syncVisitsToServer)
        XCTAssertEqual(h.transport.syncCalls.count, 1)
        XCTAssertEqual(h.transport.syncCalls[0].visits.map(\.id), [first.id])
        XCTAssertEqual(h.transport.syncCalls[0].deviceId, h.settings.deviceId)
        XCTAssertEqual(h.sync.state, .idle)
        XCTAssertEqual(h.sync.retentionDays, 365)
        XCTAssertEqual(h.sync.lastSyncedAt, clock)

        clock = clock.addingTimeInterval(4 * 60 * 60)
        let second = h.visits.recordStart(poi: makePoi(slug: "operaen"))
        h.visits.markCompleted(entryId: second.id)
        h.visits.setStars(entryId: second.id, stars: 5)
        XCTAssertEqual(h.sync.pendingIds, [second.id])
        await h.sync.scheduledFlush?.value
        XCTAssertEqual(h.transport.syncCalls.count, 2)
        XCTAssertEqual(h.transport.syncCalls[1].visits.map(\.id), [second.id])
        XCTAssertEqual(h.transport.syncCalls[1].visits[0].stars, 5)
        XCTAssertTrue(h.sync.pendingIds.isEmpty)
        XCTAssertFalse(h.sync.hasPending)
    }

    @MainActor
    func testFailureKeepsQueueUntilNextFlush() async throws {
        let h = try makeSync()
        await h.sync.setEnabled(true)
        h.transport.failNext = true
        let entry = h.visits.recordStart(poi: makePoi(slug: "operaen"))
        await h.sync.scheduledFlush?.value
        XCTAssertEqual(h.sync.state, .failed)
        XCTAssertEqual(h.sync.pendingIds, [entry.id])

        await h.sync.flush()
        XCTAssertEqual(h.sync.state, .idle)
        XCTAssertTrue(h.sync.pendingIds.isEmpty)
        XCTAssertEqual(h.transport.syncCalls.last?.visits.map(\.id), [entry.id])
    }

    @MainActor
    func testRemovalDeletesOnServerAndDisablingDeletesWholeLog() async throws {
        let h = try makeSync()
        await h.sync.setEnabled(true)
        let entry = h.visits.recordStart(poi: makePoi(slug: "operaen"))
        await h.sync.scheduledFlush?.value
        h.visits.remove(entryId: entry.id)
        XCTAssertEqual(h.sync.pendingDeletes, [entry.id])
        await h.sync.scheduledFlush?.value
        XCTAssertEqual(h.transport.deletedVisitIds, [entry.id])
        XCTAssertTrue(h.sync.pendingDeletes.isEmpty)

        await h.sync.setEnabled(false)
        XCTAssertFalse(h.settings.syncVisitsToServer)
        XCTAssertEqual(h.transport.deleteVisitsCalls, [h.settings.deviceId])
        XCTAssertEqual(h.sync.state, .off)

        h.visits.recordStart(poi: makePoi(slug: "akershus-festning"))
        XCTAssertTrue(h.sync.pendingIds.isEmpty, "uten samtykke havner ingenting i køen")
    }

    @MainActor
    func testDeleteAllServerDataRotatesDeviceIdAndTurnsSyncOff() async throws {
        let h = try makeSync()
        await h.sync.setEnabled(true)
        h.visits.recordStart(poi: makePoi(slug: "operaen"))
        let oldId = h.settings.deviceId

        let ok = await h.sync.deleteAllServerData()
        XCTAssertTrue(ok)
        XCTAssertEqual(h.transport.deleteDataCalls, [oldId])
        XCTAssertNotEqual(h.settings.deviceId, oldId)
        XCTAssertFalse(h.settings.syncVisitsToServer)
        XCTAssertEqual(h.sync.state, .deleted)
        XCTAssertTrue(h.sync.pendingIds.isEmpty)
        XCTAssertNil(h.sync.lastSyncedAt)
        XCTAssertEqual(h.visits.entries.count, 1, "loggen på telefonen beholdes")

        h.transport.failNext = true
        let failed = await h.sync.deleteAllServerData()
        XCTAssertFalse(failed)
        XCTAssertEqual(h.sync.state, .failed)
    }

    func testSyncPayloadOmitsTitleAndUsesIso8601() throws {
        let entry = VisitEntry(
            id: "visit-0001-aaaa", poiId: "poi_operaen", poiSlug: "operaen", title: "Operaen",
            startedAt: Date(timeIntervalSince1970: 1_758_190_000), completedAt: nil, stars: 4, quizCorrect: 2, quizTotal: 3
        )
        let data = try GuideAPIClient.syncPayload(for: [entry])
        let object = try JSONSerialization.jsonObject(with: data)
        let json = try XCTUnwrap(object as? [String: Any])
        let visits = try XCTUnwrap(json["visits"] as? [[String: Any]])
        XCTAssertEqual(visits.count, 1)
        XCTAssertNil(visits[0]["title"])
        XCTAssertNil(visits[0]["poiSlug"])
        XCTAssertEqual(visits[0]["poiId"] as? String, "poi_operaen")
        XCTAssertEqual(visits[0]["startedAt"] as? String, "2025-09-18T10:06:40Z")
        XCTAssertEqual(visits[0]["stars"] as? Int, 4)
        XCTAssertEqual(visits[0]["quizTotal"] as? Int, 3)
        XCTAssertEqual(Set(visits[0].keys), ["id", "poiId", "startedAt", "stars", "quizCorrect", "quizTotal"])
    }

    // MARK: - Hjelpere

    @MainActor
    private struct Harness {
        let settings: AppSettings
        let visits: VisitLogStore
        let transport: FakeTransport
        let sync: VisitSync
    }

    @MainActor
    private func makeSync(now: @escaping () -> Date = { Date() }) throws -> Harness {
        suiteName = "VisitSyncTests-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        let settings = AppSettings(defaults: defaults)
        let visits = VisitLogStore(fileURL: tempFile, now: now)
        let transport = FakeTransport()
        let sync = VisitSync(settings: settings, visits: visits, transport: transport, now: now, debounce: .milliseconds(1))
        return Harness(settings: settings, visits: visits, transport: transport, sync: sync)
    }

    private func makePoi(slug: String) -> GuidePOI {
        GuidePOI(
            id: "poi_\(slug)", slug: slug, areaId: "area", categoryId: "historisk", lat: 59.9, lng: 10.7,
            triggerRadiusM: 40, priority: 0, sortOrder: 0, freePreview: false, heroImageUrl: nil, heroImageAlt: nil,
            title: slug, subtitle: nil, summary: nil, locationLabel: nil, practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: "draft", available: ["nb"]),
            variants: GuideVariants(narration: nil, audioDescription: nil),
            quiz: nil, rating: nil, shareUrl: nil
        )
    }
}

/// Falsk transport: husker kallene og kan feile én gang.
@MainActor
private final class FakeTransport: VisitSyncTransport {
    struct SyncCall {
        let deviceId: String
        let visits: [VisitEntry]
    }

    var syncCalls: [SyncCall] = []
    var deletedVisitIds: [String] = []
    var deleteVisitsCalls: [String] = []
    var deleteDataCalls: [String] = []
    var failNext = false

    private func failIfAsked() throws {
        if failNext {
            failNext = false
            throw GuideAPIError.httpStatus(503)
        }
    }

    func syncVisits(deviceId: String, visits: [VisitEntry]) async throws -> VisitSyncResponse {
        try failIfAsked()
        syncCalls.append(SyncCall(deviceId: deviceId, visits: visits))
        return VisitSyncResponse(deviceId: deviceId, saved: visits.count, skipped: [], retentionDays: 365, visits: [])
    }

    func deleteVisit(deviceId: String, id: String) async throws {
        try failIfAsked()
        deletedVisitIds.append(id)
    }

    func deleteVisits(deviceId: String) async throws {
        try failIfAsked()
        deleteVisitsCalls.append(deviceId)
    }

    func deleteDeviceData(deviceId: String) async throws -> DeviceDeletionResponse {
        try failIfAsked()
        deleteDataCalls.append(deviceId)
        return DeviceDeletionResponse(deviceId: deviceId, deleted: .init(visits: 1, ratings: 1))
    }
}
