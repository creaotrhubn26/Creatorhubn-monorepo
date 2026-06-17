// ActiveVisitActivity.swift
//
// ActivityKit-attributter for Live Activity 'Pågående besøk'. Vises
// på iPad/iPhone låseskjerm + Dynamic Island. Stoppes når selger
// fullfører visit-loggen.
//
// Krever:
//   - NSSupportsLiveActivities = true i Info.plist
//   - Widget Extension som rendrer ActivityWidget (her i
//     LeadMapWidget-bundle)

import ActivityKit
import Foundation

/// Manager for å starte/stoppe Live Activity fra app-en.
@available(iOS 16.1, *)
@MainActor
final class ActiveVisitManager {
    static let shared = ActiveVisitManager()
    private var currentActivity: Activity<ActiveVisitAttributes>?

    private init() {}

    var isRunning: Bool { currentActivity != nil }

    /// Start Live Activity for besøk på lead.
    func start(lead: LeadModel) {
        // Stopp evt. eksisterende
        Task { await stop() }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attrs = ActiveVisitAttributes(
            leadName: lead.name,
            leadAddress: lead.address,
            startedAt: Date(),
            leadId: lead.id,
        )
        let state = ActiveVisitAttributes.ContentState(
            elapsedSeconds: 0,
            statusLabel: "Pågår",
        )
        do {
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: state, staleDate: nil)
                currentActivity = try Activity.request(
                    attributes: attrs,
                    content: content,
                )
            } else {
                currentActivity = try Activity.request(
                    attributes: attrs,
                    contentState: state,
                )
            }
        } catch {
            print("[Live Activity] start failed: \(error)")
        }
    }

    /// Oppdater elapsed-tid + status (kalt fra timer)
    func update(elapsedSeconds: Int, statusLabel: String = "Pågår") async {
        guard currentActivity != nil else { return }
        let state = ActiveVisitAttributes.ContentState(
            elapsedSeconds: elapsedSeconds,
            statusLabel: statusLabel,
        )
        // Snapshot via id for å unngå Sendable-issues på Activity-objektet
        let activityId = currentActivity?.id
        guard let activityId else { return }
        await Self.performUpdate(activityId: activityId, state: state)
    }

    /// Stopp Live Activity (kall etter visit-logg er lagret)
    func stop() async {
        guard currentActivity != nil else { return }
        let final = ActiveVisitAttributes.ContentState(
            elapsedSeconds: 0,
            statusLabel: "Fullført",
        )
        let activityId = currentActivity?.id
        guard let activityId else { return }
        await Self.performEnd(activityId: activityId, state: final)
        currentActivity = nil
    }

    /// Re-finn activity ved id og kall update. Activity-API'et er
    /// ikke Sendable; vi finner og kaller inline for å unngå at
    /// referansen krysser actor-grenser.
    private nonisolated static func performUpdate(
        activityId: String,
        state: ActiveVisitAttributes.ContentState,
    ) async {
        for activity in Activity<ActiveVisitAttributes>.activities {
            guard activity.id == activityId else { continue }
            if #available(iOS 16.2, *) {
                await activity.update(ActivityContent(state: state, staleDate: nil))
            } else {
                await activity.update(using: state)
            }
            return
        }
    }

    private nonisolated static func performEnd(
        activityId: String,
        state: ActiveVisitAttributes.ContentState,
    ) async {
        for activity in Activity<ActiveVisitAttributes>.activities {
            guard activity.id == activityId else { continue }
            if #available(iOS 16.2, *) {
                await activity.end(
                    ActivityContent(state: state, staleDate: nil),
                    dismissalPolicy: .immediate,
                )
            } else {
                await activity.end(using: state, dismissalPolicy: .immediate)
            }
            return
        }
    }
}
