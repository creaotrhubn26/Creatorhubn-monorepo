// LeadgridSalesTeamStore.swift
//
// Team-håndtering (2026-07-02): salgssjef kan opprette flere team,
// gi hvert team et navn og en farge, og fordele selgere/promotører
// mellom dem. Team-fargen dominerer visuelt på kartet (avatar-ring)
// slik at man raskt ser hvilket team hver person hører til.
//
// Lagring: `UserDefaults` som JSON for nå. Byttes til backend
// (`GET/POST /leadgrid/sales-teams`) i backend-pakke.

import SwiftUI

// MARK: - Modell

/// Ett team i salgs-org. Farge lagres som hex-streng så vi kan serialisere
/// til `Codable`.
struct LeadgridSalesTeam: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    /// Hex-streng inkludert #, f.eks. `"#a852fc"`.
    var colorHex: String
    /// Bruker-ID for teamleder (kan være nil for lederløse team i seed).
    var leaderId: String?
    /// User-IDs for medlemmer.
    var memberIds: [String]
    /// Allokert område (2026-07-02): sirkulær sone på kartet som viser
    /// hvor teamet er tildelt å jobbe. Nil = ingen spesifikk allokering.
    var areaCenterLat: Double?
    var areaCenterLng: Double?
    var areaRadiusKm: Double?

    var color: Color { Color(teamHex: colorHex) ?? .purple }

    /// Har teamet et allokert område?
    var hasArea: Bool {
        areaCenterLat != nil && areaCenterLng != nil && areaRadiusKm != nil
    }

    /// «Initialer» for team-badge — første 2 bokstaver i team-navnet, i caps.
    var initials: String {
        let words = name.split(separator: " ").prefix(2)
        let letters = words.compactMap { $0.first }.map(String.init).joined()
        return letters.isEmpty
            ? String(name.prefix(2)).uppercased()
            : letters.uppercased()
    }
}

// MARK: - Farge-palett

/// Team-farge-palett (2026-07-02): 8 mest brukbare, distinkte farger
/// som holder godt på mørk bakgrunn. Salgssjef kan enten velge fra
/// paletten eller angi egen hex.
enum TeamColorPalette {
    static let all: [(name: String, hex: String)] = [
        ("Amethyst",  "#a852fc"),
        ("Aurora",    "#33d999"),
        ("Sunset",    "#ff8c26"),
        ("Rose",      "#ff5a8f"),
        ("Sky",       "#5a99fa"),
        ("Amber",     "#f5c542"),
        ("Teal",      "#26d4c8"),
        ("Coral",     "#ff6b6b"),
    ]
}

// MARK: - Store

/// Lokal `UserDefaults`-backet team-store. Publiserer endringer via
/// `@Observable` (iOS 17+). Singleton så samme instans deles mellom
/// alle faner.
@Observable
@MainActor
final class LeadgridSalesTeamStore {
    static let shared = LeadgridSalesTeamStore()

    private let storageKey = "leadgrid.sales_teams.v1"

    /// Alle team, sortert alfabetisk etter navn.
    private(set) var teams: [LeadgridSalesTeam] = []

    private init() {
        load()
        if teams.isEmpty {
            // Seed to eksempel-team ved første åpning så bruker ser
            // hvordan systemet fungerer. Salgssjef kan slette/redigere.
            teams = [
                LeadgridSalesTeam(
                    id: "team-a",
                    name: "Team Oslo",
                    colorHex: "#a852fc",
                    leaderId: "u-sofie",
                    memberIds: ["u-anne", "u-lars"],
                    areaCenterLat: 59.920,
                    areaCenterLng: 10.760,
                    areaRadiusKm: 3.5
                ),
                LeadgridSalesTeam(
                    id: "team-b",
                    name: "Team Vestkant",
                    colorHex: "#ff8c26",
                    leaderId: "u-sofie",
                    memberIds: ["u-marit", "u-espen"],
                    areaCenterLat: 59.930,
                    areaCenterLng: 10.700,
                    areaRadiusKm: 4.0
                ),
            ]
            save()
        }
    }

    func upsert(_ team: LeadgridSalesTeam) {
        if let idx = teams.firstIndex(where: { $0.id == team.id }) {
            teams[idx] = team
        } else {
            teams.append(team)
        }
        teams.sort { $0.name.lowercased() < $1.name.lowercased() }
        save()
    }

    func delete(id: String) {
        teams.removeAll { $0.id == id }
        save()
    }

    /// Finn team for en gitt bruker-ID. Returnerer første treff (én bruker
    /// kan i praksis være medlem av flere team, men UI antar én primær).
    func team(for userId: String) -> LeadgridSalesTeam? {
        teams.first { $0.memberIds.contains(userId) || $0.leaderId == userId }
    }

    // MARK: - Persistence

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([LeadgridSalesTeam].self, from: data)
        else { return }
        teams = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(teams) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}

// MARK: - Color helpers

extension Color {
    /// Init fra hex-streng med eller uten `#`. Nil hvis parsing feiler.
    /// Prefixet «teamHex» for å ikke krasje med annet Color(hex:)-init i codebasen.
    init?(teamHex: String) {
        var s = teamHex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let value = UInt32(s, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self = Color(red: r, green: g, blue: b)
    }
}
