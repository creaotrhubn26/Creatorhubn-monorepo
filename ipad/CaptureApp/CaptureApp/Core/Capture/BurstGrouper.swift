import Foundation

/// Phase 8B — Burst detection. Groups consecutive shots into "bursts"
/// based on capture-time proximity so the analyzer can score them
/// against each other and surface the best 3.
///
/// **Definition of a burst:** 3+ shots where each consecutive pair
/// landed within `maxGap` seconds. Loosely matches the Canon-burst
/// tempo at typical FPS — 6 fps = 0.17 s gap, 12 fps = 0.08 s gap.
/// 3 s default tolerates slight pauses (photographer half-pressed
/// shutter, camera buffered) without merging unrelated shots.
///
/// **Why 3 shots minimum:** A pair isn't really a burst — it's two
/// frames the photographer took intentionally. 3+ is when you START
/// reaching for "give me the best one". Lower counts don't get auto-
/// selection treatment.
///
/// **Pure function** — no I/O, no Vision calls. Takes a sorted-by-
/// captureTime array of (id, captureTime), returns burstId per asset
/// (or nil for non-burst). Unit-testable as a single grouping pass.
enum BurstGrouper {

    /// Default burst gap. 3 s is generous enough to catch pauses
    /// between half-press → release and short adjustments, narrow
    /// enough that a photographer who shoots, pauses to compose,
    /// and shoots again gets two separate bursts.
    static let defaultGapSeconds: TimeInterval = 3.0

    /// Minimum shots for a group to count as a burst. Pairs are
    /// intentional double-tap, not "pick the best".
    static let minShotsPerBurst = 3

    /// Output entry for one input asset.
    struct Entry: Equatable {
        let assetId: UUID
        /// Burst group ID. Nil when the asset isn't part of a
        /// burst (single shot, or in a 2-shot cluster below the
        /// minimum).
        let burstGroupId: UUID?
    }

    /// Group `assets` (each pair: id + captureTime) into bursts.
    /// `assets` does NOT need to be sorted; the function sorts
    /// internally by captureTime. Output preserves the input order.
    ///
    /// Algorithm:
    ///   1. Sort by captureTime (ascending)
    ///   2. Walk pairs — accumulate into a candidate cluster while
    ///      the gap between consecutive captures is ≤ `gap`
    ///   3. When the gap exceeds `gap` (or we hit the end), emit
    ///      the cluster: assign a fresh burstId if it has ≥ min
    ///      shots, else mark as non-burst (nil)
    ///   4. Return entries in the ORIGINAL input order so callers
    ///      can zip back to their source array
    static func group(
        _ assets: [(id: UUID, captureTime: Date)],
        gap: TimeInterval = defaultGapSeconds,
        minShots: Int = minShotsPerBurst,
    ) -> [Entry] {
        guard !assets.isEmpty else { return [] }

        let sorted = assets.sorted { $0.captureTime < $1.captureTime }

        // burstId per asset (assigned during the walk).
        var burstIdById: [UUID: UUID?] = [:]
        var cluster: [(id: UUID, captureTime: Date)] = []

        func flush(cluster: [(id: UUID, captureTime: Date)]) {
            let id: UUID? = cluster.count >= minShots ? UUID() : nil
            for entry in cluster {
                burstIdById[entry.id] = id
            }
        }

        for entry in sorted {
            if let last = cluster.last,
               entry.captureTime.timeIntervalSince(last.captureTime) <= gap {
                cluster.append(entry)
            } else {
                flush(cluster: cluster)
                cluster = [entry]
            }
        }
        flush(cluster: cluster)

        // Restore original input order.
        return assets.map { input in
            Entry(
                assetId: input.id,
                burstGroupId: burstIdById[input.id] ?? nil,
            )
        }
    }
}
