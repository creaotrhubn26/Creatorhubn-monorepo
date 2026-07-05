// HUDComponents.swift
//
// Shared HUD-style visual primitives brukt av MePinActionsSheet (radial-
// wheel), MyRouteView (navigation-HUD), NearbyTeamView (team-HUD) og
// RouteAdherenceDashboardView (data-HUD).
//
// Design-språk:
//   - `.ultraThinMaterial` / `.regularMaterial` blur-bakgrunner
//   - Capsule + rounded 14-18pt
//   - Shadow(color: brand-farge, radius: 12) — neon glow-effekt
//   - SF Rounded + monospacedDigit for tall
//   - UPPERCASE + tracking(1.2) på alle labels (military-hud-vibb)
//   - Grønn = optimal · Gul = varsel · Rød = alarm · Blå = info
//
// Komponentene er @MainActor-rene og fungerer likt på iPad, iPhone
// (portrait/landscape) og Mac Catalyst.

import SwiftUI

// MARK: - HUD-palett

@MainActor
enum HUDPalette {
    /// Grønn = "på rute" / optimal / OK.
    static let green = Color(red: 0.20, green: 0.95, blue: 0.55)
    /// Gul = varsel / avvik / caution.
    static let yellow = Color(red: 1.00, green: 0.85, blue: 0.15)
    /// Rød = alarm / av rute / critical.
    static let red = Color(red: 1.00, green: 0.28, blue: 0.32)
    /// Blå = info / navigasjon / nøytral primærakksent.
    static let blue = Color(red: 0.35, green: 0.75, blue: 1.00)
    /// Cyan = utført / historikk (avmerket-vei bak deg).
    static let cyan = Color(red: 0.30, green: 0.95, blue: 0.99)
    /// Lilla = ny/lead (matcher iPad-brand).
    static let purple = Color(red: 0.75, green: 0.45, blue: 1.00)
    /// Oransje = team / bevegelse / advarsel-2.
    static let orange = Color(red: 1.00, green: 0.60, blue: 0.20)
    /// Live-indikator (pulserende).
    static let live = Color(red: 0.20, green: 0.95, blue: 0.55)

    /// Standard-tekst — sikrer synlighet mot både lyst og mørkt kart.
    static let text = Color.white
    /// Sekundær-tekst — dim, brukes til labels.
    static let textDim = Color.white.opacity(0.65)
    static let textFaint = Color.white.opacity(0.4)

    /// Standard border-linje inne i HUD-glass.
    static let stroke = Color.white.opacity(0.18)
    static let strokeHi = Color.white.opacity(0.35)
}

// MARK: - Fonts

@MainActor
enum HUDFont {
    /// Metric big — hero-tall (32-56pt).
    static func metric(_ size: CGFloat) -> Font {
        .system(size: size, weight: .bold, design: .rounded).monospacedDigit()
    }

    /// Label — små UPPERCASE tekster (11-13pt).
    static func label(_ size: CGFloat = 11) -> Font {
        .system(size: size, weight: .medium, design: .rounded)
    }

    /// Titler i HUD-strips (14-18pt).
    static func title(_ size: CGFloat = 15) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
}

// MARK: - HUD-glass-container

/// Bakgrunn brukt av alle HUD-elementer. `.ultraThinMaterial` gir
/// kart-see-through-følelse, en subtil border + accent-glow.
struct HUDGlass: ViewModifier {
    var cornerRadius: CGFloat = 18
    var glowColor: Color = .clear
    var glowRadius: CGFloat = 10
    var strokeOpacity: Double = 0.22

    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Color.white.opacity(strokeOpacity), lineWidth: 1)
            )
            .shadow(color: glowColor.opacity(0.55), radius: glowRadius)
            .shadow(color: .black.opacity(0.35), radius: 20, y: 8)
    }
}

extension View {
    func hudGlass(cornerRadius: CGFloat = 18, glow: Color = .clear, glowRadius: CGFloat = 10, strokeOpacity: Double = 0.22) -> some View {
        modifier(HUDGlass(cornerRadius: cornerRadius, glowColor: glow, glowRadius: glowRadius, strokeOpacity: strokeOpacity))
    }
}

// MARK: - HUD-label (UPPERCASE + tracking)

struct HUDLabel: View {
    let text: String
    var size: CGFloat = 11
    var color: Color = HUDPalette.textDim
    var tracking: CGFloat = 1.2

    var body: some View {
        Text(text.uppercased())
            .font(HUDFont.label(size))
            .tracking(tracking)
            .foregroundStyle(color)
    }
}

// MARK: - HUD-metric (stort tall + liten label under)

struct HUDMetric: View {
    let value: String
    let label: String
    var color: Color = HUDPalette.text
    var valueSize: CGFloat = 32
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        VStack(alignment: alignment, spacing: 4) {
            Text(value)
                .font(HUDFont.metric(valueSize))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            HUDLabel(text: label)
        }
    }
}

// MARK: - Pulserende live-prikk

