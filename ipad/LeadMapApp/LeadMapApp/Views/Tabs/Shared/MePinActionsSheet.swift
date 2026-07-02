// MePinActionsSheet.swift
//
// HUD-style radial action-wheel (redesign 2026-07-02). Erstatter tradisjonell
// bottom-sheet med et transparent overlay der 4 CTA-knapper svever i sirkel
// rundt user-pinen — som Waze/F1-telemetry. Kartet bak forblir synlig.
//
// Actions:
//   1) Min rute i dag          → MyRouteView          (nord, blå glow)
//   2) Registrer besøk her     → VisitLogModal        (øst, grønn glow)
//   3) Ny lead her             → createLeadAtPosition (sør, lilla glow)
//   4) Team i nærheten         → NearbyTeamView       (vest, oransje glow)
//                                (skjul hvis ikke salgssjef+)
//
// Brukes med `.sheet(isPresented:) { MePinActionsSheet(...) }` fra parent —
// sheeten bruker `.presentationBackground(.clear)` så kartet skinner
// gjennom. Tap på tomrom lukker.

import SwiftUI
import CoreLocation

/// Sheet-modifiers påføres kun i sheet-modus. I inline-overlay-mode
/// er innholdet allerede plassert i parent-viewens `.overlay()` og
/// trenger ingen presentasjons-styring.
private struct SheetPresentationOnlyIfNeeded: ViewModifier {
    let inline: Bool
    func body(content: Content) -> some View {
        if inline {
            content
        } else {
            content
                .presentationBackground(.clear)
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
        }
    }
}

