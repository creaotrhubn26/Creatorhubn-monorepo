// PondusQuiz.swift
//
// Interaktiv Pondus-quiz (Akademiets kapittel «Test deg selv» — slice A av
// Pondus→Akademi-utbyggingen). 12 ærlige scenario-spørsmål → score per
// dimensjon (0-100) → profil med sterkeste/svakeste dimensjon + anbefalt
// kapittel. Persisteres alltid lokalt (UserDefaults); POST-es til backend
// (mig 0410) når API finnes og demo er AV.

import SwiftUI

// MARK: - Modell

enum PondusDimension: String, CaseIterable {
    case autoritet, klarhet, troverdighet, trygghet, fremdrift

    var label: String { rawValue.capitalized }

    var tint: Color {
        switch self {
        case .autoritet:    return LBrand.purpleLight
        case .klarhet:      return LBrand.blue
        case .troverdighet: return LBrand.yellow
        case .trygghet:     return LBrand.orange
        case .fremdrift:    return LBrand.green
        }
    }

    /// Akademi-kapittelet som trener denne dimensjonen (kap. 3-7).
    var recommendedChapterTitle: String {
        switch self {
        case .autoritet:    return "Autoritet — stå inne for verdien"
        case .klarhet:      return "Klarhet — ett poeng om gangen"
        case .troverdighet: return "Troverdighet — vis at du har gjort jobben"
        case .trygghet:     return "Trygghet — stå i det vanskelige"
        case .fremdrift:    return "Fremdrift — neste konkrete steg"
        }
    }
}

struct PondusQuizQuestion: Identifiable {
    let id: String
    let dimension: PondusDimension
    let text: String
    /// Alternativer i visningsrekkefølge. points 1-4 — avslører ALDRI i UI.
    let options: [(text: String, points: Int)]
}

