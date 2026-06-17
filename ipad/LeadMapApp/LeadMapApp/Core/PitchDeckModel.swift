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
    let format: String           // "long" (11) | "short" (10)
    let coverLogoUrl: String?
    let coverTagline: String?
    let coverFetchedAt: String?
    let lastUsedAt: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case orgId = "org_id"
        case name
        case status
        case version
        case format
        case coverLogoUrl = "cover_logo_url"
        case coverTagline = "cover_tagline"
        case coverFetchedAt = "cover_fetched_at"
        case lastUsedAt = "last_used_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Strukturert bullet for core_features-slide. Ikon er SF Symbol-navn,
/// bevisst nøytrale forretnings-ikoner (ingen sparkles/wand.and.stars).
struct PitchSlideBullet: Codable, Hashable, Sendable {
    let icon: String
    let label: String
    let body: String?
}

struct PitchBeforeAfter: Codable, Hashable, Sendable {
    let before: [String]
    let after: [String]
}

struct PitchMockup: Codable, Hashable, Sendable {
    let url: String
    let caption: String?
}

struct PitchSlide: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let deckId: String
    let position: Int
    let slideType: String
    let titleMd: String
    let bodyMd: String
    let visualUrl: String?
    let oneIdea: String?
    let bullets: [PitchSlideBullet]
    let beforeAfter: PitchBeforeAfter?
    let mockupUrls: [PitchMockup]
    /// Org-styrt: hvis false er sliden skjult fra presentasjon. Innholdet
    /// bevares i master så det kan re-aktiveres uten å regenerere.
    let isIncluded: Bool
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
        case oneIdea = "one_idea"
        case bullets
        case beforeAfter = "before_after"
        case mockupUrls = "mockup_urls"
        case isIncluded = "is_included"
        case lockedByUser = "locked_by_user"
        case lockedAt = "locked_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        deckId = try c.decode(String.self, forKey: .deckId)
        position = try c.decode(Int.self, forKey: .position)
        slideType = try c.decode(String.self, forKey: .slideType)
        titleMd = try c.decode(String.self, forKey: .titleMd)
        bodyMd = try c.decode(String.self, forKey: .bodyMd)
        visualUrl = try c.decodeIfPresent(String.self, forKey: .visualUrl)
        oneIdea = try c.decodeIfPresent(String.self, forKey: .oneIdea)
        bullets = (try? c.decode([PitchSlideBullet].self, forKey: .bullets)) ?? []
        // before_after kan komme som {} fra backend default
        if let ba = try? c.decode(PitchBeforeAfter.self, forKey: .beforeAfter),
           !ba.before.isEmpty || !ba.after.isEmpty {
            beforeAfter = ba
        } else {
            beforeAfter = nil
        }
        mockupUrls = (try? c.decode([PitchMockup].self, forKey: .mockupUrls)) ?? []
        isIncluded = (try? c.decode(Bool.self, forKey: .isIncluded)) ?? true
        lockedByUser = try c.decodeIfPresent(String.self, forKey: .lockedByUser)
        lockedAt = try c.decodeIfPresent(String.self, forKey: .lockedAt)
        updatedAt = try c.decode(String.self, forKey: .updatedAt)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(deckId, forKey: .deckId)
        try c.encode(position, forKey: .position)
        try c.encode(slideType, forKey: .slideType)
        try c.encode(titleMd, forKey: .titleMd)
        try c.encode(bodyMd, forKey: .bodyMd)
        try c.encodeIfPresent(visualUrl, forKey: .visualUrl)
        try c.encodeIfPresent(oneIdea, forKey: .oneIdea)
        try c.encode(bullets, forKey: .bullets)
        try c.encodeIfPresent(beforeAfter, forKey: .beforeAfter)
        try c.encode(mockupUrls, forKey: .mockupUrls)
        try c.encode(isIncluded, forKey: .isIncluded)
        try c.encodeIfPresent(lockedByUser, forKey: .lockedByUser)
        try c.encodeIfPresent(lockedAt, forKey: .lockedAt)
        try c.encode(updatedAt, forKey: .updatedAt)
    }

    var isLocked: Bool { lockedByUser != nil }

    /// SF Symbol per slide-type. Drives av designsystem i Studio og
    /// PresentView. Bevisst nøytrale, forretnings-typede ikoner —
    /// ingen "AI-magic"-klisjeer (sparkles/wand.and.stars).
    var iconName: String {
        switch slideType {
        case "cover":            return "rectangle.fill"
        case "intro":            return "text.book.closed"
        case "problem":          return "exclamationmark.bubble"
        case "current_friction": return "arrow.left.arrow.right"
        case "solution":         return "rectangle.stack"
        case "how_it_works":     return "arrow.triangle.branch"
        case "core_features":    return "square.grid.3x3.fill"
        case "before_after":     return "arrow.left.and.right.righttriangle.left.righttriangle.right"
        case "value":            return "chart.line.uptrend.xyaxis"
        case "pilot":            return "flag.checkered"
        case "next_step":        return "arrow.right.circle"
        // Bakoverkompatibel:
        case "insight":          return "lightbulb"
        case "demo":             return "play.rectangle"
        case "target":           return "person.2.circle"
        case "differentiator":   return "checkmark.shield"
        case "proof":            return "chart.bar.fill"
        case "business":         return "dollarsign.circle"
        case "ask":              return "hand.raised"
        default:                 return "doc.text"
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
    let format: String             // "long" (11 slides) | "short" (10 slides)
    let websiteUrl: String?        // Auto-fetcher cover-logo + tagline

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
        case format
        case websiteUrl = "website_url"
    }
}

