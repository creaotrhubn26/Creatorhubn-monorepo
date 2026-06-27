// MapProjectCard.swift
//
// Aktivt prosjekt-kort øverst på kartet. Erstatter den gamle passive
// ProjectContextCard (som kun viste navn + ikon "1" + diamant "0").
//
// Vises:
//   • Logo / monogram + prosjektnavn
//   • Status-linje: aktiv rute, leads igjen i dag, momentum %
//   • Neste stopp (hvis dayRoute) + drive-tid
//   • Drag-handle: sveipes opp → ProjectDetailSheet (full bottom-sheet)
//   • CTA-rad: [Start rute] [Neste lead] [Detaljer]
//
// Multi-prosjekt-pager (PR #leadmap-multi-project):
//   • TabView(selection:) i .page-style — horisontal swipe mellom alle
//     prosjekter brukeren har.
//   • Side-indikator (• • •) under kortet markerer hvilket prosjekt
//     som er aktivt.
//   • Swipe oppdaterer `appState.activeProjectId` → map-pins, counters,
//     status-pille og «Start rute»-CTA re-filtreres automatisk via
//     eksisterende didSet → refreshAll().
//   • Chevron ved siden av navnet åpner full bottom-sheet med liste
//     over alle prosjekter (sortert etter aktivitet) for raskt hopp.
//   • Empty-state: hvis brukeren har 0 prosjekter, vises ett placeholder-
//     kort som peker mot Prosjekter-listen.
//
// Data hentes fra eksisterende AppState — vi finner ikke opp nye
// endepunkter, bare rikere bruk av momentum/dayRoute/workloadLeads.

import SwiftUI

struct MapProjectCard: View {
    @Environment(AppState.self) private var appState
    /// Bindes til parent for å bytte til Leads-tab og åpne Min dag.
    var onStartRoute: () -> Void
    var onOpenNext: (LeadModel) -> Void
    var onTapExpand: () -> Void

    /// Lokal valgt indeks i pagereren. Synkroniseres begge veier mot
    /// `appState.activeProjectId` slik at swipe oppdaterer global state,
    /// og eksterne endringer (f.eks. valg fra ProjectPicker eller
    /// «Alle prosjekter»-sheeten) flytter pageren.
    @State private var selectedIndex: Int = 0
    @State private var showAllProjectsSheet = false

    private let cardHeight: CGFloat = 200

