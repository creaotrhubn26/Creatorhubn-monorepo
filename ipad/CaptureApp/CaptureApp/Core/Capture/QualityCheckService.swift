import Foundation

/// Kvalitetssjekk-steget (Redigering, steg 4): oversett den samlede
/// `AssetAnalysis` til LEVERANSE-BLOKKERE per bilde, så fotografen reviewer de
/// flaggede (typisk noen titalls) i stedet for hele serien (800). Ren + testbar —
/// ingen Vision/CoreImage her; den dyre målingen skjedde i `AssetAnalyzer`.
enum QualityCheckService {
    /// Terskel for MOTIV-klipping (andel utbrente motiv-piksler) — over dette er
    /// f.eks. brudekjolen utbrent nok til å blokkere levering.
    static let subjectClipThreshold = 0.02
    /// Under dette er Vision-capture-quality lav nok (bevegelse/okklusjon) til å
    /// flagge som svak — mykere enn de harde blokkerne.
    static let lowQualityThreshold = 0.35

    /// Alle leveranse-relevante funn for ett bilde (tom = ingen problemer).
    static func evaluate(_ a: AssetAnalysis) -> [QualityIssue] {
        var out: [QualityIssue] = []
        if let face = a.primaryFace {
            // «Lukkede øyne på hovedperson» — den klassiske retake-grunnen.
            if face.eyesOpen == false { out.append(.eyesClosed) }
            // Bommet fokus på ansiktet (ikke vakker bokeh) — dyrt å oppdage sent.
            if face.isSoft(globalSharpness: a.globalSharpness) { out.append(.faceSoft) }
            if let q = face.captureQuality, q < lowQualityThreshold { out.append(.lowFaceQuality) }
        }
        // Motiv-klipping (utbrent kjole/motiv) — global klipp fanger ikke dette.
        if let sub = a.subjectHighlightClip, sub > subjectClipThreshold { out.append(.subjectClipped) }
        return out
    }
}

/// Alvorlighet — blokker (må vurderes før levering) vs. svakhet (bør ses på).
/// Rå-verdi styrer sortering (blokkere øverst).
enum QualitySeverity: Int, Codable, Hashable, Comparable {
    case warning = 0, blocker = 1
    static func < (l: QualitySeverity, r: QualitySeverity) -> Bool { l.rawValue < r.rawValue }
}

/// Ett leveranse-relevant funn.
enum QualityIssue: String, Codable, Hashable, CaseIterable, Identifiable {
    case eyesClosed, faceSoft, subjectClipped, lowFaceQuality

    var id: String { rawValue }

    var label: String {
        switch self {
        case .eyesClosed:     return "Lukkede øyne"
        case .faceSoft:       return "Ansikt uskarpt"
        case .subjectClipped: return "Motiv utbrent"
        case .lowFaceQuality: return "Svakt ansiktsbilde"
        }
    }

    var icon: String {
        switch self {
        case .eyesClosed:     return "eye.slash"
        case .faceSoft:       return "camera.metering.spot"
        case .subjectClipped: return "exclamationmark.triangle.fill"
        case .lowFaceQuality: return "person.fill.questionmark"
        }
    }

    var severity: QualitySeverity {
        switch self {
        case .eyesClosed, .faceSoft, .subjectClipped: return .blocker
        case .lowFaceQuality:                         return .warning
        }
    }
}

/// Ett bilde med minst ett funn — én rad i review-listen.
struct QualityFinding: Identifiable, Hashable {
    let assetId: UUID
    let issues: [QualityIssue]

    var id: UUID { assetId }
    /// Verste alvorlighet blant funnene (for sortering + fargelegging).
    var worstSeverity: QualitySeverity { issues.map(\.severity).max() ?? .warning }
    var hasBlocker: Bool { worstSeverity == .blocker }
}
