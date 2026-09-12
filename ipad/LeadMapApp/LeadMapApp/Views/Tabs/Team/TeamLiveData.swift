// TeamLiveData.swift
//
// Uke 2-binding for Team-fanen: EKTE team-data når demo-modus er AV.
// TeamData-getterne i TeamView.swift leser fra denne storen (samme
// gating-mønster som Leads/Møter):
//
//   • members     ← /api/leadgrid/sales-leadership/team-members
//                   (won/leads/trend) + møte-telling fra appState.calendar
//                   + område/farge fra LeadgridSalesTeamStore (backend-synket)
//   • pipeline    ← beregnet fra appState.leads (status-fordeling)
//   • conversions ← beregnet fra pipeline-tellingene
//
// Aktivitetsfeed + kart-områder forblir demo-gated — det finnes ingen
// aktivitets-feed-endepunkt enda (crm_lead_activities er også tom i prod
// inntil felt-bruk starter).
//
// Momentum per medlem = relativ produktivitet (leads vs. beste selger,
// 0-100) — en proxy til backend får en ekte momentum-serie per selger.

import SwiftUI

@MainActor
@Observable
final class TeamLiveStore {
    static let shared = TeamLiveStore()

    private(set) var members: [TeamMember] = []
    /// Rå DTO-er fra team-members-endepunktet — beholder `won`/`title` som
    /// TeamMember-mappingen dropper. Brukes av SalgsledelseView til å bygge
    /// ekte selgerliste (leaderboard) når demo-modus er AV.
    private(set) var memberDTOs: [SalesTeamMemberDTO] = []
    /// Innlogget brukers user-id fra team-members-endepunktet — brukes av
    /// «Meg selv»-tilordning i Leads-fanens radmeny (2026-07-17).
    private(set) var currentUserId: String? = nil
    private(set) var pipeline: [PipelineStage] = []
    private(set) var conversions: [ConversionRow] = []
    /// Org-ens siste aktiviteter (2026-07-04) — tilbud/besøk/status fra
    /// /api/leadgrid/activity-feed.
    private(set) var activities: [ActivityEvent] = []
    /// Gj.snitt lead-score + antall vunnet — brukes av KPI-kortene.
    private(set) var avgLeadScore: Int = 0
    private(set) var salesCount: Int = 0
    var loadState: ProjectsLoadState = .idle

    private weak var api: APIClient?
    private var didInitialSync = false

    private init() {}

    /// Kalles fra TeamView når APIClient er tilgjengelig (idempotent —
    /// første kall trigger fetch).
    func attach(api: APIClient, appState: AppState) {
        self.api = api
        guard !didInitialSync else {
            // Re-beregn leads-avledede tall (pipeline osv.) ved re-entry —
            // billig og holder fanen i synk med kartet.
            recomputeFromLeads(appState.leads)
            return
        }
        didInitialSync = true
        Task { await refresh(appState: appState) }
    }

    func refresh(appState: AppState) async {
        guard let api else { return }
        if case .loaded = loadState {} else { loadState = .loading }
        recomputeFromLeads(appState.leads)
        // Aktivitetsfeed — uavhengig av team-members (feiler stille).
        if let feed = try? await api.fetchActivityFeed() {
            activities = feed.map(Self.mapActivity)
        }
        do {
            let resp = try await api.fetchSalesTeamMembers()
            memberDTOs = resp.members
            currentUserId = resp.currentUserId
            let maxLeads = max(1, resp.members.map(\.leads).max() ?? 1)
            members = resp.members.map { dto in
                let team = LeadgridSalesTeamStore.shared.team(for: dto.userId)
                let meetings = appState.calendar.filter {
                    $0.eventType == "meeting" && $0.assignedUserName == dto.name
                }.count
                return TeamMember(
                    id: Self.stableUUID(from: dto.userId),
                    name: dto.name,
                    area: team?.name ?? "Ikke tildelt område",
                    initials: Self.initials(for: dto.name),
                    color: team?.color ?? Self.stableColor(for: dto.name),
                    leads: dto.leads,
                    leadsTrend: dto.trend,
                    meetings: meetings,
                    meetingsTrend: 0,
                    valueNok: dto.totalValueNok,
                    valueTrend: 0,
                    momentum: Int((Double(dto.leads) / Double(maxLeads)) * 100)
                )
            }
            loadState = .loaded
        } catch {
            print("[TeamLiveStore] refresh feilet: \(error)")
            if case .loaded = loadState {} else {
                loadState = .failed(error.localizedDescription)
            }
        }
    }

