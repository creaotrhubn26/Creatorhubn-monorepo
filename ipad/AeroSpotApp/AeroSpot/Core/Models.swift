// Models.swift — AeroSpot domain-typer. Speiler backend-kontrakten
// (/api/aerospot/*) og web-implementasjonens types.ts.

import Foundation
import CoreLocation

enum Rarity: String, Codable, Sendable, CaseIterable {
    case common, uncommon, rare
    case veryRare = "very_rare"
    case legendary

    var label: String {
        switch self {
        case .common: return "VANLIG"
        case .uncommon: return "UVANLIG"
        case .rare: return "SJELDEN"
        case .veryRare: return "SVÆRT SJELDEN"
        case .legendary: return "LEGENDARISK"
        }
    }

    var rank: Int {
        switch self {
        case .common: return 0
        case .uncommon: return 1
        case .rare: return 2
        case .veryRare: return 3
        case .legendary: return 4
        }
    }
}

struct LiveFlight: Codable, Identifiable, Sendable, Equatable {
    let id: String
    let callsign: String
    var flightNumber: String?
    var registration: String?
    var aircraftType: String?
    var aircraftIcao: String?
    var airline: String?
    var origin: String?
    var destination: String?
    let latitude: Double
    let longitude: Double
    let altitudeFt: Int
    let groundSpeedKt: Int
    let verticalSpeedFpm: Int
    let headingDeg: Int
    var etaIso: String?
    let onGround: Bool
    let lastSeenIso: String

    var rarity: Rarity {
        RarityService.classify(aircraftIcao: aircraftIcao, callsign: callsign)
    }

