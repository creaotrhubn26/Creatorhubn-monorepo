// MeetingSheets.swift
//
// Sheets som åpnes fra MeetingDetailSidebar:
//   - StartMeetingSheet  (FaceTime/Meet/Telefon/Sjekk inn)
//   - NavigateSheet      (4 transport-modus + 3 nav-apper, samme som Kart-fanen)
//   - LogNoteSheet       (rask notat-input m/ AI-transkribering-stub)
//   - LeadDetailStub     (lett-vekt sheet for "Åpne lead")

import SwiftUI
import MapKit

private enum SBrand {
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

// MARK: - StartMeetingSheet

struct StartMeetingSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var mode: Mode = .checkIn

    enum Mode: String, CaseIterable, Hashable {
        case checkIn = "Sjekk inn (fysisk)"
        case facetime = "FaceTime"
        case googleMeet = "Google Meet"
        case phone = "Telefon"
        var icon: String {
            switch self {
            case .checkIn:    return "person.crop.circle.badge.checkmark"
            case .facetime:   return "video.circle.fill"
            case .googleMeet: return "video.fill"
            case .phone:      return "phone.fill"
            }
        }
        var color: Color {
            switch self {
            case .checkIn:    return SBrand.purple
            case .facetime:   return SBrand.green
            case .googleMeet: return SBrand.blue
            case .phone:      return SBrand.yellow
            }
        }
        var subtitle: String {
            switch self {
            case .checkIn:    return "Marker oppmøte + start timer"
            case .facetime:   return "Apple — alle plattformer"
            case .googleMeet: return "Auto-generert lenke"
            case .phone:      return "Ring kontakt direkte"
            }
        }
    }

    private func link(for mode: Mode) -> String? {
        let short = String(UUID().uuidString.prefix(8)).lowercased()
        switch mode {
        case .facetime:   return "https://facetime.apple.com/join#v=1&p=\(short)"
        case .googleMeet: return "https://meet.google.com/\(short.prefix(3))-\(short.dropFirst(3).prefix(4))-\(short.suffix(3))"
        case .phone:      return "tel://+4790012345"
        case .checkIn:    return nil
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    meetingHeader
                    modeGrid
                    if mode == .checkIn { checkInCard } else if let l = link(for: mode) { linkCard(l) }
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(SBrand.bg.ignoresSafeArea())
            .navigationTitle("Start møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(SBrand.purpleLight)
                }
            }
            .toolbarBackground(SBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { actionBar }
        }
    }

