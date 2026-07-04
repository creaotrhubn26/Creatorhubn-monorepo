// TeamOnMap.swift
//
// Team-synlighet på kartet (2026-07-02): live-avatarer for selgere,
// promotører og teamledere med rolle-farge, aktivitets-status og
// destinasjons-linje. Deltas gjennom en toggle i lag-picker
// (`MapOverlay.teamMembers`).
//
// - `TeamMemberOnMap` — modellen som brukes i Map { }
// - `TeamMapPin` — avatar-pin med rolle-ring + pulserende status-dot
// - `TeamMemberInfoCard` — mini-info-kort ved tap
// - `TeamOnMapMock` — mock-data for demo-modus

import SwiftUI
import CoreLocation

// MARK: - Modell

/// Team-medlem med live-posisjon + aktivitet + valgfri destinasjon.
/// Populeres fra `GET /leadgrid/team-live-locations` (kommer) eller mock
/// data i demo-modus. Bruker `AssignableTeamMember.role` for konsistent
/// rolle-fargekoding på tvers av app-en.
struct TeamMemberOnMap: Identifiable, Hashable {
    let userId: String
    let name: String
    let role: TeamRole
    let avatarInitials: String
    let coordinate: CLLocationCoordinate2D
    let activity: TeamMemberActivity
    /// Valgfri destinasjon — hvis satt tegner vi stiplet linje.
    let destinationCoordinate: CLLocationCoordinate2D?
    let destinationLeadName: String?
    /// Sist oppdatert — brukes til «å jour»-status i info-kortet.
    let lastSeen: Date

    var id: String { userId }

    // CLLocationCoordinate2D er ikke Hashable — implementer manuelt.
    func hash(into hasher: inout Hasher) {
        hasher.combine(userId)
    }
    static func == (lhs: TeamMemberOnMap, rhs: TeamMemberOnMap) -> Bool {
        lhs.userId == rhs.userId && lhs.lastSeen == rhs.lastSeen
    }
}

/// Nåværende aktivitet — bestemmer status-dot-farge og info-tekst.
enum TeamMemberActivity: String, Hashable {
    case idle          // Ledig, ingen aktiv jobb
    case driving       // Kjører til lead
    case meeting       // I møte / hos kunde
    case onBreak       // Pause / lunsj
    case offline       // Ute av tjeneste

    var label: String {
        switch self {
        case .idle:    return "Ledig"
        case .driving: return "Kjører"
        case .meeting: return "I møte"
        case .onBreak: return "Pause"
        case .offline: return "Offline"
        }
    }

    var color: Color {
        switch self {
        case .idle:    return Color(red: 0.20, green: 0.85, blue: 0.60) // grønn
        case .driving: return Color(red: 0.34, green: 0.60, blue: 0.98) // blå
        case .meeting: return Color(red: 1.00, green: 0.55, blue: 0.15) // oransje
        case .onBreak: return Color(red: 0.95, green: 0.85, blue: 0.25) // gul
        case .offline: return Color.gray
        }
    }

    var icon: String {
        switch self {
        case .idle:    return "checkmark.circle.fill"
        case .driving: return "car.fill"
        case .meeting: return "briefcase.fill"
        case .onBreak: return "cup.and.saucer.fill"
        case .offline: return "moon.circle.fill"
        }
    }

    /// Pulserer status-dot? Bare for aktivt kjørende (så bruker ser bevegelse).
    var pulses: Bool {
        self == .driving
    }
}

// MARK: - Pin view

/// Avatar-pin for et team-medlem på kartet.
/// - Ring = **team-farge** (om medlem er i et team) — så du raskt ser
///   hvilket team hver person tilhører. Fall-back til rolle-farge.
/// - Status-dot i nederste hjørne (aktivitet).
///
/// Pulserer under kjøring (subtile scale-anim) så du ser hvem som er på vei.
struct TeamMapPin: View {
    let member: TeamMemberOnMap
    /// Team-farge (om medlem er tilknyttet et team). Nil = bruk rolle-farge.
    let teamColor: Color?

    init(member: TeamMemberOnMap, teamColor: Color? = nil) {
        self.member = member
        self.teamColor = teamColor
    }

    @State private var pulsePhase: CGFloat = 0

    private var ringColor: Color {
        teamColor ?? member.role.color
    }

