// LeadPinView.swift
//
// Pin for leads i kartet — Daniel-feedback 2026-06-28 ("pixel-perfect"):
//
// - Drop-pin form (Bezier-path, ikke sirkel+triangle) som matcher
//   marketing-mocken.
// - Glow-farge avhengig av temperatur:
//     • Hot (lead_temperature='hot', score≥90, eller pipeline_stage=qualified+)
//       → RØD glow (signaliserer "ild/klar for kontakt")
//     • Varm (score 50-69)
//       → ORANSJE glow
//     • Normal/kald → ingen glow
// - Status-badge oppå pin når status har et tydelig ikon:
//     • meeting_booked  → calendar (lilla)
//     • visited         → checkmark (grønn)
//     • interested/won  → star.fill (grønn)
//     • declined/lost   → xmark (rød)
//     • next-action har ringe/email → phone.fill / envelope.fill (blå)
// - Indre lys-gradient på pinnen (3D-effekt).
//
// Pin-fyll-farge avhenger av status + score-bånd (samme logikk som før).
//
// Brukes på Lead Map (MapScreen.swift). Snapshot-tester finnes i
// LeadPinViewTests.swift.

import SwiftUI

struct LeadPinView: View {
    let lead: LeadModel
    let selected: Bool
    @Environment(AppState.self) private var appState

    private var isNewlyArrived: Bool {
        appState.recentlyAddedLeadIds.contains(lead.id)
    }

    /// True når vi skal vise rød hot-glow.
    private var isHotLead: Bool {
        if let t = lead.leadTemperature?.lowercased(), t == "hot" || t == "ready" {
            return true
        }
        if let s = lead.leadScore, s >= 90 {
            return true
        }
        if lead.status == .meetingBooked || lead.status == .proposalSent {
            return true
        }
        if let stage = lead.pipelineStage?.lowercased(),
           stage == "qualified" || stage == "proposal_sent" || stage == "negotiating" {
            return true
        }
        return false
    }

    /// True når lead-en er "varm" — score 50-69 + status er uvisited/visited
    /// (dvs ikke avgjort enda; potensial men ikke hot).
    private var isWarmLead: Bool {
        guard !isHotLead else { return false }
        guard let s = lead.leadScore, (50..<70).contains(s) else { return false }
        return lead.status == .unvisited || lead.status == .visited
    }

    /// Pin-fyll-farge.
    private var fillColor: Color {
        if isHotLead { return Color(red: 0.66, green: 0.32, blue: 0.99) } // brand-lilla
        if let score = lead.leadScore, lead.status == .unvisited || lead.status == .visited {
            switch score {
            case 70...:  return Color(red: 0.66, green: 0.32, blue: 0.99) // lilla
            case 50..<70: return Color(red: 0.98, green: 0.75, blue: 0.14) // varm gul
            default:     return Color(red: 0.55, green: 0.60, blue: 0.68) // grå
            }
        }
        switch lead.status {
        case .won, .interested:     return Color(red: 0.20, green: 0.85, blue: 0.60)
        case .meetingBooked:        return Color(red: 0.66, green: 0.32, blue: 0.99)
        case .lost, .declined:      return Color(red: 0.97, green: 0.44, blue: 0.44)
        case .proposalSent:         return Color(red: 0.75, green: 0.52, blue: 0.99)
        case .return:               return Color(red: 0.98, green: 0.75, blue: 0.14)
        case .notPresent:           return Color(red: 0.55, green: 0.60, blue: 0.68)
        case .doNotContact:         return Color(red: 0.30, green: 0.30, blue: 0.36)
        case .visited:              return Color(red: 0.55, green: 0.60, blue: 0.68)
        default:                    return Color(red: 0.376, green: 0.647, blue: 0.980)
        }
    }

    /// Status-badge SF Symbol (vises top-right på pin).
    private var statusBadgeIcon: String? {
        switch lead.status {
        case .meetingBooked:    return "calendar"
        case .visited:          return "checkmark"
        case .won, .interested: return "star.fill"
        case .declined, .lost:  return "xmark"
        default:                return nil
        }
    }

