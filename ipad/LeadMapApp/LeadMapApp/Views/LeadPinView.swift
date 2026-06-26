// LeadPinView.swift
//
// Pin for leads i kartet — speiler det visuelle systemet i web:
//   • Hot lead (leadTemperature='hot' eller pipeline_stage='meeting_booked'
//     m/ høy score) → STOR pulserende lilla pin (mest oppmerksomhetstung).
//   • Return / følg opp (status='return')             → gul
//   • Ikke til stede (status='not_present')           → grå
//   • Avslått (status='declined' / 'lost')            → rød
//   • Interessert / møte booket / vunnet              → grønn
//   • Default                                          → blå (uvisited)
//
// Bedrifts-logo brukes som "kjerne" når den finnes (mig 288), men status-
// fargen er ALLTID synlig som ring/hale så salgskonsulenten ser pipeline
// uten å zoome. Mønstre fra LeadgridForecastingCard for purple-glow.

import SwiftUI

struct LeadPinView: View {
    let lead: LeadModel
    let selected: Bool

    /// Returner true når vi skal vise stor pulserende lilla pin.
    /// Driver av `lead_temperature='hot'` (Intelligence Engine), score ≥90,
    /// eller pipeline_stage='meeting_booked' uten avsluttende status.
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

    /// Effektiv pin-farge basert på STATUS + SCORE + PIPELINE — i den
    /// prioriteringen mocken viser. Hot/varm/lunken-farger speiler 90+/70+/50+
    /// score-bånd. Synlig som ring rundt logoen og som hale på dropp-pinen.
    private var statusColor: Color {
        if isHotLead {
            return Color(red: 0.66, green: 0.32, blue: 0.99) // brand-lilla (#a855f7)
        }
        // Score-band når status ikke har en sterk farge
        if let score = lead.leadScore, lead.status == .unvisited || lead.status == .visited {
            switch score {
            case 70...:  return Color(red: 0.66, green: 0.32, blue: 0.99) // lilla 70–89
            case 50..<70: return Color(red: 0.98, green: 0.75, blue: 0.14) // varm gul
            default:     return Color(red: 0.55, green: 0.60, blue: 0.68) // grå < 50
            }
        }
        switch lead.status {
        case .won, .interested:
            return Color(red: 0.20, green: 0.85, blue: 0.60)   // grønn — interessert
        case .meetingBooked:
            return Color(red: 0.66, green: 0.32, blue: 0.99)   // lilla — booket møte
        case .lost, .declined:
            return Color(red: 0.97, green: 0.44, blue: 0.44)   // rød — avslått
        case .proposalSent:
            return Color(red: 0.75, green: 0.52, blue: 0.99)
        case .return:
            return Color(red: 0.98, green: 0.75, blue: 0.14)   // gul — kom tilbake
        case .notPresent:
            return Color(red: 0.55, green: 0.60, blue: 0.68)   // grå — ikke til stede
        case .doNotContact:
            return Color(red: 0.30, green: 0.30, blue: 0.36)
        case .visited:
            return Color(red: 0.55, green: 0.60, blue: 0.68)
        default:
            return Color(red: 0.376, green: 0.647, blue: 0.980) // blå — uvisited
        }
    }

    var body: some View {
        ZStack {
            if isHotLead {
                HotPulseRing(color: statusColor)
                    .frame(width: selected ? 64 : 56, height: selected ? 64 : 56)
            }

            // Mock-paritet: lead score VISES INNI pinen (stort hvitt tall).
            // Når score finnes prioriterer vi den over logo — det er det
            // som gir kart-feedet sin lesbarhet på avstand.
            if let score = lead.leadScore {
                scorePin(score: score)
            } else if let logoUrl = lead.logoUrl, let url = URL(string: logoUrl) {
                logoPin(url: url)
            } else {
                StatusPin(status: lead.status, selected: selected)
            }
        }
        .accessibilityLabel(accessibilityLabel)
    }

    /// Score-pin: rund pill m/ score-tallet i hvit bold-font, status-farget
    /// fyll + ring. Speiler marketing-mocken direkte.
    @ViewBuilder
    private func scorePin(score: Int) -> some View {
        let size: CGFloat = selected ? 50 : (isHotLead ? 46 : 40)
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(statusColor)
                Circle()
                    .stroke(Color.white.opacity(0.95), lineWidth: 2)
                Text("\(score)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            .frame(width: size, height: size)
            .shadow(color: isHotLead ? statusColor.opacity(0.7) : .black.opacity(0.35),
                    radius: isHotLead ? 6 : 2)

            // Droppin-hale (peker mot kartpunkt)
            Triangle()
                .fill(statusColor)
                .frame(width: 10, height: 8)
                .offset(y: -2)
        }
    }

    /// VoiceOver-tekst — formidler status + om pin er hot.
    private var accessibilityLabel: String {
        var parts = [lead.name, lead.status.label]
        if isHotLead { parts.append("Hot lead") }
        if let score = lead.leadScore { parts.append("Score \(score)") }
        return parts.joined(separator: ", ")
    }

    @ViewBuilder
    private func logoPin(url: URL) -> some View {
        let size: CGFloat = selected ? 48 : (isHotLead ? 44 : 38)
        let ringWidth: CGFloat = isHotLead ? 4 : (selected ? 4 : 3)
        VStack(spacing: 0) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img.resizable().scaledToFit()
                case .failure:
                    StatusPin(status: lead.status, selected: selected)
                default:
                    ProgressView().controlSize(.mini)
                }
            }
            .frame(width: size - 8, height: size - 8)
            .background(Color.white)
            .clipShape(Circle())
            .overlay(Circle().stroke(statusColor, lineWidth: ringWidth))
            .shadow(color: isHotLead ? statusColor.opacity(0.7) : .black.opacity(0.35),
                    radius: isHotLead ? 6 : 2)
            // Droppin-hale (peker mot kartpunkt)
            Triangle()
                .fill(statusColor)
                .frame(width: 10, height: 8)
                .offset(y: -2)
        }
    }
}

/// Pulserende ring rundt hot leads — bruker SwiftUI .repeatForever for
/// kontinuerlig oppmerksomhet uten å trekke på CPU.
private struct HotPulseRing: View {
    let color: Color
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.65), lineWidth: 2)
                .scaleEffect(pulse ? 1.4 : 0.85)
                .opacity(pulse ? 0.0 : 0.85)
            Circle()
                .fill(color.opacity(0.18))
                .scaleEffect(pulse ? 1.15 : 0.95)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 1.4).repeatForever(autoreverses: false)) {
                pulse = true
            }
        }
        .allowsHitTesting(false)
    }
}

private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.closeSubpath()
        return p
    }
}
