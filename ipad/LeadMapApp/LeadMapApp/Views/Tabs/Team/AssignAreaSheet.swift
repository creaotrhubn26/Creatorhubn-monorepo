// AssignAreaSheet.swift
//
// Modal for å tildele/omfordele områder til team-medlemmer.
// 3 modus:
//   - Tildel eksisterende: overfør et eksisterende område til ny eier
//   - Fra kommune-katalog: velg en norsk kommune fra liste
//   - Tegn nytt: long-press på kart for å plassere polygon-hjørner
//
// Sluttsteg: velg eier-medlem + lokasjon-notat + varsle-toggle + Bekreft.

import SwiftUI
import MapKit

struct AssignAreaSheet: View {
    let preselectedMember: TeamMember?         // hvis åpnet fra SellerPerformanceModal
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .catalog
    @State private var selectedCatalogKommune: KommuneEntry?
    @State private var selectedExistingTerritory: GeoJSONTerritory?
    @State private var drawnPoints: [CLLocationCoordinate2D] = []
    @State private var pencilOnly: Bool = false              // filter ut finger-touch i tegne-modus
    @State private var selectedMember: TeamMember?
    @State private var notifyMember: Bool = true
    @State private var handoffNote: String = ""

    init(preselectedMember: TeamMember? = nil) {
        self.preselectedMember = preselectedMember
        _selectedMember = State(initialValue: preselectedMember)
    }

    enum Mode: String, CaseIterable, Hashable {
        case catalog = "Kommune"
        case existing = "Eksisterende"
        case draw = "Tegn nytt"
        var icon: String {
            switch self {
            case .catalog:  return "list.bullet.rectangle.fill"
            case .existing: return "arrow.left.arrow.right"
            case .draw:     return "pencil.tip"
            }
        }
    }

    struct KommuneEntry: Identifiable, Hashable {
        let id = UUID()
        let name: String
        let region: String
        let population: Int
        let leadsCount: Int
        let assigned: String?     // navn til nåværende eier, nil hvis ledig
    }

    private let kommuner: [KommuneEntry] = [
        KommuneEntry(name: "Oslo Vest",       region: "Oslo",       population: 220_000, leadsCount: 245, assigned: "Kari Nordmann"),
        KommuneEntry(name: "Oslo Sentrum",    region: "Oslo",       population: 180_000, leadsCount: 198, assigned: "Ola Magnussen"),
        KommuneEntry(name: "Lørenskog",        region: "Viken",      population:  43_000, leadsCount: 176, assigned: "Martine Jensen"),
        KommuneEntry(name: "Asker / Bærum",   region: "Viken",      population: 215_000, leadsCount: 165, assigned: "Henrik Solberg"),
        KommuneEntry(name: "Sarpsborg",        region: "Viken",      population:  56_000, leadsCount: 132, assigned: "Sofie Dahl"),
        KommuneEntry(name: "Drammen",          region: "Viken",      population: 102_000, leadsCount:   0, assigned: nil),
        KommuneEntry(name: "Lillestrøm",       region: "Viken",      population:  90_000, leadsCount:   0, assigned: nil),
        KommuneEntry(name: "Fredrikstad",      region: "Viken",      population:  82_000, leadsCount:   0, assigned: nil),
        KommuneEntry(name: "Tønsberg",         region: "Vestfold",   population:  56_000, leadsCount:   0, assigned: nil),
        KommuneEntry(name: "Stavanger",        region: "Rogaland",   population: 144_000, leadsCount:   0, assigned: nil),
        KommuneEntry(name: "Bergen",           region: "Vestland",   population: 290_000, leadsCount:   0, assigned: nil),
        KommuneEntry(name: "Trondheim",        region: "Trøndelag",  population: 213_000, leadsCount:   0, assigned: nil),
    ]

    private var canConfirm: Bool {
        guard selectedMember != nil else { return false }
        switch mode {
        case .catalog:  return selectedCatalogKommune != nil
        case .existing: return selectedExistingTerritory != nil
        case .draw:     return drawnPoints.count >= 3
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    modePicker
                    Group {
                        switch mode {
                        case .catalog:  catalogSection
                        case .existing: existingSection
                        case .draw:     drawSection
                        }
                    }
                    memberPicker
                    if selectedMember != nil { notifyCard; handoffCard }
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Tildel område")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { confirmBar }
        }
    }

