// BookMeetingSheet.swift
//
// Komplett møte-booking m/ lead-søk:
//   - Lead-picker øverst: søkbart liste over alle leads + "Ny lead"-fallback
//   - Dato (forhåndsutfylt fra Måned-modus)
//   - Tid + varighet
//   - Møte-type: FaceTime / Google Meet / Telefon / Fysisk
//   - Agenda-felt
//   - Varsle-toggle

import SwiftUI

private enum BBrand {
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
    static let pink = Color(red: 0.98, green: 0.35, blue: 0.65)
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.45)
}

// MARK: - LeadCandidate (lett-vekt lead-rep)

struct LeadCandidate: Identifiable, Hashable {
    let id = UUID()
    let company: String
    let contactName: String
    let contactRole: String
    let location: String
    let icon: String
    let iconColor: Color
    let leadScore: Int
    let leadType: String          // "Hot" / "Warm" / "Cold"
    let valueNok: Int
    let pipelineStage: String     // "Discovery" / "Demo" / "Forhandling" / "Lukket"
    let lastContactDays: Int?     // nil = aldri
    let hasOpenMeeting: Bool

    var initials: String {
        // Ekte leads kan mangle kontaktperson — fall tilbake til firmanavn.
        let source = contactName.isEmpty ? company : contactName
        let parts = source.split(separator: " ")
        return parts.prefix(2).compactMap { $0.first }.map { String($0) }.joined()
    }

    var leadTypeColor: Color {
        switch leadType.lowercased() {
        case "hot", "høyt": return BBrand.red
        case "warm", "varmt": return BBrand.orange
        case "cold", "kaldt": return BBrand.blue
        default: return BBrand.purpleLight
        }
    }
}

enum LeadCatalog {
    /// Mock-kandidater — KUN i demo-modus. Ellers bygger BookMeetingSheet
    /// listen fra ekte `appState.leads` (se `candidates`-computed der).
    static var all: [LeadCandidate] {
        DemoModeManager.isActiveNonisolated ? _all : []
    }

    /// LeadModel → LeadCandidate-adapter for ekte leads (ikke-demo).
    static func candidate(from lm: LeadModel) -> LeadCandidate {
        let score = lm.leadScore ?? lm.aiOpportunityScore ?? 0
        let type: String = {
            switch (lm.leadTemperature ?? "").lowercased() {
            case "hot":  return "Hot"
            case "warm": return "Warm"
            case "cold": return "Cold"
            default:
                switch score {
                case 80...:   return "Hot"
                case 55..<80: return "Warm"
                default:      return "Cold"
                }
            }
        }()
        let days: Int? = lm.lastVisitAt.map {
            max(0, Int(Date().timeIntervalSince($0) / 86_400))
        }
        return LeadCandidate(
            company: lm.name,
            contactName: lm.assignedUserName ?? "",
            contactRole: lm.category ?? "",
            location: lm.city ?? lm.address ?? "",
            icon: "building.2.fill",
            iconColor: BBrand.purpleLight,
            leadScore: score,
            leadType: type,
            valueNok: Int(lm.estimatedValue ?? 0),
            pipelineStage: lm.pipelineStage ?? lm.status.label,
            lastContactDays: days,
            hasOpenMeeting: lm.status == .meetingBooked
        )
    }

