// PlayerActivityManager.swift
//
// Starter/oppdaterer/avslutter «Nå spilles»-Live Activity (låseskjerm +
// Dynamic Island, pakke 2 item 6). PlayerViewModel kaller inn ved kjente
// livssyklus-punkter (start, kapittelbytte, spill/pause, avslutt/stopp);
// avstand til neste stopp regnes ut HER (ikke i PlayerViewModel) og
// throttles så vi ikke oppdaterer Live Activity oftere enn nødvendig.
//
// Kun app-target-et — widget-extension-target-et bruker bare den delte
// PlayerActivityAttributes.swift (ActivityKit leverer selve dataflyten
// mellom prosessene, ikke en App Group).
//
// Mac Catalyst har ikke ActivityKit — hele fila gates ut, samme mønster som
// LeadMap (LeadMapApp/Core/ActiveVisitActivity.swift). Unstrukturerte
// `Task { }` opprettet inne i en @MainActor-metode arver MainActor
// (Swift inferer isolasjon fra kallstedet), så `await`-kallene under
// trenger ingen eksplisitt `@MainActor in` — identisk med LeadMaps
// ActiveVisitManager.

#if !targetEnvironment(macCatalyst)

import ActivityKit
import Foundation

@available(iOS 16.1, *)
@MainActor
final class PlayerActivityManager {
    static let shared = PlayerActivityManager()

    /// Throttle for avstand-til-neste-stopp-oppdateringer.
    private static let distanceUpdateInterval: TimeInterval = 20
    private static let distanceRepeatThresholdM: Double = 25

    private var currentActivity: Activity<PlayerActivityAttributes>?
    private var location: LocationService?
    private var store: AreaStore?
    private var visits: VisitLogStore?
    private var settings: AppSettings?

    private var lastDistanceUpdateAt: Date?
    private var lastDistanceReportedM: Double?

    private init() {}

    var isRunning: Bool { currentActivity != nil }

    /// Kobler til de andre butikkene appen allerede har (kalt én gang fra
    /// AppEnvironment.init). Disse lever like lenge som appen selv, så
    /// vanlige (sterke) referanser er trygt — ingen egen livssyklus å
    /// holde styr på.
    func configure(location: LocationService, store: AreaStore, visits: VisitLogStore, settings: AppSettings) {
        self.location = location
        self.store = store
        self.visits = visits
        self.settings = settings
    }

    func start(poi: GuidePOI, chapter: GuideChapter, chapterCount: Int, positionS: Double, durationS: Double, isPlaying: Bool) {
        Task { await endInternal() }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        lastDistanceUpdateAt = nil
        lastDistanceReportedM = nil
        let attrs = PlayerActivityAttributes(poiTitle: poi.title, poiId: poi.id)
        let state = makeState(poi: poi, chapter: chapter, chapterCount: chapterCount, positionS: positionS, durationS: durationS, isPlaying: isPlaying)
        do {
            let content = ActivityContent(state: state, staleDate: nil)
            currentActivity = try Activity.request(attributes: attrs, content: content)
        } catch {
            // Live Activity er et pluss, ikke kritisk for avspilling.
        }
    }

    func updatePlayback(poi: GuidePOI, chapter: GuideChapter, chapterCount: Int, positionS: Double, durationS: Double, isPlaying: Bool) {
        guard let activityId = currentActivity?.id else { return }
        let state = makeState(poi: poi, chapter: chapter, chapterCount: chapterCount, positionS: positionS, durationS: durationS, isPlaying: isPlaying)
        Task { await Self.performUpdate(activityId: activityId, state: state) }
    }

