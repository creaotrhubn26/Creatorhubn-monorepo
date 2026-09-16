// GearStore.swift — brukerens kamera-utstyr. Settes én gang; brukes til
// å klippe objektiv-anbefalinger til det brukeren faktisk eier (fikser
// «foreslår 800 mm du ikke har»).

import Foundation
import Observation

struct LensSpec: Codable, Sendable, Identifiable, Hashable {
    var id = UUID()
    var name: String
    var minMm: Int
    var maxMm: Int
}

/// Kamerahus-type → crop-faktor (reach-multiplikator).
enum BodyKind: String, Codable, CaseIterable, Sendable {
    case fullFrame, apscCanon, apsc, m43

    var label: String {
        switch self {
        case .fullFrame: return "Fullformat"
        case .apscCanon: return "APS-C (Canon)"
        case .apsc: return "APS-C (Nikon/Sony)"
        case .m43: return "Micro 4/3"
        }
    }
    var cropFactor: Double {
        switch self {
        case .fullFrame: return 1.0
        case .apscCanon: return 1.6
        case .apsc: return 1.5
        case .m43: return 2.0
        }
    }
}

@MainActor
@Observable
final class GearStore {
    var body: BodyKind {
        didSet { save() }
    }
    var lenses: [LensSpec] {
        didSet { save() }
    }

    private static let bodyKey = "aerospot.gear.body"
    private static let lensKey = "aerospot.gear.lenses"

    init() {
        body = BodyKind(rawValue: UserDefaults.standard.string(forKey: Self.bodyKey) ?? "") ?? .fullFrame
        if let data = UserDefaults.standard.data(forKey: Self.lensKey),
           let decoded = try? JSONDecoder().decode([LensSpec].self, from: data) {
            lenses = decoded
        } else {
            lenses = []
        }
    }

    private func save() {
        UserDefaults.standard.set(body.rawValue, forKey: Self.bodyKey)
        if let data = try? JSONEncoder().encode(lenses) {
            UserDefaults.standard.set(data, forKey: Self.lensKey)
        }
    }

    var hasGear: Bool { !lenses.isEmpty }

    /// Objektiv-rekkevidde brukeren faktisk eier (min av alle min, maks av
    /// alle maks). nil hvis ingen objektiver registrert.
    var ownedLensRange: ClosedRange<Int>? {
        guard let lo = lenses.map(\.minMm).min(),
              let hi = lenses.map(\.maxMm).max() else { return nil }
        return lo...max(lo, hi)
    }
}
