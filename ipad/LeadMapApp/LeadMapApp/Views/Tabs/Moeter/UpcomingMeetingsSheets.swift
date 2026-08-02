// UpcomingMeetingsSheets.swift
//
// 2 sheets for "Kommende møter":
//   - UpcomingMeetingDetailSheet: tap på mini-card → vis full detalj m/ adresse, kontakt,
//     prep-status, rute-stats + actions (Naviger, Planlegg, Ring, Logg notat)
//   - AllUpcomingMeetingsSheet: "Se alle møter" → full liste gruppert per dag, m/ søk + filter,
//     tap → åpner detail-sheet via callback

import SwiftUI
import MapKit

private enum UBrand {
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

// MARK: - UpcomingMeetingDetailSheet

struct UpcomingMeetingDetailSheet: View {
    let upcoming: UpcomingMeetingMini
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var showLogNote = false

    private var meeting: Meeting { upcoming.asMeeting() }

    /// Lukk sheeten og start ekte nav i Kart-motoren (start=true) eller
    /// sentrer for rute-forhåndsvisning (start=false).
    private func openNav(start: Bool) {
        appState.requestNavigation(
            lat: meeting.lat, lon: meeting.lon,
            name: meeting.company, address: meeting.address, start: start)
        dismiss()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    hero
                    statsRow
                    locationCard
                    contactCard
                    prepStatusCard
                    actionsCard
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(UBrand.bg.ignoresSafeArea())
            .navigationTitle("Kommende møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(UBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        // Reschedule/Inviter/Avlys fjernet 2026-07-17: var døde
                        // knapper — møte-mutasjon har ingen backend-flate enda.
                        Button { showLogNote = true } label: { Label("Logg notat", systemImage: "square.and.pencil") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundStyle(UBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(UBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { bottomBar }
            .sheet(isPresented: $showLogNote) {
                LogNoteSheet(meeting: meeting)
            }
        }
    }

    // MARK: hero

    private var hero: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 13) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(upcoming.iconColor.opacity(0.25))
                    Image(systemName: upcoming.icon)
                        .font(.appScaled(size: 22, weight: .bold))
                        .foregroundStyle(upcoming.iconColor)
                }
                .frame(width: 56, height: 56)
                VStack(alignment: .leading, spacing: 3) {
                    Text(upcoming.company)
                        .font(.appScaled(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 5) {
                        Image(systemName: "person.fill")
                            .font(.appScaled(size: 10))
                        Text("\(upcoming.contactName) · \(upcoming.contactRole)")
                            .font(.appScaled(size: 11))
                    }
                    .foregroundStyle(UBrand.textSecondary)
                }
                Spacer()
            }
            HStack(spacing: 6) {
                badge(upcoming.status.label, color: upcoming.status.color)
                Text("·").foregroundStyle(UBrand.textTertiary)
                badge(upcoming.leadType, color: UBrand.yellow)
                Text("·").foregroundStyle(UBrand.textTertiary)
                Text("Score \(upcoming.leadScore)")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(UBrand.purpleLight)
                Spacer()
                Text("NOK \(formatThousands(upcoming.valueNok))")
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(UBrand.green)
                    .monospacedDigit()
            }
            // Agenda-snippet
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(UBrand.purple.opacity(0.22))
                    Image(systemName: "text.bubble.fill")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(UBrand.purpleLight)
                }
                .frame(width: 28, height: 28)
                Text(upcoming.agenda)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
            }
            .padding(10)
            .background(UBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(UBrand.purple.opacity(0.30), lineWidth: 1))
        }
        .padding(16)
        .background(UBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(UBrand.stroke, lineWidth: 1))
    }

    private func badge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.appScaled(size: 10, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
    }

    // MARK: stats

    private var statsRow: some View {
        HStack(spacing: 10) {
            statBox(label: "Tidspunkt", value: upcoming.time, sub: upcoming.dayLabel, color: UBrand.purpleLight, icon: "clock.fill")
            statBox(label: "Kjøretid", value: upcoming.driveTimeMin > 0 ? "\(upcoming.driveTimeMin) min" : "Teams", sub: upcoming.driveDistanceKm > 0 ? "\(upcoming.driveDistanceKm) km" : "Online", color: UBrand.blue, icon: "car.fill")
            statBox(label: "Trafikk", value: upcoming.trafficStatus.components(separatedBy: " ").first ?? "—", sub: " ", color: trafficColor(upcoming.trafficStatus), icon: "exclamationmark.triangle.fill")
        }
    }

    private func trafficColor(_ s: String) -> Color {
        let lc = s.lowercased()
        if lc.contains("lett") { return UBrand.green }
        if lc.contains("tett") { return UBrand.red }
        if lc.contains("teams") { return UBrand.blue }
        return UBrand.orange
    }

    private func statBox(label: String, value: String, sub: String, color: Color, icon: String) -> some View {
        HStack(spacing: 9) {
            ZStack {
                Circle().fill(color.opacity(0.22))
                Image(systemName: icon)
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text(value)
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                Text(sub.isEmpty ? label : sub)
                    .font(.appScaled(size: 9))
                    .foregroundStyle(UBrand.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(UBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(UBrand.stroke, lineWidth: 1))
    }

    // MARK: location

    private var locationCard: some View {
        // Hele mini-kartet er hitmålet (Daniel-feedback 2026-07-01). Header-
        // CTA «Åpne i kart» droppet; erstattet med diskret pil + adresse i
        // header, og en «Åpne»-pille nederst i kartet som selv reagerer på tap.
        Button { openNav(start: false) } label: {
            VStack(alignment: .leading, spacing: 11) {
                HStack(spacing: 7) {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(UBrand.purpleLight)
                    Text("Sted")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Spacer()
                    Image(systemName: "arrow.up.right.square.fill")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(UBrand.purpleLight)
                }
                Text(upcoming.address)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if upcoming.lat != 0 {
                    ZStack(alignment: .bottomTrailing) {
                        Map(position: .constant(.region(MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: upcoming.lat, longitude: upcoming.lon),
                            span: MKCoordinateSpan(latitudeDelta: 0.025, longitudeDelta: 0.030)
                        ))), interactionModes: []) {
                            Annotation("", coordinate: CLLocationCoordinate2D(latitude: upcoming.lat, longitude: upcoming.lon)) {
                                ZStack {
                                    Circle().fill(upcoming.iconColor)
                                        .overlay(Circle().stroke(.white, lineWidth: 2.5))
                                        .frame(width: 28, height: 28)
                                    Image(systemName: upcoming.icon)
                                        .font(.appScaled(size: 11, weight: .bold))
                                        .foregroundStyle(.white)
                                }
                            }
                        }
                        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
                        .mapControls {}
                        .environment(\.colorScheme, .dark)
                        .frame(height: 140)
                        .clipShape(RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(UBrand.stroke, lineWidth: 1))
                        .allowsHitTesting(false)

                        HStack(spacing: 4) {
                            Image(systemName: "hand.tap.fill")
                                .font(.appScaled(size: 9, weight: .bold))
                            Text("Åpne i kart")
                                .font(.appScaled(size: 10, weight: .black))
                                .tracking(0.4)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(UBrand.purpleLight.opacity(0.95), in: Capsule())
                        .padding(8)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(UBrand.card, in: RoundedRectangle(cornerRadius: 13))
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(UBrand.stroke, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: 13))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Åpne \(upcoming.company) på kart")
    }

    // MARK: contact

    private var contactCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 7) {
                Image(systemName: "person.crop.circle.fill")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(UBrand.green)
                Text("Kontaktperson")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(UBrand.green.opacity(0.30))
                    Text(initials(upcoming.contactName))
                        .font(.appScaled(size: 13, weight: .black))
                        .foregroundStyle(UBrand.green)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(upcoming.contactName)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(upcoming.contactRole)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(UBrand.textSecondary)
                }
                Spacer()
                // Ring/e-post-ikoner fjernet 2026-07-17: var døde — møtemodellen
                // har ingen kontaktinfo-felter å ringe/maile enda.
            }
        }
        .padding(14)
        .background(UBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(UBrand.stroke, lineWidth: 1))
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        return parts.prefix(2).compactMap { $0.first }.map { String($0) }.joined()
    }

    // MARK: prep status

    private var prepStatusCard: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(upcoming.prepStatus.color.opacity(0.22))
                Image(systemName: upcoming.prepStatus.icon)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(upcoming.prepStatus.color)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 1) {
                Text("Forberedelse: \(upcoming.prepStatus.rawValue)")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Text(prepStatusDetail(upcoming.prepStatus))
                    .font(.appScaled(size: 11))
                    .foregroundStyle(UBrand.textSecondary)
            }
            Spacer()
            // «Åpne»-knapp fjernet 2026-07-17: var død — full prep-modal
            // åpnes fra Møter-fanens hovedliste, ikke herfra.
        }
        .padding(12)
        .background(UBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(upcoming.prepStatus.color.opacity(0.30), lineWidth: 1))
    }

    private func prepStatusDetail(_ s: UpcomingMeetingMini.PrepStatus) -> String {
        switch s {
        case .ready: return "Alt klart — agenda, tilbud, demo + materiale"
        case .partial: return "3 av 7 sjekkliste-punkter gjenstår"
        case .notStarted: return "Ingen forberedelse logget — start nå"
        }
    }

    // MARK: actions

    private var actionsCard: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                actionBtn(label: "Naviger", icon: "location.north.line.fill", primary: false, fullWidth: true) {
                    openNav(start: true)
                }
                actionBtn(label: "Åpne i kart", icon: "map.fill", primary: false, fullWidth: true) {
                    openNav(start: false)
                }
            }
            HStack(spacing: 8) {
                actionBtn(label: "Ring", icon: "phone.fill", primary: false, fullWidth: true) {}
                actionBtn(label: "Logg notat", icon: "square.and.pencil", primary: false, fullWidth: true) {
                    showLogNote = true
                }
            }
        }
    }

    private func actionBtn(label: String, icon: String, primary: Bool, fullWidth: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.appScaled(size: 11, weight: .bold))
                Text(label)
                    .font(.appScaled(size: 12, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .padding(.vertical, 12)
            .background(
                primary
                ? AnyShapeStyle(LinearGradient(colors: [UBrand.purple, UBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing))
                : AnyShapeStyle(UBrand.card),
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(primary ? Color.clear : UBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: bottom bar

    private var bottomBar: some View {
        HStack(spacing: 9) {
            Button { dismiss() } label: {
                Text("Lukk")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: 110)
                    .padding(.vertical, 13)
                    .background(UBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(UBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { openNav(start: true) } label: {
                HStack(spacing: 6) {
                    Image(systemName: "play.circle.fill")
                        .font(.appScaled(size: 14, weight: .bold))
                    Text("Start møte / Naviger")
                        .font(.appScaled(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(colors: [UBrand.purple, UBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(UBrand.bg.opacity(0.95).overlay(Rectangle().fill(UBrand.stroke).frame(height: 1), alignment: .top))
    }
}

private func formatThousands(_ n: Int) -> String {
    let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "
    return f.string(from: NSNumber(value: n)) ?? "\(n)"
}

// MARK: - AllUpcomingMeetingsSheet

struct AllUpcomingMeetingsSheet: View {
    let meetings: [UpcomingMeetingMini]
    let onPick: (UpcomingMeetingMini) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var search: String = ""
    @State private var filter: Filter = .all

    enum Filter: String, CaseIterable, Hashable {
        case all = "Alle"
        case ready = "Klare"
        case needsPrep = "Trenger prep"
        case bestValue = "Høyest verdi"
        var icon: String {
            switch self {
            case .all:        return "rectangle.stack.fill"
            case .ready:      return "checkmark.seal.fill"
            case .needsPrep:  return "exclamationmark.circle.fill"
            case .bestValue:  return "norwegiankronesign.circle.fill"
            }
        }
        var color: Color {
            switch self {
            case .all:        return UBrand.purpleLight
            case .ready:      return UBrand.green
            case .needsPrep:  return UBrand.orange
            case .bestValue:  return UBrand.yellow
            }
        }
    }

    private var filteredAndGrouped: [(day: String, items: [UpcomingMeetingMini])] {
        var items = meetings
        // Søk
        if !search.isEmpty {
            let q = search.lowercased()
            items = items.filter {
                $0.company.lowercased().contains(q) ||
                $0.contactName.lowercased().contains(q) ||
                $0.location.lowercased().contains(q)
            }
        }
        // Filter
        switch filter {
        case .all: break
        case .ready:
            items = items.filter { $0.prepStatus == .ready }
        case .needsPrep:
            items = items.filter { $0.prepStatus != .ready }
        case .bestValue:
            items.sort { $0.valueNok > $1.valueNok }
            return [(day: "Sortert: høyest verdi øverst", items: items)]
        }
        // Grupper på dayLabel
        var seen: [String] = []
        for it in items where !seen.contains(it.dayLabel) {
            seen.append(it.dayLabel)
        }
        return seen.map { d in (day: d, items: items.filter { $0.dayLabel == d }) }
    }

    private var totalValue: Int {
        meetings.reduce(0) { $0 + $1.valueNok }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    summaryCard
                    searchBar
                    filterChips
                    ForEach(filteredAndGrouped, id: \.day) { group in
                        daySection(group.day, items: group.items)
                    }
                    if filteredAndGrouped.flatMap({ $0.items }).isEmpty {
                        emptyState
                    }
                    Color.clear.frame(height: 24)
                }
                .padding(20)
            }
            .background(UBrand.bg.ignoresSafeArea())
            .navigationTitle("Alle kommende møter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(UBrand.purpleLight)
                }
                // Eksport-meny fjernet 2026-07-17: alle tre valgene var døde
                // (kalender/e-post/PDF har ingen implementasjon enda).
            }
            .toolbarBackground(UBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var summaryCard: some View {
        HStack(spacing: 0) {
            summaryStat(value: "\(meetings.count)", label: "Møter neste 7 dager", color: UBrand.purpleLight)
            divider
            summaryStat(value: "\(meetings.filter { $0.prepStatus == .ready }.count)", label: "Klare", color: UBrand.green)
            divider
            summaryStat(value: "NOK \(totalValue / 1000)k", label: "Total verdi", color: UBrand.yellow)
        }
        .padding(.vertical, 14)
        .background(UBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(UBrand.stroke, lineWidth: 1))
    }

    private func summaryStat(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.appScaled(size: 19, weight: .black, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.appScaled(size: 10))
                .foregroundStyle(UBrand.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle().fill(UBrand.stroke).frame(width: 1, height: 32)
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(UBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $search)
                    .foregroundStyle(.white)
                    .font(.appScaled(size: 13))
                if search.isEmpty {
                    Text("Søk bedrift, kontakt eller sted…")
                        .font(.appScaled(size: 13))
                        .foregroundStyle(UBrand.textTertiary)
                        .allowsHitTesting(false)
                }
            }
            if !search.isEmpty {
                Button { search = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(UBrand.textTertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(UBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(UBrand.stroke, lineWidth: 1))
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(Filter.allCases, id: \.self) { f in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { filter = f }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: f.icon)
                                .font(.appScaled(size: 10, weight: .bold))
                            Text(f.rawValue)
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(filter == f ? .white : f.color)
                        .padding(.horizontal, 11).padding(.vertical, 7)
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

    private func daySection(_ day: String, items: [UpcomingMeetingMini]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(day.uppercased())
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(UBrand.purpleLight)
                    .tracking(0.5)
                Text("\(items.count)")
                    .font(.appScaled(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(UBrand.textSecondary)
                    .monospacedDigit()
                    .padding(.horizontal, 5).padding(.vertical, 1)
                    .background(UBrand.cardHi, in: Capsule())
                Rectangle().fill(UBrand.stroke).frame(height: 1)
            }
            VStack(spacing: 8) {
                ForEach(items) { item in
                    listRow(item)
                }
            }
        }
    }

    private func listRow(_ u: UpcomingMeetingMini) -> some View {
        Button {
            dismiss()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                onPick(u)
            }
        } label: {
            HStack(spacing: 11) {
                // Tid-kolonne
                VStack(alignment: .center, spacing: 1) {
                    Text(u.time)
                        .font(.appScaled(size: 14, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                    Text(u.endTime)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(UBrand.textSecondary)
                        .monospacedDigit()
                }
                .frame(width: 50)
                Rectangle().fill(UBrand.stroke).frame(width: 1, height: 38)
                // Ikon
                ZStack {
                    RoundedRectangle(cornerRadius: 9)
                        .fill(u.iconColor.opacity(0.22))
                    Image(systemName: u.icon)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(u.iconColor)
                }
                .frame(width: 36, height: 36)
                // Hoved
                VStack(alignment: .leading, spacing: 2) {
                    Text(u.company)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        Text(u.contactName)
                            .font(.appScaled(size: 11))
                            .foregroundStyle(UBrand.textSecondary)
                            .lineLimit(1)
                        Text("·")
                            .foregroundStyle(UBrand.textTertiary)
                        Text(u.location)
                            .font(.appScaled(size: 11))
                            .foregroundStyle(UBrand.textSecondary)
                            .lineLimit(1)
                    }
                    Text(u.agenda)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(UBrand.textTertiary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                // Verdi + prep
                VStack(alignment: .trailing, spacing: 4) {
                    Text("NOK \(u.valueNok / 1000)k")
                        .font(.appScaled(size: 12, weight: .black, design: .rounded))
                        .foregroundStyle(UBrand.green)
                        .monospacedDigit()
                    HStack(spacing: 3) {
                        Image(systemName: u.prepStatus.icon)
                            .font(.appScaled(size: 8, weight: .bold))
                        Text(u.prepStatus.rawValue)
                            .font(.appScaled(size: 9, weight: .bold))
                    }
                    .foregroundStyle(u.prepStatus.color)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(u.prepStatus.color.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(u.prepStatus.color.opacity(0.4), lineWidth: 1))
                }
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(UBrand.textTertiary)
            }
            .padding(11)
            .background(UBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(UBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 9) {
            Image(systemName: "magnifyingglass")
                .font(.appScaled(size: 28, weight: .semibold))
                .foregroundStyle(UBrand.textTertiary)
            Text("Ingen møter funnet")
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Text("Prøv annet søk eller bytt filter")
                .font(.appScaled(size: 11))
                .foregroundStyle(UBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}