// MARK: - Pre-møte-brief

struct PitchObjection: Codable, Hashable, Sendable {
    let q: String
    let a: String
}

struct PitchBrief: Codable, Sendable {
    let recommendedSlideIds: [String]
    let talkingPoints: [String: String]
    let objections: [PitchObjection]
    let generatedAt: String
    let claudeModel: String

    enum CodingKeys: String, CodingKey {
        case recommendedSlideIds = "recommended_slide_ids"
        case talkingPoints = "talking_points"
        case objections
        case generatedAt = "generated_at"
        case claudeModel = "claude_model"
    }
}

struct PitchLeadContext: Codable, Sendable {
    let name: String
    let industry: String?
    let city: String?
    let category: String?
    let sizeHint: String?
    let recentNotes: [String]

    enum CodingKeys: String, CodingKey {
        case name, industry, city, category
        case sizeHint = "size_hint"
        case recentNotes = "recent_notes"
    }
}

struct PitchBriefResponse: Codable, Sendable {
    let brief: PitchBrief
    let leadContext: PitchLeadContext

    enum CodingKeys: String, CodingKey {
        case brief
        case leadContext = "lead_context"
    }
}

// MARK: - Per-lead Value-override

struct PitchValueOverride: Codable, Sendable {
    let titleMd: String
    let bodyMd: String
    let bullets: [PitchSlideBullet]

    enum CodingKeys: String, CodingKey {
        case titleMd = "title_md"
        case bodyMd = "body_md"
        case bullets
    }
}

struct PitchValueOverrideResponse: Codable, Sendable {
    let override: PitchValueOverride
}

// MARK: - Finalize

struct PitchFinalizeApplied: Codable, Sendable {
    let leadStatusSet: String?
    let nextFollowUpAt: String?
    let calendarEventHint: CalendarHint?

    struct CalendarHint: Codable, Sendable {
        let title: String
        let suggestedAt: String

        enum CodingKeys: String, CodingKey {
            case title
            case suggestedAt = "suggested_at"
        }
    }

    enum CodingKeys: String, CodingKey {
        case leadStatusSet = "lead_status_set"
        case nextFollowUpAt = "next_follow_up_at"
        case calendarEventHint = "calendar_event_hint"
    }
}

struct PitchFinalizeResponse: Codable, Sendable {
    let ok: Bool
    let applied: PitchFinalizeApplied?
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

struct PitchTrashResponse: Codable, Sendable {
    let slides: [PitchSlide]
}

// MARK: - Asset-upload (mockups)

struct PitchAssetUpload: Codable, Sendable {
    let id: String
    let assetType: String
    let mimeType: String
    let sizeBytes: Int
    let signedUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case assetType = "asset_type"
        case mimeType = "mime_type"
        case sizeBytes = "size_bytes"
        case signedUrl = "signed_url"
    }
}

struct PitchAssetUploadResponse: Codable, Sendable {
    let asset: PitchAssetUpload
}

struct PitchAssetUrlsResponse: Codable, Sendable {
    let urls: [String: String]   // asset_id → signed URL
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
