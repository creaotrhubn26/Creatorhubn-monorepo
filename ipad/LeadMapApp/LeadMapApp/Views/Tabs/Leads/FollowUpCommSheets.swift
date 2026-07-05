// FollowUpCommSheets.swift
//
// Tre kommunikasjons-pickere som åpnes fra FollowUpDetailSheet:
//   - VideoMeetingPicker:    FaceTime / Google Meet (auto-genererte lenker)
//   - SMSPicker:             Vanlig SMS / WhatsApp
//   - EmailTemplatePicker:   6 maler → velg Apple Mail / Outlook → mailto: pre-fylt

import SwiftUI

private enum FcBrand {
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

// MARK: - VideoMeetingPicker (FaceTime / Google Meet)

struct VideoMeetingPicker: View {
    let lead: LeadRow
    @Environment(\.dismiss) private var dismiss
    @State private var selected: Provider = .facetime

    enum Provider: String, CaseIterable, Hashable {
        case facetime = "FaceTime"
        case googleMeet = "Google Meet"
        var icon: String {
            switch self {
            case .facetime:   return "video.circle.fill"
            case .googleMeet: return "video.fill"
            }
        }
        var color: Color {
            switch self {
            case .facetime:   return FcBrand.green
            case .googleMeet: return FcBrand.blue
            }
        }
        var subtitle: String {
            switch self {
            case .facetime:   return "Apple — fungerer på iPhone, iPad, Mac, web"
            case .googleMeet: return "Krever Google-konto eller anonym tilgang"
            }
        }
    }

    private func generatedLink() -> String {
        let short = String(UUID().uuidString.prefix(8)).lowercased()
        switch selected {
        case .facetime:   return "https://facetime.apple.com/join#v=1&p=\(short)&k=abc123"
        case .googleMeet: return "https://meet.google.com/\(short.prefix(3))-\(short.dropFirst(3).prefix(4))-\(short.suffix(3))"
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                leadHeader
                Text("Velg video-tjeneste")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(FcBrand.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                VStack(spacing: 10) {
                    ForEach(Provider.allCases, id: \.self) { p in
                        row(p)
                    }
                }
                .padding(.horizontal, 20)
                Spacer()
                startBar
            }
            .padding(.top, 12)
            .background(FcBrand.bg.ignoresSafeArea())
            .navigationTitle("Video-møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(FcBrand.purpleLight)
                }
            }
            .toolbarBackground(FcBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.medium])
    }

    private var leadHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(lead.companyColor.opacity(0.22))
                Image(systemName: "building.2.fill")
                    .font(.appScaled(size: 16, weight: .semibold))
                    .foregroundStyle(lead.companyColor)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(lead.company)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Med \(lead.contactName)")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(FcBrand.textSecondary)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
    }

    private func row(_ p: Provider) -> some View {
        let isSelected = selected == p
        return Button { selected = p } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(p.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: p.icon)
                        .font(.appScaled(size: 18, weight: .semibold))
                        .foregroundStyle(p.color)
                }
                .frame(width: 46, height: 46)
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.rawValue)
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text(p.subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(FcBrand.textSecondary)
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.appScaled(size: 18))
                    .foregroundStyle(isSelected ? p.color : FcBrand.stroke)
            }
            .padding(12)
            .background(
                isSelected ? p.color.opacity(0.10) : FcBrand.card,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? p.color.opacity(0.45) : FcBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var startBar: some View {
        Button {
            let link = generatedLink()
            if let url = URL(string: link) {
                UIApplication.shared.open(url)
            }
            dismiss()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: selected.icon)
                    .font(.appScaled(size: 14, weight: .bold))
                Text("Start \(selected.rawValue)-møte")
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [selected.color, selected.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.bottom, 20)
    }
}

// MARK: - SMSPicker (SMS / WhatsApp)

struct SMSPicker: View {
    let lead: LeadRow
    let phoneNumber: String
    @Environment(\.dismiss) private var dismiss
    @State private var selected: Channel = .sms
    @State private var quickMessage: String = ""

    enum Channel: String, CaseIterable, Hashable {
        case sms = "Vanlig SMS"
        case whatsapp = "WhatsApp"
        var icon: String {
            switch self {
            case .sms:      return "message.fill"
            case .whatsapp: return "phone.bubble"
            }
        }
        var color: Color {
            switch self {
            case .sms:      return FcBrand.yellow
            case .whatsapp: return FcBrand.green
            }
        }
        var subtitle: String {
            switch self {
            case .sms:      return "Standard tekstmelding via iPhone-app"
            case .whatsapp: return "Krever WhatsApp installert + tilkoblet konto"
            }
        }
    }

