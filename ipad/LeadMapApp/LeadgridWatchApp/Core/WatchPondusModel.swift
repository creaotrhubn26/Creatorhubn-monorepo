// WatchPondusModel.swift
//
// Slanke Codable-modeller for Pondus-maler på Apple Watch. iPhone-siden
// (`LeadMapApp/Views/Tabs/Leadbook/PondusWatchSync.swift`) trimmer og
// pusher topp 5-10 templates via `WCSession.transferUserInfo` slik at
// vi holder payload godt under 65 KB-grensa til WatchConnectivity.
//
// Struct-navn har `Watch`-prefiks slik at de ikke kolliderer med
// hovedappens `PondusTemplateDTO` (hoved-target linkes ikke inn i
// watchOS-appen — hver target må ha sin egen kopi).
//
// Payload-format vi forventer fra iPhone (nøkler = camelCase):
//   {
//     "type": "pondus.templates.sync",
//     "templates": [
//       {"id": "...", "name": "...", "kind": "telephone",
//        "score": 88, "category": "first_contact",
//        "analysis": {"autoritet": 90, "klarhet": 92, ...},
//        "steps": [{"id":"...","title":"...","order":0,"prompt":"..."}]
//       }, ...
//     ]
//   }
//
// Aktivering fra Watch → iPhone bruker `sendMessage` (raskest ved
// levende session) med fallback til `transferUserInfo`:
//   { "type": "pondus.template.activate", "templateId": "..." }

import Foundation

/// Én av 5 pondus-akser (autoritet/klarhet/troverdighet/trygghet/fremdrift).
/// Vi bruker `Int` 0-100 for enkel bar-rendering på Watch.
struct WatchPondusAnalysis: Codable, Hashable, Sendable {
    let score: Int
    let autoritet: Int
    let klarhet: Int
    let troverdighet: Int
    let trygghet: Int
    let fremdrift: Int

    static let empty = WatchPondusAnalysis(
        score: 0,
        autoritet: 0,
        klarhet: 0,
        troverdighet: 0,
        trygghet: 0,
        fremdrift: 0
    )
}

/// Ett steg i en mal. Kort prompt-tekst holdes for lynkort-visning
/// (Watch skjerm er liten — vi trimmer til ~120 tegn på iPhone-siden).
struct WatchPondusStep: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let title: String
    let prompt: String?
    let icon: String?
    let order: Int
}

/// Hoved-DTO for Watch. Alle felt Sendable + Codable for
/// WatchConnectivity + on-disk-cache (UserDefaults).
struct WatchPondusTemplate: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    /// Rå streng (telephone/video/email/meeting/field) — matcher backend.
    let kind: String
    /// Åpen kategori-streng (first_contact/meeting_open/…).
    let category: String
    /// Overordnet mal-score (0-100).
    let score: Int
    let steps: [WatchPondusStep]
    let analysis: WatchPondusAnalysis

    var orderedSteps: [WatchPondusStep] {
        steps.sorted { $0.order < $1.order }
    }

    var kindEmoji: String {
        switch kind {
        case "telephone": return "📞"
        case "video":     return "🎥"
        case "email":     return "✉️"
        case "meeting":   return "📅"
        case "field":     return "🚶"
        default:          return "📄"
        }
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

// MARK: - Message-type-konstanter (delt vokabular mellom Watch og iPhone)

enum WatchPondusMessageType {
    /// iPhone → Watch: full templates-liste (transferUserInfo, bakgrunn-tolerant).
    static let templatesSync = "pondus.templates.sync"
    /// Watch → iPhone: brukeren valgte mal N; iPhone åpner Leadbook > Pondus.
    static let templateActivate = "pondus.template.activate"
}
