// PrepCards.swift
//
// Utvidet Møteforberedelse — 5 cards:
//   1. PrepCoreCard          — eksisterende Mål/Behov/Neste steg/Notater m/ Rediger + AI-regenerer
//   2. PrepChecklistCard     — interaktiv sjekkliste (Materiale/Demo/Logistikk)
//   3. PrepStakeholdersCard  — beslutningstakere m/ innflytelse-score
//   4. PrepInsightsCard      — AI talepunkter + anbefalte spørsmål (BANT/MEDDIC)
//   5. PrepHistoryCard       — tidligere interaksjoner (timeline)

import SwiftUI

private enum PBrand {
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

// MARK: - Models

struct PrepChecklistItem: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let category: PrepCategory
    var completed: Bool
    let detail: String?
    let timeEstimateMin: Int       // tid å fullføre
    let priority: Priority
    let assignedTo: String?        // initialer, nil = du
    let aiRecommended: Bool        // AI flagger som "neste anbefalt"

    enum Priority: String, CaseIterable, Hashable {
        case high = "Høy"
        case medium = "Med"
        case low = "Lav"
        var color: Color {
            switch self {
            case .high:   return PBrand.red
            case .medium: return PBrand.orange
            case .low:    return PBrand.blue
            }
        }
        var icon: String {
            switch self {
            case .high:   return "flame.fill"
            case .medium: return "minus.circle.fill"
            case .low:    return "arrow.down.circle.fill"
            }
        }
    }
}

enum PrepCategory: String, CaseIterable, Hashable {
    case material = "Materiale"
    case demo     = "Demo"
    case contact  = "Kontakt"
    case logistics = "Logistikk"
    var icon: String {
        switch self {
        case .material:  return "doc.text.fill"
        case .demo:      return "play.rectangle.fill"
        case .contact:   return "person.crop.circle.fill"
        case .logistics: return "shippingbox.fill"
        }
    }
    var color: Color {
        switch self {
        case .material:  return PBrand.blue
        case .demo:      return PBrand.purple
        case .contact:   return PBrand.green
        case .logistics: return PBrand.orange
        }
    }
}

struct PrepStakeholder: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let role: String
    let initials: String
    let color: Color
    let influence: Influence
    let confidence: Int          // 0-100
    let lastContactDays: Int?    // nil = ingen kontakt
    let attending: Bool          // bekreftet på møtet?

    enum Influence: String, CaseIterable, Hashable {
        case decisionMaker = "Beslutningstaker"
        case champion      = "Champion"
        case influencer    = "Influencer"
        case blocker       = "Blocker"
        var color: Color {
            switch self {
            case .decisionMaker: return PBrand.red
            case .champion:      return PBrand.green
            case .influencer:    return PBrand.blue
            case .blocker:       return PBrand.orange
            }
        }
        var icon: String {
            switch self {
            case .decisionMaker: return "crown.fill"
            case .champion:      return "heart.fill"
            case .influencer:    return "person.2.fill"
            case .blocker:       return "exclamationmark.shield.fill"
            }
        }
    }
}

struct TalkingPoint: Identifiable, Hashable {
    let id = UUID()
    let category: TalkCategory
    let title: String
    let detail: String

    enum TalkCategory: String, CaseIterable, Hashable {
        case valueProp     = "Verdiforslag"
        case painPoint     = "Smerte-punkt"
        case socialProof   = "Sosial proof"
        case differentiator = "Differensiator"
        case close         = "Avslutning"
        var icon: String {
            switch self {
            case .valueProp:      return "sparkles"
            case .painPoint:      return "exclamationmark.triangle.fill"
            case .socialProof:    return "star.fill"
            case .differentiator: return "wand.and.stars"
            case .close:          return "checkmark.seal.fill"
            }
        }
        var color: Color {
            switch self {
            case .valueProp:      return PBrand.purpleLight
            case .painPoint:      return PBrand.orange
            case .socialProof:    return PBrand.yellow
            case .differentiator: return PBrand.pink
            case .close:          return PBrand.green
            }
        }
    }
}

struct PrepQuestion: Identifiable, Hashable {
    let id = UUID()
    let framework: String   // BANT / MEDDIC / SPIN
    let pillar: String      // Budget / Authority / Need / Timing osv.
    let text: String
}

struct PrepInteraction: Identifiable, Hashable {
    let id = UUID()
    let kind: Kind
    let title: String
    let detail: String
    let timestamp: String
    let by: String

    enum Kind: String, CaseIterable, Hashable {
        case call, email, meeting, document, note, deal
        var icon: String {
            switch self {
            case .call:     return "phone.fill"
            case .email:    return "envelope.fill"
            case .meeting:  return "video.fill"
            case .document: return "doc.fill"
            case .note:     return "note.text"
            case .deal:     return "norwegiankronesign.circle.fill"
            }
        }
        var color: Color {
            switch self {
            case .call:     return PBrand.green
            case .email:    return PBrand.blue
            case .meeting:  return PBrand.purpleLight
            case .document: return PBrand.orange
            case .note:     return PBrand.yellow
            case .deal:     return PBrand.pink
            }
        }
    }
}

// MARK: - Mock data

enum PrepData {
    /// Alle PrepData-settene er mock — KUN i demo-modus. Ellers tomme
    /// lister + ærlige tom-tilstander i kortene (ingen prep-backend enda).
    static var checklist: [PrepChecklistItem] {
        DemoModeManager.isActiveNonisolated ? _checklist : []
    }
    static var stakeholders: [PrepStakeholder] {
        DemoModeManager.isActiveNonisolated ? _stakeholders : []
    }
    static var talkingPoints: [TalkingPoint] {
        DemoModeManager.isActiveNonisolated ? _talkingPoints : []
    }
    static var questions: [PrepQuestion] {
        DemoModeManager.isActiveNonisolated ? _questions : []
    }
    static var interactions: [PrepInteraction] {
        DemoModeManager.isActiveNonisolated ? _interactions : []
    }