    /// Bakgrunnsfarge for status-badge (mindre intens enn pin-fyll).
    private var statusBadgeColor: Color {
        switch lead.status {
        case .meetingBooked:    return Color(red: 0.66, green: 0.32, blue: 0.99)
        case .visited:          return Color(red: 0.20, green: 0.65, blue: 0.55)
        case .won, .interested: return Color(red: 0.20, green: 0.85, blue: 0.60)
        case .declined, .lost:  return Color(red: 0.97, green: 0.44, blue: 0.44)
        default:                return fillColor
        }
    }

    var body: some View {
        ZStack {
            if isNewlyArrived {
                NewPinPulse(color: Color(red: 0.66, green: 0.32, blue: 0.99))
                    .frame(width: selected ? 110 : 100, height: selected ? 110 : 100)
                    .transition(.scale.combined(with: .opacity))
            }

            // Glow halo — rød for hot, oransje for varm.
            if isHotLead {
                GlowHalo(color: Color(red: 0.95, green: 0.20, blue: 0.20))
            } else if isWarmLead {
                GlowHalo(color: Color(red: 0.98, green: 0.55, blue: 0.10))
            }

            // Pin selv (alltid score hvis tilgjengelig, ellers logo, ellers status-fallback)
            if let score = lead.leadScore {
                scoreDropPin(score: score)
                    .scaleEffect(isNewlyArrived ? 1.18 : 1.0)
                    .animation(.spring(response: 0.6, dampingFraction: 0.55),
                               value: isNewlyArrived)
            } else if let logoUrl = lead.logoUrl, let url = URL(string: logoUrl) {
                logoDropPin(url: url)
                    .scaleEffect(isNewlyArrived ? 1.18 : 1.0)
                    .animation(.spring(response: 0.6, dampingFraction: 0.55),
                               value: isNewlyArrived)
            } else {
                StatusPin(status: lead.status, selected: selected)
                    .scaleEffect(isNewlyArrived ? 1.18 : 1.0)
                    .animation(.spring(response: 0.6, dampingFraction: 0.55),
                               value: isNewlyArrived)
            }

            // Status-badge overlay (oppå pin, top-right)
            if let icon = statusBadgeIcon {
                StatusBadge(icon: icon, color: statusBadgeColor)
                    .offset(x: 14, y: -24)
            }
        }
        .accessibilityLabel(accessibilityLabel)
    }

    @ViewBuilder
    private func scoreDropPin(score: Int) -> some View {
        let w: CGFloat = selected ? 46 : 42
        let h: CGFloat = w * 1.3
        ZStack {
            DropPinShape()
                .fill(LinearGradient(
                    colors: [fillColor, fillColor.opacity(0.88)],
                    startPoint: .top, endPoint: .bottom
                ))
            DropPinShape()
                .fill(LinearGradient(
                    colors: [Color.white.opacity(0.35), Color.white.opacity(0.0)],
                    startPoint: .top, endPoint: .center
                ))
            DropPinShape()
                .stroke(Color.white.opacity(0.95), lineWidth: 2)
            Text("\(score)")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .offset(y: -h * 0.13)
        }
        .frame(width: w, height: h)
        .shadow(color: isHotLead ? Color(red: 0.95, green: 0.20, blue: 0.20).opacity(0.7)
                                 : .black.opacity(0.4),
                radius: isHotLead ? 10 : 3, x: 0, y: 2)
    }

