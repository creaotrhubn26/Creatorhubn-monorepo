// LeadDetailFullSheet.swift
//
// Full-screen modal som åpnes når salgssjefen tapper "Åpne lead" i
// detail-panelet. Viser ALT om en lead: header med status + KPIs,
// pipeline-fremdrift, kontaktliste, deal-info, tidslinje, notater, filer.

import SwiftUI
import MapKit

private enum LdBrand {
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

struct LeadDetailFullSheet: View {
    let lead: MapLeadMock
    @Environment(AppState.self) private var appState
    @State private var showScheduleMeeting = false
    @State private var showAssign = false

    // Ekte kontakt m/ demo-fallback (MapLeadMock.phoneOrDemo/emailOrDemo):
    // ekte modus uten data skjuler handlingen i stedet for å late som.
    private var leadPhone: String? { lead.phoneOrDemo }
    private var leadEmail: String? { lead.emailOrDemo }

    private func call(_ phone: String) {
        let clean = phone.replacingOccurrences(of: " ", with: "")
        if let url = URL(string: "tel://\(clean)") { UIApplication.shared.open(url) }
    }
    private func mail(_ email: String) {
        if let url = URL(string: "mailto:\(email)") { UIApplication.shared.open(url) }
    }
    @Environment(\.dismiss) private var dismiss
    @State private var selectedSection: Section = .overview

    enum Section: String, CaseIterable {
        case overview = "Oversikt"
        case pipeline = "Pipeline"
        case activities = "Aktiviteter"
        case notes = "Notater"
        case files = "Filer"
        case team = "Team"
        var icon: String {
            switch self {
            case .overview:   return "doc.text.fill"
            case .pipeline:   return "chart.line.uptrend.xyaxis"
            case .activities: return "clock.fill"
            case .notes:      return "note.text"
            case .files:      return "folder.fill"
            case .team:       return "person.3.fill"
            }
        }
    }

