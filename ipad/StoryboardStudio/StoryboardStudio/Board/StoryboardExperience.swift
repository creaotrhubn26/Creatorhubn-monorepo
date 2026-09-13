import SwiftUI
import UIKit

/// The three stable mental modes exposed to Storyboard Room users. The
/// underlying destinations remain separate so existing navigation and data
/// contracts do not need to change.
enum StoryboardWorkspaceMode: String, CaseIterable, Identifiable, Sendable {
    case create
    case decide
    case produce

    var id: String { rawValue }

    var title: String {
        switch self {
        case .create: return "Lag"
        case .decide: return "Avgjør"
        case .produce: return "Produser"
        }
    }

    var icon: String {
        switch self {
        case .create: return "pencil.and.outline"
        case .decide: return "checkmark.bubble"
        case .produce: return "play.rectangle"
        }
    }

    var primaryDestination: HubDestination {
        switch self {
        case .create: return .board
        case .decide: return .review
        case .produce: return .animatic
        }
    }

    func contains(_ destination: HubDestination?) -> Bool {
        switch (self, destination) {
        case (.create, .board), (.create, .script), (.create, .assets),
             (.decide, .review),
             (.produce, .shotList), (.produce, .animatic):
            return true
        default:
            return false
        }
    }
}

/// A presentation lens only. Backend authorization remains authoritative.
enum StoryboardProductionRole: String, CaseIterable, Identifiable, Sendable {
    case storyboardArtist
    case director
    case cinematographer
    case producer
    case client

    var id: String { rawValue }

    var title: String {
        switch self {
        case .storyboardArtist: return "Storyboardartist"
        case .director: return "Regissør"
        case .cinematographer: return "Fotograf"
        case .producer: return "Produsent"
        case .client: return "Klient"
        }
    }

    var icon: String {
        switch self {
        case .storyboardArtist: return "applepencil"
        case .director: return "megaphone"
        case .cinematographer: return "camera.aperture"
        case .producer: return "checklist"
        case .client: return "person.crop.circle.badge.checkmark"
        }
    }

    var reviewSidebarTitle: String {
        switch self {
        case .storyboardArtist: return "Kommentarer og rettelser"
        case .director: return "Kommentarer og avgjørelser"
        case .cinematographer: return "Kamera og kontinuitet"
        case .producer: return "Status og konsekvens"
        case .client: return "Kommentarer og sign-off"
        }
    }

    var canEditShotMetadata: Bool { self != .client }
    var canDrawReviewMarks: Bool { self != .client }
    var canManageLockedRevisions: Bool { self == .director || self == .producer }
    var canRestoreLockedRevisions: Bool { self == .producer }
}

/// User-facing assistants. Each maps to existing, auditable backend
/// capabilities; artist marks are an input method and intentionally separate.
enum StoryboardAssistant: String, CaseIterable, Identifiable, Sendable {
    case sceneDirector
    case continuitySupervisor
    case animaticEditor

    var id: String { rawValue }

    var title: String {
        switch self {
        case .sceneDirector: return "Scene Director"
        case .continuitySupervisor: return "Continuity Supervisor"
        case .animaticEditor: return "Animatic Editor"
        }
    }

    var detail: String {
        switch self {
        case .sceneDirector:
            return "Coverage, shotalternativer og visuell lesbarhet."
        case .continuitySupervisor:
            return "Kontinuitet, gjennomførbarhet og revisjonsvakt."
        case .animaticEditor:
            return "Timing, overganger og rytme i animaticen."
        }
    }

    var icon: String {
        switch self {
        case .sceneDirector: return "movieclapper"
        case .continuitySupervisor: return "point.3.connected.trianglepath.dotted"
        case .animaticEditor: return "timeline.selection"
        }
    }

    var capabilities: [StoryboardSkillID] {
        switch self {
        case .sceneDirector:
            return [.planSceneCoverage, .designShotVariants, .auditBoardReadability]
        case .continuitySupervisor:
            return [.auditVisualContinuity, .auditProductionFeasibility,
                    .reconcileStoryboardRevision]
        case .animaticEditor:
            return [.buildAnimaticPass]
        }
    }

    var defaultCapability: StoryboardSkillID { capabilities[0] }
}

enum StoryboardExperienceMetrics {
    static let minimumTouchTarget: CGFloat = 44
    static let railWidth: CGFloat = 264
    static let inspectorWidth: CGFloat = 332
    static let cornerRadius: CGFloat = 12
}

