// NavRoutePOI.swift
//
// POI langs nav-ruten (lading + bensin) for den EKTE Kart-nav-motoren.
// Portert fra Møter-fanens mock-`NavigationFullScreenView`, men med EKTE data:
// lokasjoner/navn hentes fra MapKit (`MKLocalPointsOfInterestRequest`), ikke
// hardkodet. Vi fabrikkerer ALDRI priser/ledige-plasser/kW — MapKit gir ikke
// live-data, så de feltene er utelatt. Detour beregnes fra ekte rute-geometri.
//
// Navnene er `Nav*`-prefikset for å ikke kollidere med Møter-mock-ens
// `POIKind`/`RoutePOI` mens begge lever (mock slettes i slice 2e).

import SwiftUI
import MapKit

// MARK: - Palett (KrBrand er privat i KartView → egen kopi her)

enum NavPOIBrand {
    static let green  = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let red    = Color(red: 0.95, green: 0.20, blue: 0.20)
    // Palett for kjøregodtgjørelse-sheeten (KrBrand/SBrand er private i sine filer).
    static let bg           = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card         = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi       = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke       = Color.white.opacity(0.06)
    static let purple       = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight  = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let blue         = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary  = Color.white.opacity(0.40)
}

// MARK: - Modell

enum NavPOIKind: String, CaseIterable, Hashable {
    case charging = "Lading"
    case gas      = "Bensin"

    var icon: String {
        switch self {
        case .charging: return "bolt.fill"
        case .gas:      return "fuelpump.fill"
        }
    }
    var tint: Color {
        switch self {
        case .charging: return NavPOIBrand.green
        case .gas:      return NavPOIBrand.orange
        }
    }
    var detourLabel: String {
        switch self {
        case .charging: return "Lading langs ruten"
        case .gas:      return "Bensinstasjoner langs ruten"
        }
    }
    /// MapKit-kategori for POI-søk.
    var poiCategory: MKPointOfInterestCategory {
        switch self {
        case .charging: return .evCharger
        case .gas:      return .gasStation
        }
    }
}

struct NavRoutePOI: Identifiable, Hashable {
    let id = UUID()
    let kind: NavPOIKind
    let name: String
    let brand: String       // avledet fra navn (Tesla, Circle K, …) — kun for farge
    let lat: Double
    let lon: Double
    let detourMin: Int      // estimert avstikker fra ruta (ekte geometri)
    let detourMeters: Double

    var coordinate: CLLocationCoordinate2D { .init(latitude: lat, longitude: lon) }

    /// Stabil identitet på tvers av re-fetch (id = UUID() regenereres per
    /// henting → avviste varsler kom tilbake etter reroute/ny henting).
    /// Navn + rundede koordinater identifiserer stasjonen.
    var stableKey: String {
        "\(kind.rawValue)|\(name)|\(Int(lat * 10_000))|\(Int(lon * 10_000))"
    }

    /// Merkefarge avledet fra navnet. Kun kosmetikk; ikke data-påstand.
    var brandColor: Color {
        let n = brand.lowercased()
        switch true {
        case n.contains("tesla"):    return Color(red: 0.90, green: 0.15, blue: 0.20)
        case n.contains("recharge"): return Color(red: 0.20, green: 0.85, blue: 0.60)
        case n.contains("fortum"):   return Color(red: 0.20, green: 0.55, blue: 0.95)
        case n.contains("mer"):      return Color(red: 0.55, green: 0.30, blue: 0.95)
        case n.contains("eviny"):    return Color(red: 0.98, green: 0.55, blue: 0.10)
        case n.contains("circle"):   return Color(red: 0.92, green: 0.30, blue: 0.10)
        case n.contains("shell"):    return Color(red: 0.98, green: 0.70, blue: 0.05)
        case n.contains("esso"):     return Color(red: 0.20, green: 0.30, blue: 0.70)
        case n.contains("uno"):      return Color(red: 0.05, green: 0.45, blue: 0.85)
        case n.contains("yx"):       return Color(red: 0.85, green: 0.15, blue: 0.20)
        default:                     return kind.tint
        }
    }
}

// MARK: - Tjeneste (ekte MKLocalSearch POI-søk langs ruta)

@MainActor
final class NavRoutePOIService {
    static let shared = NavRoutePOIService()