struct MePinActionsSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    /// Callbacks lar parent-viewen ta over etter dismissed.
    let onOpenMyRoute: () -> Void
    let onOpenVisitLog: (CLLocationCoordinate2D) -> Void
    let onOpenTeamNearby: () -> Void
    let onLeadCreated: (CreatedLeadAtPositionDTO) -> Void
    /// Optional lukk-callback for inline-overlay-mode. Når satt, brukes
    /// denne i stedet for `close()` (som er sheet-only).
    var onClose: (() -> Void)? = nil

    /// Bruk `close()` internt så begge modi funker likt.
    /// Inline-overlay-modus: kaller parent-onClose (som skjuler overlay + resetter kamera).
    /// Sheet-modus: bruker Environment.dismiss.
    private func close() {
        if let onClose { onClose() } else { dismiss() }
    }

    @State private var currentCoord: CLLocationCoordinate2D?
    @State private var creatingLead = false
    @State private var errorMessage: String?
    @State private var appeared = false
    /// Reverse-geocoded adresse: "Solgården 12, 1830 Askim". Vises i stedet
    /// for rå koordinater når vi finner et treff. `nil` under første fetch;
    /// koordinater vises som fallback. Kilde vises separat (🇳🇴 Kartverket
    /// eller Apple Maps).
    @State private var resolvedAddress: String?
    @State private var resolvedMunicipality: String?
    @State private var resolvedSource: KartverketService.Source?

    /// Salgssjef+ ser "Team i nærheten"-kortet.
    private var canSeeTeamNearby: Bool {
        guard let role = appState.userRole?.lowercased() else { return false }
        return [
            "sales_manager", "org_admin", "super_admin",
            "admin", "owner",
        ].contains(role)
    }

    var body: some View {
        ZStack {
            HUDScrim { close() }
                .transition(.opacity)

            radialHUD
                .transition(.scale(scale: 0.7).combined(with: .opacity))

            // Header som svever øverst — vi bruker denne i stedet for
            // navigation-toolbar siden dette er en HUD, ikke et vindu.
            VStack {
                topBar
                Spacer()
                if let errorMessage {
                    errorPill(errorMessage)
                        .padding(.bottom, 40)
                }
            }
        }
        .modifier(SheetPresentationOnlyIfNeeded(inline: onClose != nil))
        .onAppear {
            currentCoord = KartLocationManager.shared.currentCoordinate
            withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                appeared = true
            }
            // Reverse-geocode: kart-tap → adresse via KartverketService
            // (Norge → Kartverket punktsok, ellers → CLGeocoder-fallback).
            if let coord = currentCoord {
                Task { await resolveAddress(coord: coord) }
            }
        }
    }

    // MARK: - Top HUD-bar

    private var topBar: some View {
        HStack(spacing: 12) {
            // Identity-badge (initialer + navn)
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(HUDPalette.blue.opacity(0.25))
                    Circle()
                        .strokeBorder(HUDPalette.blue.opacity(0.7), lineWidth: 1.5)
                    Text(appState.initials)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                .frame(width: 36, height: 36)
                .shadow(color: HUDPalette.blue.opacity(0.5), radius: 6)

                VStack(alignment: .leading, spacing: 1) {
                    Text(appState.displayName)
                        .font(HUDFont.title(13))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let address = resolvedAddress {
                        HStack(spacing: 4) {
                            Text(address)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(HUDPalette.textDim)
                                .lineLimit(1)
                            if resolvedSource == .kartverket {
                                Text("🇳🇴")
                                    .font(.system(size: 9))
                                    .accessibilityLabel("Fra Kartverket")
                            }
                        }
                        .transition(.opacity)
                        if let kom = resolvedMunicipality, !kom.isEmpty {
                            Text(kom.uppercased())
                                .font(.system(size: 8, weight: .black, design: .rounded))
                                .tracking(0.9)
                                .foregroundStyle(HUDPalette.blue.opacity(0.85))
                                .lineLimit(1)
                        }
                    } else if let coord = currentCoord {
                        // Fallback mens reverse-geocode kjører
                        Text(coordString(coord))
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundStyle(HUDPalette.textDim)
                            .lineLimit(1)
                    } else {
                        HUDLabel(text: "Henter posisjon…", size: 9)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .hudGlass(cornerRadius: 22, glow: HUDPalette.blue, glowRadius: 10)

            Spacer(minLength: 12)

            adherenceBadge

            HUDCloseButton { close() }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
    }

    @ViewBuilder
    private var adherenceBadge: some View {
        let tracker = RouteTracker.shared
        switch tracker.adherenceStatus {
        case .onRoute:
            HUDStatusPill(icon: "checkmark.circle.fill", text: "PÅ RUTE", color: HUDPalette.green)
        case .warning:
            HUDStatusPill(icon: "exclamationmark.triangle.fill", text: "AVVIK", color: HUDPalette.yellow)
        case .offRoute:
            HUDStatusPill(icon: "xmark.octagon.fill", text: "AV RUTE", color: HUDPalette.red)
        case .noRoute:
            EmptyView()
        }
    }

    // MARK: - Radial wheel (4 actions rundt user-pin)

    private var radialHUD: some View {
        ZStack {
            // Kompass-lag: fire mørke seksjoner + fadende ring — gjør HUD-en
            // umiddelbart lesbar som en "wheel".
            Circle()
                .strokeBorder(Color.white.opacity(0.10), lineWidth: 1)
                .frame(width: 320, height: 320)
                .shadow(color: HUDPalette.blue.opacity(0.35), radius: 30)

            // NORTH — Min rute
            HUDWheelButton(
                icon: "arrow.triangle.turn.up.right.diamond.fill",
                label: "MIN RUTE",
                color: HUDPalette.blue,
                onTap: {
                    close()
                    onOpenMyRoute()
                }
            )
            .offset(y: -125)

            // EAST — Registrer besøk
            HUDWheelButton(
                icon: "checkmark.seal.fill",
                label: "REG. BESØK",
                color: HUDPalette.green,
                isDisabled: currentCoord == nil,
                onTap: {
                    guard let coord = currentCoord else { return }
                    close()
                    onOpenVisitLog(coord)
                }
            )
            .offset(x: 125)

            // SOUTH — Ny lead
            HUDWheelButton(
                icon: "plus.circle.fill",
                label: "NY LEAD",
                color: HUDPalette.purple,
                isDisabled: currentCoord == nil,
                isBusy: creatingLead,
                onTap: { Task { await createLeadHere() } }
            )
            .offset(y: 125)

            // WEST — Team i nærheten (kun sjef+)
            if canSeeTeamNearby {
                HUDWheelButton(
                    icon: "person.3.fill",
                    label: "TEAM",
                    color: HUDPalette.orange,
                    onTap: {
                        close()
                        onOpenTeamNearby()
                    }
                )
                .offset(x: -125)
            }

            // Center-hub: mini-pin + puls-ring (indikerer "meg her")
            centerHub
        }
        .frame(width: 340, height: 340)
        .scaleEffect(appeared ? 1 : 0.85)
        .opacity(appeared ? 1 : 0)
    }

    private var centerHub: some View {
        ZStack {
            Circle()
                .fill(.ultraThinMaterial)
                .frame(width: 78, height: 78)
                .shadow(color: HUDPalette.blue.opacity(0.5), radius: 12)
            Circle()
                .strokeBorder(HUDPalette.blue.opacity(0.6), lineWidth: 1.5)
                .frame(width: 78, height: 78)
            Circle()
                .fill(HUDPalette.blue)
                .frame(width: 52, height: 52)
                .shadow(color: HUDPalette.blue, radius: 8)
            Text(appState.initials)
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
    }

    // MARK: - Helpers

    private func coordString(_ coord: CLLocationCoordinate2D) -> String {
        String(format: "%.4f, %.4f", coord.latitude, coord.longitude)
    }

    /// Reverse-geocode via KartverketService — bruker Kartverkets offisielle
    /// adresse-API i Norge, faller tilbake til Apple CLGeocoder utenfor.
    /// Setter både adresse-tekst, kommune og kilde-flagg (🇳🇴 for Kartverket).
    @MainActor
    private func resolveAddress(coord: CLLocationCoordinate2D) async {
        guard let hit = await KartverketService.shared.reverseGeocode(
            lat: coord.latitude, lon: coord.longitude, using: appState.api
        ) else { return }
        withAnimation(.easeIn(duration: 0.25)) {
            resolvedAddress = hit.formatted.isEmpty ? hit.address : hit.formatted
            resolvedMunicipality = hit.municipality
            resolvedSource = hit.source
        }
    }

    private func errorPill(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 12, weight: .bold))
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .lineLimit(2)
        }
        .foregroundStyle(HUDPalette.red)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .hudGlass(cornerRadius: 12, glow: HUDPalette.red)
        .padding(.horizontal, 24)
    }

    // MARK: - Actions

    @MainActor
    private func createLeadHere() async {
        guard let api = appState.api, let coord = currentCoord else { return }
        creatingLead = true
        errorMessage = nil
        defer { creatingLead = false }
        do {
            let dto = try await api.createLeadAtPosition(
                lat: coord.latitude,
                lon: coord.longitude,
                orgId: appState.activeOrganizationId
            )
            close()
            onLeadCreated(dto)
        } catch {
            errorMessage = "Kunne ikke opprette lead: \(error.localizedDescription)"
        }
    }
}
