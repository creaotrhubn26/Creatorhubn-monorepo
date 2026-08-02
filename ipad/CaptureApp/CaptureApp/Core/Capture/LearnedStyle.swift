import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import CoreGraphics

/// On-device anvendelse av en ARKIV-LÆRT stil-profil (destillert fra Post Agent-
/// motoren `arkiv_laert_redigering.py` via `eksporter` → JSON). Prinsippet
/// (Imagen lokalt): fotografens EGNE RAW→ferdig-par lærte per-kanal-tonekurver
/// (CDF-matching) + LAB a/b-skift, klynget til scene-sentroider. Her matcher vi
/// et nytt bilde mot sine k nærmeste scener (farge-vektet kNN) og påfører det
/// vektede snittet av deres LUT + a/b-skift.
///
/// v1 dekker kjernen: features (identisk med Python) + farge-vektet kNN +
/// per-kanal-LUT (CIColorCurves) + a/b-skift (approksimert i RGB). Reinhard-std,
/// ansikts-dodge og film-finish gjenbrukes fra de eksisterende filtrene / er
/// dokumentert oppfølging.
struct LearnedStyleProfile: Codable, Sendable {
    struct Scene: Codable, Sendable {
        let feat: [Double]        // 12-dim scene-feature
        let lut: [[Int]]          // [B,G,R][256] (cv2-kanalrekkefølge)
        let ab: [Double]          // [Δa, Δb] LAB-middel-skift
        let labStd: [Double]      // [L,a,b] Reinhard-spredning (v1: ubrukt)
        let weight: Int
    }
    /// v2 — én navngitt, distinkt look (fler-stil-klynging).
    struct Style: Codable, Sendable {
        let name: String
        let scenes: [Scene]
    }
    let version: Int
    let scenes: [Scene]?          // v1-format (én stil)
    let styles: [Style]?          // v2-format (flere navngitte stiler)

    /// Normalisert: alltid en liste av navngitte stiler (v1 → én «Min stil»).
    var allStyles: [Style] {
        if let styles, !styles.isEmpty { return styles }
        if let scenes, !scenes.isEmpty { return [Style(name: "Min stil", scenes: scenes)] }
        return []
    }

    static func load(contentsOf url: URL) -> LearnedStyleProfile? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(LearnedStyleProfile.self, from: data)
    }
}

enum LearnedStyle {

    /// Vekt for blits-dimensjonen (index 12) i kNN — lav, så den kun SEPARERER
    /// blits- fra ambient-scener uten å dominere fargematchingen.
    static let flashFeatureWeight = 0.4

