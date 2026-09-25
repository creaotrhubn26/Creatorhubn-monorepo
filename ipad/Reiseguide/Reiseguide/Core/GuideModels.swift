// GuideModels.swift
//
// Codable-modeller som speiler svaret fra backend/server/reiseguide-routes.ts
// (GET /api/guide/areas, /api/guide/areas/:idOrSlug, /api/guide/pois/:idOrSlug).
// Feltnavnene er identiske med JSON-en, så JSONDecoder brukes uten keyStrategy.
// Testfixture: ReiseguideTests/Fixtures/area-nb.json (ekte svar fra backend).
//
// «Etter besøket» (migrasjon 0641): quiz, rating og shareUrl per POI. De er
// valgfrie i dekodingen så et eldre cachet svar fortsatt kan leses.

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
    /// Spørsmål underveis (0662); valgfri så eldre cache dekodes. Se ChapterPrompts.swift.
    var prompts: [ChapterPrompt]?

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

/// Ett quiz-spørsmål; `correctIndex` peker inn i `options`.
struct QuizQuestion: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let no: Int
    let question: String
    let options: [String]
    let correctIndex: Int
    let explanation: String?
}

/// Snitt (én desimal) og antall stjernerangeringer fra backend.
struct RatingSummary: Codable, Sendable, Equatable {
    let average: Double
    let count: Int
}

/// Svar fra POST /api/guide/pois/:idOrSlug/rating.
struct RatingResponse: Codable, Sendable, Equatable {
    let poiId: String
    let yourStars: Int
    let rating: RatingSummary?
}

/// Ett besøk slik serveren har det (PUT/GET /api/guide/device/visits).
struct ServerVisit: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let poiId: String
    let poiSlug: String?
    let startedAt: String
    let completedAt: String?
    let stars: Int?
    let quizCorrect: Int?
    let quizTotal: Int?
}

/// Svar på synk av besøksloggen (migrasjon 0642).
struct VisitSyncResponse: Codable, Sendable, Equatable {
    let deviceId: String
    let saved: Int
    let skipped: [String]
    let retentionDays: Int
    let visits: [ServerVisit]
}

/// Svar på sletting (ett besøk, hele loggen eller alle data om enheten).
struct DeviceDeletionResponse: Codable, Sendable, Equatable {
    struct Counts: Codable, Sendable, Equatable {
        let visits: Int
        let ratings: Int?
    }

    let deviceId: String
    let deleted: Counts
}

/// Kreditering av heltebildet (migrasjon 0663): Commons-lisensene krever at
/// fotograf og lisens vises der bildet vises. Null fra backend når stedet ikke
/// har bilde eller opphavet mangler.
struct HeroImageCredit: Codable, Sendable, Equatable {
    let author: String
    let license: String?
    let licenseUrl: String?
    let sourceUrl: String?

    /// Filsiden på Commons som URL; nil hvis backend ikke ga noen.
    var sourceURL: URL? { sourceUrl.flatMap { URL(string: $0) } }
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
    /// Valgfri så eldre svar i hurtigbufferen og testdata uten feltet fortsatt dekodes.
    var heroImageCredit: HeroImageCredit?
    let title: String
    let subtitle: String?
    let summary: String?
    let locationLabel: String?
    let practicalInfo: [PracticalInfoItem]
    let lang: LanguageInfo
    let variants: GuideVariants
    let quiz: [QuizQuestion]?
    let rating: RatingSummary?
    let shareUrl: String?

    var coordinate: Coordinate { Coordinate(lat: lat, lng: lng) }

    var quizQuestions: [QuizQuestion] { quiz ?? [] }

    /// Delingslenke som URL; nil hvis backend ikke ga noen.
    var shareURL: URL? { shareUrl.flatMap { URL(string: $0) } }

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
    /// Stemmene brukeren kan velge for språket (tom eller nil = ingen valg).
    /// Mangler i eldre svar og cache.
    var voices: [GuideVoice]?
}

/// En fortellerstemme (Daniel 25.09.2026): norsk har Hazel og Walter fra
/// Soniox, vist med norske navn. `id` sendes tilbake som `?voice=`.
struct GuideVoice: Codable, Sendable, Equatable, Hashable, Identifiable {
    let id: String
    let name: String
    /// "female" eller "male".
    let gender: String
}

struct POIResponse: Codable, Sendable {
    let requestedLang: String
    let poi: GuidePOI
}