    /// Finn ekte lade-/bensin-POI langs en rute. Søker POI innen en radius som
    /// dekker ruta, filtrerer bort de som ligger lenger enn `maxDetourM` fra
    /// selve ruta, og beregner detour fra geometrien. Returnerer maks `cap` per
    /// type, sortert etter minst avstikker.
    func fetchAlongRoute(_ route: [CLLocationCoordinate2D],
                         kinds: Set<NavPOIKind>,
                         maxDetourM: Double = 1200,
                         cap: Int = 6) async -> [NavRoutePOI] {
        guard route.count >= 2, !kinds.isEmpty else { return [] }

        // Rute-bbox → senter + radius som dekker hele ruta (MapKit-cap 50 km).
        let lats = route.map(\.latitude), lons = route.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(),
              let minLon = lons.min(), let maxLon = lons.max() else { return [] }
        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2,
                                            longitude: (minLon + maxLon) / 2)
        let spanM = Self.haversine(CLLocationCoordinate2D(latitude: minLat, longitude: minLon),
                                   CLLocationCoordinate2D(latitude: maxLat, longitude: maxLon))
        let radius = min(50_000, max(1_500, spanM / 2 + maxDetourM))

        var out: [NavRoutePOI] = []
        for kind in kinds {
            let req = MKLocalPointsOfInterestRequest(center: center, radius: radius)
            req.pointOfInterestFilter = MKPointOfInterestFilter(including: [kind.poiCategory])
            guard let resp = try? await MKLocalSearch(request: req).start() else { continue }
            var perKind: [NavRoutePOI] = []
            for item in resp.mapItems {
                let c = item.placemark.coordinate
                guard CLLocationCoordinate2DIsValid(c) else { continue }
                let detM = Self.nearestDistanceToRoute(c, route: route)
                guard detM <= maxDetourM else { continue }
                let name = item.name ?? kind.rawValue
                perKind.append(NavRoutePOI(
                    kind: kind, name: name, brand: name,
                    lat: c.latitude, lon: c.longitude,
                    // ~15 km/t avstikker tur/retur → detour-minutter fra meter.
                    detourMin: max(1, Int((detM * 2) / 250)),
                    detourMeters: detM))
            }
            perKind.sort { $0.detourMeters < $1.detourMeters }
            out.append(contentsOf: perKind.prefix(cap))
        }
        return out
    }

    // MARK: geometri

    /// Minste avstand (m) fra et punkt til rute-polylinjen (segment-for-segment).
    static func nearestDistanceToRoute(_ p: CLLocationCoordinate2D,
                                       route: [CLLocationCoordinate2D]) -> Double {
        guard route.count >= 2 else {
            return route.first.map { haversine(p, $0) } ?? .greatestFiniteMagnitude
        }
        var best = Double.greatestFiniteMagnitude
        for i in 0..<(route.count - 1) {
            best = min(best, distanceToSegment(p, a: route[i], b: route[i + 1]))
        }
        return best
    }

    /// Punkt-til-segment-avstand i meter via equirectangular-projeksjon (lokal,
    /// god nok på by-skala).
    static func distanceToSegment(_ p: CLLocationCoordinate2D,
                                  a: CLLocationCoordinate2D,
                                  b: CLLocationCoordinate2D) -> Double {
        let R = 6_371_000.0
        let lat0 = a.latitude * .pi / 180
        func xy(_ c: CLLocationCoordinate2D) -> (Double, Double) {
            let x = (c.longitude - a.longitude) * .pi / 180 * cos(lat0) * R
            let y = (c.latitude - a.latitude) * .pi / 180 * R
            return (x, y)
        }
        let (px, py) = xy(p)
        let (bx, by) = xy(b)
        let segLen2 = bx * bx + by * by
        if segLen2 < 1e-6 { return sqrt(px * px + py * py) }
        var t = (px * bx + py * by) / segLen2
        t = max(0, min(1, t))
        let cx = t * bx, cy = t * by
        return sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy))
    }

    static func haversine(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let R = 6_371_000.0
        let dLat = (b.latitude - a.latitude) * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let lat1 = a.latitude * .pi / 180, lat2 = b.latitude * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * R * atan2(sqrt(h), sqrt(1 - h))
    }
}

// MARK: - Pin (merkefarget POI-markør + detour-badge)

struct NavPOIPin: View {
    let poi: NavRoutePOI
    let isSelected: Bool

