import Foundation

/// Fase 1 (adaptiv redigering): kant-bevarende GUIDED FILTER (He, Sun & Tang 2010)
/// — arbeidshesten for å FJÆRE en grov Vision-maske (person/himmel) ned på bildets
/// EKTE kanter, halo-fritt, så region-graden ikke lekker over kant. Antar at ut er
/// en lokal lineær transform av guide-bildet i hvert vindu: `q = a·I + b`, med
/// lukket form via box-filtre. `ε` er nøkkelen: områder med varians ≫ ε bevares som
/// kant, ≪ ε glattes — derfor snapper masken til reelle kanter uten glorier.
///
/// Ren Swift på Float-buffere (rad-major, 0…1), O(N) via integral-bilder (uavhengig
/// av radius). Deterministisk → enhetstestbar. (Metal-port = senere ytelses-steg.)
enum GuidedFilter {

    /// Box-middel over et (2r+1)² vindu, kant-klemt (deler på faktisk vindus-areal).
    /// O(N) via integral-bilde.
    static func boxFilter(_ src: [Float], width w: Int, height h: Int, radius r: Int) -> [Float] {
        guard w > 0, h > 0, src.count == w * h else { return src }
        let iw = w + 1
        var integ = [Double](repeating: 0, count: iw * (h + 1))
        for y in 0..<h {
            var rowSum = 0.0
            let rowBase = y * w
            for x in 0..<w {
                rowSum += Double(src[rowBase + x])
                integ[(y + 1) * iw + (x + 1)] = integ[y * iw + (x + 1)] + rowSum
            }
        }
        var out = [Float](repeating: 0, count: w * h)
        for y in 0..<h {
            let y0 = max(0, y - r), y1 = min(h - 1, y + r)
            for x in 0..<w {
                let x0 = max(0, x - r), x1 = min(w - 1, x + r)
                let area = Double((y1 - y0 + 1) * (x1 - x0 + 1))
                let s = integ[(y1 + 1) * iw + (x1 + 1)] - integ[y0 * iw + (x1 + 1)]
                    - integ[(y1 + 1) * iw + x0] + integ[y0 * iw + x0]
                out[y * w + x] = Float(s / area)
            }
        }
        return out
    }

    /// Guided filter: filtrer `input` (f.eks. en maske) styrt av `guide` (kildebildets
    /// luma). Returnerer utdata i samme størrelse. `radius` = vindus-radius, `epsilon`
    /// = kant-terskel (typisk 1e-4…1e-2 for masker i 0…1).
    static func filter(guide gI: [Float], input p: [Float], width w: Int, height h: Int,
                       radius r: Int, epsilon eps: Float) -> [Float] {
        let n = w * h
        guard n > 0, gI.count == n, p.count == n else { return p }

        func box(_ x: [Float]) -> [Float] { boxFilter(x, width: w, height: h, radius: r) }
        let meanI = box(gI)
        let meanP = box(p)
        var Ip = [Float](repeating: 0, count: n)
        var II = [Float](repeating: 0, count: n)
        for i in 0..<n { Ip[i] = gI[i] * p[i]; II[i] = gI[i] * gI[i] }
        let meanIp = box(Ip)
        let meanII = box(II)

        var a = [Float](repeating: 0, count: n)
        var b = [Float](repeating: 0, count: n)
        for i in 0..<n {
            let varI = meanII[i] - meanI[i] * meanI[i]
            let covIp = meanIp[i] - meanI[i] * meanP[i]
            a[i] = covIp / (varI + eps)
            b[i] = meanP[i] - a[i] * meanI[i]
        }
        let meanA = box(a)
        let meanB = box(b)

        var q = [Float](repeating: 0, count: n)
        for i in 0..<n { q[i] = meanA[i] * gI[i] + meanB[i] }
        return q
    }
}
