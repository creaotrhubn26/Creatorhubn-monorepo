// AnnotationModel.swift
//
// Kart-annotasjoner (PR #629). Salgssjef/teamleder tegner med Apple
// Pencil for å vise selgere hvor de skal fokusere.

import Foundation
import CoreLocation

enum AnnotationType: String, Codable, Sendable, CaseIterable {
    case focusArea = "focus_area"     // Polygon — varmt område
    case route                        // LineString — rute A→B
    case pinCallout = "pin_callout"   // Point + tekst på lead
    case freehand                     // Apple Pencil-strøk

    var label: String {
        switch self {
        case .focusArea: return "Fokus-område"
        case .route: return "Rute"
        case .pinCallout: return "Pin-tekst"
        case .freehand: return "Pencil-tegning"
        }
    }

    var iconName: String {
        switch self {
        case .focusArea: return "rectangle.dashed"
        case .route: return "arrow.triangle.swap"
        case .pinCallout: return "text.bubble.fill"
        case .freehand: return "pencil.tip"
        }
    }
}

/// GeoJSON-style geometry. Coordinates er [lng, lat] (GeoJSON-konvensjon).
struct AnnotationGeometry: Codable, Sendable {
    let type: String           // "Polygon" | "LineString" | "Point"
    let coordinates: GeoCoords

    enum GeoCoords: Codable, Sendable {
        case point([Double])                       // [lng, lat]
        case lineString([[Double]])                // [[lng,lat], ...]
        case polygon([[[Double]]])                 // [[[lng,lat], ...]]

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let p = try? c.decode([Double].self) {
                self = .point(p)
            } else if let ls = try? c.decode([[Double]].self) {
                self = .lineString(ls)
            } else if let pg = try? c.decode([[[Double]]].self) {
                self = .polygon(pg)
            } else {
                throw DecodingError.typeMismatch(
                    GeoCoords.self,
                    .init(codingPath: c.codingPath, debugDescription: "Unknown geometry"),
                )
            }
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.singleValueContainer()
            switch self {
            case .point(let p): try c.encode(p)
            case .lineString(let ls): try c.encode(ls)
            case .polygon(let pg): try c.encode(pg)
            }
        }
    }

    /// Konverter til [(lat,lng)] for MapKit
    var clCoordinates: [CLLocationCoordinate2D] {
        switch coordinates {
        case .point(let p) where p.count >= 2:
            return [CLLocationCoordinate2D(latitude: p[1], longitude: p[0])]
        case .lineString(let ls):
            return ls.compactMap {
                guard $0.count >= 2 else { return nil }
                return CLLocationCoordinate2D(latitude: $0[1], longitude: $0[0])
            }
        case .polygon(let pg) where !pg.isEmpty:
            return pg[0].compactMap {
                guard $0.count >= 2 else { return nil }
                return CLLocationCoordinate2D(latitude: $0[1], longitude: $0[0])
            }
        default: return []
        }
    }
}

struct MapAnnotation: Identifiable, Decodable, Sendable {
    let id: String
    let organizationId: String
    let projectId: String?
    let createdByUserId: String
    let annotationType: String
    let geometry: AnnotationGeometry
    let title: String?
    let body: String?
    let color: String
    let strokeWidth: Double
    let assignedToUserId: String?
    let targetLeadId: String?
    let expiresAt: String?
    let archivedAt: String?
    let createdAt: String
    let updatedAt: String
    let createdByName: String?
    let assignedToName: String?
    let targetLeadName: String?

    var typeEnum: AnnotationType? {
        AnnotationType(rawValue: annotationType)
    }

    var coordinates: [CLLocationCoordinate2D] {
        geometry.clCoordinates
    }
}

struct AnnotationsResponse: Decodable, Sendable {
    let annotations: [MapAnnotation]
    let canCreate: Bool
}

/// Payload for å opprette ny annotasjon
struct AnnotationCreatePayload {
    let annotationType: AnnotationType
    let coordinates: [CLLocationCoordinate2D]
    let title: String?
    let body: String?
    let color: String
    let strokeWidth: Double
    let assignedToUserId: String?
    let targetLeadId: String?

    /// Bygg JSON-body for POST. coordinates konverteres til GeoJSON-format.
    var jsonBody: [String: Any] {
        let geomType: String
        let geomCoords: Any
        switch annotationType {
        case .pinCallout:
            geomType = "Point"
            let p = coordinates.first ?? .init()
            geomCoords = [p.longitude, p.latitude]
        case .route, .freehand:
            geomType = "LineString"
            geomCoords = coordinates.map { [$0.longitude, $0.latitude] }
        case .focusArea:
            geomType = "Polygon"
            var ring = coordinates.map { [$0.longitude, $0.latitude] }
            // Polygon må være lukket
            if let first = ring.first, let last = ring.last,
               first[0] != last[0] || first[1] != last[1] {
                ring.append(first)
            }
            geomCoords = [ring]
        }
        var body: [String: Any] = [
            "annotation_type": annotationType.rawValue,
            "geometry": ["type": geomType, "coordinates": geomCoords],
            "color": color,
            "stroke_width": strokeWidth,
        ]
        if let t = title { body["title"] = t }
        if let b = self.body { body["body"] = b }
        if let u = assignedToUserId { body["assigned_to_user_id"] = u }
        if let l = targetLeadId { body["target_lead_id"] = l }
        return body
    }
}
