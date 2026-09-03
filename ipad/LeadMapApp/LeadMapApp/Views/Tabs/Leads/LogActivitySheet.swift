// LogActivitySheet.swift
//
// Modal som åpnes når salgssjefen tapper "Loggfør aktivitet" i lead-
// sidebaren. Lar deg logge én av 8 aktivitetstyper med utfall + notat.
// Auto-flytter pipeline-stage basert på utfall (Vunnet → Won, etc.).

import SwiftUI

private enum LaBrand {
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

struct LogActivitySheet: View {
    let lead: LeadRow
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    @State private var type: ActivityType = .call
    @State private var date: Date = Date()
    @State private var durationMinutes: Int = 15
    @State private var outcome: Outcome = .spoke
    @State private var note: String = ""
    @State private var showTranscription = false
    @State private var scheduleFollowUp: Bool = true
    @State private var movePipelineStage: Bool = true
    @State private var followUpDate: Date = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
    @State private var isSaving = false
    @State private var saveError: String?

    // Smart handlinger (Apple Intelligence / TranscriptIntelligence): analyser
    // notatet on-device (iOS 26+) eller via backend, og vis SmartTranscript-
    // ActionsSheet med ryddet tekst + oppgaver + oppfølging.
    @State private var smartAnalysis: TranscriptAnalysis?
    @State private var smartSource: TranscriptIntelligenceSource = .backend
    @State private var showSmartSheet = false
    @State private var smartAnalyzing = false
    @State private var smartError: String?

    enum ActivityType: String, CaseIterable, Hashable {
        case call = "Telefon"
        case email = "E-post"
        case meeting = "Møte"
        case note = "Notat"
        case visit = "Befaring"
        case demo = "Demo"
        case proposal = "Tilbud"
        case dealClose = "Avslutt deal"
        var icon: String {
            switch self {
            case .call:      return "phone.fill"
            case .email:     return "envelope.fill"
            case .meeting:   return "calendar"
            case .note:      return "note.text"
            case .visit:     return "building.2.fill"
            case .demo:      return "play.rectangle.fill"
            case .proposal:  return "doc.text.fill"
            case .dealClose: return "checkmark.seal.fill"
            }
        }
        var color: Color {
            switch self {
            case .call:      return LaBrand.green
            case .email:     return LaBrand.blue
            case .meeting:   return LaBrand.purple
            case .note:      return LaBrand.yellow
            case .visit:     return LaBrand.orange
            case .demo:      return LaBrand.purpleLight
            case .proposal:  return LaBrand.blue
            case .dealClose: return LaBrand.yellow
            }
        }
        var needsDuration: Bool {
            self == .call || self == .meeting || self == .visit || self == .demo
        }
        var backendKind: String {
            switch self {
            case .call: return "call"
            case .email: return "email"
            case .meeting: return "meeting"
            case .note: return "note"
            case .visit: return "visit"
            case .demo: return "demo"
            case .proposal: return "proposal"
            case .dealClose: return "deal_close"
            }
        }
        var visitType: String {
            switch self {
            case .call: return "phone"
            case .email, .proposal: return "email"
            case .meeting, .demo: return "online_meeting"
            case .visit: return "physical"
            case .note, .dealClose: return "research"
            }
        }
    }