    var body: some View {
        Group {
            // 3-state-switch (bug-fix etter PR #993):
            //   .idle / .loading → skeleton-kort (ikke empty-state)
            //   .failed          → kompakt error-banner m/ retry
            //   .loaded + tom    → ekte «Ingen prosjekter ennå»
            //   .loaded + data   → multi-prosjekt-pageren
            //
            // Daniel rapporterte at empty-state-kortet blinket i 1-2 sek
            // ved app-start selv om han hadde 4 prosjekter. Roten var at
            // den gamle `projects.isEmpty` ikke skilte mellom «laster»
            // og «ekte tom liste».
            switch appState.projectsLoadState {
            case .idle, .loading:
                if appState.projects.isEmpty {
                    LoadingProjectCard()
                        .frame(height: cardHeight)
                        .padding(.horizontal, 12)
                } else {
                    // Allerede har cached data fra forrige sesjon — vis
                    // pageren med eksisterende data så vi ikke blinker
                    // skeleton over noe brukeren allerede ser.
                    pager
                }
            case .failed(let message, let isRetryable):
                if appState.projects.isEmpty {
                    ErrorProjectCard(
                        message: message,
                        isRetryable: isRetryable,
                        onRetry: { Task { await appState.refreshAll() } },
                        onReauth: { appState.sessionExpired = true }
                    )
                    .frame(height: cardHeight)
                    .padding(.horizontal, 12)
                } else {
                    // Vi har cached data; ikke kast over en error-banner —
                    // vis pageren slik at brukeren kan jobbe videre offline.
                    pager
                }
            case .loaded:
                if appState.projects.isEmpty {
                    ProjectCardEmptyState()
                        .frame(height: cardHeight)
                        .padding(.horizontal, 12)
                } else {
                    pager
                }
            }
        }
        .sheet(isPresented: $showAllProjectsSheet) {
            AllProjectsSheet { project in
                appState.activeProjectId = project.id
                // Syncs index slik at pageren glir til valgt prosjekt
                // når sheeten lukkes.
                if let idx = appState.projects.firstIndex(where: { $0.id == project.id }) {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        selectedIndex = idx
                    }
                }
                showAllProjectsSheet = false
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Pager

    @ViewBuilder
    private var pager: some View {
        TabView(selection: $selectedIndex) {
            ForEach(Array(appState.projects.enumerated()), id: \.element.id) { index, project in
                ProjectCardContent(
                    project: project,
                    isActive: project.id == appState.activeProjectId,
                    onStartRoute: onStartRoute,
                    onOpenNext: onOpenNext,
                    onTapExpand: onTapExpand,
                    onOpenAllProjects: { showAllProjectsSheet = true }
                )
                .tag(index)
                .padding(.horizontal, 12)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
        .indexViewStyle(.page(backgroundDisplayMode: .interactive))
        .frame(height: cardHeight)
        .onAppear { syncIndexFromActiveProject() }
        .onChange(of: appState.activeProjectId) { _, _ in
            syncIndexFromActiveProject()
        }
        .onChange(of: appState.projects.map(\.id)) { _, _ in
            syncIndexFromActiveProject()
        }
        .onChange(of: selectedIndex) { _, newIndex in
            guard appState.projects.indices.contains(newIndex) else { return }
            let project = appState.projects[newIndex]
            if appState.activeProjectId != project.id {
                appState.activeProjectId = project.id
            }
        }
    }

    /// Speil `activeProjectId` → `selectedIndex`. Hvis det aktive
    /// prosjektet ikke finnes i listen (eller er nil), faller vi til
    /// første prosjekt og setter active så map-pins ikke står tomt.
    private func syncIndexFromActiveProject() {
        guard !appState.projects.isEmpty else { return }
        if let activeId = appState.activeProjectId,
           let idx = appState.projects.firstIndex(where: { $0.id == activeId }) {
            if selectedIndex != idx { selectedIndex = idx }
        } else {
            // Auto-velg første prosjekt — bedre UX enn tomt kart
            // (matcher web-versjonen som auto-velger ved første lasting).
            selectedIndex = 0
            let first = appState.projects[0]
            if appState.activeProjectId != first.id {
                appState.activeProjectId = first.id
            }
        }
    }
}

// MARK: - Per-prosjekt-kort-innhold

/// Innholdet i ett enkelt kort. Lever som egen view slik at hvert kort
/// i TabView-en holder sin egen state og rendres lazy.
private struct ProjectCardContent: View {
    @Environment(AppState.self) private var appState
    let project: ProjectListItem
    /// Er dette prosjektet det aktivt valgte? Bare det aktive kortet
    /// trekker live status (route, momentum, workload) — andre kort
    /// viser «statiske» project-list-tall så vi ikke jaffer N parallelle
    /// momentum-kall.
    let isActive: Bool
    var onStartRoute: () -> Void
    var onOpenNext: (LeadModel) -> Void
    var onTapExpand: () -> Void
    var onOpenAllProjects: () -> Void

    @State private var momentum: LeadgridMomentum?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            headerRow
            statusLine
            if isActive, let nextStop = nextRouteStop {
                nextStopRow(nextStop)
            } else if isActive, let nextLead = nextWorkloadLead {
                nextStopRow(leadName: nextLead.name,
                            distanceKm: nextLead.distanceKm,
                            address: nextLead.address ?? nextLead.city)
            }
            actionRow
            // Drag-handle som visuell hint om at kortet kan sveipes opp.
            Capsule()
                .fill(Color.white.opacity(0.25))
                .frame(width: 36, height: 4)
                .frame(maxWidth: .infinity)
                .padding(.top, 2)
        }
        .padding(14)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.36, green: 0.18, blue: 0.62).opacity(0.92),
                    Color(red: 0.18, green: 0.08, blue: 0.38).opacity(0.96)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.35), radius: 8, x: 0, y: 4)
        .contentShape(RoundedRectangle(cornerRadius: 14))
        .onTapGesture {
            if isActive { onTapExpand() }
        }
        .gesture(
            // Begrens drag-up til vertikale dra — ellers spiser denne
            // gesten den horisontale TabView-pageren.
            DragGesture(minimumDistance: 18)
                .onEnded { value in
                    let isVertical = abs(value.translation.height) > abs(value.translation.width)
                    if isVertical && value.translation.height < -20 && isActive {
                        onTapExpand()
                    }
                }
        )
        .task(id: project.id) {
            // Bare det aktive kortet laster momentum (én call per swipe).
            if isActive { await loadMomentum() }
        }
    }

    // MARK: - Header

    @ViewBuilder
    private var headerRow: some View {
        HStack(alignment: .center, spacing: 10) {
            logoBubble
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(project.name)
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Button {
                        onOpenAllProjects()
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.caption2.bold())
                            .foregroundStyle(.white.opacity(0.75))
                            .padding(4)
                            .background(Color.white.opacity(0.12), in: Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Vis alle prosjekter")
                }
                Text(positioning)
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            statusBadge
        }
    }

    @ViewBuilder
    private var logoBubble: some View {
        Group {
            if isActive,
               let urlStr = appState.activeProjectSummary?.brandKit?.logoUrl,
               let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit().padding(4)
                    default:
                        Text(project.name.prefix(2).uppercased())
                            .font(.caption.bold())
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 38, height: 38)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                Text(project.name.prefix(2).uppercased())
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(Color.white.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        let active = isActive && appState.dayRoute != nil
        HStack(spacing: 4) {
            Circle()
                .fill(active ? Color(red: 0.30, green: 0.92, blue: 0.55) : Color.white.opacity(0.4))
                .frame(width: 7, height: 7)
            Text(active ? "Aktiv rute" : "Ingen rute")
                .font(.caption2.bold())
                .foregroundStyle(.white.opacity(0.92))
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(Color.white.opacity(0.12), in: Capsule())
    }

    // MARK: - Status-linje (leads igjen i dag · momentum)

    @ViewBuilder
    private var statusLine: some View {
        HStack(spacing: 10) {
            Label("\(leadsRemainingToday) leads igjen", systemImage: "checklist")
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.92))
            if isActive, let m = momentum {
                Label("\(Int(m.score))% momentum", systemImage: "bolt.heart.fill")
                    .font(.caption.bold())
                    .foregroundStyle(momentumColor(m.score))
            } else {
                Label("\(project.leadCount) leads totalt", systemImage: "person.3.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.white.opacity(0.85))
            }
            Spacer(minLength: 0)
        }
    }

    private func momentumColor(_ score: Double) -> Color {
        if score >= 75 { return Color(red: 0.30, green: 0.92, blue: 0.55) }
        if score >= 50 { return Color(red: 0.98, green: 0.79, blue: 0.30) }
        return Color(red: 0.98, green: 0.50, blue: 0.50)
    }

    // MARK: - Neste stopp

    @ViewBuilder
    private func nextStopRow(_ stop: DayRouteStop) -> some View {
        nextStopRow(
            leadName: stop.name ?? "Stopp \(stop.position)",
            distanceKm: nil,
            driveSeconds: stop.driveSecondsFromPrevious,
            address: nil
        )
    }

    @ViewBuilder
    private func nextStopRow(
        leadName: String,
        distanceKm: Double?,
        driveSeconds: Int? = nil,
        address: String?
    ) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.turn.up.right")
                .foregroundStyle(Color(red: 0.30, green: 0.92, blue: 0.55))
                .font(.caption.bold())
            VStack(alignment: .leading, spacing: 2) {
                Text("Neste stopp: \(leadName)")
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let s = driveSeconds, s > 0 {
                    Text("\(s / 60) min unna")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.72))
                } else if let km = distanceKm {
                    Text(formatKm(km))
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.72))
                } else if let addr = address {
                    Text(addr)
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
    }

    private func formatKm(_ km: Double) -> String {
        if km < 1 { return "\(Int(km * 1000)) m unna" }
        return String(format: "%.1f km unna", km)
    }

    // MARK: - CTA-rad

    @ViewBuilder
    private var actionRow: some View {
        HStack(spacing: 8) {
            Button {
                onStartRoute()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "point.topleft.down.to.point.bottomright.curvepath")
                    Text(isActive && appState.dayRoute != nil ? "Vis rute" : "Start rute")
                }
                .font(.caption.bold())
                .padding(.horizontal, 10).padding(.vertical, 6)
                .frame(maxWidth: .infinity)
                .background(Color.white, in: Capsule())
                .foregroundStyle(Color(red: 0.36, green: 0.18, blue: 0.62))
            }
            .buttonStyle(.plain)
            // Disable «Start rute» på inaktive kort så vi ikke planlegger
            // rute for et prosjekt brukeren bare swipet forbi.
            .disabled(!isActive)
            .opacity(isActive ? 1 : 0.55)

            if isActive, let nextLead = nextWorkloadLead {
                Button {
                    // Map workload-lead → LeadModel hvis vi har den i appState.leads.
                    if let model = appState.leads.first(where: { $0.id == nextLead.id }) {
                        onOpenNext(model)
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.right.circle.fill")
                        Text("Neste lead")
                    }
                    .font(.caption.bold())
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .frame(maxWidth: .infinity)
                    .background(Color.white.opacity(0.18), in: Capsule())
                    .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Computed helpers

    private var positioning: String {
        if isActive, let p = appState.activeProjectSummary?.brandKit?.positioningSummary {
            return p
        }
        return project.description ?? "Felt-arbeid i dag"
    }

    /// Antall leads vi enda må kontakte i dag (workload − kontaktet).
    /// Bare meningsfullt for det aktive prosjektet (det er det som har
    /// workload-data); for andre kort viser vi `leadCount` fra
    /// `ProjectListItem` direkte i statusLine, så denne brukes kun når
    /// `isActive`.
    private var leadsRemainingToday: Int {
        guard isActive else { return project.leadCount }
        let pending = appState.workloadLeads.filter { wl in
            // Behandle som "ikke kontaktet" hvis siste kontakt var > 24h siden
            // eller mangler helt.
            guard let s = wl.lastContactedAt,
                  let date = ISO8601DateFormatter().date(from: s) else { return true }
            return Date().timeIntervalSince(date) > 60 * 60 * 24
        }
        return max(pending.count, (appState.dayRoute?.stops.count ?? 0))
    }

    private var nextRouteStop: DayRouteStop? {
        appState.dayRoute?.stops.first
    }

    private var nextWorkloadLead: WorkloadLead? {
        // Foretrekk Claude-rangert; fall back til nærmeste.
        appState.workloadLeads.first {
            ($0.claudeRecommendationRank ?? 9999) <= 5
        } ?? appState.workloadLeads.first
    }

    @MainActor
    private func loadMomentum() async {
        guard let api = appState.api else { return }
        do {
            self.momentum = try await api.fetchMomentumToday()
        } catch {
            // Stille — momentum kan være null hvis bruker ikke har Leadgrid.
        }
    }
}

// MARK: - Empty-state

/// Vises når brukeren ikke har noen prosjekter. Peker mot Prosjekter-
/// listen i Mer-fanen.
private struct ProjectCardEmptyState: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "folder.badge.plus")
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(Color.white.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Ingen prosjekter ennå")
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                    Text("Lag et prosjekt for å koble leads til en bedrift")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.75))
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }
            Text("Du finner Prosjekter under Mer-fanen.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.85))
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.36, green: 0.18, blue: 0.62).opacity(0.92),
                    Color(red: 0.18, green: 0.08, blue: 0.38).opacity(0.96)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.35), radius: 8, x: 0, y: 4)
    }
}

