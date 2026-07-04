// MenuActionSheets.swift
//
// 5 nye sheets for Møter-sidebar-menuen:
//   - RescheduleSheet      (Endre tidspunkt — kalender + time-picker + varsle)
//   - StatusPickerSheet    (Endre status — 5 statuser m/ ikon + farge)
//   - CancelMeetingSheet   (Avlys møte — grunn-picker + varsle kontakt + bekreft)
//   - AssignSellerSheet    (Tilordne selger — liste m/ team-medlemmer + søk)
//   - AddToCampaignSheet   (Legg til i kampanje — liste m/ aktive kampanjer)

import SwiftUI

private enum MABrand {
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
    static let textSecondary = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.35)
}

// MARK: - RescheduleSheet

struct RescheduleSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var newDate = Date().addingTimeInterval(86_400)  // i morgen
    @State private var startHour = 10
    @State private var startMinute = 0
    @State private var duration = 60
    @State private var notify = true
    @State private var reason = ""

    private let hours = Array(7...19)
    private let minutes = [0, 15, 30, 45]
    private let durations = [30, 45, 60, 90, 120]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    currentCard
                    datePickerCard
                    timePickerCard
                    durationCard
                    notifyCard
                    reasonCard
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(MABrand.bg.ignoresSafeArea())
            .navigationTitle("Endre tidspunkt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(MABrand.purpleLight)
                }
            }
            .toolbarBackground(MABrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { saveBar }
        }
    }

    private var currentCard: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Nåværende: Tir 20. mai · \(meeting.startTime)–\(meeting.endTime)")
                    .font(.system(size: 11))
                    .foregroundStyle(MABrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
    }

    private var datePickerCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Ny dato")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            DatePicker("", selection: $newDate, in: Date()..., displayedComponents: .date)
                .datePickerStyle(.graphical)
                .tint(MABrand.purple)
                .colorScheme(.dark)
                .padding(8)
                .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
        }
    }

    private var timePickerCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Start-tid")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            HStack(spacing: 0) {
                Picker("", selection: $startHour) {
                    ForEach(hours, id: \.self) { Text(String(format: "%02d", $0)).foregroundStyle(.white) }
                }
                .pickerStyle(.wheel)
                .frame(maxHeight: 100)
                Text(":")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                Picker("", selection: $startMinute) {
                    ForEach(minutes, id: \.self) { Text(String(format: "%02d", $0)).foregroundStyle(.white) }
                }
                .pickerStyle(.wheel)
                .frame(maxHeight: 100)
            }
            .padding(.horizontal, 8)
            .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
        }
    }

    private var durationCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Varighet")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            HStack(spacing: 6) {
                ForEach(durations, id: \.self) { d in
                    Button {
                        withAnimation { duration = d }
                    } label: {
                        Text(d >= 60 ? "\(d/60) t\(d%60 > 0 ? " \(d%60) m" : "")" : "\(d) min")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(duration == d ? .white : MABrand.purpleLight)
                            .padding(.horizontal, 11).padding(.vertical, 8)
                            .background(
                                duration == d ? AnyShapeStyle(MABrand.purple) : AnyShapeStyle(MABrand.purple.opacity(0.15)),
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(MABrand.purple.opacity(duration == d ? 0 : 0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var notifyCard: some View {
        Toggle(isOn: $notify) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(MABrand.green.opacity(0.22))
                    Image(systemName: "bell.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(MABrand.green)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Varsle kontakten")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Sender e-post + invitt-oppdatering til \(meeting.contactName)")
                        .font(.system(size: 10))
                        .foregroundStyle(MABrand.textSecondary)
                }
            }
        }
        .tint(MABrand.purple)
        .padding(11)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
    }

    private var reasonCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Grunn (valgfritt)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $reason)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .frame(minHeight: 70)
                    .padding(8)
                    .background(MABrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
                if reason.isEmpty {
                    Text("F.eks. «Konflikt med annet møte»")
                        .font(.system(size: 12))
                        .foregroundStyle(MABrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var saveBar: some View {
        HStack(spacing: 10) {
            Button { dismiss() } label: {
                Text("Avbryt")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: 110)
                    .padding(.vertical, 13)
                    .background(MABrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { dismiss() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "calendar.badge.checkmark")
                        .font(.system(size: 13, weight: .bold))
                    Text("Lagre ny tid")
                        .font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(colors: [MABrand.purple, MABrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(MABrand.bg.opacity(0.95).overlay(Rectangle().fill(MABrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - StatusPickerSheet

struct StatusPickerSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var status: Meeting.Status
    @State private var note: String = ""

    init(meeting: Meeting) {
        self.meeting = meeting
        _status = State(initialValue: meeting.status)
    }

    private let statuses: [Meeting.Status] = [.confirmed, .onTheWay, .followUp, .pending, .cancelled]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    VStack(spacing: 6) {
                        ForEach(statuses, id: \.self) { s in
                            statusRow(s)
                        }
                    }
                    noteCard
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(MABrand.bg.ignoresSafeArea())
            .navigationTitle("Endre status")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(MABrand.purpleLight)
                }
            }
            .toolbarBackground(MABrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { confirmBar }
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Nåværende status: \(meeting.status.label)")
                    .font(.system(size: 11))
                    .foregroundStyle(meeting.status.color)
            }
            Spacer()
        }
        .padding(12)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
    }

    private func statusRow(_ s: Meeting.Status) -> some View {
        let isSelected = status == s
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { status = s }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(s.color.opacity(isSelected ? 0.35 : 0.18))
                    Image(systemName: statusIcon(s))
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(s.color)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text(s.label)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(statusDescription(s))
                        .font(.system(size: 11))
                        .foregroundStyle(MABrand.textSecondary)
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 17))
                    .foregroundStyle(isSelected ? s.color : MABrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? s.color.opacity(0.08) : MABrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? s.color.opacity(0.5) : MABrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func statusIcon(_ s: Meeting.Status) -> String {
        switch s {
        case .confirmed: return "checkmark.seal.fill"
        case .onTheWay:  return "car.fill"
        case .followUp:  return "arrow.triangle.2.circlepath"
        case .pending:   return "hourglass"
        case .cancelled: return "xmark.octagon.fill"
        }
    }

    private func statusDescription(_ s: Meeting.Status) -> String {
        switch s {
        case .confirmed: return "Møtet er bekreftet av begge parter"
        case .onTheWay:  return "På vei — kontakten er informert"
        case .followUp:  return "Krever oppfølging etter forrige interaksjon"
        case .pending:   return "Venter på bekreftelse"
        case .cancelled: return "Møtet er avlyst"
        }
    }

    private var noteCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Notat (valgfritt)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $note)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .frame(minHeight: 60)
                    .padding(8)
                    .background(MABrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
                if note.isEmpty {
                    Text("Hvorfor endrer du status?")
                        .font(.system(size: 12))
                        .foregroundStyle(MABrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var confirmBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 14, weight: .bold))
                Text("Sett status: \(status.label)")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [status.color, status.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(MABrand.bg.opacity(0.95).overlay(Rectangle().fill(MABrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - CancelMeetingSheet

struct CancelMeetingSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var reason: CancelReason = .conflict
    @State private var customReason: String = ""
    @State private var notify: Bool = true
    @State private var suggestNew: Bool = true

    enum CancelReason: String, CaseIterable, Hashable {
        case conflict = "Konflikt med annet møte"
        case sick = "Sykdom"
        case noShow = "Kontakt møtte ikke / svarer ikke"
        case noLongerNeeded = "Ikke lenger relevant"
        case other = "Annet (skriv inn)"
        var icon: String {
            switch self {
            case .conflict:        return "calendar.badge.exclamationmark"
            case .sick:            return "thermometer.medium"
            case .noShow:          return "person.crop.circle.badge.xmark"
            case .noLongerNeeded:  return "xmark.circle.fill"
            case .other:           return "questionmark.circle.fill"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    warningBanner
                    meetingHeader
                    reasonsCard
                    if reason == .other { customReasonCard }
                    optionsCard
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(MABrand.bg.ignoresSafeArea())
            .navigationTitle("Avlys møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Behold møtet") { dismiss() }.foregroundStyle(MABrand.purpleLight)
                }
            }
            .toolbarBackground(MABrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { confirmBar }
        }
    }

    private var warningBanner: some View {
        HStack(spacing: 9) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(MABrand.red)
            VStack(alignment: .leading, spacing: 1) {
                Text("Dette kan ikke angres")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Text("Møtet flyttes til avlyste og prep-status nullstilles")
                    .font(.system(size: 10))
                    .foregroundStyle(MABrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(MABrand.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.red.opacity(0.40), lineWidth: 1))
    }

    private var meetingHeader: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Tir 20. mai · \(meeting.startTime)–\(meeting.endTime) · \(meeting.contactName)")
                    .font(.system(size: 11))
                    .foregroundStyle(MABrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
    }

    private var reasonsCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Grunn til avlysning")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            VStack(spacing: 5) {
                ForEach(CancelReason.allCases, id: \.self) { r in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { reason = r }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: r.icon)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(reason == r ? .white : MABrand.red)
                                .frame(width: 22)
                            Text(r.rawValue)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            Spacer()
                            Image(systemName: reason == r ? "largecircle.fill.circle" : "circle")
                                .font(.system(size: 16))
                                .foregroundStyle(reason == r ? MABrand.red : MABrand.stroke)
                        }
                        .padding(10)
                        .background(
                            reason == r ? MABrand.red.opacity(0.10) : MABrand.card,
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 10)
                            .stroke(reason == r ? MABrand.red.opacity(0.5) : MABrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var customReasonCard: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $customReason)
                .scrollContentBackground(.hidden)
                .foregroundStyle(.white)
                .font(.system(size: 12))
                .frame(minHeight: 70)
                .padding(8)
                .background(MABrand.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
            if customReason.isEmpty {
                Text("Skriv inn grunn…")
                    .font(.system(size: 12))
                    .foregroundStyle(MABrand.textTertiary)
                    .padding(.horizontal, 12).padding(.vertical, 14)
                    .allowsHitTesting(false)
            }
        }
    }

    private var optionsCard: some View {
        VStack(spacing: 8) {
            Toggle(isOn: $notify) {
                HStack(spacing: 8) {
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(MABrand.blue)
                    Text("Varsle \(meeting.contactName)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
            .tint(MABrand.purple)
            Divider().overlay(MABrand.stroke)
            Toggle(isOn: $suggestNew) {
                HStack(spacing: 8) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(MABrand.green)
                    Text("Foreslå nytt tidspunkt automatisk")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
            .tint(MABrand.purple)
        }
        .padding(11)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
    }

    private var confirmBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "xmark.octagon.fill")
                    .font(.system(size: 14, weight: .bold))
                Text("Avlys møtet")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [MABrand.red, Color(red: 0.75, green: 0.15, blue: 0.15)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(MABrand.bg.opacity(0.95).overlay(Rectangle().fill(MABrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - AssignSellerSheet

struct AssignSellerSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var search: String = ""
    @State private var selectedID: UUID?

    struct Seller: Identifiable, Hashable {
        let id = UUID()
        let name: String
        let role: String
        let initials: String
        let color: Color
        let load: Int        // antall aktive møter
        let winRate: Int     // %
        let online: Bool
    }

    private let sellers: [Seller] = [
        Seller(name: "Lars Kristensen", role: "Salgssjef",         initials: "LK", color: MABrand.purple,      load: 12, winRate: 64, online: true),
        Seller(name: "Anna Berg",       role: "Senior selger",     initials: "AB", color: MABrand.green,       load: 8,  winRate: 71, online: true),
        Seller(name: "Erik Nilsen",     role: "Account Executive", initials: "EN", color: MABrand.blue,        load: 15, winRate: 58, online: false),
        Seller(name: "Maja Solberg",    role: "Senior selger",     initials: "MS", color: MABrand.orange,      load: 6,  winRate: 78, online: true),
        Seller(name: "Tobias Wiig",     role: "SDR",               initials: "TW", color: MABrand.pink,        load: 22, winRate: 45, online: false),
    ]

    private var filtered: [Seller] {
        if search.isEmpty { return sellers }
        return sellers.filter { $0.name.lowercased().contains(search.lowercased()) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    searchBar
                    VStack(spacing: 7) {
                        ForEach(filtered) { s in
                            sellerRow(s)
                        }
                    }
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(MABrand.bg.ignoresSafeArea())
            .navigationTitle("Tilordne selger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(MABrand.purpleLight)
                }
            }
            .toolbarBackground(MABrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { assignBar }
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Tilordne ansvarlig selger for dette møtet")
                    .font(.system(size: 11))
                    .foregroundStyle(MABrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $search)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                if search.isEmpty {
                    Text("Søk selger…")
                        .font(.system(size: 13))
                        .foregroundStyle(MABrand.textTertiary)
                        .allowsHitTesting(false)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
    }

    private func sellerRow(_ s: Seller) -> some View {
        let isSelected = selectedID == s.id
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selectedID = s.id }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(s.color.opacity(0.85))
                    Text(s.initials)
                        .font(.system(size: 12, weight: .black))
                        .foregroundStyle(.white)
                    Circle()
                        .fill(s.online ? MABrand.green : MABrand.textTertiary)
                        .overlay(Circle().stroke(MABrand.card, lineWidth: 2))
                        .frame(width: 11, height: 11)
                        .offset(x: 14, y: 14)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.name)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 5) {
                        Text(s.role)
                            .font(.system(size: 10))
                            .foregroundStyle(MABrand.textSecondary)
                        Text("·")
                            .foregroundStyle(MABrand.textTertiary)
                        Text("\(s.load) aktive")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(MABrand.blue)
                            .monospacedDigit()
                    }
                }
                Spacer()
                // Win-rate-pill
                Text("\(s.winRate) %")
                    .font(.system(size: 11, weight: .black, design: .rounded))
                    .foregroundStyle(s.winRate >= 70 ? MABrand.green : s.winRate >= 60 ? MABrand.yellow : MABrand.orange)
                    .monospacedDigit()
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background((s.winRate >= 70 ? MABrand.green : s.winRate >= 60 ? MABrand.yellow : MABrand.orange).opacity(0.18), in: Capsule())
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 17))
                    .foregroundStyle(isSelected ? MABrand.purple : MABrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? MABrand.purple.opacity(0.10) : MABrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? MABrand.purple.opacity(0.50) : MABrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var assignBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "person.badge.plus.fill")
                    .font(.system(size: 13, weight: .bold))
                Text(selectedID == nil ? "Velg selger først" : "Tilordne valgte selger")
                    .font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: selectedID == nil
                                ? [MABrand.cardHi, MABrand.cardHi]
                                : [MABrand.purple, MABrand.purpleLight],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(selectedID == nil ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(selectedID == nil)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(MABrand.bg.opacity(0.95).overlay(Rectangle().fill(MABrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - AddToCampaignSheet

struct AddToCampaignSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var search: String = ""
    @State private var selectedIDs: Set<UUID> = []
    @State private var showCreateSheet: Bool = false

    struct Campaign: Identifiable, Hashable {
        let id = UUID()
        let name: String
        let kind: Kind
        let status: Status
        let leadsCount: Int
        let valueNok: Int
        let endDate: String
        enum Kind: String, CaseIterable, Hashable {
            case email = "E-post-sekvens"
            case nurture = "Nurture-flyt"
            case event = "Event"
            case productLaunch = "Produkt-lansering"
            var icon: String {
                switch self {
                case .email:         return "envelope.badge.fill"
                case .nurture:       return "drop.fill"
                case .event:         return "ticket.fill"
                case .productLaunch: return "sparkles.rectangle.stack.fill"
                }
            }
            var color: Color {
                switch self {
                case .email:         return MABrand.blue
                case .nurture:       return MABrand.green
                case .event:         return MABrand.purpleLight
                case .productLaunch: return MABrand.pink
                }
            }
        }
        enum Status: String, Hashable {
            case active = "Aktiv"
            case paused = "Pause"
            var color: Color {
                switch self {
                case .active: return MABrand.green
                case .paused: return MABrand.orange
                }
            }
        }
    }

    private let campaigns: [Campaign] = [
        Campaign(name: "Q2-løft: SMB-elektroentreprenører", kind: .nurture,       status: .active, leadsCount: 142, valueNok: 4_200_000, endDate: "30. juni"),
        Campaign(name: "Webinar: ERP-migrering 2026",        kind: .event,         status: .active, leadsCount: 87,  valueNok: 1_800_000, endDate: "12. juni"),
        Campaign(name: "AI-modulen 2.0 — early access",      kind: .productLaunch, status: .active, leadsCount: 56,  valueNok: 2_500_000, endDate: "5. juli"),
        Campaign(name: "Re-engasjer kalde leads >90 dager",   kind: .email,         status: .active, leadsCount: 234, valueNok: 0,          endDate: "Løpende"),
        Campaign(name: "Pilot: Bygg-bransjen (vinter 2026)",  kind: .nurture,       status: .paused, leadsCount: 41,  valueNok: 980_000,    endDate: "Pauset"),
    ]

    private var filtered: [Campaign] {
        if search.isEmpty { return campaigns }
        return campaigns.filter { $0.name.lowercased().contains(search.lowercased()) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    searchBar
                    Button { showCreateSheet = true } label: {
                        HStack(spacing: 7) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 13, weight: .bold))
                            Text("Opprett ny kampanje")
                                .font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(MABrand.purpleLight)
                        .padding(.vertical, 11)
                        .frame(maxWidth: .infinity)
                        .background(MABrand.purple.opacity(0.12), in: RoundedRectangle(cornerRadius: 11))
                        .overlay(
                            RoundedRectangle(cornerRadius: 11)
                                .stroke(MABrand.purple.opacity(0.40), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        )
                    }
                    .buttonStyle(.plain)
                    VStack(spacing: 7) {
                        ForEach(filtered) { c in
                            campaignRow(c)
                        }
                    }
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(MABrand.bg.ignoresSafeArea())
            .navigationTitle("Legg til i kampanje")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(MABrand.purpleLight)
                }
            }
            .toolbarBackground(MABrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { addBar }
            .sheet(isPresented: $showCreateSheet) {
                CreateCampaignSheet(seedLeadCompany: meeting.company)
            }
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Velg én eller flere kampanjer å legge leadet i")
                    .font(.system(size: 11))
                    .foregroundStyle(MABrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $search)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                if search.isEmpty {
                    Text("Søk kampanje…")
                        .font(.system(size: 13))
                        .foregroundStyle(MABrand.textTertiary)
                        .allowsHitTesting(false)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
    }

    private func campaignRow(_ c: Campaign) -> some View {
        let isSelected = selectedIDs.contains(c.id)
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                if isSelected { selectedIDs.remove(c.id) } else { _ = selectedIDs.insert(c.id) }
            }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(c.kind.color.opacity(0.22))
                    Image(systemName: c.kind.icon)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(c.kind.color)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(c.name)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        // Status-pill
                        Text(c.status.rawValue)
                            .font(.system(size: 8, weight: .black))
                            .foregroundStyle(c.status.color)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(c.status.color.opacity(0.18), in: Capsule())
                    }
                    HStack(spacing: 5) {
                        Text("\(c.leadsCount) leads")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(MABrand.textSecondary)
                            .monospacedDigit()
                        Text("·").foregroundStyle(MABrand.textTertiary)
                        if c.valueNok > 0 {
                            Text("NOK \(c.valueNok/1000)k")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundStyle(MABrand.green)
                                .monospacedDigit()
                            Text("·").foregroundStyle(MABrand.textTertiary)
                        }
                        Text(c.endDate)
                            .font(.system(size: 10))
                            .foregroundStyle(MABrand.textTertiary)
                    }
                }
                Spacer()
                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(isSelected ? MABrand.purple : Color.clear)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(isSelected ? MABrand.purple : MABrand.stroke, lineWidth: 1.5))
                    if isSelected {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 22, height: 22)
            }
            .padding(10)
            .background(
                isSelected ? MABrand.purple.opacity(0.10) : MABrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? MABrand.purple.opacity(0.45) : MABrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var addBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "megaphone.fill")
                    .font(.system(size: 13, weight: .bold))
                Text(selectedIDs.isEmpty
                     ? "Velg minst én kampanje"
                     : "Legg til i \(selectedIDs.count) kampanje\(selectedIDs.count == 1 ? "" : "r")")
                    .font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: selectedIDs.isEmpty
                                ? [MABrand.cardHi, MABrand.cardHi]
                                : [MABrand.purple, MABrand.purpleLight],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(selectedIDs.isEmpty ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(selectedIDs.isEmpty)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(MABrand.bg.opacity(0.95).overlay(Rectangle().fill(MABrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - CreateCampaignSheet

struct CreateCampaignSheet: View {
    let seedLeadCompany: String
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var kind: AddToCampaignSheet.Campaign.Kind = .nurture
    @State private var status: AddToCampaignSheet.Campaign.Status = .active
    @State private var description: String = ""
    @State private var startDate: Date = Date()
    @State private var endDate: Date = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
    @State private var hasEndDate: Bool = true
    @State private var owner: String = "Lars Kristensen"
    @State private var segmentMode: SegmentMode = .auto
    @State private var manualSegment: String = ""
    @State private var expectedValueK: Double = 500   // i tusen NOK
    @State private var addCurrentLead: Bool = true
    @State private var templateChosen: Template?

    enum SegmentMode: String, CaseIterable, Hashable {
        case auto = "AI-segment"
        case bransje = "Bransje"
        case manual = "Manuell"
        case allLeads = "Alle leads"
        var icon: String {
            switch self {
            case .auto:     return "sparkles"
            case .bransje:  return "building.2.fill"
            case .manual:   return "person.crop.circle.fill"
            case .allLeads: return "person.3.fill"
            }
        }
    }

    enum Template: String, CaseIterable, Hashable, Identifiable {
        case blank      = "Tom kampanje"
        case productLaunch = "Produkt-lansering (90 dgr)"
        case nurture30  = "Nurture 30-dager (5 e-poster)"
        case eventInvite = "Event-invitt"
        case winback    = "Re-engasjer kalde leads"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .blank:         return "doc"
            case .productLaunch: return "sparkles.rectangle.stack.fill"
            case .nurture30:     return "drop.fill"
            case .eventInvite:   return "ticket.fill"
            case .winback:       return "arrow.uturn.left.circle.fill"
            }
        }
        var color: Color {
            switch self {
            case .blank:         return MABrand.textSecondary
            case .productLaunch: return MABrand.pink
            case .nurture30:     return MABrand.green
            case .eventInvite:   return MABrand.purpleLight
            case .winback:       return MABrand.blue
            }
        }
        var beskrivelse: String {
            switch self {
            case .blank:         return "Start fra bunnen"
            case .productLaunch: return "Tease → reveal → demo → tilbud"
            case .nurture30:     return "Verdi → social proof → invitt"
            case .eventInvite:   return "Save the date → påminnelse → oppmøte"
            case .winback:       return "Vekk interesse for leads >90 dgr"
            }
        }
    }

    private var canSave: Bool { !name.isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    templatePicker
                    nameAndKindCard
                    descriptionCard
                    datesCard
                    segmentCard
                    valueCard
                    ownerStatusCard
                    addLeadCard
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(MABrand.bg.ignoresSafeArea())
            .navigationTitle("Ny kampanje")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(MABrand.purpleLight)
                }
            }
            .toolbarBackground(MABrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { saveBar }
        }
    }

    // MARK: Template-picker

    private var templatePicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Start fra mal")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 9) {
                    ForEach(Template.allCases) { t in
                        templateCard(t)
                    }
                }
            }
        }
    }

    private func templateCard(_ t: Template) -> some View {
        let isSelected = templateChosen == t
        return Button {
            withAnimation(.easeInOut(duration: 0.18)) {
                templateChosen = t
                // Auto-fyll basert på mal
                switch t {
                case .blank: name = ""; description = ""
                case .productLaunch:
                    name = "Produkt-lansering — Q3 2026"
                    kind = .productLaunch
                    description = "3 faser: tease, reveal, demo. 90 dager."
                case .nurture30:
                    name = "Nurture-flyt 30 dager"
                    kind = .nurture
                    description = "5 e-poster over 30 dager — verdi-først."
                case .eventInvite:
                    name = "Event-invitt"
                    kind = .event
                    description = "Save the date + 2 påminnelser."
                case .winback:
                    name = "Re-engasjer kalde leads >90 dager"
                    kind = .email
                    description = "Personlig outreach for å vekke interesse."
                }
            }
        } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    ZStack {
                        Circle().fill(t.color.opacity(isSelected ? 0.35 : 0.18))
                        Image(systemName: t.icon)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(t.color)
                    }
                    .frame(width: 34, height: 34)
                    Spacer()
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(t.color)
                    }
                }
                Text(t.rawValue)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(t.beskrivelse)
                    .font(.system(size: 10))
                    .foregroundStyle(MABrand.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .padding(11)
            .frame(width: 180, alignment: .leading)
            .background(
                isSelected ? t.color.opacity(0.10) : MABrand.card,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? t.color.opacity(0.50) : MABrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Name + Kind

    private var nameAndKindCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Navn")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(MABrand.textSecondary)
                ZStack(alignment: .leading) {
                    TextField("", text: $name)
                        .foregroundStyle(.white)
                        .font(.system(size: 14, weight: .semibold))
                        .padding(.horizontal, 12).padding(.vertical, 12)
                        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
                    if name.isEmpty {
                        Text("F.eks. Q3 ERP-løft")
                            .font(.system(size: 14))
                            .foregroundStyle(MABrand.textTertiary)
                            .padding(.horizontal, 15)
                            .allowsHitTesting(false)
                    }
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Type")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(MABrand.textSecondary)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 7) {
                    ForEach(AddToCampaignSheet.Campaign.Kind.allCases, id: \.self) { k in
                        kindButton(k)
                    }
                }
            }
        }
    }

    private func kindButton(_ k: AddToCampaignSheet.Campaign.Kind) -> some View {
        let isSelected = kind == k
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { kind = k }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: k.icon)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(isSelected ? .white : k.color)
                Text(k.rawValue)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer()
            }
            .padding(.horizontal, 10).padding(.vertical, 10)
            .background(
                isSelected ? AnyShapeStyle(k.color) : AnyShapeStyle(MABrand.card),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(isSelected ? Color.clear : MABrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Description

    private var descriptionCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Beskrivelse")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $description)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .frame(minHeight: 80)
                    .padding(8)
                    .background(MABrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
                if description.isEmpty {
                    Text("Kort beskrivelse av målgruppe og budskap…")
                        .font(.system(size: 12))
                        .foregroundStyle(MABrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    // MARK: Dates

    private var datesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Varighet")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(MABrand.textSecondary)
                Spacer()
                Toggle("", isOn: $hasEndDate)
                    .labelsHidden()
                    .tint(MABrand.purple)
            }
            HStack(spacing: 10) {
                DatePicker("Start", selection: $startDate, displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .tint(MABrand.purpleLight)
                    .colorScheme(.dark)
                if hasEndDate {
                    Text("→")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(MABrand.textTertiary)
                    DatePicker("Slutt", selection: $endDate, in: startDate..., displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .tint(MABrand.purpleLight)
                        .colorScheme(.dark)
                } else {
                    Text("Løpende")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(MABrand.green)
                        .padding(.horizontal, 9).padding(.vertical, 5)
                        .background(MABrand.green.opacity(0.18), in: Capsule())
                }
            }
            .padding(11)
            .background(MABrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
        }
    }

    // MARK: Segment

    private var segmentCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Mål-segment")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(MABrand.textSecondary)
            HStack(spacing: 6) {
                ForEach(SegmentMode.allCases, id: \.self) { mode in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { segmentMode = mode }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: mode.icon)
                                .font(.system(size: 9, weight: .bold))
                            Text(mode.rawValue)
                                .font(.system(size: 10, weight: .bold))
                        }
                        .foregroundStyle(segmentMode == mode ? .white : MABrand.purpleLight)
                        .padding(.horizontal, 8).padding(.vertical, 6)
                        .background(
                            segmentMode == mode ? AnyShapeStyle(MABrand.purple) : AnyShapeStyle(MABrand.purple.opacity(0.15)),
                            in: Capsule()
                        )
                        .overlay(Capsule().stroke(MABrand.purple.opacity(segmentMode == mode ? 0 : 0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            // Mode-spesifikk info / input
            segmentDetail
        }
        .padding(12)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
    }

    @ViewBuilder
    private var segmentDetail: some View {
        switch segmentMode {
        case .auto:
            HStack(spacing: 9) {
                Image(systemName: "sparkles")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(MABrand.purpleLight)
                VStack(alignment: .leading, spacing: 1) {
                    Text("AI velger leads basert på kampanje-type")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("~120 leads · pipeline-stage: discovery + demo")
                        .font(.system(size: 10))
                        .foregroundStyle(MABrand.textSecondary)
                }
                Spacer()
            }
        case .bransje:
            HStack(spacing: 6) {
                ForEach(["Elektro", "Bygg", "VVS", "IT"], id: \.self) { b in
                    Text(b)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(MABrand.purpleLight)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(MABrand.purple.opacity(0.15), in: Capsule())
                }
            }
        case .manual:
            ZStack(alignment: .leading) {
                TextField("", text: $manualSegment)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .padding(10)
                    .background(MABrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(MABrand.stroke, lineWidth: 1))
                if manualSegment.isEmpty {
                    Text("Skriv lead-navn separert med komma…")
                        .font(.system(size: 12))
                        .foregroundStyle(MABrand.textTertiary)
                        .padding(.horizontal, 13)
                        .allowsHitTesting(false)
                }
            }
        case .allLeads:
            HStack {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(MABrand.orange)
                Text("Sender til ALLE 1 248 leads — krever godkjenning")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(MABrand.orange)
            }
        }
    }

    // MARK: Value

    private var valueCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Forventet verdi")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(MABrand.textSecondary)
                Spacer()
                Text("NOK \(Int(expectedValueK)) 000")
                    .font(.system(size: 14, weight: .black, design: .rounded))
                    .foregroundStyle(MABrand.green)
                    .monospacedDigit()
            }
            Slider(value: $expectedValueK, in: 0...5000, step: 50)
                .tint(MABrand.purple)
            HStack {
                Text("0 kr")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(MABrand.textTertiary)
                Spacer()
                Text("5 mill")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(MABrand.textTertiary)
            }
        }
        .padding(12)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(MABrand.stroke, lineWidth: 1))
    }

    // MARK: Owner + Status

    private var ownerStatusCard: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Eier")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(MABrand.textSecondary)
                Menu {
                    Button("Lars Kristensen") { owner = "Lars Kristensen" }
                    Button("Anna Berg")       { owner = "Anna Berg" }
                    Button("Erik Nilsen")     { owner = "Erik Nilsen" }
                    Button("Maja Solberg")    { owner = "Maja Solberg" }
                } label: {
                    HStack(spacing: 6) {
                        ZStack {
                            Circle().fill(MABrand.purple.opacity(0.35))
                            Text(initials(owner))
                                .font(.system(size: 10, weight: .black))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 26, height: 26)
                        Text(owner)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(MABrand.textTertiary)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(MABrand.card, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(MABrand.stroke, lineWidth: 1))
                }
            }
            VStack(alignment: .leading, spacing: 5) {
                Text("Status")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(MABrand.textSecondary)
                HStack(spacing: 5) {
                    statusPill(.active)
                    statusPill(.paused)
                }
            }
        }
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        return parts.prefix(2).compactMap { $0.first }.map { String($0) }.joined()
    }

    private func statusPill(_ s: AddToCampaignSheet.Campaign.Status) -> some View {
        let isSelected = status == s
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { status = s }
        } label: {
            Text(s.rawValue)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(isSelected ? .white : s.color)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    isSelected ? AnyShapeStyle(s.color) : AnyShapeStyle(s.color.opacity(0.18)),
                    in: RoundedRectangle(cornerRadius: 10)
                )
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(s.color.opacity(isSelected ? 0 : 0.4), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Add current lead toggle

    private var addLeadCard: some View {
        Toggle(isOn: $addCurrentLead) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(MABrand.green.opacity(0.22))
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(MABrand.green)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Legg til \(seedLeadCompany) i kampanjen")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Auto-aktiverer kampanjen for dette leadet")
                        .font(.system(size: 10))
                        .foregroundStyle(MABrand.textSecondary)
                }
            }
        }
        .tint(MABrand.purple)
        .padding(11)
        .background(MABrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(MABrand.stroke, lineWidth: 1))
    }

    // MARK: Save bar

    private var saveBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 14, weight: .bold))
                Text(canSave ? "Opprett kampanje" : "Skriv inn navn først")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: canSave
                                ? [MABrand.purple, MABrand.purpleLight]
                                : [MABrand.cardHi, MABrand.cardHi],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(canSave ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!canSave)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(MABrand.bg.opacity(0.95).overlay(Rectangle().fill(MABrand.stroke).frame(height: 1), alignment: .top))
    }
}
