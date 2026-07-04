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
    static let textSecondary = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.35)
}

struct LeadDetailFullSheet: View {
    let lead: MapLeadMock
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
    private let currentStageIndex = 3  // Tilbud

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
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                }
                ToolbarItem(placement: .principal) {
                    Text(lead.name)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("Send e-post",       systemImage: "envelope") {}
                        Button("Ring",               systemImage: "phone") {}
                        Button("Planlegg møte",      systemImage: "calendar") {}
                        Button("Tilordne selger",    systemImage: "person.crop.circle") {}
                        Divider()
                        Button("Arkiver",            systemImage: "archivebox", role: .destructive) {}
                    } label: {
                        ZStack {
                            Circle().fill(LdBrand.cardHi)
                            Circle().stroke(LdBrand.stroke, lineWidth: 1)
                            Image(systemName: "ellipsis")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 32, height: 32)
                    }
                }
            }
            .toolbarBackground(LdBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
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
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(lead.status.color)
            }
            .frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    Text(lead.name)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                    statusBadge(lead.status)
                    Image(systemName: "star.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(LdBrand.yellow)
                }
                Text(lead.address)
                    .font(.system(size: 13))
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
                heroAction(icon: "phone.fill", label: "Ring", color: LdBrand.green)
                heroAction(icon: "envelope.fill", label: "E-post", color: LdBrand.blue)
                heroAction(icon: "calendar", label: "Møte", color: LdBrand.purple)
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
                .font(.system(size: 10))
            Text(label)
                .font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(LdBrand.textSecondary)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(LdBrand.cardHi, in: Capsule())
    }

    private func heroAction(icon: String, label: String, color: Color) -> some View {
        Button {} label: {
            VStack(spacing: 4) {
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 40, height: 40)
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(.plain)
    }

    private func statusBadge(_ st: MapLeadMock.PinStatus) -> some View {
        HStack(spacing: 4) {
            Image(systemName: st.icon)
                .font(.system(size: 9, weight: .bold))
            Text(st.label)
                .font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(st.color)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(st.color.opacity(0.18), in: Capsule())
        .overlay(Capsule().stroke(st.color.opacity(0.45), lineWidth: 1))
    }

    // MARK: KPI-rad

    private var kpiRow: some View {
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
    }

    private func kpiCard(title: String, value: String, subtitle: String,
                         icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(color)
                Spacer()
            }
            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(LdBrand.textTertiary)
            }
            Text(title)
                .font(.system(size: 11))
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
                                .font(.system(size: 11, weight: .semibold))
                            Text(s.rawValue)
                                .font(.system(size: 12, weight: .semibold))
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
                    contactRow(name: "Anders Johansen", role: "Daglig leder",
                               phone: "+47 911 22 333", email: "anders@nordicelektro.no",
                               primary: true, initials: "AJ", color: LdBrand.purpleLight)
                    contactRow(name: "Kari Olsen", role: "Innkjøpssjef",
                               phone: "+47 922 33 444", email: "kari@nordicelektro.no",
                               primary: false, initials: "KO", color: LdBrand.green)
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
                                .font(.system(size: 11, weight: .bold))
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
                    .font(.system(size: 12))
                    .foregroundStyle(.white)
            }

            sectionCard(title: "Beskrivelse + notat", icon: "doc.text") {
                Text("Interessert i nytt el-anlegg til kontorbygg på Storgata. Følge opp prisforslag og referanseprosjekter fra finansbygg.")
                    .font(.system(size: 12))
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
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    if primary {
                        Text("Primær")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(LdBrand.purpleLight)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(LdBrand.purple.opacity(0.20), in: Capsule())
                    }
                }
                HStack(spacing: 6) {
                    Text(role)
                        .font(.system(size: 11))
                        .foregroundStyle(LdBrand.textSecondary)
                    Text("·").foregroundStyle(LdBrand.textTertiary)
                    Text(phone)
                        .font(.system(size: 10))
                        .foregroundStyle(LdBrand.textTertiary)
                }
            }
            Spacer()
            HStack(spacing: 6) {
                actionMini("phone", color: LdBrand.green)
                actionMini("envelope", color: LdBrand.blue)
            }
        }
        .padding(10)
        .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    private func actionMini(_ icon: String, color: Color) -> some View {
        Button {} label: {
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
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(.white)
                            } else if i == currentStageIndex {
                                Circle().fill(Color.white).frame(width: 8, height: 8)
                            }
                        }
                        .frame(width: 26, height: 26)
                        Text(stages[i])
                            .font(.system(size: 10, weight: i == currentStageIndex ? .bold : .semibold))
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
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(LdBrand.purpleLight)
                } else {
                    Image(systemName: "checkmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(LdBrand.green)
                }
            }
            .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(stage)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    if current {
                        Text("AKTIVT")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(LdBrand.purpleLight)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(LdBrand.purple.opacity(0.20), in: Capsule())
                    }
                }
                Text(date)
                    .font(.system(size: 10))
                    .foregroundStyle(LdBrand.textTertiary)
            }
            Spacer()
            if let v = value {
                Text(v)
                    .font(.system(size: 12, weight: .bold))
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
            .font(.system(size: 12, weight: .semibold))
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
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(LdBrand.purpleLight)
                        }
                        .frame(width: 32, height: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(a.label)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("Anders Johansen · Nordic Elektro")
                                .font(.system(size: 10))
                                .foregroundStyle(LdBrand.textTertiary)
                        }
                        Spacer()
                        Text(a.timestamp)
                            .font(.system(size: 11))
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
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(n.authorColor)
                            }
                            .frame(width: 28, height: 28)
                            Text(n.author)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            if n.pinned {
                                Image(systemName: "pin.fill")
                                    .font(.system(size: 9))
                                    .foregroundStyle(LdBrand.yellow)
                            }
                            Spacer()
                            Text(n.timestamp)
                                .font(.system(size: 10))
                                .foregroundStyle(LdBrand.textTertiary)
                        }
                        Text(n.body)
                            .font(.system(size: 12))
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
                                .font(.system(size: 28, weight: .semibold))
                                .foregroundStyle(f.kind.color)
                        }
                        .frame(height: 80)
                        Text(f.name)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        HStack {
                            Text(f.size)
                                .font(.system(size: 9))
                                .foregroundStyle(LdBrand.textSecondary)
                            Spacer()
                            Text(f.uploadedAt)
                                .font(.system(size: 9))
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
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    if primary {
                        Text("OWNER")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(LdBrand.yellow)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(LdBrand.yellow.opacity(0.18), in: Capsule())
                    }
                }
                Text(role)
                    .font(.system(size: 11))
                    .foregroundStyle(LdBrand.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
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
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(LdBrand.purpleLight)
                Text(title)
                    .font(.system(size: 14, weight: .bold))
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