    private let stages = ["Ny", "Kvalifisert", "Møte", "Tilbud", "Forhandling", "Won"]
    /// Avledet fra lead-status (samme semantikk som `KartPreviewData.adapt`),
    /// slik at pipeline-baren faktisk følger leaden i stedet for å stå fast
    /// på «Tilbud» for alle.
    private var currentStageIndex: Int {
        switch lead.status {
        case .new:      return 0   // Ny
        case .warm:     return 1   // Kvalifisert (interessert)
        case .meeting:  return 2   // Møte booket
        case .hot:      return 3   // Tilbud sendt
        case .followup: return 4   // Forhandling / oppfølging
        case .customer: return 5   // Won
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    heroCard
                    kpiRow
                    sectionPicker
                    contentForSection
                    Spacer(minLength: 16)
                }
                .padding(20)
            }
            .background(LdBrand.bg.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: {
                        ZStack {
                            Circle().fill(LdBrand.cardHi)
                            Circle().stroke(LdBrand.stroke, lineWidth: 1)
                            Image(systemName: "xmark")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                }
                ToolbarItem(placement: .principal) {
                    Text(lead.name)
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        if let phone = leadPhone {
                            Button("Ring", systemImage: "phone") { call(phone) }
                        }
                        if let email = leadEmail {
                            Button("Send e-post", systemImage: "envelope") { mail(email) }
                        }
                        Button("Planlegg møte", systemImage: "calendar") { showScheduleMeeting = true }
                        if ["admin", "salgssjef", "teamleder"].contains(appState.roleInOrg ?? "") {
                            Button("Tilordne selger", systemImage: "person.crop.circle") { showAssign = true }
                        }
                        // «Arkiver» forblir fjernet: arkiverings-API har ingen
                        // app-flate enda (backend har archived_at — egen jobb).
                    } label: {
                        ZStack {
                            Circle().fill(LdBrand.cardHi)
                            Circle().stroke(LdBrand.stroke, lineWidth: 1)
                            Image(systemName: "ellipsis")
                                .font(.appScaled(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 32, height: 32)
                    }
                }
            }
            .toolbarBackground(LdBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .sheet(isPresented: $showScheduleMeeting) {
                ScheduleMeetingSheet(lead: lead)
            }
            .sheet(isPresented: $showAssign) {
                AssignToTeamMemberSheet(
                    leadId: lead.id,
                    leadName: lead.name,
                    leadAddress: lead.address,
                    leadScore: lead.aiScore,
                    leadCoordinate: CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon),
                    members: assignableMembers(),
                    onAssign: { assignment in
                        // Samme API-kall som Oversikts tildelingsflyt.
                        if let api = appState.api {
                            let payload = LeadAssignmentPayload(
                                leadId: assignment.leadId.hasPrefix("lead-") ? nil : assignment.leadId,
                                leadName: assignment.leadName,
                                leadLat: assignment.leadCoordinate.latitude,
                                leadLng: assignment.leadCoordinate.longitude,
                                assigneeUserId: assignment.assigneeUserId,
                                assigneeRole: assignment.assigneeRole.rawValue,
                                priority: assignment.priority.rawValue,
                                message: assignment.message
                            )
                            Task { try? await api.createLeadAssignment(payload) }
                        }
                        showAssign = false
                    },
                    onCancel: { showAssign = false }
                )
            }
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .macCatalystSheetSize(minWidth: 960, minHeight: 760)
    }

    // MARK: Hero-card

    private var heroCard: some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(lead.status.color.opacity(0.20))
                Image(systemName: "building.2.fill")
                    .font(.appScaled(size: 26, weight: .semibold))
                    .foregroundStyle(lead.status.color)
            }
            .frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    Text(lead.name)
                        .font(.appScaled(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                    statusBadge(lead.status)
                    Image(systemName: "star.fill")
                        .font(.appScaled(size: 14))
                        .foregroundStyle(LdBrand.yellow)
                }
                Text(lead.address)
                    .font(.appScaled(size: 13))
                    .foregroundStyle(LdBrand.textSecondary)
                HStack(spacing: 12) {
                    metaPill(icon: "building.columns", label: "Elektro")
                    metaPill(icon: "person.2", label: "25-50 ansatte")
                    metaPill(icon: "norwegiankronesign.circle", label: "10-20 mill.")
                    metaPill(icon: "globe", label: "nordicelektro.no")
                }
            }
            Spacer()

