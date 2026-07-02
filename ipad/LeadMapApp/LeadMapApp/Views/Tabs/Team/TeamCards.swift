// TeamCards.swift
//
// De 4 hovedkortene i Team-fanen:
//   - TeamPerformanceCard  (tabell over 5 medlemmer m/ leads/møter/verdi/momentum)
//   - TeamAreasCard        (MapKit-kart m/ 4 fargede territorier)
//   - ActivityCard         (5 sanntid-events m/ avatar + tidsstempel)
//   - TeamPipelineCard     (5-trinn funnel + konverterings-tabell)
//   - InviteMemberSheet    (modal)

import SwiftUI
import MapKit
import UIKit

// MARK: - DarkMKMapView (UIViewRepresentable)
//
// SwiftUI Map() følger system-color-scheme — kan ikke tvinges mørk.
// Eneste måten å få ekte mørkt Apple-vei-kart er via MKMapView m/
// overrideUserInterfaceStyle = .dark + MKPolygon-overlays + label-annotations.

struct DarkMKMapView: UIViewRepresentable {
    let region: MKCoordinateRegion
    let territories: [GeoJSONTerritory]
    let onSelectTerritory: (GeoJSONTerritory) -> Void

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.overrideUserInterfaceStyle = .dark           // ← tvinger dark map
        map.pointOfInterestFilter = .excludingAll
        map.showsCompass = false
        map.showsScale = false
        map.showsBuildings = false
        map.isPitchEnabled = false
        map.delegate = context.coordinator
        map.setRegion(region, animated: false)

        // Standard dark veikart (overrideUserInterfaceStyle = .dark) + muted emphasis
        let conf = MKStandardMapConfiguration(elevationStyle: .flat, emphasisStyle: .muted)
        conf.pointOfInterestFilter = .excludingAll
        conf.showsTraffic = false
        map.preferredConfiguration = conf

        // Tap-gesture for å hit-teste polygoner
        let tap = UITapGestureRecognizer(target: context.coordinator,
                                         action: #selector(Coordinator.handleTap(_:)))
        tap.delegate = context.coordinator
        map.addGestureRecognizer(tap)
        context.coordinator.mapView = map

        addOverlaysAndAnnotations(to: map, context: context)
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.territories = territories
        context.coordinator.onSelectTerritory = onSelectTerritory
        map.removeOverlays(map.overlays)
        map.removeAnnotations(map.annotations)
        addOverlaysAndAnnotations(to: map, context: context)
    }

    private func addOverlaysAndAnnotations(to map: MKMapView, context: Context) {
        for (idx, t) in territories.enumerated() {
            t.polygon.title = String(idx)
            map.addOverlay(t.polygon, level: .aboveRoads)
            let ann = TerritoryAnnotation(territory: t, index: idx)
            map.addAnnotation(ann)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(territories: territories, onSelectTerritory: onSelectTerritory)
    }

    final class Coordinator: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
        var territories: [GeoJSONTerritory]
        var onSelectTerritory: (GeoJSONTerritory) -> Void
        weak var mapView: MKMapView?
        init(territories: [GeoJSONTerritory], onSelectTerritory: @escaping (GeoJSONTerritory) -> Void) {
            self.territories = territories
            self.onSelectTerritory = onSelectTerritory
        }

        // Ikke fange opp pan/zoom-gester
        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                                shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let map = mapView else { return }
            let point = gesture.location(in: map)
            let coord = map.convert(point, toCoordinateFrom: map)
            // Ray-casting hit-test mot hver polygon
            for t in territories where polygonContains(t.polygon, coordinate: coord) {
                onSelectTerritory(t)
                return
            }
        }

        // Standard ray-casting polygon-i-punkt-test, basert på MKMapPoints
        private func polygonContains(_ polygon: MKPolygon, coordinate: CLLocationCoordinate2D) -> Bool {
            let count = polygon.pointCount
            guard count > 2 else { return false }
            let pts = UnsafeBufferPointer(start: polygon.points(), count: count)
            let mp = MKMapPoint(coordinate)
            var inside = false
            var j = count - 1
            for i in 0..<count {
                let pi = pts[i]
                let pj = pts[j]
                if ((pi.y > mp.y) != (pj.y > mp.y)) &&
                   (mp.x < (pj.x - pi.x) * (mp.y - pi.y) / (pj.y - pi.y) + pi.x) {
                    inside.toggle()
                }
                j = i
            }
            return inside
        }

        // Polygon-render
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let poly = overlay as? MKPolygon,
               let idxStr = poly.title, let idx = Int(idxStr),
               idx < territories.count {
                let t = territories[idx]
                let r = MKPolygonRenderer(polygon: poly)
                r.fillColor = t.color.withAlphaComponent(0.55)
                r.strokeColor = t.color
                r.lineWidth = 3
                r.lineJoin = .round
                return r
            }
            return MKOverlayRenderer(overlay: overlay)
        }

        // Annotation-view (label-card sentrert på territoriet)
        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let ann = annotation as? TerritoryAnnotation else { return nil }
            let id = "TerritoryLabel"
            let view = (mapView.dequeueReusableAnnotationView(withIdentifier: id) as? TerritoryLabelView)
                ?? TerritoryLabelView(annotation: ann, reuseIdentifier: id)
            view.configure(with: ann.territory)
            return view
        }
    }
}

