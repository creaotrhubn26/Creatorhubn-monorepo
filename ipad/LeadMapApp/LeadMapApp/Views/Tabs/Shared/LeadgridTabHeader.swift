// LeadgridTabHeader.swift — delt fane-header (2026-07-04)
//
// «Alle headers er lik Oversikt-fanen» (Daniel): Oversikts HeaderRow er
// løftet ut hit som gjenbrukbar komponent for alle seks hovedfanene.
// All header-data er EKTE — ingen hardkodet mock:
//   dato          → faktisk dagens dato (LeadgridHeaderLive, nb_NO)
//   sjekkliste    → oppfølginger som forfaller innen 3 dager
//   varsel-klokke → appState.leadgridUnreadCount + NotificationsView
//   avatar        → appState.displayName/initials + ProfilePopover
//
// Layout (fasit = Oversikt):
//   iPad/Mac: LeadgridHeaderMark + undertekst venstre; høyre: dato-pill
//   (LeadgridDatePickerSheet m/ 4 quick-actions), områder-Menu,
//   [extraControls], analyse, neste handlinger, aktivitet, varsler, avatar.
//   iPhone: dato-pill + extraControls i horisontal scroller venstre,
//   overflow-Menu (analyse/handlinger/aktivitet/varsler) + avatar høyre.
//
// Fane-spesifikke knapper sendes inn via extraControls-@ViewBuilder-slotten
// (iPad: mellom dato og analyse; iPhone: etter dato i scrolleren).
// Kalender-quick-actions (book møte / ny oppfølging / ny lead / dagsplan)
// eies av headeren selv, så de virker på alle faner — ikke bare Oversikt.

import SwiftUI

// MARK: - Brand-palett (duplisert minimalt fra OversiktView — Brand der er
// file-private; samme verdier som mockupen/LeadPinView)

private enum Brand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.06)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.45)
}

// MARK: - LeadgridTabHeader

struct LeadgridTabHeader<Extra: View>: View {
    /// Fane-undertekst (vises kun på brede skjermer, ved siden av logoen).
    let subtitle: String
    /// Leads som driver badge-tall, popover-innhold og dag-indikatorer.
    let leads: [LeadModel]
    /// Valgfri momentum (kun Oversikt har den lastet — nil ellers).
    let momentum: LeadgridMomentum?
    /// Når data sist ble oppdatert (Oversikt) — ekte «Oppdatert …»-tekst
    /// i aktivitet-popoveren i stedet for hardkodet «2 min siden».
    let lastUpdated: Date?
    /// SuperAdmin-inngang (kun Leadbook eier root-switchen i dag).
    let onSuperAdmin: (() -> Void)?
    /// Fane-spesifikke knapper (Leadbook/Team/…).
    let extraControls: () -> Extra

    init(subtitle: String,
         leads: [LeadModel],
         momentum: LeadgridMomentum? = nil,
         lastUpdated: Date? = nil,
         onSuperAdmin: (() -> Void)? = nil,
         @ViewBuilder extraControls: @escaping () -> Extra) {
        self.subtitle = subtitle
        self.leads = leads
        self.momentum = momentum
        self.lastUpdated = lastUpdated
        self.onSuperAdmin = onSuperAdmin
        self.extraControls = extraControls
    }

    @Environment(AppState.self) private var state

    // Intern state — tidligere bindings hoistet i OversiktView; headeren
    // eier nå alle popover/sheet-flagg selv.
    @State private var activitiesOpen = false
    @State private var nextActionsOpen = false
    @State private var analyseOpen = false
    @State private var notificationsOpen = false
    @State private var profileOpen = false
    @State private var myProfileOpen = false
    @State private var headerDate: Date = Date()
    @State private var headerDatePickerOpen = false
    @State private var headerAreaFilter: String = "Alle områder"
    // Kalender-quick-actions: sheet(item:) garanterer én sheet om gangen
    // (Mac Catalyst krasjet med constraint-exception ved stacking).
    @State private var activeCalendarSheet: CalendarSheetKind?
    @State private var bookMeetingDay: Int = Calendar.current.component(.day, from: Date())
    @State private var followUpDate: Date = Date()

    enum CalendarSheetKind: String, Identifiable {
        case bookMeeting, addLead, newFollowUp
        var id: String { rawValue }
    }

