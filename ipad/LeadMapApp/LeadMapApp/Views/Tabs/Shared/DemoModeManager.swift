// DemoModeManager.swift — toggle som bytter app fra prod-data til mock-data (Pakke 10).
//
// Brukstilfelle: la utvikleren se hvordan hele appen oppfører seg når orgen
// har «mange leads + momentum + forecast», UTEN å påvirke ekte org-data.
// Persistert via UserDefaults så toggle holdes mellom app-launches.
//
// Bruk:
//   - `DemoModeManager.shared.isActive` (read/write)
//   - `DemoModeManager.shared.mockLeads` (50 leads spredt i Oslo-området)
//   - `MockDataBanner` view (legg som overlay på toppen av MainTabView)
//   - `DemoModeToggleRow` (legg i MyProfileSheet eller Innstillinger)

import SwiftUI

@MainActor
@Observable
final class DemoModeManager {
    static let shared = DemoModeManager()

    /// UserDefaults-nøkkel — nonisolated så isActiveNonisolated kan lese.
    nonisolated static let key = "ipad.demo_mode"

    /// Demo-modus aktiv? Persisterer i UserDefaults.
    var isActive: Bool {
        didSet { UserDefaults.standard.set(isActive, forKey: Self.key) }
    }

    /// Nonisolated read av toggle for enum-mock-data-getters som ikke kan
    /// være @MainActor (Pakke 10.1). Leser rett fra UserDefaults —
    /// thread-safe. Skriving går fortsatt via @MainActor-instance.
    nonisolated static var isActiveNonisolated: Bool {
        UserDefaults.standard.bool(forKey: key)
    }

    private init() {
        self.isActive = UserDefaults.standard.bool(forKey: Self.key)
        self.mockLeads = Self.generateMockLeads()
    }

    /// ~50 leads spredt i Oslo-området med varierende status, score og
    /// estimatedValue så KPI-tiles fylles opp. Stored (ikke lazy) fordi
    /// @Observable macros ikke støtter lazy properties.
    private(set) var mockLeads: [LeadModel]

    // MARK: - Mock-data generator

