// RouteTracker.swift
//
// Live tracker som:
//   - Buffrer posisjonssamples fra KartLocationManager
//   - Flusher til backend hvert 30s (eller ved 30 samples)
//   - Publiserer `adherenceStatus` basert på deviation fra dagens rute
//   - Kalkulerer `distanceToNextStop` + `etaMinutes`
//
// Bruker `withObservationTracking` for å reaktivt følge
// `KartLocationManager.currentCoordinate` uten å måtte manuelt observere.
//
// Backend flush er best-effort — nettverksfeil logges, buffer holdes.
// Idempotent på (user_id, sampled_at) sikrer at retry ikke dobbeltinserterer.

import Foundation
import Observation
import CoreLocation

/// Live-adherence for en samplet posisjon.
enum RouteAdherenceStatus: String, Codable, Sendable {
    case onRoute       // < 200m fra rute
    case warning       // 200-1000m
    case offRoute      // > 1000m
    case noRoute       // ingen aktiv rute i dag
}

@MainActor
@Observable
final class RouteTracker {
    static let shared = RouteTracker()

    // MARK: - Published state

    /// Siste kjente rute (fetched via /my-route). Nullstilles ved
    /// dags-skifte eller manuell reload.
    private(set) var currentAssignment: RouteAssignmentDTO?

    /// Progress fra siste `/my-route`-kall.
    private(set) var progress: RouteProgressDTO?

    /// Aktive besøk-log rows (siste fetch).
    private(set) var visits: [RouteVisitDTO] = []

    /// Neste ubesøkte stopp — brukes til ETA + "Neste stopp"-kort.
    private(set) var nextStop: RouteStopDTO?

    /// Adherence-status basert på siste position-sample vs rute-polylinje.
    private(set) var adherenceStatus: RouteAdherenceStatus = .noRoute

    /// Avstand i meter til nærmeste rute-linjestykke (lokal beregning).
    private(set) var currentDeviationM: Int?

    /// Avstand i meter til `nextStop` (Haversine).
    private(set) var distanceToNextStopM: Int?

    /// Estimert tid i minutter til neste stopp (basert på hastighet).
    private(set) var etaMinutes: Int?

    // MARK: - Private state

    private var buffer: [PositionSampleDTO] = []
    private var flushTask: Task<Void, Never>?
    private var trackTask: Task<Void, Never>?
    private var lastFlushAt: Date?

    /// APIClient injisert lazily. Vi lagrer weak siden APIClient eies av AppState.
    private weak var api: APIClient?

    // MARK: - Config

    private let flushIntervalSeconds: TimeInterval = 30
    private let bufferMaxSize: Int = 30
    private let onRouteThresholdM: Double = 200
    private let warningThresholdM: Double = 1000

    private init() {}

    // MARK: - Public API

    /// Kalles av OversiktView/KartView (eller app-boot) med APIClient. Idempotent —
    /// re-start ny observasjon hvis api ble byttet.
    func attach(api: APIClient) {
        self.api = api
        startObservingLocation()
    }

    /// Hent rute på nytt (typisk pull-down eller etter visit-log).
    func refreshRoute(date: String? = nil) async {
        guard let api else { return }
        do {
            let resp = try await api.fetchMyRoute(date: date)
            currentAssignment = resp.assignment
            progress = resp.progress
            visits = resp.visits
            nextStop = resp.nextStop
            etaMinutes = resp.etaNextMin
            if currentAssignment == nil {
                adherenceStatus = .noRoute
                currentDeviationM = nil
                distanceToNextStopM = nil
            } else {
                // Bruk siste posisjon (hvis vi har den) til å oppdatere status.
                if let coord = KartLocationManager.shared.currentCoordinate {
                    updateAdherence(for: coord)
                }
            }
        } catch {
            // Best-effort: la eksisterende state stå.
            #if DEBUG
            print("[RouteTracker] refreshRoute failed:", error.localizedDescription)
            #endif
        }
    }

    /// Manuell flush — kalles av VisitLogModal for å sikre at posisjoner
    /// før besøket er persistert.
    func flushNow() async {
        await flushBufferedSamples()
    }

    /// Log at bruker er ankommet en stopp. Kaller backend som
    /// beregner deviation + wasOnRoute.
    @discardableResult
    func logVisit(
        stopLeadId: String,
        coordinate: CLLocationCoordinate2D,
        notes: String? = nil
    ) async -> RouteVisitDTO? {
        guard let api, let assignmentId = currentAssignment?.id else {
            return nil
        }
        let payload = LogRouteVisitPayload(
            stopLeadId: stopLeadId,
            actualLat: coordinate.latitude,
            actualLon: coordinate.longitude,
            notes: notes
        )
        do {
            let visit = try await api.logRouteVisit(
                assignmentId: assignmentId, payload
            )
            await refreshRoute()
            return visit
        } catch {
            #if DEBUG
            print("[RouteTracker] logVisit failed:", error.localizedDescription)
            #endif
            return nil
        }
    }

    // MARK: - Observation

