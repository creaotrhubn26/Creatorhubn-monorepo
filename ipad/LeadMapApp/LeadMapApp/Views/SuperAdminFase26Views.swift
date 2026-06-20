// SuperAdminFase26Views.swift
//
// Fase 26: Cockpit (PR/journalists/webinars/referrals/nurture) +
// Lead-map detalj-sub (places/pitch) + Decks/funding/CS-snapshot +
// Error-detail.

import SwiftUI

// ============================================================
// MARK: - PR / Journalists
// ============================================================

struct SuperAdminPRView: View {
    let api: APIClient

    @State private var journalists: [PRJournalist] = []
    @State private var releases: [PRRelease] = []
    @State private var loading = true
    @State private var tab = 0
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        VStack(spacing: 0) {
            Picker("Tab", selection: $tab) {
                Text("Journalister").tag(0)
                Text("Pressemeldinger").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            List {
                if loading && journalists.isEmpty && releases.isEmpty {
                    Section { HStack { Spacer(); ProgressView(); Spacer() } }
                } else if tab == 0 {
                    if journalists.isEmpty {
                        Section { Text("Ingen journalister").foregroundStyle(.secondary) }
                    } else {
                        Section("Journalister (\(journalists.count))") {
                            ForEach(journalists) { j in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(j.fullName).font(.subheadline.bold())
                                        Spacer()
                                        if let status = j.status { statusChip(status) }
                                    }
                                    if let outlet = j.outlet {
                                        Text(outlet).font(.caption.bold()).foregroundStyle(.purple)
                                    }
                                    if let beat = j.beat {
                                        Text(beat).font(.caption).foregroundStyle(.secondary)
                                    }
                                    HStack(spacing: 12) {
                                        if let email = j.email {
                                            Text(email).font(.caption2.monospaced()).lineLimit(1)
                                        }
                                        if let rate = j.responseRate {
                                            Text(String(format: "%.0f%% respons", rate * 100))
                                                .font(.caption2.bold())
                                                .foregroundStyle(.green)
                                        }
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                } else {
                    if releases.isEmpty {
                        Section { Text("Ingen pressemeldinger").foregroundStyle(.secondary) }
                    } else {
                        Section("Pressemeldinger (\(releases.count))") {
                            ForEach(releases) { r in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(r.title ?? "Untitled").font(.subheadline.bold())
                                        Spacer()
                                        if let status = r.status { statusChip(status) }
                                    }
                                    if let d = r.distributedAt {
                                        Label("Distribuert: \(LeadgridDate.formatNo(d))",
                                               systemImage: "envelope.fill")
                                            .font(.caption2).foregroundStyle(.green)
                                    }
                                    if let c = r.recipientCount, c > 0 {
                                        Text("\(c) mottakere").font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .padding(.vertical, 2)
                                .swipeActions {
                                    if r.status == "ready" {
                                        Button {
                                            Task { await distribute(r) }
                                        } label: {
                                            Label("Distribuer", systemImage: "paperplane.fill")
                                        }
                                        .tint(.green)
                                    }
                                }
                            }
                        }
                    }
                }
                if let errorText {
                    Section { Text(errorText).foregroundStyle(.red).font(.caption) }
                }
            }
        }
        .navigationTitle("PR")
        .task { await load() }
        .refreshable { await load() }
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
    }

    @ViewBuilder
    private func statusChip(_ s: String) -> some View {
        let color: Color = s == "active" || s == "distributed" || s == "ready" ? .green
            : s == "cold" || s == "draft" ? .orange
            : s == "do_not_contact" ? .red : .secondary
        Text(s.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        do {
            async let j: PRJournalistsResponse? = try? await api.fetchPRJournalists()
            async let r: PRReleasesResponse? = try? await api.fetchPRReleases()
            journalists = (await j)?.journalists ?? []
            releases = (await r)?.releases ?? []
            loading = false
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func distribute(_ r: PRRelease) async {
        do {
            try await api.distributePRRelease(id: r.id)
            await flash("Distribuert")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}

// ============================================================
// MARK: - Webinars + Referrals + Nurture
// ============================================================

struct SuperAdminWebinarsView: View {
    let api: APIClient

    @State private var webinars: [CockpitWebinar] = []
    @State private var referrals: [CockpitReferral] = []
    @State private var loading = true
    @State private var nurtureRunning = false
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading && webinars.isEmpty && referrals.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            }

            if !webinars.isEmpty {
                Section("Webinarer (\(webinars.count))") {
                    ForEach(webinars) { w in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(w.title).font(.subheadline.bold())
                                Spacer()
                                if let status = w.status {
                                    Text(status.uppercased()).font(.caption2.bold())
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(statusColor(status).opacity(0.20), in: Capsule())
                                        .foregroundStyle(statusColor(status))
                                }
                            }
                            HStack(spacing: 12) {
                                if let s = w.scheduledAt {
                                    Text(LeadgridDate.formatNo(s)).font(.caption2)
                                        .foregroundStyle(.purple)
                                }
                                if let d = w.durationMinutes {
                                    Text("\(d) min").font(.caption2).foregroundStyle(.secondary)
                                }
                                if let r = w.registrationCount {
                                    Label("\(r)\(w.capacity.map { "/\($0)" } ?? "")",
                                          systemImage: "person.2.fill")
                                        .font(.caption2.bold()).foregroundStyle(.green)
                                }
                            }
                            if let url = w.zoomJoinUrl, let u = URL(string: url) {
                                Link(destination: u) {
                                    Label("Zoom-link", systemImage: "video.fill")
                                        .font(.caption.bold())
                                }
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            if !referrals.isEmpty {
                Section("Referrals (\(referrals.count))") {
                    ForEach(referrals.prefix(20)) { r in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("\(r.referrerName ?? "—") → \(r.referredName ?? "—")")
                                    .font(.subheadline.bold()).lineLimit(1)
                                Spacer()
                                if let status = r.status {
                                    Text(status.uppercased()).font(.caption2.bold())
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(referralColor(status).opacity(0.20), in: Capsule())
                                        .foregroundStyle(referralColor(status))
                                }
                            }
                            HStack(spacing: 12) {
                                if let r = r.rewardOere {
                                    Text("Reward: \(r / 100) kr").font(.caption2.bold())
                                        .foregroundStyle(.purple)
                                }
                                if let c = r.convertedAt {
                                    Text("Konv: \(LeadgridDate.formatNo(c))")
                                        .font(.caption2).foregroundStyle(.green)
                                }
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            Section("Nurture-cron") {
                Text("Kjør pending nurture-steg manuelt (vanligvis automatisk cron).")
                    .font(.caption).foregroundStyle(.secondary)
                Button {
                    Task { await runNurture() }
                } label: {
                    if nurtureRunning { ProgressView() }
                    else { Label("Kjør nurture nå", systemImage: "envelope.arrow.triangle.branch.fill") }
                }
                .disabled(nurtureRunning)
            }
        }
        .navigationTitle("Webinars + nurture")
        .task { await load() }
        .refreshable { await load() }
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
    }

    private func statusColor(_ s: String) -> Color {
        switch s {
        case "live": return .red
        case "scheduled": return .blue
        case "completed": return .green
        default: return .secondary
        }
    }

    private func referralColor(_ s: String) -> Color {
        switch s {
        case "converted": return .green
        case "qualified": return .blue
        case "lost": return .red
        default: return .orange
        }
    }

    private func load() async {
        do {
            async let w: CockpitWebinarsResponse? = try? await api.fetchCockpitWebinars()
            async let r: CockpitReferralsResponse? = try? await api.fetchCockpitReferrals()
            webinars = (await w)?.webinars ?? []
            referrals = (await r)?.referrals ?? []
            loading = false
        } catch {
            await MainActor.run { loading = false }
        }
    }

    private func runNurture() async {
        await MainActor.run { nurtureRunning = true }
        do {
            let r = try await api.runNurtureCron()
            await flash("Sendt \(r.sent ?? 0), feilet \(r.failed ?? 0)")
        } catch {
            await flash("Feilet")
        }
        await MainActor.run { nurtureRunning = false }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}

// ============================================================
// MARK: - Lead-Map detalj-sub: Places-search/import
// ============================================================

struct SuperAdminLeadMapPlacesView: View {
    let api: APIClient

    @State private var query = ""
    @State private var results: [LeadMapPlaceSearchResult] = []
    @State private var selectedIds: Set<String> = []
    @State private var searching = false
    @State private var importing = false
    @State private var snackbar: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("Søk steder (f.eks. 'restaurant oslo')", text: $query)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        Task { await search() }
                    }
                Button {
                    Task { await search() }
                } label: {
                    if searching { ProgressView() } else {
                        Image(systemName: "magnifyingglass.circle.fill")
                            .font(.title2)
                    }
                }
                .disabled(searching || query.isEmpty)
            }
            .padding()

            List {
                if results.isEmpty {
                    Section {
                        Text("Søk for å se Google Places-resultater")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Section("Resultater (\(results.count))") {
                        ForEach(results) { r in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(r.name).font(.subheadline.bold())
                                    if let addr = r.address {
                                        Text(addr).font(.caption).foregroundStyle(.secondary)
                                    }
                                    if let cat = r.category {
                                        Text(cat).font(.caption2)
                                            .padding(.horizontal, 6).padding(.vertical, 1)
                                            .background(Color.purple.opacity(0.20), in: Capsule())
                                    }
                                }
                                Spacer()
                                if selectedIds.contains(r.placeId) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                } else {
                                    Image(systemName: "circle").foregroundStyle(.secondary)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if selectedIds.contains(r.placeId) {
                                    selectedIds.remove(r.placeId)
                                } else {
                                    selectedIds.insert(r.placeId)
                                }
                            }
                        }
                    }
                    if !selectedIds.isEmpty {
                        Section {
                            Button {
                                Task { await importSelected() }
                            } label: {
                                if importing { ProgressView() }
                                else {
                                    Label("Importer \(selectedIds.count) som leads",
                                          systemImage: "square.and.arrow.down.fill")
                                }
                            }
                            .disabled(importing)
                        }
                    }
                }
            }
        }
        .navigationTitle("Places-search")
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
    }

    private func search() async {
        await MainActor.run { searching = true }
        do {
            let r = try await api.searchLeadMapPlaces(query: query)
            await MainActor.run {
                results = r.places
                selectedIds = []
            }
        } catch {
            await flash("Søk feilet")
        }
        await MainActor.run { searching = false }
    }

    private func importSelected() async {
        await MainActor.run { importing = true }
        do {
            let r = try await api.importLeadMapPlaces(placeIds: Array(selectedIds))
            await flash("Importert: \(r.imported) (skipped \(r.skipped))")
            await MainActor.run {
                selectedIds = []
                results = []
                query = ""
            }
        } catch {
            await flash("Import feilet")
        }
        await MainActor.run { importing = false }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}

// ============================================================
// MARK: - Admin Decks + Funding Apps
// ============================================================

struct SuperAdminBusinessDecksView: View {
    let api: APIClient

    @State private var decks: [AdminDeck] = []
    @State private var funding: [FundingApp] = []
    @State private var loading = true
    @State private var snackingId: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading && decks.isEmpty && funding.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            }

            if !decks.isEmpty {
                Section("Business Decks (\(decks.count))") {
                    ForEach(decks) { d in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(d.title ?? "Untitled").font(.subheadline.bold())
                                Spacer()
                                if let status = d.status {
                                    Text(status.uppercased()).font(.caption2.bold())
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(Color.purple.opacity(0.20), in: Capsule())
                                }
                            }
                            HStack(spacing: 12) {
                                if let purpose = d.purpose {
                                    Text(purpose.capitalized).font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                if let s = d.slideCount {
                                    Text("\(s) slides").font(.caption2)
                                }
                                if let u = d.updatedAt {
                                    Text(LeadgridDate.relativeAgo(u)).font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            if !funding.isEmpty {
                Section("Funding Apps (\(funding.count))") {
                    ForEach(funding) { f in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(f.name).font(.subheadline.bold())
                                Spacer()
                                if let status = f.status {
                                    Text(status.uppercased()).font(.caption2.bold())
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(fundingColor(status).opacity(0.20), in: Capsule())
                                        .foregroundStyle(fundingColor(status))
                                }
                            }
                            HStack(spacing: 12) {
                                if let prog = f.fundingProgram {
                                    Text(prog).font(.caption2.bold()).foregroundStyle(.purple)
                                }
                                if let amt = f.amountRequestedNok {
                                    Text("\(Int(amt)) kr").font(.caption2.bold())
                                        .foregroundStyle(.green)
                                }
                            }
                            if let dl = f.deadline {
                                Text("Frist: \(LeadgridDate.formatNo(dl))")
                                    .font(.caption2).foregroundStyle(.orange)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Decks & Funding")
        .task { await load() }
        .refreshable { await load() }
    }

    private func fundingColor(_ s: String) -> Color {
        switch s {
        case "approved": return .green
        case "rejected": return .red
        case "submitted": return .blue
        default: return .orange
        }
    }

    private func load() async {
        async let d: AdminDecksResponse? = try? await api.fetchAdminDecks()
        async let f: FundingAppsResponse? = try? await api.fetchFundingApps()
        decks = (await d)?.decks ?? []
        funding = (await f)?.apps ?? []
        loading = false
    }
}

// ============================================================
// MARK: - CS Snapshot All-knapp
// ============================================================

struct SuperAdminCSSnapshotView: View {
    let api: APIClient

    @State private var running = false
    @State private var lastResult: CSSnapshotAllResult?
    @State private var snackbar: String?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Customer Success Snapshot", systemImage: "camera.viewfinder")
                        .font(.headline)
                    Text("Lag øyeblikksbilde av ALLE kunder NÅ — health-score, MRR, last-interaction. Vanligvis kjøres cron-en daglig.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            Section {
                Button {
                    Task { await run() }
                } label: {
                    if running { ProgressView() }
                    else { Label("Kjør snapshot nå", systemImage: "play.fill") }
                }
                .disabled(running)
            }
            if let r = lastResult {
                Section("Siste run") {
                    HStack {
                        miniStat("Snapshot", r.snapshotted ?? 0, .green)
                        miniStat("Skipped", r.skipped ?? 0, .secondary)
                        miniStat("Feilet", r.failed ?? 0, (r.failed ?? 0) > 0 ? .red : .secondary)
                    }
                    if let ms = r.durationMs {
                        Text("Tid: \(ms / 1000)s").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("CS Snapshot")
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
    }

    @ViewBuilder
    private func miniStat(_ label: String, _ value: Int, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text("\(value)").font(.title3.bold()).foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
    }

    private func run() async {
        await MainActor.run { running = true }
        do {
            let r = try await api.runCSSnapshotAll()
            await MainActor.run {
                lastResult = r
                snackbar = "Snapshot OK: \(r.snapshotted ?? 0) kunder"
            }
        } catch {
            await MainActor.run { snackbar = "Feilet" }
        }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run {
            running = false
            snackbar = nil
        }
    }
}

// ============================================================
// MARK: - Error Detail (full stack-trace + metadata)
// ============================================================

struct SuperAdminErrorDetailView: View {
    let api: APIClient
    let errorId: String

    @State private var error: AdminErrorDetail?
    @State private var loading = true
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let e = error {
                Section {
                    HStack(spacing: 10) {
                        Image(systemName: e.resolvedAt == nil ? "exclamationmark.octagon.fill" : "checkmark.seal.fill")
                            .font(.title)
                            .foregroundStyle(e.resolvedAt == nil ? .red : .green)
                        VStack(alignment: .leading, spacing: 2) {
                            if let level = e.level {
                                Text(level.uppercased()).font(.caption.bold())
                                    .foregroundStyle(levelColor(level))
                            }
                            Text(e.title ?? "—").font(.headline)
                        }
                        Spacer()
                    }
                }
                if let count = e.occurrenceCount, count > 1 {
                    Section("Forekomster") {
                        HStack {
                            Text("Antall").font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text("\(count)").font(.headline.bold())
                                .foregroundStyle(count > 10 ? .red : .orange)
                        }
                        if let first = e.firstSeenAt {
                            kvRow("Først sett", LeadgridDate.formatNo(first))
                        }
                        if let last = e.lastSeenAt {
                            kvRow("Sist sett", LeadgridDate.formatNo(last))
                        }
                    }
                }
                if let msg = e.message {
                    Section("Melding") {
                        Text(msg).font(.callout)
                    }
                }
                if let endpoint = e.endpoint {
                    Section("Endpoint") {
                        Text(endpoint).font(.caption.monospaced())
                        if let s = e.httpStatus {
                            kvRow("HTTP-status", "\(s)")
                        }
                    }
                }
                if e.userId != nil || e.userEmail != nil {
                    Section("Bruker") {
                        if let email = e.userEmail { kvRow("E-post", email) }
                        if let uid = e.userId { kvRow("User ID", String(uid.prefix(10))) }
                        if let ip = e.ipAddress { kvRow("IP", ip) }
                        if let ua = e.userAgent { kvRow("User-Agent", String(ua.prefix(50))) }
                    }
                }
                if let stack = e.stackTrace, !stack.isEmpty {
                    Section("Stack trace") {
                        Text(stack).font(.caption2.monospaced())
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                if let meta = e.metadata, !meta.isEmpty {
                    Section("Metadata") {
                        ForEach(meta.sorted(by: { $0.key < $1.key }), id: \.key) { k, v in
                            HStack {
                                Text(k).font(.caption.bold()).foregroundStyle(.purple)
                                Spacer()
                                Text(v).font(.caption.monospaced()).lineLimit(2)
                            }
                        }
                    }
                }
                if let note = e.resolvedNote {
                    Section("Resolved") {
                        Text(note).font(.callout).foregroundStyle(.green)
                    }
                }
            }
        }
        .navigationTitle("Error-detalj")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func kvRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.callout)
        }
    }

    private func levelColor(_ s: String) -> Color {
        switch s {
        case "critical", "error": return .red
        case "warning": return .orange
        default: return .blue
        }
    }

    private func load() async {
        do {
            let r = try await api.fetchAdminErrorDetail(id: errorId)
            await MainActor.run {
                error = r.error
                loading = false
            }
        } catch {
            await MainActor.run { loading = false }
        }
    }
}
