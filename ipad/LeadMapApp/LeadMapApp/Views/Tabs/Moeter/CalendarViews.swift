// CalendarViews.swift
//
// Kalender-modes for Møter-fanen:
//   - Agenda (dagens liste — eksisterende oppførsel)
//   - Dag      (time-grid 07-19 m/ meetings posisjonert + nå-linje)
//   - Uke      (5-dagers grid, time-rows m/ event-blokker)
//   - Måned    (4-6 ukers grid m/ event-count pr. dag)

import SwiftUI

enum CalendarMode: String, CaseIterable, Hashable {
    case agenda = "Agenda"
    case day    = "Dag"
    case week   = "Uke"
    case month  = "Måned"
    var icon: String {
        switch self {
        case .agenda: return "list.bullet.rectangle"
        case .day:    return "calendar.day.timeline.left"
        case .week:   return "calendar"
        case .month:  return "calendar.badge.clock"
        }
    }
}

private enum CBrand {
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

// MARK: - CalendarModePicker (segmented header)

struct CalendarModePicker: View {
    @Binding var mode: CalendarMode

    // iPhone: kompakt variant — kun ikoner. Med tekst-labels blir pickeren
    // bredere enn tilgjengelig plass i agenda-headeren, teksten klippes til
    // enkeltbokstaver og den valgte pillen overlapper nabo-segmentene.
    private var compact: Bool { DeviceIdiom.isPhone }

    var body: some View {
        HStack(spacing: 4) {
            ForEach(CalendarMode.allCases, id: \.self) { m in
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { mode = m }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: m.icon)
                            .font(.appScaled(size: compact ? 13 : 10, weight: .bold))
                        if !compact {
                            Text(m.rawValue)
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                    }
                    .foregroundStyle(mode == m ? .white : CBrand.textSecondary)
                    .padding(.horizontal, compact ? 9 : 10).padding(.vertical, 6)
                    .background(
                        mode == m ? AnyShapeStyle(CBrand.purple) : AnyShapeStyle(Color.clear),
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(m.rawValue))
            }
        }
        .padding(3)
        .background(CBrand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(CBrand.stroke, lineWidth: 1))
        // Intrinsisk bredde på iPhone — hindrer at headeren komprimerer
        // pickeren slik at segmentene legger seg oppå hverandre.
        .fixedSize(horizontal: compact, vertical: false)
    }
}

// MARK: - DayCalendarView (07-19 timer)

struct DayCalendarView: View {
    let meetings: [Meeting]                 // dagens møter
    let onTap: (Meeting) -> Void
    @State private var selectedID: UUID?

    private let startHour = 7
    private let endHour = 19
    private let rowHeight: CGFloat = 56     // px pr. time