    private static let _checklist: [PrepChecklistItem] = [
        PrepChecklistItem(title: "Tilbud-PDF ferdig",             category: .material,  completed: true,  detail: "v3 — sendt 15. mai",     timeEstimateMin: 0,  priority: .high,   assignedTo: nil,  aiRecommended: false),
        PrepChecklistItem(title: "Demo-konto klargjort",          category: .demo,      completed: true,  detail: "Sandbox m/ deres logo", timeEstimateMin: 0,  priority: .high,   assignedTo: nil,  aiRecommended: false),
        PrepChecklistItem(title: "Agenda sendt",                  category: .contact,   completed: true,  detail: "Bekreftet av Jonas",     timeEstimateMin: 0,  priority: .medium, assignedTo: nil,  aiRecommended: false),
        PrepChecklistItem(title: "Sak-studie fra Romerike Elektro", category: .material,completed: false, detail: "Last ned fra deling",    timeEstimateMin: 5,  priority: .high,   assignedTo: nil,  aiRecommended: true),
        PrepChecklistItem(title: "Test skjerm + HDMI",            category: .logistics, completed: false, detail: "Ankom 8:45",             timeEstimateMin: 10, priority: .medium, assignedTo: nil,  aiRecommended: false),
        PrepChecklistItem(title: "Reservere møterom Lysaker",     category: .logistics, completed: true,  detail: "Bekreftet 08:45-10:15",  timeEstimateMin: 0,  priority: .medium, assignedTo: "MS", aiRecommended: false),
        PrepChecklistItem(title: "Visittkort",                    category: .material,  completed: false, detail: nil,                       timeEstimateMin: 2,  priority: .low,    assignedTo: nil,  aiRecommended: false),
    ]

    private static let _stakeholders: [PrepStakeholder] = [
        PrepStakeholder(name: "Jonas Eide",      role: "Daglig leder",      initials: "JE", color: PBrand.purple,      influence: .decisionMaker, confidence: 85, lastContactDays: 1,  attending: true),
        PrepStakeholder(name: "Linda Berg",      role: "IT-sjef",           initials: "LB", color: PBrand.green,       influence: .champion,      confidence: 92, lastContactDays: 3,  attending: true),
        PrepStakeholder(name: "Morten Solberg",  role: "Innkjøps-direktør", initials: "MS", color: PBrand.blue,        influence: .influencer,    confidence: 60, lastContactDays: 8,  attending: true),
        PrepStakeholder(name: "Kari Nilsen",     role: "CFO",               initials: "KN", color: PBrand.orange,      influence: .blocker,       confidence: 25, lastContactDays: 21, attending: false),
    ]

    private static let _talkingPoints: [TalkingPoint] = [
        TalkingPoint(category: .valueProp,      title: "30 % raskere fakturering",    detail: "Vis konkret tall basert på deres volum (~2 100 fakturaer/mnd)."),
        TalkingPoint(category: .painPoint,      title: "Manuell ordrebehandling",     detail: "Jonas nevnte i sist samtale: 3 ansatte bruker 60 % på dette."),
        TalkingPoint(category: .socialProof,    title: "Romerike Elektro: 12× ROI",   detail: "Lignende størrelse, samme bransje — referanse OK å nevne."),
        TalkingPoint(category: .differentiator, title: "Norsk support + dataeier-EØS", detail: "Konkurrent SAP ligger i Tyskland, AWS i Irland."),
        TalkingPoint(category: .close,          title: "Pilot 4 uker, gratis onboarding", detail: "Reduserer risiko, åpner for rask beslutning før Q3."),
    ]

    private static let _questions: [PrepQuestion] = [
        PrepQuestion(framework: "BANT",   pillar: "Budget",    text: "Hvilket budsjett har dere allokert for digitalisering i 2026?"),
        PrepQuestion(framework: "BANT",   pillar: "Authority", text: "Hvem signerer på dette utenom deg?"),
        PrepQuestion(framework: "BANT",   pillar: "Need",      text: "Hvilke 2-3 ting MÅ være på plass for at dette skal være vellykket?"),
        PrepQuestion(framework: "BANT",   pillar: "Timing",    text: "Hva er konsekvensen hvis dere ikke gjør noe i 2026?"),
        PrepQuestion(framework: "MEDDIC", pillar: "Champion",  text: "Hvem hos dere blir mest entusiastisk hvis dette løses?"),
        PrepQuestion(framework: "MEDDIC", pillar: "Pain",      text: "Kan du sette en kostnad på det dagens situasjon koster pr. måned?"),
    ]

    private static let _interactions: [PrepInteraction] = [
        PrepInteraction(kind: .email,    title: "Tilbud v3 sendt",          detail: "Justert pris -8 % + utvidet support", timestamp: "15. mai 14:18", by: "Lars Kristensen"),
        PrepInteraction(kind: .meeting,  title: "Discovery-møte (Teams)",   detail: "45 min, Jonas + Linda, definert behov", timestamp: "12. mai 09:00", by: "Lars Kristensen"),
        PrepInteraction(kind: .call,     title: "Oppfølging — telefon",     detail: "Avklart at Morten må involveres",       timestamp: "8. mai 11:30",  by: "Lars Kristensen"),
        PrepInteraction(kind: .document, title: "Sak-studie sendt",         detail: "Romerike Elektro PDF",                  timestamp: "6. mai 16:42",  by: "Lars Kristensen"),
        PrepInteraction(kind: .email,    title: "Første kontakt",           detail: "Reply på LinkedIn outreach",            timestamp: "2. mai 09:14",  by: "Jonas Eide"),
        PrepInteraction(kind: .note,     title: "AI-research notat",        detail: "Bedriften vokser 23 % YoY, søker ERP",  timestamp: "1. mai 10:00",  by: "AI-assistent"),
    ]
}

// MARK: - Delt tom-tilstand (ikke-demo uten ekte prep-data)

/// Ærlig tom-tilstand for prep-kortene når demo er AV og det ikke finnes
/// ekte data (prep-backend mangler enda).
fileprivate func prepEmptyState(_ text: String) -> some View {
    Text(text)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(PBrand.textSecondary)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
}

// MARK: - 1. PrepCoreCard (Mål / Behov / Neste steg / Notater + Rediger + AI)

