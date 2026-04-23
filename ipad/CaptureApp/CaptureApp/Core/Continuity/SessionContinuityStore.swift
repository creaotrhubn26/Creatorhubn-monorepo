import Foundation

/// Cross-launch bookkeeping for the "did the photographer leave a
/// shoot unfinished?" question.
///
/// The existing ``currentSessionId`` lives in SwiftUI ``@State`` and
/// evaporates on app kill — so a photographer who force-quits mid-
/// shoot (or crashes, or the OS reclaims the app during a phone
/// call) loses the thread-back to their active session. This store
/// persists just enough in ``UserDefaults`` that ``TodayView`` can
/// detect the dangling state on next launch and offer a one-tap
/// resume.
///
/// Two events write the store:
///   * ``beginSession`` — captured session id + project + start
///     time. Written when the photographer starts a tether.
///   * ``completeSession`` — clears the handle. Written when the
///     session is explicitly ended (delivery, manual close, cancel).
///
/// The key insight is that a "lingering" session on launch means
/// the prior process didn't call ``completeSession``. That's the
/// signal that work was interrupted.
///
/// Everything is serialised via plain ``Codable`` into a single
/// defaults key so reads + writes are atomic. Tests inject a fake
/// UserDefaults to avoid polluting the simulator's shared domain.
struct SessionContinuityStore {

    /// Snapshot persisted between launches. Lean on purpose — only
    /// the minimum needed to drive a resume prompt + light
    /// recovery. The bulk of session state (asset rows, ratings,
    /// shot-list ticks) lives in GRDB and is rehydrated by the
    /// normal read paths.
    struct PendingSession: Codable, Equatable, Sendable {
        let sessionId: UUID
        let projectId: String?
        let displayName: String
        let startedAt: Date
        /// Last time the session UI saw the photographer interact —
        /// updated by ``heartbeat``. Used to render a "X minutter
        /// siden" hint on the resume prompt so stale handles from
        /// hours ago don't look equally inviting as a 5-minute-old
        /// one.
        let lastHeartbeatAt: Date
    }

    static let defaultKey = "creatorhub.one.pendingSession"

    private let defaults: UserDefaults
    private let key: String

    init(defaults: UserDefaults = .standard, key: String = defaultKey) {
        self.defaults = defaults
        self.key = key
    }

    /// Load whatever was persisted on last write. Returns nil when
    /// the slot is empty OR the payload is malformed (defensive —
    /// a corrupt payload shouldn't wedge the app with a perpetual
    /// resume prompt).
    var pendingSession: PendingSession? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder.iso8601().decode(PendingSession.self, from: data)
    }

    /// Write a fresh session handle. Called when the photographer
    /// starts a tether or re-binds to an existing session.
    func beginSession(
        sessionId: UUID,
        projectId: String?,
        displayName: String,
        now: Date = Date(),
    ) {
        let pending = PendingSession(
            sessionId: sessionId,
            projectId: projectId,
            displayName: displayName,
            startedAt: now,
            lastHeartbeatAt: now,
        )
        persist(pending)
    }

    /// Refresh the heartbeat. The live capture surface calls this
    /// on each user action (shutter, rating, cull decision) so the
    /// "minutes since last activity" hint stays accurate.
    ///
    /// A heartbeat with no prior ``beginSession`` is a no-op —
    /// dangling calls shouldn't silently re-create state.
    func heartbeat(now: Date = Date()) {
        guard let existing = pendingSession else { return }
        let updated = PendingSession(
            sessionId: existing.sessionId,
            projectId: existing.projectId,
            displayName: existing.displayName,
            startedAt: existing.startedAt,
            lastHeartbeatAt: now,
        )
        persist(updated)
    }

    /// Clear the handle. Called when the session ends normally (
    /// delivery, explicit end, cancel). After this, the resume
    /// prompt won't fire on next launch.
    func completeSession() {
        defaults.removeObject(forKey: key)
    }

    // MARK: - Pure helpers (testable)

    /// Decide whether the resume prompt should appear given the
    /// current state. Extracted so the UI can bind to a plain value
    /// without the defaults indirection, and so tests can cover the
    /// stale-handle cutoff without touching storage.
    ///
    /// ``staleCutoff`` — anything older than this (relative to the
    /// last heartbeat) is treated as "probably abandoned, don't
    /// prompt". Default: 24 hours. A wedding cut last week isn't
    /// something the photographer wants to resume at midnight on
    /// the next Thursday.
    static func shouldOfferResume(
        pending: PendingSession?,
        now: Date = Date(),
        staleCutoff: TimeInterval = 24 * 3600,
    ) -> Bool {
        guard let pending else { return false }
        let age = now.timeIntervalSince(pending.lastHeartbeatAt)
        return age >= 0 && age <= staleCutoff
    }

    /// Human-friendly "X minutter siden" / "X timer siden" for the
    /// resume prompt. Pure so tests can pin the exact phrasing.
    static func relativeDescription(
        for pending: PendingSession,
        now: Date = Date(),
    ) -> String {
        let seconds = max(0, now.timeIntervalSince(pending.lastHeartbeatAt))
        if seconds < 60 {
            return "Akkurat nå"
        }
        if seconds < 3600 {
            let minutes = Int(seconds / 60)
            return "\(minutes) \(minutes == 1 ? "minutt" : "minutter") siden"
        }
        let hours = Int(seconds / 3600)
        return "\(hours) \(hours == 1 ? "time" : "timer") siden"
    }

    // MARK: - Private

    private func persist(_ value: PendingSession) {
        guard let data = try? JSONEncoder.iso8601().encode(value) else { return }
        defaults.set(data, forKey: key)
    }
}

// MARK: - ISO-8601 JSON coders

private extension JSONEncoder {
    /// Encode ``Date`` values as ISO-8601 strings so the persisted
    /// payload survives a schema rewrite on either end of the
    /// Swift/backend wire.
    static func iso8601() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

private extension JSONDecoder {
    static func iso8601() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
