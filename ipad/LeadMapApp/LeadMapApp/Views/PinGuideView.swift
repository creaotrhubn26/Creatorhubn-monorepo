// PinGuideView.swift
//
// In-app guide som forklarer hva hver pin-variant på kartet betyr.
// Bygger på de SAMME view-typene som prod-pinen (DropPinShape, GlowHalo,
// StatusBadge fra LeadPinView.swift) — slik at hva brukeren ser i guiden
// er nøyaktig det samme som det de møter på kartet.
//
// Tilgjengelig fra Mer-fanen → "Forstå pinsene" (mer-fane-mounting i
// MoreScreen.swift). Daniels feedback 2026-06-28:
// "legg previewen inn i appen som en guide for å få oversikt over hva
// pinsene betyr. legg inn en forklarende dialog på hver av dem."

import SwiftUI

struct PinGuideView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header

                section(title: "Etter temperatur",
                        subtitle: "Glow rundt pinnen viser hvor klar lead-en er for kontakt.") {
                    pinRow(score: 92, kind: .hot,
                           title: "Hot lead — rød glow",
                           explanation: "Score 90+ eller pipeline-stage 'qualified/proposal/negotiating'. Klar for direkte kontakt — typisk neste besøk i dag eller i morgen.")
                    pinRow(score: 78, kind: .scoredHigh,
                           title: "Høy score (70-89) — lilla",
                           explanation: "Solid prospekt. Verdt research + en kvalifiserende samtale.")
                    pinRow(score: 65, kind: .warm,
                           title: "Varm lead — oransje glow",
                           explanation: "Score 50-69. Potensial, men trenger mer kontekst før kontakt. Følg opp når du er i området.")
                    pinRow(score: 32, kind: .cold,
                           title: "Lav score (under 50) — grå",
                           explanation: "Lavt potensial-tall fra Intelligence Engine. Vurder å avregistrere eller la ligge.")
                }

                section(title: "Etter status",
                        subtitle: "Liten badge øverst på pinnen viser hva du har gjort med lead-en.") {
                    pinRow(score: 90, kind: .meeting,
                           title: "Møte booket — kalender-badge",
                           explanation: "Du har avtalt møte. Pinen er hot (lilla + rød glow) så du raskt finner det neste møtet ditt.")
                    pinRow(score: 73, kind: .visited,
                           title: "Besøkt — grønn ✓",
                           explanation: "Du har vært innom adressen. Loggen viser når og hvilken status den fikk etterpå.")
                    pinRow(score: 88, kind: .won,
                           title: "Vunnet eller interessert — stjerne",
                           explanation: "Lead-en har sagt ja eller vist klar interesse. Send tilbud / oppfølging.")
                    pinRow(score: 45, kind: .declined,
                           title: "Avslått — rød ✗",
                           explanation: "Lead-en avviste tilbudet. Pinen er rød (#f56b6b) så du ikke kontakter på nytt uten grunn.")
                }

                section(title: "Animasjoner",
                        subtitle: "Pinene reagerer i sanntid på endringer.") {
                    animationRow(
                        title: "Ny pin landet (pulse)",
                        explanation: "Når lead-research eller bulk-URL gir nye leads, pulser pinnen i 3 sekunder så du ser den dukke opp på kartet.")
                    animationRow(
                        title: "Hot pulse",
                        explanation: "Hot leads har en kontinuerlig myk lilla pulse-ring rundt seg, slik at de skiller seg ut når du zoomer ut.")
                }

                footer
            }
            .padding(24)
        }
        .background(Color(red: 0.05, green: 0.04, blue: 0.10))
        .navigationTitle("Forstå pinsene")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.title2)
                    .foregroundStyle(Color(red: 0.66, green: 0.32, blue: 0.99))
                Text("Pin-guide")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
            }
            Text("Hver pin på kartet forteller deg to ting samtidig: hvor varm lead-en er (via glow-fargen) og hvor du står i prosessen (via badge-ikonet). Bla nedover for å se alle variantene.")
                .font(.callout)
                .foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider().background(Color.white.opacity(0.1))
                .padding(.vertical, 6)
            Text("Tips")
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.8))
            Text("Tap en pin på kartet for å se full historikk + neste anbefalte handling fra Intelligence Engine. Long-press på et tomt sted for å droppe en pin manuelt.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.55))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private func section<Content: View>(
        title: String, subtitle: String, @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.55))
            }
            VStack(spacing: 12) {
                content()
            }
        }
    }

    private func pinRow(score: Int, kind: GuidePinKind, title: String, explanation: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            // Pin i venstre kolonne — 80×100 så glow får plass
            GuidePin(score: score, kind: kind)
                .frame(width: 80, height: 100)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                Text(explanation)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.65))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white.opacity(0.04))
        )
    }

    private func animationRow(title: String, explanation: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: "sparkles")
                .font(.title2)
                .foregroundStyle(Color(red: 0.66, green: 0.32, blue: 0.99))
                .frame(width: 80, height: 60)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                Text(explanation)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.65))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white.opacity(0.04))
        )
    }
}

// MARK: - GuidePin (gjenbruker DropPinShape + GlowHalo + StatusBadge fra LeadPinView)

enum GuidePinKind {
    case hot, scoredHigh, warm, cold, meeting, visited, won, declined
}

struct GuidePin: View {
    let score: Int
    let kind: GuidePinKind

    var fillColor: Color {
        switch kind {
        case .hot, .scoredHigh, .meeting: return Color(red: 0.66, green: 0.32, blue: 0.99)
        case .warm:                        return Color(red: 0.98, green: 0.75, blue: 0.14)
        case .cold:                        return Color(red: 0.55, green: 0.60, blue: 0.68)
        case .visited:                     return Color(red: 0.55, green: 0.60, blue: 0.68)
        case .won:                         return Color(red: 0.20, green: 0.85, blue: 0.60)
        case .declined:                    return Color(red: 0.97, green: 0.44, blue: 0.44)
        }
    }

    var hotGlow: Bool {
        kind == .hot || kind == .meeting
    }

    var warmGlow: Bool {
        kind == .warm
    }

    var badgeIcon: String? {
        switch kind {
        case .meeting:  return "calendar"
        case .visited:  return "checkmark"
        case .won:      return "star.fill"
        case .declined: return "xmark"
        default:        return nil
        }
    }

    var badgeColor: Color {
        switch kind {
        case .meeting:  return Color(red: 0.66, green: 0.32, blue: 0.99)
        case .visited:  return Color(red: 0.20, green: 0.65, blue: 0.55)
        case .won:      return Color(red: 0.20, green: 0.85, blue: 0.60)
        case .declined: return Color(red: 0.97, green: 0.44, blue: 0.44)
        default:        return fillColor
        }
    }

    var body: some View {
        ZStack {
            if hotGlow {
                GlowHalo(color: Color(red: 0.95, green: 0.20, blue: 0.20))
            } else if warmGlow {
                GlowHalo(color: Color(red: 0.98, green: 0.55, blue: 0.10))
            }

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
                    .offset(y: -7)
            }
            .frame(width: 42, height: 55)
            .shadow(color: hotGlow ? Color(red: 0.95, green: 0.20, blue: 0.20).opacity(0.7)
                                    : .black.opacity(0.4),
                    radius: hotGlow ? 10 : 3, x: 0, y: 2)

            if let icon = badgeIcon {
                StatusBadge(icon: icon, color: badgeColor)
                    .offset(x: 14, y: -24)
            }
        }
    }
}

#Preview {
    NavigationStack {
        PinGuideView()
    }
}