enum PondusQuizBank {
    static let questions: [PondusQuizQuestion] = [
        PondusQuizQuestion(id: "q1", dimension: .autoritet,
            text: "Kunden spør: «Hvorfor skal vi velge dere fremfor konkurrenten?»",
            options: [
                ("Jeg ramser opp alt som er bra med oss", 2),
                ("Jeg forklarer hvorfor konkurrenten er dårligere", 1),
                ("Jeg spør hva som er viktigst for dem — og svarer konkret på det", 4),
                ("Jeg sier begge er gode, men vi er billigere", 1),
            ]),
        PondusQuizQuestion(id: "q2", dimension: .autoritet,
            text: "Kunden tester deg med et teknisk spørsmål du ikke kan svare på.",
            options: [
                ("Jeg gir et omtrentlig svar så jeg ikke mister ansikt", 1),
                ("Jeg sier ærlig at jeg ikke vet — og lover konkret svar innen i morgen", 4),
                ("Jeg vrir samtalen over på noe jeg kan", 2),
                ("Jeg sier «det må jeg sjekke» og håper de glemmer det", 2),
            ]),
        PondusQuizQuestion(id: "q3", dimension: .klarhet,
            text: "Du får 5 minutter med beslutningstakeren. Hvordan bruker du dem?",
            options: [
                ("Rekker over så mange funksjoner som mulig", 1),
                ("Ett poeng: deres største problem — og hvordan vi løser det", 4),
                ("Forteller om selskapet vårt og historien", 2),
                ("Lar dem styre samtalen helt", 2),
            ]),
        PondusQuizQuestion(id: "q4", dimension: .klarhet,
            text: "Kunden sier: «Dette ble litt mye informasjon.»",
            options: [
                ("Jeg oppsummerer alt en gang til", 2),
                ("Jeg spør «hva er viktigst for deg?» — og dropper resten", 4),
                ("Jeg sender en lang e-post etterpå med alt", 1),
                ("Jeg fortsetter, men snakker saktere", 1),
            ]),
        PondusQuizQuestion(id: "q5", dimension: .troverdighet,
            text: "Kunden er skeptisk til om løsningen faktisk virker.",
            options: [
                ("Jeg forsikrer dem om at den virker veldig bra", 1),
                ("Jeg viser et konkret resultat fra en lignende kunde", 4),
                ("Jeg tilbyr rabatt for å senke terskelen", 1),
                ("Jeg foreslår en liten pilot med målbare kriterier", 3),
            ]),
        PondusQuizQuestion(id: "q6", dimension: .troverdighet,
            text: "Hva gjør du FØR et førstemøte med en ny bedrift?",
            options: [
                ("Ingenting spesielt — jeg tar det på sparket", 1),
                ("Leser meg opp på bransjen og nettsiden, og finner ett konkret knaggpunkt", 4),
                ("Sjekker navnet på daglig leder", 2),
                ("Øver på presentasjonen min", 2),
            ]),
        PondusQuizQuestion(id: "q7", dimension: .trygghet,
            text: "Kunden sier: «Dette er altfor dyrt.» Din første reaksjon?",
            options: [
                ("Jeg tilbyr rabatt med en gang", 1),
                ("Jeg blir usikker og stille", 1),
                ("Jeg spør rolig: «Dyrt sammenlignet med hva?»", 4),
                ("Jeg forsvarer prisen med flere funksjoner", 2),
            ]),
        PondusQuizQuestion(id: "q8", dimension: .trygghet,
            text: "Midt i møtet kommer kunden med direkte kritikk av produktet.",
            options: [
                ("Jeg takker for ærligheten og utforsker hva som ligger bak", 4),
                ("Jeg motargumenterer umiddelbart", 2),
                ("Jeg beklager og lover at det skal bli bedre", 2),
                ("Jeg ler det bort og går videre", 1),
            ]),
        PondusQuizQuestion(id: "q9", dimension: .trygghet,
            text: "På døra: «Ikke interessert!» — nesten før du har sagt hei.",
            options: [
                ("Jeg går videre til neste dør med en gang", 2),
                ("Én rolig setning om hvorfor naboene sa ja — og respekterer et nei", 4),
                ("Jeg prøver å holde samtalen i gang for enhver pris", 1),
                ("Jeg tar det personlig og trenger en pause", 1),
            ]),
        PondusQuizQuestion(id: "q10", dimension: .fremdrift,
            text: "Møtet går mot slutten og stemningen er god. Hvordan avslutter du?",
            options: [
                ("«Tenk på det, så høres vi!»", 1),
                ("Jeg avtaler konkret neste steg med dato før jeg går", 4),
                ("Jeg sender oppsummering på e-post og venter", 2),
                ("Jeg spør om de vil signere nå", 2),
            ]),
        PondusQuizQuestion(id: "q11", dimension: .fremdrift,
            text: "Kunden sier: «Vi må tenke litt på det.»",
            options: [
                ("«Selvfølgelig, ta den tiden dere trenger»", 1),
                ("«Hva trenger dere å avklare — og når kan vi ta en beslutning?»", 4),
                ("«Skal jeg ringe deg neste uke?»", 3),
                ("Jeg sier ok og håper de tar kontakt", 1),
            ]),
        PondusQuizQuestion(id: "q12", dimension: .fremdrift,
            text: "Hvor mange av dine 10 siste samtaler endte med en konkret avtalt neste handling?",
            options: [
                ("0–2", 1),
                ("3–5", 2),
                ("6–8", 3),
                ("9–10", 4),
            ]),
    ]
}

// MARK: - Lokal persistering

struct PondusQuizLocalResult: Codable {
    let autoritet: Int
    let klarhet: Int
    let troverdighet: Int
    let trygghet: Int
    let fremdrift: Int
    let total: Int
    let date: Date

    func score(for dim: PondusDimension) -> Int {
        switch dim {
        case .autoritet:    return autoritet
        case .klarhet:      return klarhet
        case .troverdighet: return troverdighet
        case .trygghet:     return trygghet
        case .fremdrift:    return fremdrift
        }
    }

    var weakest: PondusDimension {
        PondusDimension.allCases.min { score(for: $0) < score(for: $1) } ?? .autoritet
    }

    /// Nivå-etikett for total-scoren.
    var tierLabel: String {
        switch total {
        case 80...: return "Høy pondus"
        case 60...: return "Solid pondus"
        case 40...: return "På vei"
        default:    return "Under bygging"
        }
    }

    private static let key = "pondus.quiz.latest"

    static func load() -> PondusQuizLocalResult? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(PondusQuizLocalResult.self, from: data)
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }
}

// MARK: - Quiz-sheet

