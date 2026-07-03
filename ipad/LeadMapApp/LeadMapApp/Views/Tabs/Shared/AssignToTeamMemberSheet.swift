// AssignToTeamMemberSheet.swift
//
// Salgssjef/teamleder velger en selger eller promotør fra teamlisten og
// sender vedkommende til en lead — «Reis dit og prat med dem».
// Selgeren/promotøren mottar oppdraget (in-app varsel + toast neste gang
// de åpner appen; push kommer i backend-pakke).
//
// 3-stegs UX:
//   1. Team-liste (filter+søk+sorter) → velg mottaker
//   2. Melding + prioritet → bekreft
//   3. Send → toast + lukk
//
// Design-språk følger info-kortets card+stroke, med rolle-farger:
//   Selger    → lilla
//   Promotør  → oransje
//   Teamleder → grønn (kan også få oppdrag fra andre teamledere)

import SwiftUI
import CoreLocation

// MARK: - Assignment-modell (lokalt for nå — vil senere pushes til backend)

/// Én tildeling: hvilken lead ble sendt til hvem, når, med hvilken melding
/// og hvilken prioritet.
struct LeadAssignment: Identifiable, Hashable {
    let id = UUID()
    let leadId: String
    let leadName: String
    let leadCoordinate: CLLocationCoordinate2D
    let assigneeUserId: String
    let assigneeName: String
    let assigneeRole: TeamRole
    let priority: AssignmentPriority
    let message: String
    let assignedAt: Date

    // CLLocationCoordinate2D er ikke Hashable — implementer manuelt.
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    static func == (lhs: LeadAssignment, rhs: LeadAssignment) -> Bool {
        lhs.id == rhs.id
    }
}

/// Rolle for team-medlem. Bestemmer farge-koding + hvilke oppdrag som
/// er relevante (selgere får salgsleads, promotører får awareness-leads).
enum TeamRole: String, CaseIterable, Identifiable, Hashable {
    case seller     // Selger
    case promoter   // Promotør
    case manager    // Teamleder

    var id: String { rawValue }

    var label: String {
        switch self {
        case .seller:   return "Selger"
        case .promoter: return "Promotør"
        case .manager:  return "Teamleder"
        }
    }

    var pluralLabel: String {
        switch self {
        case .seller:   return "Selgere"
        case .promoter: return "Promotører"
        case .manager:  return "Teamledere"
        }
    }

    var color: Color {
        switch self {
        case .seller:   return Color(red: 0.66, green: 0.32, blue: 0.99) // lilla
        case .promoter: return Color(red: 1.00, green: 0.55, blue: 0.15) // oransje
        case .manager:  return Color(red: 0.20, green: 0.85, blue: 0.60) // grønn
        }
    }

    var icon: String {
        switch self {
        case .seller:   return "briefcase.fill"
        case .promoter: return "megaphone.fill"
        case .manager:  return "person.badge.key.fill"
        }
    }
}

/// Prioritet på oppdraget. Bruker for både visuell coding og
/// varsling-strategi (Haster kan trigge push umiddelbart).
enum AssignmentPriority: String, CaseIterable, Identifiable, Hashable {
    case normal
    case high
    case urgent

    var id: String { rawValue }

    var label: String {
        switch self {
        case .normal:  return "Normal"
        case .high:    return "Høy"
        case .urgent:  return "Haster"
        }
    }

    var color: Color {
        switch self {
        case .normal:  return Color(red: 0.55, green: 0.60, blue: 0.68)
        case .high:    return Color(red: 1.00, green: 0.65, blue: 0.20)
        case .urgent:  return Color(red: 0.95, green: 0.30, blue: 0.30)
        }
    }

    var icon: String {
        switch self {
        case .normal:  return "circle.fill"
        case .high:    return "exclamationmark.circle.fill"
        case .urgent:  return "exclamationmark.2"
        }
    }
}

