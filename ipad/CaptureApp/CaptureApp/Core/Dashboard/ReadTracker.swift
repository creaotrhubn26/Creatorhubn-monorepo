import Foundation
import Observation

/// Tracks which conversations the photographer has opened this session so the
/// inbox can clear unread badges optimistically. The communication backend has
/// no explicit mark-as-read endpoint (Evendi auto-clears server-side on read;
/// the others don't), so this is a local, immediate UX layer — badges clear the
/// moment you open a thread and stay cleared until the server's own count
/// catches up on the next refresh.
@MainActor
@Observable
final class ReadTracker {
    static let shared = ReadTracker()

    private(set) var readIds: Set<String> = []

    func markRead(_ id: String) {
        guard !id.isEmpty else { return }
        readIds.insert(id)
    }

    func isRead(_ id: String) -> Bool { readIds.contains(id) }

    /// Effective unread count for a row — 0 once opened locally.
    func unread(_ id: String, serverCount: Int) -> Int {
        readIds.contains(id) ? 0 : serverCount
    }
}
