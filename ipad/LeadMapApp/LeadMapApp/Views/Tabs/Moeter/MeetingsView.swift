// MeetingsView.swift
//
// Pixel-perfect Møter-fane matchende mockup (2026-06-29):
//
//   ┌──────────────────────────────────────────────────┬──────────┐
//   │ Møter [I dag, 20. mai 2025 ▾] [🔔][Filter]      │ Detail   │
//   │ ┌─ KPI ─┬─ KPI ─┬─ KPI ─┬─ KPI ─┐                │ sidebar  │
//   │ │  5    │  12   │  18   │ 2,4M  │                │          │
//   │ └───────┴───────┴───────┴───────┘                │ + actions│
//   │ Agenda · Tirsdag 20. mai                         │ + rute   │
//   │  09:00 Nordic Elektro AS  Jonas Eide [Bekreftet] │ + NBA    │
//   │  10:30 Byggmester Hansen  Kari Hansen [På vei]   │          │
//   │  ... 5 møter ...                                  │          │
//   │ Kommende møter (3 mini-card + Se alle)            │          │
//   │ Møteforberedelse: Mål/Behov/Neste steg/Notater    │          │
//   └──────────────────────────────────────────────────┴──────────┘

import SwiftUI
import MapKit

private enum MtBrand {
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
    static let textSecondary = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.35)
}

// MARK: - Models

struct Meeting: Identifiable, Hashable {
    /// Mock-rader får tilfeldig UUID; backend-rader (CalendarEvent) får
    /// uuid avledet fra event-id slik at seleksjon overlever re-mapping.
    var id = UUID()
    let startTime: String       // "09:00"
    let endTime: String         // "10:00"
    let company: String
    let location: String        // "Oslo, Norge"
    let contactName: String
    let contactRole: String
    let status: Status
    let icon: String            // company-icon
    let iconColor: Color
    let address: String         // full adresse for detail
    let meetingRoom: String?    // "Lysaker"
    let leadScore: Int
    let leadType: String        // "Høyt lead"
    let valueNok: Int
    let lat: Double
    let lon: Double
    let driveTimeMin: Int
    let driveDistanceKm: Int
    let trafficStatus: String   // "Lett trafikk"

    enum Status: String, Hashable {
        case confirmed, onTheWay, followUp, pending, cancelled
        var label: String {
            switch self {
            case .confirmed: return "Bekreftet"
            case .onTheWay:  return "På vei"
            case .followUp:  return "Oppfølging"
            case .pending:   return "Venter"
            case .cancelled: return "Avlyst"
            }
        }
        var color: Color {
            switch self {
            case .confirmed: return MtBrand.green
            case .onTheWay:  return MtBrand.blue
            case .followUp:  return MtBrand.orange
            case .pending:   return MtBrand.yellow
            case .cancelled: return MtBrand.red
            }
        }
    }
}

struct UpcomingMeetingMini: Identifiable, Hashable {
    var id = UUID()
    let dayLabel: String       // "Ons 21. mai"
    let time: String           // "09:00"
    let endTime: String        // "10:00"
    let company: String
    let location: String
    let address: String
    let contactName: String
    let contactRole: String
    let status: Meeting.Status
    let icon: String
    let iconColor: Color
    let valueNok: Int
    let leadScore: Int
    let leadType: String
    let lat: Double
    let lon: Double
    let driveTimeMin: Int
    let driveDistanceKm: Int
    let trafficStatus: String
    let agenda: String         // én-linjes formål
    let prepStatus: PrepStatus // hvor klar er forberedelsen?

    enum PrepStatus: String, Hashable {
        case ready = "Klar"
        case partial = "Delvis"
        case notStarted = "Ikke startet"
        var color: Color {
            switch self {
            case .ready: return Color(red: 0.20, green: 0.85, blue: 0.60)
            case .partial: return Color(red: 0.98, green: 0.75, blue: 0.14)
            case .notStarted: return Color(red: 0.95, green: 0.20, blue: 0.20)
            }
        }
        var icon: String {
            switch self {
            case .ready: return "checkmark.seal.fill"
            case .partial: return "exclamationmark.circle.fill"
            case .notStarted: return "questionmark.circle.fill"
            }
        }
    }

    // Konverter til full Meeting (for å gjenbruke MeetingDetailSidebar / sheets)
    func asMeeting() -> Meeting {
        Meeting(
            id: id,
            startTime: time, endTime: endTime,
            company: company, location: location,
            contactName: contactName, contactRole: contactRole,
            status: status,
            icon: icon, iconColor: iconColor,
            address: address, meetingRoom: nil,
            leadScore: leadScore, leadType: leadType, valueNok: valueNok,
            lat: lat, lon: lon,
            driveTimeMin: driveTimeMin, driveDistanceKm: driveDistanceKm,
            trafficStatus: trafficStatus
        )
    }
}

struct PrepItem: Identifiable, Hashable {
    let id = UUID()
    let category: String
    let icon: String
    let color: Color
    let bullets: [String]
}

enum MeetingsData {
    /// Demo-mode-gated agenda. Ved demo AV → tom → tomme-tilstander i UI.
    static var agenda: [Meeting] {
        DemoModeManager.isActiveNonisolated ? _agenda : []
    }

    /// Demo-mode-gated upcoming meetings.
    static var upcoming: [UpcomingMeetingMini] {
        DemoModeManager.isActiveNonisolated ? _upcoming : []
    }

    /// Krasj-safe fallback for `@State`-init.
    static var firstOrPlaceholder: Meeting {
        _agenda[0]
    }