    private var meetingHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.appScaled(size: 16, weight: .semibold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(meeting.startTime) - \(meeting.endTime) · Med \(meeting.contactName)")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(SBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var modeGrid: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Velg modus")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            VStack(spacing: 8) {
                ForEach(Mode.allCases, id: \.self) { m in
                    modeRow(m)
                }
            }
        }
    }

    private func modeRow(_ m: Mode) -> some View {
        let isSelected = mode == m
        return Button { mode = m } label: {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(m.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: m.icon)
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(m.color)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.rawValue)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(m.subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.appScaled(size: 17))
                    .foregroundStyle(isSelected ? m.color : SBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? m.color.opacity(0.08) : SBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isSelected ? m.color.opacity(0.5) : SBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var checkInCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 9) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.appScaled(size: 13))
                    .foregroundStyle(SBrand.purpleLight)
                Text("Sjekk inn på adressen")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(SBrand.green.opacity(0.22))
                    Image(systemName: "location.fill")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(SBrand.green)
                }
                .frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Du er innenfor 50m av adressen")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(meeting.address)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(SBrand.green)
            }
            .padding(10)
            .background(SBrand.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 9))
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private func linkCard(_ link: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 9) {
                Image(systemName: mode.icon)
                    .font(.appScaled(size: 13))
                    .foregroundStyle(mode.color)
                Text(mode == .phone ? "Telefon-nummer" : "\(mode.rawValue)-lenke")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button {
                    UIPasteboard.general.string = link
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(SBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            Text(link)
                .font(.appScaled(size: 11, design: .monospaced))
                .foregroundStyle(SBrand.textSecondary)
                .lineLimit(2)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(SBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var actionBar: some View {
        Button {
            if let l = link(for: mode), let url = URL(string: l) {
                UIApplication.shared.open(url)
            }
            dismiss()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "play.circle.fill")
                    .font(.appScaled(size: 14, weight: .bold))
                Text(actionLabel)
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [mode.color, mode.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            SBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(SBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    private var actionLabel: String {
        switch mode {
        case .checkIn:    return "Sjekk inn nå"
        case .facetime:   return "Start FaceTime"
        case .googleMeet: return "Åpne Google Meet"
        case .phone:      return "Ring nå"
        }
    }
}

// MARK: - LogNoteSheet

struct LogNoteSheet: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss
    @State private var note: String = ""
    @State private var category: NoteCategory = .general
    @State private var pinned: Bool = false

    enum NoteCategory: String, CaseIterable, Hashable {
        case general = "Generelt"
        case decision = "Beslutning"
        case action = "Handling"
        case concern = "Bekymring"
        case insight = "Innsikt"
        var icon: String {
            switch self {
            case .general:  return "note.text"
            case .decision: return "checkmark.circle.fill"
            case .action:   return "arrow.right.circle.fill"
            case .concern:  return "exclamationmark.triangle.fill"
            case .insight:  return "lightbulb.fill"
            }
        }
        var color: Color {
            switch self {
            case .general:  return SBrand.purpleLight
            case .decision: return SBrand.green
            case .action:   return SBrand.blue
            case .concern:  return SBrand.orange
            case .insight:  return SBrand.yellow
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    meetingCard
                    categoryRow
                    noteEditor
                    // aiCard («Spille inn + transkribere») fjernet 2026-07-17:
                    // var død knapp — transkribering finnes i Leadbook (LiveTranscription),
                    // kobles hit når flyten er klar.
                    pinToggle
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(SBrand.bg.ignoresSafeArea())
            .navigationTitle("Logg notat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(SBrand.purpleLight)
                }
            }
            .toolbarBackground(SBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { saveBar }
        }
    }

    private var meetingCard: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 9)
                    .fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.company)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(meeting.startTime)–\(meeting.endTime)")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(SBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var categoryRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Type")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(NoteCategory.allCases, id: \.self) { c in
                        Button { category = c } label: {
                            HStack(spacing: 5) {
                                Image(systemName: c.icon)
                                    .font(.appScaled(size: 10, weight: .semibold))
                                Text(c.rawValue)
                                    .font(.appScaled(size: 11, weight: .semibold))
                            }
                            .foregroundStyle(category == c ? .white : c.color)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                category == c ? c.color : c.color.opacity(0.15),
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(c.color.opacity(0.4), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var noteEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Notat")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $note)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.appScaled(size: 13))
                    .frame(minHeight: 140)
                    .padding(10)
                    .background(SBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
                if note.isEmpty {
                    Text("Hva ble diskutert? Hvilke beslutninger? Hvem skal gjøre hva?")
                        .font(.appScaled(size: 13))
                        .foregroundStyle(SBrand.textTertiary)
                        .padding(.horizontal, 14).padding(.vertical, 17)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var pinToggle: some View {
        Toggle(isOn: $pinned) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(SBrand.yellow.opacity(0.22))
                    Image(systemName: "pin.fill")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(SBrand.yellow)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Fest notat øverst")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Vises først i lead-historikk")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
            }
        }
        .tint(SBrand.purple)
        .padding(10)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var saveBar: some View {
        HStack(spacing: 10) {
            Button { dismiss() } label: {
                Text("Avbryt")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(SBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { dismiss() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 13, weight: .bold))
                    Text("Lagre notat")
                        .font(.appScaled(size: 14, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(colors: [SBrand.purple, SBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
            .disabled(note.isEmpty)
            .opacity(note.isEmpty ? 0.5 : 1)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(SBrand.bg.opacity(0.95).overlay(Rectangle().fill(SBrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - ToastBubble

struct ToastBubble: View {
    let text: String
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(SBrand.green)
            Text(text)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(SBrand.stroke, lineWidth: 1))
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }
}

// MARK: - LeadDetailStub (lett-vekt sheet for "Åpne lead")

struct LeadDetailStub: View {
    let meeting: Meeting
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    hero
                    statsRow
                    contactCard
                    activitySummary
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(SBrand.bg.ignoresSafeArea())
            .navigationTitle(meeting.company)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(SBrand.purpleLight)
                }
            }
            .toolbarBackground(SBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var hero: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 11)
                    .fill(meeting.iconColor.opacity(0.22))
                Image(systemName: meeting.icon)
                    .font(.appScaled(size: 22, weight: .semibold))
                    .foregroundStyle(meeting.iconColor)
            }
            .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 3) {
                Text(meeting.company)
                    .font(.appScaled(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                Text(meeting.location)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(SBrand.textSecondary)
                HStack(spacing: 5) {
                    Image(systemName: "flame.fill")
                        .font(.appScaled(size: 10))
                    Text(meeting.leadType + " · score \(meeting.leadScore)")
                        .font(.appScaled(size: 11, weight: .bold))
                }
                .foregroundStyle(SBrand.yellow)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(SBrand.yellow.opacity(0.18), in: Capsule())
            }
            Spacer()
        }
        .padding(16)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            // «650K» og «65 %» var hardkodet mock — verdi hentes nå fra møtet,
            // og sannsynlighet er fjernet (ingen kilde).
            statBox(label: "Forventet verdi",
                    value: meeting.valueNok > 0 ? "\(meeting.valueNok / 1000)K" : "—",
                    color: SBrand.green)
            statBox(label: "Lead-score", value: "\(meeting.leadScore)", color: SBrand.yellow)
        }
    }

    private func statBox(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.appScaled(size: 10))
                .foregroundStyle(SBrand.textSecondary)
            Text(value)
                .font(.appScaled(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(11)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var contactCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Primær kontakt")
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(SBrand.purple.opacity(0.25))
                    Text(meeting.contactName.split(separator: " ").prefix(2)
                            .compactMap { $0.first }.map(String.init).joined().uppercased())
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(SBrand.purpleLight)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(meeting.contactName)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(meeting.contactRole)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
            }
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }

    private var activitySummary: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Siste aktivitet")
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(SBrand.blue.opacity(0.20))
                    Image(systemName: "envelope.fill")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(SBrand.blue)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Tilbud sendt")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("15. mai 14:18 · Lars Kristensen")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(SBrand.textSecondary)
                }
                Spacer()
            }
            .padding(10)
            .background(SBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        }
        .padding(14)
        .background(SBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(SBrand.stroke, lineWidth: 1))
    }
}

