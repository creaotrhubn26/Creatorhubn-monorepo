// LeadgridDatePicker.swift
//
// Leadgrid-branded custom kalender + tid-picker. Erstatter native
// `DatePicker` som ser ut som iOS-standard (hvit bakgrunn + engelske
// ukedager) — Leadgrid-versjonen bruker mørk lilla brand-palett og
// norsk lokalisering.
//
// Bruk:
//   LeadgridDateFieldRow(
//       title: "Følg opp",
//       date: Binding(...),
//       showTime: true
//   )
//
// Rendrer en klikkbar rad (label + valgt dato-tekst + kalender-ikon).
// Ved trykk åpnes en full-picker sheet med:
//   - Måneds-navigasjon (‹ | juni 2026 | ›)
//   - 7-dagers grid med lilla accent på valgt dag
//   - Time-picker (48 slots @ 30 min ELLER wheel)
//   - Hurtigvalg: I dag / I morgen / +3 dager / Neste uke
//   - Avbryt / Bekreft-knapper

import SwiftUI

// MARK: - Farge-palett (matcher OversiktView Brand)

private enum LDP {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.10)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let purpleGlow = Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0.35)
    static let textDim = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.30)
}

// MARK: - Row som erstatter DatePicker inline i Form

/// Klikkbar rad som viser valgt dato (og tid hvis showTime = true) i
/// Leadgrid-stil. Tapping åpner full sheet.
struct LeadgridDateFieldRow: View {
    let title: String
    @Binding var date: Date
    var showTime: Bool = true
    var icon: String = "calendar"

    @State private var pickerOpen = false

    private var formattedDate: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        if showTime {
            f.dateFormat = "d. MMM yyyy, HH:mm"
        } else {
            f.dateFormat = "d. MMMM yyyy"
        }
        return f.string(from: date)
    }

    var body: some View {
        Button {
            pickerOpen = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(LDP.purpleLight)
                    .frame(width: 22)
                Text(title)
                    .foregroundStyle(.white)
                Spacer()
                Text(formattedDate)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(LDP.purpleLight)
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(LDP.textTertiary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $pickerOpen) {
            LeadgridDatePickerSheet(
                initialDate: date,
                showTime: showTime,
                onConfirm: { newDate in
                    date = newDate
                    pickerOpen = false
                },
                onCancel: { pickerOpen = false }
            )
        }
    }
}

// MARK: - Sheet: full picker

/// Handling som brukeren kan starte direkte fra kalenderen (i tillegg til
/// å bare velge en dato). F.eks. «Book møte», «Ny oppfølging», «Ny lead».
/// Ved tap: sheeten lukkes + closure fyres med valgt dato.
struct LeadgridCalendarAction: Identifiable {
    let id = UUID()
    let title: String
    let icon: String
    let color: Color
    let onSelect: (Date) -> Void
}

/// Aktivitet på en bestemt dag — tegnes som fargede prikker under
/// dag-tallet i kalender-griden så bruker ser umiddelbart hva som
/// venter (møter vs oppfølginger).
struct LeadgridDayIndicator {
    let meetings: Int
    let followUps: Int
    var hasAny: Bool { meetings > 0 || followUps > 0 }
}

struct LeadgridDatePickerSheet: View {
    let initialDate: Date
    let showTime: Bool
    let onConfirm: (Date) -> Void
    let onCancel: () -> Void
    /// Optional handlinger som vises som store CTA-knapper under kalenderen.
    /// Tomt = ingen handlinger-seksjon (bare bekreft/avbryt-knapper).
    var quickActions: [LeadgridCalendarAction] = []
    /// Optional aktivitets-indikatorer per dato (start-of-day). Vises som
    /// prikker i dag-cellene + en legend under griden.
    var dayIndicators: [Date: LeadgridDayIndicator] = [:]

    @State private var displayedMonth: Date
    @State private var selectedDate: Date
    @State private var selectedHour: Int
    @State private var selectedMinute: Int

