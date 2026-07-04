// ScheduleMeetingSheet.swift
//
// Modal som åpnes når salgssjefen tapper "Planlegg møte" i detail-panelet.
// Forhåndsutfylt med lead-info + kontaktperson + adresse.
//
// Møte-typer: fysisk møte, video (Google Meet/Teams auto), telefon.
// Inviterte: lead-kontaktperson + meg selv + (valgfritt) andre teammedlemmer.
// Sender automatisk: kalender-invitasjon (.ics) + e-post med agenda.

import SwiftUI
import MapKit

private enum SmBrand {
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

struct ScheduleMeetingSheet: View {
    let lead: MapLeadMock
    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""
    @State private var date: Date = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var duration: Int = 30  // minutter
    @State private var meetingType: MeetingType = .physical
    @State private var location: String = ""
    @State private var agenda: String = ""
    @State private var sendInvite: Bool = true
    @State private var addToCalendar: Bool = true
    @State private var reminderBefore: Int = 30  // min før

    // Inviterte
    @State private var inviteContact: Bool = true
    @State private var inviteAdditional: [String] = []

    enum MeetingType: String, CaseIterable {
        case physical = "Fysisk møte"
        case facetime = "FaceTime"
        case googleMeet = "Google Meet"
        case phone = "Telefon"
        var icon: String {
            switch self {
            case .physical:   return "building.2.fill"
            case .facetime:   return "video.circle.fill"
            case .googleMeet: return "video.fill"
            case .phone:      return "phone.fill"
            }
        }
        var color: Color {
            switch self {
            case .physical:   return SmBrand.purple
            case .facetime:   return SmBrand.green
            case .googleMeet: return SmBrand.blue
            case .phone:      return SmBrand.yellow
            }
        }
        var description: String {
            switch self {
            case .physical:   return "Møte på leadens adresse"
            case .facetime:   return "Apple FaceTime-lenke (alle får invitasjon)"
            case .googleMeet: return "Google Meet-lenke genereres automatisk"
            case .phone:      return "Du ringer kontaktpersonen"
            }
        }
        /// True hvis dette er en video-konferanse som trenger lenke.
        var isVideo: Bool { self == .facetime || self == .googleMeet }
    }

    /// Generér mock-lenke i preview. I prod kalles:
    /// - FaceTime: `INStartCallIntent`/`facetime://` med dummy-UUID (alle iPhone+Mac kobler seg på)
    /// - Google Meet: Google Calendar API POST → conferenceData.createRequest → returnerer hangoutLink
    private func generatedLink(for type: MeetingType) -> String {
        let short = String(UUID().uuidString.prefix(8)).lowercased()
        switch type {
        case .facetime:   return "https://facetime.apple.com/join#v=1&p=\(short)&k=abc123"
        case .googleMeet: return "https://meet.google.com/\(short.prefix(3))-\(short.dropFirst(3).prefix(4))-\(short.suffix(3))"
        default:          return ""
        }
    }