// MARK: - «Alle prosjekter»-bottom-sheet

/// Liste over alle prosjekter. Brukes til å hoppe direkte til et
/// prosjekt uten å swipe gjennom alle. Sortert etter aktivitet
/// (leadCount desc) — prosjekter med flest leads øverst.
private struct AllProjectsSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    var onSelect: (ProjectListItem) -> Void

    var body: some View {
        NavigationStack {
            List {
                ForEach(sortedProjects) { project in
                    Button {
                        onSelect(project)
                    } label: {
                        HStack(spacing: 12) {
                            Text(project.name.prefix(2).uppercased())
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                                .frame(width: 36, height: 36)
                                .background(
                                    Color(red: 0.36, green: 0.18, blue: 0.62),
                                    in: RoundedRectangle(cornerRadius: 8)
                                )
                            VStack(alignment: .leading, spacing: 2) {
                                Text(project.name)
                                    .font(.subheadline.bold())
                                if let desc = project.description, !desc.isEmpty {
                                    Text(desc)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                                HStack(spacing: 10) {
                                    Label("\(project.leadCount)", systemImage: "person.3.fill")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                    Label("\(project.competitorCount)", systemImage: "diamond")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if project.id == appState.activeProjectId {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(Color(red: 0.36, green: 0.18, blue: 0.62))
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .navigationTitle("Alle prosjekter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
    }

    /// Sortering: aktivt prosjekt øverst, deretter mest aktive (leadCount
    /// desc), så alfabetisk. Vi mangler `lastActiveAt` i `ProjectListItem`,
    /// så leadCount er beste proxy for aktivitet på iPad i dag.
    private var sortedProjects: [ProjectListItem] {
        appState.projects.sorted { a, b in
            if a.id == appState.activeProjectId { return true }
            if b.id == appState.activeProjectId { return false }
            if a.leadCount != b.leadCount { return a.leadCount > b.leadCount }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }
}
