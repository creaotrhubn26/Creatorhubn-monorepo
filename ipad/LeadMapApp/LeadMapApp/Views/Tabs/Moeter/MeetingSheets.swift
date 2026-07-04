// MeetingSheets.swift
//
// Sheets som åpnes fra MeetingDetailSidebar:
//   - StartMeetingSheet  (FaceTime/Meet/Telefon/Sjekk inn)
//   - NavigateSheet      (4 transport-modus + 3 nav-apper, samme som Kart-fanen)
//   - LogNoteSheet       (rask notat-input m/ AI-transkribering-stub)
//   - LeadDetailStub     (lett-vekt sheet for "Åpne lead")

import SwiftUI
import MapKit

private enum SBrand {
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

// MARK: - StartMeetingSheet

struct StartMeetingSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var mode: Mode = .checkIn

    enum Mode: String, CaseIterable, Hashable {
        case checkIn = "Sjekk inn (fysisk)"
        case facetime = "FaceTime"
        case googleMeet = "Google Meet"
        case phone = "Telefon"
        var icon: String {
            switch self {
            case .checkIn:    return "person.crop.circle.badge.checkmark"
            case .facetime:   return "video.circle.fill"
            case .googleMeet: return "video.fill"
            case .phone:      return "phone.fill"
            }
        }
        var color: Color {
            switch self {
            case .checkIn:    return SBrand.purple
            case .facetime:   return SBrand.green
            case .googleMeet: return SBrand.blue
            case .phone:      return SBrand.yellow
            }
        }
        var subtitle: String {
            switch self {
            case .checkIn:    return "Marker oppmøte + start timer"
            case .facetime:   return "Apple — alle plattformer"
            case .googleMeet: return "Auto-generert lenke"
            case .phone:      return "Ring kontakt direkte"
            }
        }
    }

    private func link(for mode: Mode) -> String? {
        let short = String(UUID().uuidString.prefix(8)).lowercased()
        switch mode {
        case .facetime:   return "https://facetime.apple.com/join#v=1&p=\(short)"
        case .googleMeet: return "https://meet.google.com/\(short.prefix(3))-\(short.dropFirst(3).prefix(4))-\(short.suffix(3))"
        case .phone:      return "tel://+4790012345"
        case .checkIn:    return nil
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    meetingHeader
                    modeGrid
                    if mode == .checkIn { checkInCard } else if let l = link(for: mode) { linkCard(l) }
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(SBrand.bg.ignoresSafeArea())
            .navigationTitle("Start møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(SBrand.purpleLight)
                }
            }
            .toolbarBackground(SBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { actionBar }
        }
    }