    private static let _agenda: [Meeting] = [
        Meeting(
            startTime: "09:00", endTime: "10:00",
            company: "Nordic Elektro AS", location: "Oslo, Norge",
            contactName: "Jonas Eide", contactRole: "Daglig leder",
            status: .confirmed,
            icon: "building.2.fill", iconColor: MtBrand.purpleLight,
            address: "Vitaminveien 1, 0485 Oslo", meetingRoom: "Lysaker",
            leadScore: 92, leadType: "Høyt lead", valueNok: 650_000,
            lat: 59.943, lon: 10.778,
            driveTimeMin: 32, driveDistanceKm: 18, trafficStatus: "Lett trafikk"
        ),
        Meeting(
            startTime: "10:30", endTime: "11:30",
            company: "Byggmester Hansen AS", location: "Bærum, Norge",
            contactName: "Kari Hansen", contactRole: "Innkjøpsleder",
            status: .onTheWay,
            icon: "hammer.fill", iconColor: MtBrand.blue,
            address: "Bjørnegårdsvingen 12, 1349 Rykkinn", meetingRoom: nil,
            leadScore: 78, leadType: "Varmt lead", valueNok: 180_000,
            lat: 59.910, lon: 10.470,
            driveTimeMin: 45, driveDistanceKm: 22, trafficStatus: "Tett trafikk"
        ),
        Meeting(
            startTime: "13:00", endTime: "14:00",
            company: "Frogner Utvikling AS", location: "Oslo, Norge",
            contactName: "Morten Solberg", contactRole: "Prosjektleder",
            status: .confirmed,
            icon: "chart.bar.fill", iconColor: MtBrand.green,
            address: "Bygdøy allé 38, 0265 Oslo", meetingRoom: nil,
            leadScore: 84, leadType: "Høyt lead", valueNok: 420_000,
            lat: 59.918, lon: 10.708,
            driveTimeMin: 18, driveDistanceKm: 8, trafficStatus: "Lett trafikk"
        ),
        Meeting(
            startTime: "14:30", endTime: "15:30",
            company: "Energi & Miljø AS", location: "Lillestrøm, Norge",
            contactName: "Jens Eriksen", contactRole: "Teknisk sjef",
            status: .followUp,
            icon: "bolt.fill", iconColor: MtBrand.orange,
            address: "Storgata 8, 2000 Lillestrøm", meetingRoom: nil,
            leadScore: 65, leadType: "Varmt lead", valueNok: 220_000,
            lat: 59.957, lon: 11.049,
            driveTimeMin: 28, driveDistanceKm: 17, trafficStatus: "Middels trafikk"
        ),
        Meeting(
            startTime: "16:00", endTime: "17:00",
            company: "TechSolutions AS", location: "Oslo, Norge",
            contactName: "Linda Karlsen", contactRole: "CTO",
            status: .confirmed,
            icon: "cpu.fill", iconColor: MtBrand.red,
            address: "Drammensveien 134, 0277 Oslo", meetingRoom: "Bjørvika konferanserom",
            leadScore: 88, leadType: "Høyt lead", valueNok: 380_000,
            lat: 59.912, lon: 10.706,
            driveTimeMin: 22, driveDistanceKm: 12, trafficStatus: "Lett trafikk"
        ),
    ]

    private static let _upcoming: [UpcomingMeetingMini] = [
        UpcomingMeetingMini(
            dayLabel: "Ons 21. mai", time: "09:00", endTime: "10:00",
            company: "Romerike Elektro AS", location: "Lørenskog",
            address: "Solheimveien 62, 1473 Lørenskog",
            contactName: "Tom Wiig", contactRole: "Daglig leder",
            status: .confirmed,
            icon: "building.2.fill", iconColor: MtBrand.green,
            valueNok: 320_000, leadScore: 78, leadType: "Varmt lead",
            lat: 59.927, lon: 10.973,
            driveTimeMin: 35, driveDistanceKm: 22, trafficStatus: "Lett trafikk",
            agenda: "Behovs-avklaring + tilbud", prepStatus: .ready
        ),
        UpcomingMeetingMini(
            dayLabel: "Ons 21. mai", time: "13:30", endTime: "14:30",
            company: "BoligPartner AS", location: "Jessheim",
            address: "Storgata 14, 2050 Jessheim",
            contactName: "Astrid Holm", contactRole: "Innkjøpssjef",
            status: .confirmed,
            icon: "house.fill", iconColor: MtBrand.blue,
            valueNok: 480_000, leadScore: 82, leadType: "Høyt lead",
            lat: 60.144, lon: 11.171,
            driveTimeMin: 52, driveDistanceKm: 38, trafficStatus: "Middels trafikk",
            agenda: "Demo av integrasjons-plattform", prepStatus: .partial
        ),
        UpcomingMeetingMini(
            dayLabel: "Tor 22. mai", time: "10:00", endTime: "11:00",
            company: "Scan Safe AS", location: "Drammen",
            address: "Bragernes Torg 3, 3017 Drammen",
            contactName: "Henrik Vold", contactRole: "Sikkerhetssjef",
            status: .pending,
            icon: "shield.fill", iconColor: MtBrand.orange,
            valueNok: 950_000, leadScore: 91, leadType: "Høyt lead",
            lat: 59.744, lon: 10.205,
            driveTimeMin: 48, driveDistanceKm: 41, trafficStatus: "Lett trafikk",
            agenda: "Pilot-avtale + kommersielle vilkår", prepStatus: .notStarted
        ),
        UpcomingMeetingMini(
            dayLabel: "Tor 22. mai", time: "14:00", endTime: "15:00",
            company: "Nordic Service Group", location: "Oslo",
            address: "Karenslyst allé 8B, 0278 Oslo",
            contactName: "Maria Strand", contactRole: "CTO",
            status: .confirmed,
            icon: "wrench.and.screwdriver.fill", iconColor: MtBrand.purple,
            valueNok: 215_000, leadScore: 71, leadType: "Varmt lead",
            lat: 59.918, lon: 10.692,
            driveTimeMin: 22, driveDistanceKm: 11, trafficStatus: "Lett trafikk",
            agenda: "Oppfølging etter demo + objections", prepStatus: .partial
        ),
        UpcomingMeetingMini(
            dayLabel: "Fre 23. mai", time: "09:30", endTime: "10:30",
            company: "Vest VVS AS", location: "Bergen",
            address: "Strandgaten 22, 5004 Bergen",
            contactName: "Lars Eikeland", contactRole: "Eier",
            status: .confirmed,
            icon: "drop.fill", iconColor: MtBrand.blue,
            valueNok: 145_000, leadScore: 64, leadType: "Kaldt lead",
            lat: 60.394, lon: 5.323,
            driveTimeMin: 0, driveDistanceKm: 0, trafficStatus: "Teams-møte",
            agenda: "Første discovery — kvalifisering", prepStatus: .notStarted
        ),
    ]

    static let prep: [PrepItem] = [
        PrepItem(category: "Mål",        icon: "target",                  color: MtBrand.green,        bullets: ["Presentere løsningen og skape interesse", "Avklare behov og neste steg"]),
        PrepItem(category: "Behov",      icon: "magnifyingglass.circle.fill", color: MtBrand.blue,     bullets: ["Effektivisere energistyring i bygg", "Redusere driftskostnader"]),
        PrepItem(category: "Neste steg", icon: "arrow.right.circle.fill", color: MtBrand.purpleLight,  bullets: ["Tilbud og løsningsforslag", "Oppfølgingsmøte om 2 uker"]),
        PrepItem(category: "Notater",    icon: "doc.text.fill",           color: MtBrand.yellow,       bullets: ["Spesielt fokus på bærekraft og totaløkonomi", "Kontaktperson er beslutningstaker"]),
    ]
}

