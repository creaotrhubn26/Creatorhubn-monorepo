// NearbyTeamView.swift
//
// Floating Team-HUD (redesign 2026-07-02).
//
//   • Top-strip:  Radius-selector + antall medlemmer + LIVE-indikator
//   • Kart:       fullscreen med glow-team-pins + radius-ring
//   • Bottom:     horizontal card-carousel av team-medlemmer
//                 (200pt wide, blurred, mini-CTAs)

import SwiftUI
import MapKit

struct NearbyTeamView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var members: [NearbyTeamMemberDTO] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var radiusKm: Double = 5.0
    @State private var camera: MapCameraPosition = .automatic
    @State private var selectedMemberId: String?

    var body: some View {
        ZStack {
            mapBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                topStrip
                    .padding(.top, 12)
                    .padding(.horizontal, 20)

                Spacer()

                if loading {
                    loadingHUD
                        .padding(.bottom, 40)
                } else if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(HUDPalette.red)
                        .padding(12)
                        .hudGlass(cornerRadius: 12, glow: HUDPalette.red)
                        .padding(.bottom, 40)
                } else if members.isEmpty {
                    emptyHUD
                        .padding(.bottom, 40)
                } else {
                    carousel
                        .padding(.bottom, 20)
                }
            }
            // Fix 2026-07-02: X-close-knappen var et separat flytende ZStack-
            // lag på høyre side og overlappet Refresh-knappen + telle-badge
            // i topStrip. Nå bor X inne i topStrip HStack — én ren pill.
        }
        .presentationBackground(.clear)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .task { await refresh() }
    }

    // MARK: - Map background

    private var mapBackground: some View {
        Map(position: $camera, interactionModes: [.pan, .zoom]) {
            if let coord = KartLocationManager.shared.currentCoordinate {
                Annotation("Meg", coordinate: coord) {
                    MeMapPin(initials: appState.initials, email: appState.userEmail)
                }
                MapCircle(center: coord, radius: radiusKm * 1000)
                    .foregroundStyle(HUDPalette.blue.opacity(0.10))
                    .stroke(HUDPalette.blue.opacity(0.55),
                            style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
            }
            ForEach(members) { m in
                Annotation("", coordinate: m.coordinate) {
                    memberPin(m)
                }
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
        .onAppear { fitCamera() }
    }

    private func memberPin(_ m: NearbyTeamMemberDTO) -> some View {
        let isSelected = selectedMemberId == m.userId
        let color: Color = m.status == "moving" ? HUDPalette.green : HUDPalette.orange
        return Button {
            selectedMemberId = isSelected ? nil : m.userId
            camera = .region(MKCoordinateRegion(
                center: m.coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
            ))
        } label: {
            VStack(spacing: 2) {
                ZStack {
                    if isSelected {
                        Circle()
                            .strokeBorder(color.opacity(0.6), lineWidth: 2)
                            .frame(width: 54, height: 54)
                            .shadow(color: color, radius: 8)
                    }
                    Circle()
                        .fill(color)
                        .frame(width: isSelected ? 42 : 34, height: isSelected ? 42 : 34)
                        .overlay(Circle().strokeBorder(.white, lineWidth: 2))
                        .shadow(color: color.opacity(0.8), radius: 6)
                    Text(String(m.name.prefix(2)).uppercased())
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                if isSelected {
                    Text(m.name)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(.ultraThinMaterial, in: Capsule())
                        .overlay(Capsule().strokeBorder(color.opacity(0.6), lineWidth: 1))
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Top strip

    private var topStrip: some View {
        // Kompakt HStack: kort tittel + segmented KM-picker + telle-badge +
        // refresh + close. Passer inn i smale Mac Catalyst-sheets (~500px)
        // uten at pills stabler seg vertikalt.
        HStack(spacing: 8) {
            HStack(spacing: 5) {
                HUDLiveDot(color: HUDPalette.green, size: 6)
                HUDLabel(text: "TEAM", size: 11, color: HUDPalette.green, tracking: 1.3)
            }
            .fixedSize()
            Spacer(minLength: 6)
            radiusPickerSegmented
            memberCountBadge
            HUDRefreshButton { Task { await refresh() } }
            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(width: 1, height: 20)
                .padding(.horizontal, 1)
            HUDCloseButton { dismiss() }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .hudGlass(cornerRadius: 18, glow: HUDPalette.blue, glowRadius: 8)
    }

    /// Kompakt segmented KM-picker. Alle 4 knapper på én rad m/ minimal padding
    /// så vi ikke wrapper når sheeten er smal (Mac Catalyst).
    private var radiusPickerSegmented: some View {
        HStack(spacing: 3) {
            ForEach([2.0, 5.0, 10.0, 25.0], id: \.self) { r in
                radiusChip(r)
            }
        }
        .padding(3)
        .background(Color.white.opacity(0.06), in: Capsule())
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.12), lineWidth: 1))
    }

    private func radiusChip(_ r: Double) -> some View {
        let isActive = radiusKm == r
        return Button {
            radiusKm = r
            Task { await refresh() }
        } label: {
            Text("\(Int(r))")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(isActive ? .white : HUDPalette.textDim)
                .frame(minWidth: 22)
                .padding(.horizontal, 6)
                .padding(.vertical, 4)
                .background(
                    isActive ? HUDPalette.blue.opacity(0.55) : Color.clear,
                    in: Capsule()
                )
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private var titleBadge: some View {
        HStack(spacing: 6) {
            HUDLiveDot(color: HUDPalette.green, size: 6)
            HUDLabel(text: "TEAM I NÆRHETEN", size: 11, color: HUDPalette.green, tracking: 1.3)
        }
    }

    private var radiusPicker: some View {
        HStack(spacing: 6) {
            ForEach([2.0, 5.0, 10.0, 25.0], id: \.self) { r in
                radiusPickerButton(r)
            }
        }
    }

    private func radiusPickerButton(_ r: Double) -> some View {
        let isActive = radiusKm == r
        let bg: Color = isActive ? HUDPalette.blue.opacity(0.35) : Color.white.opacity(0.05)
        let strokeColor: Color = isActive ? HUDPalette.blue.opacity(0.7) : Color.white.opacity(0.15)
        return Button {
            radiusKm = r
            Task { await refresh() }
        } label: {
            Text("\(Int(r)) KM")
                .font(HUDFont.label(10))
                .tracking(1.1)
                .foregroundStyle(isActive ? Color.white : HUDPalette.textDim)
                .padding(.horizontal, 9)
                .padding(.vertical, 5)
                .background(bg, in: Capsule())
                .overlay(Capsule().strokeBorder(strokeColor, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private var memberCountBadge: some View {
        Text("\(members.count)")
            .font(HUDFont.metric(18))
            .foregroundStyle(HUDPalette.blue)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(HUDPalette.blue.opacity(0.15), in: Capsule())
            .overlay(Capsule().strokeBorder(HUDPalette.blue.opacity(0.55), lineWidth: 1))
    }

    // MARK: - Carousel (bottom)

    private var carousel: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(members) { m in
                    memberCard(m)
                        .frame(width: 220)
                }
            }
            .padding(.horizontal, 20)
        }
        .frame(height: 148)
        .scrollBounceBehavior(.basedOnSize)
    }

    private func memberCard(_ m: NearbyTeamMemberDTO) -> some View {
        let color: Color = m.status == "moving" ? HUDPalette.green : HUDPalette.orange
        let isSelected = selectedMemberId == m.userId
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(color.opacity(0.25))
                    Circle().strokeBorder(color.opacity(0.65), lineWidth: 1.5)
                    Text(String(m.name.prefix(2)).uppercased())
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                .frame(width: 36, height: 36)
                .shadow(color: color.opacity(0.5), radius: 5)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(m.name)
                            .font(HUDFont.title(13))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        HUDLiveDot(color: color, size: 5)
                    }
                    Text(m.role ?? "Selger")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(HUDPalette.textDim)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }

            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 1) {
                    HUDLabel(text: "AVSTAND", size: 9, tracking: 1.0)
                    Text(distanceText(m.distanceM))
                        .font(HUDFont.metric(15))
                        .foregroundStyle(HUDPalette.blue)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    HUDLabel(text: "SIST SETT", size: 9, tracking: 1.0)
                    Text(m.lastSeenAt.map(shortAgo) ?? "—")
                        .font(HUDFont.metric(13))
                        .foregroundStyle(HUDPalette.textDim)
                }
            }

            HStack(spacing: 6) {
                miniAction(icon: "phone.fill", color: HUDPalette.green) {
                    if let email = m.email, let url = URL(string: "tel://\(email)") {
                        openURL(url)
                    }
                }
                miniAction(icon: "message.fill", color: HUDPalette.blue) {
                    if let email = m.email, let url = URL(string: "mailto:\(email)") {
                        openURL(url)
                    }
                }
                miniAction(icon: "location.north.fill", color: HUDPalette.orange) {
                    let item = MKMapItem(placemark: MKPlacemark(coordinate: m.coordinate))
                    item.name = m.name
                    item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
                }
                Spacer(minLength: 0)
            }
        }
        .padding(12)
        .hudGlass(
            cornerRadius: 16,
            glow: color.opacity(isSelected ? 0.9 : 0.4),
            glowRadius: isSelected ? 14 : 8
        )
        .scaleEffect(isSelected ? 1.02 : 1.0)
        .animation(.spring(response: 0.35, dampingFraction: 0.75), value: isSelected)
        .onTapGesture {
            selectedMemberId = isSelected ? nil : m.userId
            camera = .region(MKCoordinateRegion(
                center: m.coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
            ))
        }
    }

    private func miniAction(icon: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle().fill(color.opacity(0.2))
                Circle().strokeBorder(color.opacity(0.6), lineWidth: 1)
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 30, height: 30)
            .shadow(color: color.opacity(0.4), radius: 4)
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    // MARK: - Loading / Empty HUDs

    private var loadingHUD: some View {
        HStack(spacing: 10) {
            ProgressView().tint(HUDPalette.blue)
            Text("Skanner team…")
                .font(HUDFont.label(11))
                .tracking(1.2)
                .foregroundStyle(HUDPalette.textDim)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .hudGlass(cornerRadius: 14, glow: HUDPalette.blue)
    }

    private var emptyHUD: some View {
        VStack(spacing: 8) {
            Image(systemName: "person.3.sequence")
                .font(.system(size: 30))
                .foregroundStyle(HUDPalette.textDim)
            Text("INGEN INNENFOR \(Int(radiusKm)) KM")
                .font(HUDFont.label(12))
                .tracking(1.3)
                .foregroundStyle(.white)
            Text("Prøv større radius eller vent på team-oppdatering.")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(HUDPalette.textDim)
                .multilineTextAlignment(.center)
        }
        .padding(20)
        .frame(maxWidth: 320)
        .hudGlass(cornerRadius: 18, glow: HUDPalette.blue)
    }

    // MARK: - Helpers

    private func distanceText(_ meters: Int) -> String {
        if meters >= 1000 {
            let km = Double(meters) / 1000
            return String(format: "%.1f km", km)
        }
        return "\(meters) m"
    }

    private func shortAgo(_ iso: String) -> String {
        let comps = iso.split(separator: " ")
        guard comps.count >= 2 else { return "" }
        return String(comps[1].prefix(5))
    }

    private func fitCamera() {
        var coords: [CLLocationCoordinate2D] = members.map(\.coordinate)
        if let mine = KartLocationManager.shared.currentCoordinate {
            coords.append(mine)
        }
        guard coords.count >= 2 else {
            if let coord = KartLocationManager.shared.currentCoordinate {
                camera = .region(MKCoordinateRegion(
                    center: coord,
                    span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
                ))
            }
            return
        }
        let lats = coords.map(\.latitude)
        let lons = coords.map(\.longitude)
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: (lats.min()! + lats.max()!) / 2,
                longitude: (lons.min()! + lons.max()!) / 2
            ),
            span: MKCoordinateSpan(
                latitudeDelta: max(0.02, (lats.max()! - lats.min()!) * 1.4),
                longitudeDelta: max(0.02, (lons.max()! - lons.min()!) * 1.4)
            )
        )
        camera = .region(region)
    }

    @MainActor
    private func refresh() async {
        loading = true
        errorMessage = nil
        defer { loading = false }
        guard let api = appState.api,
              let coord = KartLocationManager.shared.currentCoordinate else {
            errorMessage = "Trenger posisjon for å søke i nærheten."
            return
        }
        do {
            let list = try await api.fetchTeamNearby(
                lat: coord.latitude, lon: coord.longitude,
                radiusKm: radiusKm
            )
            members = list
            fitCamera()
        } catch {
            errorMessage = "Kunne ikke hente team-data: \(error.localizedDescription)"
        }
    }
}
