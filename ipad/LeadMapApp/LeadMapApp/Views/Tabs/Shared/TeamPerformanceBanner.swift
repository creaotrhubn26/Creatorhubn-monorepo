// TeamPerformanceBanner.swift
//
// Svevende prestasjonsbanner (2026-07-02) som viser team-navn +
// dynamisk momentum-indikator i sentrum av team-området på kartet.
//
// Prestasjonen er visualisert TRE-DIMENSJONALT:
//   1. Farge — team-farge alltid, men mettet/dempet basert på nivå
//   2. Glow/aura — radius skalerer med prestasjon (0pt → 30pt)
//   3. Bevegelse — «on fire»-team pulser + subtile shake for oppmerksomhet
//
// Ingen emoji — kun SF Symbols med tydelig ikonografi.

import SwiftUI

// MARK: - Prestasjons-modell

/// Prestasjons-nivå. Bestemmer farge-metning, glow-radius, animasjon.
enum TeamPerformanceLevel {
    case onFire      // > 150% av mål — pulserende + shake + max glow
    case excellent   // 100–150% — pulserende + medium glow
    case onTrack     // 80–100% — subtile pulse
    case behind      // 50–80% — dempet farge
    case struggling  // < 50% — grå + lav opacity

    /// Auto-utleding fra tall (wonThisWeek vs weeklyTarget).
    static func from(won: Int, target: Int) -> TeamPerformanceLevel {
        guard target > 0 else { return .onTrack }
        let ratio = Double(won) / Double(target)
        switch ratio {
        case 1.5...:      return .onFire
        case 1.0..<1.5:   return .excellent
        case 0.8..<1.0:   return .onTrack
        case 0.5..<0.8:   return .behind
        default:          return .struggling
        }
    }

    var label: String {
        switch self {
        case .onFire:     return "ON FIRE"
        case .excellent:  return "EXCELLENT"
        case .onTrack:    return "PÅ MÅL"
        case .behind:     return "BAK MÅLET"
        case .struggling: return "SLITER"
        }
    }

    var icon: String {
        switch self {
        case .onFire:     return "flame.fill"
        case .excellent:  return "bolt.fill"
        case .onTrack:    return "checkmark.seal.fill"
        case .behind:     return "arrow.down.right"
        case .struggling: return "exclamationmark.triangle.fill"
        }
    }

    /// Aksentfarge — brukt til badge-fill, glow og trend-pil.
    var accentColor: Color {
        switch self {
        case .onFire:     return Color(red: 1.00, green: 0.35, blue: 0.20) // rød-oransje
        case .excellent:  return Color(red: 1.00, green: 0.75, blue: 0.20) // gul-oransje
        case .onTrack:    return Color(red: 0.20, green: 0.85, blue: 0.60) // grønn
        case .behind:     return Color(red: 1.00, green: 0.65, blue: 0.20) // oransje
        case .struggling: return Color(red: 0.55, green: 0.60, blue: 0.68) // grå
        }
    }

    /// Aura-radius i pt for shadow-glow effekten.
    var glowRadius: CGFloat {
        switch self {
        case .onFire:     return 24
        case .excellent:  return 16
        case .onTrack:    return 8
        case .behind:     return 0
        case .struggling: return 0
        }
    }

    /// Pulser aura + skalerer banner?
    var pulses: Bool {
        self == .onFire || self == .excellent
    }

    /// Shake banner (kun for on fire — «trembling with heat»).
    var shakes: Bool {
        self == .onFire
    }

    /// Farge-metning på team-fargen (dempes for lav prestasjon).
    var saturation: Double {
        switch self {
        case .onFire, .excellent: return 1.0
        case .onTrack:            return 1.0
        case .behind:             return 0.7
        case .struggling:         return 0.4
        }
    }
}

/// Prestasjons-data per team. Populeres fra backend
/// (`GET /leadgrid/team-performance` — kommer) eller mock.
struct TeamPerformance: Hashable {
    let wonThisWeek: Int
    let weeklyTarget: Int
    let trendPercent: Int  // sammenlignet med forrige uke
    let rankInOrg: Int?    // 1 = topp

    var level: TeamPerformanceLevel {
        .from(won: wonThisWeek, target: weeklyTarget)
    }
}

// MARK: - Banner-komponent

/// Svevende prestasjonsbanner som vises i sentrum av team-området.
struct TeamPerformanceBanner: View {
    let team: LeadgridSalesTeam
    let performance: TeamPerformance

    @State private var pulsePhase: CGFloat = 0
    @State private var shakeOffset: CGFloat = 0

    var body: some View {
        if DeviceIdiom.isPhone {
            compactBody
        } else {
            fullBody
        }
    }