    /// Kalt fra avspillerens ticker (hvert 250. ms mens den spiller). Selve
    /// Live Activity-oppdateringen throttles internt til maks hvert
    /// 20. sekund eller 25 m bevegelse.
    func updateDistanceIfNeeded(
        currentPoiId: String,
        poi: GuidePOI,
        chapter: GuideChapter,
        chapterCount: Int,
        positionS: Double,
        durationS: Double,
        isPlaying: Bool
    ) {
        guard currentActivity != nil, let location, let store, let visits else { return }
        guard let fix = location.fix else { return }
        guard let next = VeiviserTarget.resolve(.nextStop, pois: store.pois, visitedIds: visits.visitedPoiIds, excludingId: currentPoiId) else { return }
        let distanceM = Geo.distanceM(from: fix.coordinate, to: next.coordinate)
        let now = Date()
        let movedEnough = lastDistanceReportedM.map { abs($0 - distanceM) >= Self.distanceRepeatThresholdM } ?? true
        let timedOut = lastDistanceUpdateAt.map { now.timeIntervalSince($0) >= Self.distanceUpdateInterval } ?? true
        guard movedEnough || timedOut else { return }
        lastDistanceReportedM = distanceM
        lastDistanceUpdateAt = now
        updatePlayback(poi: poi, chapter: chapter, chapterCount: chapterCount, positionS: positionS, durationS: durationS, isPlaying: isPlaying)
    }

    func end() {
        Task { await endInternal() }
    }

    // MARK: - Privat

    private func makeState(
        poi: GuidePOI,
        chapter: GuideChapter,
        chapterCount: Int,
        positionS: Double,
        durationS: Double,
        isPlaying: Bool
    ) -> PlayerActivityAttributes.ContentState {
        let uiLang = settings?.uiLanguage ?? "nb"
        let locale = settings?.locale ?? Locale(identifier: "nb")
        let now = Date()
        let safeDuration = max(durationS, 0.01)
        let clampedPosition = min(max(0, positionS), safeDuration)
        let start = now.addingTimeInterval(-clampedPosition)
        let end = start.addingTimeInterval(safeDuration)
        let pausedProgress = min(1, max(0, clampedPosition / safeDuration))

        let chapterProgress = L10n.string("liveActivity.chapterProgress", lang: uiLang)
            .replacingOccurrences(of: "%1$@", with: "\(chapter.no)")
            .replacingOccurrences(of: "%2$@", with: "\(chapterCount)")
        let statusText = L10n.string(isPlaying ? "player.play" : "player.pause", lang: uiLang)

        var distanceText: String?
        if let distanceM = lastDistanceReportedM {
            distanceText = L10n.string("liveActivity.distanceToNext", lang: uiLang)
                .replacingOccurrences(of: "%@", with: L10n.distance(meters: distanceM, locale: locale))
        }

        let summaryParts = [poi.title, chapter.title, chapterProgress, statusText, distanceText].compactMap { $0 }

        return PlayerActivityAttributes.ContentState(
            chapterTitle: chapter.title,
            chapterProgressText: chapterProgress,
            statusText: statusText,
            isPlaying: isPlaying,
            playbackRangeStart: start,
            playbackRangeEnd: end,
            pausedProgress: pausedProgress,
            distanceText: distanceText,
            accessibilitySummary: summaryParts.joined(separator: ", ")
        )
    }

    /// Activity-API'et er ikke Sendable; vi finner aktiviteten via id og
    /// kaller inline for å unngå at referansen krysser actor-grenser
    /// (samme mønster som LeadMaps ActiveVisitManager).
    private nonisolated static func performUpdate(activityId: String, state: PlayerActivityAttributes.ContentState) async {
        for activity in Activity<PlayerActivityAttributes>.activities {
            guard activity.id == activityId else { continue }
            await activity.update(ActivityContent(state: state, staleDate: nil))
            return
        }
    }

    private nonisolated static func performEnd(activityId: String) async {
        for activity in Activity<PlayerActivityAttributes>.activities {
            guard activity.id == activityId else { continue }
            await activity.end(nil, dismissalPolicy: .immediate)
            return
        }
    }

    private func endInternal() async {
        guard let activityId = currentActivity?.id else { return }
        currentActivity = nil
        await Self.performEnd(activityId: activityId)
    }
}

#endif  // !macCatalyst