    /// Toppkandidatene til «Neste handlinger»-popoveren (samme regel som
    /// Oversikt hadde): oppfølging satt, møte booket eller score >= 70.
    private var topActions: [LeadModel] {
        Array(leads
            .filter { $0.nextFollowUpAt != nil || $0.status == .meetingBooked || ($0.leadScore ?? 0) >= 70 }
            .sorted { ($0.leadScore ?? 0) > ($1.leadScore ?? 0) }
            .prefix(8))
    }

    /// Ekte badge-tall: oppfølginger som forfaller innen 3 dager
    /// (LeadgridHeaderLive — samme semantikk som Oversikts gamle teller).
    private var upcomingFollowups: Int {
        LeadgridHeaderLive.upcomingFollowups(in: leads)
    }

    private var unreadCount: Int { state.leadgridUnreadCount }

    var body: some View {
        GeometryReader { geo in
            let isNarrow = geo.size.width < 1100
            HStack(alignment: .top, spacing: 14) {
                if !isNarrow { LeadgridHeaderMark().padding(.top, 4) }
                // Fanetittelen er fjernet — tab-baren/sidebaren viser hvor du er.
                if !isNarrow {
                    Text(subtitle)
                        .font(.appScaled(size: 13))
                        .foregroundStyle(Brand.textSecondary)
                        .lineLimit(1)
                        .padding(.top, 12)
                }
                // iPhone: dato-pill + fane-knapper venstrejustert i en
                // horisontal scroller — kontekst venstre, handlinger høyre.
                if DeviceIdiom.isPhone {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            dateButton(isNarrow: true)
                            extraControls()
                        }
                        .padding(.top, 2)
                    }
                }
                Spacer()
                HStack(spacing: 8) {
                    if !DeviceIdiom.isPhone {
                        dateButton(isNarrow: isNarrow)
                    }
                    if !isNarrow {
                        areaMenu
                    }
                    if !DeviceIdiom.isPhone {
                        extraControls()
                    }
                    // iPhone: de sekundære knappene kollapses til én
                    // ellipsis-meny så header-raden får plass.
                    if DeviceIdiom.isPhone {
                        phoneOverflowMenu
                    } else {
                        analyseButton
                        nextActionsButton
                        activitiesButton
                        notificationsButton
                    }
                    Button { profileOpen.toggle() } label: {
                        if !isNarrow { userBadge } else { userAvatarOnly }
                    }
                    .buttonStyle(.plain)
                    .macCatalystHover()
                    .popover(isPresented: $profileOpen, arrowEdge: .top) {
                        ProfilePopover(
                            name: state.displayName,
                            email: state.userEmail,
                            role: roleLabel,
                            onOpenMyProfile: {
                                profileOpen = false
                                // Liten delay så popover lukker rent før sheet åpner
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                    myProfileOpen = true
                                }
                            },
                            onOpenSuperAdmin: superAdminAction
                        )
                        .adaptivePopoverFrame(width: 320, height: 480)
                        .presentationCompactAdaptation(DeviceIdiom.isPhone ? .sheet : .popover)
                    }
                }
            }
        }
        .frame(height: 60)
        .sheet(isPresented: $myProfileOpen) {
            MyProfileSheet(name: state.displayName,
                           email: state.userEmail,
                           leads: leads)
        }
        .sheet(item: $activeCalendarSheet) { kind in
            switch kind {
            case .bookMeeting:
                BookMeetingSheet(dayOfMonth: bookMeetingDay)
            case .addLead:
                AddLeadSheet { _ in
                    // Sheet håndterer egen dismiss + save.
                }
            case .newFollowUp:
                NewFollowUpSheet(
                    initialDate: followUpDate,
                    leads: leads,
                    onSave: { payload in
                        NotificationCenter.default.post(
                            name: .oversiktFollowUpCreated,
                            object: nil,
                            userInfo: [
                                "leadName": payload.leadName,
                                "date": payload.date,
                            ]
                        )
                    }
                )
            }
        }
    }

    private var roleLabel: String {
        state.isSuperAdmin ? "Leadgrid-admin" : "Salgssjef"
    }

    /// SuperAdmin-raden vises kun for Leadgrid-ansatte OG når fanen har
    /// wiret en handler (Leadbook eier root-switchen).
    private var superAdminAction: (() -> Void)? {
        guard state.isSuperAdmin, let onSuperAdmin else { return nil }
        return {
            profileOpen = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                onSuperAdmin()
            }
        }
    }

    // MARK: Kalender-quick-actions (virker på alle faner)

    @MainActor
    private func handleCalendarAction(_ action: String, at date: Date) {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        switch action {
        case "book_meeting":
            bookMeetingDay = cal.component(.day, from: date)
            // Vent på Mac Catalyst så dato-picker rekker å lukke helt FØR
            // ny sheet monteres — ellers krasjer UIView-hierarkiet.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) {
                activeCalendarSheet = .bookMeeting
            }
        case "new_lead":
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) {
                activeCalendarSheet = .addLead
            }
        case "new_followup":
            followUpDate = date
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) {
                activeCalendarSheet = .newFollowUp
            }
        case "view_day":
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                nextActionsOpen = true
            }
        default:
            break
        }
    }

    // MARK: Dato-pill

    private func dateButton(isNarrow: Bool) -> some View {
        Button {
            headerDatePickerOpen = true
        } label: {
            pickerButton(icon: "calendar",
                         text: isNarrow ? headerDateShort() : headerDateFull())
        }
        .buttonStyle(.plain)
        .macCatalystHover()
        .sheet(isPresented: $headerDatePickerOpen) {
            LeadgridDatePickerSheet(
                initialDate: headerDate,
                showTime: false,
                onConfirm: { d in
                    headerDate = d
                    headerDatePickerOpen = false
                    // Broadcast så kart-flatene kan zoome til leads med
                    // aktivitet på valgt dato (møter/oppfølginger).
                    NotificationCenter.default.post(
                        name: .oversiktDateChanged,
                        object: nil,
                        userInfo: ["date": d]
                    )
                },
                onCancel: { headerDatePickerOpen = false },
                quickActions: [
                    LeadgridCalendarAction(
                        title: "Book møte denne dagen",
                        icon: "calendar.badge.plus",
                        color: Brand.purpleLight,
                        onSelect: { d in
                            headerDate = d
                            headerDatePickerOpen = false
                            handleCalendarAction("book_meeting", at: d)
                        }
                    ),
                    LeadgridCalendarAction(
                        title: "Ny oppfølging",
                        icon: "flag.badge.ellipsis.fill",
                        color: Brand.blue,
                        onSelect: { d in
                            headerDate = d
                            headerDatePickerOpen = false
                            handleCalendarAction("new_followup", at: d)
                        }
                    ),
                    LeadgridCalendarAction(
                        title: "Ny lead",
                        icon: "person.crop.circle.badge.plus",
                        color: Brand.green,
                        onSelect: { d in
                            headerDate = d
                            headerDatePickerOpen = false
                            handleCalendarAction("new_lead", at: d)
                        }
                    ),
                    LeadgridCalendarAction(
                        title: "Vis dagens plan",
                        icon: "list.bullet.rectangle.portrait.fill",
                        color: Brand.orange,
                        onSelect: { d in
                            headerDate = d
                            headerDatePickerOpen = false
                            handleCalendarAction("view_day", at: d)
                        }
                    ),
                ],
                dayIndicators: Self.buildDayIndicators(from: leads)
            )
        }
    }

    /// Ekte dato i pillen (nb_NO). Valgt ikke-dagens dato beholdes i samme
    /// format som resten av appen.
    private func headerDateFull() -> String {
        if Calendar.current.isDateInToday(headerDate) {
            return LeadgridHeaderLive.dateLong
        }
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM yyyy"
        return f.string(from: headerDate)
    }

    private func headerDateShort() -> String {
        if Calendar.current.isDateInToday(headerDate) {
            return LeadgridHeaderLive.dateShort
        }
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM"
        return f.string(from: headerDate)
    }

    /// Bygg dato → aktivitets-indikator-map fra leads (møter = leads med
    /// status .meetingBooked og nextFollowUpAt den dagen; resten = oppfølging).
    static func buildDayIndicators(
        from leads: [LeadModel]
    ) -> [Date: LeadgridDayIndicator] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        var meetings: [Date: Int] = [:]
        var followUps: [Date: Int] = [:]
        for lead in leads {
            guard let d = lead.nextFollowUpAt else { continue }
            let day = cal.startOfDay(for: d)
            if lead.status == .meetingBooked {
                meetings[day, default: 0] += 1
            } else {
                followUps[day, default: 0] += 1
            }
        }
        var result: [Date: LeadgridDayIndicator] = [:]
        for day in Set(meetings.keys).union(followUps.keys) {
            result[day] = LeadgridDayIndicator(
                meetings: meetings[day] ?? 0,
                followUps: followUps[day] ?? 0
            )
        }
        return result
    }

    // MARK: Områder-Menu

    /// Områder bygges dynamisk fra leads sine city-felter + faste hurtigvalg.
    private var availableAreas: [String] {
        var seen = Set<String>()
        var out: [String] = ["Alle områder"]
        for lead in leads {
            if let city = lead.city, !city.isEmpty, seen.insert(city).inserted {
                out.append(city)
            }
        }
        if out.count == 1 {
            out.append(contentsOf: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Lillestrøm"])
        }
        return out
    }

    private var areaMenu: some View {
        Menu {
            ForEach(availableAreas, id: \.self) { area in
                Button {
                    headerAreaFilter = area
                    // Broadcast så fanene (Oversikt-kartet) kan zoome +
                    // filtrere uten å hoiste state gjennom hierarkiet.
                    NotificationCenter.default.post(
                        name: .oversiktAreaChanged,
                        object: nil,
                        userInfo: ["area": area]
                    )
                } label: {
                    if area == headerAreaFilter {
                        Label(area, systemImage: "checkmark")
                    } else {
                        Text(area)
                    }
                }
            }
        } label: {
            pickerButton(icon: "location.fill", text: headerAreaFilter)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .macCatalystHover()
    }

    // MARK: Popover-innhold (delt mellom iPad-knapper og iPhone-overflow)

    private var analysePopoverContent: some View {
        AnalysePopover(leads: leads)
            .adaptivePopoverFrame(width: 460, height: 640)
            .presentationCompactAdaptation(DeviceIdiom.isPhone ? .sheet : .popover)
    }

    private var nextActionsPopoverContent: some View {
        NextActionsPopover(leads: topActions, totalCount: leads.count)
            .adaptivePopoverFrame(width: 420, height: 560)
            .presentationCompactAdaptation(DeviceIdiom.isPhone ? .sheet : .popover)
    }

    private var activitiesPopoverContent: some View {
        RecentActivitiesPopover(leads: leads,
                                upcomingFollowups: upcomingFollowups,
                                momentum: momentum,
                                lastUpdated: lastUpdated)
            .adaptivePopoverFrame(width: 420, height: 600)
            .presentationCompactAdaptation(DeviceIdiom.isPhone ? .sheet : .popover)
    }

    private var notificationsPopoverContent: some View {
        NotificationsView()
            .adaptivePopoverFrame(width: 400, height: 560)
            .presentationCompactAdaptation(DeviceIdiom.isPhone ? .sheet : .popover)
    }

    // MARK: Knapper

    private var analyseButton: some View {
        Button {
            analyseOpen.toggle()
        } label: {
            iconTile(systemName: "chart.line.uptrend.xyaxis", size: 14)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Analyse")
        .macCatalystHover()
        .popover(isPresented: $analyseOpen, arrowEdge: .top) {
            analysePopoverContent
        }
    }

    private var nextActionsButton: some View {
        Button {
            nextActionsOpen.toggle()
        } label: {
            ZStack(alignment: .topTrailing) {
                iconTile(systemName: "checklist", size: 16)
                // Ekte badge: forfallende oppfølginger (<= 3 dager).
                if upcomingFollowups > 0 {
                    countBadge(upcomingFollowups)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(upcomingFollowups > 0
            ? "Neste handlinger, \(upcomingFollowups) forfaller snart"
            : "Neste handlinger")
        .macCatalystHover()
        .popover(isPresented: $nextActionsOpen, arrowEdge: .top) {
            nextActionsPopoverContent
        }
    }

    private var activitiesButton: some View {
        Button {
            activitiesOpen.toggle()
        } label: {
            iconTile(systemName: "clock.arrow.circlepath", size: 14)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Siste aktivitet")
        .macCatalystHover()
        .popover(isPresented: $activitiesOpen, arrowEdge: .top) {
            activitiesPopoverContent
        }
    }

    /// Varsel-klokke m/ EKTE badge (appState.leadgridUnreadCount) →
    /// NotificationsView (polling + mark-as-read + deep-link til lead).
    private var notificationsButton: some View {
        Button {
            notificationsOpen.toggle()
        } label: {
            ZStack(alignment: .topTrailing) {
                iconTile(systemName: "bell.fill", size: 14)
                if unreadCount > 0 {
                    countBadge(unreadCount, color: Brand.red)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(unreadCount > 0
            ? "Varsler, \(unreadCount) uleste"
            : "Varsler")
        .macCatalystHover()
        .popover(isPresented: $notificationsOpen, arrowEdge: .top) {
            notificationsPopoverContent
        }
    }

    /// iPhone-erstatning for de sekundære header-knappene. Popover-ene
    /// forankres i usynlige bakgrunns-anchors (én per presentasjon) og
    /// vises som sheets via adaptivePopoverFrame.
    private var phoneOverflowMenu: some View {
        Menu {
            Button {
                analyseOpen = true
            } label: {
                Label("Analyse", systemImage: "chart.line.uptrend.xyaxis")
            }
            Button {
                nextActionsOpen = true
            } label: {
                Label("Neste handlinger", systemImage: "checklist")
            }
            Button {
                activitiesOpen = true
            } label: {
                Label("Aktivitet", systemImage: "clock.arrow.circlepath")
            }
            Button {
                notificationsOpen = true
            } label: {
                Label(unreadCount > 0 ? "Varsler (\(unreadCount))" : "Varsler",
                      systemImage: "bell.fill")
            }
        } label: {
            ZStack(alignment: .topTrailing) {
                iconTile(systemName: "ellipsis.circle", size: 16)
                // Samme badge-signal som på iPad: forfallende oppfølginger
                // + uleste varsler.
                if upcomingFollowups + unreadCount > 0 {
                    countBadge(upcomingFollowups + unreadCount)
                }
            }
        }
        .menuStyle(.borderlessButton)
        .accessibilityLabel("Flere verktøy")
        .background(
            Color.clear
                .popover(isPresented: $analyseOpen, arrowEdge: .top) {
                    analysePopoverContent
                }
        )
        .background(
            Color.clear
                .popover(isPresented: $nextActionsOpen, arrowEdge: .top) {
                    nextActionsPopoverContent
                }
        )
        .background(
            Color.clear
                .popover(isPresented: $activitiesOpen, arrowEdge: .top) {
                    activitiesPopoverContent
                }
        )
        .background(
            Color.clear
                .popover(isPresented: $notificationsOpen, arrowEdge: .top) {
                    notificationsPopoverContent
                }
        )
    }

    // MARK: Byggeklosser

    private func iconTile(systemName: String, size: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12).fill(Brand.card)
            RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1)
            Image(systemName: systemName)
                .font(.appScaled(size: size, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
        }
        .frame(width: 44, height: 44)
    }

    private func countBadge(_ n: Int, color: Color = Brand.purple) -> some View {
        Text("\(min(n, 99))")
            .font(.appScaled(size: 9, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(color, in: Capsule())
            .overlay(Capsule().stroke(Brand.bg, lineWidth: 1.5))
            .offset(x: 6, y: -6)
    }

    private func pickerButton(icon: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
            Text(text)
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
            Image(systemName: "chevron.down")
                .font(.appScaled(size: 10, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))
    }

    private var userBadge: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(Brand.purple.opacity(0.25))
                Text(state.initials)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(state.displayName)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(roleLabel)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
                    .lineLimit(1)
            }
            .fixedSize(horizontal: true, vertical: false)
            Image(systemName: "chevron.down")
                .font(.appScaled(size: 10, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))
    }

    /// Trange headere (portrait iPad / iPhone) — kun initial-avatar.
    private var userAvatarOnly: some View {
        ZStack {
            Circle().fill(Brand.purple.opacity(0.25))
            Text(state.initials)
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(Brand.purpleLight)
            Circle().stroke(Brand.stroke, lineWidth: 1)
        }
        .frame(width: 44, height: 44)
    }
}

// MARK: - Convenience-init uten fane-spesifikke knapper

extension LeadgridTabHeader where Extra == EmptyView {
    init(subtitle: String,
         leads: [LeadModel],
         momentum: LeadgridMomentum? = nil,
         lastUpdated: Date? = nil,
         onSuperAdmin: (() -> Void)? = nil) {
        self.init(subtitle: subtitle,
                  leads: leads,
                  momentum: momentum,
                  lastUpdated: lastUpdated,
                  onSuperAdmin: onSuperAdmin,
                  extraControls: { EmptyView() })
    }
}
