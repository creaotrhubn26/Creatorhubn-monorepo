// VehicleProfile.swift
//
// «Min bil»-profil: brukerens kjøretøy (drivstoff + type), som skreddersyr
// navigasjonen — hvilke POI som vises (lade vs bensin), riktig statens-sats i
// kjøregodtgjørelse, og anbefalinger. Kan settes manuelt (ugated) eller fylles
// automatisk fra Vegvesens kjøretøyregister (regnr-oppslag, se VehicleService).
//
// Persisteres i UserDefaults. ALDRI eier-info her — kun tekniske felt.

import Foundation

enum VehicleFuel: String, Codable, CaseIterable, Hashable {
    case ev, hybrid, diesel, petrol, unknown

    var label: String {
        switch self {
        case .ev:      return "El-bil"
        case .hybrid:  return "Hybrid"
        case .diesel:  return "Diesel"
        case .petrol:  return "Bensin"
        case .unknown: return "Ukjent"
        }
    }
    var icon: String {
        switch self {
        case .ev:      return "bolt.car.fill"
        case .hybrid:  return "leaf.fill"
        case .diesel, .petrol: return "fuelpump.fill"
        case .unknown: return "car.fill"
        }
    }
    /// Elektrisk framdrift (ren el) → lade-POI, el-sats, bom-rabatt.
    var isElectric: Bool { self == .ev }
    /// Trenger drivstoff (viser bensin-POI). Hybrid teller med (kan tanke).
    var usesFuel: Bool { self == .diesel || self == .petrol || self == .hybrid }

    /// Vegvesens `drivstoffKodeMiljodata.kodeVerdi` → vår enum.
    static func fromNvdbCode(_ code: String?) -> VehicleFuel {
        guard let c = code?.lowercased() else { return .unknown }
        if c.contains("elektr") { return .ev }
        if c.contains("hybrid") || c.contains("ladbar") { return .hybrid }
        if c.contains("diesel") { return .diesel }
        if c.contains("bensin") { return .petrol }
        return .unknown
    }
}

struct VehicleProfile: Codable, Hashable {
    var fuel: VehicleFuel = .unknown
    var kind: Kind = .car
    /// Registreringsnummer (kun hvis satt via oppslag). Vises, ikke sensitivt.
    var plate: String? = nil
    /// «Tesla Model Y» e.l. fra registeret. nil ved manuell profil.
    var displayName: String? = nil
    /// Firmabil (arbeidsgivers) vs privat bil brukt i jobb. Påvirker kjørebok-
    /// klassifisering og hvem som eier kostnaden. Default false (privat).
    var isCompanyCar: Bool = false
    /// EU-kontroll (PKK) neste frist fra Vegvesen (ISO-dato). Til vedlikeholds-varsel.
    var euControlDue: String? = nil

    enum Kind: String, Codable, CaseIterable, Hashable {
        case car = "Personbil", motorcycle = "Motorsykkel", moped = "Moped"
        var icon: String {
            switch self {
            case .car:        return "car.fill"
            case .motorcycle: return "scooter"
            case .moped:      return "scooter"
            }
        }
    }

    /// Har brukeren satt profilen (så vi kan skreddersy)?
    var isConfigured: Bool { fuel != .unknown || displayName != nil }

    /// Statens sats 2026 (skattefri), avhengig av type + drivstoff.
    var mileageRate: Double {
        switch kind {
        case .car:        return fuel.isElectric ? 3.60 : 3.50
        case .motorcycle: return 2.95
        case .moped:      return 1.80
        }
    }

    /// POI-typer som er relevante å vise som standard for denne bilen.
    var defaultPOIKinds: Set<NavPOIKind> {
        if fuel.isElectric { return [.charging] }
        if fuel.usesFuel { return [.gas] }
        return []   // ukjent → skjult som før
    }
}

/// Lettvekt UserDefaults-persistens for «Min bil».
enum VehicleProfileStore {
    private static let key = "leadgrid.vehicleProfile"

    static func load() -> VehicleProfile {
        guard let data = UserDefaults.standard.data(forKey: key),
              let p = try? JSONDecoder().decode(VehicleProfile.self, from: data) else {
            return VehicleProfile()
        }
        return p
    }

    static func save(_ profile: VehicleProfile) {
        if let data = try? JSONEncoder().encode(profile) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
