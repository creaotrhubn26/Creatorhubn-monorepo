import Foundation

struct DiscoveryV2PlaceDetailsResponse: Codable, Hashable, Sendable {
    var candidateId: String
    var mode: String
    var fetchedAt: String
    var provider: DiscoveryV2PlaceProvider
    var notice: String
    var rankingNotice: String
    var matches: [DiscoveryV2PlaceMatch]

    enum CodingKeys: String, CodingKey {
        case mode, provider, notice, matches
        case candidateId = "candidate_id"
        case fetchedAt = "fetched_at"
        case rankingNotice = "ranking_notice"
    }
}

struct DiscoveryV2PlaceProvider: Codable, Hashable, Sendable {
    var id: String
    var name: String
    var policyUri: String

    enum CodingKeys: String, CodingKey {
        case id, name
        case policyUri = "policy_uri"
    }
}

struct DiscoveryV2PlaceAttribution: Codable, Hashable, Sendable, Identifiable {
    var provider: String
    var providerUri: String?

    var id: String { provider + "|" + (providerUri ?? "") }
    var providerURL: URL? { safeDiscoveryPlaceURL(providerUri, httpsOnly: true) }

    enum CodingKeys: String, CodingKey {
        case provider
        case providerUri = "provider_uri"
    }
}

struct DiscoveryV2PlaceMatch: Codable, Hashable, Sendable, Identifiable {
    var placeId: String
    var displayName: String
    var formattedAddress: String?
    var latitude: Double?
    var longitude: Double?
    var primaryType: String?
    var primaryTypeLabel: String?
    var businessStatus: String?
    var websiteUri: String?
    var nationalPhoneNumber: String?
    var internationalPhoneNumber: String?
    var googleMapsUri: String?
    var attributions: [DiscoveryV2PlaceAttribution]
    var matchQuality: String
    var matchReasons: [String]

    var id: String { placeId }
    var phoneNumber: String? { internationalPhoneNumber ?? nationalPhoneNumber }
    var websiteURL: URL? { safeDiscoveryPlaceURL(websiteUri) }
    var googleMapsURL: URL? { safeDiscoveryPlaceURL(googleMapsUri, httpsOnly: true) }
    var phoneURL: URL? {
        guard let phoneNumber else { return nil }
        let normalized = phoneNumber.filter { $0.isNumber || $0 == "+" }
        guard normalized.filter(\.isNumber).count >= 3 else { return nil }
        return URL(string: "tel:" + normalized)
    }

    var matchQualityTitle: String {
        switch matchQuality {
        case "strong": "Sterkt identitetstreff"
        case "possible": "Mulig identitetstreff"
        default: "Svakt mulig treff"
        }
    }

    var businessStatusTitle: String? {
        switch businessStatus {
        case "OPERATIONAL": "I drift"
        case "CLOSED_TEMPORARILY": "Midlertidig stengt"
        case "CLOSED_PERMANENTLY": "Permanent stengt"
        case "FUTURE_OPENING": "Åpner senere"
        default: nil
        }
    }

    enum CodingKeys: String, CodingKey {
        case latitude, longitude, attributions
        case placeId = "place_id"
        case displayName = "display_name"
        case formattedAddress = "formatted_address"
        case primaryType = "primary_type"
        case primaryTypeLabel = "primary_type_label"
        case businessStatus = "business_status"
        case websiteUri = "website_uri"
        case nationalPhoneNumber = "national_phone_number"
        case internationalPhoneNumber = "international_phone_number"
        case googleMapsUri = "google_maps_uri"
        case matchQuality = "match_quality"
        case matchReasons = "match_reasons"
    }
}

private func safeDiscoveryPlaceURL(
    _ rawValue: String?,
    httpsOnly: Bool = false
) -> URL? {
    guard let rawValue,
          let components = URLComponents(string: rawValue),
          components.user == nil,
          components.password == nil,
          let scheme = components.scheme?.lowercased(),
          httpsOnly ? scheme == "https" : ["http", "https"].contains(scheme)
    else {
        return nil
    }
    return components.url
}