    private static let _all: [LeadCandidate] = [
        // Hot
        LeadCandidate(company: "Romerike Elektro AS",    contactName: "Tom Wiig",        contactRole: "Daglig leder",      location: "Lørenskog",     icon: "building.2.fill",            iconColor: BBrand.green,       leadScore: 92, leadType: "Hot",   valueNok: 650_000, pipelineStage: "Demo",        lastContactDays: 1, hasOpenMeeting: true),
        LeadCandidate(company: "Scan Safe AS",            contactName: "Henrik Vold",     contactRole: "Sikkerhetssjef",    location: "Drammen",       icon: "shield.fill",                iconColor: BBrand.orange,      leadScore: 91, leadType: "Hot",   valueNok: 950_000, pipelineStage: "Forhandling", lastContactDays: 2, hasOpenMeeting: true),
        LeadCandidate(company: "Vest VVS AS",             contactName: "Lars Eikeland",   contactRole: "Eier",              location: "Bergen",        icon: "drop.fill",                  iconColor: BBrand.blue,        leadScore: 88, leadType: "Hot",   valueNok: 480_000, pipelineStage: "Demo",        lastContactDays: 4, hasOpenMeeting: false),
        // Warm
        LeadCandidate(company: "BoligPartner AS",         contactName: "Astrid Holm",     contactRole: "Innkjøpssjef",      location: "Jessheim",      icon: "house.fill",                 iconColor: BBrand.blue,        leadScore: 82, leadType: "Warm",  valueNok: 480_000, pipelineStage: "Discovery",   lastContactDays: 3, hasOpenMeeting: true),
        LeadCandidate(company: "Nordic Service Group",    contactName: "Maria Strand",    contactRole: "CTO",               location: "Oslo",          icon: "wrench.and.screwdriver.fill", iconColor: BBrand.purple,     leadScore: 78, leadType: "Warm",  valueNok: 215_000, pipelineStage: "Discovery",   lastContactDays: 5, hasOpenMeeting: true),
        LeadCandidate(company: "Hansen Bygg AS",          contactName: "Per Hansen",      contactRole: "Prosjektleder",     location: "Trondheim",     icon: "hammer.fill",                iconColor: BBrand.orange,      leadScore: 76, leadType: "Warm",  valueNok: 320_000, pipelineStage: "Discovery",   lastContactDays: 7, hasOpenMeeting: false),
        LeadCandidate(company: "Tromsø Energi",           contactName: "Ingrid Larsen",   contactRole: "Drifts-sjef",       location: "Tromsø",        icon: "bolt.fill",                  iconColor: BBrand.yellow,      leadScore: 74, leadType: "Warm",  valueNok: 295_000, pipelineStage: "Demo",        lastContactDays: 9, hasOpenMeeting: false),
        // Cold
        LeadCandidate(company: "Stavanger Marine AS",     contactName: "Kjell Olsen",     contactRole: "Daglig leder",      location: "Stavanger",     icon: "ferry.fill",                 iconColor: BBrand.blue,        leadScore: 58, leadType: "Cold",  valueNok: 180_000, pipelineStage: "Discovery",   lastContactDays: 22, hasOpenMeeting: false),
        LeadCandidate(company: "Kristiansand Logistikk", contactName: "Sara Berg",       contactRole: "Innkjøpssjef",      location: "Kristiansand",  icon: "shippingbox.fill",           iconColor: BBrand.orange,      leadScore: 52, leadType: "Cold",  valueNok: 140_000, pipelineStage: "Discovery",   lastContactDays: 35, hasOpenMeeting: false),
        LeadCandidate(company: "Bodø IT Tjenester",       contactName: "Morten Pedersen", contactRole: "Driftsleder",       location: "Bodø",          icon: "desktopcomputer",            iconColor: BBrand.purpleLight, leadScore: 48, leadType: "Cold",  valueNok: 95_000,  pipelineStage: "Discovery",   lastContactDays: 41, hasOpenMeeting: false),
        // Inactive / arkivert kandidat
        LeadCandidate(company: "Ålesund Maritime",        contactName: "Lise Berg",       contactRole: "Innkjøp",           location: "Ålesund",       icon: "sailboat.fill",              iconColor: BBrand.blue,        leadScore: 32, leadType: "Cold",  valueNok: 60_000,  pipelineStage: "Discovery",   lastContactDays: 78, hasOpenMeeting: false),
    ]
}

// MARK: - BookMeetingSheet

struct BookMeetingSheet: View {
    let dayOfMonth: Int           // 1-31
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    @State private var selectedLead: LeadCandidate?
    @State private var search: String = ""
    @State private var filter: LeadFilter = .all
    @State private var meetingDate = Date()
    @State private var startHour = 10
    @State private var startMinute = 0
    @State private var duration = 60
    @State private var meetingType: MeetingType = .facetime
    @State private var agenda: String = ""
    @State private var notify: Bool = true

    enum LeadFilter: String, CaseIterable, Hashable {
        case all = "Alle"
        case hot = "Hot"
        case warm = "Warm"
        case cold = "Cold"
        case openMeeting = "Allerede booket"
        var color: Color {
            switch self {
            case .all:         return BBrand.purpleLight
            case .hot:         return BBrand.red
            case .warm:        return BBrand.orange
            case .cold:        return BBrand.blue
            case .openMeeting: return BBrand.yellow
            }
        }
    }

