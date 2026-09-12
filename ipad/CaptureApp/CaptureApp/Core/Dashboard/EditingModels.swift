import Foundation

/// An external editing partner from the Partner Program discovery
/// (`/api/editing/vendors`) — an approved, compliance-verified editor the
/// photographer can hand a project to.
struct EditingVendor: Decodable, Sendable, Identifiable, Hashable {
    var id: String { vendorUserId }
    let vendorUserId: String
    var vendorName: String?
    var tagline: String?
    var rating: Double?
    var reviewCount: Int
    var turnaroundDays: Int?
    var availabilityStatus: String?
    var tier: String?
    var verificationPercent: Int?
    var isInternational: Bool
    var requiresExtraGdpr: Bool
    var services: [EditingService]

    private enum CodingKeys: String, CodingKey {
        case vendorUserId, vendorName, tagline, rating, reviewCount, turnaroundDays
        case availabilityStatus, tier, verificationPercent, isInternational
        case requiresExtraGdpr, services
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        vendorUserId = (try? c.decode(String.self, forKey: .vendorUserId)) ?? UUID().uuidString
        vendorName = c.firstString([.vendorName])
        tagline = c.firstString([.tagline])
        rating = c.firstDouble([.rating])
        reviewCount = c.firstInt([.reviewCount]) ?? 0
        turnaroundDays = c.firstInt([.turnaroundDays])
        availabilityStatus = c.firstString([.availabilityStatus])
        tier = c.firstString([.tier])
        verificationPercent = c.firstInt([.verificationPercent])
        isInternational = c.firstBool([.isInternational]) ?? false
        requiresExtraGdpr = c.firstBool([.requiresExtraGdpr]) ?? false
        services = (try? c.decodeIfPresent([EditingService].self, forKey: .services)) ?? []
    }
}

struct EditingService: Decodable, Sendable, Hashable {
    var category: String?
    var name: String?
    var price: Double?
    var currency: String?

    private enum CodingKeys: String, CodingKey { case category, name, price, currency }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        category = c.firstString([.category])
        name = c.firstString([.name])
        price = c.firstDouble([.price])
        currency = c.firstString([.currency])
    }
}

struct EditingVendorListResponse: Decodable, Sendable {
    var vendors: [EditingVendor]
    private enum CodingKeys: String, CodingKey { case vendors }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        vendors = (try? c.decodeIfPresent([EditingVendor].self, forKey: .vendors)) ?? []
    }
}
