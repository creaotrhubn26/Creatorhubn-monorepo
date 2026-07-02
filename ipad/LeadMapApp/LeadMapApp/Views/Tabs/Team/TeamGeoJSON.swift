// TeamGeoJSON.swift
//
// GeoJSON-territory-data + parser via MKGeoJSONDecoder.
// Hver feature har:
//   - geometry: Polygon (lukket ring m/ lon,lat-koordinater)
//   - properties: { member: String, area: String, colorHex: String }

import Foundation
import MapKit
import UIKit
import SwiftUI

// MARK: - GeoJSON-data (FeatureCollection)
//
// Ekte GeoJSON-format for Oslo-regionen.
// Koordinater er [longitude, latitude] iht. GeoJSON-spec (RFC 7946).

let teamTerritoriesGeoJSON = """
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "member": "Kari",
        "area": "Oslo Vest",
        "colorHex": "#A852FC"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [10.560, 59.985],
          [10.620, 60.000],
          [10.690, 59.990],
          [10.720, 59.955],
          [10.700, 59.920],
          [10.640, 59.918],
          [10.585, 59.935],
          [10.555, 59.960],
          [10.560, 59.985]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "member": "Ola",
        "area": "Oslo Sentrum",
        "colorHex": "#579AFA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [10.745, 59.945],
          [10.795, 59.940],
          [10.835, 59.925],
          [10.830, 59.895],
          [10.795, 59.880],
          [10.755, 59.890],
          [10.730, 59.910],
          [10.735, 59.935],
          [10.745, 59.945]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "member": "Martine",
        "area": "Lørenskog",
        "colorHex": "#33D999"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [10.890, 59.985],
          [10.970, 60.000],
          [11.045, 59.985],
          [11.060, 59.945],
          [11.030, 59.910],
          [10.975, 59.905],
          [10.910, 59.920],
          [10.880, 59.950],
          [10.890, 59.985]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "member": "Henrik",
        "area": "Asker / Bærum",
        "colorHex": "#FAC024"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [10.530, 59.895],
          [10.620, 59.905],
          [10.700, 59.890],
          [10.720, 59.855],
          [10.690, 59.810],
          [10.620, 59.790],
          [10.540, 59.810],
          [10.500, 59.850],
          [10.530, 59.895]
        ]]
      }
    }
  ]
}
"""

// MARK: - Parser

struct GeoJSONTerritory: Identifiable {
    let id = UUID()
    let memberName: String
    let areaName: String
    let color: UIColor
    let polygon: MKPolygon
    let center: CLLocationCoordinate2D
}

/// Standard team-medlem → kommune mapping brukt når vi mangler DB-data.
/// Kommunenumre er 2024-strukturen (etter Vestfold-splitten).
///   0301 = Oslo
///   3024 = Bærum
///   3025 = Asker
///   3229 = Lørenskog
///
/// Senere: hentes fra `enterprise_team_members.assigned_kommune_numbers`
/// pr. medlem (én-til-mange).
struct TeamKommuneAssignment {
    let memberName: String
    let areaName: String   // brukes hvis Kartverket-navn ikke er tilgjengelig
    let colorHex: String
    let kommunenummer: String
}

let defaultTeamKommuneAssignments: [TeamKommuneAssignment] = [
    .init(memberName: "Kari",    areaName: "Bærum",     colorHex: "#A852FC", kommunenummer: "3024"),
    .init(memberName: "Ola",     areaName: "Oslo",      colorHex: "#579AFA", kommunenummer: "0301"),
    .init(memberName: "Martine", areaName: "Lørenskog", colorHex: "#33D999", kommunenummer: "3229"),
    .init(memberName: "Henrik",  areaName: "Asker",     colorHex: "#FAC024", kommunenummer: "3025"),
]

enum GeoJSONLoader {
    /// Hardkodet fallback — brukes når backend/nett er nede.
    static func loadTerritories() -> [GeoJSONTerritory] {
        guard let data = teamTerritoriesGeoJSON.data(using: .utf8) else { return [] }
        let decoder = MKGeoJSONDecoder()
        guard let objects = try? decoder.decode(data) else { return [] }

        var result: [GeoJSONTerritory] = []
        for obj in objects {
            guard let feature = obj as? MKGeoJSONFeature,
                  let propsData = feature.properties,
                  let propsJSON = try? JSONSerialization.jsonObject(with: propsData) as? [String: Any],
                  let member = propsJSON["member"] as? String,
                  let area = propsJSON["area"] as? String,
                  let colorHex = propsJSON["colorHex"] as? String
            else { continue }

            for geom in feature.geometry {
                if let polygon = geom as? MKPolygon {
                    result.append(GeoJSONTerritory(
                        memberName: member,
                        areaName: area,
                        color: UIColor(hex: colorHex),
                        polygon: polygon,
                        center: polygonCentroid(polygon)
                    ))
                }
            }
        }
        return result
    }

    /// Ekte kommunegrenser fra Kartverket. Bygger opp én
    /// `GeoJSONTerritory` per polygon-fragment (én kommune kan ha øyer).
    /// Vent-til-alle mønster: hvis Kartverket bommer på én kommune,
    /// bruker vi hardkodet polygon for den — ikke hele fallback-en.
    @MainActor
    static func loadRealKommuneTerritories(
        assignments: [TeamKommuneAssignment] = defaultTeamKommuneAssignments,
        using api: APIClient
    ) async -> [GeoJSONTerritory] {
        let hardcodedFallback = loadTerritories()
        var result: [GeoJSONTerritory] = []
        for a in assignments {
            if let omr = await KartverketService.shared.fetchKommuneOmrade(
                kommunenummer: a.kommunenummer, using: api
            ) {
                for poly in omr.polygons {
                    result.append(GeoJSONTerritory(
                        memberName: a.memberName,
                        areaName: a.areaName,
                        color: UIColor(hex: a.colorHex),
                        polygon: poly,
                        center: polygonCentroid(poly)
                    ))
                }
            } else if let fb = hardcodedFallback.first(where: {
                $0.memberName == a.memberName
            }) {
                // Én kommune bommet — bruk hardkodet for akkurat denne
                result.append(fb)
            }
        }
        return result.isEmpty ? hardcodedFallback : result
    }

    // Centroid (gjennomsnitt av polygon-punkter) for label-plassering
    static func polygonCentroid(_ polygon: MKPolygon) -> CLLocationCoordinate2D {
        let count = polygon.pointCount
        guard count > 0 else { return polygon.coordinate }
        let pts = UnsafeBufferPointer(start: polygon.points(), count: count)
        var sumLat = 0.0, sumLon = 0.0
        for i in 0..<count {
            let coord = pts[i].coordinate
            sumLat += coord.latitude
            sumLon += coord.longitude
        }
        return CLLocationCoordinate2D(latitude: sumLat / Double(count), longitude: sumLon / Double(count))
    }
}

// MARK: - UIColor hex-init

extension UIColor {
    convenience init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        let r, g, b: CGFloat
        if s.count == 6 {
            r = CGFloat((v >> 16) & 0xFF) / 255
            g = CGFloat((v >> 8) & 0xFF) / 255
            b = CGFloat(v & 0xFF) / 255
        } else {
            r = 1; g = 1; b = 1
        }
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}
