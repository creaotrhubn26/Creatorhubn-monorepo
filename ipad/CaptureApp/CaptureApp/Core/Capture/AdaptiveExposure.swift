import Foundation
import CoreImage

/// Fase 0 (adaptiv redigering): per-bilde EKSPONERINGS-NORMALISERING som kjøres FØR
/// den lærte LUT-en, så looken lander på en konsistent lyshet i stedet for å arve
/// rammens tilfeldige eksponering (motlys-brud vs. blits-nær). MOTIV-VEKTET: når vi
/// har en motiv-/ansikts-luma eksponerer vi for MOTIVET (ikke hele rammen), så en
/// brud mot lys himmel blir riktig belyst. HØYLYS-TRYGT: oppløft kappes så de
/// lyseste partiene (P95) ikke blåser ut.
///
/// All matematikk i LINEÆRT lys (EV = log2(gain)), så den komponerer korrekt med
/// `CIExposureAdjust` (som multipliserer 2^EV lineært). Ren + testbar.
enum AdaptiveExposure {

    /// sRGB (0…1) → lineært lys. `AssetAnalysis`-luma er målt i display-/sRGB-rom,
    /// så lineariser før EV-regning.
    static func linearize(_ c: Double) -> Double {
        c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }

    /// Hvilken luma skal eksponeres til key: MOTIVET når vi har det (dempet blanding
    /// mot scenen så vi ikke overkorrigerer på ørsmå/utkant-ansikter), ellers scenen.
    /// Alle verdier i samme rom (lineært anbefalt).
    static func exposureTargetLuma(scene: Double, subject: Double?, subjectWeight: Double = 0.75) -> Double {
        guard let s = subject else { return scene }
        let w = min(1, max(0, subjectWeight))
        return scene * (1 - w) + s * w
    }

    /// EV-offset (stops) for å bringe `currentLuma` til `targetKey`, klemt til
    /// ±`maxEV`, og — ved OPPLØFT — kappet så `p95Luma` ikke skyter over
    /// `highlightCeil`. Alle luma-verdier i LINEÆRT lys (0…1).
    static func evOffset(currentLuma current: Double, p95Luma p95: Double,
                         targetKey: Double = 0.18, maxEV: Double = 1.5,
                         highlightCeil: Double = 0.90) -> Double {
        guard current > 1e-4 else { return 0 }
        var gain = targetKey / current
        // Høylys-vern gjelder KUN oppløft (nedjustering reduserer høylys uansett).
        if gain > 1, p95 > 1e-4 {
            gain = min(gain, max(1, highlightCeil / p95))
        }
        let ev = log2(max(gain, 1e-6))
        return min(maxEV, max(-maxEV, ev))
    }

    /// Bekvemhet fra rå sRGB-målinger (`AssetAnalysis` `medianLuma`, motiv-luma,
    /// `p95Luma`): lineariser + motiv-vekt + EV. `subjectLuma` = f.eks. største
    /// ansikts inset-luma (nil → scene-vektet). Returnerer 0 ved manglende data.
    static func evOffsetFromSRGB(sceneMedian: Double, subjectLuma: Double?, p95: Double,
                                 targetKey: Double = 0.18, maxEV: Double = 1.5,
                                 highlightCeil: Double = 0.90) -> Double {
        let sceneLin = linearize(sceneMedian)
        let subjLin = subjectLuma.map(linearize)
        let target = exposureTargetLuma(scene: sceneLin, subject: subjLin)
        return evOffset(currentLuma: target, p95Luma: linearize(p95),
                        targetKey: targetKey, maxEV: maxEV, highlightCeil: highlightCeil)
    }

    /// Påfør EV-offset (lineært, 2^EV) via `CIExposureAdjust`.
    static func apply(_ image: CIImage, ev: Double) -> CIImage {
        guard abs(ev) > 1e-3, let f = CIFilter(name: "CIExposureAdjust") else { return image }
        f.setValue(image, forKey: kCIInputImageKey)
        f.setValue(ev, forKey: kCIInputEVKey)
        return f.outputImage ?? image
    }
}