    /// Kompakt på iPhone (2026-07-04): mini-kartet i Oversikt er lite —
    /// full 36pt-avatar overlappet cluster-nåler. ~60% skala på phone.
    private var isCompact: Bool { DeviceIdiom.isPhone }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Ring + avatar
            ZStack {
                // Team-farget aura når medlem er «aktiv»
                if member.activity == .driving {
                    Circle()
                        .stroke(ringColor.opacity(0.5), lineWidth: isCompact ? 2 : 3)
                        .frame(width: isCompact ? 29 : 46, height: isCompact ? 29 : 46)
                        .scaleEffect(1.0 + pulsePhase * 0.15)
                        .opacity(1.0 - pulsePhase)
                }
                Circle().fill(ringColor.opacity(0.28))
                Circle().strokeBorder(ringColor, lineWidth: isCompact ? 1.5 : 2.5)
                Text(member.avatarInitials)
                    .font(.system(size: isCompact ? 8 : 13, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: isCompact ? 22 : 36, height: isCompact ? 22 : 36)
            .shadow(color: .black.opacity(0.35), radius: isCompact ? 3 : 5, y: isCompact ? 1 : 2)
            // Status-dot nederst-høyre
            statusDot
        }
        .onAppear {
            if member.activity.pulses {
                withAnimation(
                    .easeInOut(duration: 1.4).repeatForever(autoreverses: false)
                ) {
                    pulsePhase = 1
                }
            }
        }
    }

    private var statusDot: some View {
        ZStack {
            Circle().fill(TeamOnMapBrand.card)
                .frame(width: isCompact ? 9 : 14, height: isCompact ? 9 : 14)
            Circle().fill(member.activity.color)
                .frame(width: isCompact ? 6.5 : 10, height: isCompact ? 6.5 : 10)
            if member.activity == .driving, !isCompact {
                // Ikon i pulserer-dot — tydelig visuell markør
                Image(systemName: "car.fill")
                    .font(.system(size: 5, weight: .heavy))
                    .foregroundStyle(.white)
            }
        }
        .offset(x: isCompact ? 2 : 3, y: isCompact ? 2 : 3)
    }
}

// MARK: - Info-kort