    private static func generateMockLeads() -> [LeadModel] {
        // Centroid Oslo + radius ~25 km så leads spres realistisk.
        let centerLat = 59.913
        let centerLon = 10.738
        let radius = 0.22  // grader, ~25 km

        struct Seed {
            let name: String
            let score: Int
            let value: Double
            let status: LeadStatus
            let followUpHours: Int?  // nil = ingen oppfølging
            let phone: String?
            let email: String?
        }

        let seeds: [Seed] = [
            Seed(name: "Nordic Elektro AS",      score: 92, value: 350_000, status: .meetingBooked, followUpHours: 0,  phone: "+47 22 12 34 56", email: "post@nordicelektro.no"),
            Seed(name: "Byggmester Hansen AS",   score: 78, value: 220_000, status: .return,        followUpHours: 1,  phone: "+47 22 23 45 67", email: nil),
            Seed(name: "Energi & Miljø AS",      score: 78, value: 180_000, status: .interested,    followUpHours: 1,  phone: nil,               email: "kontakt@energimiljo.no"),
            Seed(name: "Oslo Tech AS",           score: 65, value: 160_000, status: .return,        followUpHours: 24, phone: "+47 22 33 44 55", email: nil),
            Seed(name: "Veggbilder AS",          score: 87, value: 200_000, status: .interested,    followUpHours: 2,  phone: nil,               email: nil),
            Seed(name: "Vesuvio Pizzeria",       score: 81, value:  75_000, status: .visited,       followUpHours: 3,  phone: "+47 22 44 55 66", email: "hei@vesuvio.no"),
            Seed(name: "Holy Crust AS",          score: 90, value: 240_000, status: .meetingBooked, followUpHours: 4,  phone: nil,               email: nil),
            Seed(name: "MedSide Helse",          score: 62, value:  90_000, status: .unvisited,     followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Talkit AS",              score: 73, value: 150_000, status: .unvisited,     followUpHours: nil,phone: "+47 22 55 66 77", email: nil),
            Seed(name: "Aker Brygge Legesenter", score: 85, value: 180_000, status: .interested,    followUpHours: 5,  phone: nil,               email: "post@akerlege.no"),
            Seed(name: "Dr.Dropin Storo",        score: 71, value: 120_000, status: .meetingBooked, followUpHours: 6,  phone: nil,               email: nil),
            Seed(name: "Frogner Tannlege",       score: 88, value: 210_000, status: .proposalSent,  followUpHours: 8,  phone: "+47 22 66 77 88", email: nil),
            Seed(name: "Majorstuen Optikk",      score: 55, value:  85_000, status: .visited,       followUpHours: 12, phone: nil,               email: nil),
            Seed(name: "Bjørvika Innovation",    score: 94, value: 480_000, status: .interested,    followUpHours: 2,  phone: nil,               email: "ceo@bjoinno.no"),
            Seed(name: "Sentrum Eiendom AS",     score: 76, value: 320_000, status: .meetingBooked, followUpHours: 16, phone: nil,               email: nil),
            Seed(name: "Grünerløkka Café",       score: 48, value:  45_000, status: .declined,      followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Sandvika Service AS",    score: 82, value: 280_000, status: .won,           followUpHours: nil,phone: "+47 22 77 88 99", email: nil),
            Seed(name: "Lørenskog Bil",          score: 67, value: 195_000, status: .return,        followUpHours: 18, phone: nil,               email: nil),
            Seed(name: "Lysaker Logistikk",      score: 79, value: 250_000, status: .interested,    followUpHours: 10, phone: nil,               email: nil),
            Seed(name: "Bærum Bygg AS",          score: 91, value: 410_000, status: .meetingBooked, followUpHours: 7,  phone: nil,               email: nil),
            Seed(name: "Asker Snekker",          score: 58, value:  98_000, status: .visited,       followUpHours: 22, phone: nil,               email: nil),
            Seed(name: "Lillestrøm IT",          score: 84, value: 230_000, status: .proposalSent,  followUpHours: 14, phone: "+47 22 88 99 00", email: nil),
            Seed(name: "Drammen Distribusjon",   score: 70, value: 175_000, status: .interested,    followUpHours: 30, phone: nil,               email: nil),
            Seed(name: "Skedsmo Stål AS",        score: 86, value: 290_000, status: .meetingBooked, followUpHours: 9,  phone: nil,               email: nil),
            Seed(name: "Nordstrand Frisør",      score: 42, value:  35_000, status: .lost,          followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Holmenkollen Hotell",    score: 89, value: 380_000, status: .won,           followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Vinderen VVS",           score: 64, value: 115_000, status: .unvisited,     followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Bislett Sport",          score: 77, value: 165_000, status: .interested,    followUpHours: 20, phone: nil,               email: nil),
            Seed(name: "Tøyen Tekstil",          score: 53, value:  72_000, status: .visited,       followUpHours: 28, phone: nil,               email: nil),
            Seed(name: "Stovner Auto",           score: 69, value: 142_000, status: .return,        followUpHours: 36, phone: nil,               email: nil),
            Seed(name: "Bryn Logistikk",         score: 83, value: 220_000, status: .meetingBooked, followUpHours: 11, phone: nil,               email: nil),
            Seed(name: "Skøyen Software AS",     score: 95, value: 540_000, status: .interested,    followUpHours: 3,  phone: nil,               email: "founder@skoyen.io"),
            Seed(name: "Kolbotn Klinikk",        score: 60, value: 105_000, status: .visited,       followUpHours: 40, phone: nil,               email: nil),
            Seed(name: "Slependen Snickerier",   score: 50, value:  62_000, status: .declined,      followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Ås Apotek",              score: 72, value: 140_000, status: .unvisited,     followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Ski Servicetorg",        score: 65, value: 110_000, status: .return,        followUpHours: 44, phone: nil,               email: nil),
            Seed(name: "Hvalstad Helsetjenester",score: 80, value: 195_000, status: .interested,    followUpHours: 13, phone: nil,               email: nil),
            Seed(name: "Strømmen Stål",          score: 75, value: 175_000, status: .proposalSent,  followUpHours: 19, phone: nil,               email: nil),
            Seed(name: "Vøyenenga Verksted",     score: 56, value:  88_000, status: .visited,       followUpHours: 26, phone: nil,               email: nil),
            Seed(name: "Sætre Snekker",          score: 47, value:  55_000, status: .lost,          followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Rud Reklame",            score: 68, value: 130_000, status: .interested,    followUpHours: 17, phone: nil,               email: nil),
            Seed(name: "Hosle Helse AS",         score: 87, value: 310_000, status: .meetingBooked, followUpHours: 6,  phone: nil,               email: nil),
            Seed(name: "Eiksmarka Eiendom",      score: 81, value: 260_000, status: .interested,    followUpHours: 15, phone: nil,               email: nil),
            Seed(name: "Jar Juicebar",           score: 44, value:  38_000, status: .declined,      followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Stabekk Tannlege",       score: 78, value: 185_000, status: .won,           followUpHours: nil,phone: nil,               email: nil),
            Seed(name: "Høvik Hudpleie",         score: 66, value: 125_000, status: .interested,    followUpHours: 21, phone: nil,               email: nil),
            Seed(name: "Lambertseter Lakk",      score: 73, value: 158_000, status: .return,        followUpHours: 32, phone: nil,               email: nil),
            Seed(name: "Manglerud Møbler",       score: 62, value: 102_000, status: .visited,       followUpHours: 38, phone: nil,               email: nil),
            Seed(name: "Ulvøya Utleie",          score: 85, value: 270_000, status: .interested,    followUpHours: 8,  phone: nil,               email: nil),
            Seed(name: "Steinerud Sport AS",     score: 90, value: 360_000, status: .meetingBooked, followUpHours: 5,  phone: nil,               email: nil),
            Seed(name: "Smestad Software",       score: 93, value: 460_000, status: .proposalSent,  followUpHours: 4,  phone: nil,               email: nil)
        ]

        let now = Date()
        let cal = Calendar.current

        return seeds.enumerated().map { idx, seed in
            // Spred over Oslo med pseudo-randomisering (deterministisk per idx)
            let angle = Double(idx) * 0.41 + 0.7  // golden-angle-ish spreading
            let dist = sqrt(Double(idx).truncatingRemainder(dividingBy: 50.0) / 50.0) * radius
            let lat = centerLat + dist * sin(angle)
            let lon = centerLon + dist * cos(angle) * 1.6  // longitude komp. for breddegrad

            let followUp: Date? = seed.followUpHours.map {
                now.addingTimeInterval(TimeInterval($0) * 3600)
            }
            let createdAt = cal.date(byAdding: .day, value: -(idx % 60), to: now) ?? now

            return LeadModel(
                id: "demo-lead-\(idx)",
                name: seed.name,
                company: nil,
                category: nil,
                status: seed.status,
                address: nil,
                postalCode: nil,
                city: "Oslo",
                country: "Norge",
                latitude: lat,
                longitude: lon,
                phone: seed.phone,
                email: seed.email,
                websiteUrl: nil,
                instagramUrl: nil,
                linkedinUrl: nil,
                googleRating: nil,
                googlePlaceId: nil,
                logoUrl: nil,
                aiOpportunityScore: seed.score,
                estimatedValue: seed.value,
                leadSource: "demo",
                assignedUserId: nil,
                assignedUserName: nil,
                assignedUserEmail: nil,
                projectId: nil,
                lastVisitAt: nil,
                nextFollowUpAt: followUp,
                nextAction: nil,
                tags: nil,
                notes: nil,
                createdAt: createdAt,
                updatedAt: now,
                leadTemperature: nil,
                pipelineStage: nil,
                leadScore: seed.score,
                industryId: nil
            )
        }
    }
}

// MARK: - MockDataBanner

/// Tynn oransje stripe på toppen av app-en når demo-modus er på.
struct MockDataBanner: View {
    @Bindable var manager = DemoModeManager.shared

    var body: some View {
        if manager.isActive {
            HStack(spacing: 8) {
                Image(systemName: "theatermasks.fill")
                    .font(.appScaled(size: 11, weight: .bold))
                Text("DEMO-MODUS")
                    .font(.appScaled(size: 11, weight: .black))
                    .tracking(0.8)
                Text("·")
                    .opacity(0.7)
                Text("Bruker mock-data, ikke ekte org")
                    .font(.appScaled(size: 11, weight: .medium))
                Spacer()
                Button("Slå av") { manager.isActive = false }
                    .font(.appScaled(size: 11, weight: .bold))
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Color.white.opacity(0.18), in: Capsule())
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14).padding(.vertical, 7)
            .background(
                LinearGradient(
                    colors: [
                        Color(red: 0.98, green: 0.55, blue: 0.10),
                        Color(red: 0.95, green: 0.30, blue: 0.40)
                    ],
                    startPoint: .leading, endPoint: .trailing
                )
            )
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

// MARK: - DemoModeToggleRow

/// Bruk i MyProfileSheet eller Innstillinger-flate.
struct DemoModeToggleRow: View {
    @Bindable var manager = DemoModeManager.shared

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9)
                    .fill(Color.orange.opacity(0.22))
                Image(systemName: "theatermasks.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(.orange)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text("Demo-modus")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Erstatter ekte data med 50 mock-leads spredt i Oslo. KPI-tiles + kart fylles opp så du kan se UI-et som med en full org.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(.white.opacity(0.65))
                    .lineLimit(3)
            }
            Spacer(minLength: 8)
            Toggle("", isOn: Bindable(manager).isActive)
                .labelsHidden()
                .tint(.orange)
        }
        .padding(12)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }
}
