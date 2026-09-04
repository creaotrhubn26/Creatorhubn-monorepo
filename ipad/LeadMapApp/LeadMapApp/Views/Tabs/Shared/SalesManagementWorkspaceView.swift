import SwiftUI

private enum SMBrand {
    static let background = Color(red: 0.045, green: 0.035, blue: 0.085)
    static let card = Color(red: 0.095, green: 0.08, blue: 0.15)
    static let raised = Color(red: 0.135, green: 0.11, blue: 0.21)
    static let border = Color.white.opacity(0.09)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let red = Color(red: 0.95, green: 0.25, blue: 0.28)
    static let secondary = Color.white.opacity(0.65)
}

/// Produksjonsflaten for salgsledelse. Hele skjermen drives av én
/// workspace-snapshot slik at KPI-er, lister og badges aldri viser ulike
/// tidspunkt eller mockdata. Demo-modus bruker fortsatt prototypeflaten.
struct SalesManagementWorkspaceView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var workspace: SalesManagementWorkspace?
    @State private var forecast: LeadgridForecast?
    @State private var selectedTab = Tab.overview
    @State private var isLoading = false
    @State private var isMutating = false
    @State private var errorMessage: String?
    @State private var selectedGoalMember: SalesManagementWorkspace.TeamMember?
    @State private var showNewContest = false
    @State private var showNewPrize = false
    @State private var showNewCoaching = false
    @State private var commissionRate = 10.0

    enum Tab: String, CaseIterable, Identifiable {
        case overview = "Oversikt"
        case team = "Team & mål"
        case commission = "Provisjon"
        case contests = "Konkurranser"
        case operations = "Arbeidskø"
        case rewards = "Premier"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .overview: return "chart.xyaxis.line"
            case .team: return "person.3.fill"
            case .commission: return "percent"
            case .contests: return "trophy.fill"
            case .operations: return "checklist"
            case .rewards: return "gift.fill"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            tabBar
            Group {
                if isLoading && workspace == nil {
                    loadingState
                } else if let workspace {
                    ScrollView {
                        content(workspace)
                            .padding(horizontalSizeClass == .compact ? 14 : 20)
                            .padding(.bottom, 36)
                    }
                    .refreshable { await load(refreshForecast: false) }
                } else {
                    errorState
                }
            }
        }
        .background(SMBrand.background)
        .task { await load(refreshForecast: false) }
        .sheet(item: $selectedGoalMember) { member in
            SalesManagementGoalSheet(member: member) { target, won, meetings in
                await saveGoal(member: member, target: target, won: won, meetings: meetings)
            }
        }
        .sheet(isPresented: $showNewContest) {
            if let workspace {
                SalesManagementContestSheet(
                    templates: workspace.templates.filter(\.enabled),
                    prizes: workspace.prizeCatalog
                ) { request, idempotencyKey in
                    await mutate { api in
                        try await api.createSalesManagementContest(
                            request, idempotencyKey: idempotencyKey
                        )
                    }
                }
            }
        }
        .sheet(isPresented: $showNewPrize) {
            SalesManagementPrizeSheet { request, idempotencyKey in
                await mutate { api in
                    try await api.createSalesManagementPrize(request, idempotencyKey: idempotencyKey)
                }
            }
        }
        .sheet(isPresented: $showNewCoaching) {
            if let workspace {
                SalesManagementCoachingSheet(members: workspace.team) { userId, name, date, focus, idempotencyKey in
                    await mutate { api in
                        try await api.createSalesManagementCoaching(
                            memberUserId: userId, memberName: name,
                            scheduledAt: date, focus: focus,
                            idempotencyKey: idempotencyKey
                        )
                    }
                }
            }
        }
        .overlay(alignment: .top) {
            if isMutating {
                ProgressView("Lagrer …")
                    .tint(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.top, 8)
            }
        }
        .alert("Kunne ikke fullføre", isPresented: Binding(
            get: { errorMessage != nil && workspace != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: { Text(errorMessage ?? "Ukjent feil") }
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(SMBrand.purple.opacity(0.18))
                Image(systemName: "briefcase.fill")
                    .font(.appScaled(size: 18, weight: .bold)).foregroundStyle(SMBrand.purple)
            }.frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text("Salgsledelse")
                    .font(.appScaled(size: 20, weight: .black, design: .rounded)).foregroundStyle(.white)
                Text("Sanntidsstyring av team, mål og arbeidskø")
                    .font(.appScaled(size: 11, weight: .medium)).foregroundStyle(SMBrand.secondary)
            }
            Spacer()
            if workspace?.canManage == false {
                Label("Lesetilgang", systemImage: "eye.fill")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(SMBrand.secondary)
                    .padding(.horizontal, 9).padding(.vertical, 6)
                    .background(SMBrand.raised, in: Capsule())
            }
            Button { Task { await load(refreshForecast: true) } } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 38, height: 38).background(SMBrand.raised, in: Circle())
            }
            .disabled(isLoading || isMutating)
            .accessibilityLabel("Oppdater salgsledelse")
        }
        .padding(.horizontal, 18).padding(.vertical, 12)
    }

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Tab.allCases) { tab in
                    Button { selectedTab = tab } label: {
                        Label(tab.rawValue, systemImage: tab.icon)
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(selectedTab == tab ? .white : SMBrand.secondary)
                            .padding(.horizontal, 12).padding(.vertical, 9)
                            .background(selectedTab == tab ? SMBrand.purple : SMBrand.raised, in: Capsule())
                    }.buttonStyle(.plain)
                }
            }.padding(.horizontal, 18).padding(.bottom, 10)
        }
        .overlay(alignment: .bottom) { Rectangle().fill(SMBrand.border).frame(height: 1) }
    }

    @ViewBuilder
    private func content(_ workspace: SalesManagementWorkspace) -> some View {
        switch selectedTab {
        case .overview: overview(workspace)
        case .team: team(workspace)
        case .commission: commission(workspace)
        case .contests: contests(workspace)
        case .operations: operations(workspace)
        case .rewards: rewards(workspace)
        }
    }

    private func overview(_ workspace: SalesManagementWorkspace) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 12)], spacing: 12) {
                metric("VUNNET", money(workspace.summary.wonRevenueNok), "\(Int(workspace.summary.wonDeals)) avtaler", SMBrand.green)
                metric("PIPELINE", money(workspace.summary.pipelineValueNok), "Aktive muligheter", SMBrand.purple)
                metric("ARBEIDSKØ", "\(workspace.summary.pendingApprovals + workspace.summary.pendingMileage)", "Godkjenninger og kjøring", SMBrand.orange)
                metric("TEAM", "\(workspace.summary.teamMembers)", "\(workspace.summary.activeRoutes) aktive ruter", SMBrand.blue)
            }
            if let forecast {
                section("Prognose", icon: "chart.line.uptrend.xyaxis") {
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(money(forecast.predictedRevenueMid))
                                .font(.appScaled(size: 26, weight: .black, design: .rounded)).foregroundStyle(.white)
                            Text("Forventet · \(forecast.horizonDays) dager")
                                .font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(SMBrand.secondary)
                        }
                        Spacer()
                        Text("\(Int(forecast.confidence * 100)) % sikkerhet")
                            .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(SMBrand.green)
                    }
                    Text("Intervall \(money(forecast.predictedRevenueLow))–\(money(forecast.predictedRevenueHigh)) · \(forecast.predictedWonDeals) sannsynlige avtaler")
                        .font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(SMBrand.secondary)
                    if !forecast.reasoning.isEmpty {
                        Text(forecast.reasoning).font(.appScaled(size: 12)).foregroundStyle(.white.opacity(0.8))
                    }
                }
            }
            section("Team akkurat nå", icon: "person.3.fill") {
                ForEach(workspace.team.prefix(5)) { member in teamRow(member, showGoal: false) }
                if workspace.team.isEmpty { empty("Ingen teammedlemmer er lagt til ennå.") }
            }
            section("Krever handling", icon: "bell.badge.fill") {
                actionCount("Godkjenninger", workspace.summary.pendingApprovals, tint: SMBrand.orange) { selectedTab = .operations }
                actionCount("Coaching", workspace.summary.scheduledCoaching, tint: SMBrand.blue) { selectedTab = .operations }
                actionCount("Kjøregodtgjørelse", workspace.summary.pendingMileage, tint: SMBrand.green) { selectedTab = .operations }
                actionCount("Aktive konkurranser", workspace.summary.activeContests, tint: SMBrand.purple) { selectedTab = .contests }
            }
        }
    }

    private func team(_ workspace: SalesManagementWorkspace) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            section("Mål og prestasjon", icon: "target") {
                ForEach(workspace.team) { member in
                    if workspace.canManage {
                        Button { selectedGoalMember = member } label: { teamRow(member, showGoal: true) }
                            .buttonStyle(.plain)
                    } else {
                        teamRow(member, showGoal: true)
                    }
                }
                if workspace.team.isEmpty { empty("Ingen teammedlemmer å sette mål for.") }
            }
        }
    }

    private func commission(_ workspace: SalesManagementWorkspace) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            section("Provisjonsmodell", icon: "percent") {
                Text("Grunnprosent")
                    .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(SMBrand.secondary)
                HStack {
                    Slider(value: $commissionRate, in: 0...30, step: 0.5).tint(SMBrand.purple)
                        .disabled(!workspace.canManage)
                    Text("\(commissionRate, specifier: "%.1f") %")
                        .font(.appScaled(size: 15, weight: .black, design: .rounded)).foregroundStyle(.white)
                        .frame(width: 72, alignment: .trailing)
                }
                if workspace.canManage {
                    Button("Lagre provisjon") {
                        Task {
                            await mutate { api in
                                try await api.saveSalesManagementCommission(
                                    rate: commissionRate / 100,
                                    activeModels: ["base_percentage"]
                                )
                            }
                        }
                    }
                    .buttonStyle(SMPrimaryButtonStyle())
                }
                if workspace.team.contains(where: { !$0.commission.modelsIgnored.isEmpty }) {
                    Label("Modeller uten nødvendige datagrunnlag beregnes ikke og vises eksplisitt som utelatt.", systemImage: "info.circle")
                        .font(.appScaled(size: 11)).foregroundStyle(SMBrand.orange)
                }
            }
            section("Opptjent denne måneden", icon: "banknote.fill") {
                ForEach(workspace.team) { member in
                    HStack {
                        avatar(member.name)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(member.name).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                            Text("\(Int(member.wonDeals)) vunnet · \(money(member.wonRevenueNok))")
                                .font(.appScaled(size: 10)).foregroundStyle(SMBrand.secondary)
                        }
                        Spacer()
                        Text(money(member.commission.commissionNok))
                            .font(.appScaled(size: 14, weight: .black, design: .rounded)).foregroundStyle(SMBrand.green)
                    }.padding(.vertical, 5)
                }
            }
        }
        .onAppear { commissionRate = workspace.commissionConfig.baseRate * 100 }
    }

    private func contests(_ workspace: SalesManagementWorkspace) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Konkurranser").font(.appScaled(size: 17, weight: .black)).foregroundStyle(.white)
                Spacer()
                if workspace.canManage {
                    Button { showNewContest = true } label: { Label("Ny", systemImage: "plus") }
                        .buttonStyle(SMPrimaryButtonStyle())
                        .disabled(workspace.prizeCatalog.isEmpty)
                }
            }
            if workspace.canManage && workspace.prizeCatalog.isEmpty {
                warning("Legg inn minst én premie før du oppretter en konkurranse.")
            }
            ForEach(workspace.contests) { contest in
                section(contest.name, icon: contest.status == "active" ? "trophy.fill" : "checkmark.seal.fill") {
                    HStack {
                        statusPill(contest.status)
                        Text(contest.kpi.replacingOccurrences(of: "_", with: " "))
                            .font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(SMBrand.secondary)
                        Spacer()
                        Text("\(contest.participants.count) deltakere")
                            .font(.appScaled(size: 10, weight: .bold)).foregroundStyle(SMBrand.secondary)
                    }
                    ForEach(Array(contest.participants.prefix(3).enumerated()), id: \.element.id) { index, participant in
                        HStack {
                            Text("\(index + 1)").font(.appScaled(size: 12, weight: .black)).foregroundStyle(SMBrand.purple)
                                .frame(width: 24)
                            Text(participant.userName ?? "Teammedlem").font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            Spacer()
                            Text(participant.score.formatted()).font(.appScaled(size: 12, weight: .black)).foregroundStyle(SMBrand.green)
                        }
                    }
                    if workspace.canManage && contest.status == "active" {
                        HStack {
                            Button("Oppdater score") { Task { await mutate { try await $0.refreshSalesManagementContest(id: contest.id) } } }
                                .buttonStyle(SMSecondaryButtonStyle())
                            Button("Avslutt") { Task { await mutate { try await $0.closeSalesManagementContest(id: contest.id) } } }
                                .buttonStyle(SMPrimaryButtonStyle())
                            Spacer()
                        }
                    }
                }
            }
            if workspace.contests.isEmpty { empty("Ingen konkurranser er opprettet.") }
        }
    }

    private func operations(_ workspace: SalesManagementWorkspace) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            section("Godkjenninger", icon: "checkmark.seal.fill") {
                ForEach(workspace.approvals) { approval in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(approval.title).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                                Text([approval.sellerName, approval.customerName].compactMap { $0 }.joined(separator: " · "))
                                    .font(.appScaled(size: 10)).foregroundStyle(SMBrand.secondary)
                            }
                            Spacer()
                            Text(money(approval.amountNok)).font(.appScaled(size: 12, weight: .black)).foregroundStyle(.white)
                        }
                        if workspace.canManage {
                            HStack {
                                Button("Avslå") { Task { await mutate { try await $0.decideSalesManagementApproval(id: approval.id, approve: false, comment: nil) } } }
                                    .buttonStyle(SMSecondaryButtonStyle(tint: SMBrand.red))
                                Button("Godkjenn") { Task { await mutate { try await $0.decideSalesManagementApproval(id: approval.id, approve: true, comment: nil) } } }
                                    .buttonStyle(SMPrimaryButtonStyle(tint: SMBrand.green))
                            }
                        }
                    }.padding(.vertical, 6)
                }
                if workspace.approvals.isEmpty { empty("Ingen saker venter på godkjenning.") }
            }
            section("Coaching", icon: "person.2.wave.2.fill") {
                if workspace.canManage {
                    HStack {
                        Spacer()
                        Button("Planlegg 1-til-1") { showNewCoaching = true }
                            .buttonStyle(SMSecondaryButtonStyle())
                    }
                }
                ForEach(workspace.coaching) { session in
                    HStack {
                        avatar(session.memberName)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.memberName).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            Text(session.focus ?? "1-til-1").font(.appScaled(size: 10)).foregroundStyle(SMBrand.secondary)
                        }
                        Spacer()
                        if workspace.canManage {
                            Button("Fullfør") { Task { await mutate { try await $0.updateSalesManagementCoaching(id: session.id, status: "done") } } }
                                .buttonStyle(SMSecondaryButtonStyle(tint: SMBrand.green))
                        }
                    }
                }
                if workspace.coaching.isEmpty { empty("Ingen planlagte 1-til-1-samtaler.") }
            }
            section("Kjøregodtgjørelse", icon: "car.fill") {
                Text("Beløp beregnes av serveren med 3,50 kr/km (skattefri sats 2026).")
                    .font(.appScaled(size: 10)).foregroundStyle(SMBrand.secondary)
                ForEach(workspace.mileage.filter { $0.status == "pending" }) { claim in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(claim.sellerName ?? "Selger").font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            Text("\(claim.km.formatted()) km · \(claim.routeText ?? "Rute ikke oppgitt")")
                                .font(.appScaled(size: 10)).foregroundStyle(SMBrand.secondary).lineLimit(1)
                        }
                        Spacer()
                        Text(money(claim.amountNok)).font(.appScaled(size: 12, weight: .black)).foregroundStyle(.white)
                        if workspace.canManage {
                            Button("Godkjenn") { Task { await mutate { try await $0.updateSalesManagementMileage(id: claim.id, status: "approved") } } }
                                .buttonStyle(SMSecondaryButtonStyle(tint: SMBrand.green))
                        }
                    }
                }
                if !workspace.mileage.contains(where: { $0.status == "pending" }) { empty("Ingen kjøregodtgjørelse venter.") }
            }
            section("Team-ruter", icon: "map.fill") {
                ForEach(workspace.routes) { route in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(route.name).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            Text("\(route.sellerName ?? "Ikke tildelt") · \(route.stops.count) stopp")
                                .font(.appScaled(size: 10)).foregroundStyle(SMBrand.secondary)
                        }
                        Spacer(); statusPill(route.status)
                    }
                }
                if workspace.routes.isEmpty { empty("Ingen team-ruter er planlagt i dag.") }
            }
        }
    }

    private func rewards(_ workspace: SalesManagementWorkspace) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Premiekatalog").font(.appScaled(size: 17, weight: .black)).foregroundStyle(.white)
                Spacer()
                if workspace.canManage {
                    Button { showNewPrize = true } label: { Label("Ny premie", systemImage: "plus") }
                        .buttonStyle(SMPrimaryButtonStyle())
                }
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], spacing: 12) {
                ForEach(workspace.prizeCatalog) { prize in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack { Image(systemName: "gift.fill").foregroundStyle(SMBrand.purple); Spacer(); Text(money(prize.estimatedValueNok)).font(.appScaled(size: 11, weight: .black)).foregroundStyle(SMBrand.green) }
                        Text(prize.title).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        Text(prize.description).font(.appScaled(size: 10)).foregroundStyle(SMBrand.secondary).lineLimit(2)
                        if workspace.canManage {
                            Button("Arkiver", role: .destructive) { Task { await mutate { try await $0.archiveSalesManagementPrize(id: prize.id) } } }
                                .font(.appScaled(size: 10, weight: .bold))
                        }
                    }
                    .padding(13).background(SMBrand.card, in: RoundedRectangle(cornerRadius: 13))
                    .overlay(RoundedRectangle(cornerRadius: 13).stroke(SMBrand.border))
                }
            }
            section("Fulfillment", icon: "shippingbox.fill") {
                ForEach(workspace.awards) { award in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(award.productTitle).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            Text(award.winnerName ?? "Vinner").font(.appScaled(size: 10)).foregroundStyle(SMBrand.secondary)
                        }
                        Spacer(); statusPill(award.status)
                        if workspace.canManage, let next = nextAwardStatus(award.status) {
                            Button(next.label) { Task { await mutate { try await $0.updateSalesManagementAward(id: award.id, status: next.status, trackingNumber: nil) } } }
                                .buttonStyle(SMSecondaryButtonStyle())
                        }
                    }
                }
                if workspace.awards.isEmpty { empty("Ingen premier venter på fulfillment.") }
            }
        }
    }

    private func teamRow(_ member: SalesManagementWorkspace.TeamMember, showGoal: Bool) -> some View {
        HStack(spacing: 10) {
            avatar(member.name)
            VStack(alignment: .leading, spacing: 3) {
                Text(member.name).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                Text("\(Int(member.wonDeals)) vunnet · \(money(member.wonRevenueNok))")
                    .font(.appScaled(size: 10)).foregroundStyle(SMBrand.secondary)
                if showGoal {
                    let target = member.goal?.targetNok ?? 0
                    ProgressView(value: target > 0 ? min(1, member.wonRevenueNok / target) : 0)
                        .tint(target > 0 && member.wonRevenueNok >= target ? SMBrand.green : SMBrand.purple)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(member.activityTrendPct >= 0 ? "+" : "")\(member.activityTrendPct) %")
                    .font(.appScaled(size: 11, weight: .black)).foregroundStyle(member.activityTrendPct >= 0 ? SMBrand.green : SMBrand.red)
                if showGoal { Text(member.goal.map { "Mål \(money($0.targetNok))" } ?? "Sett mål").font(.appScaled(size: 9, weight: .bold)).foregroundStyle(SMBrand.secondary) }
            }
        }.padding(.vertical, 5)
    }

    private func metric(_ title: String, _ value: String, _ subtitle: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.appScaled(size: 9, weight: .black)).tracking(0.8).foregroundStyle(tint)
            Text(value).font(.appScaled(size: 20, weight: .black, design: .rounded)).foregroundStyle(.white).minimumScaleFactor(0.7)
            Text(subtitle).font(.appScaled(size: 9)).foregroundStyle(SMBrand.secondary)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(13)
            .background(SMBrand.card, in: RoundedRectangle(cornerRadius: 13))
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(tint.opacity(0.25)))
    }

    private func section<Content: View>(_ title: String, icon: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            Label(title, systemImage: icon).font(.appScaled(size: 14, weight: .black)).foregroundStyle(.white)
            content()
        }.padding(14).background(SMBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(SMBrand.border))
    }

    private func actionCount(_ title: String, _ count: Int, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack { Text(title).font(.appScaled(size: 12, weight: .bold)); Spacer(); Text("\(count)").font(.appScaled(size: 12, weight: .black)).foregroundStyle(tint); Image(systemName: "chevron.right").font(.appScaled(size: 9, weight: .bold)).foregroundStyle(SMBrand.secondary) }
                .foregroundStyle(.white).padding(.vertical, 3)
        }.buttonStyle(.plain)
    }

    private func avatar(_ name: String) -> some View {
        Text(name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased())
            .font(.appScaled(size: 10, weight: .black)).foregroundStyle(.white)
            .frame(width: 34, height: 34).background(SMBrand.purple.opacity(0.55), in: Circle())
    }

    private func statusPill(_ status: String) -> some View {
        Text(status.replacingOccurrences(of: "_", with: " ").uppercased())
            .font(.appScaled(size: 8, weight: .black)).foregroundStyle(.white)
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(status == "active" || status == "approved" || status == "received" ? SMBrand.green.opacity(0.75) : SMBrand.purple.opacity(0.7), in: Capsule())
    }

    private func empty(_ text: String) -> some View {
        Text(text).font(.appScaled(size: 11)).foregroundStyle(SMBrand.secondary).frame(maxWidth: .infinity).padding(.vertical, 12)
    }

    private func warning(_ text: String) -> some View {
        Label(text, systemImage: "exclamationmark.triangle.fill")
            .font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(SMBrand.orange)
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(SMBrand.orange.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
    }

    private var loadingState: some View {
        VStack(spacing: 12) { ProgressView().tint(SMBrand.purple); Text("Henter salgsdata …").font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(SMBrand.secondary) }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var errorState: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.arrow.triangle.2.circlepath").font(.appScaled(size: 30)).foregroundStyle(SMBrand.orange)
            Text("Salgsledelse kunne ikke lastes").font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
            Text(errorMessage ?? "Kontroller tilkoblingen og prøv igjen.").font(.appScaled(size: 11)).foregroundStyle(SMBrand.secondary).multilineTextAlignment(.center)
            Button("Prøv igjen") { Task { await load(refreshForecast: false) } }.buttonStyle(SMPrimaryButtonStyle())
        }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func money(_ value: Double) -> String {
        value.formatted(.currency(code: "NOK").precision(.fractionLength(0)).locale(Locale(identifier: "nb_NO")))
    }

    private func nextAwardStatus(_ status: String) -> (status: String, label: String)? {
        switch status {
        case "pending": return ("ordered", "Bestill")
        case "ordered": return ("shipped", "Sendt")
        case "shipped": return ("received", "Mottatt")
        default: return nil
        }
    }

    @MainActor
    private func load(refreshForecast: Bool) async {
        guard let api = appState.api else {
            errorMessage = "Du må være innlogget i et Leadgrid-workspace."
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            workspace = try await api.fetchSalesManagementWorkspace()
            commissionRate = (workspace?.commissionConfig.baseRate ?? 0.10) * 100
            if refreshForecast {
                forecast = try? await api.refreshPipelineForecast(horizon: 90)
            } else {
                forecast = try? await api.fetchPipelineForecast(horizon: 90)
            }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func mutate(_ operation: @escaping (APIClient) async throws -> Void) async -> Bool {
        guard let api = appState.api, workspace?.canManage == true, !isMutating else { return false }
        isMutating = true
        defer { isMutating = false }
        do {
            try await operation(api)
            workspace = try await api.fetchSalesManagementWorkspace()
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    @MainActor
    private func saveGoal(member: SalesManagementWorkspace.TeamMember, target: Double, won: Int?, meetings: Int?) async -> Bool {
        guard let api = appState.api, workspace?.canManage == true else { return false }
        do {
            let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM"
            try await api.saveSalesManagementGoal(userId: member.userId, yearMonth: formatter.string(from: Date()), targetNok: target, targetWonDeals: won, targetMeetings: meetings)
            workspace = try await api.fetchSalesManagementWorkspace()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}

private struct SMPrimaryButtonStyle: ButtonStyle {
    var tint = SMBrand.purple
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.appScaled(size: 11, weight: .bold)).foregroundStyle(.white)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(tint.opacity(configuration.isPressed ? 0.65 : 1), in: Capsule())
    }
}

private struct SMSecondaryButtonStyle: ButtonStyle {
    var tint = SMBrand.purple
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.appScaled(size: 10, weight: .bold)).foregroundStyle(tint)
            .padding(.horizontal, 10).padding(.vertical, 7)
            .background(tint.opacity(configuration.isPressed ? 0.18 : 0.09), in: Capsule())
            .overlay(Capsule().stroke(tint.opacity(0.4)))
    }
}

private struct SalesManagementGoalSheet: View {
    @Environment(\.dismiss) private var dismiss
    let member: SalesManagementWorkspace.TeamMember
    let onSave: (Double, Int?, Int?) async -> Bool
    @State private var target = ""
    @State private var won = ""
    @State private var meetings = ""
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Månedsmål for \(member.name)") {
                    TextField("Omsetning i NOK", text: $target).keyboardType(.decimalPad)
                    TextField("Vunne avtaler", text: $won).keyboardType(.numberPad)
                    TextField("Bookede møter", text: $meetings).keyboardType(.numberPad)
                }
            }
            .navigationTitle("Sett mål")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Lagrer …" : "Lagre") {
                        saving = true
                        Task {
                            if await onSave(Double(target) ?? 0, Int(won), Int(meetings)) { dismiss() }
                            saving = false
                        }
                    }.disabled(saving || (Double(target) ?? 0) < 0)
                }
            }
            .onAppear {
                target = String(Int(member.goal?.targetNok ?? 0))
                won = member.goal?.targetWonDeals.map { String(Int($0)) } ?? ""
                meetings = member.goal?.targetMeetingsBooked.map { String(Int($0)) } ?? ""
            }
        }
    }
}