    enum MeetingType: String, CaseIterable, Hashable {
        case facetime = "FaceTime"
        case meet     = "Google Meet"
        case phone    = "Telefon"
        case physical = "Fysisk"
        var icon: String {
            switch self {
            case .facetime: return "video.circle.fill"
            case .meet:     return "video.fill"
            case .phone:    return "phone.fill"
            case .physical: return "mappin.and.ellipse"
            }
        }
        var color: Color {
            switch self {
            case .facetime: return BBrand.green
            case .meet:     return BBrand.blue
            case .phone:    return BBrand.yellow
            case .physical: return BBrand.purple
            }
        }
    }

    private let hours = Array(7...19)
    private let minutes = [0, 15, 30, 45]
    private let durations = [30, 45, 60, 90]

    /// Demo → mock-katalog; ellers ekte leads fra appState (tom liste gir
    /// eksisterende `emptyState` i lead-pickeren).
    private var candidates: [LeadCandidate] {
        if DemoModeManager.isActiveNonisolated { return LeadCatalog.all }
        return appState.leads.map(LeadCatalog.candidate(from:))
    }

    private var filteredLeads: [LeadCandidate] {
        var items = candidates
        if !search.isEmpty {
            let q = search.lowercased()
            items = items.filter {
                $0.company.lowercased().contains(q) ||
                $0.contactName.lowercased().contains(q) ||
                $0.location.lowercased().contains(q)
            }
        }
        switch filter {
        case .all:         break
        case .hot:         items = items.filter { $0.leadType == "Hot" }
        case .warm:        items = items.filter { $0.leadType == "Warm" }
        case .cold:        items = items.filter { $0.leadType == "Cold" }
        case .openMeeting: items = items.filter { $0.hasOpenMeeting }
        }
        return items
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    dateBanner
                    leadPicker
                    if selectedLead != nil {
                        timeCard
                        meetingTypeCard
                        agendaCard
                        notifyCard
                    }
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(BBrand.bg.ignoresSafeArea())
            .navigationTitle("Bok møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(BBrand.purpleLight)
                }
            }
            .toolbarBackground(BBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { saveBar }
        }
    }

    // MARK: dateBanner

    private var dateBanner: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(BBrand.purple.opacity(0.22))
                Text("\(dayOfMonth)")
                    .font(.system(size: 14, weight: .black, design: .rounded))
                    .foregroundStyle(BBrand.purpleLight)
                    .monospacedDigit()
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(dayOfMonth). mai 2026")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Booker møte for denne dagen")
                    .font(.system(size: 11))
                    .foregroundStyle(BBrand.textSecondary)
            }
            Spacer()
            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(BBrand.purpleLight)
        }
        .padding(12)
        .background(BBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(BBrand.purple.opacity(0.30), lineWidth: 1))
    }

    // MARK: leadPicker

    private var leadPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let lead = selectedLead {
                selectedLeadCard(lead)
            } else {
                HStack {
                    Text("Velg lead")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text("\(filteredLeads.count) av \(candidates.count)")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(BBrand.textSecondary)
                        .monospacedDigit()
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(BBrand.cardHi, in: Capsule())
                    Spacer()
                    Button {} label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 11, weight: .bold))
                            Text("Ny lead")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(BBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
                searchBar
                filterRow
                VStack(spacing: 6) {
                    ForEach(filteredLeads) { lead in
                        leadRow(lead)
                    }
                    if filteredLeads.isEmpty { emptyState }
                }
            }
        }
        .padding(14)
        .background(BBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(BBrand.stroke, lineWidth: 1))
    }

    private func selectedLeadCard(_ lead: LeadCandidate) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(lead.iconColor.opacity(0.28))
                Image(systemName: lead.icon)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(lead.iconColor)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 3) {
                Text(lead.company)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                HStack(spacing: 4) {
                    Image(systemName: "person.fill")
                        .font(.system(size: 9))
                    Text("\(lead.contactName) · \(lead.contactRole)")
                        .font(.system(size: 11))
                }
                .foregroundStyle(BBrand.textSecondary)
                HStack(spacing: 5) {
                    leadTypeBadge(lead.leadType, color: lead.leadTypeColor)
                    Text("Score \(lead.leadScore)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(BBrand.purpleLight)
                    Text("·").foregroundStyle(BBrand.textTertiary)
                    Text("NOK \(lead.valueNok/1000)k")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(BBrand.green)
                        .monospacedDigit()
                }
            }
            Spacer()
            Button {
                withAnimation { selectedLead = nil }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.left.arrow.right")
                        .font(.system(size: 10, weight: .bold))
                    Text("Bytt")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(BBrand.purpleLight)
                .padding(.horizontal, 9).padding(.vertical, 6)
                .background(BBrand.cardHi, in: Capsule())
                .overlay(Capsule().stroke(BBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(11)
        .background(BBrand.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(BBrand.purple.opacity(0.40), lineWidth: 1))
    }

    private func leadTypeBadge(_ text: String, color: Color) -> some View {
        HStack(spacing: 2) {
            Image(systemName: "flame.fill")
                .font(.system(size: 8, weight: .bold))
            Text(text.uppercased())
                .font(.system(size: 8, weight: .black))
                .tracking(0.5)
        }
        .foregroundStyle(color)
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(color.opacity(0.18), in: Capsule())
        .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(BBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $search)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                if search.isEmpty {
                    Text("Søk bedrift, kontakt eller sted…")
                        .font(.system(size: 13))
                        .foregroundStyle(BBrand.textTertiary)
                        .allowsHitTesting(false)
                }
            }
            if !search.isEmpty {
                Button { search = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(BBrand.textTertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 11).padding(.vertical, 10)
        .background(BBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(BBrand.stroke, lineWidth: 1))
    }

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(LeadFilter.allCases, id: \.self) { f in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { filter = f }
                    } label: {
                        Text(f.rawValue)
                            .font(.system(size: 11, weight: .bold))
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

    private func leadRow(_ lead: LeadCandidate) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) {
                selectedLead = lead
                agenda = "Discovery + behovs-avklaring m/ \(lead.contactName)"
            }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(lead.iconColor.opacity(0.22))
                    Image(systemName: lead.icon)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(lead.iconColor)
                    if lead.hasOpenMeeting {
                        Circle()
                            .fill(BBrand.yellow)
                            .overlay(Circle().stroke(BBrand.card, lineWidth: 1.5))
                            .frame(width: 10, height: 10)
                            .offset(x: 14, y: -14)
                    }
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(lead.company)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        leadTypeBadge(lead.leadType, color: lead.leadTypeColor)
                    }
                    HStack(spacing: 5) {
                        Text(lead.contactName)
                            .font(.system(size: 10))
                            .foregroundStyle(BBrand.textSecondary)
                            .lineLimit(1)
                        Text("·").foregroundStyle(BBrand.textTertiary)
                        Text(lead.location)
                            .font(.system(size: 10))
                            .foregroundStyle(BBrand.textSecondary)
                            .lineLimit(1)
                        Text("·").foregroundStyle(BBrand.textTertiary)
                        if let d = lead.lastContactDays {
                            Text("\(d) dag\(d == 1 ? "" : "er") siden")
                                .font(.system(size: 10))
                                .foregroundStyle(BBrand.textTertiary)
                                .monospacedDigit()
                        } else {
                            Text("Ingen kontakt")
                                .font(.system(size: 10))
                                .foregroundStyle(BBrand.red)
                        }
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("NOK \(lead.valueNok/1000)k")
                        .font(.system(size: 11, weight: .black, design: .rounded))
                        .foregroundStyle(BBrand.green)
                        .monospacedDigit()
                    Text(lead.pipelineStage)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(BBrand.purpleLight)
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(BBrand.purple.opacity(0.18), in: Capsule())
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(BBrand.textTertiary)
            }
            .padding(9)
            .background(BBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(BBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 7) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(BBrand.textTertiary)
            Text("Ingen leads matcher")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
            Text("Prøv annet søk — eller lag ny lead")
                .font(.system(size: 10))
                .foregroundStyle(BBrand.textSecondary)
            Button {} label: {
                Text("+ Lag ny lead")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(BBrand.purpleLight)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(BBrand.purple.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(BBrand.purple.opacity(0.4), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    // MARK: timeCard

    private var timeCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 7) {
                Image(systemName: "clock.fill")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(BBrand.purpleLight)
                Text("Tid og varighet")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            HStack(spacing: 0) {
                Picker("", selection: $startHour) {
                    ForEach(hours, id: \.self) { Text(String(format: "%02d", $0)).foregroundStyle(.white).tag($0) }
                }
                .pickerStyle(.wheel)
                .frame(maxHeight: 90)
                Text(":")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                Picker("", selection: $startMinute) {
                    ForEach(minutes, id: \.self) { Text(String(format: "%02d", $0)).foregroundStyle(.white).tag($0) }
                }
                .pickerStyle(.wheel)
                .frame(maxHeight: 90)
            }
            .background(BBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(BBrand.stroke, lineWidth: 1))
            // Varighet-chips
            HStack(spacing: 6) {
                ForEach(durations, id: \.self) { d in
                    Button {
                        withAnimation { duration = d }
                    } label: {
                        Text(d >= 60 ? "\(d/60) t\(d%60 > 0 ? " \(d%60) m" : "")" : "\(d) min")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(duration == d ? .white : BBrand.purpleLight)
                            .padding(.horizontal, 11).padding(.vertical, 7)
                            .background(
                                duration == d ? AnyShapeStyle(BBrand.purple) : AnyShapeStyle(BBrand.purple.opacity(0.15)),
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(BBrand.purple.opacity(duration == d ? 0 : 0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
        }
        .padding(14)
        .background(BBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(BBrand.stroke, lineWidth: 1))
    }

    // MARK: meetingTypeCard

    private var meetingTypeCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 7) {
                Image(systemName: meetingType.icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(meetingType.color)
                Text("Type møte")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(MeetingType.allCases, id: \.self) { t in
                    typeButton(t)
                }
            }
        }
        .padding(14)
        .background(BBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(BBrand.stroke, lineWidth: 1))
    }

    private func typeButton(_ t: MeetingType) -> some View {
        let isSelected = meetingType == t
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { meetingType = t }
        } label: {
            HStack(spacing: 8) {
                ZStack {
                    Circle().fill(t.color.opacity(isSelected ? 0.35 : 0.18))
                    Image(systemName: t.icon)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(t.color)
                }
                .frame(width: 30, height: 30)
                Text(t.rawValue)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 14))
                    .foregroundStyle(isSelected ? t.color : BBrand.stroke)
            }
            .padding(9)
            .background(
                isSelected ? t.color.opacity(0.10) : BBrand.cardHi,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(RoundedRectangle(cornerRadius: 10)
                .stroke(isSelected ? t.color.opacity(0.5) : BBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: agendaCard

    private var agendaCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 7) {
                Image(systemName: "text.bubble.fill")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(BBrand.purpleLight)
                Text("Agenda")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button {} label: {
                    HStack(spacing: 3) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 9, weight: .bold))
                        Text("AI-forslag")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(BBrand.purpleLight)
                    .padding(.horizontal, 7).padding(.vertical, 4)
                    .background(BBrand.purple.opacity(0.18), in: Capsule())
                }
                .buttonStyle(.plain)
            }
            ZStack(alignment: .topLeading) {
                TextEditor(text: $agenda)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .frame(minHeight: 60)
                    .padding(8)
                    .background(BBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(BBrand.stroke, lineWidth: 1))
                if agenda.isEmpty {
                    Text("Hva skal dere snakke om?")
                        .font(.system(size: 12))
                        .foregroundStyle(BBrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
        .padding(14)
        .background(BBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(BBrand.stroke, lineWidth: 1))
    }

    // MARK: notifyCard

    private var notifyCard: some View {
        Toggle(isOn: $notify) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(BBrand.green.opacity(0.22))
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(BBrand.green)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Send invitt + bekreftelse")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    if let lead = selectedLead {
                        Text("Til \(lead.contactName)")
                            .font(.system(size: 10))
                            .foregroundStyle(BBrand.textSecondary)
                    }
                }
            }
        }
        .tint(BBrand.purple)
        .padding(11)
        .background(BBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(BBrand.stroke, lineWidth: 1))
    }

    // MARK: saveBar

    private var saveBar: some View {
        let canSave = selectedLead != nil
        return Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "calendar.badge.checkmark")
                    .font(.system(size: 14, weight: .bold))
                Text(canSave
                     ? "Bok møte \(String(format: "%02d:%02d", startHour, startMinute))"
                     : "Velg lead først")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: canSave
                                ? [BBrand.purple, BBrand.purpleLight]
                                : [BBrand.cardHi, BBrand.cardHi],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(canSave ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!canSave)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(BBrand.bg.opacity(0.95).overlay(Rectangle().fill(BBrand.stroke).frame(height: 1), alignment: .top))
    }
}