    enum Outcome: String, CaseIterable, Hashable {
        case noAnswer = "Ingen svar"
        case spoke = "Snakket med kontakt"
        case meetingBooked = "Møte avtalt"
        case proposalSent = "Tilbud sendt"
        case interested = "Interessert"
        case notInterested = "Ikke interessert"
        case won = "Vunnet 🎉"
        case lost = "Tapt"
        var icon: String {
            switch self {
            case .noAnswer:      return "phone.down.fill"
            case .spoke:         return "checkmark.circle.fill"
            case .meetingBooked: return "calendar.badge.plus"
            case .proposalSent:  return "paperplane.fill"
            case .interested:    return "hand.thumbsup.fill"
            case .notInterested: return "hand.thumbsdown.fill"
            case .won:           return "trophy.fill"
            case .lost:          return "xmark.octagon.fill"
            }
        }
        var color: Color {
            switch self {
            case .noAnswer:      return LaBrand.textSecondary
            case .spoke:         return LaBrand.blue
            case .meetingBooked: return LaBrand.purple
            case .proposalSent:  return LaBrand.purpleLight
            case .interested:    return LaBrand.green
            case .notInterested: return LaBrand.orange
            case .won:           return LaBrand.yellow
            case .lost:          return LaBrand.red
            }
        }
        /// Hvilken pipeline-stage skal automatisk settes hvis brukeren
        /// har slått på "Flytt stage". Nil = ikke endre.
        var backendValue: String {
            switch self {
            case .noAnswer: return "no_answer"
            case .spoke: return "spoke"
            case .meetingBooked: return "meeting_booked"
            case .proposalSent: return "proposal_sent"
            case .interested: return "interested"
            case .notInterested: return "not_interested"
            case .won: return "won"
            case .lost: return "lost"
            }
        }
        var backendStatus: String? {
            switch self {
            case .noAnswer: return nil
            case .spoke: return "visited"
            case .meetingBooked: return "meeting_booked"
            case .proposalSent: return "proposal_sent"
            case .interested: return "interested"
            case .notInterested: return "declined"
            case .won: return "won"
            case .lost: return "lost"
            }
        }
        var movesToStage: String? {
            switch self {
            case .noAnswer:      return nil
            case .spoke:         return "Kontaktet"
            case .meetingBooked: return "Møte avtalt"
            case .proposalSent:  return "Tilbud sendt"
            case .interested:    return "Møte avtalt"
            case .notInterested: return nil
            case .won:           return "Vunnet"
            case .lost:          return "Tapt"
            }
        }
    }