final class TerritoryAnnotation: NSObject, MKAnnotation {
    let territory: GeoJSONTerritory
    let index: Int
    init(territory: GeoJSONTerritory, index: Int) {
        self.territory = territory
        self.index = index
    }
    var coordinate: CLLocationCoordinate2D { territory.center }
    var title: String? { territory.memberName }
}

final class TerritoryLabelView: MKAnnotationView {
    private let nameLabel = UILabel()
    private let areaLabel = UILabel()
    private let card = UIStackView()

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setupUI()
    }

    required init?(coder aDecoder: NSCoder) { fatalError() }

    private func setupUI() {
        backgroundColor = .clear
        canShowCallout = false

        nameLabel.font = .systemFont(ofSize: 13, weight: .black)
        nameLabel.textColor = .white
        nameLabel.textAlignment = .center

        areaLabel.font = .systemFont(ofSize: 10, weight: .semibold)
        areaLabel.textColor = UIColor.white.withAlphaComponent(0.92)
        areaLabel.textAlignment = .center

        card.axis = .vertical
        card.spacing = 1
        card.alignment = .center
        card.isLayoutMarginsRelativeArrangement = true
        card.layoutMargins = UIEdgeInsets(top: 5, left: 10, bottom: 5, right: 10)
        card.layer.cornerRadius = 9
        card.layer.borderWidth = 1.5
        card.layer.borderColor = UIColor.white.withAlphaComponent(0.85).cgColor
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.55
        card.layer.shadowRadius = 6
        card.layer.shadowOffset = CGSize(width: 0, height: 3)

        card.addArrangedSubview(nameLabel)
        card.addArrangedSubview(areaLabel)
        addSubview(card)
        card.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: centerXAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor),
            card.topAnchor.constraint(equalTo: topAnchor),
            card.bottomAnchor.constraint(equalTo: bottomAnchor),
            card.leadingAnchor.constraint(equalTo: leadingAnchor),
            card.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])

        frame = CGRect(x: 0, y: 0, width: 120, height: 44)
        centerOffset = .zero
    }

    func configure(with t: GeoJSONTerritory) {
        nameLabel.text = t.memberName
        areaLabel.text = t.areaName
        card.backgroundColor = t.color
        setNeedsLayout()
    }
}

// MARK: - TeamMembersModal (wraps full TeamPerformanceCard m/ filtrering)

struct TeamMembersModal: View {
    @Environment(\.dismiss) private var dismiss
    @State private var sortBy: SortKey = .value
    @State private var search: String = ""

    enum SortKey: String, CaseIterable, Hashable {
        case value = "Verdi"
        case leads = "Leads"
        case meetings = "Møter"
        case momentum = "Momentum"
    }