struct HUDLiveDot: View {
    var color: Color = HUDPalette.live
    var size: CGFloat = 8

    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .fill(color.opacity(0.6))
                .frame(width: size * 2.3, height: size * 2.3)
                .scaleEffect(pulse ? 1.4 : 0.9)
                .opacity(pulse ? 0.0 : 0.7)
                .animation(.easeOut(duration: 1.6).repeatForever(autoreverses: false), value: pulse)
            Circle()
                .fill(color)
                .frame(width: size, height: size)
                .shadow(color: color, radius: 6)
        }
        .onAppear { pulse = true }
        .accessibilityHidden(true)
    }
}

// MARK: - Status-pill (grønn/gul/rød) med glow

struct HUDStatusPill: View {
    let icon: String
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.appScaled(size: 10, weight: .black))
            Text(text.uppercased())
                .font(HUDFont.label(11))
                .tracking(1.2)
        }
        .foregroundStyle(color)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(color.opacity(0.18), in: Capsule())
        .overlay(Capsule().strokeBorder(color.opacity(0.5), lineWidth: 1))
        .shadow(color: color.opacity(0.4), radius: 6)
    }
}

// MARK: - Sirkulær progress-gauge

/// Ring-progress med tall i midten. Brukes til "On-route %" osv.
struct HUDCircularGauge: View {
    let value: Double        // 0.0 - 1.0
    let displayText: String
    let label: String
    let color: Color
    var size: CGFloat = 100
    var lineWidth: CGFloat = 8

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(Color.white.opacity(0.10), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0, min(1, value)))
                .stroke(
                    AngularGradient(
                        colors: [color.opacity(0.7), color, color.opacity(0.9)],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .shadow(color: color.opacity(0.6), radius: 8)
                .animation(.easeOut(duration: 0.5), value: value)
            VStack(spacing: 3) {
                Text(displayText)
                    .font(HUDFont.metric(size * 0.28))
                    .foregroundStyle(color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                HUDLabel(text: label, size: 9, tracking: 1.0)
                    .lineLimit(1)
            }
            .padding(.horizontal, size * 0.12)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Vertikal bar-gauge

/// Vertikal bar (grønn/gul/rød segmenter) med markert nåværende verdi.
struct HUDBarGauge: View {
    /// 0.0 = optimal (grønn topp), 1.0 = kritisk (rød bunn).
    let value: Double
    let displayText: String
    let label: String
    var height: CGFloat = 100

    private func segmentColor(_ i: Int) -> Color {
        switch i {
        case 0: return HUDPalette.green
        case 1: return HUDPalette.yellow
        default: return HUDPalette.red
        }
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                VStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { i in
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(segmentColor(i).opacity(0.85))
                            .frame(width: 10, height: (height - 6) / 3)
                            .shadow(color: segmentColor(i).opacity(0.5), radius: 4)
                            .opacity(indicatorSegment == i ? 1.0 : 0.25)
                    }
                }
                Text(displayText)
                    .font(HUDFont.metric(24))
                    .foregroundStyle(currentColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            HUDLabel(text: label)
        }
    }

    private var indicatorSegment: Int {
        switch value {
        case ..<0.33: return 0
        case 0.33..<0.66: return 1
        default: return 2
        }
    }

    private var currentColor: Color { segmentColor(indicatorSegment) }
}

// MARK: - Sparkline (mini line-chart)

struct HUDSparkline: View {
    let points: [Double]
    let color: Color
    var height: CGFloat = 28
    var showFill: Bool = true

    var body: some View {
        GeometryReader { geo in
            let path = pathFor(size: geo.size)
            ZStack {
                if showFill {
                    let fill = fillPath(size: geo.size)
                    fill.fill(
                        LinearGradient(
                            colors: [color.opacity(0.35), color.opacity(0.0)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                }
                path.stroke(color, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                    .shadow(color: color.opacity(0.6), radius: 3)
            }
        }
        .frame(height: height)
    }

    private func pathFor(size: CGSize) -> Path {
        Path { p in
            let clean = points.filter { $0.isFinite }
            guard clean.count > 1 else {
                if let v = clean.first {
                    let y = size.height * (1 - CGFloat(normalize(v)))
                    p.move(to: CGPoint(x: 0, y: y))
                    p.addLine(to: CGPoint(x: size.width, y: y))
                }
                return
            }
            let stepX = size.width / CGFloat(clean.count - 1)
            for (i, v) in clean.enumerated() {
                let x = stepX * CGFloat(i)
                let y = size.height * (1 - CGFloat(normalize(v)))
                if i == 0 { p.move(to: CGPoint(x: x, y: y)) }
                else { p.addLine(to: CGPoint(x: x, y: y)) }
            }
        }
    }

    private func fillPath(size: CGSize) -> Path {
        var p = pathFor(size: size)
        let clean = points.filter { $0.isFinite }
        guard clean.count > 1 else { return p }
        p.addLine(to: CGPoint(x: size.width, y: size.height))
        p.addLine(to: CGPoint(x: 0, y: size.height))
        p.closeSubpath()
        return p
    }

    /// Normalize inn i [0, 1] med litt padding for at høyeste ikke rammer topp.
    private func normalize(_ v: Double) -> Double {
        let clean = points.filter { $0.isFinite }
        guard let lo = clean.min(), let hi = clean.max(), hi > lo else { return 0.5 }
        return (v - lo) / (hi - lo) * 0.9 + 0.05
    }
}

// MARK: - Donut-chart (2-verdi)

/// Enkel donut-chart som viser fullført/gjenstår som proporsjon.
struct HUDDonut: View {
    let completed: Int
    let total: Int
    let color: Color
    var size: CGFloat = 90

    private var fraction: Double {
        guard total > 0 else { return 0 }
        return min(1, max(0, Double(completed) / Double(total)))
    }

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(Color.white.opacity(0.10), lineWidth: 10)
            Circle()
                .trim(from: 0, to: fraction)
                .stroke(color, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: color.opacity(0.6), radius: 6)
            VStack(spacing: 2) {
                Text("\(completed)")
                    .font(HUDFont.metric(size * 0.30))
                    .foregroundStyle(color)
                Text("/ \(total)")
                    .font(HUDFont.label(11))
                    .foregroundStyle(HUDPalette.textDim)
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Radial action-wheel button

/// Én av 4 CTA-knapper som svever rundt user-pinen i MePinActions-HUD.
struct HUDWheelButton: View {
    let icon: String
    let label: String
    let color: Color
    var isDisabled: Bool = false
    var isBusy: Bool = false
    var onTap: () -> Void

    @State private var appeared = false

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(.ultraThinMaterial)
                    Circle()
                        .fill(color.opacity(0.20))
                    Circle()
                        .strokeBorder(color.opacity(0.75), lineWidth: 1.5)
                    if isBusy {
                        ProgressView()
                            .tint(color)
                    } else {
                        Image(systemName: icon)
                            .font(.appScaled(size: 22, weight: .bold))
                            .foregroundStyle(color)
                    }
                }
                .frame(width: 64, height: 64)
                .shadow(color: color.opacity(0.6), radius: 12)
                .shadow(color: .black.opacity(0.4), radius: 6, y: 3)

                Text(label.uppercased())
                    .font(HUDFont.label(10))
                    .tracking(1.1)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(.ultraThinMaterial, in: Capsule())
                    .overlay(Capsule().strokeBorder(Color.white.opacity(0.2), lineWidth: 0.5))
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
            .opacity(isDisabled ? 0.4 : 1.0)
            .scaleEffect(appeared ? 1.0 : 0.6)
            .opacity(appeared ? 1.0 : 0.0)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isBusy)
        .contentShape(Rectangle())
        .onAppear {
            withAnimation(.spring(response: 0.42, dampingFraction: 0.72)) {
                appeared = true
            }
        }
    }
}

// MARK: - HUD-scrim (dim kartet bak wheelen)

/// Dim-lag over kartet — 40% svart + subtil radial for å fokusere blikk på wheelen.
struct HUDScrim: View {
    var onTap: () -> Void = {}
    var body: some View {
        Rectangle()
            .fill(Color.black.opacity(0.45))
            .ignoresSafeArea()
            .overlay(
                RadialGradient(
                    colors: [.clear, Color.black.opacity(0.25)],
                    center: .center,
                    startRadius: 40,
                    endRadius: 400
                )
                .ignoresSafeArea()
                .allowsHitTesting(false)
            )
            .contentShape(Rectangle())
            .onTapGesture(perform: onTap)
    }
}

// MARK: - HUD-close-knapp (X-knapp øverst-høyre på fullscreen-HUD)

struct HUDCloseButton: View {
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack {
                Circle()
                    .fill(.ultraThinMaterial)
                Circle()
                    .strokeBorder(Color.white.opacity(0.3), lineWidth: 1)
                Image(systemName: "xmark")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 40, height: 40)
            .shadow(color: .black.opacity(0.35), radius: 8, y: 3)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Lukk")
    }
}

// MARK: - HUD-refresh-knapp (sirkulær)

struct HUDRefreshButton: View {
    var color: Color = HUDPalette.blue
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack {
                Circle()
                    .fill(.ultraThinMaterial)
                Circle()
                    .strokeBorder(color.opacity(0.55), lineWidth: 1)
                Image(systemName: "arrow.clockwise")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 40, height: 40)
            .shadow(color: color.opacity(0.4), radius: 6)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Oppdater")
    }
}

// MARK: - Farge-helper: on-route

@MainActor
enum HUDColorScale {
    /// Grønn ≥ 80%, gul 60-79%, rød < 60%.
    static func forOnRoute(_ pct: Int) -> Color {
        switch pct {
        case 80...: return HUDPalette.green
        case 60..<80: return HUDPalette.yellow
        default: return HUDPalette.red
        }
    }

    /// Grønn < 200m, gul 200-999m, rød ≥ 1000m.
    static func forDeviation(_ m: Int) -> Color {
        switch m {
        case ..<200: return HUDPalette.green
        case 200..<1000: return HUDPalette.yellow
        default: return HUDPalette.red
        }
    }
}
