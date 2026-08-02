import Foundation

/// Ren, online agglomerativ klynging av ansikts-feature-prints til PERSONER
/// (levering per-ansikt, E8). Hver ny print tilordnes nærmeste eksisterende
/// person-sentroide innenfor terskel; ellers starter den en ny person. Sentroiden
/// er et løpende gjennomsnitt → stabil etter hvert som flere bilder av samme
/// person kommer inn. Ingen Vision/IO her — 100 % testbar.
///
/// Terskelen (kosinus-avstand) må feltjusteres mot ekte ansikter; default er et
/// konservativt startpunkt. Determinisme: samme rekkefølge inn → samme klynger ut.
struct PersonClusterer {

    /// Maks kosinus-avstand for å regnes som SAMME person. Lavere = strengere
    /// (flere, renere klynger); høyere = færre klynger (risiko for sammenslåing).
    var threshold: Float

    private(set) var centroids: [[Float]] = []
    private(set) var counts: [Int] = []

    init(threshold: Float = 0.35) {
        self.threshold = threshold
    }

    var personCount: Int { centroids.count }

    /// Tilordne en feature-print til en person-indeks (0-basert). Oppdaterer
    /// sentroiden (løpende snitt) ved match; oppretter ny person ved miss.
    /// Tom vektor → −1 (ingen tilordning).
    @discardableResult
    mutating func assign(_ v: [Float]) -> Int {
        guard !v.isEmpty else { return -1 }
        var best = -1
        var bestDist = Float.greatestFiniteMagnitude
        for (i, c) in centroids.enumerated() {
            let d = FacePrint.distance(v, c)
            if d < bestDist { bestDist = d; best = i }
        }
        if best >= 0, bestDist <= threshold {
            let n = counts[best]
            var merged = centroids[best]
            let m = min(merged.count, v.count)
            for i in 0..<m {
                merged[i] = (merged[i] * Float(n) + v[i]) / Float(n + 1)
            }
            centroids[best] = merged
            counts[best] += 1
            return best
        } else {
            centroids.append(v)
            counts.append(1)
            return centroids.count - 1
        }
    }

    /// Bekvemhet: kjør en hel batch og returner person-indeks per print (i samme
    /// rekkefølge). En fersk klynger per kall → deterministisk gjenoppbygging.
    static func cluster(_ prints: [[Float]], threshold: Float = 0.35) -> [Int] {
        var c = PersonClusterer(threshold: threshold)
        return prints.map { c.assign($0) }
    }
}
