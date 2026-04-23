import XCTest
@testable import CaptureApp

/// Tests for the cross-launch resume bookkeeping. Drives the store
/// with a fresh UserDefaults suite per test so the simulator's
/// shared domain stays clean. The pure ``shouldOfferResume`` +
/// ``relativeDescription`` helpers are tested separately since they
/// encode the resume-prompt UX (stale cutoff, Norwegian phrasing).
final class SessionContinuityStoreTests: XCTestCase {

    private var defaults: UserDefaults!
    private let key = "test-pending-session"

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "continuity-\(UUID())")!
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "continuity")
        super.tearDown()
    }

    private func makeStore() -> SessionContinuityStore {
        SessionContinuityStore(defaults: defaults, key: key)
    }

    // MARK: - Begin / complete

    func testBeginPersistsPendingSession() throws {
        let store = makeStore()
        let id = UUID()
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        store.beginSession(
            sessionId: id,
            projectId: "p-1",
            displayName: "Bea bryllup",
            now: start,
        )
        let loaded = try XCTUnwrap(store.pendingSession)
        XCTAssertEqual(loaded.sessionId, id)
        XCTAssertEqual(loaded.projectId, "p-1")
        XCTAssertEqual(loaded.displayName, "Bea bryllup")
        XCTAssertEqual(loaded.startedAt.timeIntervalSince1970, 1_700_000_000, accuracy: 0.01)
        XCTAssertEqual(loaded.lastHeartbeatAt, loaded.startedAt,
            "initial heartbeat must equal startedAt")
    }

    func testBeginOverwritesPriorSession() throws {
        let store = makeStore()
        store.beginSession(sessionId: UUID(), projectId: nil, displayName: "Old")
        let newId = UUID()
        store.beginSession(sessionId: newId, projectId: "p-2", displayName: "New")
        XCTAssertEqual(store.pendingSession?.sessionId, newId,
            "a fresh begin must replace the dangling handle, not append")
    }

    func testCompleteClearsPendingSession() {
        let store = makeStore()
        store.beginSession(sessionId: UUID(), projectId: nil, displayName: "Foo")
        store.completeSession()
        XCTAssertNil(store.pendingSession)
    }

    // MARK: - Heartbeat

    func testHeartbeatAdvancesLastHeartbeatAt() throws {
        let store = makeStore()
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        store.beginSession(sessionId: UUID(), projectId: nil, displayName: "Foo", now: start)
        let later = start.addingTimeInterval(300)
        store.heartbeat(now: later)
        let loaded = try XCTUnwrap(store.pendingSession)
        XCTAssertEqual(loaded.startedAt, start, "startedAt must stay fixed")
        XCTAssertEqual(loaded.lastHeartbeatAt, later)
    }

    func testHeartbeatWithoutPriorBeginIsNoOp() {
        let store = makeStore()
        store.heartbeat()
        XCTAssertNil(store.pendingSession,
            "a dangling heartbeat must not conjure a pending session out of nothing")
    }

    // MARK: - Defensive load

    func testReturnsNilWhenSlotEmpty() {
        XCTAssertNil(makeStore().pendingSession)
    }

    func testReturnsNilOnCorruptPayload() {
        // Simulate a prior write with an incompatible schema.
        defaults.set(Data("not-json".utf8), forKey: key)
        XCTAssertNil(makeStore().pendingSession,
            "a corrupt payload must behave as 'no pending session' — not wedge the app with a perpetual resume prompt")
    }

    // MARK: - shouldOfferResume

    func testShouldOfferResumeTrueForRecentHandle() {
        let pending = SessionContinuityStore.PendingSession(
            sessionId: UUID(),
            projectId: nil,
            displayName: "x",
            startedAt: Date(timeIntervalSince1970: 1_700_000_000),
            lastHeartbeatAt: Date(timeIntervalSince1970: 1_700_001_000),
        )
        XCTAssertTrue(SessionContinuityStore.shouldOfferResume(
            pending: pending,
            now: Date(timeIntervalSince1970: 1_700_001_100),
        ))
    }

    func testShouldOfferResumeFalseForStaleHandle() {
        let pending = SessionContinuityStore.PendingSession(
            sessionId: UUID(),
            projectId: nil,
            displayName: "x",
            startedAt: Date(timeIntervalSince1970: 1_700_000_000),
            lastHeartbeatAt: Date(timeIntervalSince1970: 1_700_000_100),
        )
        // 48 hours later — well past the default 24h cutoff.
        let now = Date(timeIntervalSince1970: 1_700_000_100 + 48 * 3600)
        XCTAssertFalse(SessionContinuityStore.shouldOfferResume(pending: pending, now: now))
    }

    func testShouldOfferResumeFalseForNilHandle() {
        XCTAssertFalse(SessionContinuityStore.shouldOfferResume(pending: nil))
    }

    func testShouldOfferResumeFalseForFutureHeartbeat() {
        // Clock skew: persisted heartbeat says 2027, device clock
        // says 2026. Treat as abandoned rather than showing a
        // resume prompt for a shoot that "started" in the future.
        let pending = SessionContinuityStore.PendingSession(
            sessionId: UUID(),
            projectId: nil,
            displayName: "x",
            startedAt: Date(timeIntervalSince1970: 1_900_000_000),
            lastHeartbeatAt: Date(timeIntervalSince1970: 1_900_000_000),
        )
        XCTAssertFalse(SessionContinuityStore.shouldOfferResume(
            pending: pending,
            now: Date(timeIntervalSince1970: 1_700_000_000),
        ))
    }

    func testShouldOfferResumeRespectsCustomCutoff() {
        let pending = SessionContinuityStore.PendingSession(
            sessionId: UUID(),
            projectId: nil,
            displayName: "x",
            startedAt: Date(timeIntervalSince1970: 1_700_000_000),
            lastHeartbeatAt: Date(timeIntervalSince1970: 1_700_000_100),
        )
        // 10 minutes later — inside default 24h but outside a tight
        // 5-minute cutoff.
        let now = Date(timeIntervalSince1970: 1_700_000_100 + 600)
        XCTAssertTrue(SessionContinuityStore.shouldOfferResume(
            pending: pending, now: now, staleCutoff: 3600,
        ))
        XCTAssertFalse(SessionContinuityStore.shouldOfferResume(
            pending: pending, now: now, staleCutoff: 300,
        ))
    }

    // MARK: - relativeDescription

    func testRelativeDescriptionAkkuratNaa() {
        let pending = SessionContinuityStore.PendingSession(
            sessionId: UUID(), projectId: nil, displayName: "x",
            startedAt: Date(), lastHeartbeatAt: Date(timeIntervalSince1970: 1_700_000_000),
        )
        XCTAssertEqual(
            SessionContinuityStore.relativeDescription(
                for: pending,
                now: Date(timeIntervalSince1970: 1_700_000_030),
            ),
            "Akkurat nå",
        )
    }

    func testRelativeDescriptionMinutes() {
        let pending = SessionContinuityStore.PendingSession(
            sessionId: UUID(), projectId: nil, displayName: "x",
            startedAt: Date(), lastHeartbeatAt: Date(timeIntervalSince1970: 1_700_000_000),
        )
        XCTAssertEqual(
            SessionContinuityStore.relativeDescription(
                for: pending,
                now: Date(timeIntervalSince1970: 1_700_000_060),
            ),
            "1 minutt siden",
        )
        XCTAssertEqual(
            SessionContinuityStore.relativeDescription(
                for: pending,
                now: Date(timeIntervalSince1970: 1_700_000_600),
            ),
            "10 minutter siden",
        )
    }

    func testRelativeDescriptionHours() {
        let pending = SessionContinuityStore.PendingSession(
            sessionId: UUID(), projectId: nil, displayName: "x",
            startedAt: Date(), lastHeartbeatAt: Date(timeIntervalSince1970: 1_700_000_000),
        )
        XCTAssertEqual(
            SessionContinuityStore.relativeDescription(
                for: pending,
                now: Date(timeIntervalSince1970: 1_700_003_600),
            ),
            "1 time siden",
        )
        XCTAssertEqual(
            SessionContinuityStore.relativeDescription(
                for: pending,
                now: Date(timeIntervalSince1970: 1_700_018_000),
            ),
            "5 timer siden",
        )
    }

    func testRelativeDescriptionNegativeClampsToAkkuratNaa() {
        // Clock skew can yield a "future" heartbeat; don't render
        // "-30 minutter siden".
        let pending = SessionContinuityStore.PendingSession(
            sessionId: UUID(), projectId: nil, displayName: "x",
            startedAt: Date(), lastHeartbeatAt: Date(timeIntervalSince1970: 1_700_001_000),
        )
        XCTAssertEqual(
            SessionContinuityStore.relativeDescription(
                for: pending,
                now: Date(timeIntervalSince1970: 1_700_000_000),
            ),
            "Akkurat nå",
        )
    }
}