    /// Start reactive observation av KartLocationManager. Bruker
    /// `withObservationTracking` i en loop — når currentCoordinate endres
    /// re-registrerer vi tracker + fanger nytt sample.
    private func startObservingLocation() {
        trackTask?.cancel()
        trackTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                await self?.trackOneChange()
                // Micro-sleep for å unngå busy-loop hvis observation feilaktig
                // fyrer uten data.
                try? await Task.sleep(nanoseconds: 200_000_000) // 200ms
            }
        }
        scheduleFlushLoop()
    }

    /// Setter opp observation-callback for ÉN endring, deretter returnerer.
    /// startObservingLocation kaller dette i en loop.
    private func trackOneChange() async {
        let currentCoord = KartLocationManager.shared.currentCoordinate
        let currentSpeed = KartLocationManager.shared.isMoving
            ? (KartLocationManager.shared.heading != nil ? 1.5 : 0.0)
            : 0.0
        let currentHeading = KartLocationManager.shared.heading

        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            withObservationTracking {
                _ = KartLocationManager.shared.currentCoordinate
            } onChange: {
                Task { @MainActor in
                    cont.resume()
                }
            }
            // Første pass: hvis vi allerede har koordinater, sample dem umiddelbart.
            if let c = currentCoord {
                capture(coordinate: c, speed: currentSpeed, heading: currentHeading)
            }
        }
    }

    /// Fanger én posisjon → oppdaterer adherence + legger i buffer.
    private func capture(
        coordinate: CLLocationCoordinate2D,
        speed: Double,
        heading: Double?
    ) {
        let sample = PositionSampleDTO(
            coordinate: coordinate,
            speed: speed,
            heading: heading,
            at: Date()
        )
        buffer.append(sample)
        updateAdherence(for: coordinate)

        // Auto-flush hvis buffer er full.
        if buffer.count >= bufferMaxSize {
            Task { @MainActor in
                await flushBufferedSamples()
            }
        }
    }

    // MARK: - Adherence computation

    /// Beregner lokal deviation mot rute-polylinjen + oppdaterer state.
    /// Ikke send til backend hvis samme status som forrige sample (throttling
    /// gjøres av flush-loopen).
    private func updateAdherence(for coord: CLLocationCoordinate2D) {
        guard let stops = currentAssignment?.stops, stops.count > 0 else {
            adherenceStatus = .noRoute
            currentDeviationM = nil
            distanceToNextStopM = nil
            return
        }
        let deviation = distanceToRoutePolyline(
            lat: coord.latitude,
            lon: coord.longitude,
            stops: stops
        )
        currentDeviationM = Int(deviation)
        let newStatus: RouteAdherenceStatus
        if deviation < onRouteThresholdM {
            newStatus = .onRoute
        } else if deviation < warningThresholdM {
            newStatus = .warning
        } else {
            newStatus = .offRoute
        }
        adherenceStatus = newStatus

        // Distanse til neste stopp.
        if let ns = nextStop {
            let d = haversineMeters(
                lat1: coord.latitude, lon1: coord.longitude,
                lat2: ns.latitude, lon2: ns.longitude
            )
            distanceToNextStopM = Int(d)
        } else {
            distanceToNextStopM = nil
        }
    }

    // MARK: - Flush loop

    private func scheduleFlushLoop() {
        flushTask?.cancel()
        flushTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(30 * 1_000_000_000))
                guard let self else { return }
                await self.flushBufferedSamples()
            }
        }
    }

    private func flushBufferedSamples() async {
        guard let api, !buffer.isEmpty else { return }
        let batch = buffer
        buffer.removeAll(keepingCapacity: true)
        do {
            _ = try await api.flushPositionSamples(batch)
            lastFlushAt = Date()
        } catch {
            // Ved feil — legg buffer tilbake foran ny data så vi kan retry.
            // Prepend for å bevare rekkefølge (eldste først).
            buffer.insert(contentsOf: batch, at: 0)
            #if DEBUG
            print("[RouteTracker] flush failed:", error.localizedDescription)
            #endif
        }
    }

    // MARK: - Geometry helpers

    /// Haversine-distanse mellom to punkter (meter). Ren funksjon.
    private nonisolated func haversineMeters(
        lat1: Double, lon1: Double, lat2: Double, lon2: Double
    ) -> Double {
        let R = 6_371_000.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLon = (lon2 - lon1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2) +
            cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) *
            sin(dLon / 2) * sin(dLon / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c
    }

    /// Beregn nærmeste avstand fra et punkt til en rute-polylinje.
    /// Bruker equirectangular-projeksjon (presist nok for by-skala).
    private nonisolated func distanceToRoutePolyline(
        lat: Double, lon: Double, stops: [RouteStopDTO]
    ) -> Double {
        guard !stops.isEmpty else { return .infinity }
        if stops.count == 1 {
            return haversineMeters(
                lat1: lat, lon1: lon,
                lat2: stops[0].latitude, lon2: stops[0].longitude
            )
        }
        var minDistM = Double.infinity
        let cosLat = cos(lat * .pi / 180)
        let metersPerDegLat = 111_320.0
        for i in 0..<(stops.count - 1) {
            let a = stops[i]
            let b = stops[i + 1]
            let bx = (b.longitude - a.longitude) * metersPerDegLat * cosLat
            let by = (b.latitude - a.latitude) * metersPerDegLat
            let px = (lon - a.longitude) * metersPerDegLat * cosLat
            let py = (lat - a.latitude) * metersPerDegLat
            let lenSq = bx * bx + by * by
            var t = 0.0
            if lenSq > 0 {
                t = (px * bx + py * by) / lenSq
                t = max(0, min(1, t))
            }
            let cx = t * bx
            let cy = t * by
            let dist = hypot(px - cx, py - cy)
            if dist < minDistM { minDistM = dist }
        }
        return minDistM
    }
}
