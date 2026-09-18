// GuideModels.swift
//
// Codable-modeller som speiler svaret fra backend/server/reiseguide-routes.ts
// (GET /api/guide/areas, /api/guide/areas/:idOrSlug, /api/guide/pois/:idOrSlug).
// Feltnavnene er identiske med JSON-en, så JSONDecoder brukes uten keyStrategy.
// Testfixture: ReiseguideTests/Fixtures/area-nb.json (ekte svar fra backend).

import Foundation

struct Coordinate: Codable, Sendable, Equatable {
    let lat: Double
    let lng: Double
}

struct BoundingBox: Codable, Sendable, Equatable {
    let south: Double
    let west: Double
    let north: Double
    let east: Double
}

struct GuideArea: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let slug: String
    let name: String
    let defaultLang: String
    let center: Coordinate
    let bbox: BoundingBox
    let priceNok: Int?
    let languages: [String]
    let poiCount: Int
}

struct AreasResponse: Codable, Sendable {
    let areas: [GuideArea]
}

struct GuideCategory: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let label: String
    let labels: [String: String]
    let sortOrder: Int
}

struct PracticalInfoItem: Codable, Sendable, Equatable, Hashable {
    let label: String
    let value: String
}

struct LanguageInfo: Codable, Sendable, Equatable {
    let requested: String
    let resolved: String?
    let fallbackUsed: Bool
    let autoTranslated: Bool
    let editorialStatus: String?
    let available: [String]
}

struct ChapterAudio: Codable, Sendable, Equatable {
    let url: String
    let format: String
    let durationS: Double
}

/// Én tekstingscue. Backend lagrer cues som fri jsonb; feltene er valgfrie så
/// en halvferdig cue aldri velter dekodingen av hele området.
struct CaptionCue: Codable, Sendable, Equatable {
    let startS: Double?
    let endS: Double?
    let text: String?
}

struct ChapterCaptions: Codable, Sendable, Equatable {
    let url: String?
    let cues: [CaptionCue]
}

struct GuideChapter: Codable, Sendable, Identifiable, Equatable {
    var id: Int { no }
    let no: Int
    let title: String?
    let scriptText: String
    let imageUrl: String?
    let imageAlt: String?
    let version: Int
    let editorialStatus: String
    let estimatedDurationS: Int?
    let audio: ChapterAudio?
    let captions: ChapterCaptions?

    /// Varighet brukt av avspilleren: ekte lyd hvis den finnes, ellers
    /// manusets anslag, ellers 60 s så tidslinjen aldri er tom.
    var playbackDurationS: Double {
        if let audio { return audio.durationS }
        if let estimated = estimatedDurationS { return Double(estimated) }
        return 60
    }
}

enum VariantKind: String, Codable, Sendable {
    case narration
    case audioDescription = "audio_description"
}

struct GuideVariant: Codable, Sendable, Equatable {
    let kind: VariantKind
    let lang: String
    let autoTranslated: Bool
    let durationS: Double?
    let hasAudio: Bool
    let hasCaptions: Bool
    let chapters: [GuideChapter]
}

struct GuideVariants: Codable, Sendable, Equatable {
    let narration: GuideVariant?
    let audioDescription: GuideVariant?
}

struct GuidePOI: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let slug: String
    let areaId: String
    let categoryId: String?
    let lat: Double
    let lng: Double
    let triggerRadiusM: Int
    let priority: Int
    let sortOrder: Int
    let freePreview: Bool
    let heroImageUrl: String?
    let heroImageAlt: String?
    let title: String
    let subtitle: String?
    let summary: String?
    let locationLabel: String?
    let practicalInfo: [PracticalInfoItem]
    let lang: LanguageInfo
    let variants: GuideVariants

    var coordinate: Coordinate { Coordinate(lat: lat, lng: lng) }

    /// Fortellingen, eller synstolkingen hvis fortellingen mangler. Brukes der
    /// UI-et bare trenger «det som kan spilles».
    var primaryVariant: GuideVariant? { variants.narration ?? variants.audioDescription }

    var hasAudioDescription: Bool { variants.audioDescription != nil }

    var hasCaptions: Bool {
        (variants.narration?.hasCaptions ?? false) || (variants.audioDescription?.hasCaptions ?? false)
    }

    /// Samlet varighet i sekunder, eller nil hvis ingen kapitler har verdi.
    var totalDurationS: Double? { primaryVariant?.durationS }
}

struct AreaResponse: Codable, Sendable, Equatable {
    let area: GuideArea
    let requestedLang: String
    let categories: [GuideCategory]
    let pois: [GuidePOI]
}

struct POIResponse: Codable, Sendable {
    let requestedLang: String
    let poi: GuidePOI
}