            HStack(spacing: 8) {
                if let phone = leadPhone {
                    heroAction(icon: "phone.fill", label: "Ring", color: LdBrand.green) { call(phone) }
                }
                if let email = leadEmail {
                    heroAction(icon: "envelope.fill", label: "E-post", color: LdBrand.blue) { mail(email) }
                }
                heroAction(icon: "calendar", label: "Møte", color: LdBrand.purple) { showScheduleMeeting = true }
            }
        }
        .padding(18)
        .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(lead.status.color.opacity(0.4), lineWidth: 1.2)
        )
    }

    private func metaPill(icon: String, label: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.appScaled(size: 10))
            Text(label)
                .font(.appScaled(size: 11, weight: .semibold))
        }
        .foregroundStyle(LdBrand.textSecondary)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(LdBrand.cardHi, in: Capsule())
    }

    /// Medlemmer for tildeling — ekte fra TeamLiveStore (samme mapping som
    /// Oversikt). I demo-modus er lista tom her; demo-tildelingsflyten
    /// demonstreres fra Oversikt-fanen.
    private func assignableMembers() -> [AssignableTeamMember] {
        TeamLiveStore.shared.memberDTOs.map { dto in
            let initials = dto.name.split(separator: " ")
                .prefix(2).compactMap { $0.first }.map(String.init).joined()
            return AssignableTeamMember(
                userId: dto.userId,
                name: dto.name,
                email: dto.email,
                title: dto.title,
                role: .seller,
                distanceKm: nil,
                weeklyWon: dto.won,
                isAvailable: nil,
                avatarInitials: initials.isEmpty ? "?" : initials
            )
        }
    }

    private func heroAction(icon: String, label: String, color: Color,
                            action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 40, height: 40)
                Text(label)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(.plain)
    }

    private func statusBadge(_ st: MapLeadMock.PinStatus) -> some View {
        HStack(spacing: 4) {
            Image(systemName: st.icon)
                .font(.appScaled(size: 9, weight: .bold))
            Text(st.label)
                .font(.appScaled(size: 10, weight: .bold))
        }
        .foregroundStyle(st.color)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(st.color.opacity(0.18), in: Capsule())
        .overlay(Capsule().stroke(st.color.opacity(0.45), lineWidth: 1))
    }

    // MARK: KPI-rad

    @ViewBuilder
    private var kpiRow: some View {
        if DemoModeManager.isActiveNonisolated {
            HStack(spacing: 10) {
                kpiCard(title: "Estimert verdi", value: "420K", subtitle: "NOK",
                        icon: "chart.line.uptrend.xyaxis", color: LdBrand.green)
                kpiCard(title: "Sannsynlighet", value: "65 %", subtitle: "vekt. forecast",
                        icon: "percent", color: LdBrand.purpleLight)
                kpiCard(title: "Forventet close", value: "12. juni", subtitle: "om 14 dager",
                        icon: "calendar.badge.clock", color: LdBrand.yellow)
                kpiCard(title: "Lead-score", value: "82", subtitle: "/ 100",
                        icon: "flame.fill", color: LdBrand.red)
            }
        } else {
            // Ekte modus: kun felter som faktisk finnes på leaden.
            HStack(spacing: 10) {
                kpiCard(title: "Estimert verdi",
                        value: lead.estimatedValue.map { "\(Int($0 / 1_000))K" } ?? "—",
                        subtitle: "NOK", icon: "chart.line.uptrend.xyaxis", color: LdBrand.green)
                kpiCard(title: "Lead-score",
                        value: lead.aiScore.map { "\($0)" } ?? "—",
                        subtitle: "/ 100", icon: "flame.fill", color: LdBrand.red)
                kpiCard(title: "Avstand",
                        value: String(format: "%.1f km", lead.kmAway),
                        subtitle: "fra deg", icon: "location.fill", color: LdBrand.purpleLight)
                kpiCard(title: "Status", value: lead.status.label, subtitle: "pipeline",
                        icon: "chart.bar.fill", color: LdBrand.yellow)
            }
        }
    }

    private func kpiCard(title: String, value: String, subtitle: String,
                         icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(color)
                Spacer()
            }
            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text(value)
                    .font(.appScaled(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text(subtitle)
                    .font(.appScaled(size: 10))
                    .foregroundStyle(LdBrand.textTertiary)
            }
            Text(title)
                .font(.appScaled(size: 11))
                .foregroundStyle(LdBrand.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LdBrand.stroke, lineWidth: 1))
    }

    // MARK: Section-velger

    private var sectionPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Section.allCases, id: \.self) { s in
                    Button { selectedSection = s } label: {
                        HStack(spacing: 5) {
                            Image(systemName: s.icon)
                                .font(.appScaled(size: 11, weight: .semibold))
                            Text(s.rawValue)
                                .font(.appScaled(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(selectedSection == s ? .white : LdBrand.textSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(
                            selectedSection == s ? AnyShapeStyle(LinearGradient(
                                colors: [LdBrand.purple, LdBrand.purpleLight],
                                startPoint: .leading, endPoint: .trailing
                            )) : AnyShapeStyle(LdBrand.card),
                            in: Capsule()
                        )
                        .overlay(Capsule().stroke(LdBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var contentForSection: some View {
        switch selectedSection {
        case .overview:   overviewBlocks
        case .pipeline:   pipelineSection
        case .activities: activitiesSection
        case .notes:      notesSection
        case .files:      filesSection
        case .team:       teamSection
        }
    }

    // MARK: Oversikt-blokker

    private var overviewBlocks: some View {
        VStack(spacing: 14) {
            // Pipeline-stage (alltid synlig på oversikt)
            sectionCard(title: "Pipeline-fremdrift", icon: "chart.line.uptrend.xyaxis") {
                pipelineBar
            }

            sectionCard(title: "Kontakter", icon: "person.2.fill") {
                VStack(spacing: 8) {
                    if DemoModeManager.isActiveNonisolated {
                        contactRow(name: "Anders Johansen", role: "Daglig leder",
                                   phone: "+47 911 22 333", email: "anders@nordicelektro.no",
                                   primary: true, initials: "AJ", color: LdBrand.purpleLight)
                        contactRow(name: "Kari Olsen", role: "Innkjøpssjef",
                                   phone: "+47 922 33 444", email: "kari@nordicelektro.no",
                                   primary: false, initials: "KO", color: LdBrand.green)
                    } else if lead.phone != nil || lead.email != nil {
                        contactRow(name: lead.name, role: "Registrert kontakt",
                                   phone: lead.phone ?? "", email: lead.email ?? "",
                                   primary: true,
                                   initials: String(lead.name.prefix(2)).uppercased(),
                                   color: LdBrand.purpleLight)
                    } else {
                        Text("Ingen kontaktinfo registrert på leaden.")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(LdBrand.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }

            sectionCard(title: "Adresse + kart", icon: "mappin.and.ellipse") {
                Map(position: .constant(.region(MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon),
                    span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.012)
                ))), interactionModes: []) {
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon)) {
                        ZStack {
                            Circle().fill(lead.status.color)
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                                .frame(width: 30, height: 30)
                            Image(systemName: "building.2.fill")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                }
                .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
                .mapControls { }
                .environment(\.colorScheme, .dark)
                .frame(height: 160)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LdBrand.stroke, lineWidth: 1))

                Text(lead.address)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(.white)
            }

            sectionCard(title: "Beskrivelse + notat", icon: "doc.text") {
                Text("Interessert i nytt el-anlegg til kontorbygg på Storgata. Følge opp prisforslag og referanseprosjekter fra finansbygg.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func contactRow(name: String, role: String, phone: String, email: String,
                             primary: Bool, initials: String, color: Color) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(color.opacity(0.25))
                Text(initials)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(name)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    if primary {
                        Text("Primær")
                            .font(.appScaled(size: 8, weight: .bold))
                            .foregroundStyle(LdBrand.purpleLight)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(LdBrand.purple.opacity(0.20), in: Capsule())
                    }
                }
                HStack(spacing: 6) {
                    Text(role)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(LdBrand.textSecondary)
                    Text("·").foregroundStyle(LdBrand.textTertiary)
                    Text(phone)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(LdBrand.textTertiary)
                }
            }
            Spacer()
            HStack(spacing: 6) {
                if !phone.isEmpty { actionMini("phone", color: LdBrand.green) { call(phone) } }
                if !email.isEmpty { actionMini("envelope", color: LdBrand.blue) { mail(email) } }
            }
        }
        .padding(10)
        .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    private func actionMini(_ icon: String, color: Color,
                            action: @escaping () -> Void) -> some View {
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

    // MARK: Pipeline

    private var pipelineSection: some View {
        VStack(spacing: 14) {
            sectionCard(title: "Pipeline-fremdrift", icon: "chart.line.uptrend.xyaxis") {
                pipelineBar
            }
            sectionCard(title: "Deal-historikk", icon: "clock.arrow.circlepath") {
                VStack(alignment: .leading, spacing: 8) {
                    pipelineEvent(stage: "Tilbud sendt",        date: "20. mai 09:15", value: "420 000 kr", current: true)
                    pipelineEvent(stage: "Møte gjennomført",    date: "15. mai 14:00", value: nil)
                    pipelineEvent(stage: "Kvalifisert",         date: "10. mai 11:30", value: nil)
                    pipelineEvent(stage: "Lead opprettet",      date: "18. apr.",       value: nil)
                }
            }
        }
    }

    private var pipelineBar: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 0) {
                ForEach(0..<stages.count, id: \.self) { i in
                    VStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(i <= currentStageIndex ? LdBrand.purple : LdBrand.cardHi)
                            Circle()
                                .stroke(i <= currentStageIndex ? LdBrand.purpleLight : LdBrand.stroke, lineWidth: 2)
                            if i < currentStageIndex {
                                Image(systemName: "checkmark")
                                    .font(.appScaled(size: 11, weight: .bold))
                                    .foregroundStyle(.white)
                            } else if i == currentStageIndex {
                                Circle().fill(Color.white).frame(width: 8, height: 8)
                            }
                        }
                        .frame(width: 26, height: 26)
                        Text(stages[i])
                            .font(.appScaled(size: 10, weight: i == currentStageIndex ? .bold : .semibold))
                            .foregroundStyle(i <= currentStageIndex ? .white : LdBrand.textTertiary)
                    }
                    .frame(maxWidth: .infinity)
                    if i < stages.count - 1 {
                        Rectangle()
                            .fill(i < currentStageIndex ? LdBrand.purple : LdBrand.stroke)
                            .frame(height: 2)
                            .frame(maxWidth: .infinity)
                            .offset(y: -12)
                    }
                }
            }
        }
    }

    private func pipelineEvent(stage: String, date: String, value: String?, current: Bool = false) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(current ? LdBrand.purple.opacity(0.30) : LdBrand.cardHi)
                Circle().stroke(current ? LdBrand.purpleLight : LdBrand.stroke, lineWidth: 1.5)
                if current {
                    Image(systemName: "arrow.right")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(LdBrand.purpleLight)
                } else {
                    Image(systemName: "checkmark")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(LdBrand.green)
                }
            }
            .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(stage)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    if current {
                        Text("AKTIVT")
                            .font(.appScaled(size: 8, weight: .bold))
                            .foregroundStyle(LdBrand.purpleLight)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(LdBrand.purple.opacity(0.20), in: Capsule())
                    }
                }
                Text(date)
                    .font(.appScaled(size: 10))
                    .foregroundStyle(LdBrand.textTertiary)
            }
            Spacer()
            if let v = value {
                Text(v)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(LdBrand.green)
                    .monospacedDigit()
            }
        }
        .padding(10)
        .background(LdBrand.cardHi.opacity(current ? 1 : 0.5), in: RoundedRectangle(cornerRadius: 9))
    }

    // MARK: Aktiviteter

    /// Ærlig tom-tilstand (ikke-demo uten ekte data) — mock vises KUN i demo-modus.
    private func sectionEmptyState(_ text: String) -> some View {
        Text(text)
            .font(.appScaled(size: 12, weight: .semibold))
            .foregroundStyle(LdBrand.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    private var activitiesSection: some View {
        sectionCard(title: "Komplett aktivitetshistorikk", icon: "clock.fill") {
            VStack(spacing: 8) {
                if KartPreviewData.activities.isEmpty {
                    sectionEmptyState("Ingen aktiviteter registrert enda")
                }
                ForEach(KartPreviewData.activities) { a in
                    HStack(spacing: 10) {
                        ZStack {
                            Circle().fill(LdBrand.purple.opacity(0.18))
                            Image(systemName: a.icon)
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(LdBrand.purpleLight)
                        }
                        .frame(width: 32, height: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(a.label)
                                .font(.appScaled(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("Anders Johansen · Nordic Elektro")
                                .font(.appScaled(size: 10))
                                .foregroundStyle(LdBrand.textTertiary)
                        }
                        Spacer()
                        Text(a.timestamp)
                            .font(.appScaled(size: 11))
                            .foregroundStyle(LdBrand.textSecondary)
                    }
                    .padding(10)
                    .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                }
            }
        }
    }

    // MARK: Notater

    private var notesSection: some View {
        sectionCard(title: "Notater (\(KartPreviewData.notes.count))", icon: "note.text") {
            VStack(spacing: 8) {
                if KartPreviewData.notes.isEmpty {
                    sectionEmptyState("Ingen notater enda")
                }
                ForEach(KartPreviewData.notes) { n in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            ZStack {
                                Circle().fill(n.authorColor.opacity(0.25))
                                Text(n.authorInitials)
                                    .font(.appScaled(size: 11, weight: .bold))
                                    .foregroundStyle(n.authorColor)
                            }
                            .frame(width: 28, height: 28)
                            Text(n.author)
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            if n.pinned {
                                Image(systemName: "pin.fill")
                                    .font(.appScaled(size: 9))
                                    .foregroundStyle(LdBrand.yellow)
                            }
                            Spacer()
                            Text(n.timestamp)
                                .font(.appScaled(size: 10))
                                .foregroundStyle(LdBrand.textTertiary)
                        }
                        Text(n.body)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(11)
                    .background(
                        n.pinned ? LdBrand.yellow.opacity(0.08) : LdBrand.cardHi,
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(n.pinned ? LdBrand.yellow.opacity(0.4) : LdBrand.stroke, lineWidth: 1)
                    )
                }
            }
        }
    }

    // MARK: Filer

    private var filesSection: some View {
        sectionCard(title: "Vedlegg (\(KartPreviewData.files.count))", icon: "folder.fill") {
            let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
            if KartPreviewData.files.isEmpty {
                sectionEmptyState("Ingen filer lastet opp enda")
            }
            LazyVGrid(columns: cols, spacing: 10) {
                ForEach(KartPreviewData.files) { f in
                    VStack(alignment: .leading, spacing: 8) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(f.kind.color.opacity(0.18))
                            Image(systemName: f.kind.icon)
                                .font(.appScaled(size: 28, weight: .semibold))
                                .foregroundStyle(f.kind.color)
                        }
                        .frame(height: 80)
                        Text(f.name)
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        HStack {
                            Text(f.size)
                                .font(.appScaled(size: 9))
                                .foregroundStyle(LdBrand.textSecondary)
                            Spacer()
                            Text(f.uploadedAt)
                                .font(.appScaled(size: 9))
                                .foregroundStyle(LdBrand.textTertiary)
                        }
                    }
                    .padding(10)
                    .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(LdBrand.stroke, lineWidth: 1))
                }
            }
        }
    }

    // MARK: Team

    private var teamSection: some View {
        sectionCard(title: "Tildelte teammedlemmer", icon: "person.3.fill") {
            VStack(spacing: 8) {
                // Mock-team KUN i demo-modus — ellers ærlig tom-tilstand.
                if !DemoModeManager.isActiveNonisolated {
                    sectionEmptyState("Ingen teammedlemmer tildelt enda")
                } else {
                teamRow(name: "Lars Kristensen",  role: "Account Owner",   initials: "LK", color: LdBrand.purpleLight, primary: true)
                teamRow(name: "Mikkel Berg",       role: "Senior selger",   initials: "MB", color: LdBrand.green, primary: false)
                teamRow(name: "Anniken Sørli",     role: "Salgsdirektør",   initials: "AS", color: LdBrand.purple, primary: false)
                }
            }
        }
    }

    private func teamRow(name: String, role: String, initials: String, color: Color, primary: Bool) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(color.opacity(0.25))
                Text(initials)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(name)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    if primary {
                        Text("OWNER")
                            .font(.appScaled(size: 8, weight: .bold))
                            .foregroundStyle(LdBrand.yellow)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(LdBrand.yellow.opacity(0.18), in: Capsule())
                    }
                }
                Text(role)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LdBrand.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(LdBrand.textTertiary)
        }
        .padding(10)
        .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: Helper-section-card

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, icon: String,
                                              @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(LdBrand.purpleLight)
                Text(title)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            content()
        }
        .padding(16)
        .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LdBrand.stroke, lineWidth: 1))
    }
}
