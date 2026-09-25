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
// Avatar-kilde: serverprofilens URL, med initialer som robust fallback.

import SwiftUI


/// Lyskjeglen — hvilken vei enheten peker.
///
/// Den svarer på et spørsmål kartet ellers ikke svarer på: du står utenfor
/// et næringsbygg med fire innganger, og prikken din sier bare *hvor* du er.
/// Kjeglen sier hvilken vei du ser. Apple Maps har den av samme grunn.
///
/// To valg er verdt å begrunne:
///
/// **Bredden følger kompassets usikkerhet.** Et magnetometer forstyrres av
/// bilholdere, høyttalere og metallbord. Når `headingAccuracy` er dårlig,
/// blir kjeglen bredere i stedet for å peke like skarpt som før. En smal
/// kjegle som peker feil er verre enn en bred som peker omtrent riktig.
///
/// **Den tegnes bak avataren.** Kjeglen er kontekst, ikke innhold — den skal
/// ikke dekke ansiktet til den som ser på kartet.
struct HeadingCone: View {
    /// Retning i skjermgrader. 0 = rett opp på skjermen.
    let skjermgrader: Double
    /// Kompassets usikkerhet i grader. Negativ = ukjent.
    let usikkerhet: Double
    let farge: Color

    private var halvVinkel: Double { Self.halvVinkel(usikkerhet: usikkerhet) }

    /// Halv åpningsvinkel ut fra kompassets egen usikkerhet.
    ///
    /// Apple ligger rundt 30 grader når kompasset er godt. Vi følger det, og
    /// åpner opp mot 60 når det ikke er det — en bred kjegle som stemmer er
    /// ærligere enn en smal som ikke gjør det. Ukjent usikkerhet (−1, som
    /// CoreLocation sender før første kalibrering) behandles som middels
    /// dårlig, ikke som perfekt.
    static func halvVinkel(usikkerhet: Double) -> Double {
        guard usikkerhet >= 0 else { return 45 }
        return min(60, max(24, usikkerhet * 1.5))
    }

    /// Hvor langt kjeglen rekker. Lang nok til å lese retningen på et
    /// travelt kart, kort nok til ikke å dekke nabopinnene.
    private static let rekkevidde: CGFloat = 62

    var body: some View {
        Canvas { context, size in
            let senter = CGPoint(x: size.width / 2, y: size.height / 2)
            let start = Angle(degrees: -90 - halvVinkel)
            let slutt = Angle(degrees: -90 + halvVinkel)
            var bane = Path()
            bane.move(to: senter)
            bane.addArc(center: senter, radius: Self.rekkevidde,
                        startAngle: start, endAngle: slutt, clockwise: false)
            bane.closeSubpath()
            context.fill(bane, with: .radialGradient(
                Gradient(colors: [farge.opacity(0.55), farge.opacity(0.0)]),
                center: senter, startRadius: 6, endRadius: Self.rekkevidde))
        }
        .frame(width: Self.rekkevidde * 2, height: Self.rekkevidde * 2)
        .rotationEffect(.degrees(skjermgrader))
        .allowsHitTesting(false)
        // Kompasset oppdaterer ~10 ganger i sekundet. Uten demping sitrer
        // kjeglen; med for mye henger den etter når du snur deg.
        .animation(.easeOut(duration: 0.18), value: skjermgrader)
        .accessibilityHidden(true)
    }
}

struct MeMapPin: View {
    let initials: String
    let profileImageURL: URL?
    /// Hvor mye kartet selv er rotert. I «følg med kompass» roterer MapKit
    /// kartet slik at retningen din peker opp — da skal kjeglen peke rett
    /// opp, ikke mot nord. Skjermvinkelen er derfor differansen.
    var kartHeading: Double = 0

    /// Puls-animasjon for outer-ring.
    @State private var pulse: Bool = false
    /// Motion-boost — trigges av `KartLocationManager.isMoving`. Legger
    /// på en ekstra rask puls + grønn tint + retnings-arrow.
    @Bindable private var location = KartLocationManager.shared

    /// Adherence-observering: RouteTracker publiserer @Observable state.
    @Bindable private var routeTracker = RouteTracker.shared

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
            // Lyskjegle — bak alt annet, så den aldri dekker avataren.
            // Retningen er allerede valgt mellom kompass og GPS-kurs etter
            // reisemåte og fart; her bryr vi oss bare om at den finnes.
            if let peiling = location.retning {
                HeadingCone(skjermgrader: peiling.grader - kartHeading,
                            usikkerhet: peiling.usikkerhet,
                            farge: accentColor)
            }

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

            // Server-avatar med initialer ved tom URL eller nettverksfeil.
            ZStack {
                Text(initials)
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
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
                if let profileImageURL {
                    AsyncImage(url: profileImageURL) { phase in
                        if case .success(let image) = phase {
                            image.resizable().scaledToFill()
                        } else {
                            Color.clear
                        }
                    }
                    .frame(width: 36, height: 36)
                    .clipShape(Circle())
                }
            }

            // Retnings-arrow ved bevegelse — roterer med heading
            if location.isMoving, let heading = location.heading {
                Image(systemName: "location.north.fill")
                    .font(.appScaled(size: 10, weight: .bold))
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
                    .font(.appScaled(size: 9, weight: .black, design: .rounded))
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