/// Row-modell for team-listen. Kombinerer SalesTeamMemberDTO + rolle +
/// posisjon-info. Kan mock-genereres eller bygges fra API + Kartverket.
struct AssignableTeamMember: Identifiable, Hashable {
    let userId: String
    let name: String
    let email: String?
    let title: String?
    let role: TeamRole
    /// Avstand fra lead-koord (km). Nil = ikke tilgjengelig.
    let distanceKm: Double?
    /// Antall vunne deals denne uken — brukt til «best presterende»-sort.
    let weeklyWon: Int
    /// Er selger/promotør aktiv nå (fri, ikke i møte)? Nil = ukjent.
    let isAvailable: Bool?
    let avatarInitials: String

    var id: String { userId }
}

// MARK: - Brand (matcher OversiktView)

private enum ATB {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.10)
    static let textDim = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.30)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let orange = Color(red: 1.00, green: 0.55, blue: 0.15)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
}

// MARK: - Main sheet

struct AssignToTeamMemberSheet: View {
    /// Ekte crm_customers-id når kjent — sendes videre til backend så
    /// tildelingen kan kobles til leaden. Nil for drop-pins o.l.
    var leadId: String? = nil
    let leadName: String
    let leadAddress: String?
    let leadScore: Int?
    let leadCoordinate: CLLocationCoordinate2D
    let members: [AssignableTeamMember]
    let onAssign: (LeadAssignment) -> Void
    let onCancel: () -> Void

    @Environment(\.dismiss) private var dismiss

    // Step state
    @State private var step: Step = .pick
    @State private var selectedMember: AssignableTeamMember?
    @State private var message: String = ""
    @State private var priority: AssignmentPriority = .normal

    // Filter + sort state
    @State private var roleFilter: TeamRole? = nil  // nil = alle
    @State private var searchText: String = ""
    @State private var sortMode: SortMode = .nearest

