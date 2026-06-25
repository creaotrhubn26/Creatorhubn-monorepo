import Foundation

// DTOs for the native photographer dashboard surfaces (Galleri/Admin/
// Tilbud/Pris/Meldinger). These mirror the JSON the Express backend
// returns for `/api/photographer/*`, `/api/quotes/*`, `/api/contracts/*`,
// `/api/price-administration/*` and `/api/communication/*`.
//
// Decoding is deliberately tolerant: every optional field defaults to
// nil/0 so a single missing column never fails the whole list. Dates
// stay as raw ISO strings (Postgres timestamps carry microseconds +
// offset that a strict ISO8601 decoder rejects) — render them via
// ``DashboardDate``.
//
// All types are `Sendable` so they cross the actor boundary from
// ``DashboardClient`` into `@MainActor` view models cleanly.

// MARK: - Galleri (showcase-admin)

struct GallerySummary: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var clientName: String?
    var clientEmail: String?
    var projectTitle: String?
    var shareUrl: String?
    var status: String?
    var imageCount: Int
    var commentCount: Int
    var selectionCount: Int
    var favoriteCount: Int
    var paidCount: Int
    var linkedProjectTitle: String?
    var createdAt: String?
    var completedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, clientName, clientEmail, projectTitle, shareUrl, status
        case imageCount, commentCount, selectionCount, favoriteCount, paidCount
        case linkedProjectTitle, createdAt, completedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        clientName = try c.decodeIfPresent(String.self, forKey: .clientName)
        clientEmail = try c.decodeIfPresent(String.self, forKey: .clientEmail)
        projectTitle = try c.decodeIfPresent(String.self, forKey: .projectTitle)
        shareUrl = try c.decodeIfPresent(String.self, forKey: .shareUrl)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        imageCount = (try? c.decodeIfPresent(Int.self, forKey: .imageCount)) ?? 0
        commentCount = (try? c.decodeIfPresent(Int.self, forKey: .commentCount)) ?? 0
        selectionCount = (try? c.decodeIfPresent(Int.self, forKey: .selectionCount)) ?? 0
        favoriteCount = (try? c.decodeIfPresent(Int.self, forKey: .favoriteCount)) ?? 0
        paidCount = (try? c.decodeIfPresent(Int.self, forKey: .paidCount)) ?? 0
        linkedProjectTitle = try c.decodeIfPresent(String.self, forKey: .linkedProjectTitle)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        completedAt = try c.decodeIfPresent(String.self, forKey: .completedAt)
    }
}

struct GalleryListResponse: Codable, Sendable {
    let galleries: [GallerySummary]
}

struct GalleryDetail: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var clientName: String?
    var clientEmail: String?
    var projectTitle: String?
    var shareUrl: String?
    var status: String?
    var imageCount: Int
    var commentCount: Int
    var selectionCount: Int
    var favoriteCount: Int
    var createdAt: String?
    var completedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, clientName, clientEmail, projectTitle, shareUrl, status
        case imageCount, commentCount, selectionCount, favoriteCount
        case createdAt, completedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        clientName = try c.decodeIfPresent(String.self, forKey: .clientName)
        clientEmail = try c.decodeIfPresent(String.self, forKey: .clientEmail)
        projectTitle = try c.decodeIfPresent(String.self, forKey: .projectTitle)
        shareUrl = try c.decodeIfPresent(String.self, forKey: .shareUrl)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        imageCount = (try? c.decodeIfPresent(Int.self, forKey: .imageCount)) ?? 0
        commentCount = (try? c.decodeIfPresent(Int.self, forKey: .commentCount)) ?? 0
        selectionCount = (try? c.decodeIfPresent(Int.self, forKey: .selectionCount)) ?? 0
        favoriteCount = (try? c.decodeIfPresent(Int.self, forKey: .favoriteCount)) ?? 0
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        completedAt = try c.decodeIfPresent(String.self, forKey: .completedAt)
    }
}

struct GalleryImage: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var title: String?
    var description: String?
    var thumbnailUrl: String?
    var fullSizeUrl: String?
    var sortOrder: Int

    private enum CodingKeys: String, CodingKey {
        case id, title, description, thumbnailUrl, fullSizeUrl, sortOrder
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        thumbnailUrl = try c.decodeIfPresent(String.self, forKey: .thumbnailUrl)
        fullSizeUrl = try c.decodeIfPresent(String.self, forKey: .fullSizeUrl)
        sortOrder = (try? c.decodeIfPresent(Int.self, forKey: .sortOrder)) ?? 0
    }
}

struct GalleryDetailResponse: Codable, Sendable {
    let gallery: GalleryDetail
    let images: [GalleryImage]
}

struct GalleryComment: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var imageId: String?
    var imageTitle: String?
    var imageThumbnail: String?
    var clientName: String?
    var clientEmail: String?
    var comment: String?
    var commentType: String?
    var status: String?
    var photographerResponse: String?
    var respondedAt: String?
    var createdAt: String?
}

struct GallerySelection: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var imageId: String?
    var imageTitle: String?
    var imageThumbnail: String?
    var clientEmail: String?
    var selectionType: String?
    var priority: Int
    var clientNotes: String?
    var createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, imageId, imageTitle, imageThumbnail, clientEmail
        case selectionType, priority, clientNotes, createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        imageId = try c.decodeIfPresent(String.self, forKey: .imageId)
        imageTitle = try c.decodeIfPresent(String.self, forKey: .imageTitle)
        imageThumbnail = try c.decodeIfPresent(String.self, forKey: .imageThumbnail)
        clientEmail = try c.decodeIfPresent(String.self, forKey: .clientEmail)
        selectionType = try c.decodeIfPresent(String.self, forKey: .selectionType)
        priority = (try? c.decodeIfPresent(Int.self, forKey: .priority)) ?? 0
        clientNotes = try c.decodeIfPresent(String.self, forKey: .clientNotes)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
    }
}

struct GalleryActivityResponse: Codable, Sendable {
    let comments: [GalleryComment]
    let selections: [GallerySelection]
}

// MARK: - Date helpers

/// Lenient parser/formatter for the ISO-ish timestamps the backend
/// emits (with or without fractional seconds + offset). Returns a
/// short, human "20. jun" / "for 3 t" style string for the field.
enum DashboardDate {
    // Read-only after init and ISO8601DateFormatter's parsing is
    // thread-safe, so `nonisolated(unsafe)` is correct under Swift 6.
    private nonisolated(unsafe) static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private nonisolated(unsafe) static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    // Date-only ("2026-09-12") fallback for event dates without a time.
    private static let dateOnly: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    // "12. sep 2026"
    private static let shortDateFmt: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.setLocalizedDateFormatFromTemplate("d MMM yyyy")
        return f
    }()

    static func parse(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return isoFractional.date(from: raw)
            ?? iso.date(from: raw)
            ?? dateOnly.date(from: String(raw.prefix(10)))
    }

    /// Relative ("for 3 t", "i går") if recent, else short date.
    static func relative(_ raw: String?) -> String {
        guard let date = parse(raw) else { return "" }
        let fmt = RelativeDateTimeFormatter()
        fmt.locale = Locale(identifier: "nb_NO")
        fmt.unitsStyle = .abbreviated
        return fmt.localizedString(for: date, relativeTo: Date())
    }

    /// Friendly absolute date, e.g. "12. sep 2026". Falls back to the raw
    /// string (trimmed to the date part) if it can't be parsed.
    static func shortDate(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "" }
        if let date = parse(raw) { return shortDateFmt.string(from: date) }
        return String(raw.prefix(10))
    }
}
