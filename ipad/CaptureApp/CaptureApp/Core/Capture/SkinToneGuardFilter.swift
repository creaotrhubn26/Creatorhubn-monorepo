import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

/// Hud-tone-guard — forankrer hudens RØDHET (Lab a*) mot den etnisitets-
/// invariante «sunne hud»-verdien ~10–11, uten å røre lyshet (L*) eller
/// gulhet (b*). Basert på kolorimetrisk research (CIELAB-studie 2026 + Margulis
/// «by the numbers»): a* er stabil ~10–11 på tvers av ALLE hudtoner; det som
/// varierer er L*/b* per person — dem BEVARER vi (aldri lysne/kjøle sør-asiatisk
/// eller mørk hud mot et europeisk anker).
///
/// Ett uttrykk dekker begge feilmodusene:
///   • a* for LAVT (grønn/gjørmete — den typiske feilen på sør-asiatisk/mørk hud
///     under blandet lys) → skyv mot rød/magenta.
///   • a* for HØYT (oransje/solbrent — den typiske feilen på lys hud i varmt lys)
///     → skyv mot grønn.
/// Korreksjonen er en dempet, klemt rød↔grønn-akse-nudge (a-aksen) — luminans
/// bevart ved motbalansert R/G-bias.
///
/// No-op når `recipe.skinGuard <= 0`, ingen ansikter, eller hudanker allerede
/// treffer. Global, dempet nudge (som en hvitbalanse-tint) — «flatter ansiktene»;
/// klemt lavt så den ikke fargelegger ikke-hud-scener (løvverk/sari).
enum SkinToneGuardFilter {

    static func apply(recipe: MagicRecipe, to image: CIImage) -> CIImage {
        guard recipe.skinGuard > 0 else { return image }
        let extent = image.extent
        guard let faceRect = detectFaceRect(in: image, extent: extent) else { return image }
        // Prøvetak KJERNEN av ansiktet (kinn/panne) — krymp rekt til 60 % så vi
        // unngår hår/øyne/bakgrunn.
        let inner = faceRect.insetBy(dx: faceRect.width * 0.2, dy: faceRect.height * 0.2)
        guard let mean = areaAverage(of: image, in: inner.width > 2 ? inner : faceRect) else { return image }

        let aStar = SkinToneMath.aStar(r: mean.r, g: mean.g, b: mean.b)
        let bias = SkinToneMath.redGreenBias(aStar: aStar, intensity: recipe.skinGuard)
        guard abs(bias) > 0.001 else { return image }

        // Rød↔grønn-akse: +bias hever a* (rød opp, grønn ned) — motbalansert så
        // luma holdes ~konstant. Blå urørt (b*/gulhet bevart).
        let m = CIFilter.colorMatrix()
        m.inputImage = image
        m.rVector = CIVector(x: 1, y: 0, z: 0, w: 0)
        m.gVector = CIVector(x: 0, y: 1, z: 0, w: 0)
        m.bVector = CIVector(x: 0, y: 0, z: 1, w: 0)
        m.aVector = CIVector(x: 0, y: 0, z: 0, w: 1)
        m.biasVector = CIVector(x: CGFloat(bias), y: CGFloat(-bias), z: 0, w: 0)
        return m.outputImage?.cropped(to: extent) ?? image
    }

    // MARK: - Deteksjon + prøvetaking (samme primitiver som SkinToneUnifyFilter)

    private static func detectFaceRect(in image: CIImage, extent: CGRect) -> CGRect? {
        let detector = CIDetector(
            ofType: CIDetectorTypeFace, context: nil,
            options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
        guard let first = detector?.features(in: image).first as? CIFaceFeature else { return nil }
        return first.bounds.intersection(extent)
    }

    private static func areaAverage(of image: CIImage, in rect: CGRect) -> (r: CGFloat, g: CGFloat, b: CGFloat)? {
        let f = CIFilter.areaAverage()
        f.inputImage = image
        f.extent = rect
        guard let out = f.outputImage else { return nil }
        var bytes = [UInt8](repeating: 0, count: 4)
        CIContext(options: [.useSoftwareRenderer: false]).render(
            out, toBitmap: &bytes, rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
        return (CGFloat(bytes[0]) / 255, CGFloat(bytes[1]) / 255, CGFloat(bytes[2]) / 255)
    }
}

/// Ren, testbar hud-tone-matematikk (sRGB→Lab a* + korreksjons-bias).
enum SkinToneMath {
    /// Den etnisitets-invariante «sunne hud»-rødheten (Lab a*).
    static let targetA: Double = 11
    /// a*-avvik → RGB-bias-forsterkning, og maks dempet nudge.
    static let gain: Double = 0.0032
    static let maxBias: Double = 0.035

    /// Lab a* fra sRGB (0…1). Standard sRGB→lineær→XYZ(D65)→Lab.
    static func aStar(r: CGFloat, g: CGFloat, b: CGFloat) -> Double {
        func lin(_ c: CGFloat) -> Double {
            let x = Double(c)
            return x <= 0.04045 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4)
        }
        let rl = lin(r), gl = lin(g), bl = lin(b)
        // sRGB D65 → XYZ (normalisert til D65-hvitpunkt).
        let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047
        let y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722)
        func f(_ t: Double) -> Double {
            t > 0.008856 ? pow(t, 1.0 / 3.0) : (7.787 * t + 16.0 / 116.0)
        }
        return 500.0 * (f(x) - f(y))
    }

    /// Rød↔grønn-bias (RGB 0…1) for å forankre a* mot ~11. Positiv = hev a*
    /// (fiks grønn/gjørmete); negativ = senk a* (fiks oransje). Klemt + skalert.
    static func redGreenBias(aStar: Double, intensity: Double, targetA: Double = targetA) -> Double {
        let raw = (targetA - aStar) * gain * max(0, min(1, intensity))
        return max(-maxBias, min(maxBias, raw))
    }
}
