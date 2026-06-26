// CenterOnMeFAB.swift
//
// Prominent "Sentrer på meg"-FAB for kart-flaten. Erstatter (visuelt) den
// lille standard `MapUserLocationButton` slik at en selger i felt — som
// kan ha hansker, sol i øynene og kjører bil — kan finne knappen
// umiddelbart.
//
// Tre tracking-states (matcher Apple Maps-mønsteret):
//   • .off              — outlined location-ikon
//   • .follow           — fylt ikon, lilla glow
//   • .followWithHeading — kompass-ikon, lilla glow + pulse
//
// Tap → progresjon off → follow → heading → off.
// Long-press (1s) → trigger drop-pin på CURRENT location (utenfor
// selve kartet; for tap-koordinater bruker vi MapReader-gesturen).
//
// Eksponerer kun små Sendable-typer + en SwiftUI View. Selve
// trackingMode-state holdes av MapScreen så camera kan oppdateres samme
// sted som zoom + region-binding ligger.

import SwiftUI
import CoreLocation
import UIKit

/// Tracking-mode for sentrer-på-meg-FAB. Speiler Apple `MKUserTrackingMode`
/// men eksponeres som ren Swift-enum så MapScreen kan binde state uten å
/// dra inn MapKit-typer i view-laget.
enum CenterTrackingMode: String, CaseIterable, Sendable {
    case off
    case follow
    case followWithHeading

    /// Neste state i progresjonen — tap-progresjonen som Apple Maps har.
    var next: CenterTrackingMode {
        switch self {
        case .off: return .follow
        case .follow: return .followWithHeading
        case .followWithHeading: return .off
        }
    }

    var sfSymbol: String {
        switch self {
        case .off: return "location"
        case .follow: return "location.fill"
        case .followWithHeading: return "location.north.line.fill"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .off: return "Sentrer på meg, av"
        case .follow: return "Følger min posisjon"
        case .followWithHeading: return "Følger min posisjon med kompass"
        }
    }
}

/// Stor (56pt) rund knapp som flyter i kart-overlayet. Brand-lilla
/// (#9333ea), drop-shadow, glow når aktiv. Tap toggler tracking-mode,
/// long-press trigger drop-pin på current location.
struct CenterOnMeFAB: View {
    let mode: CenterTrackingMode
    let authStatus: CLAuthorizationStatus
    let onToggleMode: () -> Void
    let onLongPress: () -> Void
    let onPermissionDenied: () -> Void

    @State private var pulse = false

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92) // #9333ea

    var body: some View {
        Button {
            // Haptic + state-bytte. Hvis permission er denied → eskalér til
            // permission-handler i stedet for å silently togge ingenting.
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            if authStatus == .denied || authStatus == .restricted {
                onPermissionDenied()
            } else {
                onToggleMode()
            }
        } label: {
            ZStack {
                // Bakgrunns-sirkel — fylt lilla når aktiv, halvtransparent når av.
                Circle()
                    .fill(isActive ? Self.brandPurple : Color.black.opacity(0.55))
                    .frame(width: 56, height: 56)
                // Glow når aktiv (pulser kun i heading-mode for å indikere
                // levende kompass-følging — Apple Maps gjør det samme).
                if isActive {
                    Circle()
                        .stroke(Self.brandPurple.opacity(pulse ? 0.20 : 0.55), lineWidth: pulse ? 8 : 3)
                        .frame(width: 56, height: 56)
                        .blur(radius: 4)
                        .animation(
                            mode == .followWithHeading
                                ? .easeInOut(duration: 1.2).repeatForever(autoreverses: true)
                                : .default,
                            value: pulse
                        )
                }
                Image(systemName: mode.sfSymbol)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                    // Subtil rotasjon av kompass-pilen i heading-mode.
                    .rotationEffect(.degrees(mode == .followWithHeading && pulse ? 8 : 0))
                    .animation(
                        mode == .followWithHeading
                            ? .easeInOut(duration: 1.2).repeatForever(autoreverses: true)
                            : .default,
                        value: pulse
                    )
            }
            .shadow(color: .black.opacity(0.35), radius: 6, x: 0, y: 3)
            .shadow(
                color: isActive ? Self.brandPurple.opacity(0.55) : .clear,
                radius: 12, x: 0, y: 0
            )
            .overlay(alignment: .topTrailing) {
                // Slash-indikator hvis posisjon er avslått — kommuniserer
                // hvorfor knappen ikke gjør noe nå.
                if authStatus == .denied || authStatus == .restricted {
                    Image(systemName: "slash.circle.fill")
                        .font(.caption.bold())
                        .foregroundStyle(.white, .red)
                        .background(Color.white, in: Circle())
                        .offset(x: 4, y: -4)
                }
            }
        }
        .buttonStyle(.plain)
        // Long-press trigger drop-pin på CURRENT location.
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.9)
                .onEnded { _ in
                    UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                    onLongPress()
                }
        )
        .accessibilityLabel(mode.accessibilityLabel)
        .accessibilityHint("Trykk for å bytte tracking-modus. Hold for å lage ny lead her du står.")
        .onAppear {
            if mode == .followWithHeading { pulse = true }
        }
        .onChange(of: mode) { _, newValue in
            pulse = (newValue == .followWithHeading)
        }
    }

    private var isActive: Bool {
        mode == .follow || mode == .followWithHeading
    }
}

#Preview {
    VStack(spacing: 24) {
        ForEach(CenterTrackingMode.allCases, id: \.self) { m in
            CenterOnMeFAB(
                mode: m,
                authStatus: .authorizedWhenInUse,
                onToggleMode: {},
                onLongPress: {},
                onPermissionDenied: {}
            )
        }
        CenterOnMeFAB(
            mode: .off,
            authStatus: .denied,
            onToggleMode: {},
            onLongPress: {},
            onPermissionDenied: {}
        )
    }
    .padding()
    .background(Color.gray.opacity(0.4))
    .preferredColorScheme(.dark)
}