/// Mini-info-kort som vises ved tap på team-avatar. Rolle-fargekodet
/// med aktivitets-badge, destinasjon (om noen), sist-sett + rask-CTAer:
/// Ring, Meld, Tildel lead. Klikk «Åpne profil» for full team-medlem-view.
struct TeamMemberInfoCard: View {
    let member: TeamMemberOnMap
    let distanceFromMe: Double?  // km fra bruker
    let onClose: () -> Void
    let onOpenProfile: (TeamMemberOnMap) -> Void
    let onSendLead: (TeamMemberOnMap) -> Void
    let onPing: (TeamMemberOnMap) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            Divider().background(TeamOnMapBrand.stroke)
            statusRow
            actionsRow
        }
        .padding(14)
        .frame(maxWidth: 380)
        .background(TeamOnMapBrand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(member.role.color.opacity(0.35), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.35), radius: 18, y: 6)
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(member.role.color.opacity(0.28))
                Circle().strokeBorder(member.role.color, lineWidth: 2)
                Text(member.avatarInitials)
                    .font(.system(size: 14, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 3) {
                Text(member.name)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 5) {
                    Image(systemName: member.role.icon)
                        .font(.system(size: 9, weight: .bold))
                    Text(member.role.label)
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                }
                .foregroundStyle(member.role.color)
                .padding(.horizontal, 8).padding(.vertical, 2)
                .background(member.role.color.opacity(0.15), in: Capsule())
                .overlay(Capsule().strokeBorder(member.role.color.opacity(0.35), lineWidth: 0.5))
            }
            Spacer()
            Button {
                onClose()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(TeamOnMapBrand.textDim)
            }
            .buttonStyle(.plain)
        }
    }

    private var statusRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Aktivitet
            HStack(spacing: 6) {
                Image(systemName: member.activity.icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(member.activity.color)
                Text(member.activity.label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                if let d = distanceFromMe {
                    Image(systemName: "location.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(TeamOnMapBrand.textDim)
                    Text(d < 1
                         ? "\(Int(d * 1000)) m unna"
                         : String(format: "%.1f km unna", d))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(TeamOnMapBrand.textDim)
                }
            }
            // Destinasjon (om satt)
            if let destName = member.destinationLeadName {
                HStack(spacing: 6) {
                    Image(systemName: "target")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(member.role.color)
                    Text("På vei til")
                        .font(.system(size: 11))
                        .foregroundStyle(TeamOnMapBrand.textDim)
                    Text(destName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
            }
            // Sist sett
            HStack(spacing: 6) {
                Image(systemName: "clock.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(TeamOnMapBrand.textDim)
                Text("Oppdatert \(lastSeenLabel)")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(TeamOnMapBrand.textDim)
            }
        }
    }

    private var actionsRow: some View {
        HStack(spacing: 8) {
            // Send lead — primær-CTA i rolle-farge
            Button {
                onSendLead(member)
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "arrowshape.turn.up.right.fill")
                        .font(.system(size: 10, weight: .bold))
                    Text("Send lead")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(
                    LinearGradient(colors: [member.role.color, member.role.color.opacity(0.7)],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Capsule()
                )
                .shadow(color: member.role.color.opacity(0.4), radius: 5, y: 2)
            }
            .buttonStyle(.plain)
            // Ping
            Button {
                onPing(member)
            } label: {
                Image(systemName: "bell.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(8)
                    .background(TeamOnMapBrand.card, in: Circle())
                    .overlay(Circle().strokeBorder(TeamOnMapBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .help("Send push-varsel til \(member.name)")

            Spacer(minLength: 0)

            // Åpne profil
            Button {
                onOpenProfile(member)
            } label: {
                HStack(spacing: 5) {
                    Text("Profil")
                        .font(.system(size: 12, weight: .bold))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(TeamOnMapBrand.card, in: Capsule())
                .overlay(Capsule().strokeBorder(TeamOnMapBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private var lastSeenLabel: String {
        let s = Int(Date().timeIntervalSince(member.lastSeen))
        if s < 60 { return "nå nettopp" }
        if s < 3600 { return "for \(s / 60) min siden" }
        return "for \(s / 3600) t siden"
    }
}

// MARK: - Mock data

enum TeamOnMapMock {
    /// Genererer 5 mock-teammedlemmer spredt rundt Oslo — samme roller
    /// som `AssignToTeamMemberSheet` bruker.
    static func members() -> [TeamMemberOnMap] {
        let now = Date()
        return [
            TeamMemberOnMap(
                userId: "u-anne",
                name: "Anne Berg",
                role: .seller,
                avatarInitials: "AB",
                coordinate: .init(latitude: 59.925, longitude: 10.750),
                activity: .driving,
                destinationCoordinate: .init(latitude: 59.940, longitude: 10.780),
                destinationLeadName: "Nordic Elektro AS",
                lastSeen: now.addingTimeInterval(-45)
            ),
            TeamMemberOnMap(
                userId: "u-lars",
                name: "Lars Kristiansen",
                role: .seller,
                avatarInitials: "LK",
                coordinate: .init(latitude: 59.910, longitude: 10.780),
                activity: .meeting,
                destinationCoordinate: nil,
                destinationLeadName: nil,
                lastSeen: now.addingTimeInterval(-320)
            ),
            TeamMemberOnMap(
                userId: "u-marit",
                name: "Marit Olsen",
                role: .promoter,
                avatarInitials: "MO",
                coordinate: .init(latitude: 59.945, longitude: 10.735),
                activity: .idle,
                destinationCoordinate: nil,
                destinationLeadName: nil,
                lastSeen: now.addingTimeInterval(-95)
            ),
            TeamMemberOnMap(
                userId: "u-espen",
                name: "Espen Haug",
                role: .promoter,
                avatarInitials: "EH",
                coordinate: .init(latitude: 59.905, longitude: 10.762),
                activity: .driving,
                destinationCoordinate: .init(latitude: 59.895, longitude: 10.755),
                destinationLeadName: "Holy Crust AS",
                lastSeen: now.addingTimeInterval(-12)
            ),
            TeamMemberOnMap(
                userId: "u-sofie",
                name: "Sofie Dahl",
                role: .manager,
                avatarInitials: "SD",
                coordinate: .init(latitude: 59.920, longitude: 10.770),
                activity: .onBreak,
                destinationCoordinate: nil,
                destinationLeadName: nil,
                lastSeen: now.addingTimeInterval(-1800)
            ),
        ]
    }
}

// MARK: - Brand-farger

private enum TeamOnMapBrand {
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let stroke = Color.white.opacity(0.10)
    static let textDim = Color.white.opacity(0.55)
}