// MARK: - CalendarEvent → Meeting/UpcomingMeetingMini (backend-binding)

// Uke 2-oppfølger: samme mønster som Leads-fanen — demo-modus viser
// mock-agendaen, ellers mappes ekte kalender-events (eventType=="meeting"
// fra /api/admin-room/lead-map/calendar) m/ lead-join på navn for
// koordinater/score/verdi. Kjøretid/trafikk har vi ikke datakilde for
// enda → 0/"" og UI-et gater visningen på driveTimeMin > 0.

private enum MeetingMapping {
    static let palette: [Color] = [
        MtBrand.purple, MtBrand.green, MtBrand.blue, MtBrand.orange, MtBrand.yellow,
    ]

    static func stableColor(for key: String) -> Color {
        var hash = 5381
        for b in key.utf8 { hash = ((hash << 5) &+ hash) &+ Int(b) }
        return palette[abs(hash) % palette.count]
    }

    static func leadType(for score: Int) -> String {
        score >= 80 ? "Høyt lead" : score >= 50 ? "Middels lead" : "Lavt lead"
    }

    static func timeString(_ date: Date) -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        df.dateFormat = "HH:mm"
        return df.string(from: date)
    }

    static func dayLabel(_ date: Date) -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        df.dateFormat = "EEE d. MMM"
        return df.string(from: date).capitalized
    }
}

extension Meeting {
    init(from event: CalendarEvent, lead: LeadModel?) {
        let start = event.datetime ?? Date()
        let score = lead?.leadScore ?? lead?.aiOpportunityScore ?? 0
        self.init(
            id: UUID(uuidString: event.id) ?? UUID(),
            startTime: MeetingMapping.timeString(start),
            endTime: MeetingMapping.timeString(start.addingTimeInterval(3600)),
            company: event.leadName,
            location: event.city ?? lead?.city ?? "",
            contactName: "",
            contactRole: "",
            status: .confirmed,
            icon: "building.2.fill",
            iconColor: MeetingMapping.stableColor(for: event.leadName),
            address: lead?.address ?? event.city ?? "",
            meetingRoom: nil,
            leadScore: score,
            leadType: MeetingMapping.leadType(for: score),
            valueNok: Int(lead?.estimatedValue ?? 0),
            lat: lead?.latitude ?? 0,
            lon: lead?.longitude ?? 0,
            driveTimeMin: 0,
            driveDistanceKm: 0,
            trafficStatus: ""
        )
    }
}

extension UpcomingMeetingMini {
    init(from event: CalendarEvent, lead: LeadModel?) {
        let start = event.datetime ?? Date()
        let score = lead?.leadScore ?? lead?.aiOpportunityScore ?? 0
        self.init(
            id: UUID(uuidString: event.id) ?? UUID(),
            dayLabel: MeetingMapping.dayLabel(start),
            time: MeetingMapping.timeString(start),
            endTime: MeetingMapping.timeString(start.addingTimeInterval(3600)),
            company: event.leadName,
            location: event.city ?? lead?.city ?? "",
            address: lead?.address ?? event.city ?? "",
            contactName: "",
            contactRole: "",
            status: .confirmed,
            icon: "building.2.fill",
            iconColor: MeetingMapping.stableColor(for: event.leadName),
            valueNok: Int(lead?.estimatedValue ?? 0),
            leadScore: score,
            leadType: MeetingMapping.leadType(for: score),
            lat: lead?.latitude ?? 0,
            lon: lead?.longitude ?? 0,
            driveTimeMin: 0,
            driveDistanceKm: 0,
            trafficStatus: "",
            agenda: event.nextAction ?? "Møte med \(event.leadName)",
            prepStatus: event.nextAction == nil ? .notStarted : .partial
        )
    }
}

// MARK: - Main view

struct DayWrapper: Identifiable, Hashable {
    var id: Int { day }
    let day: Int
}

struct MeetingsView: View {
    @State private var selectedID: UUID?
    @State private var upcomingDetail: UpcomingMeetingMini?
    @State private var showAllUpcoming: Bool = false
    @State private var calMode: CalendarMode = .agenda
    @State private var bookDayOfMonth: Int?
    // Pakke 10.1 — rike header-popovere
    @State private var analyseOpen: Bool = false
    @State private var nextActionsOpen: Bool = false
    @State private var notificationsOpen: Bool = false
    @Environment(AppState.self) private var appState

    // MARK: Datakilde (uke 2-binding) — demo → mocks, ellers ekte kalender

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    private var meetingEvents: [CalendarEvent] {
        appState.calendar.filter { $0.eventType == "meeting" && $0.datetime != nil }
    }

    private func leadFor(_ event: CalendarEvent) -> LeadModel? {
        appState.leads.first {
            $0.name.caseInsensitiveCompare(event.leadName) == .orderedSame
        }
    }

    /// Dagens møter (agenda-lista + dag/uke/måned-visningene).
    private var sourceAgenda: [Meeting] {
        if isDemo { return MeetingsData.agenda }
        let cal = Calendar.current
        return meetingEvents
            .filter { cal.isDateInToday($0.datetime ?? .distantPast) }
            .sorted { ($0.datetime ?? .distantPast) < ($1.datetime ?? .distantPast) }
            .map { Meeting(from: $0, lead: leadFor($0)) }
    }

    /// Kommende møter (etter i dag).
    private var sourceUpcoming: [UpcomingMeetingMini] {
        if isDemo { return MeetingsData.upcoming }
        let cal = Calendar.current
        let now = Date()
        return meetingEvents
            .filter {
                guard let dt = $0.datetime else { return false }
                return dt > now && !cal.isDateInToday(dt)
            }
            .sorted { ($0.datetime ?? .distantPast) < ($1.datetime ?? .distantPast) }
            .map { UpcomingMeetingMini(from: $0, lead: leadFor($0)) }
    }

    private var selectedMeeting: Meeting {
        sourceAgenda.first { $0.id == selectedID } ?? MeetingsData.firstOrPlaceholder
    }

    var body: some View {
        ZStack {
            MtBrand.bg.ignoresSafeArea()
            content
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if selectedID == nil { selectedID = sourceAgenda.first?.id }
        }
        .sheet(item: $upcomingDetail) { u in
            UpcomingMeetingDetailSheet(upcoming: u)
        }
        .sheet(isPresented: $showAllUpcoming) {
            AllUpcomingMeetingsSheet(meetings: sourceUpcoming) { picked in
                upcomingDetail = picked
            }
        }
        .sheet(item: Binding(
            get: { bookDayOfMonth.map { DayWrapper(day: $0) } },
            set: { bookDayOfMonth = $0?.day }
        )) { wrap in
            BookMeetingSheet(dayOfMonth: wrap.day)
        }
    }

