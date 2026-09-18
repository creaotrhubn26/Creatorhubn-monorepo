import Foundation
import XCTest
@testable import LeadMapApp

@MainActor
final class CanvasPersistenceTests: XCTestCase {
    func testCanvasPaginationGuardAcceptsTerminalPageAtSafetyLimit() throws {
        var pagination = CanvasPaginationGuard(maximumPageCount: 2)

        XCTAssertEqual(try pagination.nextCursor(from: "cursor-1"), "cursor-1")
        XCTAssertNil(try pagination.nextCursor(from: nil))
        XCTAssertEqual(pagination.receivedPageCount, 2)
    }

    func testCanvasPaginationGuardRejectsDuplicateCursor() throws {
        var pagination = CanvasPaginationGuard(maximumPageCount: 3)
        _ = try pagination.nextCursor(from: "cursor-1")

        XCTAssertThrowsError(try pagination.nextCursor(from: "cursor-1")) { error in
            guard case APIError.invalidResponse = error else {
                return XCTFail("Forventet APIError.invalidResponse, fikk \(error)")
            }
        }
    }

    func testCanvasPaginationGuardRejectsCursorBeyondSafetyLimit() throws {
        var pagination = CanvasPaginationGuard(maximumPageCount: 2)
        _ = try pagination.nextCursor(from: "cursor-1")

        XCTAssertThrowsError(try pagination.nextCursor(from: "cursor-2")) { error in
            guard case APIError.invalidResponse = error else {
                return XCTFail("Forventet APIError.invalidResponse, fikk \(error)")
            }
        }
    }

    func testCanvasPaginationGuardRejectsEmptyCursor() {
        var pagination = CanvasPaginationGuard(maximumPageCount: 2)

        XCTAssertThrowsError(try pagination.nextCursor(from: "")) { error in
            guard case APIError.invalidResponse = error else {
                return XCTFail("Forventet APIError.invalidResponse, fikk \(error)")
            }
        }
    }

    func testSaveCoordinatorSerializesOperationsForSameNote() async {
        let coordinator = CanvasSaveCoordinator()
        var events: [String] = []

        coordinator.enqueue(noteID: "note-a") {
            events.append("first-start")
            try? await Task.sleep(nanoseconds: 30_000_000)
            events.append("first-end")
        }
        coordinator.enqueue(noteID: "note-a") {
            events.append("second")
        }

        await coordinator.wait(for: "note-a")
        XCTAssertEqual(events, ["first-start", "first-end", "second"])
        XCTAssertTrue(coordinator.pendingNoteIDs.isEmpty)
    }

    func testSaveCoordinatorBarrierFollowsSuccessorEnqueuedWhileWaiting() async {
        let coordinator = CanvasSaveCoordinator()
        var events: [String] = []

        coordinator.enqueue(noteID: "note-a") {
            events.append("first-start")
            try? await Task.sleep(nanoseconds: 30_000_000)
            events.append("first-end")
        }
        let barrier = Task { @MainActor in
            await coordinator.wait(for: "note-a")
            events.append("barrier-end")
        }
        try? await Task.sleep(nanoseconds: 5_000_000)
        coordinator.enqueue(noteID: "note-a") {
            events.append("second-start")
            try? await Task.sleep(nanoseconds: 40_000_000)
            events.append("second-end")
        }

        await barrier.value
        XCTAssertEqual(
            events,
            ["first-start", "first-end", "second-start", "second-end", "barrier-end"])
        XCTAssertTrue(coordinator.pendingNoteIDs.isEmpty)
    }

    func testDraftStoreRejectsLateOlderGenerationAndBoundsRemoval() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("canvas-draft-test-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        let store = CanvasDraftStore(rootURL: root)
        let noteID = UUID().uuidString.lowercased()

        try await store.save(
            noteID: noteID,
            generation: 4,
            encodedNote: Data("new".utf8),
            scope: "daniel@example.no|org-a")
        try await store.save(
            noteID: noteID,
            generation: 3,
            encodedNote: Data("old".utf8),
            scope: "daniel@example.no|org-a")

        var records = await store.load(scope: "daniel@example.no|org-a")
        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(records.first?.generation, 4)
        XCTAssertEqual(records.first?.encodedNote, Data("new".utf8))

        await store.remove(
            noteID: noteID,
            scope: "daniel@example.no|org-a",
            upToGeneration: 3)
        records = await store.load(scope: "daniel@example.no|org-a")
        XCTAssertEqual(records.count, 1)

        await store.remove(
            noteID: noteID,
            scope: "daniel@example.no|org-a",
            upToGeneration: 4)
        records = await store.load(scope: "daniel@example.no|org-a")
        XCTAssertTrue(records.isEmpty)
    }

    func testDraftStoreIsolatesOrganizations() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("canvas-scope-test-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        let store = CanvasDraftStore(rootURL: root)

        try await store.save(
            noteID: "note-a",
            generation: 1,
            encodedNote: Data("org-a".utf8),
            scope: "daniel@example.no|org-a")
        try await store.save(
            noteID: "note-b",
            generation: 1,
            encodedNote: Data("org-b".utf8),
            scope: "daniel@example.no|org-b")

        let orgA = await store.load(scope: "daniel@example.no|org-a")
        let orgB = await store.load(scope: "daniel@example.no|org-b")
        XCTAssertEqual(orgA.map(\.noteID), ["note-a"])
        XCTAssertEqual(orgB.map(\.noteID), ["note-b"])
    }
}
