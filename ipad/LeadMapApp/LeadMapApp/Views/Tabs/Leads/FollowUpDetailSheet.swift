// FollowUpDetailSheet.swift
//
// Modal som åpnes når salgssjefen tapper "Åpne oppfølging" i lead-
// detail-sidebar. Viser planlagt oppfølging m/ kontekst (forrige
// interaksjon + agenda) + raske handlinger.

import SwiftUI

private enum FuBrand {
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

struct FollowUpDetailSheet: View {
    let lead: LeadRow
    @Environment(\.dismiss) private var dismiss
    @State private var snoozeMenuOpen: Bool = false
    @State private var logActivityOpen: Bool = false
    @State private var meetingOpen: Bool = false
    @State private var smsOpen: Bool = false
    @State private var emailTemplateOpen: Bool = false

    // Backend-binding (uke 2): ekte lead-felter når raden kommer fra
    // backend (backendId != nil); demo-tekster for mock-radene.
    private var isDemoRow: Bool { lead.backendId == nil }

    private var followUpType: String {
        isDemoRow ? "Telefonmøte" : (lead.nextAction ?? "Oppfølging")
    }
    private var agenda: String {
        if isDemoRow {
            return "Følge opp tilbud sendt 20. mai. Anders ønsket referanseprosjekter — særlig fra finansbygg. Diskuter prising på del 2 (oppdateringen)."
        }
        return lead.nextAction
            ?? lead.notes
            ?? "Ingen agenda satt — legg til et notat eller neste handling på leaden."
    }
    /// «Forfalt for 2 t siden» / «Planlagt» — relativ tid fra ekte
    /// nextFollowUpAt når tilgjengelig, demo-tekst for mock-rader.
    private var overdueLabel: String {
        guard lead.nextFollowUpOverdue else { return "Planlagt" }
        if let due = lead.nextFollowUpAt {
            let rel = RelativeDateTimeFormatter()
            rel.locale = Locale(identifier: "nb_NO")
            rel.unitsStyle = .short
            return "Forfalt \(rel.localizedString(for: due, relativeTo: Date()))"
        }
        return isDemoRow ? "Forfalt for 14 min siden" : "Forfalt"
    }