private struct SalesManagementContestSheet: View {
    @Environment(\.dismiss) private var dismiss
    let templates: [SalesManagementWorkspace.Template]
    let prizes: [SalesManagementWorkspace.Prize]
    let onCreate: (SalesManagementContestRequest, String) async -> Bool
    @State private var name = ""
    @State private var template = "weekly_revenue"
    @State private var prizeId = ""
    @State private var endDate = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
    @State private var saving = false
    @State private var idempotencyKey = UUID().uuidString

    var body: some View {
        NavigationStack {
            Form {
                TextField("Navn på konkurransen", text: $name)
                Picker("Mal", selection: $template) {
                    ForEach(templates) { Text($0.label).tag($0.templateType) }
                }
                Picker("1. premie", selection: $prizeId) {
                    ForEach(prizes) { Text($0.title).tag($0.id) }
                }
                DatePicker("Avsluttes", selection: $endDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
            }
            .navigationTitle("Ny konkurranse")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Opprett") {
                        guard let prize = prizes.first(where: { $0.id == prizeId }),
                              let selectedTemplate = templates.first(where: { $0.templateType == template }) else { return }
                        saving = true
                        let snapshot = SalesManagementPrizeRequest(
                            id: prize.id, title: prize.title, description: prize.description,
                            category: prize.category, estimatedValueNok: Int(prize.estimatedValueNok),
                            fulfillmentType: prize.fulfillmentType, imageUrl: prize.imageUrl, metadata: [:]
                        )
                        Task {
                            let created = await onCreate(SalesManagementContestRequest(
                                name: name, templateType: template, kpi: selectedTemplate.defaultKpi,
                                startsAt: ISO8601DateFormatter().string(from: Date()),
                                endsAt: ISO8601DateFormatter().string(from: endDate),
                                prizes: [.init(rank: 1, productSnapshot: snapshot)]
                            ), idempotencyKey)
                            if created { dismiss() } else { saving = false }
                        }
                    }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || prizeId.isEmpty || saving)
                }
            }
            .onAppear { template = templates.first?.templateType ?? template; prizeId = prizes.first?.id ?? "" }
        }
    }
}