    @ViewBuilder
    private func logoDropPin(url: URL) -> some View {
        let w: CGFloat = selected ? 48 : 44
        let h: CGFloat = w * 1.3
        ZStack {
            DropPinShape()
                .fill(fillColor)
            DropPinShape()
                .stroke(Color.white.opacity(0.95), lineWidth: 2)
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img.resizable().scaledToFit()
                case .failure:
                    Text(initials)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                default:
                    ProgressView().controlSize(.mini)
                }
            }
            .frame(width: w - 14, height: w - 14)
            .background(Color.white)
            .clipShape(Circle())
            .offset(y: -h * 0.13)
        }
        .frame(width: w, height: h)
        .shadow(color: isHotLead ? Color(red: 0.95, green: 0.20, blue: 0.20).opacity(0.7)
                                 : .black.opacity(0.4),
                radius: isHotLead ? 10 : 3, x: 0, y: 2)
    }

    private var initials: String {
        let words = lead.name.split(separator: " ")
        return words.prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }

    private var accessibilityLabel: String {
        var parts = [lead.name, lead.status.label]
        if isHotLead { parts.append("Hot lead") }
        else if isWarmLead { parts.append("Varm lead") }
        if let score = lead.leadScore { parts.append("Score \(score)") }
        return parts.joined(separator: ", ")
    }
}

/// Klassisk Google Maps drop-pin: bred sirkel-topp + spisset bunn.
/// Eksponert som public type så `PinGuideView` (og snapshot-tester) kan
/// rendre samme form uten å duplisere geometrien.
struct DropPinShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let w = rect.width
        let h = rect.height
        let r = w / 2

        p.addArc(
            center: CGPoint(x: w/2, y: r),
            radius: r,
            startAngle: .degrees(180),
            endAngle: .degrees(360),
            clockwise: false
        )
        p.addQuadCurve(
            to: CGPoint(x: w/2, y: h),
            control: CGPoint(x: w * 0.85, y: h * 0.65)
        )
        p.addQuadCurve(
            to: CGPoint(x: 0, y: r),
            control: CGPoint(x: w * 0.15, y: h * 0.65)
        )
        p.closeSubpath()
        return p
    }
}

/// Glow halo bak pinen (rød for hot, oransje for varm).
struct GlowHalo: View {
    let color: Color

    var body: some View {
        ZStack {
            // Outer soft halo
            Circle()
                .fill(RadialGradient(
                    colors: [color.opacity(0.55), color.opacity(0.0)],
                    center: .center,
                    startRadius: 18, endRadius: 48
                ))
                .frame(width: 96, height: 96)
                .blur(radius: 6)
            // Inner intense ring
            Circle()
                .fill(RadialGradient(
                    colors: [color.opacity(0.85), color.opacity(0.1)],
                    center: .center,
                    startRadius: 8, endRadius: 28
                ))
                .frame(width: 56, height: 56)
                .blur(radius: 2)
        }
        .allowsHitTesting(false)
    }
}

/// Liten sirkulær badge med SF Symbol — overlayes oppå pinens topp-høyre.
struct StatusBadge: View {
    let icon: String
    let color: Color

    var body: some View {
        ZStack {
            Circle().fill(color)
            Circle().stroke(Color.white, lineWidth: 1.5)
            Image(systemName: icon)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white)
        }
        .frame(width: 20, height: 20)
        .shadow(color: .black.opacity(0.4), radius: 2, x: 0, y: 1)
    }
}

/// "New pin"-pulse — 3 konsentriske ringer som ekspanderer ut. Brukes når
/// et nytt lead landet via WebSocket (batch-research-flyten).
private struct NewPinPulse: View {
    let color: Color
    @State private var phase: CGFloat = 0

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.8 - Double(phase) * 0.8), lineWidth: 3)
                .scaleEffect(0.6 + phase * 1.0)
            Circle()
                .stroke(color.opacity(0.65 - Double(phase) * 0.6), lineWidth: 2)
                .scaleEffect(0.55 + phase * 0.7)
            Circle()
                .fill(color.opacity(0.25 - Double(phase) * 0.2))
                .scaleEffect(0.5 + phase * 0.5)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 1.2).repeatForever(autoreverses: false)) {
                phase = 1.0
            }
        }
        .allowsHitTesting(false)
    }
}
