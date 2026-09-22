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

    /// Ansiktet regnes som «mørkt» (blits traff ikke) under dette (FaceDodge-target).
    static let darkFaceThreshold = 0.35

    /// Alle leveranse-relevante funn for ett bilde (tom = ingen problemer).
    /// `flashFired`/`flashReturnDetected` (fra EXIF) driver «blits traff ikke».
    static func evaluate(_ a: AssetAnalysis,
                         flashFired: Bool? = nil,
                         flashReturnDetected: Bool? = nil,
                         editValidation: EditValidation? = nil) -> [QualityIssue] {
        var out: [QualityIssue] = []
        if !a.faces.isEmpty {
            // Gruppebilder vurderes per person. Ett mindre barn ute av fokus må
            // aldri forsvinne fordi det største ansiktet i rammen er skarpt.
            if a.faces.contains(where: { $0.eyesOpen == false }) { out.append(.eyesClosed) }
            if a.faceFocusAssessments.contains(where: { $0.state == .soft }) { out.append(.faceSoft) }
            if a.faces.contains(where: { ($0.captureQuality ?? 1) < lowQualityThreshold }) {
                out.append(.lowFaceQuality)
            }
            // Blitsen fyrte men traff ikke: fyrte + ingen retur + mørkt ansikt →
            // klassisk trigger-glipp/mistimet sync (nest vanligste blitsfeil).
            if flashFired == true, flashReturnDetected == false,
               a.faces.contains(where: { $0.luma < darkFaceThreshold }) {
                out.append(.flashMissed)
            }
        }
        // Motiv-klipping (utbrent kjole/motiv) — global klipp fanger ikke dette.
        if let sub = a.subjectHighlightClip, sub > subjectClipThreshold { out.append(.subjectClipped) }
        if let validation = editValidation {
            if validation.state == .failed {
                out.append(.editValidationFailed)
            } else if let m = validation.metrics {
                // Intentionally conservative: these are review prompts, not an
                // automatic rejection of a creative grade.
                if m.alignmentConfidence < 0.45 || m.validPixelFraction < 0.80 {
                    out.append(.alignmentUncertain)
                }
                if let skin = m.skinMeanDeltaE, skin > 12 {
                    out.append(.skinToneShift)
                }
                if m.p95DeltaE > 24, m.changedPixelFraction > 0.72 {
                    out.append(.retouchTooStrong)
                }
                if let background = m.backgroundMeanDeltaE,
                   let subject = m.subjectMeanDeltaE,
                   background > 15, background > subject * 1.75 {
                    out.append(.backgroundSpill)
                }
                if m.highlightClipDelta > 0.015 {
                    out.append(.newHighlightClipping)
                }
            }
        }
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
    case eyesClosed, faceSoft, subjectClipped, lowFaceQuality, flashMissed
    case editValidationFailed, skinToneShift, retouchTooStrong, backgroundSpill
    case newHighlightClipping, alignmentUncertain

    var id: String { rawValue }

    var label: String {
        switch self {
        case .eyesClosed:     return "Lukkede øyne"
        case .faceSoft:       return "Ansikt uskarpt"
        case .subjectClipped: return "Motiv utbrent"
        case .lowFaceQuality: return "Svakt ansiktsbilde"
        case .flashMissed:    return "Blits traff ikke"
        case .editValidationFailed: return "Retusj-QC feilet"
        case .skinToneShift: return "Hudtone flyttet"
        case .retouchTooStrong: return "Kraftig retusj"
        case .backgroundSpill: return "Bakgrunn påvirket"
        case .newHighlightClipping: return "Nye utbrente høylys"
        case .alignmentUncertain: return "Usikker sammenligning"
        }
    }

    var icon: String {
        switch self {
        case .eyesClosed:     return "eye.slash"
        case .faceSoft:       return "camera.metering.spot"
        case .subjectClipped: return "exclamationmark.triangle.fill"
        case .lowFaceQuality: return "person.fill.questionmark"
        case .flashMissed:    return "bolt.slash.fill"
        case .editValidationFailed: return "waveform.path.ecg.rectangle"
        case .skinToneShift: return "person.crop.circle.badge.exclamationmark"
        case .retouchTooStrong: return "wand.and.stars.inverse"
        case .backgroundSpill: return "rectangle.dashed"
        case .newHighlightClipping: return "sun.max.trianglebadge.exclamationmark"
        case .alignmentUncertain: return "viewfinder"
        }
    }

    var severity: QualitySeverity {
        switch self {
        case .eyesClosed, .faceSoft, .subjectClipped, .flashMissed, .newHighlightClipping:
            return .blocker
        case .lowFaceQuality, .editValidationFailed, .skinToneShift, .retouchTooStrong,
             .backgroundSpill, .alignmentUncertain:
            return .warning
        }
    }

    var detail: String {
        switch self {
        case .eyesClosed: return "Ett eller flere ansikter ser ut til å ha lukkede øyne. Kontroller før levering."
        case .faceSoft: return "Ett eller flere ansikter er mindre skarpe enn resten av gruppen."
        case .subjectClipped: return "Motivet har et målbart område uten høylysdetalj."
        case .lowFaceQuality: return "Vision målte lav ansiktskvalitet, ofte grunnet bevegelse eller okklusjon."
        case .flashMissed: return "EXIF viser blits, men mørkt ansikt og manglende retur tyder på bom."
        case .editValidationFailed: return "Før/etter-analysen kunne ikke fullføres. Originalen er fortsatt trygg."
        case .skinToneShift: return "Pikselanalysen målte en uvanlig stor fargeendring i hudområdet."
        case .retouchTooStrong: return "En stor del av bildet har kraftige pikselendringer."
        case .backgroundSpill: return "Bakgrunnen ble endret betydelig mer enn motivet. Kontroller masken."
        case .newHighlightClipping: return "Etterbildet har flere klippede høylys enn originalen."
        case .alignmentUncertain: return "SIFT-lignende Vision-registrering fant for lite sikker overlapp."
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
