// MeasureToolModels.swift
//
// Data-modeller + formattere for det utvidede måle-verktøyet på Oversikt-
// mini-kartet (2026-07-02). Refaktor fra enkel A→B-avstand til:
//
//   .distance  — klassisk 2-punkt A→B
//   .route     — multi-punkt kjede med per-segment-avstand + total
//   .radius    — én sentrum-koordinat + slider for radius + tell leads
//                innenfor
//
// Sammen med enhet-toggle (metrisk / miles / nautisk) og lagrede ruter
// (UserDefaults) blir dette et fullverdig sales-planleggings-verktøy.

import Foundation
import CoreLocation

// MARK: - Modus

/// Hva slags måling brukeren utfører akkurat nå.
enum MeasureKind: String, CaseIterable, Identifiable, Sendable, Codable {
    case distance   // A → B
    case route      // A → B → C … (multi-stopp)
    case radius     // Sirkel rundt et sentrum

    var id: String { rawValue }

    var label: String {
        switch self {
        case .distance: return "Avstand"
        case .route:    return "Rute"
        case .radius:   return "Radius"
        }
    }

    var icon: String {
        switch self {
        case .distance: return "arrow.left.and.right"
        case .route:    return "point.topleft.down.to.point.bottomright.curvepath.fill"
        case .radius:   return "circle.dashed"
        }
    }

    var tip: String {
        switch self {
        case .distance: return "Tap to punkter for A og B."
        case .route:    return "Tap flere punkter for å bygge en rute."
        case .radius:   return "Tap et senter og juster radius."
        }
    }
}

// MARK: - Punkt-representasjon

/// Ett punkt i ei måling. `leadName` er satt når punktet kom fra en pin
/// (så vi kan vise «Askim → Lillestrøm» i stedet for bare koordinater).
struct MeasurePoint: Identifiable, Sendable, Codable, Hashable {
    var id = UUID()
    let latitude: Double
    let longitude: Double
    let leadName: String?

    init(coord: CLLocationCoordinate2D, leadName: String? = nil) {
        self.latitude = coord.latitude
        self.longitude = coord.longitude
        self.leadName = leadName
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var displayName: String {
        if let n = leadName, !n.isEmpty { return n }
        return String(format: "%.4f, %.4f", latitude, longitude)
    }
}

// MARK: - Enheter

/// Enhet-toggle på måle-banneret. Metrisk auto-veksler mellom m og km
/// avhengig av størrelse.
enum MeasureUnit: String, CaseIterable, Identifiable, Sendable {
    case metric
    case imperial
    case nautical

    var id: String { rawValue }

    var label: String {
        switch self {
        case .metric:    return "Metrisk"
        case .imperial:  return "Miles"
        case .nautical:  return "Nautisk"
        }
    }

    /// Format en avstand i meter til passende visning basert på enhet.
    func format(_ meters: Double) -> String {
        switch self {
        case .metric:
            if meters < 1000 { return String(format: "%d m", Int(meters.rounded())) }
            return String(format: "%.2f km", meters / 1000)
        case .imperial:
            let miles = meters / 1609.344
            if miles < 0.2 {
                let feet = meters * 3.28084
                return String(format: "%d ft", Int(feet.rounded()))
            }
            return String(format: "%.2f mi", miles)
        case .nautical:
            let nm = meters / 1852.0
            return String(format: "%.2f nmi", nm)
        }
    }
}

// MARK: - Lagrede ruter (UserDefaults JSON)

/// En lagret rute (multi-punkt eller enkel avstand) som bruker kan
/// gjenåpne senere. Persisteres i `UserDefaults` under nøkkelen
/// `leadgrid.saved_measure_routes.v1`.
struct SavedMeasureRoute: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var kind: MeasureKind
    var points: [MeasurePoint]
    /// Kun brukt for radius-modus (km).
    var radiusKm: Double?
    var createdAt: Date

    static let storageKey = "leadgrid.saved_measure_routes.v1"

    static func loadAll() -> [SavedMeasureRoute] {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let list = try? JSONDecoder().decode([SavedMeasureRoute].self, from: data)
        else { return [] }
        return list.sorted { $0.createdAt > $1.createdAt }
    }

    static func saveAll(_ list: [SavedMeasureRoute]) {
        guard let data = try? JSONEncoder().encode(list) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    /// Legg til denne ruta i lagret liste + returner oppdatert liste.
    static func append(_ new: SavedMeasureRoute) -> [SavedMeasureRoute] {
        var list = loadAll()
        list.insert(new, at: 0)
        // Hold maks 50 ruter så vi ikke fyller UserDefaults uendelig.
        if list.count > 50 { list.removeLast(list.count - 50) }
        saveAll(list)
        return list
    }

    static func remove(id: UUID) -> [SavedMeasureRoute] {
        var list = loadAll()
        list.removeAll { $0.id == id }
        saveAll(list)
        return list
    }
}

// MARK: - Avstand + rute-hjelpere

enum MeasureMath {
    /// Total Haversine-avstand langs en rute i meter.
    static func totalDistanceMeters(_ points: [MeasurePoint]) -> Double {
        guard points.count >= 2 else { return 0 }
        var sum: Double = 0
        for i in 1..<points.count {
            let a = points[i - 1].coordinate
            let b = points[i].coordinate
            sum += CLLocation(latitude: a.latitude, longitude: a.longitude)
                .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
        }
        return sum
    }

    /// Avstand mellom to koordinater i meter (Haversine).
    static func distanceMeters(
        _ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D
    ) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }

    /// Estimert kjøretid basert på Haversine-avstand + gjennomsnitts-
    /// hastighet 60 km/t (grov by-blanding). Brukes til quick-preview.
    /// For eksakt tid: bruk MKDirections senere.
    static func estimatedDriveMinutes(_ meters: Double) -> Int {
        let hours = (meters / 1000.0) / 60.0
        return max(1, Int((hours * 60).rounded()))
    }

    /// Estimert drivstoff-kostnad basert på 0,7 l/mil (moderne bensinbil)
    /// + prisen bruker gir. Default 21 kr/l (2026 Norge).
    static func estimatedFuelKr(_ meters: Double, pricePerLiter: Double = 21.0) -> Int {
        let km = meters / 1000.0
        let liters = km * 0.07  // 7 l/100 km
        return Int((liters * pricePerLiter).rounded())
    }

    /// Sentroid av en gruppe koordinater — brukes til å ramme inn
    /// resultater i kartet etter en måling.
    static func centroid(_ points: [MeasurePoint]) -> CLLocationCoordinate2D {
        guard !points.isEmpty else {
            return CLLocationCoordinate2D(latitude: 59.913, longitude: 10.753)
        }
        let lat = points.map(\.latitude).reduce(0, +) / Double(points.count)
        let lon = points.map(\.longitude).reduce(0, +) / Double(points.count)
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}