    var body: some View {
        ZStack {
            if isSelected {
                Circle().fill(poi.brandColor.opacity(0.30)).frame(width: 58, height: 58)
            }
            RoundedRectangle(cornerRadius: 9)
                .fill(poi.brandColor)
                .frame(width: isSelected ? 40 : 32, height: isSelected ? 40 : 32)
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(.white, lineWidth: 2.5))
                .shadow(color: .black.opacity(0.5), radius: 4, y: 2)
            Image(systemName: poi.kind.icon)
                .font(.system(size: isSelected ? 17 : 14, weight: .black))
                .foregroundStyle(.white)
            // Detour-badge (ekte geometri) under pin-en.
            Text("+\(poi.detourMin) min")
                .font(.system(size: 8, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .padding(.horizontal, 4).padding(.vertical, 1)
                .background(poi.brandColor, in: Capsule())
                .overlay(Capsule().stroke(.white, lineWidth: 1))
                .offset(y: 24)
        }
    }
}

// MARK: - Detalj-kort (ærlig: navn, avstikker, åpne i kart — ingen falske priser)

struct NavPOIDetailCard: View {
    let poi: NavRoutePOI
    var onClose: () -> Void
    var onOpenInMaps: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 11).fill(poi.brandColor)
                Image(systemName: poi.kind.icon)
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 3) {
                Text(poi.name)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Label(poi.kind.rawValue, systemImage: poi.kind.icon)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(poi.kind.tint)
                    Text("· +\(poi.detourMin) min avstikker")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.62))
                        .monospacedDigit()
                }
            }
            Spacer()
            Button(action: onOpenInMaps) {
                Text("Åpne")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 13).padding(.vertical, 8)
                    .background(poi.brandColor, in: Capsule())
            }
            .buttonStyle(.plain)
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white.opacity(0.62))
                    .padding(8)
            }
            .buttonStyle(.plain)
        }
        .padding(11)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(poi.brandColor.opacity(0.45), lineWidth: 1))
        )
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }
}

// MARK: - Kjøregodtgjørelse (statens sats 2026) — portert fra Møter, ekte km

struct NavMileageSheet: View {
    let leadName: String
    let address: String
    let distanceKm: Int
    /// Ekte bom-takst per vei (NVDB, liten bil) hvis vi fant bom på ruta. nil → estimat.
    let realTollPerTrip: Double?
    let realTollCount: Int
    /// True hvis «Min bil» er el (elbil har ofte bom-rabatt — varierer per ring).
    let isElectric: Bool
    /// Kalles med total-beløpet når brukeren logger (wires til kostnad→besøk, #73).
    var onLog: (Double) -> Void = { _ in }

    /// Forhåndsvelg kjøretøy fra «Min bil»-profilen (el→el-sats automatisk).
    init(leadName: String, address: String, distanceKm: Int,
         profile: VehicleProfile? = nil, realTollPerTrip: Double? = nil, realTollCount: Int = 0,
         onLog: @escaping (Double) -> Void = { _ in }) {
        self.leadName = leadName
        self.address = address
        self.distanceKm = distanceKm
        self.realTollPerTrip = realTollPerTrip
        self.realTollCount = realTollCount
        self.isElectric = profile?.fuel.isElectric ?? false
        self.onLog = onLog
        _vehicleType = State(initialValue: VehicleType.from(profile))
    }

    @Environment(\.dismiss) private var dismiss
    @State private var vehicleType: VehicleType
    @State private var passengers: Int = 0
    @State private var towing: Bool = false
    @State private var includeToll: Bool = true
    @State private var returnTrip: Bool = true
    @State private var notes: String = ""

    enum VehicleType: String, CaseIterable, Hashable {
        case car = "Personbil", ev = "El-bil", motorcycle = "Motorsykkel", moped = "Moped"
        var icon: String {
            switch self {
            case .car:        return "car.fill"
            case .ev:         return "bolt.car.fill"
            case .motorcycle: return "scooter"
            case .moped:      return "scooter"
            }
        }
        // Statens sats 2026 (skattefri) — forenklet.
        var baseRate: Double {
            switch self {
            case .car:        return 3.50
            case .ev:         return 3.60   // 3.50 + 0.10 el-tillegg
            case .motorcycle: return 2.95
            case .moped:      return 1.80
            }
        }
        /// Avled forhåndsvalg fra «Min bil»-profilen.
        static func from(_ p: VehicleProfile?) -> VehicleType {
            guard let p else { return .car }
            switch p.kind {
            case .motorcycle: return .motorcycle
            case .moped:      return .moped
            case .car:        return p.fuel.isElectric ? .ev : .car
            }
        }
    }

    private var totalKm: Int { returnTrip ? distanceKm * 2 : distanceKm }
    private var baseAmount: Double { Double(totalKm) * vehicleType.baseRate }
    private var passengerAmount: Double { Double(totalKm) * 1.00 * Double(passengers) }
    private var towingAmount: Double { towing ? Double(totalKm) * 1.00 : 0 }
    /// Bom per vei: ekte NVDB-takst hvis funnet, ellers ~55 kr-estimat.
    private var tollPerTrip: Double { realTollPerTrip ?? 55.0 }
    private var tollAmount: Double { includeToll ? Double(returnTrip ? 2 : 1) * tollPerTrip : 0 }
    private var tollIsReal: Bool { realTollPerTrip != nil }
    private var totalAmount: Double { baseAmount + passengerAmount + towingAmount + tollAmount }