    private var meetingHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(meeting.startTime) - \(meeting.endTime) · Med \(meeting.contactName)")
                    .font(.system(size: 11))
                    .foregroundStyle(SBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var modeGrid: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Velg modus")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            VStack(spacing: 8) {
                ForEach(Mode.allCases, id: \.self) { m in
                    modeRow(m)
                }
            }
        }
    }

    private func modeRow(_ m: Mode) -> some View {
        let isSelected = mode == m
        return Button { mode = m } label: {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(m.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: m.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(m.color)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.rawValue)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(m.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 17))
                    .foregroundStyle(isSelected ? m.color : SBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? m.color.opacity(0.08) : SBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isSelected ? m.color.opacity(0.5) : SBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var checkInCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 9) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 13))
                    .foregroundStyle(SBrand.purpleLight)
                Text("Sjekk inn på adressen")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(SBrand.green.opacity(0.22))
                    Image(systemName: "location.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(SBrand.green)
                }
                .frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Du er innenfor 50m av adressen")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(meeting.address)
                        .font(.system(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(SBrand.green)
            }
            .padding(10)
            .background(SBrand.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 9))
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private func linkCard(_ link: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 9) {
                Image(systemName: mode.icon)
                    .font(.system(size: 13))
                    .foregroundStyle(mode.color)
                Text(mode == .phone ? "Telefon-nummer" : "\(mode.rawValue)-lenke")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button {
                    UIPasteboard.general.string = link
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 12))
                        .foregroundStyle(SBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            Text(link)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(SBrand.textSecondary)
                .lineLimit(2)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(SBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var actionBar: some View {
        Button {
            if let l = link(for: mode), let url = URL(string: l) {
                UIApplication.shared.open(url)
            }
            dismiss()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 14, weight: .bold))
                Text(actionLabel)
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [mode.color, mode.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            SBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(SBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    private var actionLabel: String {
        switch mode {
        case .checkIn:    return "Sjekk inn nå"
        case .facetime:   return "Start FaceTime"
        case .googleMeet: return "Åpne Google Meet"
        case .phone:      return "Ring nå"
        }
    }
}

// MARK: - NavigateSheet (lokal lett-vekt kopi for Møter)

struct NavigateMeetingSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var transport: Transport = .driving
    @State private var navApp: NavApp = .apple

    enum Transport: String, CaseIterable, Hashable {
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
            case .driving: return SBrand.purple
            case .walking: return SBrand.green
            case .cycling: return SBrand.yellow
            case .transit: return SBrand.blue
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
            case .apple:  return SBrand.blue
            case .google: return SBrand.red
            case .waze:   return SBrand.purpleLight
            }
        }
    }

    private let myLocation = CLLocationCoordinate2D(latitude: 59.913, longitude: 10.738)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    destinationCard
                    mapPreview
                    transportPicker
                    appPicker
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(SBrand.bg.ignoresSafeArea())
            .navigationTitle("Naviger til møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(SBrand.purpleLight)
                }
            }
            .toolbarBackground(SBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { startBar }
        }
    }

    private var destinationCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(SBrand.purple.opacity(0.25))
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(SBrand.purpleLight)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text(meeting.address)
                    .font(.system(size: 11))
                    .foregroundStyle(SBrand.textSecondary)
                if meeting.driveTimeMin > 0 {
                    Text("\(meeting.driveTimeMin) min · \(meeting.driveDistanceKm) km · \(meeting.trafficStatus)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(transport.color)
                }
            }
            Spacer()
        }
        .padding(13)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var mapPreview: some View {
        let dest = CLLocationCoordinate2D(latitude: meeting.lat, longitude: meeting.lon)
        let mid = CLLocationCoordinate2D(
            latitude: (myLocation.latitude + dest.latitude) / 2,
            longitude: (myLocation.longitude + dest.longitude) / 2
        )
        let dLat = abs(myLocation.latitude - dest.latitude) * 2.2
        let dLon = abs(myLocation.longitude - dest.longitude) * 2.2
        return Map(position: .constant(.region(MKCoordinateRegion(
            center: mid,
            span: MKCoordinateSpan(latitudeDelta: max(dLat, 0.01), longitudeDelta: max(dLon, 0.015))
        ))), interactionModes: []) {
            Annotation("", coordinate: myLocation) {
                ZStack {
                    Circle().fill(SBrand.blue.opacity(0.30)).frame(width: 30, height: 30)
                    Circle().fill(SBrand.blue).overlay(Circle().stroke(.white, lineWidth: 2)).frame(width: 14, height: 14)
                }
            }
            Annotation("", coordinate: dest) {
                ZStack {
                    Circle().fill(meeting.iconColor).overlay(Circle().stroke(.white, lineWidth: 2)).frame(width: 28, height: 28)
                    Image(systemName: meeting.icon).font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                }
            }
            MapPolyline(coordinates: [myLocation, dest])
                .stroke(LinearGradient(colors: [SBrand.blue, transport.color],
                                        startPoint: .leading, endPoint: .trailing),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [8, 6]))
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
        .mapControls {}
        .environment(\.colorScheme, .dark)
        .frame(height: 180)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var transportPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Transportmodus")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            HStack(spacing: 8) {
                ForEach(Transport.allCases, id: \.self) { t in
                    transportChip(t)
                }
            }
        }
    }

    private func transportChip(_ t: Transport) -> some View {
        let isSelected = transport == t
        let eta: Int
        switch t {
        case .driving: eta = meeting.driveTimeMin
        case .walking: eta = meeting.driveTimeMin * 6
        case .cycling: eta = meeting.driveTimeMin * 2
        case .transit: eta = meeting.driveTimeMin * 2
        }
        return Button { transport = t } label: {
            VStack(spacing: 5) {
                Image(systemName: t.icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : t.color)
                Text("\(eta) min")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(isSelected ? .white : .white)
                    .monospacedDigit()
                Text(t.rawValue)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(isSelected ? .white.opacity(0.85) : SBrand.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(
                isSelected ? AnyShapeStyle(t.color) : AnyShapeStyle(SBrand.card),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(isSelected ? Color.clear : SBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var appPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Åpne i")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            VStack(spacing: 6) {
                ForEach(NavApp.allCases, id: \.self) { a in
                    appRow(a)
                }
            }
        }
    }

    private func appRow(_ a: NavApp) -> some View {
        let isSelected = navApp == a
        return Button { navApp = a } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9)
                        .fill(a.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: a.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(a.color)
                }
                .frame(width: 36, height: 36)
                Text(a.rawValue)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 17))
                    .foregroundStyle(isSelected ? a.color : SBrand.stroke)
            }
            .padding(10)
            .background(isSelected ? a.color.opacity(0.08) : SBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(isSelected ? a.color.opacity(0.45) : SBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var startBar: some View {
        Button { openExternal(); dismiss() } label: {
            HStack(spacing: 8) {
                Image(systemName: navApp.icon)
                    .font(.system(size: 14, weight: .bold))
                Text("Start navigasjon i \(navApp.rawValue)")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [navApp.color, navApp.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(SBrand.bg.opacity(0.95).overlay(Rectangle().fill(SBrand.stroke).frame(height: 1), alignment: .top))
    }

    private func openExternal() {
        let lat = meeting.lat, lon = meeting.lon
        let modeFlag: String
        switch transport {
        case .driving: modeFlag = "d"
        case .walking: modeFlag = "w"
        case .cycling: modeFlag = "b"
        case .transit: modeFlag = "r"
        }
        let urlString: String
        switch navApp {
        case .apple:  urlString = "maps://?daddr=\(lat),\(lon)&dirflg=\(modeFlag)"
        case .google: urlString = "comgooglemaps://?daddr=\(lat),\(lon)&directionsmode=driving"
        case .waze:   urlString = "waze://?ll=\(lat),\(lon)&navigate=yes"
        }
        if let url = URL(string: urlString) { UIApplication.shared.open(url) }
    }
}

// MARK: - LogNoteSheet

struct LogNoteSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var note: String = ""
    @State private var category: NoteCategory = .general
    @State private var pinned: Bool = false

    enum NoteCategory: String, CaseIterable, Hashable {
        case general = "Generelt"
        case decision = "Beslutning"
        case action = "Handling"
        case concern = "Bekymring"
        case insight = "Innsikt"
        var icon: String {
            switch self {
            case .general:  return "note.text"
            case .decision: return "checkmark.circle.fill"
            case .action:   return "arrow.right.circle.fill"
            case .concern:  return "exclamationmark.triangle.fill"
            case .insight:  return "lightbulb.fill"
            }
        }
        var color: Color {
            switch self {
            case .general:  return SBrand.purpleLight
            case .decision: return SBrand.green
            case .action:   return SBrand.blue
            case .concern:  return SBrand.orange
            case .insight:  return SBrand.yellow
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    meetingCard
                    categoryRow
                    noteEditor
                    aiCard
                    pinToggle
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(SBrand.bg.ignoresSafeArea())
            .navigationTitle("Logg notat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(SBrand.purpleLight)
                }
            }
            .toolbarBackground(SBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { saveBar }
        }
    }

    private var meetingCard: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 9)
                    .fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Tirsdag 20. mai · \(meeting.startTime)-\(meeting.endTime)")
                    .font(.system(size: 11))
                    .foregroundStyle(SBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var categoryRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Type")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(NoteCategory.allCases, id: \.self) { c in
                        Button { category = c } label: {
                            HStack(spacing: 5) {
                                Image(systemName: c.icon)
                                    .font(.system(size: 10, weight: .semibold))
                                Text(c.rawValue)
                                    .font(.system(size: 11, weight: .semibold))
                            }
                            .foregroundStyle(category == c ? .white : c.color)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                category == c ? c.color : c.color.opacity(0.15),
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(c.color.opacity(0.4), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var noteEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Notat")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $note)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                    .frame(minHeight: 140)
                    .padding(10)
                    .background(SBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
                if note.isEmpty {
                    Text("Hva ble diskutert? Hvilke beslutninger? Hvem skal gjøre hva?")
                        .font(.system(size: 13))
                        .foregroundStyle(SBrand.textTertiary)
                        .padding(.horizontal, 14).padding(.vertical, 17)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var aiCard: some View {
        Button {} label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(LinearGradient(
                        colors: [SBrand.purple, SBrand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    Image(systemName: "mic.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Spille inn + transkribere")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text("AI lager automatisk strukturert notat etterpå")
                        .font(.system(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(SBrand.textTertiary)
            }
            .padding(12)
            .background(SBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(SBrand.purple.opacity(0.30), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var pinToggle: some View {
        Toggle(isOn: $pinned) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(SBrand.yellow.opacity(0.22))
                    Image(systemName: "pin.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(SBrand.yellow)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Fest notat øverst")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Vises først i lead-historikk")
                        .font(.system(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
            }
        }
        .tint(SBrand.purple)
        .padding(10)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var saveBar: some View {
        HStack(spacing: 10) {
            Button { dismiss() } label: {
                Text("Avbryt")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(SBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { dismiss() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 13, weight: .bold))
                    Text("Lagre notat")
                        .font(.system(size: 14, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(colors: [SBrand.purple, SBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
            .disabled(note.isEmpty)
            .opacity(note.isEmpty ? 0.5 : 1)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(SBrand.bg.opacity(0.95).overlay(Rectangle().fill(SBrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - KartTabSheet (in-app Kart-fanen fokusert på dette møtet)

struct KartTabSheet: View {
    let meeting: Meeting
    let startInNavMode: Bool
    @Environment(\.dismiss) private var dismiss
    @State private var position: MapCameraPosition
    @State private var transport: NavTransport = .driving
    @State private var navigating: Bool = false
    @State private var fullScreenNav: Bool = false

    enum NavTransport: String, CaseIterable, Hashable {
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
            case .driving: return SBrand.purple
            case .walking: return SBrand.green
            case .cycling: return SBrand.yellow
            case .transit: return SBrand.blue
            }
        }
        func eta(base: Int) -> Int {
            switch self {
            case .driving: return base
            case .walking: return base * 6
            case .cycling: return base * 2
            case .transit: return base * 2
            }
        }
    }

    private let myLocation = CLLocationCoordinate2D(latitude: 59.913, longitude: 10.738)

    init(meeting: Meeting, startInNavMode: Bool = false) {
        self.meeting = meeting
        self.startInNavMode = startInNavMode
        _navigating = State(initialValue: startInNavMode)
        _fullScreenNav = State(initialValue: false)
        let dest = CLLocationCoordinate2D(latitude: meeting.lat, longitude: meeting.lon)
        let me = CLLocationCoordinate2D(latitude: 59.913, longitude: 10.738)
        let mid = CLLocationCoordinate2D(
            latitude: (me.latitude + dest.latitude) / 2,
            longitude: (me.longitude + dest.longitude) / 2
        )
        let dLat = abs(me.latitude - dest.latitude) * 2.4
        let dLon = abs(me.longitude - dest.longitude) * 2.4
        _position = State(initialValue: .region(MKCoordinateRegion(
            center: mid,
            span: MKCoordinateSpan(latitudeDelta: max(dLat, 0.02), longitudeDelta: max(dLon, 0.025))
        )))
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                mapLayer
                topBar
                VStack { Spacer(); routeInfoCard }
            }
            .background(SBrand.bg.ignoresSafeArea())
            .navigationBarHidden(true)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .fullScreenCover(isPresented: $fullScreenNav) {
            NavigationFullScreenView(meeting: meeting, transport: transport)
        }
    }

    private var mapLayer: some View {
        let dest = CLLocationCoordinate2D(latitude: meeting.lat, longitude: meeting.lon)
        return Map(position: $position) {
            // Min posisjon
            Annotation("Du", coordinate: myLocation) {
                ZStack {
                    Circle().fill(SBrand.blue.opacity(0.25)).frame(width: 44, height: 44)
                    Circle().fill(SBrand.blue).overlay(Circle().stroke(.white, lineWidth: 3)).frame(width: 18, height: 18)
                }
            }
            // Destinasjon (møtet)
            Annotation(meeting.company, coordinate: dest) {
                VStack(spacing: 3) {
                    ZStack {
                        Circle().fill(meeting.iconColor.opacity(0.30)).frame(width: 50, height: 50)
                        Circle().fill(meeting.iconColor).overlay(Circle().stroke(.white, lineWidth: 3)).frame(width: 32, height: 32)
                        Image(systemName: meeting.icon)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    Text(meeting.company)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(SBrand.bg.opacity(0.85), in: Capsule())
                        .overlay(Capsule().stroke(SBrand.stroke, lineWidth: 1))
                }
            }
            // Rute (rett linje — i prod: MKDirections-polyline)
            MapPolyline(coordinates: [myLocation, dest])
                .stroke(
                    LinearGradient(colors: [SBrand.blue, SBrand.purpleLight, meeting.iconColor],
                                   startPoint: .leading, endPoint: .trailing),
                    style: StrokeStyle(lineWidth: 5, lineCap: .round, dash: [10, 6])
                )
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .including([.publicTransport])))
        .mapControls { MapCompass(); MapScaleView() }
        .environment(\.colorScheme, .dark)
        .ignoresSafeArea()
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            Button { dismiss() } label: {
                ZStack {
                    Circle().fill(SBrand.card)
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 38, height: 38)
                .overlay(Circle().stroke(SBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 1) {
                Text("Kart")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Fokusert på \(meeting.company)")
                    .font(.system(size: 10))
                    .foregroundStyle(SBrand.textSecondary)
            }
            Spacer()

            Button {
                let dest = CLLocationCoordinate2D(latitude: meeting.lat, longitude: meeting.lon)
                position = .region(MKCoordinateRegion(
                    center: dest,
                    span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.010)
                ))
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "scope")
                        .font(.system(size: 11, weight: .semibold))
                    Text("Sentrér")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 11).padding(.vertical, 9)
                .background(SBrand.card, in: Capsule())
                .overlay(Capsule().stroke(SBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16).padding(.top, 12)
    }

    private var routeInfoCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(meeting.iconColor.opacity(0.22))
                    Image(systemName: meeting.icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(meeting.iconColor)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(meeting.company)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(meeting.address)
                        .font(.system(size: 11))
                        .foregroundStyle(SBrand.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
            }

            transportChips

            HStack(spacing: 0) {
                routeStat(value: "\(transport.eta(base: meeting.driveTimeMin))", unit: "min", label: "Kjøretid", color: transport.color)
                divider
                routeStat(value: "\(meeting.driveDistanceKm)", unit: "km", label: "Avstand", color: SBrand.blue)
                divider
                routeStat(value: meeting.trafficStatus.components(separatedBy: " ").first ?? meeting.trafficStatus,
                          unit: "trafikk", label: "Status",
                          color: meeting.trafficStatus.lowercased().contains("lett") ? SBrand.green :
                                 (meeting.trafficStatus.lowercased().contains("tett") ? SBrand.red : SBrand.orange))
            }
            .padding(.vertical, 4)

            HStack(spacing: 8) {
                Button { dismiss() } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .bold))
                        Text("Lukk")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(SBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
                Button {
                    fullScreenNav = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "location.north.line.fill")
                            .font(.system(size: 11, weight: .bold))
                        Text("Start kjøretur")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [SBrand.purple, SBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 11)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(SBrand.stroke, lineWidth: 1))
        .padding(.horizontal, 16).padding(.bottom, 20)
        .shadow(color: .black.opacity(0.45), radius: 18, y: 6)
    }

    private var transportChips: some View {
        HStack(spacing: 6) {
            ForEach(NavTransport.allCases, id: \.self) { t in
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { transport = t }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: t.icon)
                            .font(.system(size: 10, weight: .semibold))
                        Text("\(t.eta(base: meeting.driveTimeMin)) min")
                            .font(.system(size: 11, weight: .bold))
                            .monospacedDigit()
                    }
                    .foregroundStyle(transport == t ? .white : t.color)
                    .padding(.horizontal, 9).padding(.vertical, 7)
                    .frame(maxWidth: .infinity)
                    .background(
                        transport == t ? AnyShapeStyle(t.color) : AnyShapeStyle(t.color.opacity(0.15)),
                        in: Capsule()
                    )
                    .overlay(Capsule().stroke(t.color.opacity(transport == t ? 0 : 0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var nextDirectionRow: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(SBrand.purple.opacity(0.25))
                Image(systemName: "arrow.turn.up.right")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(SBrand.purpleLight)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text("Sving til høyre i Vitaminveien")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Text("om 400 m")
                    .font(.system(size: 10))
                    .foregroundStyle(SBrand.textSecondary)
            }
            Spacer()
            Text("ETA \(arrivalTime)")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(SBrand.green)
                .monospacedDigit()
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(SBrand.green.opacity(0.15), in: Capsule())
        }
        .padding(10)
        .background(SBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.purple.opacity(0.30), lineWidth: 1))
    }

    private var arrivalTime: String {
        let cal = Calendar.current
        let now = Date()
        let arrival = cal.date(byAdding: .minute, value: transport.eta(base: meeting.driveTimeMin), to: now) ?? now
        let f = DateFormatter(); f.dateFormat = "HH:mm"
        return f.string(from: arrival)
    }

    private func routeStat(value: String, unit: String, label: String, color: Color) -> some View {
        VStack(spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(value)
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(color)
                    .monospacedDigit()
                Text(unit)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(color.opacity(0.8))
            }
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(SBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle()
            .fill(SBrand.stroke)
            .frame(width: 1, height: 32)
    }
}

// MARK: - NavigationFullScreenView (ekte fullscreen turn-by-turn HUD)

enum POIKind: String, CaseIterable, Hashable {
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
        case .charging: return Color(red: 0.20, green: 0.85, blue: 0.60)
        case .gas:      return Color(red: 0.98, green: 0.55, blue: 0.10)
        }
    }
    var detourLabel: String {
        switch self {
        case .charging: return "Lading langs ruten"
        case .gas:      return "Bensinstasjoner langs ruten"
        }
    }
}

struct RoutePOI: Identifiable, Hashable {
    let id = UUID()
    let kind: POIKind
    let name: String
    let brandName: String         // "Tesla", "Circle K", "Shell", "Esso"…
    let lat: Double
    let lon: Double
    let detourMin: Int            // +min ekstra vs hoved-ruten
    let availableStalls: Int      // for gas: 0 = ikke vist
    let totalStalls: Int
    // Charging-spesifikt
    let maxKW: Int                // 0 hvis ikke charging
    let connectors: [String]      // ["CCS", "Type 2", "CHAdeMO"]
    let priceKwh: Double          // NOK / kWh
    // Gas-spesifikt
    let fuelTypes: [String]       // ["95", "98", "Diesel"]
    let price95: Double           // NOK / liter
    let priceDiesel: Double

    var brandColor: Color {
        switch brandName {
        case "Tesla":    return Color(red: 0.90, green: 0.15, blue: 0.20)
        case "Recharge": return Color(red: 0.20, green: 0.85, blue: 0.60)
        case "Fortum":   return Color(red: 0.20, green: 0.55, blue: 0.95)
        case "Mer":      return Color(red: 0.55, green: 0.30, blue: 0.95)
        case "Eviny":    return Color(red: 0.98, green: 0.55, blue: 0.10)
        case "Circle K": return Color(red: 0.92, green: 0.30, blue: 0.10)
        case "Shell":    return Color(red: 0.98, green: 0.70, blue: 0.05)
        case "Esso":     return Color(red: 0.20, green: 0.30, blue: 0.70)
        case "YX":       return Color(red: 0.85, green: 0.15, blue: 0.20)
        case "Uno-X":    return Color(red: 0.05, green: 0.45, blue: 0.85)
        default:         return kind.tint
        }
    }
}

struct NavigationFullScreenView: View {
    let meeting: Meeting
    let transport: KartTabSheet.NavTransport
    @Environment(\.dismiss) private var dismiss

    @State private var position: MapCameraPosition
    @State private var elapsed: TimeInterval = 0
    @State private var currentStepIndex: Int = 0
    @State private var activeKinds: Set<POIKind> = []         // skjult som standard
    @State private var selectedPOI: RoutePOI?
    @State private var showMileageSheet: Bool = false
    @State private var dismissedAlertIDs: Set<UUID> = []      // brukeren avviste disse
    @State private var proximityRadiusKm: Double = 6.0        // når en POI regnes som "nær" (~10 min unna)

    private let myLocation = CLLocationCoordinate2D(latitude: 59.913, longitude: 10.738)
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    // Mock POI-er langs ruten Oslo → Nordic Elektro (Vitaminveien 1)
    private var pois: [RoutePOI] {
        let dest = CLLocationCoordinate2D(latitude: meeting.lat, longitude: meeting.lon)
        let dLat = dest.latitude - myLocation.latitude
        let dLon = dest.longitude - myLocation.longitude
        func coord(_ t: Double, jitterLat: Double, jitterLon: Double) -> (Double, Double) {
            (myLocation.latitude + dLat * t + jitterLat,
             myLocation.longitude + dLon * t + jitterLon)
        }
        let c1 = coord(0.22, jitterLat:  0.002, jitterLon: -0.003)
        let c2 = coord(0.34, jitterLat: -0.004, jitterLon:  0.002)
        let c3 = coord(0.50, jitterLat: -0.003, jitterLon:  0.004)
        let c4 = coord(0.62, jitterLat:  0.005, jitterLon: -0.002)
        let c5 = coord(0.72, jitterLat:  0.003, jitterLon:  0.001)
        let c6 = coord(0.82, jitterLat: -0.002, jitterLon:  0.004)
        let c7 = coord(0.90, jitterLat:  0.002, jitterLon: -0.002)

        return [
            // Lading
            RoutePOI(kind: .charging, name: "Tesla Supercharger Sandvika",
                     brandName: "Tesla", lat: c1.0, lon: c1.1, detourMin: 2,
                     availableStalls: 6, totalStalls: 12,
                     maxKW: 250, connectors: ["CCS","Type 2"], priceKwh: 4.90,
                     fuelTypes: [], price95: 0, priceDiesel: 0),
            RoutePOI(kind: .charging, name: "Recharge Bærum",
                     brandName: "Recharge", lat: c3.0, lon: c3.1, detourMin: 3,
                     availableStalls: 2, totalStalls: 4,
                     maxKW: 150, connectors: ["CCS","CHAdeMO"], priceKwh: 5.20,
                     fuelTypes: [], price95: 0, priceDiesel: 0),
            RoutePOI(kind: .charging, name: "Fortum Charge & Drive",
                     brandName: "Fortum", lat: c5.0, lon: c5.1, detourMin: 1,
                     availableStalls: 1, totalStalls: 3,
                     maxKW: 150, connectors: ["CCS","Type 2"], priceKwh: 4.50,
                     fuelTypes: [], price95: 0, priceDiesel: 0),
            RoutePOI(kind: .charging, name: "Mer Storo",
                     brandName: "Mer", lat: c7.0, lon: c7.1, detourMin: 4,
                     availableStalls: 3, totalStalls: 4,
                     maxKW: 50, connectors: ["CCS","Type 2","CHAdeMO"], priceKwh: 4.20,
                     fuelTypes: [], price95: 0, priceDiesel: 0),
            // Bensin
            RoutePOI(kind: .gas, name: "Circle K Sandvika",
                     brandName: "Circle K", lat: c2.0, lon: c2.1, detourMin: 1,
                     availableStalls: 0, totalStalls: 0,
                     maxKW: 0, connectors: [], priceKwh: 0,
                     fuelTypes: ["95","98","Diesel"], price95: 21.89, priceDiesel: 19.95),
            RoutePOI(kind: .gas, name: "Shell Bærum",
                     brandName: "Shell", lat: c4.0, lon: c4.1, detourMin: 2,
                     availableStalls: 0, totalStalls: 0,
                     maxKW: 0, connectors: [], priceKwh: 0,
                     fuelTypes: ["95","98","Diesel"], price95: 22.20, priceDiesel: 20.10),
            RoutePOI(kind: .gas, name: "Esso Skøyen",
                     brandName: "Esso", lat: c6.0, lon: c6.1, detourMin: 3,
                     availableStalls: 0, totalStalls: 0,
                     maxKW: 0, connectors: [], priceKwh: 0,
                     fuelTypes: ["95","98","Diesel"], price95: 21.50, priceDiesel: 19.80),
        ]
    }

    private var visiblePOIs: [RoutePOI] { pois.filter { activeKinds.contains($0.kind) } }

    private struct NavStep: Identifiable, Hashable {
        let id = UUID()
        let icon: String
        let instruction: String
        let distanceMeters: Int
        let road: String
    }

    private var steps: [NavStep] {
        [
            NavStep(icon: "arrow.up", instruction: "Fortsett rett frem", distanceMeters: 800, road: "Storgata"),
            NavStep(icon: "arrow.turn.up.right", instruction: "Sving til høyre", distanceMeters: 400, road: "Vitaminveien"),
            NavStep(icon: "arrow.turn.up.left", instruction: "Sving til venstre", distanceMeters: 250, road: "Vitaminveien 1"),
            NavStep(icon: "mappin.circle.fill", instruction: "Du har ankommet", distanceMeters: 0, road: meeting.company),
        ]
    }

    init(meeting: Meeting, transport: KartTabSheet.NavTransport) {
        self.meeting = meeting
        self.transport = transport
        let me = CLLocationCoordinate2D(latitude: 59.913, longitude: 10.738)
        let dest = CLLocationCoordinate2D(latitude: meeting.lat, longitude: meeting.lon)
        let mid = CLLocationCoordinate2D(
            latitude: (me.latitude + dest.latitude) / 2,
            longitude: (me.longitude + dest.longitude) / 2
        )
        // Start zoomet ut nok til å vise hele ruten + POI-er
        let routeKm = max(meeting.driveDistanceKm, 5)
        let distMeters = Double(routeKm) * 1500
        _position = State(initialValue: .camera(MapCamera(
            centerCoordinate: mid,
            distance: distMeters,
            heading: bearing(from: me, to: dest),
            pitch: 35
        )))
    }

    var body: some View {
        ZStack(alignment: .top) {
            mapLayer
            VStack(spacing: 0) {
                instructionBanner
                poiToggleStrip
                travelPlannerCard
                proximityAlertStack
                Spacer()
                if let s = selectedPOI { poiDetailCard(s) }
                bottomHUD
            }
        }
        .background(Color.black.ignoresSafeArea())
        .statusBarHidden()
        .onReceive(timer) { _ in elapsed += 1 }
        .sheet(isPresented: $showMileageSheet) {
            MileageSheet(meeting: meeting, drivenKm: meeting.driveDistanceKm)
        }
    }

    private var mapLayer: some View {
        let dest = CLLocationCoordinate2D(latitude: meeting.lat, longitude: meeting.lon)
        return Map(position: $position) {
            Annotation("", coordinate: myLocation) {
                ZStack {
                    Circle().fill(SBrand.blue.opacity(0.30)).frame(width: 64, height: 64)
                        .scaleEffect(1 + 0.1 * sin(elapsed * 1.2))
                    Circle().fill(SBrand.blue).overlay(Circle().stroke(.white, lineWidth: 4)).frame(width: 26, height: 26)
                    // Retnings-trekant
                    Image(systemName: "location.north.fill")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(.white)
                }
            }
            Annotation(meeting.company, coordinate: dest) {
                VStack(spacing: 4) {
                    ZStack {
                        Circle().fill(meeting.iconColor.opacity(0.35)).frame(width: 60, height: 60)
                        Circle().fill(meeting.iconColor).overlay(Circle().stroke(.white, lineWidth: 3)).frame(width: 36, height: 36)
                        Image(systemName: meeting.icon)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    Text(meeting.company)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(SBrand.bg.opacity(0.92), in: Capsule())
                        .overlay(Capsule().stroke(SBrand.stroke, lineWidth: 1))
                }
            }
            MapPolyline(coordinates: [myLocation, dest])
                .stroke(
                    LinearGradient(colors: [SBrand.blue, SBrand.purpleLight, meeting.iconColor],
                                   startPoint: .leading, endPoint: .trailing),
                    style: StrokeStyle(lineWidth: 9, lineCap: .round, lineJoin: .round)
                )

            ForEach(visiblePOIs) { poi in
                Annotation("", coordinate: CLLocationCoordinate2D(latitude: poi.lat, longitude: poi.lon)) {
                    Button {
                        withAnimation(.spring(response: 0.32, dampingFraction: 0.85)) {
                            selectedPOI = selectedPOI?.id == poi.id ? nil : poi
                        }
                    } label: {
                        poiPin(poi)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic, emphasis: .muted, pointsOfInterest: .including([.publicTransport])))
        .mapControls {}
        .environment(\.colorScheme, .dark)
        .ignoresSafeArea()
    }

    private func poiPin(_ p: RoutePOI) -> some View {
        let isSelected = selectedPOI?.id == p.id
        // Tilgjengelighet/pris-prikk
        let dotColor: Color = {
            switch p.kind {
            case .charging:
                if p.availableStalls == 0 { return SBrand.red }
                if p.availableStalls <= max(1, p.totalStalls / 3) { return SBrand.orange }
                return SBrand.green
            case .gas:
                // Lavest pris = grønn, høyest = orange
                return p.price95 <= 21.70 ? SBrand.green : (p.price95 <= 22.00 ? SBrand.orange : SBrand.red)
            }
        }()
        let badgeText: String = {
            switch p.kind {
            case .charging: return "\(p.maxKW)"
            case .gas:      return String(format: "%.1f", p.price95)
            }
        }()
        return ZStack {
            if isSelected {
                Circle().fill(p.brandColor.opacity(0.30))
                    .frame(width: 60, height: 60)
                    .scaleEffect(1 + 0.05 * sin(elapsed * 2))
            }
            RoundedRectangle(cornerRadius: 9)
                .fill(p.brandColor)
                .frame(width: isSelected ? 40 : 32, height: isSelected ? 40 : 32)
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(.white, lineWidth: 2.5))
                .shadow(color: .black.opacity(0.5), radius: 4, y: 2)
            Image(systemName: p.kind.icon)
                .font(.system(size: isSelected ? 17 : 14, weight: .black))
                .foregroundStyle(.white)
            Circle()
                .fill(dotColor)
                .overlay(Circle().stroke(.white, lineWidth: 1.5))
                .frame(width: 11, height: 11)
                .offset(x: 14, y: -14)
            Text(badgeText)
                .font(.system(size: 8, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .padding(.horizontal, 4).padding(.vertical, 1)
                .background(p.brandColor, in: Capsule())
                .overlay(Capsule().stroke(.white, lineWidth: 1))
                .offset(y: 22)
        }
    }

    // MARK: POI toggle-strip (POI-overlay er SKJULT som standard)

    private var poiToggleStrip: some View {
        let allOn = activeKinds == Set(POIKind.allCases)
        let anyOn = !activeKinds.isEmpty

        return HStack(spacing: 8) {
            // Hovedtoggle: Skjul/Vis POI
            Menu {
                Button {
                    withAnimation { activeKinds = Set(POIKind.allCases); dismissedAlertIDs.removeAll() }
                } label: {
                    Label("Vis alle POI", systemImage: "eye.fill")
                }
                Divider()
                ForEach(POIKind.allCases, id: \.self) { kind in
                    Button {
                        withAnimation {
                            if activeKinds.contains(kind) { activeKinds.remove(kind) } else { activeKinds.insert(kind) }
                        }
                    } label: {
                        Label(activeKinds.contains(kind) ? "Skjul \(kind.rawValue.lowercased())" : "Vis \(kind.rawValue.lowercased())",
                              systemImage: kind.icon)
                    }
                }
                Divider()
                Button {
                    withAnimation { activeKinds.removeAll() }
                } label: {
                    Label("Skjul alle POI", systemImage: "eye.slash.fill")
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: anyOn ? "eye.fill" : "eye.slash.fill")
                        .font(.system(size: 11, weight: .bold))
                    Text(anyOn ? (allOn ? "POI vises" : "POI delvis") : "POI skjult")
                        .font(.system(size: 11, weight: .bold))
                    Image(systemName: "chevron.down")
                        .font(.system(size: 8, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 11).padding(.vertical, 7)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke(SBrand.stroke, lineWidth: 1))
            }

            // Smart-varsel-indikator
            if !anyOn && !proximityAlerts.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "bell.badge.fill")
                        .font(.system(size: 10, weight: .bold))
                    Text("\(proximityAlerts.count) i nærheten")
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(SBrand.yellow)
                .padding(.horizontal, 9).padding(.vertical, 6)
                .background(SBrand.yellow.opacity(0.15), in: Capsule())
                .overlay(Capsule().stroke(SBrand.yellow.opacity(0.4), lineWidth: 1))
            }

            Spacer()
            Button { showMileageSheet = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: "norwegiankronesign.circle.fill")
                        .font(.system(size: 11, weight: .bold))
                    Text("Kjøregodtgjørelse")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 11).padding(.vertical, 7)
                .background(
                    LinearGradient(colors: [SBrand.purple, SBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Capsule()
                )
                .shadow(color: SBrand.purple.opacity(0.4), radius: 6, y: 2)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.top, 10)
    }

    // MARK: Proximity-varsler (vises kun når POI-overlay er skjult)

    // Beregner avstand fra my-location til POI (krude Haversine; god nok for visning)
    private func distanceKm(to p: RoutePOI) -> Double {
        let R = 6371.0
        let lat1 = myLocation.latitude * .pi / 180
        let lat2 = p.lat * .pi / 180
        let dLat = (p.lat - myLocation.latitude) * .pi / 180
        let dLon = (p.lon - myLocation.longitude) * .pi / 180
        let a = sin(dLat/2)*sin(dLat/2) + cos(lat1)*cos(lat2)*sin(dLon/2)*sin(dLon/2)
        let c = 2 * atan2(sqrt(a), sqrt(1-a))
        return R * c
    }

    // Nærmeste POI per type, innen radius, og ikke avvist av brukeren
    private var proximityAlerts: [RoutePOI] {
        guard activeKinds.isEmpty || activeKinds.count < POIKind.allCases.count else { return [] }
        var result: [RoutePOI] = []
        for kind in POIKind.allCases where !activeKinds.contains(kind) {
            let nearest = pois
                .filter { $0.kind == kind && !dismissedAlertIDs.contains($0.id) }
                .map { ($0, distanceKm(to: $0)) }
                .filter { $0.1 <= proximityRadiusKm }
                .min(by: { $0.1 < $1.1 })
            if let n = nearest { result.append(n.0) }
        }
        return result
    }

    @ViewBuilder
    private var proximityAlertStack: some View {
        if !proximityAlerts.isEmpty {
            VStack(spacing: 8) {
                ForEach(proximityAlerts) { p in
                    proximityAlertRow(p)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .padding(.horizontal, 14).padding(.top, 8)
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: proximityAlerts)
        }
    }

    private func proximityAlertRow(_ p: RoutePOI) -> some View {
        let km = distanceKm(to: p)
        let minsAway = max(1, Int(km / 0.55))  // ~33 km/t i by → ~0.55 km/min
        let brandColor: Color = p.brandColor
        let strokeColor: Color = brandColor.opacity(0.45)
        let summary: String = {
            switch p.kind {
            case .charging: return "\(p.maxKW) kW · \(p.availableStalls)/\(p.totalStalls) ledig · \(String(format: "%.2f", p.priceKwh)) kr/kWh"
            case .gas:      return "95: \(String(format: "%.2f", p.price95)) kr · Diesel: \(String(format: "%.2f", p.priceDiesel)) kr"
            }
        }()
        return HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(p.brandColor)
                Image(systemName: p.kind.icon)
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 36, height: 36)
            .overlay(
                Circle().fill(SBrand.green)
                    .overlay(Circle().stroke(.white, lineWidth: 1.5))
                    .frame(width: 10, height: 10)
                    .offset(x: 13, y: -13)
            )
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Text("\(p.kind.rawValue) \(minsAway) min unna")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text("· \(String(format: "%.1f km", km))")
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundStyle(SBrand.textSecondary)
                        .monospacedDigit()
                }
                Text("\(p.brandName) — \(summary)")
                    .font(.system(size: 10))
                    .foregroundStyle(SBrand.textSecondary)
                    .lineLimit(1)
            }
            Spacer()
            Button {
                withAnimation {
                    activeKinds.insert(p.kind)
                    selectedPOI = p
                }
            } label: {
                Text("Vis")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(brandColor, in: Capsule())
            }
            .buttonStyle(.plain)
            Button {
                withAnimation {
                    _ = dismissedAlertIDs.insert(p.id)
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(SBrand.textSecondary)
                    .padding(7)
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(strokeColor, lineWidth: 1))
        )
        .shadow(color: .black.opacity(0.4), radius: 10, y: 3)
    }

    // MARK: Reiseplanlegger (avgangstid)

    private var travelPlannerCard: some View {
        let meetingHour = Int(meeting.startTime.split(separator: ":").first ?? "9") ?? 9
        let meetingMin = Int(meeting.startTime.split(separator: ":").last ?? "0") ?? 0
        // Reisetid + 10 min buffer
        let totalMin = transport.eta(base: meeting.driveTimeMin) + 10
        let now = Date()
        let cal = Calendar.current
        var meetingDate = cal.date(bySettingHour: meetingHour, minute: meetingMin, second: 0, of: now) ?? now
        if meetingDate < now { meetingDate = cal.date(byAdding: .day, value: 1, to: meetingDate) ?? meetingDate }
        let departBy = cal.date(byAdding: .minute, value: -totalMin, to: meetingDate) ?? now
        let minsUntilDepart = Int(departBy.timeIntervalSince(now) / 60)
        let urgent = minsUntilDepart <= 5
        let f = DateFormatter(); f.dateFormat = "HH:mm"

        return HStack(spacing: 12) {
            ZStack {
                Circle().fill((urgent ? SBrand.red : SBrand.green).opacity(0.22))
                Image(systemName: urgent ? "exclamationmark.triangle.fill" : "checkmark.shield.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(urgent ? SBrand.red : SBrand.green)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(urgent ? "Reis nå for å være i tide" : "Anbefalt avgangstid")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                HStack(spacing: 4) {
                    Text(f.string(from: departBy))
                        .font(.system(size: 13, weight: .black, design: .rounded))
                        .foregroundStyle(urgent ? SBrand.red : SBrand.green)
                        .monospacedDigit()
                    Text("·")
                        .foregroundStyle(SBrand.textTertiary)
                    Text(minsUntilDepart >= 0 ? "om \(minsUntilDepart) min" : "\(-minsUntilDepart) min forsinket")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(SBrand.textSecondary)
                        .monospacedDigit()
                    Text("·")
                        .foregroundStyle(SBrand.textTertiary)
                    Text("inkl. 10 min buffer")
                        .font(.system(size: 10))
                        .foregroundStyle(SBrand.textTertiary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("Møte \(meeting.startTime)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text(meeting.trafficStatus)
                    .font(.system(size: 9))
                    .foregroundStyle(SBrand.textSecondary)
            }
        }
        .padding(11)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke((urgent ? SBrand.red : SBrand.green).opacity(0.45), lineWidth: 1)
        )
        .padding(.horizontal, 14).padding(.top, 8)
    }

    // MARK: POI-detalj-popup

    @ViewBuilder
    private func poiDetailCard(_ p: RoutePOI) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(p.brandColor)
                    Image(systemName: p.kind.icon)
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.name)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 6) {
                        Text(p.brandName)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(p.brandColor)
                        Text("·")
                            .foregroundStyle(SBrand.textTertiary)
                        HStack(spacing: 3) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 9))
                            Text("+\(p.detourMin) min omvei")
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(SBrand.textSecondary)
                    }
                }
                Spacer()
                Button {
                    withAnimation { selectedPOI = nil }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(SBrand.textTertiary)
                }
                .buttonStyle(.plain)
            }

            // Kind-spesifikke detaljer
            if p.kind == .charging {
                chargingDetails(p)
            } else {
                gasDetails(p)
            }

            HStack(spacing: 8) {
                Button {} label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.triangle.turn.up.right.diamond.fill")
                            .font(.system(size: 11, weight: .bold))
                        Text("Legg til som stopp")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [p.brandColor, p.brandColor.opacity(0.7)],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 11)
                    )
                }
                .buttonStyle(.plain)
                Button {} label: {
                    Image(systemName: "info.circle.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.vertical, 11)
                        .padding(.horizontal, 14)
                        .background(SBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(SBrand.stroke, lineWidth: 1))
        .padding(.horizontal, 14).padding(.bottom, 8)
        .shadow(color: .black.opacity(0.55), radius: 18, y: 6)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private func chargingDetails(_ p: RoutePOI) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 0) {
                detailStat(value: "\(p.maxKW)", unit: "kW", label: "Maks effekt", color: p.brandColor)
                detailDivider
                detailStat(value: String(format: "%.2f", p.priceKwh), unit: "kr/kWh", label: "Pris", color: SBrand.purpleLight)
                detailDivider
                detailStat(value: "\(p.availableStalls)/\(p.totalStalls)", unit: "", label: "Ledige", color: p.availableStalls > 0 ? SBrand.green : SBrand.red)
            }
            HStack(spacing: 6) {
                ForEach(p.connectors, id: \.self) { c in
                    Text(c)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(SBrand.cardHi, in: Capsule())
                        .overlay(Capsule().stroke(SBrand.stroke, lineWidth: 1))
                }
                Spacer()
            }
        }
    }

    private func gasDetails(_ p: RoutePOI) -> some View {
        HStack(spacing: 0) {
            detailStat(value: String(format: "%.2f", p.price95), unit: "kr/l", label: "Bensin 95", color: SBrand.green)
            detailDivider
            detailStat(value: String(format: "%.2f", p.priceDiesel), unit: "kr/l", label: "Diesel", color: SBrand.blue)
            detailDivider
            detailStat(value: "\(p.fuelTypes.count)", unit: "typer", label: "Drivstoff", color: SBrand.orange)
        }
    }

    private func detailStat(value: String, unit: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(color)
                    .monospacedDigit()
                if !unit.isEmpty {
                    Text(unit)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(color.opacity(0.8))
                }
            }
            Text(label)
                .font(.system(size: 9))
                .foregroundStyle(SBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var detailDivider: some View {
        Rectangle().fill(SBrand.stroke).frame(width: 1, height: 24)
    }

    private var currentStep: NavStep { steps[min(currentStepIndex, steps.count - 1)] }
    private var nextStep: NavStep? { currentStepIndex + 1 < steps.count ? steps[currentStepIndex + 1] : nil }

    private var instructionBanner: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(SBrand.purple.opacity(0.30))
                    Image(systemName: currentStep.icon)
                        .font(.system(size: 26, weight: .black))
                        .foregroundStyle(SBrand.purpleLight)
                }
                .frame(width: 62, height: 62)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        if currentStep.distanceMeters > 0 {
                            Text("\(currentStep.distanceMeters >= 1000 ? String(format: "%.1f km", Double(currentStep.distanceMeters)/1000) : "\(currentStep.distanceMeters) m")")
                                .font(.system(size: 24, weight: .black, design: .rounded))
                                .foregroundStyle(.white)
                                .monospacedDigit()
                        } else {
                            Text("Ankommet")
                                .font(.system(size: 22, weight: .black))
                                .foregroundStyle(SBrand.green)
                        }
                    }
                    Text(currentStep.instruction)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(currentStep.road)
                        .font(.system(size: 12))
                        .foregroundStyle(SBrand.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                Button {
                    if currentStepIndex < steps.count - 1 {
                        withAnimation(.easeInOut(duration: 0.25)) { currentStepIndex += 1 }
                    }
                } label: {
                    Image(systemName: "forward.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(10)
                        .background(SBrand.cardHi, in: Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16).padding(.vertical, 14)

            if let next = nextStep {
                Divider().overlay(SBrand.stroke)
                HStack(spacing: 10) {
                    Image(systemName: next.icon)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(SBrand.textSecondary)
                    Text("Deretter \(next.instruction.lowercased()) i \(next.road)")
                        .font(.system(size: 12))
                        .foregroundStyle(SBrand.textSecondary)
                        .lineLimit(1)
                    Spacer()
                }
                .padding(.horizontal, 16).padding(.vertical, 9)
            }
        }
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(SBrand.stroke, lineWidth: 1))
        .shadow(color: .black.opacity(0.55), radius: 18, y: 6)
        .padding(.horizontal, 14).padding(.top, 14)
    }

    private var bottomHUD: some View {
        VStack(spacing: 0) {
            // Quick-actions
            HStack(spacing: 10) {
                hudIconButton(icon: "speaker.wave.2.fill", color: SBrand.blue)
                hudIconButton(icon: "magnifyingglass", color: SBrand.purpleLight)
                hudIconButton(icon: "fuelpump.fill", color: SBrand.orange)
                hudIconButton(icon: "phone.fill", color: SBrand.green)
            }
            .padding(.horizontal, 16).padding(.bottom, 12)

            // ETA-card
            HStack(spacing: 0) {
                hudStat(value: arrivalTime, label: "Ankomst", color: SBrand.green)
                divider
                hudStat(value: remainingTime, label: "Igjen", color: SBrand.purpleLight)
                divider
                hudStat(value: "\(meeting.driveDistanceKm) km", label: "Avstand", color: SBrand.blue)
            }
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)

            // Avslutt-knapp
            Button { dismiss() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13, weight: .bold))
                    Text("Avslutt navigasjon")
                        .font(.system(size: 14, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    LinearGradient(colors: [SBrand.red, Color(red: 0.75, green: 0.15, blue: 0.15)],
                                   startPoint: .leading, endPoint: .trailing)
                )
            }
            .buttonStyle(.plain)
        }
        .background(SBrand.bg.opacity(0.95))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(SBrand.stroke, lineWidth: 1)
        )
        .padding(.horizontal, 14).padding(.bottom, 16)
        .shadow(color: .black.opacity(0.55), radius: 18, y: -4)
    }

    private func hudIconButton(icon: String, color: Color) -> some View {
        Button {} label: {
            ZStack {
                Circle().fill(.ultraThinMaterial)
                Circle().stroke(SBrand.stroke, lineWidth: 1)
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 50, height: 50)
        }
        .buttonStyle(.plain)
        .shadow(color: .black.opacity(0.4), radius: 8, y: 2)
    }

    private func hudStat(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 19, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
                .textCase(.uppercase)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle().fill(SBrand.stroke).frame(width: 1, height: 34)
    }

    private var arrivalTime: String {
        let mins = transport.eta(base: meeting.driveTimeMin)
        let arrival = Calendar.current.date(byAdding: .minute, value: mins, to: Date()) ?? Date()
        let f = DateFormatter(); f.dateFormat = "HH:mm"
        return f.string(from: arrival)
    }

    private var remainingTime: String {
        let mins = transport.eta(base: meeting.driveTimeMin)
        if mins >= 60 {
            return "\(mins / 60) t \(mins % 60) m"
        }
        return "\(mins) min"
    }
}

// Bearing fra punkt A til B (grader, 0=Nord)
private func bearing(from a: CLLocationCoordinate2D, to b: CLLocationCoordinate2D) -> CLLocationDirection {
    let lat1 = a.latitude * .pi / 180
    let lat2 = b.latitude * .pi / 180
    let dLon = (b.longitude - a.longitude) * .pi / 180
    let y = sin(dLon) * cos(lat2)
    let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
    return (atan2(y, x) * 180 / .pi).truncatingRemainder(dividingBy: 360)
}

// MARK: - ToastBubble

struct ToastBubble: View {
    let text: String
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.green)
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(SBrand.stroke, lineWidth: 1))
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }
}

// MARK: - LeadDetailStub (lett-vekt sheet for "Åpne lead")

struct LeadDetailStub: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    hero
                    statsRow
                    contactCard
                    activitySummary
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(SBrand.bg.ignoresSafeArea())
            .navigationTitle(meeting.company)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(SBrand.purpleLight)
                }
            }
            .toolbarBackground(SBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var hero: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 11)
                    .fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 3) {
                Text(meeting.company)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                Text(meeting.location)
                    .font(.system(size: 12))
                    .foregroundStyle(SBrand.textSecondary)
                HStack(spacing: 5) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 10))
                    Text(meeting.leadType + " · score \(meeting.leadScore)")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(SBrand.yellow)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(SBrand.yellow.opacity(0.18), in: Capsule())
            }
            Spacer()
        }
        .padding(16)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            statBox(label: "Forventet verdi", value: "650K", color: SBrand.green)
            statBox(label: "Sannsynlighet", value: "65 %",   color: SBrand.purpleLight)
            statBox(label: "Lead-score",     value: "\(meeting.leadScore)",  color: SBrand.yellow)
        }
    }

    private func statBox(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(SBrand.textSecondary)
            Text(value)
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(11)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var contactCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Primær kontakt")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(SBrand.purple.opacity(0.25))
                    Text("JE")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(SBrand.purpleLight)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(meeting.contactName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(meeting.contactRole)
                        .font(.system(size: 11))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
            }
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var activitySummary: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Siste aktivitet")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(SBrand.blue.opacity(0.20))
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(SBrand.blue)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Tilbud sendt")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("15. mai 14:18 · Lars Kristensen")
                        .font(.system(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
            }
            .padding(10)
            .background(SBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }
}

// MARK: - MileageSheet (Kjøregodtgjørelse — statens sats + bom)

struct MileageSheet: View {
    let meeting: Meeting
    let drivenKm: Int
    @Environment(\.dismiss) private var dismiss

    @State private var vehicleType: VehicleType = .car
    @State private var passengers: Int = 0
    @State private var towing: Bool = false
    @State private var includeToll: Bool = true
    @State private var returnTrip: Bool = true
    @State private var notes: String = ""

    enum VehicleType: String, CaseIterable, Hashable {
        case car = "Personbil"
        case ev = "El-bil"
        case motorcycle = "Motorsykkel"
        case moped = "Moped"
        var icon: String {
            switch self {
            case .car:        return "car.fill"
            case .ev:         return "bolt.car.fill"
            case .motorcycle: return "scooter"
            case .moped:      return "scooter"
            }
        }
        // Statens sats 2026 (skattefri) — forenklet
        var baseRate: Double {
            switch self {
            case .car:        return 3.50
            case .ev:         return 3.60   // 3.50 + 0.10 el-tillegg
            case .motorcycle: return 2.95
            case .moped:      return 1.80
            }
        }
    }

    // Beregninger
    private var totalKm: Int { returnTrip ? drivenKm * 2 : drivenKm }
    private var baseAmount: Double { Double(totalKm) * vehicleType.baseRate }
    private var passengerAmount: Double { Double(totalKm) * 1.00 * Double(passengers) }
    private var towingAmount: Double { towing ? Double(totalKm) * 1.00 : 0 }
    // Bom-estimat: ~50 NOK per passering, anslå 1-2 passeringer hver vei
    private var tollAmount: Double { includeToll ? Double(returnTrip ? 2 : 1) * 55.0 : 0 }
    private var totalAmount: Double { baseAmount + passengerAmount + towingAmount + tollAmount }

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
            .background(SBrand.bg.ignoresSafeArea())
            .navigationTitle("Kjøregodtgjørelse")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(SBrand.purpleLight)
                }
            }
            .toolbarBackground(SBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { actionBar }
        }
    }

    private var tripCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(SBrand.purple.opacity(0.22))
                    Image(systemName: "location.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(SBrand.purpleLight)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Tirsdag 20. mai 2025")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Møte: \(meeting.company)")
                        .font(.system(size: 11))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
            }
            HStack(spacing: 14) {
                tripLeg(icon: "location.circle.fill", color: SBrand.blue, title: "Fra", subtitle: "Oslo (kontor)")
                Image(systemName: "arrow.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(SBrand.textTertiary)
                tripLeg(icon: "mappin.circle.fill", color: meeting.iconColor, title: "Til", subtitle: meeting.address)
            }
            HStack(spacing: 14) {
                Label("\(drivenKm) km enveis", systemImage: "ruler.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(SBrand.textSecondary)
                Spacer()
                Toggle(isOn: $returnTrip) {
                    Text("Inkluder retur")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .tint(SBrand.purple)
                .frame(maxWidth: 170)
            }
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private func tripLeg(icon: String, color: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(color)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(SBrand.textTertiary)
                    .textCase(.uppercase)
                Text(subtitle)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var vehiclePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kjøretøy")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            HStack(spacing: 8) {
                ForEach(VehicleType.allCases, id: \.self) { v in
                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) { vehicleType = v }
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: v.icon)
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(vehicleType == v ? .white : SBrand.purpleLight)
                            Text(v.rawValue)
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(vehicleType == v ? .white : .white.opacity(0.85))
                            Text(String(format: "%.2f kr/km", v.baseRate))
                                .font(.system(size: 9, weight: .semibold, design: .rounded))
                                .foregroundStyle(vehicleType == v ? .white.opacity(0.85) : SBrand.textSecondary)
                                .monospacedDigit()
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(
                            vehicleType == v ? AnyShapeStyle(SBrand.purple) : AnyShapeStyle(SBrand.card),
                            in: RoundedRectangle(cornerRadius: 11)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 11)
                            .stroke(vehicleType == v ? Color.clear : SBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var optionsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Passasjerer
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 6) {
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(SBrand.purpleLight)
                    Text("Passasjerer")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Text("+1,00 kr/km per passasjer")
                        .font(.system(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
                HStack(spacing: 6) {
                    ForEach(0...3, id: \.self) { n in
                        Button {
                            withAnimation(.easeInOut(duration: 0.15)) { passengers = n }
                        } label: {
                            Text("\(n)")
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundStyle(passengers == n ? .white : .white.opacity(0.8))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(
                                    passengers == n ? AnyShapeStyle(SBrand.purple) : AnyShapeStyle(SBrand.cardHi),
                                    in: RoundedRectangle(cornerRadius: 9)
                                )
                                .overlay(RoundedRectangle(cornerRadius: 9)
                                    .stroke(passengers == n ? Color.clear : SBrand.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            Divider().overlay(SBrand.stroke)
            // Tilhenger
            Toggle(isOn: $towing) {
                HStack(spacing: 6) {
                    Image(systemName: "truck.box.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(SBrand.purpleLight)
                    Text("Tilhenger / utstyr")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Text("+1,00 kr/km")
                        .font(.system(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
            }
            .tint(SBrand.purple)
            // Bompenger
            Toggle(isOn: $includeToll) {
                HStack(spacing: 6) {
                    Image(systemName: "road.lanes")
                        .font(.system(size: 11))
                        .foregroundStyle(SBrand.purpleLight)
                    Text("Inkluder bompenger (estimat)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Text("~55 kr / passering")
                        .font(.system(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
            }
            .tint(SBrand.purple)
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var breakdownCard: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Beregning")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("Statens sats 2026")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(SBrand.green)
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(SBrand.green.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(SBrand.green.opacity(0.4), lineWidth: 1))
            }
            .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 10)
            Divider().overlay(SBrand.stroke)
            VStack(spacing: 0) {
                breakdownRow(
                    label: "Grunn-sats",
                    detail: "\(totalKm) km × \(String(format: "%.2f", vehicleType.baseRate))",
                    value: baseAmount
                )
                if passengers > 0 {
                    breakdownRow(
                        label: "Passasjer-tillegg",
                        detail: "\(totalKm) km × 1,00 × \(passengers)",
                        value: passengerAmount
                    )
                }
                if towing {
                    breakdownRow(
                        label: "Tilhenger",
                        detail: "\(totalKm) km × 1,00",
                        value: towingAmount
                    )
                }
                if includeToll {
                    breakdownRow(
                        label: "Bompenger",
                        detail: "\(returnTrip ? 2 : 1) passering × 55,00",
                        value: tollAmount
                    )
                }
            }
        }
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private func breakdownRow(label: String, detail: String, value: Double) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Text(detail)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(SBrand.textSecondary)
            }
            Spacer()
            Text(String(format: "%.2f kr", value))
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .overlay(Divider().overlay(SBrand.stroke), alignment: .bottom)
    }

    private var totalCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("Total kjøregodtgjørelse")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
                Text("Skattefri etter statens sats")
                    .font(.system(size: 9))
                    .foregroundStyle(.white.opacity(0.65))
            }
            Spacer()
            Text(String(format: "%.2f kr", totalAmount))
                .font(.system(size: 26, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(16)
        .background(
            LinearGradient(colors: [SBrand.purple, SBrand.purpleLight],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .shadow(color: SBrand.purple.opacity(0.5), radius: 14, y: 6)
    }

    private var notesCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Notat (valgfritt)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $notes)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .frame(minHeight: 70)
                    .padding(8)
                    .background(SBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
                if notes.isEmpty {
                    Text("F.eks. møte-formål, ekstra omveier…")
                        .font(.system(size: 12))
                        .foregroundStyle(SBrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var actionBar: some View {
        HStack(spacing: 9) {
            Button {} label: {
                HStack(spacing: 5) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 12, weight: .bold))
                    Text("PDF")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: 110)
                .padding(.vertical, 13)
                .background(SBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { dismiss() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 13, weight: .bold))
                    Text("Logg \(String(format: "%.0f kr", totalAmount))")
                        .font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(colors: [SBrand.green, Color(red: 0.10, green: 0.65, blue: 0.45)],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(SBrand.bg.opacity(0.95).overlay(Rectangle().fill(SBrand.stroke).frame(height: 1), alignment: .top))
    }
}