    enum Step { case pick, confirm }
    enum SortMode: String, CaseIterable, Identifiable {
        case nearest = "Nærmest"
        case name = "A–Å"
        case performance = "Best ytelse"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ATB.bg.ignoresSafeArea()
                switch step {
                case .pick:    pickStep
                case .confirm: confirmStep
                }
            }
            .navigationTitle(step == .pick ? "Send oppdrag" : "Bekreft oppdrag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        if step == .confirm {
                            withAnimation(.snappy(duration: 0.2)) { step = .pick }
                        } else {
                            onCancel()
                            dismiss()
                        }
                    } label: {
                        Image(systemName: step == .confirm ? "chevron.left" : "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 30, height: 30)
                            .background(ATB.cardHi, in: Circle())
                            .overlay(Circle().strokeBorder(ATB.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(step == .confirm ? "Tilbake" : "Avbryt")
                }
                ToolbarItem(placement: .principal) {
                    Text(step == .pick ? "Send oppdrag" : "Bekreft oppdrag")
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }
            }
        }
        // Bruk størst tilgjengelige detent — Mac Catalyst-vinduer er ofte
        // brede så .large er både naturlig og gir mest plass til liste.
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(.thinMaterial)
    }

    // MARK: - Step 1: Pick

    private var pickStep: some View {
        VStack(spacing: 0) {
            leadSummaryHeader
            filtersBar
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            searchBar
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            if filteredMembers.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(filteredMembers) { member in
                            memberRow(member)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 100)
                }
            }
        }
        .overlay(alignment: .bottom) {
            if let picked = selectedMember {
                VStack(spacing: 8) {
                    Button {
                        withAnimation(.snappy(duration: 0.2)) { step = .confirm }
                    } label: {
                        HStack(spacing: 8) {
                            Text("Fortsett med \(picked.name.split(separator: " ").first.map(String.init) ?? picked.name)")
                                .font(.system(size: 14, weight: .bold))
                            Image(systemName: "arrow.right")
                                .font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20).padding(.vertical, 14)
                        .frame(maxWidth: .infinity)
                        .background(
                            LinearGradient(
                                colors: [picked.role.color, picked.role.color.opacity(0.7)],
                                startPoint: .leading, endPoint: .trailing
                            ),
                            in: Capsule()
                        )
                        .shadow(color: picked.role.color.opacity(0.4), radius: 10, y: 4)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 20)
                .background(
                    LinearGradient(
                        colors: [ATB.bg.opacity(0), ATB.bg.opacity(0.95), ATB.bg],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy(duration: 0.2), value: selectedMember)
    }

    // Lead-info oppsummering på toppen
    private var leadSummaryHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(ATB.purple.opacity(0.22))
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(ATB.purpleLight)
            }
            .frame(width: 42, height: 42)
            .overlay(Circle().strokeBorder(ATB.purple.opacity(0.35), lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text("LEAD")
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .tracking(0.8)
                    .foregroundStyle(ATB.textDim)
                Text(leadName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let address = leadAddress, !address.isEmpty {
                    Text(address)
                        .font(.system(size: 11))
                        .foregroundStyle(ATB.textDim)
                        .lineLimit(1)
                }
            }
            Spacer()
            if let score = leadScore, score > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 10, weight: .bold))
                    Text("\(score)")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(ATB.purple, in: Capsule())
            }
        }
        .padding(14)
        .background(ATB.card)
        .overlay(alignment: .bottom) {
            Rectangle().fill(ATB.stroke).frame(height: 1)
        }
    }

    // Rolle-filter chips — horisontal scroll så de aldri wrapper på trange
    // vinduer. Kortere labels + `.fixedSize()` per chip.
    private var filtersBar: some View {
        HStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    filterChip(label: "Alle", role: nil, count: members.count)
                    ForEach(TeamRole.allCases) { role in
                        let count = members.filter { $0.role == role }.count
                        if count > 0 {
                            filterChip(label: role.pluralLabel, role: role, count: count)
                        }
                    }
                }
            }
            // Sortering-menu — komprimert, holder seg til venstre for wrap.
            Menu {
                ForEach(SortMode.allCases) { mode in
                    Button {
                        sortMode = mode
                    } label: {
                        HStack {
                            Text(mode.rawValue)
                            if sortMode == mode {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "arrow.up.arrow.down")
                        .font(.system(size: 10, weight: .bold))
                    Text(sortMode.rawValue)
                        .font(.system(size: 11, weight: .semibold))
                        .fixedSize(horizontal: true, vertical: false)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(ATB.cardHi, in: Capsule())
                .overlay(Capsule().strokeBorder(ATB.stroke, lineWidth: 1))
            }
            .fixedSize()
        }
    }

    private func filterChip(label: String, role: TeamRole?, count: Int) -> some View {
        let isActive = roleFilter == role
        return Button {
            withAnimation(.snappy(duration: 0.15)) {
                roleFilter = role
            }
        } label: {
            HStack(spacing: 5) {
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .fixedSize(horizontal: true, vertical: false)
                    .lineLimit(1)
                Text("\(count)")
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .foregroundStyle(isActive ? .white : ATB.textDim)
                    .monospacedDigit()
            }
            .foregroundStyle(isActive ? .white : ATB.textDim)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(
                isActive ? (role?.color ?? ATB.purple).opacity(0.55) : ATB.cardHi,
                in: Capsule()
            )
            .overlay(Capsule().strokeBorder(
                isActive ? (role?.color ?? ATB.purple).opacity(0.6) : ATB.stroke,
                lineWidth: 1
            ))
        }
        .buttonStyle(.plain)
        .fixedSize()
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ATB.textDim)
            TextField("Søk etter navn eller e-post", text: $searchText)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .foregroundStyle(.white)
            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(ATB.textDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .background(ATB.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(ATB.stroke, lineWidth: 1))
    }

    private func memberRow(_ member: AssignableTeamMember) -> some View {
        let isSelected = selectedMember?.id == member.id
        return Button {
            withAnimation(.snappy(duration: 0.15)) {
                selectedMember = member
            }
        } label: {
            HStack(spacing: 12) {
                // Avatar
                ZStack {
                    Circle().fill(member.role.color.opacity(0.22))
                    Circle().strokeBorder(member.role.color.opacity(0.55), lineWidth: 1)
                    Text(member.avatarInitials)
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }
                .frame(width: 40, height: 40)
                // Info
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(member.name)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        if let avail = member.isAvailable {
                            Circle()
                                .fill(avail ? ATB.green : ATB.textDim)
                                .frame(width: 6, height: 6)
                                .shadow(color: (avail ? ATB.green : .clear).opacity(0.7), radius: 3)
                        }
                    }
                    HStack(spacing: 6) {
                        // Rolle-badge
                        HStack(spacing: 3) {
                            Image(systemName: member.role.icon)
                                .font(.system(size: 8, weight: .bold))
                            Text(member.role.label)
                                .font(.system(size: 10, weight: .heavy, design: .rounded))
                        }
                        .foregroundStyle(member.role.color)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(member.role.color.opacity(0.15), in: Capsule())
                        .overlay(Capsule().strokeBorder(member.role.color.opacity(0.35), lineWidth: 0.5))
                        // Avstand
                        if let d = member.distanceKm {
                            Text("·")
                                .foregroundStyle(ATB.textTertiary)
                            Image(systemName: "location.fill")
                                .font(.system(size: 8))
                                .foregroundStyle(ATB.textDim)
                            Text(d < 1
                                 ? "\(Int(d * 1000)) m"
                                 : String(format: "%.1f km", d))
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(ATB.textDim)
                        }
                        // Ytelse
                        if member.weeklyWon > 0 {
                            Text("·")
                                .foregroundStyle(ATB.textTertiary)
                            Image(systemName: "trophy.fill")
                                .font(.system(size: 8))
                                .foregroundStyle(ATB.orange)
                            Text("\(member.weeklyWon) uka")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(ATB.textDim)
                        }
                    }
                }
                Spacer()
                if isSelected {
                    ZStack {
                        Circle().fill(member.role.color)
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 22, height: 22)
                    .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(12)
            .background(
                (isSelected ? member.role.color.opacity(0.12) : ATB.card),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(
                        isSelected ? member.role.color.opacity(0.55) : ATB.stroke,
                        lineWidth: isSelected ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 32))
                .foregroundStyle(ATB.textTertiary)
            Text("Ingen treff")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
            Text("Prøv å nullstille filter eller søk på annen tekst.")
                .font(.caption)
                .foregroundStyle(ATB.textDim)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Step 2: Confirm

    private var confirmStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Sammendrag: lead → mottaker
                confirmSummaryCard
                // Melding
                VStack(alignment: .leading, spacing: 8) {
                    Text("MELDING")
                        .font(.system(size: 9, weight: .black, design: .rounded))
                        .tracking(1.0)
                        .foregroundStyle(ATB.textDim)
                    TextField(
                        "Skriv en beskjed til \(selectedMember?.name.split(separator: " ").first.map(String.init) ?? "mottakeren")…",
                        text: $message,
                        axis: .vertical
                    )
                    .textFieldStyle(.plain)
                    .font(.system(size: 13))
                    .foregroundStyle(.white)
                    .lineLimit(3...6)
                    .padding(12)
                    .background(ATB.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11)
                        .strokeBorder(ATB.stroke, lineWidth: 1))
                    Text("Tips: konkret er best. F.eks. «\(quickTip)»")
                        .font(.caption)
                        .foregroundStyle(ATB.textDim)
                }
                // Prioritet
                VStack(alignment: .leading, spacing: 8) {
                    Text("PRIORITET")
                        .font(.system(size: 9, weight: .black, design: .rounded))
                        .tracking(1.0)
                        .foregroundStyle(ATB.textDim)
                    HStack(spacing: 8) {
                        ForEach(AssignmentPriority.allCases) { p in
                            priorityChip(p)
                        }
                    }
                }
                Spacer(minLength: 10)
                // Send-CTA
                Button {
                    sendAssignment()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 12, weight: .bold))
                        Text("Send oppdrag")
                            .font(.system(size: 14, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20).padding(.vertical, 14)
                    .frame(maxWidth: .infinity)
                    .background(
                        LinearGradient(
                            colors: [
                                (selectedMember?.role.color ?? ATB.purple),
                                (selectedMember?.role.color ?? ATB.purple).opacity(0.7),
                            ],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: Capsule()
                    )
                    .shadow(
                        color: (selectedMember?.role.color ?? ATB.purple).opacity(0.4),
                        radius: 10, y: 4
                    )
                }
                .buttonStyle(.plain)
            }
            .padding(16)
        }
    }

    private var confirmSummaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Fra-linje
            HStack(spacing: 10) {
                iconBadge("mappin.and.ellipse", color: ATB.purple)
                VStack(alignment: .leading, spacing: 1) {
                    Text("LEAD")
                        .font(.system(size: 8, weight: .black, design: .rounded))
                        .tracking(0.8)
                        .foregroundStyle(ATB.textDim)
                    Text(leadName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let a = leadAddress, !a.isEmpty {
                        Text(a)
                            .font(.system(size: 11))
                            .foregroundStyle(ATB.textDim)
                            .lineLimit(1)
                    }
                }
                Spacer()
            }
            // Pil
            Image(systemName: "arrow.down")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(ATB.textDim)
                .frame(maxWidth: .infinity, alignment: .center)
            // Til-linje
            if let m = selectedMember {
                HStack(spacing: 10) {
                    ZStack {
                        Circle().fill(m.role.color.opacity(0.22))
                        Circle().strokeBorder(m.role.color.opacity(0.55), lineWidth: 1)
                        Text(m.avatarInitials)
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 32, height: 32)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("MOTTAKER")
                            .font(.system(size: 8, weight: .black, design: .rounded))
                            .tracking(0.8)
                            .foregroundStyle(ATB.textDim)
                        Text(m.name)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        HStack(spacing: 4) {
                            Image(systemName: m.role.icon)
                                .font(.system(size: 8))
                                .foregroundStyle(m.role.color)
                            Text(m.role.label)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(m.role.color)
                        }
                    }
                    Spacer()
                    if let d = m.distanceKm {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(d < 1 ? "\(Int(d * 1000)) m" : String(format: "%.1f km", d))
                                .font(.system(size: 12, weight: .heavy, design: .rounded))
                                .foregroundStyle(.white)
                            Text("unna")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(ATB.textDim)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(ATB.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(ATB.stroke, lineWidth: 1))
    }

    private func iconBadge(_ icon: String, color: Color) -> some View {
        ZStack {
            Circle().fill(color.opacity(0.22))
            Circle().strokeBorder(color.opacity(0.55), lineWidth: 1)
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(color)
        }
        .frame(width: 32, height: 32)
    }

    private func priorityChip(_ p: AssignmentPriority) -> some View {
        let isActive = priority == p
        return Button {
            withAnimation(.snappy(duration: 0.15)) {
                priority = p
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: p.icon)
                    .font(.system(size: 10, weight: .bold))
                Text(p.label)
                    .font(.system(size: 11, weight: .bold))
            }
            .foregroundStyle(isActive ? .white : p.color)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                isActive ? p.color : p.color.opacity(0.12),
                in: Capsule()
            )
            .overlay(Capsule().strokeBorder(p.color.opacity(isActive ? 0 : 0.4), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Sort/filter

    private var filteredMembers: [AssignableTeamMember] {
        var list = members
        if let role = roleFilter {
            list = list.filter { $0.role == role }
        }
        let q = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        if !q.isEmpty {
            list = list.filter { m in
                m.name.lowercased().contains(q)
                    || (m.email?.lowercased().contains(q) ?? false)
            }
        }
        switch sortMode {
        case .nearest:
            list.sort {
                ($0.distanceKm ?? .greatestFiniteMagnitude)
                    < ($1.distanceKm ?? .greatestFiniteMagnitude)
            }
        case .name:
            list.sort { $0.name.lowercased() < $1.name.lowercased() }
        case .performance:
            list.sort { $0.weeklyWon > $1.weeklyWon }
        }
        return list
    }

    // MARK: - Send

    private var quickTip: String {
        switch priority {
        case .urgent: return "Vi trenger deg der innen 30 min"
        case .high:   return "Ta møtet i dag hvis mulig"
        case .normal: return "Prat med Anne før fredag"
        }
    }

    private func sendAssignment() {
        guard let m = selectedMember else { return }
        let a = LeadAssignment(
            leadId: leadId ?? "lead-\(leadName)",
            leadName: leadName,
            leadCoordinate: leadCoordinate,
            assigneeUserId: m.userId,
            assigneeName: m.name,
            assigneeRole: m.role,
            priority: priority,
            message: message.trimmingCharacters(in: .whitespacesAndNewlines),
            assignedAt: Date()
        )
        onAssign(a)
        dismiss()
    }
}