/// Width, not device orientation, drives the review composition. This also
/// covers Split View, Stage Manager and freely resizable iPadOS windows.
enum StoryboardReviewLayout: Equatable, Sendable {
    case wide
    case compact
    case narrow

    init(width: CGFloat) {
        if width >= 1_180 {
            self = .wide
        } else if width >= 760 {
            self = .compact
        } else {
            self = .narrow
        }
    }

    var usesVerticalShotRail: Bool { self == .wide }
    var contextOverlaysCanvas: Bool { self == .narrow }
}

/// Deterministic fixture art used only when a simulator/UI-test demo flag is
/// enabled. Keeping the renderer available in every build configuration also
/// lets Release builds compile the guarded demo route without special stubs.
@MainActor
enum StoryboardReviewDemoArtwork {
    static func dataURL(variant: Int) -> String {
        let size = CGSize(width: 1280, height: 720)
        let image = UIGraphicsImageRenderer(size: size).image { renderer in
            let context = renderer.cgContext
            let colors = [
                UIColor(red: 0.035, green: 0.055, blue: 0.11, alpha: 1).cgColor,
                UIColor(red: 0.11, green: 0.18, blue: 0.24, alpha: 1).cgColor,
            ] as CFArray
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                         colors: colors, locations: [0, 1]) {
                context.drawLinearGradient(gradient, start: .zero,
                                           end: CGPoint(x: 1280, y: 720), options: [])
            }

            // Train carriage and cold window light.
            UIColor(red: 0.08, green: 0.10, blue: 0.13, alpha: 1).setFill()
            context.fill(CGRect(x: 0, y: 500, width: 1280, height: 220))
            UIColor(red: 0.18, green: 0.22, blue: 0.25, alpha: 1).setFill()
            context.fill(CGRect(x: 45, y: 70, width: 790, height: 450))
            UIColor(red: 0.09, green: 0.20, blue: 0.27, alpha: 1).setFill()
            context.fill(CGRect(x: 74, y: 100, width: 732, height: 390))

            context.setStrokeColor(UIColor(red: 0.55, green: 0.73, blue: 0.78, alpha: 0.5).cgColor)
            context.setLineWidth(7)
            context.stroke(CGRect(x: 74, y: 100, width: 732, height: 390))
            context.move(to: CGPoint(x: 440, y: 100))
            context.addLine(to: CGPoint(x: 440, y: 490))
            context.strokePath()

            // Forest silhouettes outside.
            context.setFillColor(UIColor(red: 0.025, green: 0.08, blue: 0.075, alpha: 0.95).cgColor)
            for index in 0..<9 {
                let x = CGFloat(95 + index * 86 + (variant * 13) % 35)
                let height = CGFloat(120 + (index % 3) * 45)
                let tree = UIBezierPath()
                tree.move(to: CGPoint(x: x, y: 455))
                tree.addLine(to: CGPoint(x: x + 38, y: 455 - height))
                tree.addLine(to: CGPoint(x: x + 76, y: 455))
                tree.close()
                tree.fill()
            }

            // Troll silhouette and face framed outside the window.
            let offset = CGFloat(variant * 18)
            UIColor(red: 0.03, green: 0.045, blue: 0.045, alpha: 1).setFill()
            context.fillEllipse(in: CGRect(x: 510 + offset, y: 145, width: 240, height: 300))
            context.fill(CGRect(x: 535 + offset, y: 355, width: 205, height: 135))
            UIColor(red: 0.76, green: 0.93, blue: 0.82, alpha: 0.9).setFill()
            context.fillEllipse(in: CGRect(x: 570 + offset, y: 255, width: 22, height: 15))
            context.fillEllipse(in: CGRect(x: 665 + offset, y: 250, width: 22, height: 15))

            // Passenger silhouette creates foreground depth.
            UIColor.black.withAlphaComponent(0.84).setFill()
            context.fillEllipse(in: CGRect(x: 920, y: 250, width: 160, height: 180))
            context.fill(CGRect(x: 860, y: 405, width: 290, height: 315))

            let title = variant == 0 ? "TROLLET I VINDUET" : "REAKSJON — NORA"
            (title as NSString).draw(
                at: CGPoint(x: 54, y: 645),
                withAttributes: [
                    .font: UIFont.monospacedSystemFont(ofSize: 22, weight: .bold),
                    .foregroundColor: UIColor.white.withAlphaComponent(0.72),
                ])
        }
        guard let data = image.jpegData(compressionQuality: 0.88) else { return "" }
        return "data:image/jpeg;base64,\(data.base64EncodedString())"
    }
}
