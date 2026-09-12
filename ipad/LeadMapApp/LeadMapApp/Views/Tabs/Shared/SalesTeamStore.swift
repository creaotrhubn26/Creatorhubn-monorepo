// LeadgridSalesTeamStore.swift
//
// Team-håndtering (2026-07-02): salgssjef kan opprette flere team,
// gi hvert team et navn og en farge, og fordele selgere/promotører
// mellom dem. Team-fargen dominerer visuelt på kartet (avatar-ring)
// slik at man raskt ser hvilket team hver person hører til.
//
// Lagring: backend er fasit (`GET/PUT/DELETE /api/leadgrid/sales-teams`,
// mig 0361) med `UserDefaults` som offline-cache. Sync-strategi:
//   • attach(api:) fra første view med APIClient → syncFromBackend()
//   • backend har team   → adopter som sannhet (overskriver cache)
//   • backend er tom     → push lokale team opp (første enhet vinner)
//   • backend utilgjengelig → behold cache (offline-modus)
//   • upsert/delete      → optimistisk lokalt + push (fire-and-forget)

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
    /// Kommune-basert område (2026-07-05, mig 0369): offisiell norsk
    /// kommune fra Kartverket. Når satt tegnes den ekte kommunegrensen
    /// på Team-kartet i stedet for sirkelsonen.
    var areaKommunenummer: String?
    var areaKommuneNavn: String?

    var color: Color { Color(teamHex: colorHex) ?? .purple }

    /// Har teamet et allokert område (sirkel eller kommune)?
    var hasArea: Bool {
        hasKommune
            || (areaCenterLat != nil && areaCenterLng != nil && areaRadiusKm != nil)
    }

    /// Har teamet en tildelt kommune?
    var hasKommune: Bool { areaKommunenummer != nil }

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

    /// APIClient injisert lazily (samme mønster som RouteTracker). Weak
    /// siden APIClient eies av AppState.
    private weak var api: APIClient?
    private var didInitialSync = false

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

    // MARK: - Backend-sync

    /// Kalles av første view som har APIClient tilgjengelig (idempotent).
    /// Trigger initial sync mot backend første gang.
    func attach(api: APIClient) {
        self.api = api
        guard !didInitialSync else { return }
        didInitialSync = true
        Task { await syncFromBackend() }
    }

    /// Hent team fra backend. Backend er fasit når den svarer; tom backend
    /// får lokale team pushet opp (seed/offline-arbeid overlever).
    func syncFromBackend() async {
        guard let api else { return }
        do {
            let remote = try await api.fetchSalesTeams()
            if remote.isEmpty {
                // Første enhet i org-en — push lokale team (inkl. seed) opp
                // så alle enheter deler samme utgangspunkt.
                for team in teams {
                    try? await api.upsertSalesTeam(team)
                }
            } else {
                teams = remote.sorted { $0.name.lowercased() < $1.name.lowercased() }
                save()
            }
        } catch {
            // Offline eller backend nede — behold cache. Neste attach/sync
            // prøver igjen.
            print("[SalesTeamStore] syncFromBackend feilet: \(error)")
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
        // Fire-and-forget push — backend upserter på (org, id) så rekkefølge
        // er ufarlig; feil fanges av neste syncFromBackend().
        if let api {
            Task { try? await api.upsertSalesTeam(team) }
        }
    }

    func delete(id: String) {
        teams.removeAll { $0.id == id }
        save()
        if let api {
            Task { try? await api.deleteSalesTeam(id: id) }
        }
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