    private let durations = [5, 10, 15, 20, 30, 45, 60]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    leadHeader
                    typeSelector
                    dateAndDuration
                    outcomeSelector
                    noteCard
                    followUpCard
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(LaBrand.bg.ignoresSafeArea())
            .sheet(isPresented: $showSmartSheet) {
                if let analysis = smartAnalysis {
                    SmartTranscriptActionsSheet(
                        analysis: analysis,
                        leadName: lead.company,
                        onApplyResolvedText: { note = $0 },
                        onApplyFollowUp: { date in
                            followUpDate = date
                            scheduleFollowUp = true
                        }
                    )
                }
            }
            .navigationTitle("Loggfør aktivitet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(LaBrand.purpleLight)
                }
            }
            .toolbarBackground(LaBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { actionBar }
        }
        .macCatalystSheetSize(minWidth: 820, minHeight: 720)
    }

    // MARK: Lead-header

    private var leadHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(lead.companyColor.opacity(0.22))
                Image(systemName: "building.2.fill")
                    .font(.appScaled(size: 18, weight: .semibold))
                    .foregroundStyle(lead.companyColor)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(lead.company)
                    .font(.appScaled(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                Text("Logger som Lars Kristensen · \(formattedNow)")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LaBrand.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(LaBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LaBrand.stroke, lineWidth: 1))
    }

    private var formattedNow: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM 'kl.' HH:mm"
        return f.string(from: Date())
    }

    // MARK: Aktivitets-type-velger (4x2 grid)

    private var typeSelector: some View {
        sectionCard(title: "Hva ble gjort?", icon: "bolt.fill") {
            // iPhone: 4 kolonner blir for trangt på compact width — 2 der.
            let cols = MacCatalystGrid.adaptive(phone: 2, iPad: 4, mac: 4, spacing: 8)
            LazyVGrid(columns: cols, spacing: 8) {
                ForEach(ActivityType.allCases, id: \.self) { t in
                    typeChip(t)
                }
            }
        }
    }

    private func typeChip(_ t: ActivityType) -> some View {
        let isSelected = type == t
        return Button { type = t } label: {
            VStack(spacing: 5) {
                ZStack {
                    Circle().fill(t.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: t.icon)
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(t.color)
                }
                .frame(width: 36, height: 36)
                Text(t.rawValue)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : LaBrand.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9)
            .background(
                isSelected ? t.color.opacity(0.10) : LaBrand.cardHi,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? t.color.opacity(0.5) : LaBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Dato + varighet

    private var dateAndDuration: some View {
        sectionCard(title: "Når?", icon: "calendar.badge.clock") {
            VStack(spacing: 10) {
                DatePicker("", selection: $date, in: ...Date())
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .colorScheme(.dark)
                    .accentColor(LaBrand.purpleLight)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 10).padding(.vertical, 10)
                    .background(LaBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LaBrand.stroke, lineWidth: 1))

                if type.needsDuration {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Varighet")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(LaBrand.textSecondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(durations, id: \.self) { d in
                                    durationChip(d)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func durationChip(_ minutes: Int) -> some View {
        let isSelected = durationMinutes == minutes
        return Button { durationMinutes = minutes } label: {
            Text("\(minutes) min")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(isSelected ? .white : LaBrand.textSecondary)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(
                    isSelected
                        ? AnyShapeStyle(LinearGradient(
                            colors: [LaBrand.purple, LaBrand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        ))
                        : AnyShapeStyle(LaBrand.cardHi),
                    in: Capsule()
                )
                .overlay(Capsule().stroke(isSelected ? Color.clear : LaBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Utfall

    private var outcomeSelector: some View {
        sectionCard(title: "Hva ble utfallet?", icon: "flag.checkered") {
            VStack(spacing: 6) {
                ForEach(Outcome.allCases, id: \.self) { o in
                    outcomeRow(o)
                }
            }
        }
    }

    private func outcomeRow(_ o: Outcome) -> some View {
        let isSelected = outcome == o
        return Button { outcome = o } label: {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(o.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: o.icon)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(o.color)
                }
                .frame(width: 32, height: 32)
                Text(o.rawValue)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                if let stage = o.movesToStage, movePipelineStage, isSelected {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.right")
                            .font(.appScaled(size: 9, weight: .bold))
                        Text(stage)
                            .font(.appScaled(size: 10, weight: .bold))
                    }
                    .foregroundStyle(LaBrand.purpleLight)
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(LaBrand.purple.opacity(0.20), in: Capsule())
                }
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.appScaled(size: 15))
                    .foregroundStyle(isSelected ? o.color : LaBrand.stroke)
            }
            .padding(9)
            .background(
                isSelected ? o.color.opacity(0.08) : LaBrand.cardHi,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? o.color.opacity(0.4) : LaBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Notat

    private var noteCard: some View {
        sectionCard(title: "Notat (valgfritt)", icon: "note.text") {
            VStack(alignment: .leading, spacing: 8) {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: $note)
                        .scrollContentBackground(.hidden)
                        .foregroundStyle(.white)
                        .font(.appScaled(size: 13))
                        .frame(minHeight: 90)
                        .padding(10)
                        .background(LaBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(LaBrand.stroke, lineWidth: 1))
                    if note.isEmpty {
                        Text(notePlaceholder)
                            .font(.appScaled(size: 13))
                            .foregroundStyle(LaBrand.textTertiary)
                            .padding(.horizontal, 14).padding(.vertical, 16)
                            .allowsHitTesting(false)
                    }
                }
                // Live-transkripsjon (2026-07-04): on-device nb-NO tale→
                // tekst rett inn i notatet — transkriber møtet/besøket i
                // stedet for å skrive.
                HStack(spacing: 16) {
                    Button { showTranscription = true } label: {
                        Label("Transkriber møtet", systemImage: "waveform.badge.mic")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(LaBrand.purpleLight)
                    }
                    .buttonStyle(.plain)

                    // Smart handlinger: analyser notatet (on-device iOS 26+,
                    // ellers backend) → ryddet tekst, oppgaver, oppfølging.
                    if !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Button { runSmartActions() } label: {
                            Label(smartAnalyzing ? "Analyserer…" : "Smart handlinger",
                                  systemImage: smartAnalyzing ? "hourglass" : "sparkles")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(LaBrand.yellow)
                        }
                        .buttonStyle(.plain)
                        .disabled(smartAnalyzing)
                    }
                }
                if let smartError {
                    Text(smartError)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(.red)
                }
            }
        }
        .sheet(isPresented: $showTranscription) {
            LiveTranscriptionSheet(onUse: { transcript in
                note = note.isEmpty ? transcript : note + "\n\n" + transcript
            })
        }
    }

    /// Kjør transkript-analyse på notatet og vis SmartTranscriptActionsSheet.
    private func runSmartActions() {
        guard let api = appState.api else {
            smartError = "Ingen tilkobling for analyse."
            return
        }
        let text = note
        smartAnalyzing = true
        smartError = nil
        let intel = TranscriptIntelligenceFactory.make(api: api, leadId: lead.backendId)
        Task {
            do {
                let result = try await intel.analyze(transcript: text, leadName: lead.company)
                smartAnalysis = result.analysis
                smartSource = result.source
                showSmartSheet = true
            } catch {
                smartError = "Kunne ikke analysere notatet akkurat nå."
            }
            smartAnalyzing = false
        }
    }

    private var notePlaceholder: String {
        switch type {
        case .call:      return "Hva ble snakket om? Hvem svarte?"
        case .email:     return "Hva er kjernen i e-posten du sendte?"
        case .meeting:   return "Hva ble diskutert? Avklart? Neste steg?"
        case .note:      return "Skriv notat om denne leaden..."
        case .visit:     return "Hva så du? Hvem møtte du?"
        case .demo:      return "Hvilke features ble vist? Reaksjoner?"
        case .proposal:  return "Sammendrag av tilbudet du sendte"
        case .dealClose: return "Hvorfor vant/tapte vi dette?"
        }
    }

    // MARK: Følge-handlinger

    private var followUpCard: some View {
        sectionCard(title: "Følge-handlinger", icon: "checklist") {
            VStack(spacing: 10) {
                Toggle(isOn: $scheduleFollowUp) {
                    HStack(spacing: 10) {
                        ZStack {
                            Circle().fill(LaBrand.purple.opacity(0.22))
                            Image(systemName: "calendar.badge.plus")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(LaBrand.purpleLight)
                        }
                        .frame(width: 30, height: 30)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Avtal ny oppfølging")
                                .font(.appScaled(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("Legg automatisk i kalenderen")
                                .font(.appScaled(size: 10))
                                .foregroundStyle(LaBrand.textSecondary)
                        }
                    }
                }
                .tint(LaBrand.purple)

                if scheduleFollowUp {
                    DatePicker("", selection: $followUpDate, in: Date()...)
                        .datePickerStyle(.compact)
                        .labelsHidden()
                        .colorScheme(.dark)
                        .accentColor(LaBrand.purpleLight)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 10).padding(.vertical, 8)
                        .background(LaBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(LaBrand.stroke, lineWidth: 1))
                }

                Toggle(isOn: $movePipelineStage) {
                    HStack(spacing: 10) {
                        ZStack {
                            Circle().fill(LaBrand.green.opacity(0.22))
                            Image(systemName: "arrow.right.circle.fill")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(LaBrand.green)
                        }
                        .frame(width: 30, height: 30)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Flytt i pipeline")
                                .font(.appScaled(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            if let stage = outcome.movesToStage {
                                Text("Auto-stage: \(stage)")
                                    .font(.appScaled(size: 10))
                                    .foregroundStyle(LaBrand.green)
                            } else {
                                Text("Ingen endring fra dette utfallet")
                                    .font(.appScaled(size: 10))
                                    .foregroundStyle(LaBrand.textTertiary)
                            }
                        }
                    }
                }
                .tint(LaBrand.purple)
                .disabled(outcome.movesToStage == nil)
                .opacity(outcome.movesToStage == nil ? 0.55 : 1)
            }
        }
    }

    // MARK: Action-bar bunn

    private var actionBar: some View {
        VStack(spacing: 0) {
            if let saveError {
                Label(saveError, systemImage: "exclamationmark.triangle.fill")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LaBrand.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20).padding(.top, 8)
                    .background(LaBrand.cardHi)
            }
            // Sammendrag-rad
            HStack(spacing: 8) {
                Image(systemName: type.icon)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(type.color)
                Text(type.rawValue)
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                Text("·")
                    .foregroundStyle(LaBrand.textTertiary)
                Text(outcome.rawValue)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(outcome.color)
                Spacer()
                if let stage = outcome.movesToStage, movePipelineStage {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.right.circle.fill")
                            .font(.appScaled(size: 10))
                        Text("→ \(stage)")
                            .font(.appScaled(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(LaBrand.green)
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 8)
            .background(LaBrand.cardHi)

            // Action-knapper
            HStack(spacing: 10) {
                Button { dismiss() } label: {
                    Text("Avbryt")
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(LaBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LaBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)

                Button { Task { await save(dismissAfter: false) } } label: {
                    Text(isSaving ? "Lagrer…" : "Lagre + lag ny")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(LaBrand.purpleLight)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(LaBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LaBrand.purple.opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(isSaving)

                Button { Task { await save(dismissAfter: true) } } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.appScaled(size: 13, weight: .bold))
                        Text(isSaving ? "Lagrer…" : "Lagre")
                            .font(.appScaled(size: 14, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        LinearGradient(
                            colors: [LaBrand.purple, LaBrand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 11)
                    )
                }
                .buttonStyle(.plain)
                .disabled(isSaving)
            }
            .padding(.horizontal, 20).padding(.vertical, 12)
            .background(
                LaBrand.bg.opacity(0.95)
                    .overlay(Rectangle().fill(LaBrand.stroke).frame(height: 1), alignment: .top)
            )
        }
    }

    private func save(dismissAfter: Bool) async {
        guard !isSaving else { return }
        guard !DemoModeManager.isActiveNonisolated else {
            saveError = "Demo-aktivitet lagres ikke"
            return
        }
        guard let api = appState.api, let leadId = lead.backendId else {
            saveError = "Du må være innlogget og leaden må være lagret"
            return
        }

        isSaving = true
        saveError = nil
        defer { isSaving = false }

        var body: [String: Any] = [
            "visitType": type.visitType,
            "visitDatetime": ISO8601DateFormatter().string(from: date),
            "activityKind": type.backendKind,
            "outcome": outcome.backendValue,
        ]
        if type.needsDuration { body["durationMinutes"] = durationMinutes }
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedNote.isEmpty {
            body["conversationSummary"] = trimmedNote
            body["notes"] = trimmedNote
        }
        if movePipelineStage, let status = outcome.backendStatus {
            body["newStatus"] = status
        }
        if scheduleFollowUp {
            body["nextAction"] = "Følg opp etter \(type.rawValue.lowercased())"
            body["nextFollowUpAt"] = ISO8601DateFormatter().string(from: followUpDate)
        }

        do {
            try await api.logVisit(
                leadId: leadId, body: body,
                organizationId: appState.activeOrganizationId
            )
            await appState.refreshAll()
            if dismissAfter {
                dismiss()
            } else {
                type = .call
                date = Date()
                durationMinutes = 15
                outcome = .spoke
                note = ""
                followUpDate = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
            }
        } catch {
            saveError = error.localizedDescription
        }
    }

    // MARK: Helper

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, icon: String,
                                              @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: icon)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LaBrand.purpleLight)
                Text(title)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            content()
        }
        .padding(14)
        .background(LaBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LaBrand.stroke, lineWidth: 1))
    }
}