    private var filteredSorted: [TeamMember] {
        var items = TeamData.members
        if !search.isEmpty {
            let q = search.lowercased()
            items = items.filter {
                $0.name.lowercased().contains(q) ||
                $0.area.lowercased().contains(q)
            }
        }
        switch sortBy {
        case .value:    items.sort { $0.valueNok > $1.valueNok }
        case .leads:    items.sort { $0.leads > $1.leads }
        case .meetings: items.sort { $0.meetings > $1.meetings }
        case .momentum: items.sort { $0.momentum > $1.momentum }
        }
        return items
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    summaryCard
                    searchBar
                    sortChips
                    TeamPerformanceCard()       // gjenbruker selve tabellen
                    Color.clear.frame(height: 24)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Teamets prestasjoner")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button { TeamStubActions.performGated(.teamExportCSV, actionName: "Eksporter CSV") } label: { Label("Eksporter som CSV", systemImage: "tablecells") }
                        Button { TeamStubActions.performGated(.teamCompareToPrevious, actionName: "Sammenlign m/ forrige periode") } label: { Label("Sammenlign m/ forrige periode", systemImage: "chart.bar.xaxis") }
                        Button { TeamStubActions.performGated(.teamShareReport, actionName: "Send rapport") } label: { Label("Send som rapport", systemImage: "envelope") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundStyle(TBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var summaryCard: some View {
        HStack(spacing: 0) {
            sumStat(label: "Medlemmer", value: "\(TeamData.members.count)", color: TBrand.purpleLight)
            sumDivider
            sumStat(label: "Totalt leads", value: "\(TeamData.members.reduce(0) { $0 + $1.leads })", color: TBrand.blue)
            sumDivider
            sumStat(label: "Vunnet (sum)", value: "NOK \(TeamData.members.reduce(0) { $0 + $1.valueNok }/1000)k", color: TBrand.green)
            sumDivider
            sumStat(label: "Snitt momentum", value: "\(TeamData.members.reduce(0) { $0 + $1.momentum }/TeamData.members.count)%", color: TBrand.yellow)
        }
        .padding(.vertical, 13)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(TBrand.stroke, lineWidth: 1))
    }

    private func sumStat(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 17, weight: .black, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(TBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var sumDivider: some View {
        Rectangle().fill(TBrand.stroke).frame(width: 1, height: 28)
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $search)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                if search.isEmpty {
                    Text("Søk medlem eller område…")
                        .font(.system(size: 13))
                        .foregroundStyle(TBrand.textTertiary)
                        .allowsHitTesting(false)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var sortChips: some View {
        HStack(spacing: 6) {
            Text("Sortér:")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ForEach(SortKey.allCases, id: \.self) { s in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { sortBy = s }
                } label: {
                    Text(s.rawValue)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(sortBy == s ? .white : TBrand.purpleLight)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(
                            sortBy == s ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(TBrand.purple.opacity(0.15)),
                            in: Capsule()
                        )
                        .overlay(Capsule().stroke(TBrand.purple.opacity(sortBy == s ? 0 : 0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }
}

// MARK: - 1. TeamPerformanceCard

struct TeamPerformanceCard: View {
    @State private var selectedID: UUID?
    @State private var detailMember: TeamMember?
    // Pakke 10.1 — wire tomme Button {}s til eksisterende sheets:
    @State private var assignAreaMember: TeamMember?
    @State private var setGoalMember: TeamMember?
    @State private var sendMessageMember: TeamMember?
    @State private var showAllMembers: Bool = false
    @State private var toast: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Teamets prestasjoner")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 14)

            // Tabell-header — kompakte kolonner, MOMENTUM uten letter-spacing
            HStack(spacing: 0) {
                Text("MEDLEM")
                    .tracking(0.5)
                    .frame(width: 170, alignment: .leading)
                Text("LEADS")
                    .tracking(0.5)
                    .frame(width: 80, alignment: .leading)
                Text("MØTER")
                    .tracking(0.5)
                    .frame(width: 80, alignment: .leading)
                Text("VUNNET VERDI")
                    .tracking(0.5)
                    .frame(width: 140, alignment: .leading)
                Text("MOMENTUM")
                    .lineLimit(1)
                    .fixedSize()
                    .frame(maxWidth: .infinity, alignment: .leading)
                Color.clear.frame(width: 26)
            }
            .font(.system(size: 10, weight: .black))
            .foregroundStyle(TBrand.textTertiary)
            .padding(.horizontal, 16).padding(.bottom, 6)

            ForEach(TeamData.members) { m in
                memberRow(m)
                if m.id != TeamData.members.last?.id {
                    Divider().overlay(TBrand.stroke).padding(.horizontal, 16)
                }
            }

            Button { showAllMembers = true } label: {
                Text("Se alle medlemmer")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(TBrand.purpleLight)
                    .padding(.vertical, 13)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
        }
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
        // Pakke 10.1 — 4 wirede sheets på TeamPerformanceCard.
        .sheet(item: $assignAreaMember) { m in
            AssignAreaSheet(preselectedMember: m)
        }
        .sheet(item: $setGoalMember) { _ in
            SetKPIGoalSheet(kpi: .wonValue)
        }
        .sheet(item: $sendMessageMember) { m in
            NavigationStack {
                ZStack {
                    TBrand.bg.ignoresSafeArea()
                    VStack(spacing: 14) {
                        Image(systemName: "envelope.badge.fill")
                            .font(.system(size: 42, weight: .semibold))
                            .foregroundStyle(TBrand.purpleLight)
                            .padding(.top, 60)
                        Text("Send melding til \(m.name)")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(.white)
                        Text("Slack + SMS-integrasjon kobles i egen wiring-runde.\nBruk Message-appen inntil videre.")
                            .font(.system(size: 12))
                            .foregroundStyle(TBrand.textSecondary)
                            .multilineTextAlignment(.center)
                        Spacer()
                    }
                    .padding(20)
                }
                .navigationTitle("Send melding")
                .navigationBarTitleDisplayMode(.inline)
            }
        }
        .sheet(isPresented: $showAllMembers) {
            TeamMembersModal()
        }
        .overlay(alignment: .top) {
            if let t = toast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(TBrand.green, in: Capsule())
                    .padding(.top, 10)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        .sheet(item: $detailMember) { m in
            SellerPerformanceModal(member: m)
        }
    }

    private func memberRow(_ m: TeamMember) -> some View {
        HStack(spacing: 0) {
            // MEDLEM
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(m.color.opacity(0.85))
                    Text(m.initials)
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.name)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(m.area)
                        .font(.system(size: 11))
                        .foregroundStyle(TBrand.textSecondary)
                        .lineLimit(1)
                }
            }
            .frame(width: 170, alignment: .leading)

            // LEADS
            HStack(spacing: 4) {
                Text("\(m.leads)")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                trendBadge(m.leadsTrend)
            }
            .frame(width: 80, alignment: .leading)

            // MØTER
            HStack(spacing: 4) {
                Text("\(m.meetings)")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                trendBadge(m.meetingsTrend)
            }
            .frame(width: 80, alignment: .leading)

            // VUNNET VERDI
            HStack(spacing: 4) {
                Text("NOK \(formatNok(m.valueNok))")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                if m.valueNok > 0 {
                    trendBadge(m.valueTrend)
                } else {
                    Text("–")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(TBrand.textTertiary)
                }
            }
            .frame(width: 140, alignment: .leading)

            // MOMENTUM — m/ farge-prikk + tall + bar
            HStack(spacing: 8) {
                Circle()
                    .fill(m.momentumColor)
                    .frame(width: 8, height: 8)
                    .shadow(color: m.momentumColor.opacity(0.5), radius: 3)
                Text("\(m.momentum)%")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .frame(width: 36, alignment: .leading)
                momentumBar(m.momentum, color: m.momentumColor)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Ellipsis
            Menu {
                Button { detailMember = m } label: { Label("Se full profil", systemImage: "person.fill") }
                Button { sendMessageMember = m } label: { Label("Send melding", systemImage: "envelope.fill") }
                Button { assignAreaMember = m } label: { Label("Endre område", systemImage: "mappin.and.ellipse") }
                Button { setGoalMember = m } label: { Label("Sett mål", systemImage: "target") }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(TBrand.textSecondary)
                    .frame(width: 26, height: 26)
                    .contentShape(Rectangle())
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(selectedID == m.id ? TBrand.cardHi : Color.clear)
        .contentShape(Rectangle())
        .onTapGesture {
            selectedID = m.id
            detailMember = m
        }
    }

    private func trendBadge(_ pct: Int) -> some View {
        HStack(spacing: 1) {
            Image(systemName: pct >= 0 ? "arrow.up" : "arrow.down")
                .font(.system(size: 8, weight: .black))
            Text("\(abs(pct))%")
                .font(.system(size: 10, weight: .bold))
                .monospacedDigit()
        }
        .foregroundStyle(pct >= 0 ? TBrand.green : TBrand.red)
    }

    private func momentumBar(_ pct: Int, color: Color) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(TBrand.cardHi)
                    .frame(height: 6)
                Capsule()
                    .fill(color)
                    .frame(width: max(4, geo.size.width * Double(pct) / 100), height: 6)
            }
        }
        .frame(height: 6)
        .frame(maxWidth: 180)
    }

    private func formatNok(_ n: Int) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }
}

// MARK: - 2. TeamAreasCard

struct TeamAreasCard: View {
    @Environment(AppState.self) private var appState
    @State private var regionCenter = CLLocationCoordinate2D(latitude: 59.920, longitude: 10.780)
    @State private var spanLat: Double = 0.30
    @State private var spanLon: Double = 0.55
    /// True mens vi laster ekte kommunegrenser fra Kartverket. Vises
    /// diskret som liten spinner i header så bruker vet kartet er live.
    @State private var loadingRealBoundaries: Bool = true

    private var position: MapCameraPosition {
        .region(MKCoordinateRegion(
            center: regionCenter,
            span: MKCoordinateSpan(latitudeDelta: spanLat, longitudeDelta: spanLon)
        ))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Teamets områder")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                if loadingRealBoundaries {
                    ProgressView()
                        .scaleEffect(0.65)
                        .tint(TBrand.purpleLight)
                        .accessibilityLabel("Laster kommunegrenser fra Kartverket")
                } else {
                    // Liten 🇳🇴-badge når grensene er ekte fra Kartverket
                    Text("🇳🇴 Kartverket")
                        .font(.system(size: 9, weight: .black, design: .rounded))
                        .tracking(0.8)
                        .foregroundStyle(TBrand.purpleLight)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(TBrand.cardHi.opacity(0.6), in: Capsule())
                }
                Spacer()
                Button { showAssign = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "plus")
                            .font(.system(size: 11, weight: .bold))
                        Text("Tildel område")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(
                        LinearGradient(colors: [TBrand.purple, TBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                    .shadow(color: TBrand.purple.opacity(0.35), radius: 5, y: 2)
                }
                .buttonStyle(.plain)
                Button { TeamStubActions.toast("Filter områder") } label: {
                    Image(systemName: "line.3.horizontal.decrease")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(TBrand.purpleLight)
                        .padding(8)
                        .background(TBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(TBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 12)

            mapView
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 12).padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
        .sheet(item: $selectedMember) { member in
            SellerPerformanceModal(member: member)
        }
        .sheet(isPresented: $showAssign) {
            AssignAreaSheet()
        }
        .task {
            // Ved første visning: last ekte kommunegrenser fra Kartverket.
            // Fallback = hardkodete 4-sider polygoner (allerede satt i @State).
            guard let api = appState.api else {
                loadingRealBoundaries = false
                return
            }
            let real = await GeoJSONLoader.loadRealKommuneTerritories(using: api)
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.4)) {
                    territories = real
                    loadingRealBoundaries = false
                }
            }
        }
    }

    @State private var territories: [GeoJSONTerritory] = GeoJSONLoader.loadTerritories()
    @State private var selectedMember: TeamMember?
    @State private var showAssign: Bool = false

    /// Demo-mode-gated territories. Skjuler polygonene (Kari/Ola/Martine/
    /// Henrik) når TeamData.members er tom, så kartet ikke lyver om
    /// tildelte områder.
    private var effectiveTerritories: [GeoJSONTerritory] {
        TeamData.members.isEmpty ? [] : territories
    }

    private var mapView: some View {
        ZStack(alignment: .topTrailing) {
            DarkMKMapView(
                region: MKCoordinateRegion(center: regionCenter,
                                            span: MKCoordinateSpan(latitudeDelta: spanLat, longitudeDelta: spanLon)),
                territories: effectiveTerritories,
                onSelectTerritory: { t in
                    // Match GeoJSON-medlem mot TeamData.members
                    if let m = TeamData.members.first(where: { $0.name.contains(t.memberName) }) {
                        selectedMember = m
                    }
                }
            )

            // Zoom + fullscreen controls
            VStack(spacing: 4) {
                mapControlButton("plus") { zoomBy(0.7) }
                mapControlButton("minus") { zoomBy(1.4) }
                mapControlButton("arrow.up.left.and.arrow.down.right") {
                    withAnimation {
                        regionCenter = CLLocationCoordinate2D(latitude: 59.920, longitude: 10.780)
                        spanLat = 0.30
                        spanLon = 0.55
                    }
                }
            }
            .padding(.trailing, 8).padding(.top, 8)
        }
    }

    private func mapControlButton(_ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(TBrand.card.opacity(0.9), in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func zoomBy(_ factor: Double) {
        withAnimation(.easeInOut(duration: 0.3)) {
            spanLat = max(0.01, min(5.0, spanLat * factor))
            spanLon = max(0.01, min(5.0, spanLon * factor))
        }
    }
}

// MARK: - 3. ActivityCard

struct ActivityCard: View {
    @State private var showModal = false

    var body: some View {
        let hasActivity = !TeamData.activities.isEmpty
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Aktivitet i sanntid")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                if hasActivity {
                    Circle().fill(TBrand.green)
                        .frame(width: 6, height: 6)
                        .shadow(color: TBrand.green, radius: 3)
                    Text("LIVE")
                        .font(.system(size: 8, weight: .black))
                        .foregroundStyle(TBrand.green)
                        .tracking(0.6)
                }
                Spacer()
                if hasActivity {
                    Text("\(TeamData.activities.count) i dag")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(TBrand.textSecondary)
                        .monospacedDigit()
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(TBrand.cardHi, in: Capsule())
                }
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 10)

            if hasActivity {
                ForEach(TeamData.activities.prefix(5)) { ev in
                    activityRow(ev)
                    if ev.id != TeamData.activities.prefix(5).last?.id {
                        Divider().overlay(TBrand.stroke).padding(.horizontal, 16)
                    }
                }
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "waveform.path.ecg")
                        .font(.system(size: 26))
                        .foregroundStyle(TBrand.textTertiary)
                    Text("Ingen aktivitet enda")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(TBrand.textSecondary)
                    Text("Teamets registrerte hendelser dukker opp her i sanntid.")
                        .font(.system(size: 10))
                        .foregroundStyle(TBrand.textTertiary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 300)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 26)
            }

            Button { showModal = true } label: {
                HStack(spacing: 5) {
                    Text("Se alle aktiviteter")
                        .font(.system(size: 12, weight: .semibold))
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(TBrand.purpleLight)
                .padding(.vertical, 13)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
        }
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
        .sheet(isPresented: $showModal) {
            ActivityModal()
        }
    }

    private func activityRow(_ ev: ActivityEvent) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(ev.memberColor.opacity(0.85))
                Text(ev.memberInitials)
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(ev.memberName)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                actionText(ev)
            }
            Spacer()
            Text(ev.timeAgo)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(TBrand.textTertiary)
                .monospacedDigit()
        }
        .padding(.horizontal, 16).padding(.vertical, 9)
    }

    @ViewBuilder
    private func actionText(_ ev: ActivityEvent) -> some View {
        if let h = ev.highlight {
            (Text(ev.action).foregroundStyle(TBrand.textSecondary)
             + Text(h).foregroundStyle(ev.highlightColor).bold())
                .font(.system(size: 11))
        } else {
            Text(ev.action)
                .font(.system(size: 11))
                .foregroundStyle(TBrand.textSecondary)
        }
    }
}

// MARK: - ActivityModal

struct ActivityModal: View {
    @Environment(\.dismiss) private var dismiss
    @State private var search: String = ""
    @State private var filter: Filter = .all
    @State private var memberFilter: String? = nil

