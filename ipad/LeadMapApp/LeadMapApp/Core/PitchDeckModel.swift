// PitchDeckModel.swift
//
// Per-org pitch-deck-modeller. Speiler backend (mig 0293):
//   pitch_decks               → PitchDeck
//   pitch_slides              → PitchSlide
//   pitch_deck_presentations  → PitchPresentation
//   pitch_deck_exports        → PitchExport
//
// RBAC-keys som styrer hva UI'et viser:
//   "pitch_deck.access" — vis Pitch Deck-tab + "Presenter pitch"-knapp i lead-detail
//   "pitch_deck.edit"   — vis "Rediger"/"Regenerér" på slides
//   "pitch_deck.export" — vis "Eksportér PDF"-knapp i Studio
//
// Lavt-vekts sjekk for prosjekt-kortet: GET /pitch-deck/availability →
// PitchDeckAvailability. iPad'en kaller denne på lead-detail-åpning så
// vi vet om "📊 Presenter pitch"-CTA skal renderes.

import Foundation

struct PitchDeck: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let orgId: String
    let name: String
    let status: String           // "draft" | "generating" | "ready" | "archived"
    let version: Int
    let lastUsedAt: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case orgId = "org_id"
        case name
        case status
        case version
        case lastUsedAt = "last_used_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct PitchSlide: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let deckId: String
    let position: Int
    let slideType: String        // "problem" | "insight" | "solution" | ...
    let titleMd: String
    let bodyMd: String
    let visualUrl: String?
    let lockedByUser: String?
    let lockedAt: String?
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case deckId = "deck_id"
        case position
        case slideType = "slide_type"
        case titleMd = "title_md"
        case bodyMd = "body_md"
        case visualUrl = "visual_url"
        case lockedByUser = "locked_by_user"
        case lockedAt = "locked_at"
        case updatedAt = "updated_at"
    }

    var isLocked: Bool { lockedByUser != nil }

    /// SF Symbol per slide-type. Drives av designsystem i Studio og
    /// PresentView. Default 'doc.text' for ukjente typer.
    var iconName: String {
        switch slideType {
        case "problem":         return "exclamationmark.bubble"
        case "insight":         return "lightbulb"
        case "solution":        return "wand.and.stars"
        case "demo":            return "play.rectangle"
        case "target":          return "person.2.circle"
        case "differentiator":  return "checkmark.shield"
        case "proof":           return "chart.bar.fill"
        case "business":        return "dollarsign.circle"
        case "ask":             return "hand.raised"
        default:                return "doc.text"
        }
    }
}

struct PitchDeckBundle: Codable, Sendable {
    let deck: PitchDeck
    let slides: [PitchSlide]
}

/// Onboarding-svar — sendes til POST /decks/onboard.
struct PitchOnboardingPayload: Codable, Sendable {
    let organizationId: String
    let name: String
    let industry: String
    let oneLiner: String
    let targetCustomer: String
    let pains: [String]            // nøyaktig 3
    let differentiators: [String]  // nøyaktig 3
    let proofPoints: [String]      // nøyaktig 3
    let locale: String             // "nb" | "en"

    enum CodingKeys: String, CodingKey {
        case organizationId = "organization_id"
        case name
        case industry
        case oneLiner = "one_liner"
        case targetCustomer = "target_customer"
        case pains
        case differentiators
        case proofPoints = "proof_points"
        case locale
    }
}

/// Lett-vekts availability-svar (brukes av lead-detail-kortet).
struct PitchDeckAvailability: Codable, Sendable {
    let available: Bool
    let deckId: String?
    let deckName: String?
    let status: String?
    let slideCount: Int?

    enum CodingKeys: String, CodingKey {
        case available
        case deckId = "deck_id"
        case deckName = "deck_name"
        case status
        case slideCount = "slide_count"
    }
}

/// Presentasjons-sesjon — opprettes ved presentasjonsstart, oppdateres
/// kontinuerlig (slides_shown), avsluttes m/ outcome.
struct PitchPresentation: Identifiable, Codable, Sendable {
    let id: String
    let startedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case startedAt = "started_at"
    }
}

enum PitchOutcome: String, CaseIterable, Codable, Sendable {
    case demoBooked = "demo_booked"
    case interested
    case moreInfo = "more_info"
    case lost
    case followUp = "follow_up"

    var displayLabel: String {
        switch self {
        case .demoBooked:  return "Demo booket"
        case .interested:  return "Interessert"
        case .moreInfo:    return "Trenger mer info"
        case .lost:        return "Tapt"
        case .followUp:    return "Følg opp"
        }
    }

    var iconName: String {
        switch self {
        case .demoBooked: return "calendar.badge.checkmark"
        case .interested: return "hand.thumbsup"
        case .moreInfo:   return "questionmark.circle"
        case .lost:       return "xmark.circle"
        case .followUp:   return "arrow.uturn.right"
        }
    }
}

// MARK: - Response wrappers

struct PitchDecksResponse: Codable, Sendable {
    let decks: [PitchDeck]
}

struct PitchSlideResponse: Codable, Sendable {
    let slide: PitchSlide
}

struct PitchPresentationResponse: Codable, Sendable {
    let presentation: PitchPresentation
}

struct PitchExportResponse: Codable, Sendable {
    let export: PitchExport
}

/// Eksport-svaret (POST /exports).
struct PitchExport: Codable, Sendable {
    let viewToken: String
    let shareUrl: String
    let signedUrl: String?
    let trackingPixel: String

    enum CodingKeys: String, CodingKey {
        case viewToken = "view_token"
        case shareUrl = "share_url"
        case signedUrl = "signed_url"
        case trackingPixel = "tracking_pixel"
    }
}
