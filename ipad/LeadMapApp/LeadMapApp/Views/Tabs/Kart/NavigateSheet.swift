// NavigateSheet.swift
//
// Modal som åpnes når salgssjefen tapper "Naviger" eller km-text på
// detail-panelet. Hjelper komme seg til leadens adresse:
//
//   - Kart med rute fra "min posisjon" til lead
//   - ETA per transport-modus (kjør / sykkel / gå / koll.)
//   - Velg navigasjons-app (Apple Maps / Google Maps / Waze)
//   - Start navigasjon via deep-link
//   - Alternativt: legg leaden i dagsrute / del lokasjon

import SwiftUI
import MapKit

private enum NvBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.06)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.45)
}

struct NavigateSheet: View {
    let lead: MapLeadMock
    @Environment(\.dismiss) private var dismiss
    @State private var mode: TransportMode = .driving
    @State private var navApp: NavApp = .apple

    enum TransportMode: String, CaseIterable, Hashable {
        case driving = "Bil"
        case walking = "Gange"
        case cycling = "Sykkel"
        case transit = "Koll."
        var icon: String {
            switch self {
            case .driving: return "car.fill"
            case .walking: return "figure.walk"
            case .cycling: return "bicycle"
            case .transit: return "tram.fill"
            }
        }
        var color: Color {
            switch self {
            case .driving: return NvBrand.purple
            case .walking: return NvBrand.green
            case .cycling: return NvBrand.yellow
            case .transit: return NvBrand.blue
            }
        }
        /// Mockede ETA-tall mot Nordic Elektro (0.4 km). I prod beregnes
        /// dette via MKDirections.calculate(...).
        func estimate(kmAway: Double) -> (eta: String, distance: String) {
            let dist = String(format: "%.1f km", kmAway)
            switch self {
            case .driving: return ("\(Int(kmAway * 2)) min",  dist)
            case .walking: return ("\(Int(kmAway * 12)) min", dist)
            case .cycling: return ("\(Int(kmAway * 4)) min",  dist)
            case .transit: return ("\(Int(kmAway * 5)) min",  dist)
            }
        }
    }

    enum NavApp: String, CaseIterable, Hashable {
        case apple = "Apple Maps"
        case google = "Google Maps"
        case waze = "Waze"
        var icon: String {
            switch self {
            case .apple:  return "map.fill"
            case .google: return "g.circle.fill"
            case .waze:   return "car.side.fill"
            }
        }
        var color: Color {
            switch self {
            case .apple:  return NvBrand.blue
            case .google: return NvBrand.red
            case .waze:   return NvBrand.purpleLight
            }
        }
        var subtitle: String {
            switch self {
            case .apple:  return "Native iOS · trafikk-data + sanntid"
            case .google: return "Krever Google Maps installert"
            case .waze:   return "Beste for varsler + omveier"
            }
        }
    }