    /// Kompakt phone-variant (2026-07-04): mini-kartet på iPhone er for
    /// lite til full banner-stack — badges/trofeer/glow overlappet
    /// cluster-nålene til uleselighet. Viser KUN team-navn i en liten
    /// pill i team-farge + en status-dot i prestasjons-fargen. Ingen
    /// pulse/shake/glow. iPad/Mac beholder full variant under.
    private var compactBody: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(performance.level.accentColor)
                .frame(width: 6, height: 6)
            Text(team.name)
                .font(.appScaled(size: 11, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(
            LinearGradient(
                colors: [team.color.opacity(0.95), team.color.opacity(0.75)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: Capsule()
        )
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.20), lineWidth: 0.5))
        .saturation(performance.level.saturation)
        .shadow(color: .black.opacity(0.35), radius: 3, y: 1)
    }

    /// Full variant — iPad/Mac (uendret oppførsel).
    private var fullBody: some View {
        VStack(spacing: 6) {
            // Prestasjons-badge (SF Symbol + label)
            HStack(spacing: 5) {
                Image(systemName: performance.level.icon)
                    .font(.appScaled(size: 10, weight: .heavy))
                Text(performance.level.label)
                    .font(.appScaled(size: 9, weight: .black, design: .rounded))
                    .tracking(1.0)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(performance.level.accentColor, in: Capsule())
            .shadow(color: performance.level.accentColor.opacity(0.6),
                    radius: performance.level.glowRadius,
                    y: 0)

            // Team-navn (stor, i team-farge)
            Text(team.name)
                .font(.appScaled(size: 15, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(
                    LinearGradient(
                        colors: [
                            team.color.opacity(0.95),
                            team.color.opacity(0.65),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    in: RoundedRectangle(cornerRadius: 10)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(Color.white.opacity(0.20), lineWidth: 1)
                )
                .shadow(
                    color: team.color.opacity(performance.level.pulses
                                              ? 0.55 + pulsePhase * 0.3
                                              : 0.4),
                    radius: performance.level.pulses
                        ? 10 + pulsePhase * 8
                        : 6,
                    y: 3
                )
                .saturation(performance.level.saturation)
                .scaleEffect(1.0 + (performance.level.pulses ? pulsePhase * 0.04 : 0))

            // Stats-rad: X av Y + trend
            HStack(spacing: 6) {
                // Won count
                HStack(spacing: 3) {
                    Image(systemName: "trophy.fill")
                        .font(.appScaled(size: 8, weight: .bold))
                    Text("\(performance.wonThisWeek) / \(performance.weeklyTarget)")
                        .font(.appScaled(size: 10, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.black.opacity(0.55), in: Capsule())
                .overlay(Capsule().strokeBorder(team.color.opacity(0.4), lineWidth: 0.5))

                // Trend
                HStack(spacing: 2) {
                    Image(systemName: performance.trendPercent >= 0
                          ? "arrow.up.right"
                          : "arrow.down.right")
                        .font(.appScaled(size: 8, weight: .heavy))
                    Text("\(abs(performance.trendPercent))%")
                        .font(.appScaled(size: 10, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                }
                .foregroundStyle(
                    performance.trendPercent >= 0
                        ? Color(red: 0.20, green: 0.85, blue: 0.60)
                        : Color(red: 0.95, green: 0.30, blue: 0.30)
                )
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.black.opacity(0.55), in: Capsule())
                .overlay(Capsule().strokeBorder(Color.white.opacity(0.1), lineWidth: 0.5))
            }
        }
        .offset(x: shakeOffset)
        .onAppear {
            if performance.level.pulses {
                withAnimation(
                    .easeInOut(duration: 1.4).repeatForever(autoreverses: true)
                ) {
                    pulsePhase = 1
                }
            }
            if performance.level.shakes {
                // Subtile «trembling with heat»-shake — ±1.5pt hver 0.15s
                withAnimation(
                    .easeInOut(duration: 0.15).repeatForever(autoreverses: true)
                ) {
                    shakeOffset = 1.5
                }
            }
        }
    }
}

// MARK: - Mock performance

enum TeamPerformanceMock {
    /// Deterministisk mock — hardkodet så team-A alltid er «on fire»
    /// og team-B er «på mål». Gir stabil visuell demo.
    static func performance(for team: LeadgridSalesTeam) -> TeamPerformance {
        switch team.id {
        case "team-a":
            return TeamPerformance(wonThisWeek: 6, weeklyTarget: 3, trendPercent: 42, rankInOrg: 1)
        case "team-b":
            return TeamPerformance(wonThisWeek: 3, weeklyTarget: 4, trendPercent: 8, rankInOrg: 2)
        default:
            // Randomisert for custom-team salgssjef har opprettet.
            let won = Int.random(in: 1...8)
            let target = Int.random(in: 3...6)
            let trend = Int.random(in: -15...45)
            return TeamPerformance(wonThisWeek: won, weeklyTarget: target,
                                   trendPercent: trend, rankInOrg: nil)
        }
    }
}
