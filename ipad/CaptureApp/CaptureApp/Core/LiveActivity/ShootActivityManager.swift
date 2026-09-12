// ShootActivityManager.swift
//
// Starter/oppdaterer/avslutter «shoot i gang»-Live Activity fra app-siden.
// Kalles ved øktstart, hver capture, og øktavslutning i capture-modellen.
//
// Merk (Swift 6): Activity<> er en ikke-Sendable class og update/end er
// nonisolated async. Vi holder derfor manageren nonisolated (ikke @MainActor)
// så Activity-verdien aldri sendes over en isolasjonsgrense. Alle kall skjer
// serialisert via denne singletonen → @unchecked Sendable er trygt.

import Foundation
import ActivityKit

@available(iOS 16.1, *)
final class ShootActivityManager: @unchecked Sendable {
    static let shared = ShootActivityManager()
    nonisolated(unsafe) private var activity: Activity<ShootActivityAttributes>?

    func start(sessionName: String, startedAt: Date = Date()) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled, activity == nil else { return }
        let attributes = ShootActivityAttributes(sessionName: sessionName, startedAt: startedAt)
        let state = ShootActivityAttributes.ContentState(shotCount: 0, lastFilename: nil, tethered: true)
        activity = try? Activity.request(
            attributes: attributes,
            content: .init(state: state, staleDate: nil)
        )
    }

    func update(shotCount: Int, lastFilename: String?, tethered: Bool) async {
        guard let current = activity else { return }
        let state = ShootActivityAttributes.ContentState(
            shotCount: shotCount, lastFilename: lastFilename, tethered: tethered)
        await current.update(.init(state: state, staleDate: nil))
    }

    func end() async {
        guard let current = activity else { return }
        activity = nil
        await current.end(nil, dismissalPolicy: .immediate)
    }
}
