// RarityService.swift — rarity-klassifisering. Speiler web-versjonen.
// ponytail: statisk frekvenstabell; oppgrader til loggbok-basert
// historikk-scoring når data finnes.

import Foundation

enum RarityService {
    private static let typeRarity: [String: Rarity] = [
        "B738": .common, "B38M": .common, "A320": .common, "A20N": .common,
        "A21N": .common, "E190": .common, "DH8D": .common, "AT76": .common,
        "B788": .uncommon, "B789": .uncommon, "A333": .uncommon, "A339": .uncommon,
        "B77W": .rare, "A359": .rare, "B763": .rare,
        "B748": .veryRare, "A388": .veryRare, "B744": .veryRare, "MD11": .veryRare,
        "A124": .legendary, "A225": .legendary, "C5M": .legendary, "B52": .legendary,
    ]

    private static let militaryPrefixes = ["C17", "C30", "A400", "K35", "E3", "P8"]
    private static let cargoAirlines = ["FDX", "UPS", "GTI", "CLX", "BCS", "ABW"]

    static func classify(aircraftIcao: String?, callsign: String?) -> Rarity {
        let icao = (aircraftIcao ?? "").uppercased()
        let cs = (callsign ?? "").uppercased()

        if isMilitary(hex: nil, callsign: callsign) { return .veryRare }
        if var base = typeRarity[icao] {
            if base == .rare, cargoAirlines.contains(where: { cs.hasPrefix($0) }) {
                base = .veryRare
            }
            return base
        }
        if militaryPrefixes.contains(where: { icao.hasPrefix($0) }) { return .veryRare }
        return .common
    }

    // ── Militær-deteksjon ────────────────────────────────────────────
    // Ingen flytype fra ADS-B, så vi bruker (a) ICAO24 hex-blokker som er
    // reservert militært, og (b) taktiske callsign-mønstre.

    /// Militære callsign-mønstre (NATO, US, UK, norsk øvelse).
    private static let militaryCallsigns = [
        "NATO", "RCH", "RRR", "CFC", "BAF", "GAF", "IAM", "NAF", "RNO",
        "ASCOT", "REACH", "HOTEL", "VIKING", "MMF", "TARTAN", "DUKE",
    ]

    /// Militær-callsigns som 3-tegns airline-prefiks (NATO Boeing = NATO,
    /// US Air Force = RCH, RAF = RRR, Canadian Forces = CFC, osv.)
    static func isMilitary(hex: String?, callsign: String?) -> Bool {
        let cs = (callsign ?? "").uppercased().trimmingCharacters(in: .whitespaces)
        if militaryCallsigns.contains(where: { cs.hasPrefix($0) }) { return true }
        if let hex = hex?.lowercased(), isMilitaryHex(hex) { return true }
        return false
    }

    /// ICAO24-adresseblokker reservert militært (utvalg, kan utvides).
    /// Kilde: ICAO Annex 10 nasjonale tildelinger + kjente militærblokker.
    private static func isMilitaryHex(_ hex: String) -> Bool {
        guard let value = UInt32(hex, radix: 16) else { return false }
        // USA militær: ADF7C8–AFFFFF (grov), UK RAF: 43C000–43CFFF,
        // NATO: 3B7000-blokker m.fl. Grove intervaller — treffer bredt.
        let ranges: [(UInt32, UInt32)] = [
            (0xADF7C8, 0xAFFFFF), // US military
            (0x43C000, 0x43CFFF), // UK military
            (0x3B7000, 0x3BFFFF), // NATO/DE military (utvalg)
            (0x3F4000, 0x3FBFFF), // DE Luftwaffe (utvalg)
            (0x33FF00, 0x33FFFF), // IT military (utvalg)
        ]
        return ranges.contains { value >= $0.0 && value <= $0.1 }
    }
}