    /// Beregn scene-features IDENTISK med Python `features()`: 8-bin luma-histogram
    /// (OpenCV Lab L, 0–255) + L-snitt/255 + L-std/128 + (a-snitt−128)/20 +
    /// (b-snitt−128)/20 (12-dim). 128×128 nedskalering.
    ///
    /// Del D: når `flashFired` er gitt appendes et 13. element (0/1) — lar kNN-en
    /// skille «varm fordi tungsten» fra «varm fordi gelet blits» (v3-profil med
    /// 13-dim scener). v2-profiler (12-dim scener) IGNORERER dim 12 (kNN itererer
    /// over minste dim), så oppførselen er UENDRET til en v3-profil shipper.
    static func features(of cgImage: CGImage, flashFired: Bool? = nil) -> [Double] {
        let w = 128, h = 128
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8,
                            bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        ctx?.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))

        var hist = [Double](repeating: 0, count: 8)
        var sumL = 0.0, sumL2 = 0.0, sumA = 0.0, sumB = 0.0
        let n = Double(w * h)
        for i in stride(from: 0, to: px.count, by: 4) {
            let (lcv, acv, bcv) = labCV(r: CGFloat(px[i]) / 255, g: CGFloat(px[i + 1]) / 255, b: CGFloat(px[i + 2]) / 255)
            hist[min(7, Int(lcv / 32.0))] += 1
            sumL += lcv; sumL2 += lcv * lcv; sumA += acv; sumB += bcv
        }
        for i in 0..<8 { hist[i] /= n }
        let meanL = sumL / n
        let stdL = (max(0, sumL2 / n - meanL * meanL)).squareRoot()
        var out = hist + [meanL / 255.0, stdL / 128.0, (sumA / n - 128) / 20.0, (sumB / n - 128) / 20.0]
        // Del D: append blits-dim (0/1) KUN når kjent → 13-dim. Uten flash: 12-dim
        // (uendret). Ingen weighting her — vekten legges i kNN-en (flashFeatureWeight).
        if let flashFired { out.append(flashFired ? 1.0 : 0.0) }
        return out
    }

    /// Snitt-luma (0…1) + andel utblåste høylys-piksler (luma ≥ ~252) fra et
    /// 64×64-utsnitt — driver den absolutte høylys-/eksponerings-vakten.
    static func lumaStats(_ cg: CGImage) -> (mean: Double, clipHi: Double) {
        let w = 64, h = 64
        var px = [UInt8](repeating: 0, count: w * h * 4)
        guard let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return (0.5, 0) }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var sum = 0.0, clip = 0.0
        let n = Double(w * h)
        for i in stride(from: 0, to: px.count, by: 4) {
            let l = 0.299 * Double(px[i]) + 0.587 * Double(px[i + 1]) + 0.114 * Double(px[i + 2])
            sum += l
            if l >= 252 { clip += 1 }
        }
        return (sum / n / 255.0, clip / n)
    }

    /// Replikér rawpy `no_auto_bright=False`: skalér bildet så 99-persentilen av
    /// maks-kanalen treffer ~0.94 (near-white med ~1% klipp), klemt 1.0–3.0.
    /// Normaliserer scene-eksponeringen som rawpy-basen LUT-ene ble trent på.
    /// Nedskalert readback: skaler CIImage-en FØR createCGImage så vi ikke drar
    /// hele full-res-bildet gjennom GPU→CPU bare for å regne en liten statistikk.
    static func smallCG(_ image: CIImage, ctx: CIContext, side: Int) -> CGImage? {
        let longEdge = max(image.extent.width, image.extent.height)
        let scale = min(1, CGFloat(side) / max(1, longEdge))
        let scaled = scale < 1 ? image.transformed(by: CGAffineTransform(scaleX: scale, y: scale)) : image
        return ctx.createCGImage(scaled, from: scaled.extent)
    }

    static func autoBrightBase(_ image: CIImage, ctx: CIContext) -> CIImage {
        let n = 128
        var px = [UInt8](repeating: 0, count: n * n * 4)
        guard let cg = smallCG(image, ctx: ctx, side: n),
              let bmp = CGContext(data: &px, width: n, height: n, bitsPerComponent: 8,
                                  bytesPerRow: n * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return image }
        bmp.draw(cg, in: CGRect(x: 0, y: 0, width: n, height: n))
        var maxes = [UInt8](); maxes.reserveCapacity(n * n)
        var i = 0
        while i < px.count { maxes.append(max(px[i], max(px[i + 1], px[i + 2]))); i += 4 }
        maxes.sort()
        let p99 = Double(maxes[Int(0.99 * Double(maxes.count))]) / 255.0
        let scale = min(3.0, max(1.0, 0.94 / max(p99, 0.3)))
        guard scale > 1.01 else { return image }
        let m = CIFilter.colorMatrix()
        m.inputImage = image
        m.rVector = CIVector(x: CGFloat(scale), y: 0, z: 0, w: 0)
        m.gVector = CIVector(x: 0, y: CGFloat(scale), z: 0, w: 0)
        m.bVector = CIVector(x: 0, y: 0, z: CGFloat(scale), w: 0)
        m.aVector = CIVector(x: 0, y: 0, z: 0, w: 1)
        return m.outputImage?.cropped(to: image.extent) ?? image
    }

    /// sRGB(0…1) → OpenCV 8-bit Lab (L,a,b i 0…255, 128=nøytral for a/b).
    private static func labCV(r: CGFloat, g: CGFloat, b: CGFloat) -> (Double, Double, Double) {
        let a = SkinToneMath.aStar(r: r, g: g, b: b)          // CIE a*
        let (lCie, bCie) = SkinToneMath.lbStar(r: r, g: g, b: b)
        return (lCie * 2.55, a + 128, bCie + 128)
    }

    /// Farge-vektet k-NN: a/b-feature (indeks 10–11) vektes 1.6× — matcher
    /// Python-motorens apply. Returnerer vektet snitt av LUT + a/b.
    static func blend(features f: [Double], scenes: [LearnedStyleProfile.Scene], k: Int = 5)
        -> (lut: [[Double]], ab: [Double], labStd: [Double])? {
        guard !scenes.isEmpty, f.count >= 12 else { return nil }
        let scored: [(d: Double, s: LearnedStyleProfile.Scene)] = scenes.map { sc in
            var sum = 0.0
            // Iterer over MINSTE dim → v2-scener (12) ignorerer blits-dim (13),
            // v3-scener (13) sammenligner den med lav vekt. Zero regresjon for v2.
            for i in 0..<min(f.count, sc.feat.count) {
                let wgt: Double = i >= 12 ? flashFeatureWeight : (i >= 10 ? 1.6 : 1.0)
                let diff = (sc.feat[i] - f[i]) * wgt
                sum += diff * diff
            }
            return (sum.squareRoot(), sc)
        }.sorted { $0.d < $1.d }

        let top = Array(scored.prefix(k))
        let wts = top.map { 1.0 / ($0.d + 1e-4) }
        let wsum = wts.reduce(0, +)
        var lut = [[Double]](repeating: [Double](repeating: 0, count: 256), count: 3)
        var ab = [0.0, 0.0]
        var labStd = [0.0, 0.0, 0.0]
        for (j, item) in top.enumerated() {
            let wt = wts[j] / wsum
            for c in 0..<3 {
                let curve = item.s.lut[c]
                for x in 0..<256 { lut[c][x] += Double(curve[x]) * wt }
            }
            ab[0] += item.s.ab[0] * wt
            ab[1] += item.s.ab[1] * wt
            let std = item.s.labStd.count == 3 ? item.s.labStd : [1, 1, 1]
            for c in 0..<3 { labStd[c] += std[c] * wt }
        }
        return (lut, ab, labStd)
    }

    /// AUTO-velg: hvilken stil passer bildets lys best? Velger stilen med minst
    /// nærmeste-scene-avstand (farge-vektet) til bildets features. Lar motoren
    /// velge tungsten-/dagslys-/motlys-looken selv, per bilde.
    static func autoSelectStyleIndex(features f: [Double], styles: [LearnedStyleProfile.Style]) -> Int? {
        guard !styles.isEmpty, f.count >= 12 else { return nil }
        var best = 0
        var bestD = Double.greatestFiniteMagnitude
        for (i, style) in styles.enumerated() {
            var minD = Double.greatestFiniteMagnitude
            for sc in style.scenes {
                var sum = 0.0
                for j in 0..<min(f.count, sc.feat.count) {
                    let wgt: Double = j >= 12 ? flashFeatureWeight : (j >= 10 ? 1.6 : 1.0)
                    let d = (sc.feat[j] - f[j]) * wgt
                    sum += d * d
                }
                minD = min(minD, sum)
            }
            if minD < bestD { bestD = minD; best = i }
        }
        return best
    }

    /// Påfør en gitt (navngitt) stils scener på et CIImage: per-kanal-LUT
    /// (CIColorCurves) + a/b-skift, scene-matchet on-device.
    static func apply(scenes: [LearnedStyleProfile.Scene], to image: CIImage, k: Int = 5,
                      flashFired: Bool? = nil) -> CIImage {
        guard !scenes.isEmpty else { return image }
        // #3: eksplisitt sRGB arbeidsrom. Alle readbacks (autoBright/features/
        // lumaStats) + LAB-cuben antar sRGB 0–1; uten dette kan default-konteksten
        // tolke P3/lineære verdier → a/b-skift + Reinhard treffer litt feil på
        // mettede farger. Låser hele kjeden til sRGB.
        let srgb = CGColorSpace(name: CGColorSpace.sRGB)
        let ctx = CIContext(options: [.useSoftwareRenderer: false,
                                      .workingColorSpace: srgb as Any])
        var out = image

        // BASE AUTO-BRIGHT (CIRAWFilter → rawpy): rawpy-develop-en LUT-ene ble trent
        // på bruker `no_auto_bright=False` — den normaliserer hver scenes eksponering
        // via høylys-persentil (lyse scener løftes, mørke ned). CIRAWFilter gjør IKKE
        // dette → base-luma spriker per scene (målt: lys scene 0.69 vs rawpy 0.83) →
        // LUT-en (lyskurve) forsterker avviket. Replikér auto-bright: skalér så 99-
        // persentilen treffer ~0.94, så LUT-en får samme normaliserte inngang.
        out = autoBrightBase(out, ctx: ctx).cropped(to: image.extent)

        // BASE-METNINGS-MATCH (CIRAWFilter → rawpy): CIRAWFilter-basen er mer
        // konservativt mettet (~63) enn rawpy-basen (~93) LUT-en ble trent på.
        // Ekte-LAB-overføringen nedenfor gjenoppretter det MESTE (portrett/lyse
        // scener matcher fasiten på ×1.0); en LETT base-boost løfter i tillegg den
        // avmettede mellomtone-looken til fasit-nivå. Etterprøvd mørk/lys/portrett.
        let baseSat = CIFilter.colorControls()
        baseSat.inputImage = out
        baseSat.saturation = 1.1
        baseSat.contrast = 1.0
        baseSat.brightness = 0
        out = baseSat.outputImage?.cropped(to: image.extent) ?? out

        guard let cg = smallCG(out, ctx: ctx, side: 128) else { return image }
        let f = features(of: cg, flashFired: flashFired)
        guard let blended = blend(features: f, scenes: scenes, k: k) else { return image }

        // Per-kanal 1D-LUT via CIColorCurves. cv2-LUT er BGR → map til RGB.
        var samples = [Float]()
        samples.reserveCapacity(256 * 3)
        for x in 0..<256 {
            samples.append(Float(blended.lut[2][x] / 255.0))  // R ← lut[2]
            samples.append(Float(blended.lut[1][x] / 255.0))  // G ← lut[1]
            samples.append(Float(blended.lut[0][x] / 255.0))  // B ← lut[0]
        }
        let curves = CIFilter.colorCurves()
        curves.inputImage = out
        curves.curvesData = samples.withUnsafeBufferPointer { Data(buffer: $0) }
        curves.curvesDomain = CIVector(x: 0, y: 1)
        curves.colorSpace = CGColorSpace(name: CGColorSpace.sRGB)
        out = curves.outputImage ?? out

        // EKTE-LAB FARGEOVERFØRING (erstatter RGB-a/b + global CIColorControls-
        // Reinhard): a/b-middelskift + per-kanal Reinhard-std rundt kanalens snitt,
        // i CIELAB — nøyaktig fotografens farge-/spredningsendring (L=kontrast,
        // a/b=metning). Dette er den prinsipielle fiksen: RGB-approksimasjonen
        // krasjet metningen; ekte LAB reproduserer motorens `apply_model`.
        out = LabColorTransfer.apply(to: out, ab: blended.ab, std: blended.labStd, ctx: ctx)
            .cropped(to: image.extent)

        // KLIPP-SIKRING (sjelden): kun når høylys FAKTISK er kraftig utblåst,
        // komprimér lokalt (luminans-maskert) de utblåste flatene. Terskel hevet
        // (0.04) så den ikke rører normalt eksponerte bilder — ingen global
        // eksponerings-endring lenger (den kjempet mot den lærte looken).
        if let outCg = smallCG(out, ctx: ctx, side: 64) {
            let (_, clipHi) = lumaStats(outCg)
            if clipHi > 0.04 {
                out = HighlightRecoveryFilter.apply(to: out, strength: min(1.0, clipHi * 6))
            }
        }

        // Hud-finishing (den lærte banen har ellers ingen hud-retusj): forankre
        // hud-tone (a*≈11) + lett utjevning + ansikts-dodge.
        // #5: ÉN delt ansiktsdeteksjon for de tre hud-filtrene — de kjørte før tre
        // separate CIDetector-pass på samme bilde.
        let faces = FaceContext.detect(in: out)
        out = SkinToneGuardFilter.apply(strength: 0.7, to: out, faces: faces)
        out = SkinFinishFilter.apply(to: out, faces: faces)
        out = FaceDodgeFilter.apply(to: out, faces: faces)
        return out.cropped(to: image.extent)
    }
}