    // Simulert "nå" — 10:20 i dag
    private let nowHour = 10
    private let nowMinute = 20

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            ZStack(alignment: .topLeading) {
                hourGrid
                meetingBlocks
                nowLine
            }
            .frame(height: CGFloat(endHour - startHour + 1) * rowHeight + 8)
        }
        .frame(maxHeight: 480)
    }

    private var hourGrid: some View {
        VStack(spacing: 0) {
            ForEach(startHour...endHour, id: \.self) { h in
                HStack(alignment: .top, spacing: 0) {
                    Text(String(format: "%02d:00", h))
                        .font(.appScaled(size: 10, weight: .semibold, design: .rounded))
                        .foregroundStyle(CBrand.textTertiary)
                        .monospacedDigit()
                        .frame(width: 44, alignment: .trailing)
                        .padding(.trailing, 8)
                        .padding(.top, -4)
                    Rectangle()
                        .fill(CBrand.stroke)
                        .frame(height: 1)
                        .frame(maxWidth: .infinity)
                }
                .frame(height: rowHeight, alignment: .top)
            }
        }
    }

    @ViewBuilder
    private var meetingBlocks: some View {
        GeometryReader { geo in
            ForEach(meetings) { m in
                let (top, height) = position(for: m)
                Button { onTap(m) } label: {
                    meetingBlock(m, isSelected: selectedID == m.id)
                }
                .buttonStyle(.plain)
                .frame(width: max(20, geo.size.width - 60), height: height)
                .offset(x: 60, y: top)
                .simultaneousGesture(TapGesture().onEnded { selectedID = m.id })
            }
        }
    }

    private func meetingBlock(_ m: Meeting, isSelected: Bool) -> some View {
        let hour = Int(m.startTime.split(separator: ":").first ?? "0") ?? 0
        let endH = Int(m.endTime.split(separator: ":").first ?? "0") ?? hour + 1
        let durationMin = max(30, (endH - hour) * 60)
        let isCompact = durationMin < 50

        return HStack(spacing: 8) {
            // Venstre fargestripe
            RoundedRectangle(cornerRadius: 2)
                .fill(m.iconColor)
                .frame(width: 4)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Image(systemName: m.icon)
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(m.iconColor)
                    Text(m.company)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if !isCompact {
                        Spacer()
                        Text("\(m.startTime)–\(m.endTime)")
                            .font(.appScaled(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(CBrand.textSecondary)
                            .monospacedDigit()
                    }
                }
                if !isCompact {
                    Text("\(m.contactName) · \(m.location)")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(CBrand.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if isCompact {
                Text("\(m.startTime)")
                    .font(.appScaled(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(CBrand.textTertiary)
                    .monospacedDigit()
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(m.iconColor.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(m.iconColor.opacity(isSelected ? 0.9 : 0.45), lineWidth: isSelected ? 2 : 1)
        )
        .shadow(color: isSelected ? m.iconColor.opacity(0.4) : .clear, radius: 8)
    }

    private func position(for m: Meeting) -> (top: CGFloat, height: CGFloat) {
        let parts = m.startTime.split(separator: ":")
        let h = Int(parts.first ?? "0") ?? 0
        let mins = Int(parts.last ?? "0") ?? 0
        let endParts = m.endTime.split(separator: ":")
        let eh = Int(endParts.first ?? "0") ?? h + 1
        let em = Int(endParts.last ?? "0") ?? 0

        let startMinutes = CGFloat((h - startHour) * 60 + mins)
        let endMinutes = CGFloat((eh - startHour) * 60 + em)
        let pixelsPerMin = rowHeight / 60.0
        let top = startMinutes * pixelsPerMin
        let height = max(28, (endMinutes - startMinutes) * pixelsPerMin - 2)
        return (top, height)
    }

    private var nowLine: some View {
        let totalMin = CGFloat((nowHour - startHour) * 60 + nowMinute)
        let y = totalMin * (rowHeight / 60.0)
        return HStack(spacing: 0) {
            Text(String(format: "%02d:%02d", nowHour, nowMinute))
                .font(.appScaled(size: 9, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .padding(.horizontal, 5).padding(.vertical, 1)
                .background(CBrand.red, in: Capsule())
                .frame(width: 44, alignment: .center)
                .padding(.trailing, 8)
                .offset(y: -7)
            ZStack(alignment: .leading) {
                Rectangle().fill(CBrand.red).frame(height: 2)
                Circle().fill(CBrand.red).frame(width: 9, height: 9).offset(x: -4)
            }
        }
        .offset(y: y)
    }
}

// MARK: - WeekCalendarView (5 dager × 12 timer)

struct WeekCalendarView: View {
    let meetings: [Meeting]                 // dagens (mandag-fredag mock)
    let upcoming: [UpcomingMeetingMini]     // resten av uka
    let onTapMeeting: (Meeting) -> Void
    let onTapUpcoming: (UpcomingMeetingMini) -> Void

    private let startHour = 8
    private let endHour = 18
    private let rowHeight: CGFloat = 32
    private let weekDays = ["Man", "Tir", "Ons", "Tor", "Fre"]
    private let weekDates = [19, 20, 21, 22, 23]  // mai
    private let todayIndex = 1                     // tirsdag 20. mai

    var body: some View {
        VStack(spacing: 0) {
            dayHeader
            Divider().overlay(CBrand.stroke)
            ScrollView(.vertical, showsIndicators: false) {
                ZStack(alignment: .topLeading) {
                    hourGrid
                    weekEventBlocks
                }
                .frame(height: CGFloat(endHour - startHour + 1) * rowHeight)
            }
            .frame(maxHeight: 460)
        }
    }

    private var dayHeader: some View {
        HStack(spacing: 0) {
            Color.clear.frame(width: 44).padding(.trailing, 8)
            ForEach(0..<weekDays.count, id: \.self) { i in
                VStack(spacing: 2) {
                    Text(weekDays[i].uppercased())
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(i == todayIndex ? CBrand.purpleLight : CBrand.textSecondary)
                        .tracking(0.5)
                    ZStack {
                        if i == todayIndex {
                            Circle().fill(CBrand.purple)
                                .frame(width: 22, height: 22)
                        }
                        Text("\(weekDates[i])")
                            .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(i == todayIndex ? .white : .white)
                            .monospacedDigit()
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 8)
    }

    private var hourGrid: some View {
        VStack(spacing: 0) {
            ForEach(startHour...endHour, id: \.self) { h in
                HStack(alignment: .top, spacing: 0) {
                    Text(String(format: "%02d", h))
                        .font(.appScaled(size: 9, weight: .semibold, design: .rounded))
                        .foregroundStyle(CBrand.textTertiary)
                        .monospacedDigit()
                        .frame(width: 44, alignment: .trailing)
                        .padding(.trailing, 8)
                        .padding(.top, -3)
                    ZStack {
                        // Topp-grid
                        VStack { Rectangle().fill(CBrand.stroke).frame(height: 1); Spacer() }
                        // Vertikal kolonne-skille
                        HStack(spacing: 0) {
                            ForEach(0..<weekDays.count, id: \.self) { _ in
                                Rectangle().fill(.clear)
                                    .frame(maxWidth: .infinity)
                                    .overlay(Rectangle().fill(CBrand.stroke).frame(width: 1), alignment: .trailing)
                            }
                        }
                    }
                }
                .frame(height: rowHeight, alignment: .top)
            }
        }
    }

    @ViewBuilder
    private var weekEventBlocks: some View {
        GeometryReader { geo in
            let colWidth = (geo.size.width - 60) / CGFloat(weekDays.count)
            // I dag's meetings (todayIndex = tirsdag)
            ForEach(meetings) { m in
                let (top, height) = position(for: m)
                Button { onTapMeeting(m) } label: {
                    weekBlock(company: m.company, color: m.iconColor, icon: m.icon, time: m.startTime)
                }
                .buttonStyle(.plain)
                .frame(width: colWidth - 4, height: height)
                .offset(x: 60 + CGFloat(todayIndex) * colWidth + 2, y: top)
            }
            // Onsdag-fredag upcoming
            ForEach(upcoming) { u in
                if let col = weekDayCol(for: u.dayLabel) {
                    let (top, height) = positionUpcoming(u)
                    Button { onTapUpcoming(u) } label: {
                        weekBlock(company: u.company, color: u.iconColor, icon: u.icon, time: u.time)
                    }
                    .buttonStyle(.plain)
                    .frame(width: colWidth - 4, height: height)
                    .offset(x: 60 + CGFloat(col) * colWidth + 2, y: top)
                }
            }
        }
    }

    private func weekBlock(company: String, color: Color, icon: String, time: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.appScaled(size: 8, weight: .bold))
                    .foregroundStyle(color)
                Text(time)
                    .font(.appScaled(size: 9, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            Text(company)
                .font(.appScaled(size: 9, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
        }
        .padding(.horizontal, 5).padding(.vertical, 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(color.opacity(0.22), in: RoundedRectangle(cornerRadius: 5))
        .overlay(
            RoundedRectangle(cornerRadius: 5)
                .stroke(color.opacity(0.55), lineWidth: 1)
        )
        .overlay(
            // Venstre stripe
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 3),
            alignment: .leading
        )
    }

    private func position(for m: Meeting) -> (top: CGFloat, height: CGFloat) {
        let h = Int(m.startTime.split(separator: ":").first ?? "0") ?? 0
        let mins = Int(m.startTime.split(separator: ":").last ?? "0") ?? 0
        let eh = Int(m.endTime.split(separator: ":").first ?? "0") ?? h + 1
        let em = Int(m.endTime.split(separator: ":").last ?? "0") ?? 0
        let startMin = CGFloat((h - startHour) * 60 + mins)
        let endMin = CGFloat((eh - startHour) * 60 + em)
        let ppm = rowHeight / 60.0
        return (startMin * ppm, max(20, (endMin - startMin) * ppm - 1))
    }

    private func positionUpcoming(_ u: UpcomingMeetingMini) -> (top: CGFloat, height: CGFloat) {
        let h = Int(u.time.split(separator: ":").first ?? "0") ?? 0
        let mins = Int(u.time.split(separator: ":").last ?? "0") ?? 0
        let eh = Int(u.endTime.split(separator: ":").first ?? "0") ?? h + 1
        let em = Int(u.endTime.split(separator: ":").last ?? "0") ?? 0
        let startMin = CGFloat((h - startHour) * 60 + mins)
        let endMin = CGFloat((eh - startHour) * 60 + em)
        let ppm = rowHeight / 60.0
        return (startMin * ppm, max(20, (endMin - startMin) * ppm - 1))
    }

    private func weekDayCol(for dayLabel: String) -> Int? {
        if dayLabel.contains("21") { return 2 }   // Ons
        if dayLabel.contains("22") { return 3 }   // Tor
        if dayLabel.contains("23") { return 4 }   // Fre
        return nil
    }
}

// MARK: - MonthCalendarView (5 ukers grid)

struct MonthCalendarView: View {
    let meetings: [Meeting]
    let upcoming: [UpcomingMeetingMini]
    var onBookMeeting: (Int) -> Void = { _ in }
    @State private var selectedDay: Int? = 20

    private let weekdayLabels = ["M", "T", "O", "T", "F", "L", "S"]
    private let monthName = "Mai 2026"
    // Mock: mai 2026 starter på onsdag → første rad: _ _ 1 2 3 4 5
    private let firstWeekdayOffset = 2   // 0=man, 2=ons
    private let daysInMonth = 31
    private let today = 20

    private var weeks: [[Int?]] {
        var cells: [Int?] = Array(repeating: nil, count: firstWeekdayOffset)
        cells.append(contentsOf: (1...daysInMonth).map { Optional($0) })
        while cells.count % 7 != 0 { cells.append(nil) }
        return stride(from: 0, to: cells.count, by: 7).map { Array(cells[$0..<min($0+7, cells.count)]) }
    }

    // Count events pr dag (mock: 20=5, 21=2, 22=2, 23=1, ellers 0-1)
    private func eventCount(_ day: Int) -> Int {
        if day == today { return meetings.count }
        if day == 21 { return 2 }
        if day == 22 { return 2 }
        if day == 23 { return 1 }
        if [6, 13, 27].contains(day) { return 1 }
        if [8, 15].contains(day) { return 3 }
        if [16].contains(day) { return 2 }
        return 0
    }

    private func eventValue(_ day: Int) -> Int {
        let c = eventCount(day)
        return c * 250_000  // mock kr/møte
    }

    var body: some View {
        VStack(spacing: 8) {
            monthHeader
            weekdayHeader
            VStack(spacing: 4) {
                ForEach(weeks.indices, id: \.self) { wi in
                    weekRow(weeks[wi])
                }
            }
            if let d = selectedDay { dayDetailFooter(d) }
        }
    }

    private var monthHeader: some View {
        HStack {
            Button {} label: {
                Image(systemName: "chevron.left")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(CBrand.purpleLight)
                    .padding(7)
                    .background(CBrand.cardHi, in: Circle())
            }
            .buttonStyle(.plain)
            Spacer()
            Text(monthName)
                .font(.appScaled(size: 14, weight: .bold))
                .foregroundStyle(.white)
            Spacer()
            Button {} label: {
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(CBrand.purpleLight)
                    .padding(7)
                    .background(CBrand.cardHi, in: Circle())
            }
            .buttonStyle(.plain)
        }
    }

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(0..<weekdayLabels.count, id: \.self) { i in
                Text(weekdayLabels[i])
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(i >= 5 ? CBrand.textTertiary : CBrand.textSecondary)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private func weekRow(_ week: [Int?]) -> some View {
        HStack(spacing: 4) {
            ForEach(week.indices, id: \.self) { i in
                if let d = week[i] {
                    dayCell(d, isWeekend: i >= 5)
                } else {
                    Color.clear.frame(maxWidth: .infinity, minHeight: 56)
                }
            }
        }
    }

    private func dayCell(_ day: Int, isWeekend: Bool) -> some View {
        let isToday = day == today
        let isSelected = day == selectedDay
        let count = eventCount(day)
        return Button {
            withAnimation(.easeInOut(duration: 0.18)) { selectedDay = day }
        } label: {
            VStack(spacing: 3) {
                ZStack {
                    if isToday {
                        Circle().fill(CBrand.purple).frame(width: 26, height: 26)
                    }
                    Text("\(day)")
                        .font(.appScaled(size: 13, weight: isToday ? .black : .bold, design: .rounded))
                        .foregroundStyle(isToday ? .white : (isWeekend ? CBrand.textSecondary : .white))
                        .monospacedDigit()
                }
                .frame(height: 28)
                // Event-dots
                HStack(spacing: 2) {
                    ForEach(0..<min(count, 3), id: \.self) { i in
                        Circle()
                            .fill(eventDotColor(day: day, index: i))
                            .frame(width: 4, height: 4)
                    }
                    if count > 3 {
                        Text("+\(count - 3)")
                            .font(.appScaled(size: 7, weight: .black, design: .rounded))
                            .foregroundStyle(CBrand.textSecondary)
                            .monospacedDigit()
                    }
                }
                .frame(height: 8)
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(
                isSelected
                    ? AnyShapeStyle(CBrand.purple.opacity(0.18))
                    : AnyShapeStyle(Color.clear),
                in: RoundedRectangle(cornerRadius: 8)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? CBrand.purple.opacity(0.5) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func eventDotColor(day: Int, index: Int) -> Color {
        if day == today {
            let colors: [Color] = [CBrand.purpleLight, CBrand.blue, CBrand.green, CBrand.orange, CBrand.red]
            return colors[index % colors.count]
        }
        return [CBrand.green, CBrand.blue, CBrand.purpleLight][index % 3]
    }

    @ViewBuilder
    private func dayDetailFooter(_ day: Int) -> some View {
        let count = eventCount(day)
        let value = eventValue(day)
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(CBrand.purple.opacity(0.22))
                Text("\(day)")
                    .font(.appScaled(size: 13, weight: .black, design: .rounded))
                    .foregroundStyle(CBrand.purpleLight)
                    .monospacedDigit()
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(day == today ? "I dag · 20. mai" : "\(day). mai")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Text(count == 0 ? "Ingen møter" : "\(count) møte\(count == 1 ? "" : "r") · NOK \(value/1000)k forventet")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(CBrand.textSecondary)
            }
            Spacer()
            Button { onBookMeeting(day) } label: {
                HStack(spacing: 5) {
                    Image(systemName: "plus")
                        .font(.appScaled(size: 10, weight: .bold))
                    Text("Bok møte")
                        .font(.appScaled(size: 11, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(
                    LinearGradient(colors: [CBrand.purple, CBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Capsule()
                )
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(CBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(CBrand.stroke, lineWidth: 1))
    }
}