    private let durationOptions = [15, 30, 45, 60, 90, 120]
    private let reminderOptions = [5, 15, 30, 60, 120, 1440]  // min

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    leadHeaderCard
                    titleCard
                    typeSelector
                    timeCard
                    locationCard
                    inviteesCard
                    agendaCard
                    notificationsCard
                    Color.clear.frame(height: 80)  // plass til bottom-bar
                }
                .padding(20)
            }
            .background(SmBrand.bg.ignoresSafeArea())
            .navigationTitle("Planlegg møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(SmBrand.purpleLight)
                }
            }
            .toolbarBackground(SmBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { bottomBar }
            .onAppear {
                if title.isEmpty {
                    title = "Møte med \(lead.name)"
                }
                if location.isEmpty {
                    location = lead.address
                }
            }
            .onChange(of: meetingType) { _, newType in
                // Auto-generér lenke når brukeren bytter til video-type
                switch newType {
                case .physical:   location = lead.address
                case .phone:      location = "+47 911 22 333"  // fra lead-kontakt i prod
                case .facetime, .googleMeet:
                    location = generatedLink(for: newType)
                }
            }
        }
        .macCatalystSheetSize(minWidth: 820, minHeight: 720)
    }

    // MARK: Lead-header

    private var leadHeaderCard: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(lead.status.color.opacity(0.20))
                Image(systemName: "building.2.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(lead.status.color)
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 3) {
                Text(lead.name)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                Text(lead.address)
                    .font(.system(size: 12))
                    .foregroundStyle(SmBrand.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(SmBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(lead.status.color.opacity(0.30), lineWidth: 1)
        )
    }

    // MARK: Tittel-felt

    private var titleCard: some View {
        sectionCard(title: "Møtetittel", icon: "text.cursor") {
            TextField("", text: $title,
                      prompt: Text("F.eks. Befaring – kontorbygg Storgata")
                .foregroundColor(SmBrand.textTertiary))
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .font(.system(size: 14))
                .padding(.horizontal, 12).padding(.vertical, 12)
                .background(SmBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(SmBrand.stroke, lineWidth: 1))
        }
    }

    // MARK: Type-velger

    private var typeSelector: some View {
        sectionCard(title: "Type møte", icon: "video.bubble.fill") {
            VStack(spacing: 8) {
                ForEach(MeetingType.allCases, id: \.self) { t in
                    typeRow(t)
                }
            }
        }
    }

    private func typeRow(_ t: MeetingType) -> some View {
        let isSelected = meetingType == t
        return Button { meetingType = t } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(t.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: t.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(t.color)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.rawValue)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(t.description)
                        .font(.system(size: 11))
                        .foregroundStyle(SmBrand.textSecondary)
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 18))
                    .foregroundStyle(isSelected ? t.color : SmBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? t.color.opacity(0.10) : SmBrand.cardHi,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? t.color.opacity(0.45) : SmBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Tid

    private var timeCard: some View {
        sectionCard(title: "Tid", icon: "calendar.badge.clock") {
            VStack(spacing: 12) {
                DatePicker("", selection: $date, in: Date()...)
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .colorScheme(.dark)
                    .accentColor(SmBrand.purpleLight)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 10).padding(.vertical, 10)
                    .background(SmBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(SmBrand.stroke, lineWidth: 1))

                VStack(alignment: .leading, spacing: 6) {
                    Text("Varighet")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(SmBrand.textSecondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(durationOptions, id: \.self) { d in
                                durationChip(d)
                            }
                        }
                    }
                }
            }
        }
    }

    private func durationChip(_ minutes: Int) -> some View {
        let isSelected = duration == minutes
        let label = minutes >= 60
            ? "\(minutes / 60)t \(minutes % 60 == 0 ? "" : "\(minutes % 60)m")".trimmingCharacters(in: .whitespaces)
            : "\(minutes) min"
        return Button { duration = minutes } label: {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(isSelected ? .white : SmBrand.textSecondary)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(
                    isSelected ? AnyShapeStyle(LinearGradient(
                        colors: [SmBrand.purple, SmBrand.purpleLight],
                        startPoint: .leading, endPoint: .trailing
                    )) : AnyShapeStyle(SmBrand.cardHi),
                    in: Capsule()
                )
                .overlay(Capsule().stroke(isSelected ? Color.clear : SmBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Sted / video-lenke

    private var locationCardTitle: String {
        switch meetingType {
        case .physical:   return "Møtested"
        case .facetime:   return "FaceTime-lenke"
        case .googleMeet: return "Google Meet-lenke"
        case .phone:      return "Telefon"
        }
    }
    private var locationCardIcon: String {
        switch meetingType {
        case .physical:   return "mappin.and.ellipse"
        case .facetime:   return "video.circle.fill"
        case .googleMeet: return "video.fill"
        case .phone:      return "phone.circle.fill"
        }
    }

    private var locationCard: some View {
        sectionCard(title: locationCardTitle, icon: locationCardIcon) {
            VStack(spacing: 10) {
                if meetingType.isVideo {
                    videoLinkRow
                } else {
                    HStack(spacing: 8) {
                        Image(systemName: meetingType.icon)
                            .font(.system(size: 12))
                            .foregroundStyle(meetingType.color)
                        TextField("", text: $location,
                                  prompt: Text(meetingType == .physical
                                                ? "Storgata 12, 0184 Oslo"
                                                : "+47 911 22 333")
                                    .foregroundColor(SmBrand.textTertiary))
                            .textFieldStyle(.plain)
                            .foregroundStyle(.white)
                            .font(.system(size: 13))
                    }
                    .padding(.horizontal, 12).padding(.vertical, 11)
                    .background(SmBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(SmBrand.stroke, lineWidth: 1))
                }

                if meetingType == .physical {
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
                    .frame(height: 130)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(SmBrand.stroke, lineWidth: 1))
                    .allowsHitTesting(false)
                }
            }
        }
    }

    /// Video-lenke-rad m/ auto-generert URL, copy + join-knapp.
    /// Inkluderer "Regenerér"-button og status-banner (Lagt til i kalender osv.).
    private var videoLinkRow: some View {
        VStack(spacing: 10) {
            // URL-feltet
            HStack(spacing: 8) {
                ZStack {
                    Circle().fill(meetingType.color.opacity(0.22))
                    Image(systemName: meetingType.icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(meetingType.color)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(location.isEmpty ? "Genererer lenke…" : location)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Text(meetingType == .facetime
                         ? "Apple ID kreves ikke — fungerer på alle plattformer"
                         : "Krever Google-konto eller anonym tilgang")
                        .font(.system(size: 9))
                        .foregroundStyle(SmBrand.textSecondary)
                }
                Spacer(minLength: 4)
                Button {
                    UIPasteboard.general.string = location
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(SmBrand.purpleLight)
                        .frame(width: 30, height: 30)
                        .background(SmBrand.cardHi.opacity(0.6), in: Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(11)
            .background(SmBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(meetingType.color.opacity(0.35), lineWidth: 1)
            )

            // Action-rad
            HStack(spacing: 8) {
                Button {
                    location = generatedLink(for: meetingType)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Regenerér")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(SmBrand.purpleLight)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(SmBrand.cardHi.opacity(0.6), in: Capsule())
                    .overlay(Capsule().stroke(SmBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)

                Button {
                    if let url = URL(string: location) {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.up.forward.app.fill")
                            .font(.system(size: 11, weight: .bold))
                        Text(meetingType == .facetime ? "Test FaceTime" : "Test Meet")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(
                        LinearGradient(
                            colors: [meetingType.color, meetingType.color.opacity(0.75)],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
                Spacer()
            }

            // Info-banner
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(meetingType.color)
                    .padding(.top, 1)
                Text(meetingType == .facetime
                     ? "Når møtet starter, åpnes FaceTime automatisk på din iPad. Inviterte får lenken på e-post + .ics-fil."
                     : "Møtet legges i Google Calendar via koblet konto. Lenken sendes som del av invitasjonen.")
                    .font(.system(size: 11))
                    .foregroundStyle(SmBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer()
            }
            .padding(10)
            .background(meetingType.color.opacity(0.10), in: RoundedRectangle(cornerRadius: 9))
        }
    }

    // MARK: Inviterte

    private var inviteesCard: some View {
        sectionCard(title: "Deltakere", icon: "person.2.fill") {
            VStack(spacing: 8) {
                // Selger (auto, ikke avhukbar)
                inviteeRow(
                    name: "Lars Kristensen",
                    role: "Salgssjef · deg",
                    initials: "LK",
                    color: SmBrand.purpleLight,
                    isOrganizer: true,
                    toggled: .constant(true),
                    locked: true
                )
                inviteeRow(
                    name: "Anders Johansen",
                    role: "Daglig leder · \(lead.name)",
                    initials: "AJ",
                    color: SmBrand.purple,
                    isOrganizer: false,
                    toggled: $inviteContact,
                    locked: false
                )
                Button {} label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 12, weight: .bold))
                        Text("Inviter teammedlem")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(SmBrand.purpleLight)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(SmBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 9))
                    .overlay(
                        RoundedRectangle(cornerRadius: 9)
                            .stroke(SmBrand.purple.opacity(0.30),
                                    style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func inviteeRow(name: String, role: String, initials: String,
                              color: Color, isOrganizer: Bool,
                              toggled: Binding<Bool>, locked: Bool) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(color.opacity(0.25))
                Text(initials)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(name)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    if isOrganizer {
                        Text("ARRANGØR")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundStyle(SmBrand.yellow)
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(SmBrand.yellow.opacity(0.18), in: Capsule())
                    }
                }
                Text(role)
                    .font(.system(size: 10))
                    .foregroundStyle(SmBrand.textSecondary)
            }
            Spacer()
            if locked {
                Image(systemName: "lock.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(SmBrand.textTertiary)
            } else {
                Toggle("", isOn: toggled)
                    .labelsHidden()
                    .tint(SmBrand.purple)
            }
        }
        .padding(10)
        .background(SmBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: Agenda

    private var agendaCard: some View {
        sectionCard(title: "Agenda + notater", icon: "list.bullet.rectangle.portrait") {
            ZStack(alignment: .topLeading) {
                TextEditor(text: $agenda)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                    .frame(minHeight: 90)
                    .padding(10)
                    .background(SmBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(SmBrand.stroke, lineWidth: 1))
                if agenda.isEmpty {
                    Text("• Befaring av bygget\n• Gjennomgang av tilbud\n• Avklare neste steg")
                        .font(.system(size: 13))
                        .foregroundStyle(SmBrand.textTertiary)
                        .padding(.horizontal, 14).padding(.vertical, 17)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    // MARK: Varsling

    private var notificationsCard: some View {
        sectionCard(title: "Send + påminn", icon: "bell.fill") {
            VStack(spacing: 10) {
                Toggle(isOn: $sendInvite) {
                    HStack(spacing: 8) {
                        Image(systemName: "envelope.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(SmBrand.blue)
                            .frame(width: 22)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Send invitasjon på e-post")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("Med agenda + adresse + .ics")
                                .font(.system(size: 10))
                                .foregroundStyle(SmBrand.textSecondary)
                        }
                    }
                }
                .tint(SmBrand.purple)

                Toggle(isOn: $addToCalendar) {
                    HStack(spacing: 8) {
                        Image(systemName: "calendar.badge.plus")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(SmBrand.green)
                            .frame(width: 22)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Legg til i kalenderen min")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("iCal + Google Cal-sync hvis aktivert")
                                .font(.system(size: 10))
                                .foregroundStyle(SmBrand.textSecondary)
                        }
                    }
                }
                .tint(SmBrand.purple)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Påminnelse")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(SmBrand.textSecondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(reminderOptions, id: \.self) { r in
                                reminderChip(r)
                            }
                        }
                    }
                }
            }
        }
    }

    private func reminderChip(_ minutes: Int) -> some View {
        let isSelected = reminderBefore == minutes
        let label = minutes >= 60 ? (minutes >= 1440 ? "1 dag" : "\(minutes / 60) t") : "\(minutes) min"
        return Button { reminderBefore = minutes } label: {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(isSelected ? .white : SmBrand.textSecondary)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(
                    isSelected ? AnyShapeStyle(SmBrand.purple) : AnyShapeStyle(SmBrand.cardHi),
                    in: Capsule()
                )
                .overlay(Capsule().stroke(isSelected ? Color.clear : SmBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Bottom-bar

    private var bottomBar: some View {
        VStack(spacing: 0) {
            // Sammendrag-rad
            HStack(spacing: 8) {
                Image(systemName: meetingType.icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(meetingType.color)
                Text(formattedDateTime)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                Text("·")
                    .foregroundStyle(SmBrand.textTertiary)
                Text("\(duration) min")
                    .font(.system(size: 11))
                    .foregroundStyle(SmBrand.textSecondary)
                Spacer()
                if sendInvite {
                    HStack(spacing: 4) {
                        Image(systemName: "envelope.badge.fill")
                            .font(.system(size: 10))
                        Text("Invitasjon sendes")
                            .font(.system(size: 10))
                    }
                    .foregroundStyle(SmBrand.green)
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 8)
            .background(SmBrand.cardHi)

            // Action-knapper
            HStack(spacing: 10) {
                Button { dismiss() } label: {
                    Text("Avbryt")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(SmBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SmBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)

                Button { dismiss() } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "calendar.badge.checkmark")
                            .font(.system(size: 13, weight: .bold))
                        Text("Planlegg møte")
                            .font(.system(size: 14, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        LinearGradient(
                            colors: [SmBrand.purple, SmBrand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 11)
                    )
                }
                .buttonStyle(.plain)
                .disabled(title.isEmpty)
                .opacity(title.isEmpty ? 0.55 : 1)
            }
            .padding(.horizontal, 20).padding(.vertical, 12)
            .background(
                SmBrand.bg.opacity(0.95)
                    .overlay(Rectangle().fill(SmBrand.stroke).frame(height: 1), alignment: .top)
            )
        }
    }

    private var formattedDateTime: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "EEE d. MMM 'kl.' HH:mm"
        return f.string(from: date).capitalized
    }

    // MARK: Helper

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, icon: String,
                                              @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(SmBrand.purpleLight)
                Text(title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            content()
        }
        .padding(16)
        .background(SmBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(SmBrand.stroke, lineWidth: 1))
    }
}