private struct SalesManagementPrizeSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onCreate: (SalesManagementPrizeRequest, String) async -> Bool
    @State private var title = ""
    @State private var detail = ""
    @State private var value = ""
    @State private var category = "physical"
    @State private var fulfillment = "physical_shipping"
    @State private var saving = false
    @State private var idempotencyKey = UUID().uuidString

    var body: some View {
        NavigationStack {
            Form {
                TextField("Premienavn", text: $title)
                TextField("Beskrivelse", text: $detail, axis: .vertical)
                TextField("Estimert verdi i NOK", text: $value).keyboardType(.numberPad)
                Picker("Kategori", selection: $category) {
                    Text("Fysisk").tag("physical"); Text("Digital").tag("digital"); Text("Opplevelse").tag("experience"); Text("Kontant").tag("cash")
                }
                Picker("Levering", selection: $fulfillment) {
                    Text("Sendes").tag("physical_shipping"); Text("Digital kode").tag("digital_code"); Text("Lønn").tag("cash_on_payroll"); Text("Opplevelsesbillett").tag("experience_ticket")
                }
            }
            .navigationTitle("Ny premie")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        saving = true
                        Task {
                            let created = await onCreate(
                                .init(id: nil, title: title, description: detail, category: category,
                                      estimatedValueNok: Int(value) ?? 0, fulfillmentType: fulfillment,
                                      imageUrl: nil, metadata: [:]),
                                idempotencyKey
                            )
                            if created { dismiss() } else { saving = false }
                        }
                    }.disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }
}
