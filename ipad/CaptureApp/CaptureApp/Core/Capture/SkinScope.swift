import Foundation

/// Fase 2 — hud-vectorscope som VAKTPOST (broadcast-verdenens hudlinje, men smart).
/// Gitt en GATET hud-punktsky (hue-grader, målt i samme normaliserte rom som
/// kalibratoren) + en LÆRT toleranse-KILE (senter + halvbredde, fra per-person-anker
/// og scene-toleranse), regner den de tre tallene som driver HUD-chipen:
///   • cast  = median vinkelavvik fra kilens senter (fortegn = retning)
///   • spread = robust vinkel-spredning (MAD)
///   • fractionOutside = andel hud utenfor kilen
/// + BIMODAL = to adskilte klumper på huden = to illuminanter = BLANDET LYS.
///
/// Skopet OBSERVERER; korreksjonen bor i kalibratoren — så tallene her og
/// korreksjonsmotorens tall er samme tall. Ren + testbar (ingen tegning her).
enum SkinScope {

    enum Status: Equatable {
        case insufficient   // for lite hud til å måle (unngå flakkende varsel)
        case onLine         // hud på linja
        case tolerable      // innenfor kilen (f.eks. gyllen-time-varme)
        case cast           // utenfor kilen — sjekk WB
    }

    struct Reading: Equatable {
        var sampleCount: Int
        var medianHueDeg: Double
        var castDeg: Double
        var spreadDeg: Double
        var fractionOutsideWedge: Double
        var bimodal: Bool
        var status: Status
    }

    /// Korteste vei til (−180, 180].
    private static func norm(_ d: Double) -> Double {
        var x = d.truncatingRemainder(dividingBy: 360)
        if x <= -180 { x += 360 }
        if x > 180 { x -= 360 }
        return x
    }

    private static func median(_ a: [Double]) -> Double {
        let s = a.sorted(); let n = s.count
        return n == 0 ? 0 : (n % 2 == 1 ? s[n / 2] : (s[n / 2 - 1] + s[n / 2]) / 2)
    }

    static func analyze(hues: [Double], wedgeCenterDeg: Double, wedgeHalfWidthDeg: Double,
                        minSamples: Int = 1500, castTolerance: Double = 3) -> Reading {
        let count = hues.count
        guard count >= max(1, minSamples) else {
            return Reading(sampleCount: count, medianHueDeg: 0, castDeg: 0, spreadDeg: 0,
                           fractionOutsideWedge: 0, bimodal: false, status: .insufficient)
        }
        // Avvik fra kilens senter (fortegnet, korteste vei).
        let dev = hues.map { norm($0 - wedgeCenterDeg) }
        let cast = median(dev)
        let mad = median(dev.map { abs($0 - cast) })
        let outside = Double(dev.filter { abs($0) > wedgeHalfWidthDeg }.count) / Double(count)
        let bimodal = detectBimodal(dev, separation: max(6, wedgeHalfWidthDeg))

        let status: Status
        if abs(cast) <= castTolerance {
            status = .onLine
        } else if abs(cast) <= wedgeHalfWidthDeg {
            status = .tolerable
        } else {
            status = .cast
        }

        return Reading(sampleCount: count, medianHueDeg: norm(wedgeCenterDeg + cast),
                       castDeg: cast, spreadDeg: mad, fractionOutsideWedge: outside,
                       bimodal: bimodal, status: status)
    }

    /// To adskilte klumper (1D k-means, k=2, deterministisk init) → blandet lys.
    /// Bimodal når sentrene er ≥ `separation` fra hverandre OG begge har ≥25 %.
    private static func detectBimodal(_ x: [Double], separation: Double) -> Bool {
        guard let lo = x.min(), let hi = x.max(), hi - lo > separation else { return false }
        var c0 = lo, c1 = hi
        var a0 = [Double](), a1 = [Double]()
        for _ in 0..<8 {
            a0.removeAll(keepingCapacity: true); a1.removeAll(keepingCapacity: true)
            for v in x { if abs(v - c0) <= abs(v - c1) { a0.append(v) } else { a1.append(v) } }
            guard !a0.isEmpty, !a1.isEmpty else { return false }
            let n0 = a0.reduce(0, +) / Double(a0.count)
            let n1 = a1.reduce(0, +) / Double(a1.count)
            if abs(n0 - c0) < 1e-6 && abs(n1 - c1) < 1e-6 { c0 = n0; c1 = n1; break }
            c0 = n0; c1 = n1
        }
        let frac = min(Double(a0.count), Double(a1.count)) / Double(x.count)
        return abs(c1 - c0) >= separation && frac >= 0.25
    }
}