struct PondusQuizSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    /// Kalles når en gjennomføring er fullført — Akademiet markerer
    /// quiz-kapittelet som sett.
    var onCompleted: ((PondusQuizLocalResult) -> Void)? = nil

    private enum Phase {
        case intro
        case question
        case result
    }

    @State private var phase: Phase = .intro
    @State private var qIndex = 0
    @State private var answers: [String: Int] = [:]        // questionId → valgt indeks
    @State private var selectedOption: Int?
    @State private var result: PondusQuizLocalResult?
    @State private var previous: PondusQuizLocalResult? = PondusQuizLocalResult.load()
    @State private var advancing = false

    private let questions = PondusQuizBank.questions
    /// True når svaret POST-es til backend (ekte modus m/ API).
    private var savesRemotely: Bool {
        !DemoModeManager.isActiveNonisolated && appState.api != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                switch phase {
                case .intro:    introView
                case .question: questionView
                case .result:   resultView
                }
            }
            .navigationTitle("Test din pondus")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
            }
        }
    }

    // MARK: Intro

    private var introView: some View {
        ScrollView {
            VStack(spacing: 18) {
                ZStack {
                    Circle().fill(LBrand.purple.opacity(0.18))
                        .frame(width: 92, height: 92)
                    Image(systemName: "checkmark.seal.fill")
                        .font(.appScaled(size: 40, weight: .semibold))
                        .foregroundStyle(LBrand.purpleLight)
                }
                .padding(.top, 30)

                Text("Test din pondus")
                    .font(.appScaled(size: 24, weight: .heavy))
                    .foregroundStyle(.white)

                Text("12 ærlige spørsmål — ingen svar er åpenbart riktige. Du får en profil per dimensjon.")
                    .font(.appScaled(size: 14))
                    .foregroundStyle(LBrand.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 36)

                if let prev = previous {
                    VStack(spacing: 8) {
                        Text("FORRIGE RESULTAT")
                            .font(.appScaled(size: 9, weight: .black))
                            .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                        HStack(spacing: 10) {
                            Text("\(prev.total)")
                                .font(.appScaled(size: 30, weight: .heavy, design: .rounded))
                                .foregroundStyle(LBrand.purpleLight)
                                .monospacedDigit()
                            VStack(alignment: .leading, spacing: 2) {
                                Text(prev.tierLabel)
                                    .font(.appScaled(size: 13, weight: .bold))
                                    .foregroundStyle(.white)
                                Text(formatDate(prev.date))
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(LBrand.textSecondary)
                            }
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: 360)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
                }

                Button { startQuiz() } label: {
                    Text(previous == nil ? "Start" : "Ta testen på nytt")
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 40).padding(.vertical, 14)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: Capsule()
                        )
                        .shadow(color: LBrand.purple.opacity(0.45), radius: 8, y: 2)
                }
                .buttonStyle(.plain)
                .padding(.top, 6)

                Color.clear.frame(height: 20)
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: Spørsmål

    private var questionView: some View {
        let q = questions[qIndex]
        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Progresjon
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Spørsmål \(qIndex + 1) av \(questions.count)")
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(LBrand.textSecondary)
                        Spacer()
                        if qIndex > 0 {
                            Button { goBack() } label: {
                                Label("Forrige", systemImage: "chevron.left")
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(LBrand.purpleLight)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(LBrand.cardHi).frame(height: 5)
                            Capsule()
                                .fill(LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                                     startPoint: .leading, endPoint: .trailing))
                                .frame(width: max(6, geo.size.width * Double(qIndex + 1) / Double(questions.count)),
                                       height: 5)
                        }
                    }
                    .frame(height: 5)
                }

                Text(q.text)
                    .font(.appScaled(size: 19, weight: .heavy))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)

                VStack(spacing: 10) {
                    ForEach(0..<q.options.count, id: \.self) { i in
                        optionCard(q.options[i].text, index: i)
                    }
                }

                Color.clear.frame(height: 20)
            }
            .padding(24)
            .frame(maxWidth: 620)
            .frame(maxWidth: .infinity)
        }
    }

    private func optionCard(_ text: String, index: Int) -> some View {
        let isSelected = selectedOption == index
        return Button { select(index) } label: {
            HStack(spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.appScaled(size: 18))
                    .foregroundStyle(isSelected ? LBrand.purpleLight : LBrand.textTertiary)
                Text(text)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(
                isSelected ? LBrand.purple.opacity(0.16) : LBrand.card,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? LBrand.purple.opacity(0.55) : LBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(advancing)
    }

    // MARK: Resultat

    private var resultView: some View {
        ScrollView {
            VStack(spacing: 18) {
                if let r = result {
                    // Total
                    VStack(spacing: 6) {
                        Text("\(r.total)")
                            .font(.appScaled(size: 56, weight: .heavy, design: .rounded))
                            .foregroundStyle(LBrand.purpleLight)
                            .monospacedDigit()
                        Text(r.tierLabel)
                            .font(.appScaled(size: 17, weight: .bold))
                            .foregroundStyle(.white)
                        Text(savesRemotely ? "Lagret i profilen din" : "Lagret lokalt")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                    .padding(.top, 24)

                    // Dimensjons-barer
                    VStack(alignment: .leading, spacing: 12) {
                        Text("DIN PROFIL")
                            .font(.appScaled(size: 10, weight: .black))
                            .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                        ForEach(PondusDimension.allCases, id: \.self) { dim in
                            dimensionBar(dim, score: r.score(for: dim))
                        }
                    }
                    .padding(16)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))

                    // Svakeste dimensjon + anbefalt kapittel
                    let weakest = r.weakest
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Image(systemName: "target")
                                .font(.appScaled(size: 14, weight: .bold))
                                .foregroundStyle(weakest.tint)
                            Text("Din svakeste dimensjon: \(weakest.label)")
                                .font(.appScaled(size: 14, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        HStack(spacing: 8) {
                            Image(systemName: "play.rectangle.fill")
                                .font(.appScaled(size: 12))
                                .foregroundStyle(LBrand.purpleLight)
                            Text("Anbefalt kapittel: «\(weakest.recommendedChapterTitle)»")
                                .font(.appScaled(size: 13))
                                .foregroundStyle(LBrand.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(weakest.tint.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(weakest.tint.opacity(0.35), lineWidth: 1))

                    Button { dismiss() } label: {
                        Text("Ferdig")
                            .font(.appScaled(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 44).padding(.vertical, 14)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                            .shadow(color: LBrand.purple.opacity(0.45), radius: 8, y: 2)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 4)
                }
                Color.clear.frame(height: 24)
            }
            .padding(24)
            .frame(maxWidth: 620)
            .frame(maxWidth: .infinity)
        }
    }

    private func dimensionBar(_ dim: PondusDimension, score: Int) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(dim.label)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(score)")
                    .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(dim.tint)
                    .monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(LBrand.cardHi).frame(height: 7)
                    Capsule()
                        .fill(dim.tint)
                        .frame(width: max(7, geo.size.width * Double(score) / 100.0), height: 7)
                }
            }
            .frame(height: 7)
        }
    }

    // MARK: Logikk

    private func startQuiz() {
        answers = [:]
        qIndex = 0
        selectedOption = nil
        withAnimation(.easeInOut(duration: 0.2)) { phase = .question }
    }

    private func select(_ index: Int) {
        guard !advancing else { return }
        selectedOption = index
        answers[questions[qIndex].id] = index
        advancing = true
        // Kort highlight → auto-videre.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
            advancing = false
            if qIndex < questions.count - 1 {
                qIndex += 1
                selectedOption = answers[questions[qIndex].id]
            } else {
                finish()
            }
        }
    }

    private func goBack() {
        guard qIndex > 0 else { return }
        qIndex -= 1
        selectedOption = answers[questions[qIndex].id]
    }

    private func finish() {
        var dimScores: [PondusDimension: Int] = [:]
        for dim in PondusDimension.allCases {
            let qs = questions.filter { $0.dimension == dim }
            let points = qs.compactMap { q -> Int? in
                guard let idx = answers[q.id], q.options.indices.contains(idx) else { return nil }
                return q.options[idx].points
            }
            guard !points.isEmpty else { dimScores[dim] = 0; continue }
            let avg = Double(points.reduce(0, +)) / Double(points.count)
            dimScores[dim] = Int(((avg - 1) / 3 * 100).rounded())
        }
        let total = Int((Double(dimScores.values.reduce(0, +)) / Double(PondusDimension.allCases.count)).rounded())

        let r = PondusQuizLocalResult(
            autoritet: dimScores[.autoritet] ?? 0,
            klarhet: dimScores[.klarhet] ?? 0,
            troverdighet: dimScores[.troverdighet] ?? 0,
            trygghet: dimScores[.trygghet] ?? 0,
            fremdrift: dimScores[.fremdrift] ?? 0,
            total: total,
            date: Date()
        )
        r.save()
        result = r
        previous = r
        onCompleted?(r)

        // Backend (best-effort) — kun ekte modus.
        if savesRemotely, let api = appState.api {
            let answersCopy = answers
            Task {
                try? await api.submitPondusQuiz(
                    autoritet: r.autoritet, klarhet: r.klarhet,
                    troverdighet: r.troverdighet, trygghet: r.trygghet,
                    fremdrift: r.fremdrift, total: r.total,
                    answers: answersCopy
                )
            }
        }

        withAnimation(.easeInOut(duration: 0.25)) { phase = .result }
    }

    private func formatDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM yyyy"
        return f.string(from: d)
    }
}
