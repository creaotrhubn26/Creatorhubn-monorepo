// MeMapPin.swift
//
// "Meg her"-annotasjon for MapKit-visninger. Viser en sirkulær profil-
// avatar med pulserende ring så bruker kan se sin egen posisjon på
// kartet — akkurat som Apple Maps' blå prikk, men rikere.
//
// HUD-oppgradering (2026-07-02):
//   - Inline adherence-badge: ytre ring farges av
//     RouteTracker.shared.adherenceStatus (grønn=på, gul=avvik, rød=av)
//   - Ved warning: "AVVIK <N> m" liten label under pinen
//   - Ved offRoute: "AV RUTE" alarm-label under pinen
//   - onRoute-status gir en subtil grønn glow
//
// Fallback-hierarki:
//   1) `portrait-<email-local>` asset finnes → SmartPortrait
//   2) Ellers → initialer på farget bakgrunn (samme som avatar-badges)

import SwiftUI

struct MeMapPin: View {
    let initials: String
    let email: String?

    /// Puls-animasjon for outer-ring.
    @State private var pulse: Bool = false
    /// Motion-boost — trigges av `KartLocationManager.isMoving`. Legger
    /// på en ekstra rask puls + grønn tint + retnings-arrow.
    @Bindable private var location = KartLocationManager.shared

    /// Adherence-observering: RouteTracker publiserer @Observable state.
    @Bindable private var routeTracker = RouteTracker.shared

    private var portraitAsset: String? {
        guard let email, let local = email.split(separator: "@").first else {
            return nil
        }
        let candidate = "portrait-\(local.lowercased())"
        return UIImage(named: candidate) != nil ? candidate : nil
    }

    /// Farge-tema — kombinerer adherence + motion.
    /// Adherence har prioritet (rød alarm slår grønn bevegelse).
    private var accentColor: Color {
        switch routeTracker.adherenceStatus {
        case .offRoute: return Color(red: 1.00, green: 0.28, blue: 0.32) // rød
        case .warning:  return Color(red: 1.00, green: 0.82, blue: 0.15) // gul
        case .onRoute:
            return location.isMoving
                ? Color(red: 0.20, green: 0.95, blue: 0.55)   // sterk grønn i bevegelse
                : Color(red: 0.20, green: 0.85, blue: 0.55)   // rolig grønn stille
        case .noRoute:
            return location.isMoving ? Color.green : Color.blue
        }
    }

    /// Puls-hastighet — raskere ved bevegelse + off-route alarm.
    private var pulseDuration: Double {
        if routeTracker.adherenceStatus == .offRoute { return 0.65 }
        return location.isMoving ? 0.9 : 1.8
    }

    /// Maks skala for puls-ringen.
    private var pulseScale: CGFloat {
        if routeTracker.adherenceStatus == .offRoute { return 2.0 }
        return location.isMoving ? 1.7 : 1.4
    }

    /// Statustekst under pinen, hvis relevant.
    private var statusLabel: String? {
        switch routeTracker.adherenceStatus {
        case .warning:
            if let d = routeTracker.currentDeviationM {
                return "AVVIK \(d) M"
            }
            return "AVVIK"
        case .offRoute:
            return "AV RUTE"
        default:
            return nil
        }
    }

    var body: some View {
        ZStack {
            // Ekstra puls-ring — vises kun ved bevegelse ELLER off-route alarm
            if location.isMoving || routeTracker.adherenceStatus == .offRoute {
                Circle()
                    .stroke(accentColor.opacity(0.45), lineWidth: 5)
                    .frame(width: 64, height: 64)
                    .scaleEffect(pulse ? 2.0 : 1.0)
                    .opacity(pulse ? 0 : 0.9)
                    .animation(
                        .easeOut(duration: pulseDuration * 0.7).repeatForever(autoreverses: false),
                        value: pulse
                    )
            }

            // Standard pulserende outer-ring
            Circle()
                .stroke(accentColor.opacity(0.35), lineWidth: 4)
                .frame(width: 56, height: 56)
                .scaleEffect(pulse ? pulseScale : 1.0)
                .opacity(pulse ? 0 : 0.8)
                .animation(
                    .easeOut(duration: pulseDuration).repeatForever(autoreverses: false),
                    value: pulse
                )

            // Adherence-ring — farget outline rundt pinen (statisk, kontinuerlig
            // synlig så salgssjefene ser status uten å tape). Vises kun når
            // tracker faktisk vet noe om ruta.
            if routeTracker.adherenceStatus != .noRoute {
                Circle()
                    .strokeBorder(accentColor.opacity(0.85), lineWidth: 3)
                    .frame(width: 50, height: 50)
                    .shadow(color: accentColor.opacity(0.75), radius: 6)
            }

            // Ytre hvit ring — skiller pinen fra kartbakgrunnen
            Circle()
                .fill(.white)
                .frame(width: 44, height: 44)
                .shadow(color: .black.opacity(0.35), radius: 6, y: 2)

            // Accent-fylt indre ring
            Circle()
                .fill(accentColor)
                .frame(width: 40, height: 40)

            // Portrait ELLER initialer-bakgrunn
            if let asset = portraitAsset {
                SmartPortrait(assetName: asset)
                    .frame(width: 36, height: 36)
                    .clipShape(Circle())
            } else {
                Text(initials)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(
                        LinearGradient(
                            colors: [accentColor, accentColor.opacity(0.75)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        in: Circle()
                    )
            }

            // Retnings-arrow ved bevegelse — roterer med heading
            if location.isMoving, let heading = location.heading {
                Image(systemName: "location.north.fill")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(4)
                    .background(accentColor, in: Circle())
                    .overlay(Circle().stroke(.white, lineWidth: 1.5))
                    .offset(x: 0, y: -30)
                    .rotationEffect(.degrees(heading))
                    .transition(.scale.combined(with: .opacity))
            }

            // HUD-status-label UNDER pinen — vises kun ved warning/offRoute
            if let label = statusLabel {
                Text(label)
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .tracking(1.2)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(accentColor.opacity(0.85), in: Capsule())
                    .overlay(Capsule().strokeBorder(.white.opacity(0.4), lineWidth: 0.5))
                    .shadow(color: accentColor, radius: 5)
                    .offset(x: 0, y: 34)
                    .transition(.opacity.combined(with: .scale))
            }
        }
        .animation(.easeInOut(duration: 0.35), value: location.isMoving)
        .animation(.easeInOut(duration: 0.35), value: routeTracker.adherenceStatus)
        .onAppear { pulse = true }
    }
}
