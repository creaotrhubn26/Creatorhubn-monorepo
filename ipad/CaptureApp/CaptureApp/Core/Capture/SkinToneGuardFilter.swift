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
        apply(strength: recipe.skinGuard, to: image)
    }

    /// Protect the subject's captured skin colour while global tone/colour
    /// adjustments run. Luminance is allowed to change; chromatic drift is
    /// pulled part-way back toward the source skin. This prevents a global
    /// warmth/vibrance pass from turning a face orange without forcing every
    /// ethnicity and lighting situation toward one fixed RGB value.
    static func apply(
        recipe: MagicRecipe,
        to image: CIImage,
        reference: CIImage
    ) -> CIImage {
        guard recipe.skinGuard > 0,
              image.extent.integral == reference.extent.integral else {
            return apply(recipe: recipe, to: image)
        }
        let faces = detectFaces(in: image, extent: image.extent)
        guard !faces.isEmpty else { return image }
        return preserveReferenceColor(
            strength: recipe.skinGuard,
            image: image,
            reference: reference,
            faces: faces
        )
    }

    /// Direkte styrke-inngang (for LearnedStyle-banen som ikke har en recipe).
    /// PER-ANSIKT + MASKERT: hvert ansikt måles og korrigeres UAVHENGIG (ulik hud/
    /// lys → «Ansikt 1 vs Ansikt 2»), maskert til sitt eget område så bakgrunnen
    /// ikke tones. Håndterer grupper/reception med flere personer riktig.
    static func apply(strength: Double, to image: CIImage, faces: [CGRect]? = nil) -> CIImage {
        guard strength > 0 else { return image }
        let extent = image.extent
        // #5: bruk delte ansikts-rekter når de er gitt (LearnedStyle-kjeden), ellers
        // detektér selv.
        let faces = faces ?? detectFaces(in: image, extent: extent)
        guard !faces.isEmpty else { return image }

        var out = image
        for faceRect in faces {
            // Prøvetak KJERNEN (kinn/panne) — unngå hår/øyne/bakgrunn.
            let inner = faceRect.insetBy(dx: faceRect.width * 0.2, dy: faceRect.height * 0.2)
            guard let mean = areaAverage(of: out, in: inner.width > 2 ? inner : faceRect) else { continue }
            let aStar = SkinToneMath.aStar(r: mean.r, g: mean.g, b: mean.b)
            let bias = SkinToneMath.redGreenBias(aStar: aStar, intensity: strength)
            guard abs(bias) > 0.001 else { continue }

            // Rød↔grønn-akse (motbalansert → luma bevart, blå/gulhet urørt).
            let m = CIFilter.colorMatrix()
            m.inputImage = out
            m.rVector = CIVector(x: 1, y: 0, z: 0, w: 0)
            m.gVector = CIVector(x: 0, y: 1, z: 0, w: 0)
            m.bVector = CIVector(x: 0, y: 0, z: 1, w: 0)
            m.aVector = CIVector(x: 0, y: 0, z: 0, w: 1)
            m.biasVector = CIVector(x: CGFloat(bias), y: CGFloat(-bias), z: 0, w: 0)
            guard let corrected = m.outputImage else { continue }
            // Bland kun inn i DETTE ansiktets myke maske.
            guard let mask = faceMask(extent: extent, faceRect: faceRect) else { continue }
            let blend = CIFilter.blendWithMask()
            blend.inputImage = corrected
            blend.backgroundImage = out
            blend.maskImage = mask
            out = blend.outputImage?.cropped(to: extent) ?? out
        }
        return out
    }

    /// Internal/testable reference-colour protection with explicit faces.
    static func preserveReferenceColor(
        strength: Double,
        image: CIImage,
        reference: CIImage,
        faces: [CGRect]
    ) -> CIImage {
        guard strength > 0, !faces.isEmpty else { return image }
        let extent = image.extent
        var out = image
        for faceRect in faces {
            let inner = faceRect.insetBy(dx: faceRect.width * 0.2, dy: faceRect.height * 0.2)
            let sampleRect = inner.width > 2 ? inner : faceRect
            guard let current = areaAverage(of: out, in: sampleRect),
                  let source = areaAverage(of: reference, in: sampleRect) else { continue }

            // Match source chroma at the CURRENT luminance so exposure and tone
            // remain intentional. Clamp prevents abrupt colour seams on mixed
            // lighting or imperfect face detections.
            let currentY = max(0.01, 0.2126 * current.r + 0.7152 * current.g + 0.0722 * current.b)
            let sourceY = max(0.01, 0.2126 * source.r + 0.7152 * source.g + 0.0722 * source.b)
            let scale = currentY / sourceY
            let amount = CGFloat(min(1, strength) * 0.62)
            func correction(_ now: CGFloat, _ original: CGFloat) -> CGFloat {
                let target = min(1, max(0, original * scale))
                return min(0.035, max(-0.035, (target - now) * amount))
            }
            let dr = correction(current.r, source.r)
            let dg = correction(current.g, source.g)
            let db = correction(current.b, source.b)
            guard max(abs(dr), max(abs(dg), abs(db))) > 0.001 else { continue }

            let matrix = CIFilter.colorMatrix()
            matrix.inputImage = out
            matrix.rVector = CIVector(x: 1, y: 0, z: 0, w: 0)
            matrix.gVector = CIVector(x: 0, y: 1, z: 0, w: 0)
            matrix.bVector = CIVector(x: 0, y: 0, z: 1, w: 0)
            matrix.aVector = CIVector(x: 0, y: 0, z: 0, w: 1)
            matrix.biasVector = CIVector(x: dr, y: dg, z: db, w: 0)
            guard let corrected = matrix.outputImage,
                  let mask = faceMask(extent: extent, faceRect: faceRect) else { continue }
            let blend = CIFilter.blendWithMask()
            blend.inputImage = corrected
            blend.backgroundImage = out
            blend.maskImage = mask
            out = blend.outputImage?.cropped(to: extent) ?? out
        }
        return out
    }

    // MARK: - Deteksjon + prøvetaking (samme primitiver som SkinToneUnifyFilter)

    private static func detectFaces(in image: CIImage, extent: CGRect) -> [CGRect] {
        let detector = CIDetector(
            ofType: CIDetectorTypeFace, context: nil,
            options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
        return (detector?.features(in: image) ?? [])
            .compactMap { ($0 as? CIFaceFeature)?.bounds.intersection(extent) }
            .filter { $0.width > 2 && $0.height > 2 }
    }

    /// Myk ansiktsoval (hvit inni → svart ute) for maskert korreksjon.
    private static func faceMask(extent: CGRect, faceRect: CGRect) -> CIImage? {
        let g = CIFilter.radialGradient()
        g.center = .zero
        g.radius0 = 0.70
        g.radius1 = 1
        g.color0 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
        g.color1 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        let transform = CGAffineTransform(
            a: max(1, faceRect.width * 0.48), b: 0,
            c: 0, d: max(1, faceRect.height * 0.57),
            tx: faceRect.midX,
            ty: faceRect.midY - faceRect.height * 0.03
        )
        return g.outputImage?.transformed(by: transform).cropped(to: extent)
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

    /// CIE L* og b* fra sRGB (0…1) — komplement til ``aStar`` (delt XYZ-mate).
    static func lbStar(r: CGFloat, g: CGFloat, b: CGFloat) -> (l: Double, b: Double) {
        func lin(_ c: CGFloat) -> Double {
            let x = Double(c)
            return x <= 0.04045 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4)
        }
        let rl = lin(r), gl = lin(g), bl = lin(b)
        let yv = rl * 0.2126 + gl * 0.7152 + bl * 0.0722
        let zv = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883
        func f(_ t: Double) -> Double { t > 0.008856 ? pow(t, 1.0 / 3.0) : (7.787 * t + 16.0 / 116.0) }
        let l = 116.0 * f(yv) - 16.0
        let bStar = 200.0 * (f(yv) - f(zv))
        return (l, bStar)
    }

    /// Rød↔grønn-bias (RGB 0…1) for å forankre a* mot ~11. Positiv = hev a*
    /// (fiks grønn/gjørmete); negativ = senk a* (fiks oransje). Klemt + skalert.
    static func redGreenBias(aStar: Double, intensity: Double, targetA: Double = targetA) -> Double {
        let raw = (targetA - aStar) * gain * max(0, min(1, intensity))
        return max(-maxBias, min(maxBias, raw))
    }
}