    /// Pipeline-trakt + konverteringsrater fra ekte lead-statuser.
    private func recomputeFromLeads(_ leads: [LeadModel]) {
        let nye = leads.filter { $0.status == .unvisited }.count
        let kontaktet = leads.filter {
            [.visited, .return, .notPresent, .interested].contains($0.status)
        }.count
        let moter = leads.filter { $0.status == .meetingBooked }.count
        let tilbud = leads.filter { $0.status == .proposalSent }.count
        let vunnet = leads.filter { $0.status == .won }.count

        let counts = [nye, kontaktet, moter, tilbud, vunnet]
        let labels = ["Nye leads", "Kontaktet", "Møter avtalt", "Tilbud sendt", "Vunnet"]
        let colors: [Color] = [TBrand.purple, TBrand.blue, TBrand.green, TBrand.yellow, TBrand.red]
        let maxCount = max(1, counts.max() ?? 1)

        // Trakt-geometri: bredde ∝ antall (gulv 0.30 så tekst får plass),
        // monotont smalnende, bottom_i == top_{i+1} som i mock-designet.
        var tops: [Double] = []
        var prev = 1.0
        for c in counts {
            let raw = max(0.30, min(1.0, Double(c) / Double(maxCount)))
            let top = min(prev, raw)
            tops.append(top)
            prev = top
        }
        pipeline = counts.isEmpty ? [] : (0..<counts.count).map { i in
            PipelineStage(
                label: labels[i],
                count: counts[i],
                color: colors[i],
                topFraction: tops[i],
                bottomFraction: i + 1 < tops.count ? tops[i + 1] : max(0.2, tops[i] - 0.1)
            )
        }
        // Tom kart-tilstand: ingen leads → tom trakt (viewet har empty-state)
        if leads.isEmpty { pipeline = [] }

        func pct(_ a: Int, _ b: Int) -> Double {
            b > 0 ? (Double(a) / Double(b) * 100).rounded(toPlaces: 1) : 0
        }
        conversions = leads.isEmpty ? [] : [
            ConversionRow(label: "Nye leads → Kontaktet", pct: pct(kontaktet, nye), isTotal: false),
            ConversionRow(label: "Kontaktet → Møter",     pct: pct(moter, kontaktet), isTotal: false),
            ConversionRow(label: "Møter → Tilbud",        pct: pct(tilbud, moter), isTotal: false),
            ConversionRow(label: "Tilbud → Vunnet",       pct: pct(vunnet, tilbud), isTotal: false),
            ConversionRow(label: "Total konvertering",    pct: pct(vunnet, nye), isTotal: true),
        ]

        // Kun ekte lead-scores (>0) — samme semantikk som Leads-fanen.
        // aiOpportunityScore defaulter til 100 for discovery-leads og
        // blåste snittet til «100» mens hver rad viste 0 (desktop-QA
        // 2026-07-05).
        let scores = leads.compactMap(\.leadScore).filter { $0 > 0 }
        avgLeadScore = scores.isEmpty ? 0 : scores.reduce(0, +) / scores.count
        salesCount = vunnet
    }

    // MARK: - Aktivitets-mapping

    /// Feed-DTO → Team-fanens ActivityEvent-rad (norsk relativ-tid +
    /// høydepunkt-farge for vunnet/tapt/tilbud).
    private static func mapActivity(_ dto: ActivityFeedItemDTO) -> ActivityEvent {
        let highlight: (String?, Color)
        switch dto.activityType {
        case "proposal_sent":  highlight = ("Tilbud", TBrand.purple)
        case "meeting_scheduled": highlight = ("Møte", TBrand.green)
        case "visit_logged":   highlight = ("Besøk", TBrand.blue)
        case "status_changed" where (dto.newValue ?? "") == "won":
            highlight = ("Vunnet", TBrand.green)
        case "status_changed" where (dto.newValue ?? "") == "lost":
            highlight = ("Tapt", TBrand.red)
        default:               highlight = (nil, .clear)
        }
        let action = dto.description.isEmpty
            ? "\(dto.activityType) — \(dto.leadName)"
            : dto.description
        return ActivityEvent(
            memberName: dto.userName,
            memberInitials: Self.initials(for: dto.userName),
            memberColor: Self.stableColor(for: dto.userName),
            action: action,
            highlight: highlight.0,
            highlightColor: highlight.1,
            timeAgo: Self.relativeTime(dto.createdAt)
        )
    }

    private static func relativeTime(_ iso: String?) -> String {
        guard let iso else { return "" }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = fractional.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return ""
        }
        let rel = RelativeDateTimeFormatter()
        rel.locale = Locale(identifier: "nb_NO")
        rel.unitsStyle = .short
        return rel.localizedString(for: date, relativeTo: Date())
    }

    // MARK: - Helpers

    private static let palette: [Color] = [
        TBrand.purple, TBrand.blue, TBrand.green, TBrand.yellow, TBrand.pink,
    ]

    private static func stableColor(for key: String) -> Color {
        var hash = 5381
        for b in key.utf8 { hash = ((hash << 5) &+ hash) &+ Int(b) }
        return palette[abs(hash) % palette.count]
    }

    private static func initials(for name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first }.map(String.init).joined()
        return letters.isEmpty ? "–" : letters.uppercased()
    }

    private static func stableUUID(from userId: String) -> UUID {
        UUID(uuidString: userId) ?? UUID()
    }
}

private extension Double {
    func rounded(toPlaces places: Int) -> Double {
        let divisor = pow(10.0, Double(places))
        return (self * divisor).rounded() / divisor
    }
}
