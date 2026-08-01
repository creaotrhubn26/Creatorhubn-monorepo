import Foundation

/// Data-drevne auto-edit-forslag (Fase 2): oversett den samlede `AssetAnalysis`
/// til konkrete, ETT-KLIKKS recipe-justeringer — i stedet for de hardkodede
/// «AI forslag»-strengene. Hvert forslag bærer BÅDE en forklaring OG en
/// recipe-delta, så fotografen kan se HVORFOR og bruke det direkte. Ren + testbar
/// (ingen Vision/CoreImage — målingen skjedde i `AssetAnalyzer`).
enum EditSuggestionEngine {
    /// Terskler (delt med `QualityCheckService`-ånden — konservative).
    static let subjectClipThreshold = 0.02
    /// Ansiktet regnes som «mørkt mot scenen» (motlys) når det er markant under
    /// bildets median-luma.
    static let backlitFaceGap = 0.12
    /// Under dette er den dynamiske spredningen (P95−P5) så flat at et kontrast-
    /// løft hjelper.
    static let flatSpread = 0.35

    /// Forslag for ett bilde, viktigst først (tom = ser bra ut).
    static func suggestions(for a: AssetAnalysis) -> [EditSuggestion] {
        var out: [EditSuggestion] = []

        // Utbrent motiv (kjole/motiv) → høylys-gjenoppretting.
        if let sub = a.subjectHighlightClip, sub > subjectClipThreshold {
            out.append(.recoverSubjectHighlights)
        }
        // Motlys: hovedpersonens ansikt mørkere enn scenen → løft skygger.
        if let face = a.primaryFace, a.medianLuma - face.luma > backlitFaceGap {
            out.append(.liftBacklitFace)
        }
        // Hud-cast (hud-forankret WB) → kjøl/varm.
        switch a.skinCast {
        case .tooWarm:  out.append(.coolWarmSkin)
        case .tooCool:  out.append(.warmCoolSkin)
        case .tooGreen: out.append(.correctGreenSkin)
        default: break
        }
        // Flatt bilde (lav dynamisk spredning) → kontrast.
        if a.p95Luma - a.p5Luma < flatSpread {
            out.append(.addContrast)
        }
        return out
    }
}

/// Ett auto-edit-forslag: forklaring + ETT-KLIKKS recipe-delta.
enum EditSuggestion: String, CaseIterable, Identifiable, Hashable {
    case recoverSubjectHighlights
    case liftBacklitFace
    case coolWarmSkin
    case warmCoolSkin
    case correctGreenSkin
    case addContrast

    var id: String { rawValue }

    var title: String {
        switch self {
        case .recoverSubjectHighlights: return "Gjenopprett utbrent motiv"
        case .liftBacklitFace:          return "Løft ansikt i motlys"
        case .coolWarmSkin:             return "Kjøl varm hud"
        case .warmCoolSkin:             return "Varm kjølig hud"
        case .correctGreenSkin:         return "Rett grønnstikk i hud"
        case .addContrast:              return "Legg til kontrast"
        }
    }

    var detail: String {
        switch self {
        case .recoverSubjectHighlights: return "Motivet har utbrente høylys"
        case .liftBacklitFace:          return "Ansiktet er mørkere enn scenen"
        case .coolWarmSkin:             return "Huden trekker mot oransje"
        case .warmCoolSkin:             return "Huden trekker mot blått"
        case .correctGreenSkin:         return "Huden trekker mot grønt (lysrør)"
        case .addContrast:              return "Bildet er flatt (lav spredning)"
        }
    }

    var icon: String {
        switch self {
        case .recoverSubjectHighlights: return "sun.max.trianglebadge.exclamationmark"
        case .liftBacklitFace:          return "person.fill.viewfinder"
        case .coolWarmSkin:             return "thermometer.snowflake"
        case .warmCoolSkin:             return "thermometer.sun"
        case .correctGreenSkin:         return "drop.triangle"
        case .addContrast:              return "circle.lefthalf.filled"
        }
    }

    /// Recipe-deltaen forslaget påfører. Additiv/klemt så gjentatt bruk ikke
    /// overskyter; bruker `max`/`min` mot eksisterende verdier.
    func apply(to r: inout MagicRecipe) {
        switch self {
        case .recoverSubjectHighlights:
            r.highlightRecovery = max(r.highlightRecovery, 0.5)
        case .liftBacklitFace:
            r.shadowLift = max(r.shadowLift, 0.4)
        case .coolWarmSkin:
            r.warmth = max(-1, r.warmth - 0.2)
        case .warmCoolSkin:
            r.warmth = min(1, r.warmth + 0.2)
        case .correctGreenSkin:
            // Grønnstikk temmes av hud-tone-vakten (a*-forankring), ikke av WB.
            r.skinGuard = max(r.skinGuard, 0.5)
        case .addContrast:
            r.contrast = max(r.contrast, 0.25)
        }
    }
}