    enum Filter: String, CaseIterable, Hashable {
        case all = "Alle"
        case wins = "Vunnet"
        case losses = "Tapt"
        case meetings = "Møter"
        case emails = "E-post"
        case notes = "Notater"
        var icon: String {
            switch self {
            case .all:      return "rectangle.stack.fill"
            case .wins:     return "trophy.fill"
            case .losses:   return "xmark.octagon.fill"
            case .meetings: return "calendar"
            case .emails:   return "envelope.fill"
            case .notes:    return "note.text"
            }
        }
        var color: Color {
            switch self {
            case .all:      return TBrand.purpleLight
            case .wins:     return TBrand.green
            case .losses:   return TBrand.red
            case .meetings: return TBrand.blue
            case .emails:   return TBrand.purpleLight
            case .notes:    return TBrand.yellow
            }
        }
    }

    private var filteredActivities: [ActivityEvent] {
        var items = TeamData.activities
        if !search.isEmpty {
            let q = search.lowercased()
            items = items.filter {
                $0.memberName.lowercased().contains(q) ||
                $0.action.lowercased().contains(q) ||
                ($0.highlight?.lowercased().contains(q) ?? false)
            }
        }
        if let m = memberFilter {
            items = items.filter { $0.memberName == m }
        }
        switch filter {
        case .all: break
        case .wins:     items = items.filter { $0.highlight == "Vunnet" }
        case .losses:   items = items.filter { $0.highlight == "Tapt" }
        case .meetings: items = items.filter { $0.action.lowercased().contains("møte") }
        case .emails:   items = items.filter { $0.action.lowercased().contains("e-post") }
        case .notes:    items = items.filter { $0.action.lowercased().contains("notat") }
        }
        return items
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    summaryCard
                    searchBar
                    filterChips
                    memberFilterChips
                    activityList
                    if filteredActivities.isEmpty { emptyState }
                    Color.clear.frame(height: 20)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Aktivitet i sanntid")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button { TeamStubActions.performGated(.teamExportCSV, actionName: "Eksporter CSV") } label: { Label("Eksporter som CSV", systemImage: "tablecells") }
                        Button { TeamStubActions.performGated(.teamShareReport, actionName: "Send rapport") } label: { Label("Send som rapport", systemImage: "envelope") }
                        Button { TeamStubActions.performGated(.teamMarkAllRead, actionName: "Markér alle som lest") } label: { Label("Markér alle som lest", systemImage: "checkmark") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundStyle(TBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var summaryCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [TBrand.green, TBrand.purpleLight],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "dot.radiowaves.left.and.right")
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 50, height: 50)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("Team-aktivitet i dag")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    if !TeamData.activities.isEmpty {
                        Circle().fill(TBrand.green)
                            .frame(width: 6, height: 6)
                            .shadow(color: TBrand.green, radius: 3)
                        Text("LIVE")
                            .font(.system(size: 8, weight: .black))
                            .foregroundStyle(TBrand.green)
                            .tracking(0.6)
                    }
                }
                if TeamData.activities.isEmpty {
                    Text("Ingen aktivitet enda")
                        .font(.system(size: 11))
                        .foregroundStyle(TBrand.textSecondary)
                } else {
                    Text("\(TeamData.activities.count) hendelser · \(TeamData.activities.filter { $0.highlight == "Vunnet" }.count) deals lukket")
                        .font(.system(size: 11))
                        .foregroundStyle(TBrand.textSecondary)
                }
            }
            Spacer()
            if !TeamData.activities.isEmpty {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("Siste hendelse")
                        .font(.system(size: 9))
                        .foregroundStyle(TBrand.textTertiary)
                    Text(TeamData.activities.first?.timeAgo ?? "—")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(14)
        .background(
            LinearGradient(colors: [TBrand.green.opacity(0.10), TBrand.purple.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.green.opacity(0.30), lineWidth: 1))
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $search)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                if search.isEmpty {
                    Text("Søk medlem, bedrift eller handling…")
                        .font(.system(size: 13))
                        .foregroundStyle(TBrand.textTertiary)
                        .allowsHitTesting(false)
                }
            }
            if !search.isEmpty {
                Button { search = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(TBrand.textTertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Filter.allCases, id: \.self) { f in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { filter = f }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: f.icon)
                                .font(.system(size: 9, weight: .bold))
                            Text(f.rawValue)
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundStyle(filter == f ? .white : f.color)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(
                            filter == f ? AnyShapeStyle(f.color) : AnyShapeStyle(f.color.opacity(0.15)),
                            in: Capsule()
                        )
                        .overlay(Capsule().stroke(f.color.opacity(filter == f ? 0 : 0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var memberFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                Button {
                    withAnimation { memberFilter = nil }
                } label: {
                    Text("Alle medlemmer")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(memberFilter == nil ? .white : TBrand.textSecondary)
                        .padding(.horizontal, 8).padding(.vertical, 5)
                        .background(
                            memberFilter == nil ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(TBrand.cardHi),
                            in: Capsule()
                        )
                        .overlay(Capsule().stroke(TBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
                ForEach(TeamData.members, id: \.id) { m in
                    let isSelected = memberFilter == m.name
                    Button {
                        withAnimation { memberFilter = isSelected ? nil : m.name }
                    } label: {
                        HStack(spacing: 5) {
                            ZStack {
                                Circle().fill(m.color.opacity(0.85))
                                Text(m.initials)
                                    .font(.system(size: 8, weight: .black))
                                    .foregroundStyle(.white)
                            }
                            .frame(width: 18, height: 18)
                            Text(m.name.split(separator: " ").first.map(String.init) ?? m.name)
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(isSelected ? .white : .white.opacity(0.85))
                        }
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(
                            isSelected ? AnyShapeStyle(m.color) : AnyShapeStyle(TBrand.cardHi),
                            in: Capsule()
                        )
                        .overlay(Capsule().stroke(isSelected ? Color.clear : TBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var activityList: some View {
        VStack(spacing: 0) {
            ForEach(filteredActivities.indices, id: \.self) { idx in
                let ev = filteredActivities[idx]
                richActivityRow(ev, isLast: idx == filteredActivities.count - 1)
            }
        }
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
    }

    private func richActivityRow(_ ev: ActivityEvent, isLast: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Avatar m/ live-prikk hvis nylig
                ZStack(alignment: .bottomTrailing) {
                    ZStack {
                        Circle().fill(ev.memberColor.opacity(0.85))
                        Text(ev.memberInitials)
                            .font(.system(size: 12, weight: .black))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 38, height: 38)
                    if ev.timeAgo.contains("min") {
                        Circle().fill(TBrand.green)
                            .overlay(Circle().stroke(TBrand.card, lineWidth: 2))
                            .frame(width: 11, height: 11)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(ev.memberName)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        if let h = ev.highlight {
                            Text(h)
                                .font(.system(size: 9, weight: .black))
                                .foregroundStyle(ev.highlightColor)
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(ev.highlightColor.opacity(0.18), in: Capsule())
                                .overlay(Capsule().stroke(ev.highlightColor.opacity(0.4), lineWidth: 1))
                        }
                    }
                    Text(ev.action.trimmingCharacters(in: .whitespaces) + (ev.highlight != nil && !ev.action.trimmingCharacters(in: .whitespaces).hasSuffix(ev.highlight!) ? "" : ""))
                        .font(.system(size: 11))
                        .foregroundStyle(TBrand.textSecondary)
                }
                Spacer()
                Text(ev.timeAgo)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(TBrand.textTertiary)
                    .monospacedDigit()
            }
            .padding(.horizontal, 14).padding(.vertical, 11)
            if !isLast {
                Divider().overlay(TBrand.stroke).padding(.horizontal, 14)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "tray")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(TBrand.textTertiary)
            Text("Ingen aktiviteter matcher")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Text("Prøv annet søk eller filter")
                .font(.system(size: 11))
                .foregroundStyle(TBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

// MARK: - TeamPipelineModal (wraps full TeamPipelineCard)

struct TeamPipelineModal: View {
    @Environment(\.dismiss) private var dismiss

    private var totalLeads: Int { TeamData.pipeline.first?.count ?? 0 }
    private var totalWon: Int { TeamData.pipeline.last?.count ?? 0 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    summaryCard
                    TeamPipelineCard()
                    Color.clear.frame(height: 24)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Teamets pipeline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button { TeamStubActions.performGated(.teamExportCSV, actionName: "Eksporter CSV") } label: { Label("Eksporter som CSV", systemImage: "tablecells") }
                        Button { TeamStubActions.performGated(.teamForecast30d, actionName: "Forecast 30d") } label: { Label("Forecast neste 30 dager", systemImage: "chart.line.uptrend.xyaxis") }
                        Button { TeamStubActions.performGated(.teamPipelineHealth, actionName: "Pipeline-helse-rapport") } label: { Label("Pipeline-helse-rapport", systemImage: "heart.text.square.fill") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundStyle(TBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var summaryCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [TBrand.purple, TBrand.green],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text("Pipeline-helse")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(totalLeads) nye leads → \(totalWon) vunnet (1,8 % total konvertering)")
                    .font(.system(size: 11))
                    .foregroundStyle(TBrand.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("Vunnet verdi")
                    .font(.system(size: 9))
                    .foregroundStyle(TBrand.textTertiary)
                Text("NOK 5,2M")
                    .font(.system(size: 14, weight: .black, design: .rounded))
                    .foregroundStyle(TBrand.green)
                    .monospacedDigit()
            }
        }
        .padding(13)
        .background(
            LinearGradient(colors: [TBrand.purple.opacity(0.12), TBrand.green.opacity(0.06)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.purple.opacity(0.30), lineWidth: 1))
    }
}

// MARK: - 4. TeamPipelineCard

struct TeamPipelineCard: View {
    @State private var range: String = "Denne måneden"

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Teamets pipeline")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Menu {
                    Button("Denne uka")     { range = "Denne uka" }
                    Button("Denne måneden") { range = "Denne måneden" }
                    Button("Dette kvartalet") { range = "Dette kvartalet" }
                    Button("Året")          { range = "Året" }
                } label: {
                    HStack(spacing: 5) {
                        Text(range)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(TBrand.textTertiary)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(TBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(TBrand.stroke, lineWidth: 1))
                }
            }

            HStack(alignment: .top, spacing: 20) {
                funnel
                    .frame(maxWidth: .infinity)
                conversionTable
                    .frame(width: 260)
            }
        }
        .padding(14)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var funnel: some View {
        VStack(spacing: 0) {                       // sammenhengende — ingen gap
            ForEach(TeamData.pipeline) { stage in
                funnelRow(stage)
            }
        }
    }

    private func funnelRow(_ stage: PipelineStage) -> some View {
        GeometryReader { geo in
            ZStack {
                FunnelSegmentShape(topFraction: stage.topFraction,
                                   bottomFraction: stage.bottomFraction)
                    .fill(stage.color)
                // Tekst-frame begrenset til segmentets SMALESTE bredde minus liten margin
                HStack {
                    Text(stage.label)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Spacer(minLength: 8)
                    Text("\(formatNok(stage.count))")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                .frame(width: max(80, geo.size.width * stage.bottomFraction - 18))
            }
        }
        .frame(height: 46)
    }

    private var conversionTable: some View {
        VStack(spacing: 0) {
            HStack {
                Text("STEG")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(TBrand.textTertiary)
                    .tracking(0.5)
                Spacer()
                Text("KONVERTERING")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(TBrand.textTertiary)
                    .tracking(0.5)
            }
            .padding(.bottom, 8)
            ForEach(TeamData.conversions) { row in
                conversionRow(row)
                if row.id != TeamData.conversions.last?.id && !row.isTotal {
                    Divider().overlay(TBrand.stroke)
                }
            }
        }
    }

    private func conversionRow(_ row: ConversionRow) -> some View {
        HStack {
            Text(row.label)
                .font(.system(size: 11, weight: row.isTotal ? .bold : .semibold))
                .foregroundStyle(row.isTotal ? TBrand.purpleLight : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
            Spacer()
            Text(row.isTotal ? String(format: "%.1f%%", row.pct) : "\(Int(row.pct))%")
                .font(.system(size: 12, weight: .black, design: .rounded))
                .foregroundStyle(row.isTotal ? TBrand.purpleLight : .white)
                .monospacedDigit()
        }
        .padding(.vertical, 10)
        .padding(.horizontal, row.isTotal ? 10 : 0)
        .background(
            row.isTotal ? TBrand.purple.opacity(0.15) : Color.clear,
            in: RoundedRectangle(cornerRadius: 9)
        )
        .overlay(
            row.isTotal
                ? RoundedRectangle(cornerRadius: 9).stroke(TBrand.purple.opacity(0.40), lineWidth: 1)
                : nil
        )
    }

    private func formatNok(_ n: Int) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }
}

// Funnel-segment: sentrert trapes der topp- og bunn-bredde er en brøk av rect.width
struct FunnelSegmentShape: Shape {
    let topFraction: Double
    let bottomFraction: Double

    func path(in rect: CGRect) -> Path {
        let topW = rect.width * topFraction
        let botW = rect.width * bottomFraction
        let topInset = (rect.width - topW) / 2
        let botInset = (rect.width - botW) / 2
        var path = Path()
        path.move(to: CGPoint(x: topInset, y: 0))
        path.addLine(to: CGPoint(x: rect.width - topInset, y: 0))
        path.addLine(to: CGPoint(x: rect.width - botInset, y: rect.height))
        path.addLine(to: CGPoint(x: botInset, y: rect.height))
        path.closeSubpath()
        return path
    }
}

// MARK: - InviteMemberSheet

struct InviteMemberSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var email: String = ""
    @State private var role: Role = .seller
    @State private var area: String = "Oslo Vest"
    @State private var sendInvite: Bool = true

    enum Role: String, CaseIterable, Hashable {
        case admin = "Admin"
        case manager = "Salgssjef"
        case seller = "Selger"
        case sdr = "SDR"
        var icon: String {
            switch self {
            case .admin:   return "crown.fill"
            case .manager: return "person.2.badge.gearshape.fill"
            case .seller:  return "briefcase.fill"
            case .sdr:     return "phone.fill"
            }
        }
        var color: Color {
            switch self {
            case .admin:   return TBrand.red
            case .manager: return TBrand.orange
            case .seller:  return TBrand.purpleLight
            case .sdr:     return TBrand.blue
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    emailField
                    roleGrid
                    areaPicker
                    Toggle(isOn: $sendInvite) {
                        Text("Send invitt-e-post umiddelbart")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .tint(TBrand.purple)
                    .padding(11)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Inviter team-medlem")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") { dismiss() }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(TBrand.purpleLight)
                        .disabled(email.isEmpty)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var emailField: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("E-post")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $email)
                    .foregroundStyle(.white)
                    .font(.system(size: 14))
                    .padding(12)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if email.isEmpty {
                    Text("navn@bedrift.no")
                        .font(.system(size: 14))
                        .foregroundStyle(TBrand.textTertiary)
                        .padding(.horizontal, 15)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var roleGrid: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Rolle")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(Role.allCases, id: \.self) { r in
                    Button { role = r } label: {
                        HStack(spacing: 8) {
                            Image(systemName: r.icon)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(role == r ? .white : r.color)
                            Text(r.rawValue)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            role == r ? AnyShapeStyle(r.color) : AnyShapeStyle(TBrand.card),
                            in: RoundedRectangle(cornerRadius: 11)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(role == r ? Color.clear : TBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var areaPicker: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Område")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            Menu {
                ForEach(["Oslo Vest", "Oslo Sentrum", "Lørenskog", "Asker / Bærum", "Sarpsborg", "Bergen", "Trondheim", "Stavanger"], id: \.self) { a in
                    Button(a) { area = a }
                }
            } label: {
                HStack {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(TBrand.purpleLight)
                    Text(area)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(TBrand.textTertiary)
                }
                .padding(12)
                .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
            }
        }
    }
}