struct PrepCoreCard: View {
    @State var items: [PrepItem]
    @State private var showEdit = false
    @State private var regenerating = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 7) {
                    Image(systemName: "target")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(PBrand.purpleLight)
                    Text("Møteforberedelse")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                }
                Spacer()
                Button {
                    withAnimation(.easeInOut(duration: 0.6)) { regenerating = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                        withAnimation { regenerating = false }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: regenerating ? "sparkles" : "wand.and.stars")
                            .font(.system(size: 11, weight: .bold))
                            .rotationEffect(.degrees(regenerating ? 360 : 0))
                            .animation(regenerating ? .linear(duration: 0.8) : .default, value: regenerating)
                        Text(regenerating ? "Genererer…" : "AI-regenerer")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(PBrand.purpleLight)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(PBrand.purple.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(PBrand.purple.opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(regenerating)
                Button { showEdit = true } label: {
                    Text("Rediger")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(PBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            if items.isEmpty {
                Text("Ingen forberedelser registrert enda")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(PBrand.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            } else {
                VStack(alignment: .leading, spacing: 11) {
                    ForEach(items) { p in prepRow(p) }
                }
            }
        }
        .padding(14)
        .background(PBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.stroke, lineWidth: 1))
        .sheet(isPresented: $showEdit) {
            PrepEditSheet(items: $items)
        }
    }

    private func prepRow(_ p: PrepItem) -> some View {
        HStack(alignment: .top, spacing: 11) {
            HStack(spacing: 7) {
                ZStack {
                    Circle().fill(p.color.opacity(0.22))
                    Image(systemName: p.icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(p.color)
                }
                .frame(width: 28, height: 28)
                Text(p.category)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 120, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(p.bullets, id: \.self) { bullet in
                    HStack(alignment: .top, spacing: 6) {
                        Text("•")
                            .font(.system(size: 11))
                            .foregroundStyle(PBrand.textSecondary)
                        Text(bullet)
                            .font(.system(size: 12))
                            .foregroundStyle(.white)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - PrepEditSheet

struct PrepEditSheet: View {
    @Binding var items: [PrepItem]
    @Environment(\.dismiss) private var dismiss
    @State private var draft: [UUID: String] = [:]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    ForEach(items) { item in
                        editorCard(item)
                    }
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(PBrand.bg.ignoresSafeArea())
            .navigationTitle("Rediger forberedelse")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(PBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        // Lagre draft tilbake (split på linjeskift)
                        for i in items.indices {
                            if let d = draft[items[i].id] {
                                let lines = d.split(separator: "\n").map { String($0).trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                                items[i] = PrepItem(category: items[i].category, icon: items[i].icon, color: items[i].color, bullets: lines)
                            }
                        }
                        dismiss()
                    }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(PBrand.purpleLight)
                }
            }
            .toolbarBackground(PBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .onAppear {
                for item in items {
                    if draft[item.id] == nil {
                        draft[item.id] = item.bullets.joined(separator: "\n")
                    }
                }
            }
        }
    }

    private func editorCard(_ item: PrepItem) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(item.color.opacity(0.22))
                    Image(systemName: item.icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(item.color)
                }
                .frame(width: 30, height: 30)
                Text(item.category)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("Én linje per punkt")
                    .font(.system(size: 9))
                    .foregroundStyle(PBrand.textTertiary)
            }
            TextEditor(text: Binding(
                get: { draft[item.id] ?? "" },
                set: { draft[item.id] = $0 }
            ))
            .scrollContentBackground(.hidden)
            .foregroundStyle(.white)
            .font(.system(size: 12))
            .frame(minHeight: 90)
            .padding(10)
            .background(PBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(PBrand.stroke, lineWidth: 1))
        }
        .padding(13)
        .background(PBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(PBrand.stroke, lineWidth: 1))
    }
}

// MARK: - 2. PrepChecklistCard

struct PrepChecklistCard: View {
    @State var items: [PrepChecklistItem] = PrepData.checklist
    @State private var showAddSheet = false
    @State private var animatedProgress: Double = 0
    @State private var celebrate: Bool = false

    private var done: Int { items.filter { $0.completed }.count }
    private var total: Int { items.count }
    private var progress: Double { total > 0 ? Double(done) / Double(total) : 0 }
    private var timeRemaining: Int {
        items.filter { !$0.completed }.reduce(0) { $0 + $1.timeEstimateMin }
    }
    private var readinessLabel: String {
        switch progress {
        case 1.0:          return "Helt klar!"
        case 0.85..<1.0:   return "Nesten klar"
        case 0.5..<0.85:   return "Trenger litt mer"
        case 0..<0.5:      return "Mer å forberede"
        default:           return "Start her"
        }
    }
    private var readinessColor: Color {
        switch progress {
        case 1.0:          return PBrand.green
        case 0.85..<1.0:   return PBrand.green
        case 0.5..<0.85:   return PBrand.yellow
        case 0..<0.5:      return PBrand.orange
        default:           return PBrand.red
        }
    }
    private var nextRecommendedIndex: Int? {
        items.indices.first { items[$0].aiRecommended && !items[$0].completed }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // 1. Kreativ readiness-header
            readinessHeader
            // 2. AI-anbefalt neste-trinn (hvis ikke ferdig)
            if let i = nextRecommendedIndex {
                aiRecommendedBanner(i)
            } else if progress >= 1.0 {
                completedBanner
            }
            // 3. Items gruppert på kategori
            if items.isEmpty {
                prepEmptyState("Ingen sjekkliste-punkter enda")
            }
            VStack(spacing: 7) {
                ForEach(PrepCategory.allCases, id: \.self) { cat in
                    let inCat = items.indices.filter { items[$0].category == cat }
                    if !inCat.isEmpty {
                        categorySection(cat, indices: inCat)
                    }
                }
            }
        }
        .padding(14)
        .background(
            ZStack {
                PBrand.card
                // Subtle grandient overlay basert på readiness
                LinearGradient(
                    colors: [readinessColor.opacity(0.10), Color.clear],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
            }
            .clipShape(RoundedRectangle(cornerRadius: 14))
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(readinessColor.opacity(0.30), lineWidth: 1))
        .overlay(
            // Konfetti når 100%
            Group { if celebrate { confettiOverlay } }
        )
        .sheet(isPresented: $showAddSheet) {
            AddChecklistItemSheet(items: $items)
        }
        .onAppear {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.85)) {
                animatedProgress = progress
            }
        }
        .onChange(of: progress) { _, newValue in
            withAnimation(.spring(response: 0.55, dampingFraction: 0.7)) {
                animatedProgress = newValue
            }
            if newValue >= 1.0 {
                celebrate = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { celebrate = false }
            }
        }
    }

    // MARK: - 1. Readiness-header (sirkulær ring + score + tekst)

    private var readinessHeader: some View {
        HStack(spacing: 14) {
            // Sirkulær progress-ring
            ZStack {
                Circle()
                    .stroke(PBrand.cardHi, lineWidth: 7)
                Circle()
                    .trim(from: 0, to: animatedProgress)
                    .stroke(
                        AngularGradient(
                            colors: progress >= 1.0
                                ? [PBrand.green, PBrand.green]
                                : [PBrand.purpleLight, PBrand.purple, PBrand.purpleLight],
                            center: .center, startAngle: .degrees(-90), endAngle: .degrees(270)
                        ),
                        style: StrokeStyle(lineWidth: 7, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .shadow(color: readinessColor.opacity(0.4), radius: 6)
                VStack(spacing: 0) {
                    Text("\(Int(progress * 100))")
                        .font(.system(size: 22, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                    Text("%")
                        .font(.system(size: 9, weight: .black))
                        .foregroundStyle(PBrand.textSecondary)
                        .offset(y: -3)
                }
            }
            .frame(width: 72, height: 72)
            // Tekst-side
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text("Møte-readiness")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(PBrand.textSecondary)
                        .textCase(.uppercase)
                        .tracking(0.5)
                    if progress >= 1.0 {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(PBrand.green)
                    }
                }
                Text(readinessLabel)
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(readinessColor)
                HStack(spacing: 6) {
                    HStack(spacing: 3) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text("\(done) av \(total)")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .monospacedDigit()
                    }
                    .foregroundStyle(PBrand.green)
                    if timeRemaining > 0 {
                        Text("·").foregroundStyle(PBrand.textTertiary)
                        HStack(spacing: 3) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 10, weight: .bold))
                            Text("~\(timeRemaining) min")
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .monospacedDigit()
                        }
                        .foregroundStyle(PBrand.yellow)
                    }
                }
            }
            Spacer()
            Button { showAddSheet = true } label: {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(9)
                    .background(
                        LinearGradient(colors: [PBrand.purple, PBrand.purpleLight],
                                       startPoint: .topLeading, endPoint: .bottomTrailing),
                        in: Circle()
                    )
                    .shadow(color: PBrand.purple.opacity(0.4), radius: 5, y: 2)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - 2. AI-anbefalt banner

    private func aiRecommendedBanner(_ i: Int) -> some View {
        let it = items[i]
        return Button {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                items[i].completed.toggle()
            }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(LinearGradient(
                        colors: [PBrand.purple, PBrand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    Image(systemName: "sparkles")
                        .font(.system(size: 12, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 5) {
                        Text("AI ANBEFALER NÅ")
                            .font(.system(size: 8, weight: .black))
                            .foregroundStyle(PBrand.purpleLight)
                            .tracking(0.6)
                        Image(systemName: "arrow.right.circle.fill")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(PBrand.purpleLight)
                    }
                    Text(it.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let d = it.detail {
                        Text(d)
                            .font(.system(size: 10))
                            .foregroundStyle(PBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                Text("\(it.timeEstimateMin) min")
                    .font(.system(size: 10, weight: .black, design: .rounded))
                    .foregroundStyle(PBrand.yellow)
                    .monospacedDigit()
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(PBrand.yellow.opacity(0.18), in: Capsule())
            }
            .padding(11)
            .background(
                LinearGradient(colors: [PBrand.purple.opacity(0.18), PBrand.purple.opacity(0.08)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(PBrand.purple.opacity(0.45), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var completedBanner: some View {
        HStack(spacing: 9) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [PBrand.green, Color(red: 0.10, green: 0.70, blue: 0.45)],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text("100 % FORBEREDT")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(PBrand.green)
                    .tracking(0.5)
                Text("Du har alt klart for møtet 🚀")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
        .padding(11)
        .background(PBrand.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(PBrand.green.opacity(0.45), lineWidth: 1))
    }

    // MARK: - 3. Kategori-seksjon med rich rows

    private func categorySection(_ cat: PrepCategory, indices: [Int]) -> some View {
        let catCount = indices.count
        let catDone = indices.filter { items[$0].completed }.count
        return VStack(spacing: 5) {
            HStack(spacing: 6) {
                Image(systemName: cat.icon)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(cat.color)
                Text(cat.rawValue.uppercased())
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(cat.color)
                    .tracking(0.5)
                Text("\(catDone)/\(catCount)")
                    .font(.system(size: 8, weight: .bold, design: .rounded))
                    .foregroundStyle(catDone == catCount ? PBrand.green : PBrand.textTertiary)
                    .monospacedDigit()
                Rectangle().fill(PBrand.stroke).frame(height: 1)
            }
            ForEach(indices, id: \.self) { i in
                richChecklistRow(i)
            }
        }
    }

    private func richChecklistRow(_ i: Int) -> some View {
        let it = items[i]
        return Button {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                items[i].completed.toggle()
            }
        } label: {
            HStack(alignment: .top, spacing: 9) {
                ZStack {
                    Circle()
                        .fill(it.completed ? it.category.color : Color.clear)
                        .overlay(Circle().stroke(it.completed ? it.category.color : PBrand.stroke, lineWidth: 1.5))
                        .scaleEffect(it.completed ? 1 : 1)
                    if it.completed {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(.white)
                    } else if it.aiRecommended {
                        // Pulse-anim på AI-anbefalt
                        Circle()
                            .stroke(PBrand.purpleLight.opacity(0.6), lineWidth: 1.5)
                            .scaleEffect(1.2 + 0.15 * sin(Date().timeIntervalSinceReferenceDate * 2))
                    }
                }
                .frame(width: 20, height: 20)
                .padding(.top, 1)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 5) {
                        Text(it.title)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(it.completed ? PBrand.textSecondary : .white)
                            .strikethrough(it.completed, color: PBrand.textTertiary)
                            .lineLimit(1)
                        if it.priority == .high && !it.completed {
                            Image(systemName: "flame.fill")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(PBrand.red)
                        }
                    }
                    HStack(spacing: 5) {
                        if let d = it.detail {
                            Text(d)
                                .font(.system(size: 10))
                                .foregroundStyle(PBrand.textTertiary)
                                .lineLimit(1)
                        }
                    }
                    // Badges-rad (vises kun hvis ikke ferdig)
                    if !it.completed {
                        HStack(spacing: 5) {
                            if it.timeEstimateMin > 0 {
                                tinyBadge(icon: "clock.fill", text: "\(it.timeEstimateMin) min", color: PBrand.yellow)
                            }
                            if it.priority == .high {
                                tinyBadge(icon: it.priority.icon, text: "Høy prio", color: it.priority.color)
                            }
                            if let who = it.assignedTo {
                                tinyBadge(icon: "person.fill", text: who, color: PBrand.blue)
                            }
                            if it.aiRecommended {
                                tinyBadge(icon: "sparkles", text: "AI", color: PBrand.purpleLight)
                            }
                            Spacer()
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 5).padding(.horizontal, 6)
            .background(
                it.aiRecommended && !it.completed
                    ? PBrand.purple.opacity(0.06)
                    : Color.clear,
                in: RoundedRectangle(cornerRadius: 8)
            )
        }
        .buttonStyle(.plain)
    }

    private func tinyBadge(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 8, weight: .bold))
            Text(text)
                .font(.system(size: 9, weight: .bold))
                .monospacedDigit()
        }
        .foregroundStyle(color)
        .padding(.horizontal, 5).padding(.vertical, 1)
        .background(color.opacity(0.15), in: Capsule())
        .overlay(Capsule().stroke(color.opacity(0.35), lineWidth: 0.8))
    }

    // MARK: - Konfetti-overlay

    private var confettiOverlay: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(0..<24, id: \.self) { i in
                    Circle()
                        .fill([PBrand.green, PBrand.purple, PBrand.yellow, PBrand.pink, PBrand.blue].randomElement()!)
                        .frame(width: 6, height: 6)
                        .position(
                            x: CGFloat.random(in: 0...geo.size.width),
                            y: celebrate ? CGFloat.random(in: 50...geo.size.height) : -10
                        )
                        .opacity(celebrate ? 0 : 1)
                        .animation(.easeOut(duration: 1.6).delay(Double(i) * 0.03), value: celebrate)
                }
            }
        }
        .allowsHitTesting(false)
    }
}

struct AddChecklistItemSheet: View {
    @Binding var items: [PrepChecklistItem]
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var detail = ""
    @State private var category: PrepCategory = .material

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    field(title: "Tittel", binding: $title, placeholder: "F.eks. Print agenda")
                    field(title: "Detalj (valgfritt)", binding: $detail, placeholder: "Notater til denne oppgaven")
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Kategori")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(PBrand.textSecondary)
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            ForEach(PrepCategory.allCases, id: \.self) { c in
                                Button { category = c } label: {
                                    HStack(spacing: 7) {
                                        Image(systemName: c.icon)
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(category == c ? .white : c.color)
                                        Text(c.rawValue)
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundStyle(category == c ? .white : .white)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 11)
                                    .background(
                                        category == c ? AnyShapeStyle(c.color) : AnyShapeStyle(PBrand.card),
                                        in: RoundedRectangle(cornerRadius: 11)
                                    )
                                    .overlay(RoundedRectangle(cornerRadius: 11)
                                        .stroke(category == c ? Color.clear : PBrand.stroke, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(PBrand.bg.ignoresSafeArea())
            .navigationTitle("Ny sjekkliste-oppgave")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(PBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Legg til") {
                        let new = PrepChecklistItem(
                            title: title, category: category,
                            completed: false,
                            detail: detail.isEmpty ? nil : detail,
                            timeEstimateMin: 5,
                            priority: .medium,
                            assignedTo: nil,
                            aiRecommended: false
                        )
                        items.append(new)
                        dismiss()
                    }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(PBrand.purpleLight)
                    .disabled(title.isEmpty)
                }
            }
            .toolbarBackground(PBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private func field(title: String, binding: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(PBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: binding)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                    .padding(11)
                    .background(PBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(PBrand.stroke, lineWidth: 1))
                if binding.wrappedValue.isEmpty {
                    Text(placeholder)
                        .font(.system(size: 13))
                        .foregroundStyle(PBrand.textTertiary)
                        .padding(.horizontal, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }
}

// MARK: - 3. PrepStakeholdersCard

struct PrepStakeholdersCard: View {
    let stakeholders: [PrepStakeholder] = PrepData.stakeholders
    @State private var selected: PrepStakeholder?

    private var attendingCount: Int { stakeholders.filter { $0.attending }.count }
    private var champions: Int { stakeholders.filter { $0.influence == .champion }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                HStack(spacing: 7) {
                    Image(systemName: "person.3.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(PBrand.blue)
                    Text("Beslutningstakere")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                }
                Spacer()
                HStack(spacing: 5) {
                    summaryBadge(label: "\(attendingCount) på møtet", color: PBrand.green, icon: "checkmark.circle.fill")
                    if champions > 0 {
                        summaryBadge(label: "\(champions) champion", color: PBrand.pink, icon: "heart.fill")
                    }
                }
            }
            if stakeholders.isEmpty {
                prepEmptyState("Ingen beslutningstakere registrert enda")
            }
            VStack(spacing: 7) {
                ForEach(stakeholders) { s in
                    stakeholderRow(s)
                        .onTapGesture { selected = s }
                }
            }
        }
        .padding(14)
        .background(PBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.stroke, lineWidth: 1))
        .sheet(item: $selected) { s in
            StakeholderDetailSheet(stakeholder: s)
        }
    }

    private func summaryBadge(label: String, color: Color, icon: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
            Text(label)
                .font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 7).padding(.vertical, 3)
        .background(color.opacity(0.18), in: Capsule())
        .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
    }

    private func stakeholderRow(_ s: PrepStakeholder) -> some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(s.color.opacity(0.85))
                Text(s.initials)
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(.white)
                if s.attending {
                    Circle()
                        .fill(PBrand.green)
                        .overlay(Circle().stroke(PBrand.card, lineWidth: 2))
                        .frame(width: 12, height: 12)
                        .offset(x: 14, y: 14)
                }
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 1) {
                Text(s.name)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text(s.role)
                    .font(.system(size: 11))
                    .foregroundStyle(PBrand.textSecondary)
            }
            Spacer()
            // Influence-badge
            HStack(spacing: 4) {
                Image(systemName: s.influence.icon)
                    .font(.system(size: 9, weight: .bold))
                Text(s.influence.rawValue)
                    .font(.system(size: 10, weight: .bold))
            }
            .foregroundStyle(s.influence.color)
            .padding(.horizontal, 7).padding(.vertical, 4)
            .background(s.influence.color.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(s.influence.color.opacity(0.4), lineWidth: 1))
            // Confidence
            confidenceRing(s.confidence)
        }
        .padding(8)
        .background(PBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
        .contentShape(Rectangle())
    }

    private func confidenceRing(_ pct: Int) -> some View {
        let color: Color = pct >= 75 ? PBrand.green : pct >= 50 ? PBrand.yellow : PBrand.red
        return ZStack {
            Circle().stroke(PBrand.cardHi, lineWidth: 3)
            Circle()
                .trim(from: 0, to: Double(pct) / 100)
                .stroke(color, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(pct)")
                .font(.system(size: 9, weight: .black, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .frame(width: 30, height: 30)
    }
}

struct StakeholderDetailSheet: View {
    let stakeholder: PrepStakeholder
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    hero
                    statsRow
                    notesCard
                    actionsCard
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(PBrand.bg.ignoresSafeArea())
            .navigationTitle(stakeholder.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(PBrand.purpleLight)
                }
            }
            .toolbarBackground(PBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var hero: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(stakeholder.color.opacity(0.85))
                Text(stakeholder.initials)
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 60, height: 60)
            VStack(alignment: .leading, spacing: 3) {
                Text(stakeholder.name)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                Text(stakeholder.role)
                    .font(.system(size: 12))
                    .foregroundStyle(PBrand.textSecondary)
                HStack(spacing: 5) {
                    Image(systemName: stakeholder.influence.icon)
                        .font(.system(size: 9, weight: .bold))
                    Text(stakeholder.influence.rawValue)
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(stakeholder.influence.color)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(stakeholder.influence.color.opacity(0.18), in: Capsule())
                .overlay(Capsule().stroke(stakeholder.influence.color.opacity(0.4), lineWidth: 1))
            }
            Spacer()
        }
        .padding(16)
        .background(PBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.stroke, lineWidth: 1))
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            statBox(label: "Confidence", value: "\(stakeholder.confidence) %", color: stakeholder.confidence >= 75 ? PBrand.green : (stakeholder.confidence >= 50 ? PBrand.yellow : PBrand.red))
            statBox(label: "Siste kontakt", value: stakeholder.lastContactDays.map { "\($0) dag\($0 == 1 ? "" : "er")" } ?? "Ingen", color: PBrand.blue)
            statBox(label: "Status", value: stakeholder.attending ? "På møtet" : "Ikke bekreftet", color: stakeholder.attending ? PBrand.green : PBrand.orange)
        }
    }

    private func statBox(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(PBrand.textSecondary)
            Text(value)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(11)
        .background(PBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(PBrand.stroke, lineWidth: 1))
    }

    private var notesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Notater")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Text("Nøkkelperson hos kunden. Bekymret for migrering — gi konkret time-line + risiko-plan. Foretrekker e-post over telefon.")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(PBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(PBrand.stroke, lineWidth: 1))
    }

    private var actionsCard: some View {
        HStack(spacing: 9) {
            actionBtn(label: "Ring", icon: "phone.fill", color: PBrand.green)
            actionBtn(label: "E-post", icon: "envelope.fill", color: PBrand.blue)
            actionBtn(label: "Notat", icon: "square.and.pencil", color: PBrand.purpleLight)
        }
    }

    private func actionBtn(label: String, icon: String, color: Color) -> some View {
        Button {} label: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .bold))
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(color.opacity(0.85), in: RoundedRectangle(cornerRadius: 11))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - PrepInsightsModal (sheet-wrapper rundt PrepInsightsCard)

struct PrepInsightsModal: View {
    let meetingCompany: String
    let meetingContact: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    PrepInsightsCard()
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(PBrand.bg.ignoresSafeArea())
            .navigationTitle("AI-innsikt for møtet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(PBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button {} label: { Label("Del med team", systemImage: "person.2.fill") }
                        Button {} label: { Label("Kopier som notat", systemImage: "doc.on.doc") }
                        Button {} label: { Label("Skriv ut møteforberedelse", systemImage: "printer.fill") }
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .foregroundStyle(PBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(PBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [PBrand.purple, PBrand.purpleLight],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "sparkles")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(meetingCompany)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Forberedelse-AI · møte med \(meetingContact)")
                    .font(.system(size: 11))
                    .foregroundStyle(PBrand.textSecondary)
            }
            Spacer()
            Text("Live")
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(PBrand.green)
                .tracking(0.5)
                .padding(.horizontal, 7).padding(.vertical, 3)
                .background(PBrand.green.opacity(0.18), in: Capsule())
                .overlay(Capsule().stroke(PBrand.green.opacity(0.4), lineWidth: 1))
        }
        .padding(13)
        .background(
            LinearGradient(colors: [PBrand.purple.opacity(0.15), PBrand.purple.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.purple.opacity(0.30), lineWidth: 1))
    }
}

// MARK: - PrepCoreModal (sheet-wrapper rundt PrepCoreCard)

struct PrepCoreModal: View {
    let meetingCompany: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    PrepCoreCard(items: MeetingsData.prep)
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(PBrand.bg.ignoresSafeArea())
            .navigationTitle("Mål & behov")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(PBrand.purpleLight)
                }
            }
            .toolbarBackground(PBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [PBrand.blue, PBrand.purpleLight],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "target")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(meetingCompany)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Mål, behov, neste steg og notater")
                    .font(.system(size: 11))
                    .foregroundStyle(PBrand.textSecondary)
            }
            Spacer()
        }
        .padding(13)
        .background(
            LinearGradient(colors: [PBrand.blue.opacity(0.12), PBrand.purple.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.blue.opacity(0.30), lineWidth: 1))
    }
}

// MARK: - PrepStakeholdersModal (sheet-wrapper rundt PrepStakeholdersCard)

struct PrepStakeholdersModal: View {
    let meetingCompany: String
    @Environment(\.dismiss) private var dismiss

    private var attendingCount: Int { PrepData.stakeholders.filter { $0.attending }.count }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    PrepStakeholdersCard()
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(PBrand.bg.ignoresSafeArea())
            .navigationTitle("Beslutningstakere")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(PBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {} label: {
                        Image(systemName: "person.badge.plus")
                            .foregroundStyle(PBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(PBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [PBrand.green, PBrand.blue],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "person.3.fill")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(meetingCompany)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(PrepData.stakeholders.count) beslutningstakere · \(attendingCount) på møtet")
                    .font(.system(size: 11))
                    .foregroundStyle(PBrand.textSecondary)
            }
            Spacer()
        }
        .padding(13)
        .background(
            LinearGradient(colors: [PBrand.green.opacity(0.10), PBrand.blue.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.green.opacity(0.30), lineWidth: 1))
    }
}

// MARK: - PrepChecklistModal (sheet-wrapper rundt PrepChecklistCard)

struct PrepChecklistModal: View {
    let meetingCompany: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    PrepChecklistCard()
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(PBrand.bg.ignoresSafeArea())
            .navigationTitle("Sjekkliste")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(PBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button {} label: { Label("Sortér etter prioritet", systemImage: "flame.fill") }
                        Button {} label: { Label("Sortér etter tid", systemImage: "clock.fill") }
                        Button {} label: { Label("Skjul fullførte", systemImage: "eye.slash.fill") }
                        Divider()
                        Button {} label: { Label("Tøm sjekkliste", systemImage: "trash") }
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .foregroundStyle(PBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(PBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [PBrand.green, PBrand.purpleLight],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(meetingCompany)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Møte-forberedelses-sjekkliste")
                    .font(.system(size: 11))
                    .foregroundStyle(PBrand.textSecondary)
            }
            Spacer()
        }
        .padding(13)
        .background(
            LinearGradient(colors: [PBrand.green.opacity(0.12), PBrand.purple.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.green.opacity(0.30), lineWidth: 1))
    }
}

// MARK: - PrepChecklistPreviewButton (sidebar-CTA m/ mini-ring + readiness)

struct PrepChecklistPreviewButton: View {
    let action: () -> Void
    @State private var animatedProgress: Double = 0

    private var done: Int { PrepData.checklist.filter { $0.completed }.count }
    private var total: Int { PrepData.checklist.count }
    private var progress: Double { total > 0 ? Double(done) / Double(total) : 0 }
    private var timeRemaining: Int {
        PrepData.checklist.filter { !$0.completed }.reduce(0) { $0 + $1.timeEstimateMin }
    }
    private var readinessColor: Color {
        switch progress {
        case 1.0:        return PBrand.green
        case 0.85..<1.0: return PBrand.green
        case 0.5..<0.85: return PBrand.yellow
        case 0..<0.5:    return PBrand.orange
        default:         return PBrand.red
        }
    }
    private var readinessLabel: String {
        switch progress {
        case 1.0:        return "Helt klar!"
        case 0.85..<1.0: return "Nesten klar"
        case 0.5..<0.85: return "Trenger litt mer"
        default:         return "Start her"
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                // Mini-ring
                ZStack {
                    Circle()
                        .stroke(PBrand.cardHi, lineWidth: 4)
                    Circle()
                        .trim(from: 0, to: animatedProgress)
                        .stroke(
                            AngularGradient(
                                colors: progress >= 1.0
                                    ? [PBrand.green, PBrand.green]
                                    : [PBrand.purpleLight, PBrand.purple, PBrand.purpleLight],
                                center: .center, startAngle: .degrees(-90), endAngle: .degrees(270)
                            ),
                            style: StrokeStyle(lineWidth: 4, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .shadow(color: readinessColor.opacity(0.5), radius: 4)
                    VStack(spacing: -2) {
                        Text("\(Int(progress * 100))")
                            .font(.system(size: 13, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                        Text("%")
                            .font(.system(size: 7, weight: .black))
                            .foregroundStyle(PBrand.textSecondary)
                    }
                }
                .frame(width: 42, height: 42)
                // Tekst
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(readinessColor)
                        Text("Sjekkliste")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                        Text("\(done) / \(total)")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(readinessColor)
                            .monospacedDigit()
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(readinessColor.opacity(0.18), in: Capsule())
                    }
                    HStack(spacing: 5) {
                        Text(readinessLabel)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(readinessColor)
                        if timeRemaining > 0 {
                            Text("·").foregroundStyle(PBrand.textTertiary)
                            HStack(spacing: 2) {
                                Image(systemName: "clock.fill")
                                    .font(.system(size: 8))
                                Text("~\(timeRemaining) min")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .monospacedDigit()
                            }
                            .foregroundStyle(PBrand.yellow)
                        }
                    }
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(
                ZStack {
                    LinearGradient(
                        colors: [PBrand.purple.opacity(0.20), readinessColor.opacity(0.12)],
                        startPoint: .leading, endPoint: .trailing
                    )
                }
                .clipShape(RoundedRectangle(cornerRadius: 12))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(readinessColor.opacity(0.40), lineWidth: 1)
            )
            .shadow(color: readinessColor.opacity(0.25), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) {
                animatedProgress = progress
            }
        }
    }
}

// MARK: - PrepHistoryModal (sheet-wrapper rundt PrepHistoryCard)

struct PrepHistoryModal: View {
    let meetingCompany: String
    @Environment(\.dismiss) private var dismiss

    private var totalEvents: Int { PrepData.interactions.count }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    nbaSection
                    sectionDivider("Tidligere interaksjoner")
                    PrepHistoryCard()
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(PBrand.bg.ignoresSafeArea())
            .navigationTitle("Aktivitetsoversikt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(PBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button {} label: { Label("Filter: e-post", systemImage: "envelope.fill") }
                        Button {} label: { Label("Filter: møter", systemImage: "video.fill") }
                        Button {} label: { Label("Filter: anrop", systemImage: "phone.fill") }
                        Divider()
                        Button {} label: { Label("Eksporter som PDF", systemImage: "doc.fill") }
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .foregroundStyle(PBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(PBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [PBrand.yellow, PBrand.orange],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(meetingCompany)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("1 anbefalt handling · \(totalEvents) tidligere interaksjoner")
                    .font(.system(size: 11))
                    .foregroundStyle(PBrand.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("Først kontakt")
                    .font(.system(size: 9))
                    .foregroundStyle(PBrand.textTertiary)
                Text("2. mai")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
        }
        .padding(13)
        .background(
            LinearGradient(colors: [PBrand.yellow.opacity(0.10), PBrand.orange.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.yellow.opacity(0.30), lineWidth: 1))
    }

    private var nbaSection: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 7) {
                Image(systemName: "target")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(PBrand.purpleLight)
                Text("Neste beste handling")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("AI")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(PBrand.purpleLight)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(PBrand.purple.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(PBrand.purple.opacity(0.4), lineWidth: 1))
            }
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(LinearGradient(
                        colors: [PBrand.purple, PBrand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    Image(systemName: "target")
                        .font(.system(size: 17, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(width: 46, height: 46)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Send oppsummering etter møtet")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Del nøkkelpunkter og avtal neste steg innen 24t — øker konvertering med 38 %.")
                        .font(.system(size: 11))
                        .foregroundStyle(PBrand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 8) {
                Button {} label: {
                    HStack(spacing: 5) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 12, weight: .bold))
                        Text("Opprett oppgave")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [PBrand.purple, PBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                }
                .buttonStyle(.plain)
                Button {} label: {
                    HStack(spacing: 5) {
                        Image(systemName: "clock.fill")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Snooze")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(PBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(PBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(
            LinearGradient(colors: [PBrand.purple.opacity(0.12), PBrand.purple.opacity(0.04)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.purple.opacity(0.35), lineWidth: 1))
    }

    private func sectionDivider(_ title: String) -> some View {
        HStack(spacing: 8) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .black))
                .foregroundStyle(PBrand.textSecondary)
                .tracking(0.6)
            Rectangle().fill(PBrand.stroke).frame(height: 1)
        }
        .padding(.top, 4)
    }
}

// MARK: - 4. PrepInsightsCard (AI Talepunkter + Spørsmål, tabs)

struct PrepInsightsCard: View {
    enum Tab: String, CaseIterable, Hashable {
        case talking = "Talepunkter"
        case questions = "Spørsmål"
        var icon: String {
            switch self {
            case .talking: return "bubble.left.and.text.bubble.right.fill"
            case .questions: return "questionmark.bubble.fill"
            }
        }
    }
    @State private var tab: Tab = .talking
    @State private var regenerating = false

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                HStack(spacing: 7) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(PBrand.purpleLight)
                    Text("AI-innsikt for møtet")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                }
                Spacer()
                Button {
                    withAnimation { regenerating = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
                        withAnimation { regenerating = false }
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(PBrand.purpleLight)
                        .rotationEffect(.degrees(regenerating ? 360 : 0))
                        .animation(regenerating ? .linear(duration: 0.9) : .default, value: regenerating)
                        .padding(7)
                        .background(PBrand.purple.opacity(0.18), in: Circle())
                        .overlay(Circle().stroke(PBrand.purple.opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(regenerating)
            }
            // Tab-picker
            HStack(spacing: 6) {
                ForEach(Tab.allCases, id: \.self) { t in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { tab = t }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: t.icon)
                                .font(.system(size: 10, weight: .bold))
                            Text(t.rawValue)
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundStyle(tab == t ? .white : PBrand.textSecondary)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(
                            tab == t ? AnyShapeStyle(PBrand.purple) : AnyShapeStyle(PBrand.cardHi),
                            in: Capsule()
                        )
                        .overlay(Capsule().stroke(tab == t ? Color.clear : PBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            if tab == .talking {
                if PrepData.talkingPoints.isEmpty {
                    prepEmptyState("Ingen talepunkter enda")
                }
                VStack(spacing: 7) {
                    ForEach(PrepData.talkingPoints) { tp in
                        talkingPointRow(tp)
                    }
                }
            } else {
                if PrepData.questions.isEmpty {
                    prepEmptyState("Ingen spørsmål enda")
                }
                VStack(spacing: 7) {
                    ForEach(PrepData.questions) { q in
                        questionRow(q)
                    }
                }
            }
        }
        .padding(14)
        .background(PBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.stroke, lineWidth: 1))
    }

    private func talkingPointRow(_ tp: TalkingPoint) -> some View {
        HStack(alignment: .top, spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(tp.category.color.opacity(0.22))
                Image(systemName: tp.category.icon)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(tp.category.color)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(tp.category.rawValue.uppercased())
                        .font(.system(size: 9, weight: .black))
                        .foregroundStyle(tp.category.color)
                        .tracking(0.5)
                }
                Text(tp.title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Text(tp.detail)
                    .font(.system(size: 11))
                    .foregroundStyle(PBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .padding(9)
        .background(PBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
    }

    private func questionRow(_ q: PrepQuestion) -> some View {
        HStack(alignment: .top, spacing: 11) {
            VStack(spacing: 1) {
                Text(q.framework)
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(.white)
                Text(q.pillar)
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.8))
            }
            .frame(width: 60)
            .padding(.vertical, 8)
            .background(
                LinearGradient(colors: [PBrand.purple.opacity(0.7), PBrand.purpleLight.opacity(0.5)],
                               startPoint: .top, endPoint: .bottom),
                in: RoundedRectangle(cornerRadius: 9)
            )
            Text(q.text)
                .font(.system(size: 12))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            Spacer(minLength: 0)
        }
        .padding(9)
        .background(PBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - 5. PrepHistoryCard (tidligere interaksjoner — timeline)

struct PrepHistoryCard: View {
    let interactions: [PrepInteraction] = PrepData.interactions

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 7) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(PBrand.yellow)
                    Text("Tidligere interaksjoner")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text("\(interactions.count)")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundStyle(PBrand.textSecondary)
                        .monospacedDigit()
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(PBrand.cardHi, in: Capsule())
                }
                Spacer()
                Button {} label: {
                    Text("Se alle")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(PBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            if interactions.isEmpty {
                prepEmptyState("Ingen tidligere interaksjoner enda")
            }
            VStack(alignment: .leading, spacing: 0) {
                ForEach(interactions.indices, id: \.self) { i in
                    let it = interactions[i]
                    timelineRow(it, isLast: i == interactions.count - 1)
                }
            }
        }
        .padding(14)
        .background(PBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(PBrand.stroke, lineWidth: 1))
    }

    private func timelineRow(_ it: PrepInteraction, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 11) {
            VStack(spacing: 0) {
                ZStack {
                    Circle().fill(it.kind.color.opacity(0.22))
                    Image(systemName: it.kind.icon)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(it.kind.color)
                }
                .frame(width: 28, height: 28)
                if !isLast {
                    Rectangle()
                        .fill(PBrand.stroke)
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(it.title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Text(it.detail)
                    .font(.system(size: 11))
                    .foregroundStyle(PBrand.textSecondary)
                HStack(spacing: 5) {
                    Text(it.timestamp)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(PBrand.textTertiary)
                        .monospacedDigit()
                    Text("·")
                        .foregroundStyle(PBrand.textTertiary)
                    Text(it.by)
                        .font(.system(size: 9))
                        .foregroundStyle(PBrand.textTertiary)
                }
                .padding(.top, 1)
            }
            .padding(.bottom, isLast ? 0 : 11)
            Spacer(minLength: 0)
        }
    }
}