    private var content: some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 0) {
                header
                    .padding(.horizontal, 20).padding(.top, 14)
                kpiRow
                    .padding(.horizontal, 20).padding(.top, 14)

                ScrollView {
                    VStack(spacing: 14) {
                        agendaCard
                        upcomingCard
                        // All møteforberedelse er flyttet til høyre sidebar (kontekst-bundet til valgt møte)
                    }
                    .padding(.horizontal, 20).padding(.top, 14)
                    .padding(.bottom, 20)
                }
            }
            .frame(maxWidth: .infinity)

            if sourceAgenda.isEmpty {
                MeetingDetailEmptyState()
                    .frame(width: 340)
            } else {
                MeetingDetailSidebar(meeting: selectedMeeting, calMode: $calMode)
                    .frame(width: 340)
            }
        }
    }

    // MARK: Header

    private var header: some View {
        GeometryReader { geo in
            let isNarrow = geo.size.width < 1100
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Møter")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.white)
                    if !isNarrow {
                        Text("Planlegg, forbered og følg opp møter")
                            .font(.system(size: 13))
                            .foregroundStyle(MtBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                HStack(spacing: 8) {
                    topPicker(icon: "calendar", text: isNarrow ? "Tir 20" : "Tir. 20. mai 2025")
                    if !isNarrow {
                        topPicker(icon: "line.3.horizontal.decrease", text: "Filter")
                    }
                    topIconButton(icon: "chart.line.uptrend.xyaxis", badge: nil, isOpen: $analyseOpen)
                        .popover(isPresented: $analyseOpen, arrowEdge: .top) {
                            AnalysePopover(leads: appState.leads)
                                .frame(width: 380, height: 520)
                                .presentationCompactAdaptation(.popover)
                        }
                    topIconButton(icon: "checklist", badge: 8, isOpen: $nextActionsOpen)
                        .popover(isPresented: $nextActionsOpen, arrowEdge: .top) {
                            NextActionsPopover(leads: appState.leads, totalCount: appState.leads.count)
                                .frame(width: 380, height: 520)
                                .presentationCompactAdaptation(.popover)
                        }
                    topIconButton(icon: "bell.fill", badge: 3, isOpen: $notificationsOpen)
                        .popover(isPresented: $notificationsOpen, arrowEdge: .top) {
                            RecentActivitiesPopover(leads: appState.leads, upcomingFollowups: 0, momentum: nil)
                                .frame(width: 380, height: 520)
                                .presentationCompactAdaptation(.popover)
                        }
                    profileAvatar(isNarrow: isNarrow)
                }
            }
        }
        .frame(height: 64)
    }

    private func topPicker(icon: String, text: String) -> some View {
        Button {} label: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(MtBrand.purpleLight)
                Text(text)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(MtBrand.textTertiary)
            }
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(MtBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(MtBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private func topIconButton(icon: String, badge: Int?, isOpen: Binding<Bool>? = nil) -> some View {
        Button { isOpen?.wrappedValue.toggle() } label: {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11).fill(MtBrand.card)
                    RoundedRectangle(cornerRadius: 11).stroke(MtBrand.stroke, lineWidth: 1)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(MtBrand.purpleLight)
                }
                .frame(width: 42, height: 42)
                if let b = badge, b > 0 {
                    Text("\(min(b, 99))")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(MtBrand.purple, in: Capsule())
                        .overlay(Capsule().stroke(MtBrand.bg, lineWidth: 1.5))
                        .offset(x: 6, y: -6)
                }
            }
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    // Løftet Leadbook-avatar-menu til alle faner (SharedProfileAvatar).
    @State private var showMinProfilAvatar: Bool = false
    @State private var showEcosystemAvatar: Bool = false
    @State private var showTeamAccessAvatar: Bool = false
    @State private var showSuperAdminAvatar: Bool = false

    private func profileAvatar(isNarrow: Bool) -> some View {
        SharedProfileAvatar(
            tint: MtBrand.purpleLight,
            background: MtBrand.card,
            borderColor: MtBrand.stroke,
            secondaryText: MtBrand.textSecondary,
            tertiaryText: MtBrand.textTertiary,
            isCompact: isNarrow,
            showMinProfil: $showMinProfilAvatar,
            showEcosystem: $showEcosystemAvatar,
            showTeamAccess: $showTeamAccessAvatar,
            showSuperAdmin: $showSuperAdminAvatar
        )
    }

    // MARK: KPI

    private var kpiRow: some View {
        // Demo PÅ → mockup-tall. Demo AV → EKTE tellinger fra kalenderen
        // ("—" når tomt, ingen fiktiv trend-tekst).
        let cal = Calendar.current
        let now = Date()
        let todayCount = sourceAgenda.count
        let weekCount = meetingEvents.filter {
            guard let dt = $0.datetime else { return false }
            return cal.isDate(dt, equalTo: now, toGranularity: .weekOfYear)
        }.count
        let next7 = meetingEvents.filter {
            guard let dt = $0.datetime else { return false }
            return dt >= now && dt <= now.addingTimeInterval(7 * 86400)
        }.count
        let bookedValue = sourceAgenda.reduce(0) { $0 + $1.valueNok }
            + sourceUpcoming.reduce(0) { $0 + $1.valueNok }
        func fmtValue(_ v: Int) -> String {
            v >= 1_000_000 ? String(format: "%.1fM kr", Double(v) / 1_000_000).replacingOccurrences(of: ".", with: ",")
            : v >= 1_000 ? "\(v / 1_000)K kr" : "\(v) kr"
        }
        let remaining = sourceAgenda.filter { $0.startTime > MeetingMapping.timeString(now) }.count
        return HStack(spacing: 12) {
            kpiCard(title: "Møter i dag",  value: isDemo ? "5"       : (todayCount > 0 ? "\(todayCount)" : "—"), subtitle: isDemo ? "2 igjen" : (todayCount > 0 ? "\(remaining) igjen" : "Ingen møter i dag"), icon: "calendar", color: MtBrand.purpleLight)
            kpiCard(title: "Denne uken",   value: isDemo ? "12"      : (weekCount > 0 ? "\(weekCount)" : "—"), subtitle: isDemo ? "3 bekreftet" : (weekCount > 0 ? "booket" : "Ingen data"), icon: "chart.line.uptrend.xyaxis", color: MtBrand.purpleLight)
            kpiCard(title: "Kommende",     value: isDemo ? "18"      : (next7 > 0 ? "\(next7)" : "—"), subtitle: "neste 7 dager", icon: "clock.fill", color: MtBrand.purpleLight)
            kpiCard(title: "Booket verdi", value: isDemo ? "2,4M kr" : (bookedValue > 0 ? fmtValue(bookedValue) : "—"), subtitle: isDemo ? "↑ 18% fra forrige uke" : "agenda + kommende", icon: "externaldrive.fill", color: MtBrand.purpleLight, trendPositive: isDemo)
        }
    }

    private func kpiCard(title: String, value: String, subtitle: String, icon: String, color: Color, trendPositive: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(MtBrand.textSecondary)
                Text(value)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(trendPositive ? MtBrand.green : MtBrand.textTertiary)
            }
            Spacer(minLength: 0)
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(color.opacity(0.22))
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 40, height: 40)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MtBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(MtBrand.stroke, lineWidth: 1))
    }

    // MARK: Agenda

    private var agendaCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(calendarCardTitle)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    Text(calendarCardSubtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(MtBrand.textSecondary)
                }
                Spacer()
                CalendarModePicker(mode: $calMode)
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 12)

            // Mode-spesifikt innhold
            switch calMode {
            case .agenda:
                if sourceAgenda.isEmpty {
                    // Skill «laster»/«ekte tom» (uke 2) — skeleton mens
                    // kalenderen hentes første gang, ellers tom-tilstand.
                    switch appState.calendarLoadState {
                    case .idle, .loading:
                        loadingAgendaRow
                    case .loaded, .failed:
                        emptyAgendaRow
                    }
                } else {
                    ForEach(sourceAgenda) { m in
                        agendaRow(m)
                    }
                    .padding(.bottom, 4)
                }
            case .day:
                DayCalendarView(meetings: sourceAgenda) { m in
                    selectedID = m.id
                }
                .padding(.horizontal, 12).padding(.bottom, 12)
            case .week:
                WeekCalendarView(
                    meetings: sourceAgenda,
                    upcoming: sourceUpcoming
                ) { m in
                    selectedID = m.id
                } onTapUpcoming: { u in
                    upcomingDetail = u
                }
                .padding(.horizontal, 12).padding(.bottom, 12)
            case .month:
                MonthCalendarView(
                    meetings: sourceAgenda,
                    upcoming: sourceUpcoming,
                    onBookMeeting: { day in bookDayOfMonth = day }
                )
                .padding(.horizontal, 16).padding(.bottom, 14)
            }
        }
        .background(MtBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(MtBrand.stroke, lineWidth: 1))
    }

    private var calendarCardTitle: String {
        switch calMode {
        case .agenda: return "Agenda"
        case .day:    return "Dag"
        case .week:   return "Uke"
        case .month:  return "Måned"
        }
    }

    private var calendarCardSubtitle: String {
        // Demo viser mockup-datoene; ellers ekte dato/uke/måned.
        if isDemo {
            switch calMode {
            case .agenda: return "Tirsdag 20. mai · \(sourceAgenda.count) møter"
            case .day:    return "Tirsdag 20. mai · 07–19"
            case .week:   return "Uke 21 · 19.–25. mai"
            case .month:  return "Mai 2026"
            }
        }
        let now = Date()
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        switch calMode {
        case .agenda:
            df.dateFormat = "EEEE d. MMMM"
            return "\(df.string(from: now).capitalized) · \(sourceAgenda.count) møter"
        case .day:
            df.dateFormat = "EEEE d. MMMM"
            return "\(df.string(from: now).capitalized) · 07–19"
        case .week:
            let week = Calendar.current.component(.weekOfYear, from: now)
            return "Uke \(week)"
        case .month:
            df.dateFormat = "MMMM yyyy"
            return df.string(from: now).capitalized
        }
    }

    private func agendaRow(_ m: Meeting) -> some View {
        let isSelected = m.id == selectedID
        return Button { selectedID = m.id } label: {
            HStack(spacing: 0) {
                // Tid-kolonne
                VStack(alignment: .leading, spacing: 1) {
                    Text(m.startTime)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                    Text(m.endTime)
                        .font(.system(size: 11))
                        .foregroundStyle(MtBrand.textSecondary)
                        .monospacedDigit()
                }
                .frame(width: 60, alignment: .leading)

                // Timeline-dot + linje
                ZStack {
                    Rectangle()
                        .fill(MtBrand.stroke)
                        .frame(width: 2)
                    Circle()
                        .fill(MtBrand.card)
                        .overlay(Circle().stroke(MtBrand.stroke, lineWidth: 2))
                        .frame(width: 12, height: 12)
                }
                .frame(width: 18)
                .padding(.trailing, 12)

                // Bedrift-ikon
                ZStack {
                    Circle().fill(m.iconColor.opacity(0.22))
                    Image(systemName: m.icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(m.iconColor)
                }
                .frame(width: 36, height: 36)
                .padding(.trailing, 11)

                // Bedrift + sted
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.company)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(m.location)
                        .font(.system(size: 10))
                        .foregroundStyle(MtBrand.textSecondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Kontaktperson
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.contactName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(m.contactRole)
                        .font(.system(size: 10))
                        .foregroundStyle(MtBrand.textSecondary)
                        .lineLimit(1)
                }
                .frame(width: 130, alignment: .leading)

                // Status-badge
                statusBadge(m.status)
                    .frame(width: 92, alignment: .center)

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(MtBrand.textTertiary)
                    .padding(.leading, 6)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(isSelected ? MtBrand.purple.opacity(0.12) : Color.clear)
            .overlay(
                isSelected
                    ? Rectangle().fill(MtBrand.purpleLight).frame(width: 3).padding(.vertical, 4)
                    : nil,
                alignment: .leading
            )
        }
        .buttonStyle(.plain)
    }

    private func statusBadge(_ st: Meeting.Status) -> some View {
        Text(st.label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(st.color)
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(st.color.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(st.color.opacity(0.4), lineWidth: 1))
    }

    // MARK: Loading state — skeleton mens kalenderen hentes (uke 2)

    private var loadingAgendaRow: some View {
        VStack(spacing: 0) {
            ForEach(0..<3, id: \.self) { i in
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(MtBrand.cardHi)
                        .frame(width: 44, height: 34)
                    VStack(alignment: .leading, spacing: 6) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(MtBrand.cardHi)
                            .frame(width: 170, height: 11)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(MtBrand.cardHi.opacity(0.6))
                            .frame(width: 100, height: 9)
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 13)
                .opacity(1.0 - Double(i) * 0.2)
            }
        }
        .redacted(reason: .placeholder)
        .accessibilityLabel("Laster møter")
    }

    // MARK: Empty state — agenda-liste (demo AV / ingen møter)

    private var emptyAgendaRow: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar")
                .font(.system(size: 34))
                .foregroundStyle(MtBrand.textTertiary)
            Text("Ingen møter i dag")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
            Text("Bok et møte fra en lead, eller skru på demo-modus for eksempler.")
                .font(.system(size: 12))
                .foregroundStyle(MtBrand.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 380)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 44)
    }

    // MARK: Kommende møter

    private var upcomingCard: some View {
        let hasUpcoming = !sourceUpcoming.isEmpty
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Kommende møter")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                if hasUpcoming {
                    Text("\(sourceUpcoming.count)")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(MtBrand.purpleLight)
                        .monospacedDigit()
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(MtBrand.purple.opacity(0.18), in: Capsule())
                }
                Spacer()
                if hasUpcoming {
                    Button { showAllUpcoming = true } label: {
                        Text("Se alle")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(MtBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
            }
            if hasUpcoming {
                HStack(spacing: 10) {
                    ForEach(sourceUpcoming.prefix(3)) { u in
                        upcomingMini(u)
                    }
                    seeAllCard
                }
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 26))
                        .foregroundStyle(MtBrand.textTertiary)
                    Text("Ingen kommende møter")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(MtBrand.textSecondary)
                    Text("Bok et møte fra en lead, eller skru på demo-modus for eksempler.")
                        .font(.system(size: 10))
                        .foregroundStyle(MtBrand.textTertiary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 320)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 26)
            }
        }
        .padding(14)
        .background(MtBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(MtBrand.stroke, lineWidth: 1))
    }

    private func upcomingMini(_ u: UpcomingMeetingMini) -> some View {
        Button { upcomingDetail = u } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(u.dayLabel)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(MtBrand.textSecondary)
                    Spacer()
                    Text(u.time)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
                HStack(spacing: 7) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 7)
                            .fill(u.iconColor.opacity(0.22))
                        Image(systemName: u.icon)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(u.iconColor)
                    }
                    .frame(width: 24, height: 24)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(u.company)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Text(u.location)
                            .font(.system(size: 10))
                            .foregroundStyle(MtBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                HStack(spacing: 5) {
                    // Prep-status
                    HStack(spacing: 3) {
                        Image(systemName: u.prepStatus.icon)
                            .font(.system(size: 8, weight: .bold))
                        Text(u.prepStatus.rawValue)
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundStyle(u.prepStatus.color)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(u.prepStatus.color.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(u.prepStatus.color.opacity(0.4), lineWidth: 1))
                    Spacer()
                    // Verdi
                    Text("NOK \(u.valueNok / 1000)k")
                        .font(.system(size: 9, weight: .bold, design: .rounded))
                        .foregroundStyle(MtBrand.green)
                        .monospacedDigit()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(MtBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var seeAllCard: some View {
        Button { showAllUpcoming = true } label: {
            VStack(spacing: 5) {
                Image(systemName: "arrow.up.right.square.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(MtBrand.purpleLight)
                Text("Se alle møter")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(MtBrand.purpleLight)
                Text("+\(max(0, sourceUpcoming.count - 3)) flere")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(MtBrand.textTertiary)
                    .monospacedDigit()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.vertical, 18)
            .background(MtBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(MtBrand.purple.opacity(0.30), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            )
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
    }

    // MARK: Møteforberedelse

    private var prepCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Møteforberedelse")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button {} label: {
                    Text("Rediger")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(MtBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            VStack(alignment: .leading, spacing: 11) {
                ForEach(MeetingsData.prep) { p in
                    prepRow(p)
                }
            }
        }
        .padding(14)
        .background(MtBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(MtBrand.stroke, lineWidth: 1))
    }

    private func prepRow(_ p: PrepItem) -> some View {
        HStack(alignment: .top, spacing: 11) {
            HStack(spacing: 7) {
                ZStack {
                    Circle().fill(p.color.opacity(0.22))
                    Image(systemName: p.icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(p.color)
                }
                .frame(width: 28, height: 28)
                Text(p.category)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 120, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                ForEach(p.bullets, id: \.self) { bullet in
                    HStack(alignment: .top, spacing: 6) {
                        Text("•")
                            .font(.system(size: 11))
                            .foregroundStyle(MtBrand.textSecondary)
                        Text(bullet)
                            .font(.system(size: 12))
                            .foregroundStyle(.white)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - MeetingDetailSidebar

/// Tom-tilstand for høyre-panelet i Møter-fanen. Vises når
/// `MeetingsData.agenda.isEmpty` (typisk demo AV + tom kalender).
struct MeetingDetailEmptyState: View {
    var body: some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: "calendar.circle")
                .font(.system(size: 44))
                .foregroundStyle(MtBrand.textTertiary)
            Text("Ingen møte valgt")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text("Detaljer, rute og AI-innsikt vises her når du har valgt et møte.")
                .font(.system(size: 12))
                .foregroundStyle(MtBrand.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(MtBrand.card)
        .overlay(
            Rectangle().fill(MtBrand.stroke).frame(width: 1),
            alignment: .leading
        )
    }
}

struct MeetingDetailSidebar: View {
    let meeting: Meeting
    @Binding var calMode: CalendarMode

    @State private var favorited: Bool = false
    @State private var showStartMeeting = false
    @State private var showNavigate = false
    @State private var showOpenInKart = false
    @State private var showLogNote = false
    @State private var showOpenLead = false
    @State private var showReschedule = false
    @State private var showStatusPicker = false
    @State private var showCancelMeeting = false
    @State private var showAssignSeller = false
    @State private var showAddCampaign = false
    @State private var showAIInsights = false
    @State private var showHistory = false
    @State private var showPrepCore = false
    @State private var showStakeholders = false
    @State private var showChecklist = false
    @State private var toast: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                meta
                contactRow
                value
                actionsRow
                logNoteButton
                routeCard
                PrepChecklistPreviewButton { showChecklist = true }
                Color.clear.frame(height: 16)
            }
            .padding(.horizontal, 14).padding(.top, 14)
        }
        .background(MtBrand.card)
        .overlay(
            Rectangle().fill(MtBrand.stroke).frame(width: 1),
            alignment: .leading
        )
        .overlay(alignment: .bottom) {
            if let t = toast {
                ToastBubble(text: t)
                    .padding(.bottom, 18)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        .sheet(isPresented: $showStartMeeting)        { StartMeetingSheet(meeting: meeting) }
        .fullScreenCover(isPresented: $showNavigate)  { NavigationFullScreenView(meeting: meeting, transport: .driving) }
        .sheet(isPresented: $showOpenInKart)          { KartTabSheet(meeting: meeting, startInNavMode: false) }
        .sheet(isPresented: $showLogNote)             { LogNoteSheet(meeting: meeting) }
        .sheet(isPresented: $showOpenLead)            { LeadDetailStub(meeting: meeting) }
        .sheet(isPresented: $showReschedule)          { RescheduleSheet(meeting: meeting) }
        .sheet(isPresented: $showStatusPicker)        { StatusPickerSheet(meeting: meeting) }
        .sheet(isPresented: $showCancelMeeting)       { CancelMeetingSheet(meeting: meeting) }
        .sheet(isPresented: $showAssignSeller)        { AssignSellerSheet(meeting: meeting) }
        .sheet(isPresented: $showAddCampaign)         { AddToCampaignSheet(meeting: meeting) }
        .sheet(isPresented: $showAIInsights)          { PrepInsightsModal(meetingCompany: meeting.company, meetingContact: meeting.contactName) }
        .sheet(isPresented: $showHistory)             { PrepHistoryModal(meetingCompany: meeting.company) }
        .sheet(isPresented: $showPrepCore)            { PrepCoreModal(meetingCompany: meeting.company) }
        .sheet(isPresented: $showStakeholders)        { PrepStakeholdersModal(meetingCompany: meeting.company) }
        .sheet(isPresented: $showChecklist)           { PrepChecklistModal(meetingCompany: meeting.company) }
    }

    private func flashToast(_ text: String) {
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if toast == text { toast = nil }
        }
    }

    private func openURL(_ s: String) {
        guard let u = URL(string: s) else { return }
        UIApplication.shared.open(u)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                ZStack {
                    Circle().fill(meeting.iconColor.opacity(0.25))
                    Image(systemName: meeting.icon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(meeting.iconColor)
                }
                .frame(width: 46, height: 46)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(meeting.company)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                        Button {
                            favorited.toggle()
                            flashToast(favorited ? "Markert som favoritt" : "Favoritt fjernet")
                        } label: {
                            Image(systemName: favorited ? "star.fill" : "star")
                                .font(.system(size: 12))
                                .foregroundStyle(favorited ? MtBrand.yellow : MtBrand.textTertiary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                Spacer()
                ellipsisMenu
            }
            HStack(spacing: 6) {
                badge(meeting.status.label, color: meeting.status.color)
                Text("·")
                    .foregroundStyle(MtBrand.textTertiary)
                Text("Lead score \(meeting.leadScore)")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(MtBrand.textSecondary)
                badge(meeting.leadType, color: MtBrand.yellow)
            }
        }
    }

    private var ellipsisMenu: some View {
        Menu {
            Section("Møte") {
                Button { showStartMeeting = true } label: {
                    Label("Start møte", systemImage: "play.circle.fill")
                }
                Button { showReschedule = true } label: {
                    Label("Endre tidspunkt", systemImage: "calendar.badge.clock")
                }
                Button { showStatusPicker = true } label: {
                    Label("Endre status", systemImage: "flag.fill")
                }
                Button(role: .destructive) {
                    showCancelMeeting = true
                } label: {
                    Label("Avlys møte", systemImage: "xmark.circle.fill")
                }
            }
            Section("Lead") {
                Button { showOpenLead = true } label: {
                    Label("Åpne lead", systemImage: "arrow.up.right.square")
                }
                Button { showAssignSeller = true } label: {
                    Label("Tilordne selger", systemImage: "person.badge.plus")
                }
                Button { showAddCampaign = true } label: {
                    Label("Legg til i kampanje", systemImage: "megaphone.fill")
                }
            }
            Section("Del") {
                Button {
                    let link = "https://leadgrid.app/m/\(meeting.id.uuidString.prefix(8))"
                    UIPasteboard.general.string = link
                    flashToast("Møtelenke kopiert")
                } label: {
                    Label("Kopier møtelenke", systemImage: "link")
                }
                Menu {
                    Button { calMode = .agenda; flashToast("Byttet til Agenda") } label: {
                        Label("Agenda", systemImage: "list.bullet.rectangle")
                    }
                    Button { calMode = .day; flashToast("Byttet til Dag-visning") } label: {
                        Label("Dag", systemImage: "calendar.day.timeline.left")
                    }
                    Button { calMode = .week; flashToast("Byttet til Uke-visning") } label: {
                        Label("Uke", systemImage: "calendar")
                    }
                    Button { calMode = .month; flashToast("Byttet til Måned-visning") } label: {
                        Label("Måned", systemImage: "calendar.badge.clock")
                    }
                } label: {
                    Label("Vis i kalender", systemImage: "calendar")
                }
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(MtBrand.textSecondary)
                .padding(8)
                .contentShape(Rectangle())
        }
    }

    private func badge(_ label: String, color: Color) -> some View {
        Text(label)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(color.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
    }

    private var meta: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 9) {
                ZStack { Circle().fill(MtBrand.purple.opacity(0.18)); Image(systemName: "calendar").font(.system(size: 11)).foregroundStyle(MtBrand.purpleLight) }
                .frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Tirsdag 20. mai 2025")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("\(meeting.startTime) – \(meeting.endTime)")
                        .font(.system(size: 11))
                        .foregroundStyle(MtBrand.textSecondary)
                }
            }
            HStack(spacing: 9) {
                ZStack { Circle().fill(MtBrand.purple.opacity(0.18)); Image(systemName: "mappin.and.ellipse").font(.system(size: 11)).foregroundStyle(MtBrand.purpleLight) }
                .frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: 1) {
                    Text(meeting.address)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    if let room = meeting.meetingRoom {
                        Text("Møterom: \(room)")
                            .font(.system(size: 11))
                            .foregroundStyle(MtBrand.textSecondary)
                    }
                }
            }
        }
    }

    private var contactRow: some View {
        HStack(spacing: 9) {
            ZStack { Circle().fill(MtBrand.purple.opacity(0.18)); Image(systemName: "person.fill").font(.system(size: 11)).foregroundStyle(MtBrand.purpleLight) }
            .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 1) {
                Text(meeting.contactName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Text(meeting.contactRole)
                    .font(.system(size: 11))
                    .foregroundStyle(MtBrand.textSecondary)
            }
            Spacer()
            iconCircle("phone", color: MtBrand.green) {
                openURL("tel://+4790012345")
            }
            iconCircle("envelope", color: MtBrand.blue) {
                openURL("mailto:\(meeting.contactName.replacingOccurrences(of: " ", with: ".").lowercased())@\(meeting.company.replacingOccurrences(of: " AS", with: "").replacingOccurrences(of: " ", with: "").lowercased()).no")
            }
        }
    }

    private func iconCircle(_ icon: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle().fill(color.opacity(0.20))
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 28, height: 28)
        }
        .buttonStyle(.plain)
    }

    private var value: some View {
        HStack {
            HStack(spacing: 9) {
                ZStack { Circle().fill(MtBrand.purple.opacity(0.18)); Image(systemName: "norwegiankronesign.circle.fill").font(.system(size: 11)).foregroundStyle(MtBrand.purpleLight) }
                .frame(width: 26, height: 26)
                Text("Forventet verdi")
                    .font(.system(size: 12))
                    .foregroundStyle(MtBrand.textSecondary)
            }
            Spacer()
            Text("NOK \(formatNok(meeting.valueNok))")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
        }
    }

    private var actionsRow: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Button { showStartMeeting = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "play.circle.fill")
                            .font(.system(size: 13, weight: .bold))
                        Text("Start møte")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [MtBrand.purple, MtBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                }
                .buttonStyle(.plain)
                Button { showNavigate = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "location.north.line.fill")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Naviger")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(MtBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 8) {
                Button { openURL("tel://+4790012345") } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "phone.fill")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Ring kontakt")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(MtBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
                Button { showOpenLead = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.up.right.square")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Åpne lead")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(MtBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var logNoteButton: some View {
        VStack(spacing: 8) {
            // Primær AI-CTA — full bredde m/ gradient
            Button { showAIInsights = true } label: {
                HStack(spacing: 7) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 13, weight: .bold))
                    Text("AI-innsikt for møtet")
                        .font(.system(size: 13, weight: .bold))
                    Spacer()
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 11, weight: .bold))
                        .opacity(0.7)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 13).padding(.vertical, 12)
                .background(
                    LinearGradient(
                        colors: [MtBrand.purple, MtBrand.purpleLight],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 11)
                )
                .shadow(color: MtBrand.purple.opacity(0.35), radius: 7, y: 2)
            }
            .buttonStyle(.plain)
            // Sekundær-rad 1: Logg notat + Historikk
            HStack(spacing: 8) {
                Button { showLogNote = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 12, weight: .semibold))
                        Text("Logg notat")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(MtBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
                Button { showHistory = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "clock.arrow.circlepath")
                            .font(.system(size: 12, weight: .semibold))
                        Text("Aktivitet")
                            .font(.system(size: 12, weight: .semibold))
                        Text("1+6")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundStyle(MtBrand.yellow)
                            .monospacedDigit()
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(MtBrand.yellow.opacity(0.18), in: Capsule())
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(MtBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            // Sekundær-rad 2: Mål & behov + Beslutningstakere
            HStack(spacing: 8) {
                Button { showPrepCore = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "target")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(MtBrand.blue)
                        Text("Mål & behov")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(MtBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
                Button { showStakeholders = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "person.3.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(MtBrand.green)
                        Text("Stakeholders")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        Text("4")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundStyle(MtBrand.green)
                            .monospacedDigit()
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(MtBrand.green.opacity(0.18), in: Capsule())
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(MtBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var routeCard: some View {
        // Hele mini-kartet er hitmålet (Daniel-feedback 2026-07-01) —
        // «Åpne i kart»-CTA er droppet, kartet er selv hele knappen med
        // subtil pil + tint på hover for å signalisere tapbarhet.
        Button { showOpenInKart = true } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Text("Rute til møte")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Spacer()
                    Image(systemName: "arrow.up.right.square.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(MtBrand.purpleLight)
                }
                HStack(spacing: 10) {
                    ZStack(alignment: .bottomTrailing) {
                        Map(position: .constant(.region(MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: meeting.lat, longitude: meeting.lon),
                            span: MKCoordinateSpan(latitudeDelta: 0.04, longitudeDelta: 0.05)
                        ))), interactionModes: []) {
                            Annotation("", coordinate: CLLocationCoordinate2D(latitude: meeting.lat, longitude: meeting.lon)) {
                                ZStack {
                                    Circle().fill(MtBrand.purpleLight)
                                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                                        .frame(width: 22, height: 22)
                                    Image(systemName: "mappin")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundStyle(.white)
                                }
                            }
                        }
                        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
                        .mapControls {}
                        .environment(\.colorScheme, .dark)
                        .frame(height: 90)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(MtBrand.stroke, lineWidth: 1))
                        .allowsHitTesting(false)

                        // Trykk-hint-pille nederst i høyre hjørne av mini-kartet
                        HStack(spacing: 3) {
                            Image(systemName: "hand.tap.fill")
                                .font(.system(size: 8, weight: .bold))
                            Text("Åpne")
                                .font(.system(size: 9, weight: .black))
                                .tracking(0.4)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(MtBrand.purpleLight.opacity(0.95), in: Capsule())
                        .padding(6)
                    }
                    .frame(width: 130)

                    VStack(alignment: .leading, spacing: 4) {
                        // Kjøretid/trafikk vises kun når vi har data (demo).
                        // Ekte møter mangler datakilde for dette enda.
                        if meeting.driveTimeMin > 0 {
                            Text("\(meeting.driveTimeMin) min")
                                .font(.system(size: 18, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                                .monospacedDigit()
                            Text("(\(meeting.driveDistanceKm) km)")
                                .font(.system(size: 11))
                                .foregroundStyle(MtBrand.textSecondary)
                                .monospacedDigit()
                        }
                        if !meeting.trafficStatus.isEmpty {
                            Text(meeting.trafficStatus)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(meeting.trafficStatus.lowercased().contains("lett") ? MtBrand.green : (meeting.trafficStatus.lowercased().contains("tett") ? MtBrand.red : MtBrand.orange))
                        }
                        Text(meeting.address)
                            .font(.system(size: 10))
                            .foregroundStyle(MtBrand.textSecondary)
                            .lineLimit(2)
                            .padding(.top, 2)
                    }
                    Spacer()
                }
            }
            .padding(12)
            .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(MtBrand.stroke, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Åpne rute til \(meeting.company) på kart, \(meeting.driveTimeMin) minutter")
    }

    private var nbaCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Neste beste handling")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(LinearGradient(
                        colors: [MtBrand.purple, MtBrand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    Image(systemName: "target")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Send oppsummering etter møtet")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Del nøkkelpunkter og avtal neste steg.")
                        .font(.system(size: 11))
                        .foregroundStyle(MtBrand.textSecondary)
                    Button { flashToast("Oppgave opprettet i innboks") } label: {
                        Text("Opprett oppgave")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(MtBrand.purpleLight)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(MtBrand.purple.opacity(0.20), in: Capsule())
                            .overlay(Capsule().stroke(MtBrand.purple.opacity(0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 3)
                }
            }
        }
        .padding(12)
        .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MtBrand.stroke, lineWidth: 1))
    }

    private func formatNok(_ n: Int) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }
}