    // Min posisjon (mock — sentrum Oslo)
    private let myLocation = CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    destinationCard
                    mapCard
                    transportPicker
                    navAppPicker
                    extraActions
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(NvBrand.bg.ignoresSafeArea())
            .navigationTitle("Naviger til lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(NvBrand.purpleLight)
                }
            }
            .toolbarBackground(NvBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { startNavBar }
        }
        .macCatalystSheetSize(minWidth: 780, minHeight: 660)
    }

    // MARK: Destinasjon

    private var destinationCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(lead.status.color.opacity(0.25))
                Image(systemName: "mappin.and.ellipse")
                    .font(.appScaled(size: 18, weight: .semibold))
                    .foregroundStyle(lead.status.color)
            }
            .frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 3) {
                Text(lead.name)
                    .font(.appScaled(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                Text(lead.address)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(NvBrand.textSecondary)
                let est = mode.estimate(kmAway: lead.kmAway)
                HStack(spacing: 6) {
                    Image(systemName: mode.icon)
                        .font(.appScaled(size: 10, weight: .semibold))
                    Text("\(est.eta) · \(est.distance)")
                        .font(.appScaled(size: 11, weight: .bold))
                }
                .foregroundStyle(mode.color)
            }
            Spacer()
        }
        .padding(14)
        .background(NvBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(lead.status.color.opacity(0.4), lineWidth: 1)
        )
    }

    // MARK: Kart med rute-preview

    private var mapCard: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .topLeading) {
                Map(position: .constant(.region(MKCoordinateRegion(
                    center: midpoint,
                    span: spanBetween
                ))), interactionModes: []) {
                    // Min posisjon
                    Annotation("", coordinate: myLocation) {
                        ZStack {
                            Circle().fill(NvBrand.blue.opacity(0.30))
                                .frame(width: 32, height: 32)
                            Circle().fill(NvBrand.blue)
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                                .frame(width: 16, height: 16)
                        }
                    }
                    // Lead-pin
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon)) {
                        ZStack {
                            Circle().fill(lead.status.color)
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                                .frame(width: 28, height: 28)
                                .shadow(color: lead.status.color.opacity(0.6), radius: 6, x: 0, y: 2)
                            Image(systemName: "building.2.fill")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                    // Mocket polyline rute (rett linje)
                    MapPolyline(coordinates: [
                        myLocation,
                        CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon)
                    ])
                    .stroke(
                        LinearGradient(
                            colors: [NvBrand.blue, mode.color],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [8, 6])
                    )
                }
                .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
                .mapControls { }
                .environment(\.colorScheme, .dark)
                .frame(height: 200)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                // Overlay: "Du" + "Mål"-labels
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        legendDot(color: NvBrand.blue, label: "Du")
                        legendDot(color: lead.status.color, label: "Mål")
                    }
                    Spacer()
                }
                .padding(12)
            }
        }
    }

    private var midpoint: CLLocationCoordinate2D {
        CLLocationCoordinate2D(
            latitude: (myLocation.latitude + lead.lat) / 2,
            longitude: (myLocation.longitude + lead.lon) / 2
        )
    }
    private var spanBetween: MKCoordinateSpan {
        let dLat = abs(myLocation.latitude - lead.lat) * 2.2
        let dLon = abs(myLocation.longitude - lead.lon) * 2.2
        return MKCoordinateSpan(
            latitudeDelta: max(dLat, 0.008),
            longitudeDelta: max(dLon, 0.012)
        )
    }

    private func legendDot(color: Color, label: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color)
                .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                .frame(width: 10, height: 10)
            Text(label)
                .font(.appScaled(size: 10, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(NvBrand.card.opacity(0.85), in: Capsule())
        .overlay(Capsule().stroke(NvBrand.stroke, lineWidth: 1))
    }

    // MARK: Transport-modus

    private var transportPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Transportmodus", icon: "figure.run")
            HStack(spacing: 8) {
                ForEach(TransportMode.allCases, id: \.self) { m in
                    transportChip(m)
                }
            }
        }
    }

    private func transportChip(_ m: TransportMode) -> some View {
        let isSelected = mode == m
        let est = m.estimate(kmAway: lead.kmAway)
        return Button { mode = m } label: {
            VStack(spacing: 5) {
                Image(systemName: m.icon)
                    .font(.appScaled(size: 18, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : m.color)
                Text(est.eta)
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(isSelected ? .white : .white)
                    .monospacedDigit()
                Text(m.rawValue)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(isSelected ? .white.opacity(0.85) : NvBrand.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                isSelected ? AnyShapeStyle(m.color) : AnyShapeStyle(NvBrand.card),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.clear : NvBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Nav-app-velger

    private var navAppPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Åpne i", icon: "app.fill")
            VStack(spacing: 8) {
                ForEach(NavApp.allCases, id: \.self) { app in
                    navAppRow(app)
                }
            }
        }
    }

    private func navAppRow(_ app: NavApp) -> some View {
        let isSelected = navApp == app
        return Button { navApp = app } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(app.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: app.icon)
                        .font(.appScaled(size: 16, weight: .semibold))
                        .foregroundStyle(app.color)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(app.rawValue)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(app.subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(NvBrand.textSecondary)
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.appScaled(size: 18))
                    .foregroundStyle(isSelected ? app.color : NvBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? app.color.opacity(0.10) : NvBrand.card,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? app.color.opacity(0.45) : NvBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Ekstra-actions

    private var extraActions: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Ekstra", icon: "ellipsis.circle")
            VStack(spacing: 6) {
                // «Legg til i dagsrute» fjernet 2026-07-17: var død knapp —
                // rute-planleggeren har ikke innlegg-API enda.
                ShareLink(item: URL(string: "https://maps.apple.com/?ll=\(lead.lat),\(lead.lon)&q=\(lead.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "Lead")")!) {
                    extraRowLabel(icon: "square.and.arrow.up",
                                  label: "Del lokasjon",
                                  sub: "Send til kollega via Meldinger/e-post",
                                  color: NvBrand.green)
                }
                .buttonStyle(.plain)
                extraRow(icon: "doc.on.doc",
                         label: "Kopier adresse",
                         sub: "Til utklippstavlen",
                         color: NvBrand.yellow) {
                    UIPasteboard.general.string = lead.address
                }
            }
        }
    }

    private func extraRow(icon: String, label: String, sub: String, color: Color,
                          action: @escaping () -> Void) -> some View {
        Button(action: action) {
            extraRowLabel(icon: icon, label: label, sub: sub, color: color)
        }
        .buttonStyle(.plain)
    }

    private func extraRowLabel(icon: String, label: String, sub: String, color: Color) -> some View {
        Group {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(label)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(sub)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(NvBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(NvBrand.textTertiary)
            }
            .padding(10)
            .background(NvBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(NvBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Start nav-bar

    private var startNavBar: some View {
        HStack(spacing: 10) {
            Button { dismiss() } label: {
                Text("Avbryt")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(NvBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(NvBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)

            Button { openInExternalApp() } label: {
                HStack(spacing: 8) {
                    Image(systemName: navApp.icon)
                        .font(.appScaled(size: 14, weight: .bold))
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Start navigasjon")
                            .font(.appScaled(size: 14, weight: .bold))
                        Text("i \(navApp.rawValue) · \(mode.estimate(kmAway: lead.kmAway).eta)")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(.white.opacity(0.75))
                    }
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(
                    LinearGradient(
                        colors: [navApp.color, navApp.color.opacity(0.75)],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            NvBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(NvBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    private func openInExternalApp() {
        let lat = lead.lat
        let lon = lead.lon
        let name = lead.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString: String
        let modeFlag: String  // for Apple Maps
        switch mode {
        case .driving: modeFlag = "d"
        case .walking: modeFlag = "w"
        case .cycling: modeFlag = "b"
        case .transit: modeFlag = "r"
        }
        switch navApp {
        case .apple:
            urlString = "maps://?daddr=\(lat),\(lon)&dirflg=\(modeFlag)&q=\(name)"
        case .google:
            let travelMode: String
            switch mode {
            case .driving: travelMode = "driving"
            case .walking: travelMode = "walking"
            case .cycling: travelMode = "bicycling"
            case .transit: travelMode = "transit"
            }
            urlString = "comgooglemaps://?daddr=\(lat),\(lon)&directionsmode=\(travelMode)"
        case .waze:
            urlString = "waze://?ll=\(lat),\(lon)&navigate=yes"
        }
        if let url = URL(string: urlString) {
            UIApplication.shared.open(url) { ok in
                if !ok {
                    // Fallback til Apple Maps
                    if let fb = URL(string: "maps://?daddr=\(lat),\(lon)&dirflg=\(modeFlag)") {
                        UIApplication.shared.open(fb)
                    }
                }
            }
        }
        dismiss()
    }

    private func sectionLabel(_ s: String, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(NvBrand.purpleLight)
            Text(s)
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
        }
    }
}