    private var todayLabel: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "EEEE d. MMMM yyyy"
        return f.string(from: Date()).capitalized
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    tripCard
                    vehiclePicker
                    optionsCard
                    breakdownCard
                    totalCard
                    notesCard
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(NavPOIBrand.bg.ignoresSafeArea())
            .navigationTitle("Kjøregodtgjørelse")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(NavPOIBrand.purpleLight)
                }
            }
            .toolbarBackground(NavPOIBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { actionBar }
        }
    }

    private var tripCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(NavPOIBrand.purple.opacity(0.22))
                    Image(systemName: "location.fill").font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(NavPOIBrand.purpleLight)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(todayLabel).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    Text("Reise: \(leadName)").font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary)
                }
                Spacer()
            }
            HStack(spacing: 14) {
                tripLeg(icon: "location.circle.fill", color: NavPOIBrand.blue, title: "Fra", subtitle: "Din posisjon")
                Image(systemName: "arrow.right").font(.appScaled(size: 11, weight: .bold)).foregroundStyle(NavPOIBrand.textTertiary)
                tripLeg(icon: "mappin.circle.fill", color: NavPOIBrand.purpleLight, title: "Til", subtitle: address.isEmpty ? leadName : address)
            }
            HStack(spacing: 14) {
                Label("\(distanceKm) km enveis", systemImage: "ruler.fill")
                    .font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(NavPOIBrand.textSecondary)
                Spacer()
                Toggle(isOn: $returnTrip) {
                    Text("Inkluder retur").font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white)
                }
                .tint(NavPOIBrand.purple).frame(maxWidth: 170)
            }
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    private func tripLeg(icon: String, color: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.appScaled(size: 14, weight: .bold)).foregroundStyle(color)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.appScaled(size: 9, weight: .semibold)).foregroundStyle(NavPOIBrand.textTertiary).textCase(.uppercase)
                Text(subtitle).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var vehiclePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kjøretøy").font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(NavPOIBrand.textSecondary)
            HStack(spacing: 8) {
                ForEach(VehicleType.allCases, id: \.self) { v in
                    Button { withAnimation(.easeInOut(duration: 0.18)) { vehicleType = v } } label: {
                        VStack(spacing: 6) {
                            Image(systemName: v.icon).font(.appScaled(size: 17, weight: .semibold))
                                .foregroundStyle(vehicleType == v ? .white : NavPOIBrand.purpleLight)
                            Text(v.rawValue).font(.appScaled(size: 10, weight: .bold))
                                .foregroundStyle(vehicleType == v ? .white : .white.opacity(0.85))
                            Text(String(format: "%.2f kr/km", v.baseRate))
                                .font(.appScaled(size: 9, weight: .semibold, design: .rounded))
                                .foregroundStyle(vehicleType == v ? .white.opacity(0.85) : NavPOIBrand.textSecondary).monospacedDigit()
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 11)
                        .background(vehicleType == v ? AnyShapeStyle(NavPOIBrand.purple) : AnyShapeStyle(NavPOIBrand.card),
                                    in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(vehicleType == v ? Color.clear : NavPOIBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var optionsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 6) {
                    Image(systemName: "person.2.fill").font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.purpleLight)
                    Text("Passasjerer").font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                    Spacer()
                    Text("+1,00 kr/km per passasjer").font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
                }
                HStack(spacing: 6) {
                    ForEach(0...3, id: \.self) { n in
                        Button { withAnimation(.easeInOut(duration: 0.15)) { passengers = n } } label: {
                            Text("\(n)").font(.appScaled(size: 13, weight: .bold, design: .rounded))
                                .foregroundStyle(passengers == n ? .white : .white.opacity(0.8))
                                .frame(maxWidth: .infinity).padding(.vertical, 10)
                                .background(passengers == n ? AnyShapeStyle(NavPOIBrand.purple) : AnyShapeStyle(NavPOIBrand.cardHi),
                                            in: RoundedRectangle(cornerRadius: 9))
                                .overlay(RoundedRectangle(cornerRadius: 9).stroke(passengers == n ? Color.clear : NavPOIBrand.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            Divider().overlay(NavPOIBrand.stroke)
            Toggle(isOn: $towing) {
                HStack(spacing: 6) {
                    Image(systemName: "truck.box.fill").font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.purpleLight)
                    Text("Tilhenger / utstyr").font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                    Spacer()
                    Text("+1,00 kr/km").font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
                }
            }
            .tint(NavPOIBrand.purple)
            Toggle(isOn: $includeToll) {
                HStack(spacing: 6) {
                    Image(systemName: "road.lanes").font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.purpleLight)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(tollIsReal ? "Bompenger (\(realTollCount) bom · NVDB)" : "Bompenger (estimat)")
                            .font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                        if isElectric && tollIsReal {
                            Text("Elbil har ofte rabatt — varierer per bomring").font(.appScaled(size: 9)).foregroundStyle(NavPOIBrand.green)
                        }
                    }
                    Spacer()
                    Text(tollIsReal ? "\(Int(tollPerTrip.rounded())) kr / vei" : "~55 kr / vei")
                        .font(.appScaled(size: 10)).foregroundStyle(tollIsReal ? NavPOIBrand.green : NavPOIBrand.textSecondary)
                }
            }
            .tint(NavPOIBrand.purple)
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    private var breakdownCard: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Beregning").font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                Spacer()
                Text("Statens sats 2026").font(.appScaled(size: 9, weight: .semibold)).foregroundStyle(NavPOIBrand.green)
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(NavPOIBrand.green.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(NavPOIBrand.green.opacity(0.4), lineWidth: 1))
            }
            .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 10)
            Divider().overlay(NavPOIBrand.stroke)
            VStack(spacing: 0) {
                breakdownRow(label: "Grunn-sats", detail: "\(totalKm) km × \(String(format: "%.2f", vehicleType.baseRate))", value: baseAmount)
                if passengers > 0 { breakdownRow(label: "Passasjer-tillegg", detail: "\(totalKm) km × 1,00 × \(passengers)", value: passengerAmount) }
                if towing { breakdownRow(label: "Tilhenger", detail: "\(totalKm) km × 1,00", value: towingAmount) }
                if includeToll {
                    breakdownRow(
                        label: tollIsReal ? "Bompenger (NVDB)" : "Bompenger (estimat)",
                        detail: tollIsReal
                            ? "\(returnTrip ? 2 : 1) vei × \(String(format: "%.0f", tollPerTrip)) kr (\(realTollCount) bom)"
                            : "\(returnTrip ? 2 : 1) vei × 55,00",
                        value: tollAmount)
                }
            }
        }
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    private func breakdownRow(label: String, detail: String, value: Double) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                Text(detail).font(.appScaled(size: 10, design: .monospaced)).foregroundStyle(NavPOIBrand.textSecondary)
            }
            Spacer()
            Text(String(format: "%.2f kr", value)).font(.appScaled(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .overlay(Divider().overlay(NavPOIBrand.stroke), alignment: .bottom)
    }

    private var totalCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("Total kjøregodtgjørelse").font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                Text("Skattefri etter statens sats").font(.appScaled(size: 9)).foregroundStyle(.white.opacity(0.65))
            }
            Spacer()
            Text(String(format: "%.2f kr", totalAmount)).font(.appScaled(size: 26, weight: .black, design: .rounded))
                .foregroundStyle(.white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        }
        .padding(16)
        .background(LinearGradient(colors: [NavPOIBrand.purple, NavPOIBrand.purpleLight],
                                   startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: NavPOIBrand.purple.opacity(0.5), radius: 14, y: 6)
    }

    private var notesCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Notat (valgfritt)").font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(NavPOIBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $notes)
                    .scrollContentBackground(.hidden).foregroundStyle(.white).font(.appScaled(size: 12))
                    .frame(minHeight: 70).padding(8)
                    .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(NavPOIBrand.stroke, lineWidth: 1))
                if notes.isEmpty {
                    Text("F.eks. møte-formål, ekstra omveier…").font(.appScaled(size: 12))
                        .foregroundStyle(NavPOIBrand.textTertiary).padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var actionBar: some View {
        Button { onLog(totalAmount); dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill").font(.appScaled(size: 13, weight: .bold))
                Text("Logg \(String(format: "%.0f kr", totalAmount))").font(.appScaled(size: 13, weight: .bold))
            }
            .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 13)
            .background(LinearGradient(colors: [NavPOIBrand.green, Color(red: 0.10, green: 0.65, blue: 0.45)],
                                       startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: 11))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(NavPOIBrand.bg.opacity(0.95).overlay(Rectangle().fill(NavPOIBrand.stroke).frame(height: 1), alignment: .top))
    }
}