    private let quickMessages = [
        "Hei! Har du tid til en kort prat denne uka?",
        "Hei! Ringer deg om 5 min — fungerer det?",
        "Hei! Sender deg en e-post nå med info. La meg vite hva du tenker!",
        "Hei! Bekrefter møtet vårt 10:00 i morgen. Ses!",
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    leadHeader
                    channelSelector
                    quickMessagesCard
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(FcBrand.bg.ignoresSafeArea())
            .navigationTitle("SMS")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(FcBrand.purpleLight)
                }
            }
            .toolbarBackground(FcBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { startBar }
        }
        .presentationDetents([.medium, .large])
    }

    private var leadHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(FcBrand.green.opacity(0.22))
                Image(systemName: "phone.fill")
                    .font(.appScaled(size: 16, weight: .semibold))
                    .foregroundStyle(FcBrand.green)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(lead.contactName)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text(phoneNumber)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(FcBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(FcBrand.stroke, lineWidth: 1))
    }

    private var channelSelector: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Velg kanal")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(FcBrand.textSecondary)
            ForEach(Channel.allCases, id: \.self) { c in
                channelRow(c)
            }
        }
    }

    private func channelRow(_ c: Channel) -> some View {
        let isSelected = selected == c
        return Button { selected = c } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(c.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: c.icon)
                        .font(.appScaled(size: 16, weight: .semibold))
                        .foregroundStyle(c.color)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(c.rawValue)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(c.subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(FcBrand.textSecondary)
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.appScaled(size: 17))
                    .foregroundStyle(isSelected ? c.color : FcBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? c.color.opacity(0.10) : FcBrand.card,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? c.color.opacity(0.45) : FcBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var quickMessagesCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Hurtigmeldinger")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(FcBrand.textSecondary)
            VStack(spacing: 6) {
                ForEach(quickMessages, id: \.self) { msg in
                    Button { quickMessage = msg } label: {
                        HStack(spacing: 8) {
                            Image(systemName: quickMessage == msg ? "checkmark.circle.fill" : "circle")
                                .font(.appScaled(size: 13))
                                .foregroundStyle(quickMessage == msg ? FcBrand.green : FcBrand.stroke)
                            Text(msg)
                                .font(.appScaled(size: 12))
                                .foregroundStyle(.white)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(10)
                        .background(
                            quickMessage == msg ? FcBrand.green.opacity(0.08) : FcBrand.cardHi,
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(quickMessage == msg ? FcBrand.green.opacity(0.4) : FcBrand.stroke, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var startBar: some View {
        Button {
            sendMessage()
            dismiss()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: selected.icon)
                    .font(.appScaled(size: 14, weight: .bold))
                Text("Åpne \(selected.rawValue)")
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [selected.color, selected.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            FcBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(FcBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    private func sendMessage() {
        let cleaned = phoneNumber.filter { $0.isNumber || $0 == "+" }
        let encodedMsg = quickMessage.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString: String
        switch selected {
        case .sms:
            urlString = "sms:\(cleaned)&body=\(encodedMsg)"
        case .whatsapp:
            // WhatsApp deep-link: whatsapp://send?phone=...&text=...
            let waPhone = cleaned.hasPrefix("+") ? String(cleaned.dropFirst()) : cleaned
            urlString = "whatsapp://send?phone=\(waPhone)&text=\(encodedMsg)"
        }
        if let url = URL(string: urlString) {
            UIApplication.shared.open(url) { ok in
                if !ok {
                    // WhatsApp ikke installert — fallback til SMS
                    if selected == .whatsapp,
                       let smsUrl = URL(string: "sms:\(cleaned)&body=\(encodedMsg)") {
                        UIApplication.shared.open(smsUrl)
                    }
                }
            }
        }
    }
}

// MARK: - EmailTemplatePicker (6 maler + app-velger)

struct EmailTemplatePicker: View {
    let lead: LeadRow
    let toEmail: String
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTemplate: EmailTemplate = .followUp
    @State private var subject: String = ""
    @State private var messageBody: String = ""
    @State private var emailApp: EmailApp = .appleMail
    @State private var customized: Bool = false

    enum EmailTemplate: String, CaseIterable, Hashable {
        case followUp = "Vennlig oppfølging"
        case proposalReminder = "Påminnelse om tilbud"
        case quickChat = "Be om kort prat"
        case referenceRequest = "Be om referanse"
        case missedCall = "Returkall — ikke besvart"
        case meetingPrep = "Møte-forberedelse"
        var icon: String {
            switch self {
            case .followUp:         return "hand.wave.fill"
            case .proposalReminder: return "doc.text.fill"
            case .quickChat:        return "bubble.left.and.bubble.right.fill"
            case .referenceRequest: return "star.bubble.fill"
            case .missedCall:       return "phone.down.fill"
            case .meetingPrep:      return "calendar.badge.checkmark"
            }
        }
        var color: Color {
            switch self {
            case .followUp:         return FcBrand.purpleLight
            case .proposalReminder: return FcBrand.blue
            case .quickChat:        return FcBrand.green
            case .referenceRequest: return FcBrand.yellow
            case .missedCall:       return FcBrand.orange
            case .meetingPrep:      return FcBrand.purple
            }
        }

        func subject(lead: LeadRow) -> String {
            switch self {
            case .followUp:         return "Følger opp — \(lead.company)"
            case .proposalReminder: return "Tilbud — \(lead.company)"
            case .quickChat:        return "Har du tid til en kort prat?"
            case .referenceRequest: return "Spørsmål om referanse"
            case .missedCall:       return "Prøvde å ringe — \(lead.company)"
            case .meetingPrep:      return "Klar for møtet — agenda"
            }
        }

        func body(lead: LeadRow, contactName: String) -> String {
            let firstName = contactName.split(separator: " ").first.map(String.init) ?? contactName
            switch self {
            case .followUp:
                return """
                Hei \(firstName),

                Bare en kort melding for å høre hvordan det går med vurderingen av tilbudet vårt. Er det noe jeg kan svare ut, eller en annen vinkel jeg burde forklare?

                Jeg er fleksibel hvis du vil ta en kort prat denne uka.

                Med vennlig hilsen,
                Lars Kristensen
                Leadgrid · Salgssjef
                """
            case .proposalReminder:
                return """
                Hei \(firstName),

                Jeg ville bare sjekke at tilbudet jeg sendte for noen dager siden kom frem og at du har hatt tid til å se på det. Hvis det er noe som er uklart eller noe du vil at jeg endrer, gi gjerne beskjed.

                Vi har en god kapasitet i Q3 hvis vi skulle gå videre.

                Med vennlig hilsen,
                Lars Kristensen
                """
            case .quickChat:
                return """
                Hei \(firstName),

                Har du tid til en 15-min prat denne uka? Jeg vil gjerne høre kort hva som er prioritetene deres for 2026, så jeg kan se om vi i det hele tatt passer dere best.

                Foreslår: tirsdag 10:00, onsdag 14:00 eller torsdag 09:30 — passer noen?

                Mvh,
                Lars
                """
            case .referenceRequest:
                return """
                Hei \(firstName),

                Vi er i dialog med et selskap i samme bransje som dere, og de spør om referanseprosjekt. Ville det vært ok om jeg gir dem ditt navn + e-post som referanse?

                De kommer trolig til å spørre kort om hvordan vi har levert hos dere.

                Tusen takk for å vurdere det!

                Mvh,
                Lars Kristensen
                """
            case .missedCall:
                return """
                Hei \(firstName),

                Prøvde å ringe deg nå men kom ikke gjennom. Jeg ringer gjerne tilbake — er det et bedre tidspunkt for deg i ettermiddag/morgen?

                Alternativt kan du svare med 1-2 ord på hva som passer.

                Mvh,
                Lars
                """
            case .meetingPrep:
                return """
                Hei \(firstName),

                Ser frem til møtet vårt! For at det skal bli mest mulig nyttig, har jeg satt opp en kort agenda:

                1. Kort status — der dere står i dag
                2. Hva ville endret bildet for dere?
                3. Demonstrasjon av løsningen
                4. Pris og veien videre

                Si fra om du vil legge til noe.

                Mvh,
                Lars
                """
            }
        }
    }

    enum EmailApp: String, CaseIterable, Hashable {
        case appleMail = "Apple Mail"
        case outlook = "Outlook"
        case gmail = "Gmail"
        var icon: String {
            switch self {
            case .appleMail: return "envelope.fill"
            case .outlook:   return "o.circle.fill"
            case .gmail:     return "g.circle.fill"
            }
        }
        var color: Color {
            switch self {
            case .appleMail: return FcBrand.blue
            case .outlook:   return FcBrand.purpleLight
            case .gmail:     return FcBrand.red
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    leadHeader
                    templatesGrid
                    previewCard
                    appPicker
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(FcBrand.bg.ignoresSafeArea())
            .navigationTitle("E-post-mal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(FcBrand.purpleLight)
                }
            }
            .toolbarBackground(FcBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { startBar }
            .onAppear {
                applyTemplate(selectedTemplate)
            }
            .onChange(of: selectedTemplate) { _, new in
                if !customized {
                    applyTemplate(new)
                }
            }
        }
    }

    private func applyTemplate(_ t: EmailTemplate) {
        subject = t.subject(lead: lead)
        messageBody = t.body(lead: lead, contactName: lead.contactName)
    }

    private var leadHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(FcBrand.purple.opacity(0.25))
                Text(initials(lead.contactName))
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(FcBrand.purpleLight)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text("Til: \(lead.contactName)")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text(toEmail)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(FcBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(FcBrand.stroke, lineWidth: 1))
    }

    private var templatesGrid: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "doc.text.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(FcBrand.purpleLight)
                Text("Velg mal")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(EmailTemplate.allCases.count) maler")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(FcBrand.textSecondary)
            }
            let cols = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]
            LazyVGrid(columns: cols, spacing: 8) {
                ForEach(EmailTemplate.allCases, id: \.self) { t in
                    templateCard(t)
                }
            }
        }
    }

    private func templateCard(_ t: EmailTemplate) -> some View {
        let isSelected = selectedTemplate == t
        return Button {
            selectedTemplate = t
            customized = false
        } label: {
            HStack(spacing: 9) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(t.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: t.icon)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(t.color)
                }
                .frame(width: 32, height: 32)
                Text(t.rawValue)
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isSelected ? t.color.opacity(0.5) : FcBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var previewCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "eye.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(FcBrand.purpleLight)
                Text("Forhåndsvis + rediger")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                if customized {
                    Button { applyTemplate(selectedTemplate); customized = false } label: {
                        Text("Tilbakestill")
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(FcBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("EMNE")
                    .font(.appScaled(size: 9, weight: .bold))
                    .foregroundStyle(FcBrand.textTertiary)
                TextField("", text: $subject)
                    .textFieldStyle(.plain)
                    .foregroundStyle(.white)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .padding(.horizontal, 10).padding(.vertical, 9)
                    .background(FcBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(FcBrand.stroke, lineWidth: 1))
                    .onChange(of: subject) { _, _ in customized = true }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("INNHOLD")
                    .font(.appScaled(size: 9, weight: .bold))
                    .foregroundStyle(FcBrand.textTertiary)
                TextEditor(text: $messageBody)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.appScaled(size: 12))
                    .frame(minHeight: 160)
                    .padding(10)
                    .background(FcBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(FcBrand.stroke, lineWidth: 1))
                    .onChange(of: messageBody) { _, _ in customized = true }
            }
        }
        .padding(14)
        .background(FcBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(FcBrand.stroke, lineWidth: 1))
    }

    private var appPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "app.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(FcBrand.purpleLight)
                Text("Åpne i")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            HStack(spacing: 8) {
                ForEach(EmailApp.allCases, id: \.self) { a in
                    appButton(a)
                }
            }
        }
    }

    private func appButton(_ a: EmailApp) -> some View {
        let isSelected = emailApp == a
        return Button { emailApp = a } label: {
            VStack(spacing: 5) {
                ZStack {
                    Circle().fill(a.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: a.icon)
                        .font(.appScaled(size: 16, weight: .semibold))
                        .foregroundStyle(a.color)
                }
                .frame(width: 38, height: 38)
                Text(a.rawValue)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : FcBrand.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                isSelected ? a.color.opacity(0.10) : FcBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isSelected ? a.color.opacity(0.45) : FcBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var startBar: some View {
        Button {
            sendEmail()
            dismiss()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: emailApp.icon)
                    .font(.appScaled(size: 14, weight: .bold))
                Text("Åpne i \(emailApp.rawValue)")
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [emailApp.color, emailApp.color.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            FcBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(FcBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    private func sendEmail() {
        let encSubj = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let encBody = messageBody.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString: String
        switch emailApp {
        case .appleMail:
            urlString = "mailto:\(toEmail)?subject=\(encSubj)&body=\(encBody)"
        case .outlook:
            urlString = "ms-outlook://compose?to=\(toEmail)&subject=\(encSubj)&body=\(encBody)"
        case .gmail:
            urlString = "googlegmail://co?to=\(toEmail)&subject=\(encSubj)&body=\(encBody)"
        }
        if let url = URL(string: urlString) {
            UIApplication.shared.open(url) { ok in
                if !ok {
                    // Fallback til mailto:
                    if let fb = URL(string: "mailto:\(toEmail)?subject=\(encSubj)&body=\(encBody)") {
                        UIApplication.shared.open(fb)
                    }
                }
            }
        }
    }

    private func initials(_ name: String) -> String {
        name.split(separator: " ").prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }
}