    var isMilitary: Bool {
        RarityService.isMilitary(hex: id, callsign: callsign)
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct Runway: Sendable, Identifiable {
    let id: String
    let headingDeg: Double
    let reciprocal: String
    let lengthM: Int
    let thresholdA: CLLocationCoordinate2D
    let thresholdB: CLLocationCoordinate2D
}

struct Airport: Sendable {
    let icao: String
    let iata: String
    let name: String
    let coordinate: CLLocationCoordinate2D
    let runways: [Runway]

    /// Innflygingskorridor (trakt) for en baneretning, for kart-tegning.
    func approachCorridor(for runwayId: String) -> [CLLocationCoordinate2D]? {
        for rwy in runways {
            if rwy.id == runwayId {
                return OSLData.corridor(threshold: rwy.thresholdA, courseDeg: rwy.headingDeg)
            }
            if rwy.reciprocal == runwayId {
                return OSLData.corridor(threshold: rwy.thresholdB, courseDeg: rwy.headingDeg + 180)
            }
        }
        return nil
    }
}

struct SpottingLocation: Sendable, Identifiable {
    let id: String
    let name: String
    let coordinate: CLLocationCoordinate2D
    let description: String
    let rating: Double
    let bestFor: [String]
    let focalRange: ClosedRange<Int>
    let runwayIds: [String]
    let arrivals: Bool
    let departures: Bool
    let sunNotes: String
    let parking: String
    let walkMinutes: Int
    let restrictions: String?
    /// Kompassretning fotografen typisk peker
    let shootingDirectionDeg: Double
}

struct Weather: Codable, Sendable {
    let temperatureC: Double
    let windDirectionDeg: Double
    let windSpeedKt: Int
    var gustKt: Int?
    let visibilityKm: Double
    let cloudCoverPct: Int
    let precipitationMmH: Double
    let pressureHpa: Int
    var symbol: String?
    let fetchedAtIso: String
}

struct SunTimes: Sendable {
    let sunrise: Date?
    let sunset: Date?
    let goldenHourStart: Date?
    let blueHourStart: Date?
    let azimuthDeg: Double
    let elevationDeg: Double
}

struct RunwayRecommendation: Sendable {
    let runway: String
    let confidence: Double
    let reason: String
}

struct SpottingScore: Sendable {
    let light: Int
    let wind: Int
    let visibility: Int
    let traffic: Int
    let position: Int
    let total: Int
}

struct SpottingRecommendation: Sendable, Identifiable {
    var id: String { location.id }
    let location: SpottingLocation
    let score: SpottingScore
    let explanation: String
}

enum PhotographyMode: String, CaseIterable, Sendable {
    case freeze, panning, propeller, night

    var label: String {
        switch self {
        case .freeze: return "Anbefalt"
        case .panning: return "Panning"
        case .propeller: return "Propell"
        case .night: return "Natt"
        }
    }
}

struct CameraSettingsSnapshot: Sendable, Equatable {
    var shutterSpeed: String?
    var aperture: String?
    var iso: String?
    var focalLengthMm: Int?
}

struct CameraRecommendation: Sendable {
    let shutterSpeed: String
    let aperture: String
    let iso: String
    let focalRange: ClosedRange<Int>
    let explanation: String
}

struct CameraSettingDifference: Sendable, Identifiable {
    var id: String { setting }
    let setting: String
    let recommended: String
    let current: String
    let message: String
}

struct LogbookEntry: Codable, Identifiable, Sendable {
    var id: String
    var dateIso: String
    var location: String?
    var airportIcao: String?
    var flightNumber: String?
    var callsign: String?
    var registration: String?
    var aircraftType: String?
    var airline: String?
    var latitude: Double?
    var longitude: Double?
    var focalLengthMm: Int?
    var shutterSpeed: String?
    var aperture: String?
    var iso: Int?
    var cameraModel: String?
    var lensModel: String?
    var rating: Int?
    var notes: String?
    var favorite: Bool
    var rarity: Rarity?
    var thumbDataURL: String? // nedskalert bilde (loggbok-thumb + deling)
}

struct CommunityPost: Codable, Identifiable, Sendable {
    let id: String
    let userName: String
    var thumbData: String? // data:image base64
    var aircraftType: String?
    var registration: String?
    var airline: String?
    var airportIcao: String?
    var spotName: String?
    var caption: String?
    var likes: Int
    var rarity: Rarity?
    let createdAtIso: String
}

struct EventProgramItem: Codable, Sendable, Hashable {
    let time: String
    let title: String
}

/// Punkt på arrangørens områdekart. type styrer ikon/farge.
struct VenuePin: Codable, Sendable, Hashable, Identifiable {
    var id: String { "\(type)-\(latitude)-\(longitude)" }
    let type: String // photo / entrance / parking / food / toilet / firstaid / display
    let name: String
    let latitude: Double
    let longitude: Double
    var note: String?
}

struct AeroEvent: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let type: String // airshow / flydag / spotting / museum / fly-in
    let venue: String
    let country: String
    var airportIcao: String?
    var latitude: Double?
    var longitude: Double?
    let startDate: String // YYYY-MM-DD
    let endDate: String
    let description: String
    var url: String?
    var ticketUrl: String?
    var program: [EventProgramItem]?
    var aircraft: [String]?
    var verified: Bool?
    var featured: Bool?
    var venueMap: [VenuePin]?
    var contactEmail: String?
    var contactPhone: String?
}

/// Metadata for en områdepunkt-type: ikon, farge, norsk navn.
enum VenuePinKind: String, CaseIterable {
    case photo, entrance, parking, food, toilet, firstaid, display

    var label: String {
        switch self {
        case .photo: return "Fotopunkt"
        case .entrance: return "Inngang"
        case .parking: return "Parkering"
        case .food: return "Mat"
        case .toilet: return "Toalett"
        case .firstaid: return "Førstehjelp"
        case .display: return "Statisk utstilling"
        }
    }
    var systemImage: String {
        switch self {
        case .photo: return "camera.fill"
        case .entrance: return "figure.walk"
        case .parking: return "parkingsign"
        case .food: return "fork.knife"
        case .toilet: return "toilet.fill"
        case .firstaid: return "cross.case.fill"
        case .display: return "airplane"
        }
    }
    static func from(_ raw: String) -> VenuePinKind { VenuePinKind(rawValue: raw) ?? .photo }
}

struct SpottingAlert: Codable, Identifiable, Sendable {
    let id: String
    let kind: String
    let value: String
    var airportIcao: String?
    var radiusKm: Int?
    let enabled: Bool
    let createdAtIso: String
}
