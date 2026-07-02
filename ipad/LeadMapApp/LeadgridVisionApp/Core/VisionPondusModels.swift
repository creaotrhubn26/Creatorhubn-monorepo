// VisionPondusModels.swift
//
// Slanke Pondus-modeller for visionOS-target. Duplisert struktur fra
// `LeadMapApp/Core/PondusModels.swift` fordi targets ikke deler
// kompileringsenhet — hver må ha egne symboler.
//
// Formatet matcher backend-DTO-en; feltene renames NB til norsk her
// for direkte bruk i view-lag.

import Foundation
import Observation
import SwiftUI

// MARK: - Modeller

struct VisionPondusStep: Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let subtitle: String?
    let icon: String?
    let prompt: String?
    let order: Int
}

struct VisionPondusAnalysis: Hashable, Sendable {
    var authority: Int
    var clarity: Int
    var trust: Int
    var safety: Int
    var momentum: Int

    static let empty = VisionPondusAnalysis(
        authority: 0, clarity: 0, trust: 0, safety: 0, momentum: 0
    )
}

/// UI-hjelper — Color er MainActor på visionOS 2 og skal ikke inn i
/// Sendable-struct. Views bruker denne til å ta ut label+verdi+tint.
@MainActor
struct VisionPondusAxis: Identifiable {
    let id: String
    let label: String
    let value: Int
    let tint: Color

    static func axes(from a: VisionPondusAnalysis) -> [VisionPondusAxis] {
        [
            .init(id: "authority", label: "Autoritet", value: a.authority, tint: .purple),
            .init(id: "clarity", label: "Klarhet", value: a.clarity, tint: .blue),
            .init(id: "trust", label: "Troverdighet", value: a.trust, tint: .green),
            .init(id: "safety", label: "Trygghet", value: a.safety, tint: .orange),
            .init(id: "momentum", label: "Fremdrift", value: a.momentum, tint: .pink),
        ]
    }
}

struct VisionPondusTemplate: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let category: String
    let kind: String
    let score: Int
    let steps: [VisionPondusStep]
    let analysis: VisionPondusAnalysis

    var orderedSteps: [VisionPondusStep] {
        steps.sorted { $0.order < $1.order }
    }

    var kindLabel: String {
        switch kind {
        case "telephone": return "Telefon"
        case "video":     return "Video"
        case "email":     return "E-post"
        case "meeting":   return "Møte"
        case "field":     return "Felt"
        default:          return kind.capitalized
        }
    }
}

// MARK: - Store

@MainActor
@Observable
final class VisionPondusStore {
    static let shared = VisionPondusStore()

    private(set) var templates: [VisionPondusTemplate] = []
    var activeTemplate: VisionPondusTemplate?

    init() {
        // Seed så pondus-coach har innhold selv uten backend. Skal senere
        // erstattes av APIClient-fetch mot /api/leadgrid/pondus/templates.
        self.templates = Self.seed()
        self.activeTemplate = templates.first
    }

    private static func seed() -> [VisionPondusTemplate] {
        [
            VisionPondusTemplate(
                id: "seed-first-contact",
                name: "Første kontakt med Pondus",
                category: "first_contact",
                kind: "telephone",
                score: 82,
                steps: [
                    VisionPondusStep(id: "formal", title: "Formål", subtitle: nil, icon: "target",
                                     prompt: "Skap et sterkt førsteinntrykk og åpne for dialog.",
                                     order: 0),
                    VisionPondusStep(id: "opening", title: "Åpningsreplikk", subtitle: nil,
                                     icon: "bubble.left.fill",
                                     prompt: "Hei {navn}, jeg heter {ditt navn} i {din bedrift}.",
                                     order: 1),
                    VisionPondusStep(id: "value", title: "Verdiforslag", subtitle: nil,
                                     icon: "diamond.fill",
                                     prompt: "Vi har nylig hjulpet {kunde} med {konkret resultat}.",
                                     order: 2),
                    VisionPondusStep(id: "next", title: "Neste steg", subtitle: nil,
                                     icon: "arrow.right.circle.fill",
                                     prompt: "Har du 15 minutter til en kort prat denne uken?",
                                     order: 3),
                ],
                analysis: VisionPondusAnalysis(authority: 88, clarity: 84, trust: 82, safety: 76, momentum: 90)
            ),
            VisionPondusTemplate(
                id: "seed-meeting-open",
                name: "Møteåpning med Pondus",
                category: "meeting_open",
                kind: "video",
                score: 91,
                steps: [
                    VisionPondusStep(id: "agenda", title: "Agenda", subtitle: nil, icon: "calendar",
                                     prompt: "Jeg har satt opp 15 min: 5 til å forstå dere.",
                                     order: 0),
                    VisionPondusStep(id: "frame", title: "Ramme-spørsmål", subtitle: nil,
                                     icon: "bubble.left.fill",
                                     prompt: "Hva er det viktigste å få ut av samtalen?",
                                     order: 1),
                ],
                analysis: VisionPondusAnalysis(authority: 90, clarity: 94, trust: 88, safety: 92, momentum: 90)
            ),
        ]
    }
}

