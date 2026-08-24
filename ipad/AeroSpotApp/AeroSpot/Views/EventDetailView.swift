// EventDetailView.swift — rik arrangements-detaljside: program, deltakende
// fly, venue-kart, og sporet billett-lenke (via backend redirect så
// arrangør-samarbeid kan måle konvertering).

import SwiftUI
import MapKit

struct EventDetailView: View {
    let event: AeroEvent
    /// Full versjon hentes ved åpning (listen har lett data).
    @State private var full: AeroEvent?

    private var e: AeroEvent { full ?? event }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.spacingLG) {
                header
                if let venue = venueCoordinate { venueMap(venue) }
                Text(e.description)
                    .font(.body)
                    .foregroundStyle(Theme.textSecondary)
                if let venue = venueCoordinate { lightGuide(venue) }
                if let program = e.program, !program.isEmpty {
                    InteractiveProgram(
                        event: e,
                        program: program,
                        venue: venueCoordinate,
                        lightFor: lightForAct
                    )
                }
                if let aircraft = e.aircraft, !aircraft.isEmpty { aircraftSection(aircraft) }
                ticketButton
                contactSection
                links
            }
            .padding(Theme.spacingLG)
        }
        .background(Theme.background)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            full = await AeroSpotAPI.event(id: event.id)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack(spacing: 6) {
                Text(e.name)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                if e.verified == true {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(Theme.primaryBright)
                }
            }
            if e.verified == true {
                Text("Verifisert arrangør")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.primaryBright)
            }
            Label(e.venue, systemImage: "mappin.and.ellipse")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
            Label(dateText, systemImage: "calendar")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
        }
    }

    private var venueCoordinate: CLLocationCoordinate2D? {
        guard let lat = e.latitude, let lon = e.longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private func venueMap(_ coord: CLLocationCoordinate2D) -> some View {
        let pins = e.venueMap ?? []
        // Zoom tettere når arrangøren har lagt inn områdepunkter.
        let span = pins.isEmpty ? 0.08 : 0.012
        return VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Map(initialPosition: .region(MKCoordinateRegion(
                center: coord,
                span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
            ))) {
                Marker(e.venue, coordinate: coord).tint(Theme.primary)
                ForEach(pins) { pin in
                    let kind = VenuePinKind.from(pin.type)
                    Annotation(pin.name, coordinate:
                        CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude)) {
                        Image(systemName: kind.systemImage)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(6)
                            .background(pinColor(kind))
                            .clipShape(Circle())
                            .overlay(Circle().stroke(.white, lineWidth: 1.5))
                    }
                }
            }
            .frame(height: pins.isEmpty ? 160 : 220)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))

            if !pins.isEmpty {
                venueLegend(pins)
            }
        }
    }

    private func venueLegend(_ pins: [VenuePin]) -> some View {
        let kinds = Set(pins.map { VenuePinKind.from($0.type) })
        return FlexWrap(spacing: Theme.spacingSM) {
            ForEach(VenuePinKind.allCases.filter { kinds.contains($0) }, id: \.self) { kind in
                HStack(spacing: 5) {
                    Image(systemName: kind.systemImage)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(4)
                        .background(pinColor(kind))
                        .clipShape(Circle())
                    Text(kind.label).font(.caption2).foregroundStyle(Theme.textSecondary)
                }
            }
        }
    }

    private func pinColor(_ kind: VenuePinKind) -> Color {
        switch kind {
        case .photo: return Theme.gold
        case .entrance: return Theme.success
        case .parking: return Theme.primary
        case .food: return Theme.warning
        case .toilet: return Theme.textTertiary
        case .firstaid: return Theme.danger
        case .display: return Theme.primaryBright
        }
    }

    // ── Event-modus: lys gjennom dagen på venue ──────────────────────

    /// Bygg Date fra event-dato + "HH:mm" i norsk tid.
    private func eventDate(time: String) -> Date? {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "Europe/Oslo")
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f.date(from: "\(e.startDate) \(time)")
    }

    private func lightGuide(_ venue: CLLocationCoordinate2D) -> some View {
        // Soltider på venue for arrangementsdatoen
        let noon = eventDate(time: "12:00") ?? Date()
        let sun = SunService.times(date: noon, coordinate: venue)
        return VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack(spacing: 6) {
                Image(systemName: "sun.max.fill").font(.caption).foregroundStyle(Theme.gold)
                Text("LYS PÅ VENUE DENNE DAGEN")
                    .font(.system(size: 10, weight: .bold)).tracking(0.8)
                    .foregroundStyle(Theme.textSecondary)
            }
            HStack(spacing: Theme.spacingSM) {
                ValueTile(label: "Golden hour", value: formatTime(sun.goldenHourStart))
                ValueTile(label: "Solnedgang", value: formatTime(sun.sunset))
                ValueTile(label: "Blue hour", value: formatTime(sun.blueHourStart))
            }
        }
        .padding(Theme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
    }

    /// Lys-etikett for et programpunkt: solretning + kvalitet ved klokkeslettet.
    private func lightForAct(_ time: String) -> (label: String, color: Color)? {
        guard let venue = venueCoordinate, let date = eventDate(time: time) else { return nil }
        let pos = SunService.position(date: date, coordinate: venue)
        if pos.elevationDeg < -1 { return ("Mørkt", Theme.textTertiary) }
        let dir = Geo.compassLabel(pos.azimuthDeg)
        if pos.elevationDeg < 8 {
            return ("Lavt gyllent lys · sol i \(dir)", Theme.gold)
        }
        if pos.elevationDeg > 45 {
            return ("Hardt topplys · sol i \(dir)", Theme.warning)
        }
        return ("Godt lys · sol i \(dir), \(Int(pos.elevationDeg))°", Theme.success)
    }


    private func aircraftSection(_ aircraft: [String]) -> some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("DELTAKENDE FLY")
                .font(.system(size: 10, weight: .bold)).tracking(0.8)
                .foregroundStyle(Theme.textSecondary)
            FlowChips(items: aircraft)
        }
    }

    @ViewBuilder
    private var ticketButton: some View {
        if let ticket = e.ticketUrl, !ticket.isEmpty,
           let url = URL(string: "\(AeroSpotAPI.baseURL.absoluteString)/api/aerospot/events/\(e.id)/ticket") {
            Link(destination: url) {
                Label("Kjøp billett", systemImage: "ticket.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.spacingMD)
                    .background(Theme.primary)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
        }
    }

    /// Kontakt arrangør — e-post/telefon rett til (verifisert) arrangør.
    @ViewBuilder
    private var contactSection: some View {
        let email = e.contactEmail?.trimmingCharacters(in: .whitespaces)
        let phone = e.contactPhone?.trimmingCharacters(in: .whitespaces)
        let hasEmail = !(email ?? "").isEmpty
        let hasPhone = !(phone ?? "").isEmpty
        if hasEmail || hasPhone {
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                Text("Kontakt arrangør")
                    .font(.headline)
                    .foregroundStyle(Theme.textPrimary)
                if hasEmail, let url = URL(string: "mailto:\(email!)") {
                    Link(destination: url) {
                        Label(email!, systemImage: "envelope.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.primaryBright)
                    }
                }
                if hasPhone,
                   let url = URL(string: "tel:\(phone!.filter { !$0.isWhitespace })") {
                    Link(destination: url) {
                        Label(phone!, systemImage: "phone.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.primaryBright)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.spacingMD)
            .background(Theme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
        }
    }

    @ViewBuilder
    private var links: some View {
        if let urlString = e.url, let url = URL(string: urlString) {
            Link(destination: url) {
                Label("Arrangørens nettside", systemImage: "arrow.up.right.square")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.primaryBright)
            }
        }
    }

    private var dateText: String {
        let inFmt = DateFormatter(); inFmt.dateFormat = "yyyy-MM-dd"
        let out = DateFormatter(); out.locale = Locale(identifier: "nb_NO"); out.dateFormat = "d. MMMM yyyy"
        guard let start = inFmt.date(from: e.startDate) else { return e.startDate }
        if e.startDate == e.endDate { return out.string(from: start) }
        if let end = inFmt.date(from: e.endDate) {
            return "\(out.string(from: start)) – \(out.string(from: end))"
        }
        return out.string(from: start)
    }
}

/// Enkel wrap-layout for fly-chips.
private struct FlowChips: View {
    let items: [String]
    var body: some View {
        FlexWrap(spacing: Theme.spacingSM) {
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, Theme.spacingMD)
                    .padding(.vertical, Theme.spacingSM)
                    .background(Theme.surfaceElevated)
                    .foregroundStyle(Theme.textPrimary)
                    .clipShape(Capsule())
            }
        }
    }
}

/// Minimal flex-wrap container (iOS 16-kompatibel via Layout).
struct FlexWrap: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX { x = bounds.minX; y += rowHeight + spacing; rowHeight = 0 }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// Interaktivt dagsprogram: live «nå/neste»-status, trykkbare punkter med
/// lys-tips og påminnelse. Gjør programmet levende under arrangementet.
struct InteractiveProgram: View {
    let event: AeroEvent
    let program: [EventProgramItem]
    let venue: CLLocationCoordinate2D?
    let lightFor: (String) -> (label: String, color: Color)?

    @State private var expanded: Int?
    @State private var reminded: Set<Int> = []
    @State private var now = Date()

    private let ticker = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    private func actDate(_ time: String) -> Date? {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "Europe/Oslo")
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f.date(from: "\(event.startDate) \(time)")
    }

    /// Indeks for pågående act (siste hvis tid passert) og neste.
    private var liveState: (current: Int?, next: Int?) {
        var current: Int?
        var next: Int?
        for (i, item) in program.enumerated() {
            guard let d = actDate(item.time) else { continue }
            if d <= now { current = i } else if next == nil { next = i }
        }
        return (current, next)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            header
            VStack(spacing: 0) {
                ForEach(Array(program.enumerated()), id: \.offset) { idx, item in
                    row(idx, item)
                    if idx < program.count - 1 {
                        Divider().overlay(Color.white.opacity(0.06))
                    }
                }
            }
            .padding(Theme.spacingMD)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
        }
        .onReceive(ticker) { now = $0 }
    }

    @ViewBuilder
    private var header: some View {
        let s = liveState
        HStack(spacing: 6) {
            Image(systemName: "calendar.day.timeline.left").font(.caption).foregroundStyle(Theme.primaryBright)
            Text("DAGSPROGRAM")
                .font(.system(size: 10, weight: .bold)).tracking(0.8)
                .foregroundStyle(Theme.textSecondary)
            Spacer()
            if let next = s.next, let d = actDate(program[next].time), Calendar.current.isDateInToday(d) {
                Text("Neste \(program[next].time)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.success)
            } else if let first = actDate(program.first?.time ?? ""), first > now {
                Text(countdownText(to: first))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
    }

    private func row(_ idx: Int, _ item: EventProgramItem) -> some View {
        let s = liveState
        let isNow = s.current == idx && actDate(item.time).map { Calendar.current.isDateInToday($0) } ?? false
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.snappy) { expanded = expanded == idx ? nil : idx }
            } label: {
                HStack(alignment: .center, spacing: Theme.spacingMD) {
                    Text(item.time)
                        .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                        .foregroundStyle(isNow ? Theme.success : Theme.primaryBright)
                        .frame(width: 52, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(item.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.textPrimary)
                            if isNow {
                                Text("NÅ")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(Theme.background)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(Theme.success).clipShape(Capsule())
                            }
                        }
                        if let light = lightFor(item.time), expanded != idx {
                            HStack(spacing: 5) {
                                Circle().fill(light.color).frame(width: 5, height: 5)
                                Text(light.label).font(.caption2).foregroundStyle(Theme.textTertiary)
                            }
                        }
                    }
                    Spacer()
                    Image(systemName: expanded == idx ? "chevron.up" : "chevron.down")
                        .font(.caption2).foregroundStyle(Theme.textTertiary)
                }
                .padding(.vertical, Theme.spacingSM)
            }
            .buttonStyle(.plain)

            if expanded == idx {
                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                    if let light = lightFor(item.time) {
                        Label(light.label, systemImage: "sun.max.fill")
                            .font(.caption).foregroundStyle(light.color)
                    }
                    Button {
                        toggleReminder(idx, item)
                    } label: {
                        Label(
                            reminded.contains(idx) ? "Påminnelse satt (10 min før)" : "Minn meg på dette",
                            systemImage: reminded.contains(idx) ? "bell.fill" : "bell"
                        )
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(reminded.contains(idx) ? Theme.warning : Theme.primaryBright)
                    }
                    .disabled(actDate(item.time).map { $0 < now } ?? true)
                }
                .padding(.leading, 64)
                .padding(.bottom, Theme.spacingSM)
            }
        }
    }

    private func toggleReminder(_ idx: Int, _ item: EventProgramItem) {
        let id = "event-\(event.id)-act-\(idx)"
        if reminded.contains(idx) {
            NotificationService.cancelReminder(id: id)
            reminded.remove(idx)
        } else if let d = actDate(item.time) {
            NotificationService.scheduleReminder(
                id: id,
                title: "\(item.title) — snart",
                body: "\(event.name) · \(item.time) på \(event.venue)",
                at: d.addingTimeInterval(-600)
            )
            reminded.insert(idx)
        }
    }

    private func countdownText(to date: Date) -> String {
        let days = Calendar.current.dateComponents([.day], from: now, to: date).day ?? 0
        if days > 1 { return "Om \(days) dager" }
        if days == 1 { return "I morgen" }
        let hours = Calendar.current.dateComponents([.hour], from: now, to: date).hour ?? 0
        return hours > 0 ? "Om \(hours) t" : "Snart"
    }
}