    private var previousActivity: String {
        if isDemoRow { return "Sendte tilbudsutkast på e-post — 20. mai 14:18" }
        if let visit = lead.lastVisitAt {
            let df = DateFormatter()
            df.locale = Locale(identifier: "nb_NO")
            df.dateFormat = "d. MMM HH:mm"
            return "Siste besøk — \(df.string(from: visit))"
        }
        return "Ingen tidligere aktivitet registrert"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    heroCard
                    quickActionsCard
                    contextCard
                    agendaCard
                    previousActivityCard
                    aiSuggestionCard
                    dangerZone
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(FuBrand.bg.ignoresSafeArea())
            .navigationTitle("Oppfølging")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(FuBrand.purpleLight)
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button { } label: { Label("Rediger oppfølging", systemImage: "pencil") }
                        Button { } label: { Label("Tilordne til annen selger", systemImage: "person.crop.circle.fill") }
                        Button { } label: { Label("Del lenke", systemImage: "square.and.arrow.up") }
                    } label: {
                        Image(systemName: "ellipsis.circle.fill")
                            .font(.appScaled(size: 18))
                            .foregroundStyle(FuBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(FuBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { actionBar }
            .sheet(isPresented: $logActivityOpen) {
                LogActivitySheet(lead: lead)
            }
            .sheet(isPresented: $meetingOpen) {
                VideoMeetingPicker(lead: lead)
            }
            .sheet(isPresented: $smsOpen) {
                SMSPicker(lead: lead, phoneNumber: lead.displayPhone ?? "")
            }
            .sheet(isPresented: $emailTemplateOpen) {
                EmailTemplatePicker(lead: lead, toEmail: lead.displayEmail ?? "")
            }
        }
        .macCatalystSheetSize(minWidth: 820, minHeight: 720)
    }

    // MARK: Hero

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11)
                        .fill(FuBrand.red.opacity(0.22))
                    Image(systemName: "phone.fill")
                        .font(.appScaled(size: 20, weight: .semibold))
                        .foregroundStyle(FuBrand.red)
                }
                .frame(width: 52, height: 52)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(followUpType)
                            .font(.appScaled(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                        if lead.nextFollowUpOverdue {
                            HStack(spacing: 3) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.appScaled(size: 8, weight: .bold))
                                Text("Overforfalt")
                                    .font(.appScaled(size: 9, weight: .bold))
                            }
                            .foregroundStyle(FuBrand.red)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(FuBrand.red.opacity(0.18), in: Capsule())
                            .overlay(Capsule().stroke(FuBrand.red.opacity(0.4), lineWidth: 1))
                        }
                    }
                    Text(lead.nextFollowUp ?? "Ikke planlagt")
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(FuBrand.red)
                    Text("Med \(lead.contactName) · \(lead.company)")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(FuBrand.textSecondary)
                }
                Spacer()
            }
            // Countdown / status
            HStack(spacing: 10) {
                statusCell(icon: "clock.fill", label: "Status", value: overdueLabel, color: lead.nextFollowUpOverdue ? FuBrand.red : FuBrand.green)
                statusCell(icon: "person.2.fill", label: "Tildelt", value: lead.ownerName, color: FuBrand.purpleLight)
            }
        }
        .padding(16)
        .background(FuBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(lead.nextFollowUpOverdue ? FuBrand.red.opacity(0.4) : FuBrand.stroke, lineWidth: 1.2)
        )
    }

    private func statusCell(icon: String, label: String, value: String, color: Color) -> some View {
        HStack(spacing: 8) {
            ZStack {
                Circle().fill(color.opacity(0.22))
                Image(systemName: icon)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 0) {
                Text(label)
                    .font(.appScaled(size: 9, weight: .semibold))
                    .foregroundStyle(FuBrand.textSecondary)
                Text(value)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(FuBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    // MARK: Quick-actions (Ring nå-prominent)

    private var quickActionsCard: some View {
        VStack(spacing: 9) {
            Button { call(lead.displayPhone ?? "") } label: {
                HStack(spacing: 8) {
                    Image(systemName: "phone.fill")
                        .font(.appScaled(size: 16, weight: .bold))
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Ring \(lead.contactName.isEmpty ? lead.company : lead.contactName) nå")
                            .font(.appScaled(size: 14, weight: .bold))
                        Text("\(lead.displayPhone ?? "Mangler telefonnummer") · Telefon")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(.white.opacity(0.75))
                    }
                    Spacer()
                    Image(systemName: "phone.connection.fill")
                        .font(.appScaled(size: 15))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16).padding(.vertical, 14)
                .frame(maxWidth: .infinity)
                .background(
                    LinearGradient(
                        colors: [FuBrand.green, FuBrand.green.opacity(0.7)],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 12)
                )
            }
            .buttonStyle(.plain)

            HStack(spacing: 9) {
                quickButton(icon: "envelope.fill", label: "Send e-post", color: FuBrand.blue) {
                    emailTemplateOpen = true
                }
                quickButton(icon: "video.fill", label: "Video-møte", color: FuBrand.purple) {
                    meetingOpen = true
                }
                quickButton(icon: "message.fill", label: "SMS", color: FuBrand.yellow) {
                    smsOpen = true
                }
            }
        }
    }

    private func quickButton(icon: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 5) {
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 32, height: 32)
                Text(label)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(FuBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(FuBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Kontekst — lead-info

    private var contextCard: some View {
        sectionCard(title: "Lead-kontekst", icon: "building.2.fill") {
            VStack(spacing: 9) {
                contextRow(label: "Selskap",  value: lead.company,    icon: "building.2")
                contextRow(label: "Bransje",  value: lead.category,   icon: "tag")
                contextRow(label: "Status",   value: lead.status.label, icon: lead.status.icon, valueColor: lead.status.color)
                contextRow(label: "Score",    value: "\(lead.leadScore) av 100", icon: "flame.fill")
                contextRow(label: "Verdi",    value: "NOK \(formatThousands(lead.valueNok))", icon: "norwegiankronesign.circle.fill", valueColor: FuBrand.green)
            }
        }
    }

    private func contextRow(label: String, value: String, icon: String, valueColor: Color = .white) -> some View {
        HStack {
            HStack(spacing: 7) {
                Image(systemName: icon)
                    .font(.appScaled(size: 10))
                    .foregroundStyle(FuBrand.textSecondary)
                Text(label)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(FuBrand.textSecondary)
            }
            Spacer()
            Text(value)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(valueColor)
        }
    }

    // MARK: Agenda

    private var agendaCard: some View {
        sectionCard(title: "Agenda + notat", icon: "list.bullet.rectangle.portrait") {
            Text(agenda)
                .font(.appScaled(size: 12))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(FuBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: Forrige interaksjon

    private var previousActivityCard: some View {
        sectionCard(title: "Forrige aktivitet", icon: "clock.arrow.circlepath") {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(FuBrand.blue.opacity(0.22))
                    Image(systemName: "envelope.fill")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(FuBrand.blue)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(isDemoRow ? "Tilbud sendt" : "Siste registrerte aktivitet")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(previousActivity)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(FuBrand.textSecondary)
                }
                Spacer()
                Button { } label: {
                    Image(systemName: "arrow.right.circle")
                        .font(.appScaled(size: 14))
                        .foregroundStyle(FuBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            .padding(10)
            .background(FuBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: AI-forslag

    private var aiSuggestionCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                ZStack {
                    Circle().fill(FuBrand.purpleLight.opacity(0.25))
                    Image(systemName: "sparkles")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(FuBrand.purpleLight)
                }
                .frame(width: 24, height: 24)
                Text("Leadgrid AI foreslår")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(FuBrand.purpleLight)
                Spacer()
            }
            Text("Anders pleier å være tilgjengelig mellom 09-11 på tirsdag. Send heller en SMS først som heads-up — han har lest 3 e-poster denne uka uten å svare. Vurder å ringe direkte til mobilen.")
                .font(.appScaled(size: 12))
                .foregroundStyle(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(FuBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(FuBrand.purple.opacity(0.30), lineWidth: 1)
        )
    }

    // MARK: Danger zone

    private var dangerZone: some View {
        Button { } label: {
            HStack(spacing: 8) {
                Image(systemName: "trash.fill")
                    .font(.appScaled(size: 11, weight: .semibold))
                Text("Slett oppfølging")
                    .font(.appScaled(size: 12, weight: .semibold))
            }
            .foregroundStyle(FuBrand.red)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(FuBrand.red.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(FuBrand.red.opacity(0.30), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Action-bar bunn

    private var actionBar: some View {
        HStack(spacing: 8) {
            Menu {
                Button { } label: { Label("Utsett 30 min",  systemImage: "clock") }
                Button { } label: { Label("Utsett 1 time",   systemImage: "clock") }
                Button { } label: { Label("Utsett til i morgen", systemImage: "calendar") }
                Button { } label: { Label("Utsett 3 dager",  systemImage: "calendar") }
                Button { } label: { Label("Utsett 1 uke",    systemImage: "calendar") }
                Divider()
                Button { } label: { Label("Velg dato/tid…",  systemImage: "calendar.badge.clock") }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.appScaled(size: 11, weight: .semibold))
                    Text("Utsett")
                        .font(.appScaled(size: 12, weight: .semibold))
                    Image(systemName: "chevron.down")
                        .font(.appScaled(size: 9))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 13)
                .background(FuBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(FuBrand.stroke, lineWidth: 1))
            }

            Button { logActivityOpen = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 13, weight: .bold))
                    Text("Loggfør og fullfør")
                        .font(.appScaled(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(
                        colors: [FuBrand.purple, FuBrand.purpleLight],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            FuBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(FuBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    // MARK: Helpers

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, icon: String,
                                              @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: icon)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(FuBrand.purpleLight)
                Text(title)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            content()
        }
        .padding(14)
        .background(FuBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FuBrand.stroke, lineWidth: 1))
    }

    private func call(_ number: String) {
        let cleaned = number.filter { $0.isNumber || $0 == "+" }
        if let url = URL(string: "tel://\(cleaned)") {
            UIApplication.shared.open(url)
        }
    }
    private func email(_ address: String) {
        if let url = URL(string: "mailto:\(address)") {
            UIApplication.shared.open(url)
        }
    }
    private func sms(_ number: String) {
        let cleaned = number.filter { $0.isNumber || $0 == "+" }
        if let url = URL(string: "sms:\(cleaned)") {
            UIApplication.shared.open(url)
        }
    }
}

// File-private utility — dupisert fra LeadsView.swift for å unngå
// fileprivate-tilgangsfeil på tvers av filer i samme mappe.
fileprivate func formatThousands(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.groupingSeparator = " "
    return f.string(from: NSNumber(value: n)) ?? "\(n)"
}
