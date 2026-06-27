// DiscoveryRunState.swift
//
// State-machine for "Finn leads"-flyten i Research-tab. Driver
// DiscoveryProgressView slik at brukeren ser konkrete stage-meldinger
// (Søker kandidater → Fant N → Researcher X av N → Suksess) i stedet
// for en generisk spinner i 2-5 min.
//
// Stages
//   .idle              — ingen aktiv kjøring
//   .starting          — POST /discover-leads i flight (Google Places-søk)
//   .foundCandidates   — batch_id mottatt, items ikke begynt
//   .processing        — minst 1 item ferdig (per-URL research kjører)
//   .finalizing        — siste items + counter-recompute
//   .success           — alle items behandlet, hero-card vises
//   .failed            — start-kall eller fatal poll-feil
//
// Driver elapsed/ETA selv (Timer + pace-beregning fra completed/elapsed)
// — backend gir oss `eta_seconds` i progress-respons, men vi
// foretrekker lokal beregning så UI tikker hvert sekund og UI-eta
// matcher det brukeren ser i "brukt"-feltet.

import Foundation
import Observation

/// De ulike stagene brukeren kan se i "Finn leads"-progresjonen.
/// Knyttet 1:1 til DiscoveryProgressView-headeren.
enum DiscoveryStage: Equatable, Sendable {
    case idle
    case starting
    case foundCandidates(Int)
    case processing
    case finalizing
    case success(DiscoverySuccessSummary)
    case failed(String)

    /// Sant så lenge UI skal vise progress-kortet (ikke success/failed/idle).
    var isRunning: Bool {
        switch self {
        case .starting, .foundCandidates, .processing, .finalizing:
            return true
        case .idle, .success, .failed:
            return false
        }
    }
}

/// Aggregert breakdown vist i success-hero.
struct DiscoveryConfidenceBreakdown: Equatable, Sendable {
    let exact: Int
    let geocoded: Int
    let approximate: Int
    let unknown: Int
    let failed: Int

    static let zero = DiscoveryConfidenceBreakdown(
        exact: 0, geocoded: 0, approximate: 0, unknown: 0, failed: 0,
    )
}

/// Snapshot brukt av hero-cardet etter at batchen er ferdig.
struct DiscoverySuccessSummary: Equatable, Sendable {
    let totalPinned: Int
    let totalAttempted: Int
    let breakdown: DiscoveryConfidenceBreakdown
    let totalDurationSeconds: Int
    let projectName: String?
}

/// Observable state-holder som DiscoveryProgressView binder mot.
/// Driver elapsed-tick på sin egen Task; ETA beregnes fra observert
/// pace (completed/elapsed) så det er konsistent med "brukt"-feltet.
@MainActor
@Observable
final class DiscoveryRunState {
    var stage: DiscoveryStage = .idle
    var items: [BulkUrlBatchItem] = []
    var startedAt: Date?
    var batchId: String?
    var elapsedSeconds: Int = 0
    /// Lokalt beregnet ETA basert på pace. nil før vi har minst 1 ferdig item.
    var etaSeconds: Int?
    var completed: Int = 0
    var failed: Int = 0
    var pinned: Int = 0
    var total: Int = 0
    var projectName: String?

    // MARK: - Reset / lifecycle

    func reset() {
        stage = .idle
        items = []
        startedAt = nil
        batchId = nil
        elapsedSeconds = 0
        etaSeconds = nil
        completed = 0
        failed = 0
        pinned = 0
        total = 0
        projectName = nil
    }

    func begin(projectName: String?) {
        reset()
        self.projectName = projectName
        self.startedAt = Date()
        self.stage = .starting
    }

    // MARK: - Formatters

    /// MM:SS-streng for elapsed. Brukes i "⏱️ MM:SS brukt".
    func formattedElapsed() -> String {
        format(seconds: elapsedSeconds)
    }

    /// MM:SS-streng for ETA, eller nil hvis vi ikke har en pålitelig pace ennå.
    func formattedEta() -> String? {
        guard let eta = etaSeconds, eta > 0 else { return nil }
        return format(seconds: eta)
    }

    private func format(seconds: Int) -> String {
        let safe = max(0, seconds)
        let m = safe / 60
        let s = safe % 60
        return String(format: "%02d:%02d", m, s)
    }

    // MARK: - ETA

    /// Re-beregn ETA basert på observert pace.
    /// pace = completed / elapsedSeconds → remaining = total - completed
    /// → eta = remaining / pace. Failed items teller som "completed" siden de
    /// også er ferdig-prosessert.
    func updateETA() {
        let done = completed + failed
        guard done > 0, elapsedSeconds > 0, total > done else {
            etaSeconds = nil
            return
        }
        let pace = Double(done) / Double(elapsedSeconds)
        let remaining = total - done
        guard pace > 0 else { etaSeconds = nil; return }
        etaSeconds = max(1, Int((Double(remaining) / pace).rounded()))
    }

    // MARK: - Progress fraction

    /// 0.0-1.0, brukt av ProgressView-bar i stage 3.
    var fraction: Double {
        guard total > 0 else { return 0 }
        return min(1.0, Double(completed + failed) / Double(total))
    }
}