    private let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2 // Mandag først (norsk standard)
        c.locale = Locale(identifier: "nb_NO")
        // Fix 2026-07-02: kalenderen viste feil dato («i går») på Mac Catalyst
        // fordi TimeZone default falt tilbake til UTC på noen konfigurasjoner
        // → dateComponents / isDateInToday-sammenligninger krysset midnatt.
        // Låser til Europe/Oslo så vi alltid er i norsk tidssone.
        c.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        return c
    }()
    private let weekdaySymbols: [String] = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"]

    init(
        initialDate: Date,
        showTime: Bool,
        onConfirm: @escaping (Date) -> Void,
        onCancel: @escaping () -> Void,
        quickActions: [LeadgridCalendarAction] = [],
        dayIndicators: [Date: LeadgridDayIndicator] = [:]
    ) {
        self.initialDate = initialDate
        self.showTime = showTime
        self.onConfirm = onConfirm
        self.onCancel = onCancel
        self.quickActions = quickActions
        self.dayIndicators = dayIndicators
        // Bruk Europe/Oslo også her (init går før self.cal er tilgjengelig).
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        cal.locale = Locale(identifier: "nb_NO")
        let comps = cal.dateComponents([.year, .month, .day, .hour, .minute], from: initialDate)
        _displayedMonth = State(initialValue: cal.date(from: DateComponents(
            year: comps.year, month: comps.month, day: 1
        )) ?? initialDate)
        _selectedDate = State(initialValue: initialDate)
        _selectedHour = State(initialValue: comps.hour ?? 9)
        _selectedMinute = State(initialValue: (comps.minute ?? 0) < 30 ? 0 : 30)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    monthHeader
                    weekdayHeader
                    calendarGrid
                    if hasIndicatorsThisMonth { indicatorLegend }
                    dateShortcutsBar
                    if showTime { timePicker }
                    if !quickActions.isEmpty { calendarActionButtons }
                }
                .padding(18)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(LDP.bg)
            .navigationTitle("Velg dato")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        onCancel()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.appScaled(size: 14, weight: .semibold))
                    }
                    .accessibilityLabel("Avbryt")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Bekreft") { confirm() }
                        .fontWeight(.bold)
                        .foregroundStyle(LDP.purpleLight)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Sub-views

    private var monthHeader: some View {
        HStack(spacing: 12) {
            navButton("chevron.left") { shiftMonth(by: -1) }
            Spacer()
            VStack(spacing: 2) {
                Text(monthYearString().uppercased())
                    .font(.appScaled(size: 13, weight: .black, design: .rounded))
                    .tracking(1.2)
                    .foregroundStyle(LDP.purpleLight)
                if !cal.isDate(displayedMonth, equalTo: Date(), toGranularity: .month) {
                    Button("Gå til i dag") {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            displayedMonth = firstOfMonth(Date())
                            selectedDate = Date()
                        }
                    }
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(LDP.textDim)
                    .buttonStyle(.plain)
                }
            }
            Spacer()
            navButton("chevron.right") { shiftMonth(by: 1) }
        }
    }

    private func navButton(_ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(LDP.cardHi, in: Circle())
                .overlay(Circle().strokeBorder(LDP.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { i in
                Text(weekdaySymbols[i])
                    .font(.appScaled(size: 10, weight: .black, design: .rounded))
                    .tracking(0.6)
                    .foregroundStyle(LDP.textDim)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var calendarGrid: some View {
        let days = daysInDisplayedMonth()
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
            ForEach(days.indices, id: \.self) { i in
                dayCell(days[i])
            }
        }
    }

    private func dayCell(_ day: DayCell) -> some View {
        let isToday = day.date.map { cal.isDateInToday($0) } ?? false
        let isSelected = day.date.map { cal.isDate($0, inSameDayAs: selectedDate) } ?? false
        let indicator = day.date.flatMap { dayIndicators[cal.startOfDay(for: $0)] }
        return Button {
            if let d = day.date {
                withAnimation(.easeOut(duration: 0.15)) {
                    selectedDate = combineTime(d)
                }
            }
        } label: {
            ZStack {
                if isSelected {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [LDP.purple, LDP.purpleLight],
                                startPoint: .top, endPoint: .bottom
                            )
                        )
                        .shadow(color: LDP.purpleGlow, radius: 8)
                } else if isToday {
                    Circle()
                        .strokeBorder(LDP.purpleLight.opacity(0.5), lineWidth: 1.5)
                }
                Text(day.number)
                    .font(.appScaled(size: 14, weight: isSelected ? .heavy : (isToday ? .bold : .medium), design: .rounded))
                    .foregroundStyle(
                        day.date == nil
                            ? LDP.textTertiary
                            : (isSelected ? .white : (isToday ? .white : LDP.textDim))
                    )
                // Aktivitets-prikker som overlay i bunn — bevarer fast
                // cell-høyde 38pt (VStack med conditional Color.clear-spacer
                // trigget UIView-constraint-conflict på Mac Catalyst).
                if let ind = indicator, ind.hasAny {
                    activityDots(for: ind, selected: isSelected)
                        .frame(maxHeight: .infinity, alignment: .bottom)
                        .padding(.bottom, 2)
                }
            }
            .frame(height: 38)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(day.date == nil)
    }

    /// Opptil 3 prikker: lilla = møter, blå = oppfølginger. Selected-dagen
    /// får hvit fyll så prikkene ikke drukner i gradient-en.
    private func activityDots(for indicator: LeadgridDayIndicator, selected: Bool) -> some View {
        let meetingColor: Color = selected ? .white : LDP.purpleLight
        let followUpColor: Color = selected ? .white.opacity(0.85) : Color(red: 0.34, green: 0.60, blue: 0.98)
        return HStack(spacing: 3) {
            if indicator.meetings > 0 {
                Circle().fill(meetingColor).frame(width: 5, height: 5)
            }
            if indicator.followUps > 0 {
                Circle().fill(followUpColor).frame(width: 5, height: 5)
            }
            // Ekstra prikk hvis høy tetthet
            if indicator.meetings + indicator.followUps >= 3 {
                Circle().fill(meetingColor).frame(width: 5, height: 5)
            }
        }
        .frame(height: 6)
    }

    /// Legend under kalenderen som forklarer hva prikkene betyr. Vises
    /// bare hvis vi har noen aktiviteter i den viste måneden.
    private var indicatorLegend: some View {
        HStack(spacing: 14) {
            HStack(spacing: 5) {
                Circle().fill(LDP.purpleLight).frame(width: 6, height: 6)
                Text("Møte")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(LDP.textDim)
            }
            HStack(spacing: 5) {
                Circle().fill(Color(red: 0.34, green: 0.60, blue: 0.98)).frame(width: 6, height: 6)
                Text("Oppfølging")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(LDP.textDim)
            }
            Spacer()
        }
    }

    /// Er det noen aktivitet i den viste måneden?
    private var hasIndicatorsThisMonth: Bool {
        for (date, ind) in dayIndicators where ind.hasAny {
            if cal.isDate(date, equalTo: displayedMonth, toGranularity: .month) {
                return true
            }
        }
        return false
    }

    private var dateShortcutsBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("HURTIGVALG")
                .font(.appScaled(size: 9, weight: .black, design: .rounded))
                .tracking(1.0)
                .foregroundStyle(LDP.textDim)
            HStack(spacing: 6) {
                quickChip("I dag", days: 0)
                quickChip("I morgen", days: 1)
                quickChip("+3 dg", days: 3)
                quickChip("+1 uke", days: 7)
                quickChip("+1 mnd", days: 30)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func quickChip(_ label: String, days: Int) -> some View {
        Button {
            let base = cal.startOfDay(for: Date().addingTimeInterval(TimeInterval(days) * 86400))
            let picked = combineTime(base)
            withAnimation(.easeOut(duration: 0.2)) {
                selectedDate = picked
                displayedMonth = firstOfMonth(picked)
            }
        } label: {
            Text(label)
                .font(.appScaled(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(LDP.cardHi, in: Capsule())
                .overlay(Capsule().strokeBorder(LDP.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    /// Handlinger som forkorter vanlige oppgaver — «Book møte», «Ny
    /// oppfølging», «Ny lead» osv. Ved tap: fyrer selve action-callback-en
    /// med den for øyeblikket valgte datoen, og lukker sheeten.
    private var calendarActionButtons: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("HANDLING")
                .font(.appScaled(size: 9, weight: .black, design: .rounded))
                .tracking(1.0)
                .foregroundStyle(LDP.textDim)
            VStack(spacing: 6) {
                ForEach(quickActions) { action in
                    calendarActionRow(action)
                }
            }
        }
    }

    private func calendarActionRow(_ action: LeadgridCalendarAction) -> some View {
        Button {
            action.onSelect(combineTime(selectedDate))
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(action.color.opacity(0.20))
                    Image(systemName: action.icon)
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(action.color)
                }
                .frame(width: 36, height: 36)
                .overlay(Circle().strokeBorder(action.color.opacity(0.35), lineWidth: 1))
                Text(action.title)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(LDP.textTertiary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(LDP.cardHi, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(LDP.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var timePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TIDSPUNKT")
                .font(.appScaled(size: 9, weight: .black, design: .rounded))
                .tracking(1.0)
                .foregroundStyle(LDP.textDim)
            HStack(spacing: 10) {
                // Timer-picker
                Menu {
                    ForEach(0..<24, id: \.self) { h in
                        Button {
                            selectedHour = h
                            selectedDate = combineTime(selectedDate)
                        } label: {
                            Text(String(format: "%02d:00", h))
                        }
                    }
                } label: {
                    timeChip(
                        value: String(format: "%02d", selectedHour),
                        label: "TIME"
                    )
                }
                Text(":")
                    .font(.appScaled(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                // Minutt-picker (15-minutters intervall)
                Menu {
                    ForEach([0, 15, 30, 45], id: \.self) { m in
                        Button {
                            selectedMinute = m
                            selectedDate = combineTime(selectedDate)
                        } label: {
                            Text(String(format: ":%02d", m))
                        }
                    }
                } label: {
                    timeChip(
                        value: String(format: "%02d", selectedMinute),
                        label: "MIN"
                    )
                }
                Spacer()
                // Snarveier
                HStack(spacing: 6) {
                    timeSnippet("09:00", h: 9, m: 0)
                    timeSnippet("12:00", h: 12, m: 0)
                    timeSnippet("15:00", h: 15, m: 0)
                }
            }
        }
    }

    private func timeChip(value: String, label: String) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.appScaled(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(.appScaled(size: 8, weight: .black, design: .rounded))
                .tracking(0.8)
                .foregroundStyle(LDP.textDim)
        }
        .frame(width: 68, height: 60)
        .background(LDP.cardHi, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(LDP.stroke, lineWidth: 1))
    }

    private func timeSnippet(_ text: String, h: Int, m: Int) -> some View {
        Button {
            selectedHour = h
            selectedMinute = m
            selectedDate = combineTime(selectedDate)
        } label: {
            Text(text)
                .font(.appScaled(size: 10, weight: .bold, design: .rounded))
                .foregroundStyle(LDP.purpleLight)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(LDP.purple.opacity(0.15), in: Capsule())
                .overlay(Capsule().strokeBorder(LDP.purple.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private struct DayCell: Identifiable {
        let id = UUID()
        let number: String
        let date: Date? // nil = padding-cell før månedsstart
    }

    private func daysInDisplayedMonth() -> [DayCell] {
        let range = cal.range(of: .day, in: .month, for: displayedMonth) ?? 1..<32
        let firstDay = firstOfMonth(displayedMonth)
        let leading = (cal.component(.weekday, from: firstDay) - cal.firstWeekday + 7) % 7
        var cells: [DayCell] = []
        for _ in 0..<leading { cells.append(DayCell(number: "", date: nil)) }
        for day in range {
            if let d = cal.date(byAdding: .day, value: day - 1, to: firstDay) {
                cells.append(DayCell(number: "\(day)", date: d))
            }
        }
        // Pad slutten så vi alltid har hele uker
        while cells.count % 7 != 0 {
            cells.append(DayCell(number: "", date: nil))
        }
        return cells
    }

    private func firstOfMonth(_ date: Date) -> Date {
        let comps = cal.dateComponents([.year, .month], from: date)
        return cal.date(from: DateComponents(year: comps.year, month: comps.month, day: 1)) ?? date
    }

    private func shiftMonth(by delta: Int) {
        if let d = cal.date(byAdding: .month, value: delta, to: displayedMonth) {
            withAnimation(.easeInOut(duration: 0.25)) {
                displayedMonth = d
            }
        }
    }

    private func combineTime(_ base: Date) -> Date {
        let comps = cal.dateComponents([.year, .month, .day], from: base)
        var out = DateComponents(
            year: comps.year, month: comps.month, day: comps.day,
            hour: selectedHour, minute: selectedMinute
        )
        return cal.date(from: out) ?? base
    }

    private func monthYearString() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        f.dateFormat = "LLLL yyyy"
        return f.string(from: displayedMonth)
    }

    private func confirm() {
        onConfirm(combineTime(selectedDate))
    }
}
