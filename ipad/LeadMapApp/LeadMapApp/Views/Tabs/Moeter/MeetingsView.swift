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
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.45)
}

// MARK: - Models

struct Meeting: Identifiable, Hashable {
    /// Mock-rader får tilfeldig UUID; backend-rader (CalendarEvent) får
    /// uuid avledet fra event-id slik at seleksjon overlever re-mapping.
    var id = UUID()
    var startTime: String       // "09:00" (var: kan flyttes fra agendaen)
    var endTime: String         // "10:00"
    /// Demo: dra-og-slipp til annen ukedag (kolonneindeks man-fre).
    var demoDagKolonne: Int? = nil
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
    var dayLabel: String       // "Ons 21. mai" (var: kan flyttes)
    var time: String           // "09:00"
    var endTime: String        // "10:00"
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
    /// Ekte start-tidspunkt (backend-møter). Mock-rader har nil — de vises
    /// kun i demo-modus der kalenderen bruker seed-tellinger uansett.
    var date: Date? = nil

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

    /// Mock-forberedelser — KUN i demo-modus (ingen prep-backend enda).
    static var prep: [PrepItem] {
        DemoModeManager.isActiveNonisolated ? _prep : []
    }
    private static let _prep: [PrepItem] = [
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
            prepStatus: event.nextAction == nil ? .notStarted : .partial,
            date: start
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
    /// «Endre tidspunkt» fra agenda/uke/detalj — sheet-item.
    @State private var reschedulingMeeting: Meeting? = nil
    /// Etter-møte-triggeren: minutt-tikk så «Logg møtet»-CTA/badge slår
    /// inn av seg selv når sluttiden passeres.
    @State private var naa = Date()
    /// Deep-link fra lokalt «logg møtet»-varsel → åpne etterarbeidet.
    @State private var etterMoteFraVarsel: Meeting? = nil
    /// Ukenavigasjon: 0 = inneværende uke, ±1 per uke.
    @State private var ukeOffset = 0
    /// Konflikt-vakt: flytting som overlapper et annet møte stoppes.
    @State private var konfliktMelding: String? = nil
    /// Etter vellykket flytting (drag i dag/uke): tilby å varsle kontakten
    /// med ferdig e-postutkast — samme tilbud som Endre tidspunkt-arket.
    struct FlyttetInfo: Identifiable {
        let id = UUID()
        let meeting: Meeting
        let nyStart: Date
        var varighetMin: Int = 60
        /// Reisetids-vakta: «kjøreturen tar ~32 min, du har 25».
        var reisevarsel: String? = nil
        /// Ruteplanleggerens forslag til tid som faktisk går opp.
        var anbefaltStart: Date? = nil
    }
    @State private var flyttetInfo: FlyttetInfo? = nil
    /// Passiv reisetids-vakt i agendaen: møte-id → «~32 min kjøring fra X».
    @State private var reisetidsAdvarsler: [UUID: String] = [:]

    /// Mandag i vist uke (ISO-uke).
    private var ukeStart: Date {
        var kal = Calendar(identifier: .iso8601)
        kal.firstWeekday = 2
        let mandag = kal.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date()
        return kal.date(byAdding: .day, value: ukeOffset * 7, to: mandag) ?? mandag
    }

    /// Overlapper det nye tidsrommet et annet møte samme dag?
    private func overlappendeMote(_ m: Meeting, nyStartMin: Int, varighet: Int,
                                  nyDagKol: Int?) -> Meeting? {
        for andre in sourceAgenda where andre.id != m.id {
            if isDemo {
                let andreKol = andre.demoDagKolonne ?? 1
                guard andreKol == (nyDagKol ?? 1) else { continue }
            }
            let sd = andre.startTime.split(separator: ":")
            let ed = andre.endTime.split(separator: ":")
            guard sd.count == 2, ed.count == 2,
                  let st = Int(sd[0]), let sm = Int(sd[1]),
                  let et = Int(ed[0]), let em = Int(ed[1]) else { continue }
            let aStart = st * 60 + sm
            let aSlutt = et * 60 + em
            if nyStartMin < aSlutt && (nyStartMin + varighet) > aStart {
                return andre
            }
        }
        return nil
    }
    /// Demo: flyttede møtetider (id → (start, slutt, dagkolonne)) så
    /// kalenderen flytter blokka umiddelbart uten backend.
    @State private var demoTidOverstyringer: [UUID: (String, String, Int?)] = [:]
    @State private var showStatsModal = false
    @State private var bookDayOfMonth: Int?
    // Header: delt LeadgridTabHeader eier all popover/sheet-state selv.
    // iPhone (compact): detalj-panelet vises som sheet i stedet for
    // side-stilt 340pt-kolonne — åpnes når et møte velges.
    @State private var phoneDetailOpen: Bool = false
    @Environment(AppState.self) private var appState

    // MARK: Datakilde (uke 2-binding) — demo → mocks, ellers ekte kalender

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    // MARK: Dørsalg brief-møter (2026-07-18)
    // Dørsalg-selgere har ingen lead-møter — leder (admin/salgssjef/
    // teamleder) inviterer teamet til brief før felt, med gjentakelse.
    @State private var briefEnvelope: BriefMeetingsEnvelope?
    @State private var showNewBrief = false
    /// Hybrid-org: brief-kortet kollapset til én linje (agendaen er
    /// skjermens jobb) — chevron/tap utvider. Ren dørsalg: alltid åpen.
    @State private var briefUtvidet = false

    private var dorsalgAktivert: Bool {
        EntitlementStore.shared.isExplicitlyEnabled(.dorsalgModus)
    }
    /// Ren dørsalg-org (leads låst): Møter-fanen = KUN brief-møter.
    private var erRenDorsalgOrg: Bool {
        EntitlementStore.shared.erRenDorsalgOrg
    }
    private var kanStyreBrief: Bool {
        if let env = briefEnvelope { return env.canManage }
        if appState.isSuperAdmin { return true }
        return ["admin", "salgssjef", "teamleder"].contains(appState.roleInOrg ?? "")
    }

    private func loadBriefs() async {
        guard dorsalgAktivert else { return }
        if isDemo {
            if briefEnvelope == nil { briefEnvelope = Self.demoBriefs }
            return
        }
        guard let api = appState.api else { return }
        TeamLiveStore.shared.attach(api: api, appState: appState)
        if let env = await api.fetchBriefMeetings() { briefEnvelope = env }
    }

    private func slettBrief(_ brief: BriefMeetingDTO) {
        if isDemo {
            briefEnvelope = BriefMeetingsEnvelope(
                canManage: briefEnvelope?.canManage ?? true,
                meetings: (briefEnvelope?.meetings ?? []).filter { $0.id != brief.id })
            return
        }
        guard let api = appState.api else { return }
        Task {
            _ = await api.deleteBriefMeeting(id: brief.id)
            await loadBriefs()
        }
    }

    /// Demo-briefer (aldri backend i demo).
    private static let demoBriefs = BriefMeetingsEnvelope(canManage: true, meetings: [
        BriefMeetingDTO(id: "demo-b1", title: "Morgenbrief før felt",
                        note: "Dagens rode, mål og innvendinger.",
                        startAt: "2026-01-05T07:15:00Z", durationMin: 15,
                        recurrence: "weekdays",
                        participants: ["demo-espen", "demo-helena", "demo-lars", "demo-marit"],
                        createdBy: "demo-aaron", createdByName: "Aaron Nilsen"),
        BriefMeetingDTO(id: "demo-b2", title: "Ukesoppsummering",
                        note: "Hit-rate, beste dører og neste ukes område.",
                        startAt: "2026-01-09T14:00:00Z", durationMin: 30,
                        recurrence: "weekly",
                        participants: ["demo-espen", "demo-helena", "demo-lars"],
                        createdBy: "demo-aaron", createdByName: "Aaron Nilsen"),
    ])

    private var meetingEvents: [CalendarEvent] {
        appState.calendar.filter { $0.eventType == "meeting" && $0.datetime != nil }
    }

    private func leadFor(_ event: CalendarEvent) -> LeadModel? {
        appState.leads.first {
            $0.name.caseInsensitiveCompare(event.leadName) == .orderedSame
        }
    }

    /// Sluttid («10:00») → Date i dag. Brukes av etter-møte-triggeren.
    private func sluttDatoIDag(_ endTime: String) -> Date? {
        let deler = endTime.split(separator: ":")
        guard deler.count == 2, let t = Int(deler[0]), let mn = Int(deler[1]) else { return nil }
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        comps.hour = t
        comps.minute = mn
        return Calendar.current.date(from: comps)
    }

    /// Ferdig + ikke logget = etterarbeids-gjeld (CTA + badge + varsel).
    private func trengerLogg(_ m: Meeting) -> Bool {
        guard let slutt = sluttDatoIDag(m.endTime) else { return false }
        return naa > slutt && !MoteLoggStatus.erLogget(m.id)
    }

    /// Lagre ny møtetid: demo → flytt blokka i minnet; ekte → PATCH
    /// next_follow_up_at (kalenderen er avledet av den) + full refresh.
    private func lagreNyMotetid(_ m: Meeting, start: Date, varighetMin: Int) {
        let df = DateFormatter()
        df.dateFormat = "HH:mm"
        let nyStart = df.string(from: start)
        let nySlutt = df.string(from: start.addingTimeInterval(Double(varighetMin) * 60))
        if isDemo {
            let dagKol = demoTidOverstyringer[m.id]?.2
            demoTidOverstyringer[m.id] = (nyStart, nySlutt, dagKol)
            return
        }
        Task { @MainActor in
            do {
                try await appState.api?.flyttMoteTid(leadId: m.id.uuidString.lowercased(), til: start)
                await appState.refreshAll()
            } catch {
                print("[Møter] flytting feilet: \(error)")
            }
        }
    }

    /// Dra-og-slipp i ukekalenderen: flytt møtet deltaDager/deltaMinutter.
    /// Tiden snappes til 30 min og klemmes til 07:00–18:30.
    private func flyttMote(_ m: Meeting, deltaDager: Int, deltaMin: Int) {
        let deler = m.startTime.split(separator: ":")
        guard deler.count == 2, let t = Int(deler[0]), let mn = Int(deler[1]) else { return }
        let sluttDeler = m.endTime.split(separator: ":")
        let varighet: Int = {
            guard sluttDeler.count == 2, let st = Int(sluttDeler[0]),
                  let sm = Int(sluttDeler[1]) else { return 60 }
            return max(30, (st * 60 + sm) - (t * 60 + mn))
        }()
        let nyStartMin = min(max(t * 60 + mn + deltaMin, 7 * 60), 18 * 60 + 30)
        // Konflikt-vakt: stopp flytting som lander oppå et annet møte
        // (samme dag — dag-bytte i ekte modus sjekkes ikke, vi kjenner
        // ikke måldagens agenda her).
        let sjekkKol = isDemo
            ? min(max((demoTidOverstyringer[m.id]?.2 ?? 1) + deltaDager, 0), 4)
            : nil
        if isDemo || deltaDager == 0 {
            if let kollisjon = overlappendeMote(m, nyStartMin: nyStartMin,
                                               varighet: varighet, nyDagKol: sjekkKol) {
                konfliktMelding = "Overlapper med \(kollisjon.company) (\(kollisjon.startTime)–\(kollisjon.endTime)). Møtet ble ikke flyttet."
                return
            }
        }
        let df = DateFormatter()
        df.dateFormat = "HH:mm"
        if isDemo {
            let nyStart = String(format: "%02d:%02d", nyStartMin / 60, nyStartMin % 60)
            let sluttMin = nyStartMin + varighet
            let nySlutt = String(format: "%02d:%02d", sluttMin / 60, sluttMin % 60)
            let gammelKol = demoTidOverstyringer[m.id]?.2 ?? 1  // tirsdag
            let nyKol = min(max(gammelKol + deltaDager, 0), 4)
            demoTidOverstyringer[m.id] = (nyStart, nySlutt, deltaDager == 0 ? demoTidOverstyringer[m.id]?.2 : nyKol)
            var comps = Calendar.current.dateComponents([.year, .month, .day], from: Date())
            comps.hour = nyStartMin / 60
            comps.minute = nyStartMin % 60
            if let basis = Calendar.current.date(from: comps),
               let dato = Calendar.current.date(byAdding: .day, value: deltaDager, to: basis) {
                Task { @MainActor in
                    flyttetInfo = await medReisetidsSjekk(
                        m, nyStart: dato, nyStartMin: nyStartMin,
                        varighet: varighet, dagKol: nyKol)
                }
            }
            return
        }
        // Ekte: ny dato = i dag + deltaDager, nytt klokkeslett.
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        comps.hour = nyStartMin / 60
        comps.minute = nyStartMin % 60
        guard let basis = Calendar.current.date(from: comps),
              let nyDato = Calendar.current.date(byAdding: .day, value: deltaDager, to: basis)
        else { return }
        Task { @MainActor in
            do {
                try await appState.api?.flyttMoteTid(leadId: m.id.uuidString.lowercased(), til: nyDato)
                await appState.refreshAll()
                // Reisetids-sjekken kjenner bare dagens agenda — hopp over
                // ved dag-bytte (måldagens agenda er ukjent her).
                if deltaDager == 0 {
                    flyttetInfo = await medReisetidsSjekk(
                        m, nyStart: nyDato, nyStartMin: nyStartMin,
                        varighet: varighet, dagKol: nil)
                } else {
                    flyttetInfo = FlyttetInfo(meeting: m, nyStart: nyDato,
                                              varighetMin: varighet)
                }
            } catch {
                print("[Møter] dra-flytting feilet: \(error)")
            }
        }
    }

    /// «HH:mm» → minutter siden midnatt.
    private func minutter(_ s: String) -> Int? {
        let d = s.split(separator: ":")
        guard d.count == 2, let t = Int(d[0]), let mn = Int(d[1]) else { return nil }
        return t * 60 + mn
    }

    /// «10:45» av en Date — til anbefalt-knappen.
    private func kortTid(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: d)
    }