    // MARK: Mode-picker

    private var modePicker: some View {
        HStack(spacing: 5) {
            ForEach(Mode.allCases, id: \.self) { m in
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { mode = m }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: m.icon)
                            .font(.system(size: 10, weight: .bold))
                        Text(m.rawValue)
                            .font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(mode == m ? .white : TBrand.textSecondary)
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(
                        mode == m ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(Color.clear),
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(4)
        .background(TBrand.card, in: Capsule())
        .overlay(Capsule().stroke(TBrand.stroke, lineWidth: 1))
    }

    // MARK: Catalog-modus

    private var catalogSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Velg kommune", subtitle: "Områder lastet fra Kartverket-katalog")
            VStack(spacing: 6) {
                ForEach(kommuner) { k in kommuneRow(k) }
            }
        }
    }

    private func kommuneRow(_ k: KommuneEntry) -> some View {
        let isSelected = selectedCatalogKommune?.id == k.id
        let isOccupied = k.assigned != nil
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selectedCatalogKommune = k }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9)
                        .fill((isOccupied ? TBrand.orange : TBrand.green).opacity(0.22))
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(isOccupied ? TBrand.orange : TBrand.green)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(k.name)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        Text(k.region)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(TBrand.textSecondary)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(TBrand.cardHi, in: Capsule())
                    }
                    HStack(spacing: 5) {
                        Text("\(formatThousands(k.population)) innbyggere")
                            .font(.system(size: 10))
                            .foregroundStyle(TBrand.textSecondary)
                            .monospacedDigit()
                        if k.leadsCount > 0 {
                            Text("·")
                                .foregroundStyle(TBrand.textTertiary)
                            Text("\(k.leadsCount) leads")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(TBrand.blue)
                                .monospacedDigit()
                        }
                    }
                }
                Spacer()
                if let assigned = k.assigned {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("EIER")
                            .font(.system(size: 8, weight: .black))
                            .foregroundStyle(TBrand.textTertiary)
                            .tracking(0.5)
                        Text(assigned.split(separator: " ").first.map(String.init) ?? assigned)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(TBrand.orange)
                    }
                } else {
                    Text("LEDIG")
                        .font(.system(size: 9, weight: .black))
                        .foregroundStyle(TBrand.green)
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(TBrand.green.opacity(0.18), in: Capsule())
                        .overlay(Capsule().stroke(TBrand.green.opacity(0.4), lineWidth: 1))
                }
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 16))
                    .foregroundStyle(isSelected ? TBrand.purpleLight : TBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? TBrand.purple.opacity(0.10) : TBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? TBrand.purple.opacity(0.5) : TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Existing-modus

    private var existingSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Velg eksisterende område", subtitle: "Overfør eierskap til en annen selger")
            VStack(spacing: 6) {
                ForEach(GeoJSONLoader.loadTerritories()) { t in
                    existingRow(t)
                }
            }
        }
    }

    private func existingRow(_ t: GeoJSONTerritory) -> some View {
        let isSelected = selectedExistingTerritory?.areaName == t.areaName
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selectedExistingTerritory = t }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(Color(t.color))
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.areaName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 4) {
                        Text("Nåværende eier:")
                            .font(.system(size: 10))
                            .foregroundStyle(TBrand.textSecondary)
                        Text(t.memberName)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color(t.color))
                    }
                }
                Spacer()
                if isSelected, let target = selectedMember {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(TBrand.purpleLight)
                        Text(target.name.split(separator: " ").first.map(String.init) ?? target.name)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 7).padding(.vertical, 4)
                    .background(TBrand.purple.opacity(0.20), in: Capsule())
                }
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 16))
                    .foregroundStyle(isSelected ? TBrand.purpleLight : TBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? TBrand.purple.opacity(0.10) : TBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? TBrand.purple.opacity(0.5) : TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Draw-modus

    private var drawSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                sectionTitle("Tegn nytt område",
                             subtitle: pencilOnly
                                ? "Dra med Apple Pencil for å tegne fritt omriss"
                                : "Tap for å plassere hjørner, eller dra m/ Apple Pencil for å tegne fritt")
                Spacer()
                Button {
                    withAnimation { pencilOnly.toggle() }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "applepencil.tip")
                            .font(.system(size: 11, weight: .bold))
                        Text(pencilOnly ? "Bare Pencil" : "Finger + Pencil")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(pencilOnly ? .white : TBrand.purpleLight)
                    .padding(.horizontal, 9).padding(.vertical, 6)
                    .background(
                        pencilOnly ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(TBrand.purple.opacity(0.15)),
                        in: Capsule()
                    )
                    .overlay(Capsule().stroke(TBrand.purple.opacity(pencilOnly ? 0 : 0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            DrawableMapView(points: $drawnPoints,
                            previewColor: selectedMember?.color ?? TBrand.purpleLight,
                            pencilOnly: pencilOnly)
                .frame(height: 280)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
            if pencilOnly {
                HStack(spacing: 8) {
                    Image(systemName: "applepencil.tip")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(TBrand.purpleLight)
                    Text("Pencil-modus aktiv — finger-touch ignoreres på kartet")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(TBrand.purpleLight)
                    Spacer()
                }
                .padding(8)
                .background(TBrand.purple.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(TBrand.purple.opacity(0.35), lineWidth: 1))
            }
            HStack(spacing: 8) {
                Button {
                    withAnimation { if !drawnPoints.isEmpty { drawnPoints.removeLast() } }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.uturn.backward")
                            .font(.system(size: 11, weight: .bold))
                        Text("Angre")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(TBrand.card, in: Capsule())
                    .overlay(Capsule().stroke(TBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(drawnPoints.isEmpty)
                Button {
                    withAnimation { drawnPoints.removeAll() }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "trash")
                            .font(.system(size: 11, weight: .bold))
                        Text("Tøm")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(TBrand.red)
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(TBrand.red.opacity(0.12), in: Capsule())
                    .overlay(Capsule().stroke(TBrand.red.opacity(0.35), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(drawnPoints.isEmpty)
                Spacer()
                Text("\(drawnPoints.count) punkter")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(drawnPoints.count >= 3 ? TBrand.green : TBrand.orange)
                    .monospacedDigit()
            }
        }
    }

    // MARK: Member-picker

    private var memberPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Tildel til", subtitle: "Velg ansvarlig team-medlem")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(TeamData.members) { m in memberCard(m) }
                newMemberCard
            }
        }
    }

    private func memberCard(_ m: TeamMember) -> some View {
        let isSelected = selectedMember?.id == m.id
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selectedMember = m }
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(m.color.opacity(0.85))
                    Text(m.initials)
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(m.name)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(m.area)
                        .font(.system(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(m.color)
                }
            }
            .padding(10)
            .background(
                isSelected ? m.color.opacity(0.12) : TBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? m.color.opacity(0.55) : TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var newMemberCard: some View {
        Button { TeamStubActions.toast("Inviter ny selger") } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(TBrand.purple.opacity(0.22))
                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(TBrand.purpleLight)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Inviter ny selger")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Sender invitt-e-post")
                        .font(.system(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(TBrand.purpleLight)
            }
            .padding(10)
            .background(TBrand.purple.opacity(0.10),
                        in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(TBrand.purple.opacity(0.40), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Notify + handoff

    private var notifyCard: some View {
        Toggle(isOn: $notifyMember) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(TBrand.green.opacity(0.22))
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(TBrand.green)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Varsle \(selectedMember?.name.split(separator: " ").first.map(String.init) ?? "selger")")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Sender e-post + push m/ områdedetaljer")
                        .font(.system(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                }
            }
        }
        .tint(TBrand.purple)
        .padding(11)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var handoffCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Overlevering-notat (valgfritt)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $handoffNote)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .frame(minHeight: 70)
                    .padding(8)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
                if handoffNote.isEmpty {
                    Text("F.eks. nøkkel-leads, bransjefokus, eller forhandlingshistorikk")
                        .font(.system(size: 12))
                        .foregroundStyle(TBrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    // MARK: Confirm-bar

    private var confirmBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 7) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 14, weight: .bold))
                Text(confirmLabel)
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: canConfirm
                                ? [TBrand.purple, TBrand.purpleLight]
                                : [TBrand.cardHi, TBrand.cardHi],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(canConfirm ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!canConfirm)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(TBrand.bg.opacity(0.95).overlay(Rectangle().fill(TBrand.stroke).frame(height: 1), alignment: .top))
    }

    private var confirmLabel: String {
        guard let m = selectedMember else { return "Velg medlem først" }
        let first = m.name.split(separator: " ").first.map(String.init) ?? m.name
        switch mode {
        case .catalog:
            if let k = selectedCatalogKommune { return "Tildel \(k.name) til \(first)" }
            return "Velg kommune"
        case .existing:
            if let t = selectedExistingTerritory { return "Overfør \(t.areaName) til \(first)" }
            return "Velg eksisterende område"
        case .draw:
            if drawnPoints.count >= 3 { return "Tildel nytt område til \(first)" }
            return "Tegn minst 3 punkter"
        }
    }

    private func sectionTitle(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Text(subtitle)
                .font(.system(size: 11))
                .foregroundStyle(TBrand.textSecondary)
        }
    }

    private func formatThousands(_ n: Int) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }
}

// MARK: - DrawableMapView (tap = legg til polygon-hjørne)

struct DrawableMapView: UIViewRepresentable {
    @Binding var points: [CLLocationCoordinate2D]
    let previewColor: Color
    let pencilOnly: Bool

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.overrideUserInterfaceStyle = .dark
        map.pointOfInterestFilter = .excludingAll
        map.showsCompass = false
        map.showsScale = false
        map.isPitchEnabled = false
        let conf = MKStandardMapConfiguration(elevationStyle: .flat, emphasisStyle: .muted)
        conf.pointOfInterestFilter = .excludingAll
        map.preferredConfiguration = conf
        map.setRegion(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 59.920, longitude: 10.780),
            span: MKCoordinateSpan(latitudeDelta: 0.30, longitudeDelta: 0.55)
        ), animated: false)
        map.delegate = context.coordinator
        context.coordinator.map = map
        context.coordinator.onSetPoints = { points = $0 }
        context.coordinator.onAppendPoint = { points.append($0) }

        // Tap-gesture: legg til ett hjørne
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tap.delegate = context.coordinator
        map.addGestureRecognizer(tap)
        context.coordinator.tapGesture = tap

        // Pan-gesture: kontinuerlig free-form tegning (Apple Pencil-vennlig)
        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
        pan.maximumNumberOfTouches = 1
        pan.delegate = context.coordinator
        map.addGestureRecognizer(pan)
        context.coordinator.panGesture = pan

        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.previewColor = UIColor(previewColor)
        context.coordinator.pencilOnly = pencilOnly

        // Når pencilOnly er PÅ: tillat bare pencil-touch
        if pencilOnly {
            context.coordinator.tapGesture?.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
            context.coordinator.panGesture?.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
            // Slå av map-pan/zoom så pencil kan tegne fritt (ellers fanger map gester)
            map.isScrollEnabled = false
            map.isZoomEnabled = false
            map.isRotateEnabled = false
        } else {
            context.coordinator.tapGesture?.allowedTouchTypes = [
                NSNumber(value: UITouch.TouchType.direct.rawValue),
                NSNumber(value: UITouch.TouchType.pencil.rawValue)
            ]
            context.coordinator.panGesture?.allowedTouchTypes = [
                NSNumber(value: UITouch.TouchType.pencil.rawValue)  // pan er ALLTID pencil-bare
            ]
            map.isScrollEnabled = true
            map.isZoomEnabled = true
            map.isRotateEnabled = true
        }

        // Refresh overlays + annotations
        map.removeOverlays(map.overlays)
        map.removeAnnotations(map.annotations)
        if points.count >= 3 {
            map.addOverlay(MKPolygon(coordinates: points, count: points.count), level: .aboveRoads)
        } else if points.count == 2 {
            map.addOverlay(MKPolyline(coordinates: points, count: points.count))
        }
        for (i, p) in points.enumerated() {
            let ann = DrawPointAnnotation(coordinate: p, index: i + 1)
            map.addAnnotation(ann)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
        weak var map: MKMapView?
        weak var tapGesture: UITapGestureRecognizer?
        weak var panGesture: UIPanGestureRecognizer?
        var onAppendPoint: ((CLLocationCoordinate2D) -> Void)?
        var onSetPoints: (([CLLocationCoordinate2D]) -> Void)?
        var previewColor: UIColor = .systemPurple
        var pencilOnly: Bool = false

        private var samplingBuffer: [CLLocationCoordinate2D] = []
        private var lastSampleTime: TimeInterval = 0

        // La tap + pan kjøre uavhengig av map's egne gester
        func gestureRecognizer(_ gr: UIGestureRecognizer,
                                shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let map = map else { return }
            let point = gesture.location(in: map)
            let coord = map.convert(point, toCoordinateFrom: map)
            onAppendPoint?(coord)
        }

        @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
            guard let map = map else { return }
            let location = gesture.location(in: map)
            let coord = map.convert(location, toCoordinateFrom: map)
            switch gesture.state {
            case .began:
                samplingBuffer = [coord]
                lastSampleTime = CACurrentMediaTime()
            case .changed:
                // Throttle: maks 1 punkt per 50ms for å holde polygon-density rimelig
                let now = CACurrentMediaTime()
                if now - lastSampleTime > 0.05 {
                    samplingBuffer.append(coord)
                    lastSampleTime = now
                    onSetPoints?(samplingBuffer)
                }
            case .ended:
                // Forenkle path: hold maks ~30 punkter
                if samplingBuffer.count > 30 {
                    let step = max(1, samplingBuffer.count / 28)
                    samplingBuffer = stride(from: 0, to: samplingBuffer.count, by: step).map { samplingBuffer[$0] }
                }
                onSetPoints?(samplingBuffer)
            default: break
            }
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let poly = overlay as? MKPolygon {
                let r = MKPolygonRenderer(polygon: poly)
                r.fillColor = previewColor.withAlphaComponent(0.45)
                r.strokeColor = previewColor
                r.lineWidth = 3
                r.lineJoin = .round
                return r
            }
            if let line = overlay as? MKPolyline {
                let r = MKPolylineRenderer(polyline: line)
                r.strokeColor = previewColor
                r.lineWidth = 2.5
                r.lineDashPattern = [6, 4]
                return r
            }
            return MKOverlayRenderer(overlay: overlay)
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let ann = annotation as? DrawPointAnnotation else { return nil }
            let id = "DrawPoint"
            let view = (mapView.dequeueReusableAnnotationView(withIdentifier: id) as? DrawPointView)
                ?? DrawPointView(annotation: ann, reuseIdentifier: id)
            view.configure(index: ann.index, color: previewColor)
            return view
        }
    }
}

final class DrawPointAnnotation: NSObject, MKAnnotation {
    let coordinate: CLLocationCoordinate2D
    let index: Int
    init(coordinate: CLLocationCoordinate2D, index: Int) {
        self.coordinate = coordinate
        self.index = index
    }
}

final class DrawPointView: MKAnnotationView {
    private let label = UILabel()

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setupUI()
    }
    required init?(coder: NSCoder) { fatalError() }

    private func setupUI() {
        backgroundColor = .clear
        canShowCallout = false
        label.font = .systemFont(ofSize: 10, weight: .black)
        label.textColor = .white
        label.textAlignment = .center
        label.layer.cornerRadius = 11
        label.layer.borderWidth = 1.5
        label.layer.borderColor = UIColor.white.cgColor
        label.clipsToBounds = false
        addSubview(label)
        label.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
            label.widthAnchor.constraint(equalToConstant: 22),
            label.heightAnchor.constraint(equalToConstant: 22),
        ])
        frame = CGRect(x: 0, y: 0, width: 22, height: 22)
        centerOffset = .zero
    }

    func configure(index: Int, color: UIColor) {
        label.text = "\(index)"
        label.backgroundColor = color
        label.layer.cornerRadius = 11
        label.layer.masksToBounds = true
    }
}
