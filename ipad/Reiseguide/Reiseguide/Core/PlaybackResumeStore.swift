// PlaybackResumeStore.swift
//
// «Fortsett der du slapp» (item 3, oppfølging til avspiller-redesignet):
// husker hvor langt brukeren kom i et sted (variant, kapittel, sekund) når
// avspilleren pauser, lukkes, bytter kapittel eller appen går i bakgrunnen,
// så `PlayerViewModel.start(poi:)` kan hoppe rett tilbake dit i stedet for å
// starte fra begynnelsen. UserDefaults, samme mønster som AppSettings; ren
// butikk uten Observation, så den kan enhetstestes direkte (se
// PlaybackResumeTests). Holder bare de 50 sist spilte stedene (LRU på
// `save`), så loggen aldri vokser ubegrenset.
//
// `PlaybackResumeDecision` er den rene vurderingen av OM en lagret posisjon
// er verdt å tilby: ikke helt i starten, og ikke praktisk talt ferdig hørt.

import Foundation

struct PlaybackResumePosition: Codable, Sendable, Equatable {
    let poiId: String
    var variantKind: VariantKind
    var chapterIndex: Int
    var positionS: Double
    var updatedAt: Date
}

final class PlaybackResumeStore: @unchecked Sendable {
    /// Flest steder loggen husker samtidig; eldste (minst nylig lagret) faller ut først.
    static let maxEntries = 50

    private let key = "reiseguide.playbackResume"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func position(for poiId: String) -> PlaybackResumePosition? {
        read().first { $0.poiId == poiId }
    }

    /// Lagrer/oppdaterer posisjonen for stedet; flyttes til toppen (nyest).
    func save(_ position: PlaybackResumePosition) {
        var all = read().filter { $0.poiId != position.poiId }
        all.insert(position, at: 0)
        if all.count > Self.maxEntries { all = Array(all.prefix(Self.maxEntries)) }
        write(all)
    }

    /// Kalles når besøket fullføres: ingenting å fortsette fra lenger.
    func clear(poiId: String) {
        write(read().filter { $0.poiId != poiId })
    }

    private func read() -> [PlaybackResumePosition] {
        guard let data = defaults.data(forKey: key) else { return [] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([PlaybackResumePosition].self, from: data)) ?? []
    }

    private func write(_ positions: [PlaybackResumePosition]) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(positions) else { return }
        defaults.set(data, forKey: key)
    }
}

/// Et sted (variant + kapittel + sekund) det er verdt å hoppe rett til.
/// Returnert av `PlaybackResumeDecision.resolve`; `startPositionS` er
/// allerede spolt litt tilbake for kontekst, `savedPositionS` er tallet
/// «Fortsetter fra …»-hintet viser fram.
struct PlaybackResumeTarget: Equatable {
    let variantKind: VariantKind
    let chapterIndex: Int
    let startPositionS: Double
    let savedPositionS: Double
}

/// Ren vurdering av om en lagret posisjon er verdt å tilby gjenopptagelse
/// fra, og hvor avspillingen faktisk skal starte (litt tilbakespoling for
/// kontekst, som podkast-apper gjør). `resolve` gjør hele jobben fra en rå
/// lagret posisjon og et POI, så `PlayerViewModel.start(poi:)` selv slipper
/// å kjenne til variant-fallback-regelen; testet direkte med syntetiske
/// GuidePOI-er (se PlaybackResumeTests), samme mønster som TourProgress og
/// VeiviserTarget.
enum PlaybackResumeDecision {
    /// Under dette regnes posisjonen som «helt i starten»: ingenting å fortsette fra.
    static let minResumeS: Double = 5
    /// Innenfor dette fra slutten regnes kapittelet som ferdig hørt.
    static let minRemainingS: Double = 5
    /// Hopper 3 s tilbake fra der brukeren slapp, så de får litt kontekst igjen.
    static let rewindS: Double = 3

    static func shouldResume(positionS: Double, chapterDurationS: Double) -> Bool {
        guard positionS >= minResumeS else { return false }
        guard chapterDurationS - positionS >= minRemainingS else { return false }
        return true
    }

    /// Faktisk starttidspunkt: `positionS` minus litt tilbakespoling, aldri under 0.
    static func resumePositionS(positionS: Double) -> Double {
        max(0, positionS - rewindS)
    }

    /// Løser en lagret posisjon til et konkret sted å hoppe til for `poi`, om
    /// noen: kapittelet/varianten må fortsatt finnes (innholdet kan ha
    /// endret seg siden sist), og posisjonen må være meningsfull.
    static func resolve(saved: PlaybackResumePosition?, poi: GuidePOI) -> PlaybackResumeTarget? {
        guard let saved else { return nil }
        let variant: GuideVariant?
        switch saved.variantKind {
        case .narration: variant = poi.variants.narration ?? poi.variants.audioDescription
        case .audioDescription: variant = poi.variants.audioDescription ?? poi.variants.narration
        }
        guard let variant, variant.chapters.indices.contains(saved.chapterIndex) else { return nil }
        let chapterDurationS = variant.chapters[saved.chapterIndex].playbackDurationS
        guard shouldResume(positionS: saved.positionS, chapterDurationS: chapterDurationS) else { return nil }
        return PlaybackResumeTarget(
            variantKind: saved.variantKind,
            chapterIndex: saved.chapterIndex,
            startPositionS: resumePositionS(positionS: saved.positionS),
            savedPositionS: saved.positionS
        )
    }
}