    /// Klokkeslett (minutter) på samme dag som referansedatoen.
    private func dato(paaSammeDagSom d: Date, minutt: Int) -> Date? {
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: d)
        comps.hour = minutt / 60
        comps.minute = minutt % 60
        return Calendar.current.date(from: comps)
    }

    /// Ruteplanlegger-motoren kicker inn på flytting: rekker du kjøreturen
    /// fra forrige møte, og videre til neste? Ved for lite luft foreslås
    /// et tidspunkt som faktisk går opp (kjøretid + 5 min buffer, kvarter-
    /// snappet, aldri oppå et annet møte).
    private func medReisetidsSjekk(_ m: Meeting, nyStart: Date, nyStartMin: Int,
                                   varighet: Int, dagKol: Int?) async -> FlyttetInfo {
        var info = FlyttetInfo(meeting: m, nyStart: nyStart, varighetMin: varighet)
        let naboer = sourceAgenda.filter { andre in
            guard andre.id != m.id else { return false }
            if isDemo { return (andre.demoDagKolonne ?? 1) == (dagKol ?? 1) }
            return true
        }
        let nySluttMin = nyStartMin + varighet
        let buffer = ReisetidsVakt.bufferMin

        // Bakover: rekker du FRAM hit fra møtet før?
        if let (forrige, forrigeSlutt) = naboer.compactMap({ a -> (Meeting, Int)? in
            guard let slutt = minutter(a.endTime), slutt <= nyStartMin else { return nil }
            return (a, slutt)
        }).max(by: { $0.1 < $1.1 }),
           let kjore = await ReisetidsVakt.kjoretidMin(
               fraLat: forrige.lat, fraLon: forrige.lon, tilLat: m.lat, tilLon: m.lon),
           kjore > 0, kjore + buffer > nyStartMin - forrigeSlutt {
            let gap = max(nyStartMin - forrigeSlutt, 0)
            info.reisevarsel = "Kjøreturen fra \(forrige.company) tar ~\(kjore) min — du har \(gap) min."
            let snappet = Int((Double(forrigeSlutt + kjore + buffer) / 15).rounded(.up)) * 15
            if snappet + varighet <= 20 * 60,
               overlappendeMote(m, nyStartMin: snappet, varighet: varighet,
                                nyDagKol: dagKol) == nil {
                info.anbefaltStart = dato(paaSammeDagSom: nyStart, minutt: snappet)
            }
        }

        // Framover: rekker du VIDERE til neste møte?
        if info.reisevarsel == nil,
           let (neste, nesteStart) = naboer.compactMap({ a -> (Meeting, Int)? in
            guard let start = minutter(a.startTime), start >= nySluttMin else { return nil }
            return (a, start)
        }).min(by: { $0.1 < $1.1 }),
           let kjore = await ReisetidsVakt.kjoretidMin(
               fraLat: m.lat, fraLon: m.lon, tilLat: neste.lat, tilLon: neste.lon),
           kjore > 0, kjore + buffer > nesteStart - nySluttMin {
            let gap = max(nesteStart - nySluttMin, 0)
            info.reisevarsel = "Du får \(gap) min til \(neste.company) — kjøreturen tar ~\(kjore) min."
            let snappet = Int((Double(nesteStart - kjore - buffer - varighet) / 15)
                .rounded(.down)) * 15
            if snappet >= 7 * 60,
               overlappendeMote(m, nyStartMin: snappet, varighet: varighet,
                                nyDagKol: dagKol) == nil {
                info.anbefaltStart = dato(paaSammeDagSom: nyStart, minutt: snappet)
            }
        }
        return info
    }

    /// Passiv reisetids-vakt: sveip over dagens agenda og merk møter du
    /// ikke rekker å kjøre til fra møtet før.
    private func oppdaterReisetidsAdvarsler() async {
        var nye: [UUID: String] = [:]
        // Demo: kun møter i samme ukedag-kolonne henger sammen tidsmessig.
        let grupper: [[Meeting]] = isDemo
            ? Dictionary(grouping: sourceAgenda, by: { $0.demoDagKolonne ?? 1 })
                .values.map { $0.sorted { $0.startTime < $1.startTime } }
            : [sourceAgenda]
        for liste in grupper {
            for (a, b) in zip(liste, liste.dropFirst()) {
                guard let aSlutt = minutter(a.endTime),
                      let bStart = minutter(b.startTime) else { continue }
                let gap = bStart - aSlutt
                guard gap >= 0 else { continue }  // overlapp eies av konflikt-vakta
                guard let kjore = await ReisetidsVakt.kjoretidMin(
                    fraLat: a.lat, fraLon: a.lon, tilLat: b.lat, tilLon: b.lon),
                      kjore > 0 else { continue }
                if kjore + ReisetidsVakt.bufferMin > gap {
                    nye[b.id] = "~\(kjore) min kjøring fra \(a.company) — \(gap) min mellom"
                }
            }
        }
        reisetidsAdvarsler = nye
    }

    /// Endrer agendaen seg (flytt/varighet/refresh) → sjekk reisetidene på nytt.
    private var agendaTidsSignatur: String {
        sourceAgenda
            .map { "\($0.id.uuidString)|\($0.startTime)|\($0.endTime)|\($0.demoDagKolonne ?? -1)" }
            .joined(separator: ";")
    }

    /// «Varsle kontakten» etter drag-flytt: ferdig Mail-utkast (aldri
    /// auto-send) — samme tilbud som Endre tidspunkt-arkets toggle.
    private func aapneFlytteUtkast(_ info: FlyttetInfo) {
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        df.dateFormat = "EEEE d. MMMM 'kl.' HH:mm"
        var brodtekst = "Hei \(info.meeting.contactName)!\n\nMøtet vårt er flyttet til \(df.string(from: info.nyStart))."
        brodtekst += "\n\nGi beskjed om det ikke passer, så finner vi et annet tidspunkt.\n\nMvh"
        var comps = URLComponents(string: "mailto:")
        comps?.queryItems = [
            URLQueryItem(name: "subject", value: "Nytt tidspunkt — møtet med \(info.meeting.company)"),
            URLQueryItem(name: "body", value: brodtekst),
        ]
        if let url = comps?.url { UIApplication.shared.open(url) }
    }

    /// Dagens møter (agenda-lista + dag/uke/måned-visningene).
    /// Tidsoverstyring på et møte (flytt/varighet) — umiddelbar visning.
    private func medOverstyring(_ m: Meeting) -> Meeting {
        guard let ny = demoTidOverstyringer[m.id] else { return m }
        var kopi = m
        kopi.startTime = ny.0
        kopi.endTime = ny.1
        kopi.demoDagKolonne = ny.2
        return kopi
    }

    /// Varighet-drag (bunnkant av blokk): endre sluttiden ±30 min-snap.
    /// Varighet persisteres ikke i backend — lokal visning i begge moduser.
    private func endreVarighet(_ m: Meeting, deltaMin: Int) {
        let sd = m.startTime.split(separator: ":")
        let ed = m.endTime.split(separator: ":")
        guard sd.count == 2, ed.count == 2,
              let st = Int(sd[0]), let sm = Int(sd[1]),
              let et = Int(ed[0]), let em = Int(ed[1]) else { return }
        let startMin = st * 60 + sm
        let nySluttMin = min(max(et * 60 + em + deltaMin, startMin + 30), 20 * 60)
        let nySlutt = String(format: "%02d:%02d", nySluttMin / 60, nySluttMin % 60)
        let dagKol = demoTidOverstyringer[m.id]?.2
        demoTidOverstyringer[m.id] = (m.startTime, nySlutt, dagKol)
    }

    private var sourceAgenda: [Meeting] {
        if isDemo {
            return MeetingsData.agenda.map(medOverstyring)
                .sorted { $0.startTime < $1.startTime }
        }
        let cal = Calendar.current
        // Ekte modus: varighet finnes ikke server-side (kalenderen er
        // avledet av next_follow_up_at) — varighet-endringer vises lokalt.
        return meetingEvents
            .filter { cal.isDateInToday($0.datetime ?? .distantPast) }
            .sorted { ($0.datetime ?? .distantPast) < ($1.datetime ?? .distantPast) }
            .map { medOverstyring(Meeting(from: $0, lead: leadFor($0))) }
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
        .task { await loadBriefs() }
        .sheet(item: $reschedulingMeeting) { m in
            RescheduleSheet(meeting: m) { nyStart, varighet in
                lagreNyMotetid(m, start: nyStart, varighetMin: varighet)
            }
        }
        .sheet(item: $etterMoteFraVarsel) { m in
            EtterMoteSheet(selskap: m.company, kontakt: m.contactName,
                           moteId: m.id)
        }
        .onReceive(Timer.publish(every: 60, on: .main, in: .common).autoconnect()) { t in
            naa = t
        }
        .alert("Møtekonflikt", isPresented: Binding(
            get: { konfliktMelding != nil },
            set: { if !$0 { konfliktMelding = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(konfliktMelding ?? "")
        }
        .alert("Møtet er flyttet", isPresented: Binding(
            get: { flyttetInfo != nil },
            set: { if !$0 { flyttetInfo = nil } }), presenting: flyttetInfo) { info in
            if let anbefalt = info.anbefaltStart {
                Button("Flytt til \(kortTid(anbefalt)) (anbefalt)") {
                    lagreNyMotetid(info.meeting, start: anbefalt,
                                   varighetMin: info.varighetMin)
                }
            }
            Button("Varsle kontakten") { aapneFlytteUtkast(info) }
            Button("Ferdig", role: .cancel) {}
        } message: { info in
            let df: DateFormatter = {
                let f = DateFormatter()
                f.locale = Locale(identifier: "nb_NO")
                f.dateFormat = "EEEE d. MMMM 'kl.' HH:mm"
                return f
            }()
            let basis = "\(info.meeting.company) → \(df.string(from: info.nyStart)). Vil du sende beskjed til \(info.meeting.contactName)?"
            Text(info.reisevarsel.map { "\(basis)\n\n⚠️ \($0)" } ?? basis)
        }
        // Reisetids-vakta: re-sjekk agendaen når tider/rekkefølge endres.
        .task(id: agendaTidsSignatur) { await oppdaterReisetidsAdvarsler() }
        // Kveldsbrief: kl. 17 hvis morgendagen har møter (idempotent per dag).
        .task(id: sourceUpcoming.count) {
            let kal = Calendar.current
            let iMorgen = sourceUpcoming.filter { u in
                guard let d = u.date else { return false }
                return kal.isDateInTomorrow(d)
            }.count
            MoteVarsler.planleggKveldsbrief(antallIMorgen: iMorgen)
        }
        // Planlegg «logg møtet»-varsler ved møteslutt (re-planlegging er
        // idempotent — samme identifier erstatter).
        .task(id: sourceAgenda.count) {
            let moter = sourceAgenda.compactMap { m -> (UUID, String, Date)? in
                guard let slutt = sluttDatoIDag(m.endTime) else { return nil }
                return (m.id, m.company, slutt)
            }
            MoteVarsler.planlegg(moter: moter.map { (id: $0.0, selskap: $0.1, slutt: $0.2) })
        }
        // Varsel-tap («etter_mote») → åpne etterarbeidet for selskapet.
        .task(id: appState.pendingEtterMoteSelskap) {
            guard let selskap = appState.pendingEtterMoteSelskap else { return }
            let m = sourceAgenda.first {
                $0.company.caseInsensitiveCompare(selskap) == .orderedSame
            }
            etterMoteFraVarsel = m ?? Meeting(
                startTime: "", endTime: "", company: selskap, location: "",
                contactName: "", contactRole: "", status: .confirmed,
                icon: "building.2.fill", iconColor: MtBrand.purpleLight,
                address: "", meetingRoom: nil, leadScore: 0, leadType: "",
                valueNok: 0, lat: 0, lon: 0, driveTimeMin: 0,
                driveDistanceKm: 0, trafficStatus: "")
            appState.clearEtterMoteDeepLink()
        }
        .sheet(isPresented: $showNewBrief) {
            NewBriefSheet { title, note, startAt, durationMin, recurrence, participants in
                if isDemo {
                    let ny = BriefMeetingDTO(
                        id: UUID().uuidString, title: title, note: note,
                        startAt: ISO8601DateFormatter().string(from: startAt),
                        durationMin: durationMin, recurrence: recurrence,
                        participants: participants,
                        createdBy: "demo", createdByName: "Deg (demo)")
                    briefEnvelope = BriefMeetingsEnvelope(
                        canManage: true,
                        meetings: (briefEnvelope?.meetings ?? []) + [ny])
                    return
                }
                guard let api = appState.api else { return }
                Task {
                    _ = await api.createBriefMeeting(
                        title: title, note: note, startAt: startAt,
                        durationMin: durationMin, recurrence: recurrence,
                        participants: participants)
                    await loadBriefs()
                }
            }
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
        // iPhone (compact): samme MeetingDetailSidebar som iPad viser til
        // høyre, presentert som sheet (sidebar-en eier sine egne under-ark).
        .sheet(isPresented: $phoneDetailOpen) {
            MeetingDetailSidebar(meeting: selectedMeeting, calMode: $calMode)
                .background(MtBrand.bg.ignoresSafeArea())
                .preferredColorScheme(.dark)
                .presentationDetents([.large])
        }
    }

    /// Felles valg-handling — oppdaterer utvalget og åpner detalj-sheeten
    /// på iPhone (der høyre-panelet ikke vises side-stilt).
    private func selectMeeting(_ m: Meeting) {
        selectedID = m.id
        if DeviceIdiom.isPhone { phoneDetailOpen = true }
    }

    private var content: some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 0) {
                header
                    .padding(.horizontal, 20).padding(.top, 14)
                if !erRenDorsalgOrg {
                    kpiRow
                        .padding(.horizontal, 20).padding(.top, 14)
                }

                ScrollView {
                    VStack(spacing: 14) {
                        // Dørsalg: brief-møtene øverst; ren dørsalg-org ser
                        // KUN disse (ingen lead-møter/agenda).
                        if dorsalgAktivert {
                            AnyView(briefCard)
                        }
                        if !erRenDorsalgOrg {
                            agendaCard
                            upcomingCard
                        }
                        // All møteforberedelse er flyttet til høyre sidebar (kontekst-bundet til valgt møte)
                    }
                    .padding(.horizontal, 20).padding(.top, 14)
                    .padding(.bottom, 20)
                }
            }
            .frame(maxWidth: .infinity)

            // Detail sidebar høyre — iPhone (compact): 340pt side-stilt
            // kolonne får ikke plass — detaljene vises i stedet som sheet
            // når et møte velges.
            if !DeviceIdiom.isPhone && !erRenDorsalgOrg {
                if sourceAgenda.isEmpty {
                    MeetingDetailEmptyState()
                        .frame(width: 340)
                } else {
                    MeetingDetailSidebar(meeting: selectedMeeting, calMode: $calMode,
                                         onReschedule: { m in reschedulingMeeting = m },
                                         naa: naa)
                        .frame(width: 340)
                }
            }
        }
    }

    // MARK: Header — delt LeadgridTabHeader (fasit: Oversikt-fanen)

    /// Demo-aware datakilde for header-badges/popovers.
    private var headerLeads: [LeadModel] {
        DemoModeManager.isActiveNonisolated
            ? DemoModeManager.shared.mockLeads
            : appState.leads
    }

    private var header: some View {
        LeadgridTabHeader(
            subtitle: erRenDorsalgOrg
                ? "Brief-møter før felt — leder samler teamet."
                : "Planlegg, forbered og følg opp møter",
            leads: headerLeads)
    }

    // MARK: Brief-møter (dørsalg)

    private var briefCard: some View {
        // UI-fokus fase 4: i hybrid-org er agendaen skjermens jobb —
        // brief-kortet kollapses til ÉN linje m/ chevron (neste brief som
        // hint). Ren dørsalg-org har brief som hovedinnhold → alltid åpen.
        let briefs = (briefEnvelope?.meetings ?? [])
            .sorted { ($0.nesteForekomst() ?? .distantFuture) < ($1.nesteForekomst() ?? .distantFuture) }
        let utvidet = erRenDorsalgOrg || briefUtvidet
        return VStack(alignment: .leading, spacing: utvidet ? 12 : 0) {
            HStack(spacing: 7) {
                Image(systemName: "person.3.fill").foregroundStyle(MtBrand.purpleLight)
                Text("Brief-møter").font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
                if !utvidet {
                    if let neste = briefs.first, let tid = neste.nesteForekomst() {
                        Text("· neste: \(Self.briefKortFormat.string(from: tid))")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(MtBrand.green)
                            .lineLimit(1)
                    } else {
                        Text("· ingen planlagt")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(MtBrand.textTertiary)
                    }
                }
                Spacer()
                if utvidet && kanStyreBrief {
                    Button { showNewBrief = true } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text("Nytt brief-møte")
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(
                            LinearGradient(colors: [MtBrand.purple, MtBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                if !erRenDorsalgOrg {
                    Button {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                            briefUtvidet.toggle()
                        }
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(MtBrand.textSecondary)
                            .rotationEffect(.degrees(briefUtvidet ? 180 : 0))
                            .frame(width: 28, height: 28)
                            .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8)
                                .stroke(MtBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                guard !erRenDorsalgOrg else { return }
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                    briefUtvidet.toggle()
                }
            }
            if utvidet {
                if briefs.isEmpty {
                    Text(kanStyreBrief
                         ? "Ingen brief-møter enda. Opprett et — teamet varsles og møtet kan gjentas daglig, på hverdager eller ukentlig."
                         : "Ingen brief-møter enda. Lederen din inviterer deg til brief før felt.")
                        .font(.appScaled(size: 11)).foregroundStyle(MtBrand.textSecondary)
                } else {
                    ForEach(briefs) { brief in
                        briefRow(brief)
                    }
                }
            }
        }
        .padding(14)
        .background(MtBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(MtBrand.purple.opacity(0.3), lineWidth: 1))
    }

    static let briefKortFormat: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "EEE HH:mm"
        return f
    }()

    private func briefRow(_ brief: BriefMeetingDTO) -> some View {
        let neste = brief.nesteForekomst()
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "EEE d. MMM · HH:mm"
        return HStack(spacing: 11) {
            ZStack {
                Circle().fill(MtBrand.purpleLight.opacity(0.2))
                Image(systemName: "megaphone.fill")
                    .font(.appScaled(size: 13)).foregroundStyle(MtBrand.purpleLight)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 3) {
                Text(brief.title)
                    .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                HStack(spacing: 6) {
                    if let neste {
                        Text(f.string(from: neste).capitalized)
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(MtBrand.green)
                    }
                    Text(brief.recurrenceLabel)
                        .font(.appScaled(size: 8, weight: .bold)).foregroundStyle(MtBrand.purpleLight)
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(MtBrand.purpleLight.opacity(0.15), in: Capsule())
                    Text("\(brief.participants.count) invitert")
                        .font(.appScaled(size: 9)).foregroundStyle(MtBrand.textSecondary)
                }
                if !brief.note.isEmpty {
                    Text(brief.note)
                        .font(.appScaled(size: 10)).foregroundStyle(MtBrand.textSecondary).lineLimit(1)
                }
            }
            Spacer()
            Text("\(brief.durationMin) min")
                .font(.appScaled(size: 10, weight: .semibold)).foregroundStyle(MtBrand.textSecondary)
            if kanStyreBrief {
                Button { slettBrief(brief) } label: {
                    Image(systemName: "trash")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(MtBrand.red.opacity(0.8))
                        .frame(width: 28, height: 28)
                        .background(MtBrand.red.opacity(0.12), in: Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
    }

    // MARK: KPI

    private var kpiRow: some View {
        // Alle idiomer (Daniel 2026-07-05): kompakt statistikk-knapp m/
        // kortene i modal — samme mønster på iPhone, iPad og Mac.
        statsButton
            .sheet(isPresented: $showStatsModal) { statsModal }
    }

    private var kpiCards: some View {
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

        return Group {
            kpiCard(title: "Møter i dag",  value: isDemo ? "5"       : (todayCount > 0 ? "\(todayCount)" : "—"), subtitle: isDemo ? "2 igjen" : (todayCount > 0 ? "\(remaining) igjen" : "Ingen møter i dag"), icon: "calendar", color: MtBrand.purpleLight)
            kpiCard(title: "Denne uken",   value: isDemo ? "12"      : (weekCount > 0 ? "\(weekCount)" : "—"), subtitle: isDemo ? "3 bekreftet" : (weekCount > 0 ? "booket" : "Ingen data"), icon: "chart.line.uptrend.xyaxis", color: MtBrand.purpleLight)
            kpiCard(title: "Kommende",     value: isDemo ? "18"      : (next7 > 0 ? "\(next7)" : "—"), subtitle: "neste 7 dager", icon: "clock.fill", color: MtBrand.purpleLight)
            kpiCard(title: "Booket verdi", value: isDemo ? "2,4M kr" : (bookedValue > 0 ? fmtValue(bookedValue) : "—"), subtitle: isDemo ? "↑ 18% fra forrige uke" : "agenda + kommende", icon: "externaldrive.fill", color: MtBrand.purpleLight, trendPositive: isDemo)
        }
    }

    // ── iPhone: kompakt statistikk-knapp + modal ─────────────────────

    private var statsButton: some View {
        let todayCount = sourceAgenda.count
        let subtitle = isDemo ? "5 møter i dag" : "\(todayCount) møter i dag"
        return Button {
            showStatsModal = true
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(MtBrand.purpleLight.opacity(0.22))
                    Image(systemName: "chart.bar.fill")
                        // Fast 40pt-flis — ikonet skal ikke AX-skalere
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(MtBrand.purpleLight)
                }
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Statistikk")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.appScaled(size: 12))
                        .foregroundStyle(MtBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(MtBrand.textSecondary)
            }
            .padding(14)
            .background(MtBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14).stroke(MtBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var statsModal: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Statistikk")
                    .font(.appScaled(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 18)

                kpiCards
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
        .background(MtBrand.bg.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func kpiCard(title: String, value: String, subtitle: String, icon: String, color: Color, trendPositive: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(MtBrand.textSecondary)
                Text(value)
                    .font(.appScaled(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(subtitle)
                    .font(.appScaled(size: 10))
                    .foregroundStyle(trendPositive ? MtBrand.green : MtBrand.textTertiary)
            }
            Spacer(minLength: 0)
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(color.opacity(0.22))
                Image(systemName: icon)
                    .font(.appScaled(size: 16, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 40, height: 40)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MtBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(MtBrand.stroke, lineWidth: 1))
        // Hindrer at kortet strekker seg vertikalt i grid-celler på iPhone
        // (2x2-layouten i kpiRow) — kortet skal hugge innholdet sitt.
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: Agenda

    private var agendaCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            // AXStack: tittelen brakk bokstav-for-bokstav ved siden av
            // mode-pickeren på accessibility-størrelser (AX5-QA).
            AXStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(calendarCardTitle)
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    Text(calendarCardSubtitle)
                        .font(.appScaled(size: 12))
                        .foregroundStyle(MtBrand.textSecondary)
                }
                Spacer()
                if calMode == .week {
                    // Ukenavigasjon — uka var hardkodet «19.–25. mai» før.
                    HStack(spacing: 4) {
                        Button { ukeOffset -= 1 } label: {
                            Image(systemName: "chevron.left")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(MtBrand.textSecondary)
                                .frame(width: 26, height: 26)
                                .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 7))
                        }
                        .buttonStyle(.plain)
                        if ukeOffset != 0 {
                            Button { ukeOffset = 0 } label: {
                                Text("I dag")
                                    .font(.appScaled(size: 10, weight: .bold))
                                    .foregroundStyle(MtBrand.purpleLight)
                                    .padding(.horizontal, 8).padding(.vertical, 6)
                                    .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 7))
                            }
                            .buttonStyle(.plain)
                        }
                        Button { ukeOffset += 1 } label: {
                            Image(systemName: "chevron.right")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(MtBrand.textSecondary)
                                .frame(width: 26, height: 26)
                                .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 7))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.trailing, 6)
                }
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
                            .overlay(alignment: .topTrailing) {
                                // Etterarbeids-gjeld: synlig til møtet logges.
                                if trengerLogg(m) {
                                    HStack(spacing: 3) {
                                        Image(systemName: "exclamationmark.circle.fill")
                                            .font(.appScaled(size: 9, weight: .bold))
                                        Text("Ikke logget")
                                            .font(.appScaled(size: 9, weight: .bold))
                                    }
                                    .foregroundStyle(.black)
                                    .padding(.horizontal, 7).padding(.vertical, 3)
                                    .background(MtBrand.yellow, in: Capsule())
                                    .offset(x: -8, y: 6)
                                }
                            }
                            .overlay(alignment: .bottomTrailing) {
                                // Reisetids-vakta: du rekker ikke kjøreturen hit.
                                if let varsel = reisetidsAdvarsler[m.id] {
                                    HStack(spacing: 3) {
                                        Image(systemName: "car.fill")
                                            .font(.appScaled(size: 9, weight: .bold))
                                        Text(varsel)
                                            .font(.appScaled(size: 9, weight: .bold))
                                            .lineLimit(1)
                                    }
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 7).padding(.vertical, 3)
                                    .background(MtBrand.orange, in: Capsule())
                                    .offset(x: -8, y: -6)
                                }
                            }
                            .contextMenu {
                                Button {
                                    reschedulingMeeting = m
                                } label: {
                                    Label("Endre tidspunkt", systemImage: "calendar.badge.clock")
                                }
                                Button {
                                    selectMeeting(m)
                                } label: {
                                    Label("Vis detaljer", systemImage: "sidebar.trailing")
                                }
                            }
                    }
                    .padding(.bottom, 4)
                }
            case .day:
                DayCalendarView(meetings: sourceAgenda,
                                onMove: { m, minutter in
                                    flyttMote(m, deltaDager: 0, deltaMin: minutter)
                                },
                                onResize: { m, minutter in
                                    endreVarighet(m, deltaMin: minutter)
                                }) { m in
                    selectMeeting(m)
                }
                .padding(.horizontal, 12).padding(.bottom, 12)
            case .week:
                WeekCalendarView(
                    meetings: sourceAgenda,
                    upcoming: sourceUpcoming,
                    onReschedule: { m in reschedulingMeeting = m },
                    onMove: { m, dager, minutter in
                        flyttMote(m, deltaDager: dager, deltaMin: minutter)
                    },
                    onTapMeeting: { m in selectMeeting(m) },
                    onTapUpcoming: { u in upcomingDetail = u },
                    ukeStart: ukeStart,
                    visDagensMoter: ukeOffset == 0
                )
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

    /// «Uke N · d.–d. MMM» fra vist uke (ekte datoer, begge moduser).
    private var ukeSubtitle: String {
        var kal = Calendar(identifier: .iso8601)
        kal.firstWeekday = 2
        let ukeNr = kal.component(.weekOfYear, from: ukeStart)
        let slutt = kal.date(byAdding: .day, value: 6, to: ukeStart) ?? ukeStart
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        df.dateFormat = "d."
        let df2 = DateFormatter()
        df2.locale = Locale(identifier: "nb_NO")
        df2.dateFormat = "d. MMM"
        return "Uke \(ukeNr) · \(df.string(from: ukeStart))–\(df2.string(from: slutt))"
    }

    private var calendarCardSubtitle: String {
        // Demo viser mockup-datoene; ellers ekte dato/uke/måned.
        if isDemo {
            switch calMode {
            case .agenda: return "Tirsdag 20. mai · \(sourceAgenda.count) møter"
            case .day:    return "Tirsdag 20. mai · 07–19"
            case .week:   return ukeSubtitle
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

    // iPhone (compact width): kolonnene (tid 60pt / kontakt 130pt /
    // status 92pt) får ikke plass side-ved-side — render en stablet
    // rad i stedet for full tabellrad.
    @ViewBuilder
    private func agendaRow(_ m: Meeting) -> some View {
        if DeviceIdiom.isPhone {
            agendaRowCompact(m)
        } else {
            agendaRowFull(m)
        }
    }

    /// Kompakt rad for iPhone — tittel + tid øverst, kontakt + status
    /// under. Gjenbruker ikon og statusBadge fra full-raden.
    private func agendaRowCompact(_ m: Meeting) -> some View {
        let isSelected = m.id == selectedID
        return Button { selectMeeting(m) } label: {
            HStack(alignment: .top, spacing: 10) {
                // Bedrift-ikon
                ZStack {
                    Circle().fill(m.iconColor.opacity(0.22))
                    Image(systemName: m.icon)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(m.iconColor)
                }
                .frame(width: 36, height: 36)

                VStack(alignment: .leading, spacing: 4) {
                    // Tittel + tid
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(m.company)
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Spacer(minLength: 6)
                        Text("\(m.startTime)–\(m.endTime)")
                            .font(.appScaled(size: 11, weight: .semibold, design: .rounded))
                            .foregroundStyle(MtBrand.textSecondary)
                            .monospacedDigit()
                    }
                    // Metadata: kontakt + sted + status
                    HStack(spacing: 6) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(m.contactName)
                                .font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Text(m.location)
                                .font(.appScaled(size: 10))
                                .foregroundStyle(MtBrand.textSecondary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 6)
                        statusBadge(m.status)
                    }
                }
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

    private func agendaRowFull(_ m: Meeting) -> some View {
        let isSelected = m.id == selectedID
        return Button { selectMeeting(m) } label: {
            HStack(spacing: 0) {
                // Tid-kolonne
                VStack(alignment: .leading, spacing: 1) {
                    Text(m.startTime)
                        .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                    Text(m.endTime)
                        .font(.appScaled(size: 11))
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
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(m.iconColor)
                }
                .frame(width: 36, height: 36)
                .padding(.trailing, 11)

                // Bedrift + sted
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.company)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(m.location)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(MtBrand.textSecondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Kontaktperson
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.contactName)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(m.contactRole)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(MtBrand.textSecondary)
                        .lineLimit(1)
                }
                .frame(width: 130, alignment: .leading)

                // Status-badge
                statusBadge(m.status)
                    .frame(width: 92, alignment: .center)

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 11, weight: .semibold))
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
            .font(.appScaled(size: 10, weight: .bold))
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
                .font(.appScaled(size: 34))
                .foregroundStyle(MtBrand.textTertiary)
            Text("Ingen møter i dag")
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(.white)
            Text("Bok et møte fra en lead, eller skru på demo-modus for eksempler.")
                .font(.appScaled(size: 12))
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
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                if hasUpcoming {
                    Text("\(sourceUpcoming.count)")
                        .font(.appScaled(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(MtBrand.purpleLight)
                        .monospacedDigit()
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(MtBrand.purple.opacity(0.18), in: Capsule())
                }
                Spacer()
                if hasUpcoming {
                    Button { showAllUpcoming = true } label: {
                        Text("Se alle")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(MtBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
            }
            if hasUpcoming {
                // iPhone (compact): 4 kort side-ved-side blir uleselig smale
                // — bruk 2-kolonne-grid i stedet.
                if DeviceIdiom.isPhone {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
                        ForEach(sourceUpcoming.prefix(3)) { u in
                            upcomingMini(u)
                        }
                        seeAllCard
                    }
                } else {
                    // iPad: FAST kortbredde i horisontal scroller — HStack
                    // med flexible kort ble klemt til uleselige striper når
                    // sidemenyen (overlay) smalnet innholdsbredden.
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(sourceUpcoming.prefix(3)) { u in
                                upcomingMini(u)
                                    .frame(width: 200)
                            }
                            seeAllCard
                                .frame(width: 150)
                        }
                    }
                    .scrollBounceBehavior(.basedOnSize)
                }
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.appScaled(size: 26))
                        .foregroundStyle(MtBrand.textTertiary)
                    Text("Ingen kommende møter")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(MtBrand.textSecondary)
                    Text("Bok et møte fra en lead, eller skru på demo-modus for eksempler.")
                        .font(.appScaled(size: 10))
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
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(MtBrand.textSecondary)
                    Spacer()
                    Text(u.time)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
                HStack(spacing: 7) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 7)
                            .fill(u.iconColor.opacity(0.22))
                        Image(systemName: u.icon)
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(u.iconColor)
                    }
                    .frame(width: 24, height: 24)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(u.company)
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Text(u.location)
                            .font(.appScaled(size: 10))
                            .foregroundStyle(MtBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                HStack(spacing: 5) {
                    // Prep-status
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
                    Spacer()
                    // Verdi
                    Text("NOK \(u.valueNok / 1000)k")
                        .font(.appScaled(size: 9, weight: .bold, design: .rounded))
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
                    .font(.appScaled(size: 16, weight: .semibold))
                    .foregroundStyle(MtBrand.purpleLight)
                Text("Se alle møter")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(MtBrand.purpleLight)
                Text("+\(max(0, sourceUpcoming.count - 3)) flere")
                    .font(.appScaled(size: 9, weight: .semibold))
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
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                // «Rediger»-knapp fjernet 2026-07-17: var død (tom closure) —
                // prep-editor har ingen flate enda.
            }
            if MeetingsData.prep.isEmpty {
                Text("Ingen forberedelser registrert enda")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(MtBrand.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            } else {
                VStack(alignment: .leading, spacing: 11) {
                    ForEach(MeetingsData.prep) { p in
                        prepRow(p)
                    }
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
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(p.color)
                }
                .frame(width: 28, height: 28)
                Text(p.category)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 120, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                ForEach(p.bullets, id: \.self) { bullet in
                    HStack(alignment: .top, spacing: 6) {
                        Text("•")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(MtBrand.textSecondary)
                        Text(bullet)
                            .font(.appScaled(size: 12))
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
                .font(.appScaled(size: 44))
                .foregroundStyle(MtBrand.textTertiary)
            Text("Ingen møte valgt")
                .font(.appScaled(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text("Detaljer, rute og AI-innsikt vises her når du har valgt et møte.")
                .font(.appScaled(size: 12))
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

/// Favoritt-persistering pr møte-id (UserDefaults). Backend-møter har stabil
/// uuid avledet fra event-id, så favoritten overlever re-mapping og relaunch.
enum MeetingFavorites {
    private static let key = "meetings.favorites"
    static func isFavorite(_ id: UUID) -> Bool {
        (UserDefaults.standard.stringArray(forKey: key) ?? []).contains(id.uuidString)
    }
    static func set(_ id: UUID, favorite: Bool) {
        var ids = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
        if favorite { ids.insert(id.uuidString) } else { ids.remove(id.uuidString) }
        UserDefaults.standard.set(Array(ids), forKey: key)
    }
}

struct MeetingDetailSidebar: View {
    let meeting: Meeting
    @Binding var calMode: CalendarMode
    /// Forelderen eier flytte-lagringen (backend/demo-overstyring) — uten
    /// callback faller vi tilbake til lokal sheet (visning uten lagring).
    var onReschedule: ((Meeting) -> Void)? = nil
    /// Minutt-tikk fra forelderen — driver «Logg møtet»-CTA-byttet.
    var naa: Date = Date()

    /// Etter-møte-triggeren: sluttid passert + ikke logget.
    private var moteTrengerLogg: Bool {
        let deler = meeting.endTime.split(separator: ":")
        guard deler.count == 2, let t = Int(deler[0]), let mn = Int(deler[1]) else { return false }
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        comps.hour = t
        comps.minute = mn
        guard let slutt = Calendar.current.date(from: comps) else { return false }
        return naa > slutt && !MoteLoggStatus.erLogget(meeting.id)
    }
    @Environment(AppState.self) private var appState

    @State private var favorited: Bool = false
    @State private var showStartMeeting = false
    @State private var showLogNote = false
    @State private var showOpenLead = false
    @State private var showReschedule = false
    @State private var showStatusPicker = false
    @State private var showCancelMeeting = false
    @State private var showAssignSeller = false
    @State private var showAddCampaign = false
    @State private var showAIInsights = false
    @State private var showMoteBrief = false
    @State private var showEtterMote = false
    @State private var showHistory = false
    @State private var showPrepCore = false
    @State private var showStakeholders = false
    @State private var showChecklist = false
    @State private var toast: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // UI-fokus fase 4 (audit: Møter 2/5): ÉN primær CTA («Start
                // møte») + én sekundær rad — Logg notat/Aktivitet/Mål &
                // behov/Stakeholders bor i ⋯-menyen («Forberedelse»).
                header
                meta
                contactRow
                value
                primaerCTA
                sekundaerRad
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
        .sheet(isPresented: $showStartMeeting) {
            StartMeetingSheet(meeting: meeting, onAvsluttOgLogg: {
                showStartMeeting = false
                showEtterMote = true
            })
        }
        .sheet(isPresented: $showLogNote)             { LogNoteSheet(meeting: meeting) }
        .sheet(isPresented: $showOpenLead)            { LeadDetailStub(meeting: meeting) }
        .sheet(isPresented: $showReschedule)          { RescheduleSheet(meeting: meeting) }
        .sheet(isPresented: $showStatusPicker)        { StatusPickerSheet(meeting: meeting) }
        .sheet(isPresented: $showCancelMeeting)       { CancelMeetingSheet(meeting: meeting) }
        .sheet(isPresented: $showAssignSeller)        { AssignSellerSheet(meeting: meeting) }
        .sheet(isPresented: $showAddCampaign)         { AddToCampaignSheet(meeting: meeting) }
        .sheet(isPresented: $showAIInsights)          { PrepInsightsModal(meetingCompany: meeting.company, meetingContact: meeting.contactName) }
        .sheet(isPresented: $showEtterMote) {
            EtterMoteSheet(selskap: meeting.company,
                           kontakt: meeting.contactName,
                           moteId: meeting.id)
        }
        .sheet(isPresented: $showMoteBrief) {
            MoteBriefSheet(selskap: meeting.company,
                           kontakt: meeting.contactName,
                           kontaktRolle: meeting.contactRole,
                           motetid: "\(meeting.startTime)–\(meeting.endTime)",
                           leadStatus: meeting.status.label)
        }
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
                        .font(.appScaled(size: 18, weight: .semibold))
                        .foregroundStyle(meeting.iconColor)
                }
                .frame(width: 46, height: 46)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(meeting.company)
                            .font(.appScaled(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                        Button {
                            favorited.toggle()
                            MeetingFavorites.set(meeting.id, favorite: favorited)
                            flashToast(favorited ? "Markert som favoritt" : "Favoritt fjernet")
                        } label: {
                            Image(systemName: favorited ? "star.fill" : "star")
                                .font(.appScaled(size: 12))
                                .foregroundStyle(favorited ? MtBrand.yellow : MtBrand.textTertiary)
                        }
                        .buttonStyle(.plain)
                        .task(id: meeting.id) { favorited = MeetingFavorites.isFavorite(meeting.id) }
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
                    .font(.appScaled(size: 10, weight: .semibold))
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
                Button {
                    if let onReschedule { onReschedule(meeting) }
                    else { showReschedule = true }
                } label: {
                    Label("Endre tidspunkt", systemImage: "calendar.badge.clock")
                }
                Button { showStatusPicker = true } label: {
                    Label("Endre status", systemImage: "flag.fill")
                }
                Button { showEtterMote = true } label: {
                    Label("Etter møtet — logg & oppfølging", systemImage: "checkmark.rectangle.stack.fill")
                }
                Button(role: .destructive) {
                    showCancelMeeting = true
                } label: {
                    Label("Avlys møte", systemImage: "xmark.circle.fill")
                }
            }
            // UI-fokus fase 4: prep-verktøyene flyttet hit fra 2×4-gridet —
            // sheets/state er uendret, kun inngangen er samlet.
            Section("Forberedelse") {
                Button { showAIInsights = true } label: {
                    Label("AI-innsikt", systemImage: "sparkles")
                }
                Button { showLogNote = true } label: {
                    Label("Logg notat", systemImage: "square.and.pencil")
                }
                Button { showHistory = true } label: {
                    Label("Aktivitet", systemImage: "clock.arrow.circlepath")
                }
                Button { showPrepCore = true } label: {
                    Label("Mål & behov", systemImage: "target")
                }
                Button { showStakeholders = true } label: {
                    Label("Stakeholders", systemImage: "person.3.fill")
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
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(MtBrand.textSecondary)
                .padding(8)
                .contentShape(Rectangle())
        }
    }

    private func badge(_ label: String, color: Color) -> some View {
        Text(label)
            .font(.appScaled(size: 9, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(color.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
    }

    private var meta: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 9) {
                ZStack { Circle().fill(MtBrand.purple.opacity(0.18)); Image(systemName: "calendar").font(.appScaled(size: 11)).foregroundStyle(MtBrand.purpleLight) }
                .frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Tirsdag 20. mai 2026")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("\(meeting.startTime) – \(meeting.endTime)")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(MtBrand.textSecondary)
                }
            }
            HStack(spacing: 9) {
                ZStack { Circle().fill(MtBrand.purple.opacity(0.18)); Image(systemName: "mappin.and.ellipse").font(.appScaled(size: 11)).foregroundStyle(MtBrand.purpleLight) }
                .frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: 1) {
                    Text(meeting.address)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    if let room = meeting.meetingRoom {
                        Text("Møterom: \(room)")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(MtBrand.textSecondary)
                    }
                }
            }
        }
    }

    private var contactRow: some View {
        HStack(spacing: 9) {
            ZStack { Circle().fill(MtBrand.purple.opacity(0.18)); Image(systemName: "person.fill").font(.appScaled(size: 11)).foregroundStyle(MtBrand.purpleLight) }
            .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 1) {
                Text(meeting.contactName)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Text(meeting.contactRole)
                    .font(.appScaled(size: 11))
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
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 28, height: 28)
        }
        .buttonStyle(.plain)
    }

    private var value: some View {
        HStack {
            HStack(spacing: 9) {
                ZStack { Circle().fill(MtBrand.purple.opacity(0.18)); Image(systemName: "norwegiankronesign.circle.fill").font(.appScaled(size: 11)).foregroundStyle(MtBrand.purpleLight) }
                .frame(width: 26, height: 26)
                Text("Forventet verdi")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(MtBrand.textSecondary)
            }
            Spacer()
            Text("NOK \(formatNok(meeting.valueNok))")
                .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
        }
    }

    /// ÉN primær CTA — «Start møte» er skjermens jobb (audit-regel 2:
    /// én-lilla-per-skjerm). AI/notat/prep bor bak ⋯ («Forberedelse»).
    private var primaerCTA: some View {
        Group {
            if moteTrengerLogg {
                // Møtet er ferdig og ulogget: etterarbeidet ER primær-
                // handlingen nå (glemselskurven: send innen timen).
                VStack(spacing: 5) {
                    Button { showEtterMote = true } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.rectangle.stack.fill")
                                .font(.appScaled(size: 14, weight: .bold))
                            Text("Logg møtet — 2 min")
                                .font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            LinearGradient(colors: [MtBrand.yellow, MtBrand.orange],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .shadow(color: MtBrand.yellow.opacity(0.35), radius: 7, y: 2)
                    }
                    .buttonStyle(.plain)
                    Text("Oppfølging innen timen vinner avtaler — 80 % av møtet er glemt i morgen.")
                        .font(.appScaled(size: 9))
                        .foregroundStyle(MtBrand.textTertiary)
                }
            } else {
                Button { showStartMeeting = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "play.circle.fill")
                            .font(.appScaled(size: 14, weight: .bold))
                        Text("Start møte")
                            .font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        LinearGradient(colors: [MtBrand.purple, MtBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .shadow(color: MtBrand.purple.opacity(0.35), radius: 7, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Én sekundær rad: Naviger + AI-innsikt. Ring/e-post ligger allerede
    /// på kontaktraden; Logg notat/Aktivitet/Mål & behov/Stakeholders/Åpne
    /// lead er samlet i ⋯-menyen.
    private var sekundaerRad: some View {
        HStack(spacing: 8) {
            Button {
                // Ekte turn-by-turn i Kart-motoren (POV/Kjøre, MKDirections,
                // stemme, snap-to-road).
                appState.requestNavigation(
                    lat: meeting.lat, lon: meeting.lon,
                    name: meeting.company, address: meeting.address, start: true)
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "location.north.line.fill")
                        .font(.appScaled(size: 11, weight: .semibold))
                    Text("Naviger")
                        .font(.appScaled(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(MtBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { showMoteBrief = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: "brain.head.profile")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(MtBrand.purpleLight)
                    Text("Møtebrief")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(MtBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10)
                    .stroke(MtBrand.purple.opacity(0.45), lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private var routeCard: some View {
        // Hele mini-kartet er hitmålet (Daniel-feedback 2026-07-01) —
        // «Åpne i kart»-CTA er droppet, kartet er selv hele knappen med
        // subtil pil + tint på hover for å signalisere tapbarhet.
        // Åpner den EKTE Kart-fanen sentrert på møtet (rute-forhåndsvisning,
        // start=false → ikke turn-by-turn) i stedet for mock-`KartTabSheet`.
        Button {
            appState.requestNavigation(
                lat: meeting.lat, lon: meeting.lon,
                name: meeting.company, address: meeting.address, start: false)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Text("Rute til møte")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Spacer()
                    Image(systemName: "arrow.up.right.square.fill")
                        .font(.appScaled(size: 12, weight: .bold))
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
                                        .font(.appScaled(size: 10, weight: .bold))
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
                                .font(.appScaled(size: 8, weight: .bold))
                            Text("Åpne")
                                .font(.appScaled(size: 9, weight: .black))
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
                                .font(.appScaled(size: 18, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                                .monospacedDigit()
                            Text("(\(meeting.driveDistanceKm) km)")
                                .font(.appScaled(size: 11))
                                .foregroundStyle(MtBrand.textSecondary)
                                .monospacedDigit()
                        }
                        if !meeting.trafficStatus.isEmpty {
                            Text(meeting.trafficStatus)
                                .font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(meeting.trafficStatus.lowercased().contains("lett") ? MtBrand.green : (meeting.trafficStatus.lowercased().contains("tett") ? MtBrand.red : MtBrand.orange))
                        }
                        Text(meeting.address)
                            .font(.appScaled(size: 10))
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
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(LinearGradient(
                        colors: [MtBrand.purple, MtBrand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    Image(systemName: "target")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Send oppsummering etter møtet")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Del nøkkelpunkter og avtal neste steg.")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(MtBrand.textSecondary)
                    // «Opprett oppgave»-knapp fjernet 2026-07-17: toasten løy
                    // («Oppgave opprettet i innboks») — ingen oppgave-innboks finnes.
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

// MARK: - Nytt brief-møte (dørsalg, 2026-07-18)

/// Leder oppretter brief: tittel + notat + første tidspunkt + varighet +
/// gjentakelse (engang/daglig/hverdager/ukentlig) + inviterte selgere fra
/// teamet. Selve lagringen eies av MeetingsView via onCreate (demo vs ekte).
private struct NewBriefSheet: View {
    let onCreate: (String, String, Date, Int, String, [String]) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    @State private var title = ""
    @State private var note = ""
    @State private var startAt = Calendar.current.date(
        bySettingHour: 8, minute: 0, second: 0,
        of: Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()) ?? Date()
    @State private var durationMin = 15
    @State private var recurrence = "weekdays"
    @State private var valgte: Set<String> = []
    @State private var team = TeamLiveStore.shared

    private enum NBrand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
        static let textSecondary = Color.white.opacity(0.62)
    }

    /// Demo: samme selger-navn som resten av demo-universet.
    private var medlemmer: [(id: String, navn: String)] {
        if DemoModeManager.isActiveNonisolated {
            return [("demo-espen", "Espen Berg"), ("demo-marit", "Marit Johansen"),
                    ("demo-lars", "Lars Erik Moen"), ("demo-helena", "Helena Dahl")]
        }
        return team.memberDTOs.map { ($0.userId, $0.name) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    felt("Tittel") {
                        TextField("", text: $title,
                                  prompt: Text("F.eks. Morgenbrief før felt")
                                    .foregroundColor(NBrand.textSecondary))
                            .textFieldStyle(.plain).foregroundStyle(.white)
                            .font(.appScaled(size: 13))
                            .padding(11)
                            .background(NBrand.card, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(NBrand.stroke, lineWidth: 1))
                    }
                    felt("Notat (valgfritt)") {
                        TextField("", text: $note,
                                  prompt: Text("Dagens rode, mål, innvendinger…")
                                    .foregroundColor(NBrand.textSecondary))
                            .textFieldStyle(.plain).foregroundStyle(.white)
                            .font(.appScaled(size: 13))
                            .padding(11)
                            .background(NBrand.card, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(NBrand.stroke, lineWidth: 1))
                    }
                    felt("Første gang") {
                        DatePicker("", selection: $startAt,
                                   displayedComponents: [.date, .hourAndMinute])
                            .labelsHidden()
                            .datePickerStyle(.compact)
                            .colorScheme(.dark)
                            .tint(NBrand.purpleLight)
                    }
                    felt("Varighet") {
                        Picker("", selection: $durationMin) {
                            ForEach([10, 15, 20, 30, 45, 60], id: \.self) { m in
                                Text("\(m) min").tag(m)
                            }
                        }
                        .pickerStyle(.segmented).colorScheme(.dark)
                    }
                    felt("Gjentas") {
                        Picker("", selection: $recurrence) {
                            Text("Engang").tag("none")
                            Text("Daglig").tag("daily")
                            Text("Hverdager").tag("weekdays")
                            Text("Ukentlig").tag("weekly")
                        }
                        .pickerStyle(.segmented).colorScheme(.dark)
                    }
                    felt("Inviter selgere") {
                        VStack(spacing: 8) {
                            if medlemmer.isEmpty {
                                Text("Fant ingen teammedlemmer å invitere.")
                                    .font(.appScaled(size: 11)).foregroundStyle(NBrand.textSecondary)
                            } else {
                                HStack {
                                    Button(valgte.count == medlemmer.count ? "Fjern alle" : "Velg alle") {
                                        if valgte.count == medlemmer.count { valgte = [] }
                                        else { valgte = Set(medlemmer.map(\.id)) }
                                    }
                                    .font(.appScaled(size: 11, weight: .bold))
                                    .foregroundStyle(NBrand.purpleLight)
                                    Spacer()
                                    Text("\(valgte.count) valgt")
                                        .font(.appScaled(size: 10)).foregroundStyle(NBrand.textSecondary)
                                }
                                ForEach(medlemmer, id: \.id) { m in
                                    Button {
                                        if valgte.contains(m.id) { valgte.remove(m.id) }
                                        else { valgte.insert(m.id) }
                                    } label: {
                                        HStack(spacing: 9) {
                                            Image(systemName: valgte.contains(m.id)
                                                  ? "checkmark.circle.fill" : "circle")
                                                .font(.appScaled(size: 15))
                                                .foregroundStyle(valgte.contains(m.id)
                                                                 ? NBrand.green : NBrand.textSecondary)
                                            Text(m.navn)
                                                .font(.appScaled(size: 13, weight: .semibold))
                                                .foregroundStyle(.white)
                                            Spacer()
                                        }
                                        .padding(.vertical, 7).padding(.horizontal, 10)
                                        .background(NBrand.card, in: RoundedRectangle(cornerRadius: 9))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    Color.clear.frame(height: 12)
                }
                .padding(18)
            }
            .background(NBrand.bg.ignoresSafeArea())
            .navigationTitle("Nytt brief-møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(NBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Opprett") {
                        onCreate(title.trimmingCharacters(in: .whitespaces), note,
                                 startAt, durationMin, recurrence, Array(valgte))
                        dismiss()
                    }
                    .fontWeight(.bold).foregroundStyle(NBrand.purpleLight)
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .toolbarBackground(NBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.large])
        .task {
            if let api = appState.api, !DemoModeManager.isActiveNonisolated {
                TeamLiveStore.shared.attach(api: api, appState: appState)
            }
        }
    }

    private func felt(_ label: String, @ViewBuilder innhold: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label.uppercased())
                .font(.appScaled(size: 9, weight: .bold))
                .foregroundStyle(NBrand.textSecondary).kerning(0.5)
            innhold()
        }
    }
}
