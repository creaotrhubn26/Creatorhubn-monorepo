import SwiftUI
import GRDB

/// Foundation diagnostics — designed to be the first thing running
/// in simulator so you can *see* that v3 migration ran, outbox is
/// enqueuing mutations, and the iPad-side schema matches what the
/// backend expects.
///
/// Panels:
///   1. Schema — which tables exist, migration version, db file URL.
///   2. Row counts — current count per CreatorHub One-managed table.
///   3. Outbox — live state of the sync queue (pending / syncing /
///      failed) with the ability to enqueue a synthetic mutation to
///      verify the plumbing end-to-end.
///   4. Sync status — last successful pull, last push.
///
/// Gate with a feature flag before shipping to App Store. For now
/// it's an always-visible tab so we can watch each phase land.
struct FoundationDebugView: View {
    @State private var schemaSummary: SchemaSummary = .loading
    @State private var rowCounts: [TableRow] = []
    @State private var outboxRows: [OutboxMutation] = []
    @State private var pendingBanner = 0
    @State private var failedBanner = 0
    @State private var refreshTick = 0
    @State private var lastError: String?
    @State private var workerRunning = false

    @State private var recorderActive: Bool = false
    @State private var recorderFileURL: URL?
    @State private var recorderError: String?
    @State private var isShareSheetPresented: Bool = false

    @AppStorage("liveset.previewProjectId") private var previewProjectId: String = ""
    @AppStorage("liveset.previewSessionId") private var previewSessionId: String = ""
    @State private var isDashboardPresented: Bool = false

    private let database: AppDatabase?
    private let outbox: Outbox?
    private let worker: OutboxWorker?

    init() {
        // Best-effort open of the real on-disk database. If it fails
        // (e.g. running in a preview with no Documents dir) we keep
        // the UI functional but show the error state — that way the
        // tab never crashes the app shell.
        let db: AppDatabase?
        do {
            let url = try AppDatabase.defaultDiskURL()
            db = try AppDatabase.openOnDisk(at: url)
        } catch {
            db = nil
        }
        self.database = db
        let outbox = db.map { Outbox(database: $0) }
        self.outbox = outbox
        // Worker uses a stub sender (random success/failure) so the
        // debug surface can visualise the drain loop end-to-end
        // without a live backend. The real production wiring plugs in
        // a URLSession-backed sender (task #47 / auth bridge).
        self.worker = outbox.map {
            OutboxWorker(
                outbox: $0,
                sender: DebugStubSender(),
                pollInterval: 2,
            )
        }
    }

    var body: some View {
        NavigationStack {
            List {
                schemaSection
                rowCountsSection
                outboxSection
                recorderSection
                liveSetDashboardSection
            }
            .navigationTitle("Foundation")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Task { await reload() }
                    } label: {
                        Label("Oppdater", systemImage: "arrow.clockwise")
                    }
                }
            }
            .task { await reload(); await refreshRecorderState() }
            .sheet(isPresented: $isShareSheetPresented) {
                if let url = recorderFileURL {
                    ActivityShareSheet(items: [url])
                }
            }
            .sheet(isPresented: $isDashboardPresented) {
                if let backend = makeBackendClient(),
                   let sessionUUID = UUID(uuidString: previewSessionId) {
                    NavigationStack {
                        LiveSetDashboardView(
                            model: LiveSetDashboardModel(
                                backend: backend,
                                projectId: previewProjectId,
                                sessionId: sessionUUID,
                            ),
                        )
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button("Lukk") { isDashboardPresented = false }
                            }
                        }
                    }
                } else if let backend = makeBackendClient(),
                          previewSessionId.trimmingCharacters(in: .whitespaces).isEmpty {
                    // No session ID yet — still useful: shot list renders
                    // entirely as missing tiles so the planner can pre-
                    // visualise coverage before the shoot starts.
                    NavigationStack {
                        LiveSetDashboardView(
                            model: LiveSetDashboardModel(
                                backend: backend,
                                projectId: previewProjectId,
                                sessionId: nil,
                            ),
                        )
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button("Lukk") { isDashboardPresented = false }
                            }
                        }
                    }
                }
            }
            .task(id: workerRunning) {
                // While the worker is running, poll the UI every 1s
                // so you can watch pending → syncing → succeeded
                // without tapping refresh.
                guard workerRunning else { return }
                while !Task.isCancelled, workerRunning {
                    try? await Task.sleep(for: .seconds(1))
                    await reload()
                }
            }
        }
    }

    // MARK: - Schema panel

    private var schemaSection: some View {
        Section("Skjema") {
            switch schemaSummary {
            case .loading:
                HStack { ProgressView(); Text("Leser skjema…") }
            case .unavailable:
                Label("Database ikke tilgjengelig", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
            case let .ok(version, tables, dbPath):
                HStack {
                    Label("Migration", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Spacer()
                    Text(version).monospaced()
                }
                ForEach(tables, id: \.self) { name in
                    HStack {
                        Image(systemName: "table")
                            .foregroundStyle(.secondary)
                        Text(name).monospaced()
                    }
                }
                Text(dbPath)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(2)
            }
        }
    }

    // MARK: - Row counts panel

    private var rowCountsSection: some View {
        Section("Radantall") {
            if rowCounts.isEmpty {
                Text("Ingen tabeller talt opp ennå.")
                    .foregroundStyle(.tertiary)
            }
            ForEach(rowCounts) { row in
                HStack {
                    Text(row.table).monospaced()
                    Spacer()
                    Text("\(row.count)")
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Outbox panel

    private var outboxSection: some View {
        Section {
            HStack {
                StatChip(
                    title: "Venter",
                    value: pendingBanner,
                    color: pendingBanner > 0 ? .blue : .secondary,
                )
                StatChip(
                    title: "Feilet",
                    value: failedBanner,
                    color: failedBanner > 0 ? .red : .secondary,
                )
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            if outboxRows.isEmpty {
                Text("Ingen mutasjoner i kø.")
                    .foregroundStyle(.tertiary)
            } else {
                ForEach(outboxRows, id: \.clientMutationId) { m in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("\(m.method.rawValue) \(m.endpoint)").monospaced().font(.footnote)
                            Spacer()
                            StatusDot(status: m.status)
                        }
                        HStack {
                            Text(m.clientMutationId).font(.caption2).foregroundStyle(.tertiary)
                            Spacer()
                            Text("forsøk: \(m.attemptCount)").font(.caption2)
                        }
                        if let error = m.lastError, !error.isEmpty {
                            Text(error)
                                .font(.caption2)
                                .foregroundStyle(.red)
                                .lineLimit(2)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            Button {
                Task { await enqueueSynthetic() }
            } label: {
                Label("Legg i kø testmutasjon", systemImage: "plus.circle")
            }
            .disabled(outbox == nil)

            // Worker controls. Toggling Start kicks off the poll loop;
            // because the stub sender succeeds 80% of the time, you'll
            // see mutations transition pending → syncing → succeeded
            // while you watch, plus occasional failedTransient rows
            // that get retried per the backoff ladder.
            Button {
                Task { await toggleWorker() }
            } label: {
                Label(
                    workerRunning ? "Stopp sync-worker" : "Start sync-worker",
                    systemImage: workerRunning ? "stop.circle" : "play.circle",
                )
            }
            .disabled(worker == nil)

            Button {
                Task { await worker?.drainOnce(); await reload() }
            } label: {
                Label("Drain én gang nå", systemImage: "bolt.horizontal.circle")
            }
            .disabled(worker == nil)

            if let lastError {
                Text(lastError)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        } header: {
            Text("Sync-kø")
        } footer: {
            Text("Sync-worker (task #49) drain'er denne listen. Test-mutasjoner blir liggende som pending til workeren er wiret.")
        }
    }

    // MARK: - Actions

    private func reload() async {
        refreshTick += 1
        guard let database else {
            schemaSummary = .unavailable
            return
        }
        do {
            let (version, tables, dbPath) = try await readSchema(database)
            schemaSummary = .ok(version: version, tables: tables, dbPath: dbPath)
            rowCounts = try await readRowCounts(database)

            if let outbox {
                outboxRows = try await outbox.nextPending(limit: 50)
                pendingBanner = try await outbox.pendingCount()
                failedBanner = try await outbox.failedCount()
            }
            lastError = nil
        } catch {
            lastError = String(describing: error)
        }
    }

    private func enqueueSynthetic() async {
        guard let outbox else { return }
        // ``Encodable`` can't be inferred from a heterogeneous
        // dictionary literal (``[String: Any]`` isn't Encodable),
        // so use a tiny local Codable type instead. Keeps the
        // synthetic probe payload explicit + type-safe.
        struct DebugProbeBody: Encodable {
            let source: String
            let tick: Int
        }
        do {
            _ = try await outbox.enqueue(
                endpoint: "/api/debug/synthetic-probe",
                method: .post,
                body: DebugProbeBody(source: "FoundationDebugView", tick: refreshTick),
                entityTable: "debug",
                entityId: UUID().uuidString,
            )
            await reload()
        } catch {
            lastError = String(describing: error)
        }
    }

    private func toggleWorker() async {
        guard let worker else { return }
        if workerRunning {
            await worker.stop()
        } else {
            await worker.start()
        }
        workerRunning.toggle()
        await reload()
    }

    // MARK: - Queries

    private func readSchema(_ database: AppDatabase) async throws -> (String, [String], String) {
        try await database.dbWriter.read { db in
            let appliedMigrations = try db
                .sqlValues(sql: "SELECT identifier FROM grdb_migrations ORDER BY identifier")
            let tables = try db
                .sqlValues(sql: "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            let version = appliedMigrations.last ?? "(none)"
            let dbPath = (try? AppDatabase.defaultDiskURL().path) ?? "(in-memory)"
            return (version, tables, dbPath)
        }
    }

    private func readRowCounts(_ database: AppDatabase) async throws -> [TableRow] {
        let tables = [
            "session", "asset", "review", "event",
            "project", "shotList", "contract",
            "clientGallery", "cullSuggestion", "outboxMutation",
        ]
        return try await database.dbWriter.read { db in
            try tables.map { name in
                let count = try Int.fetchOne(
                    db,
                    sql: "SELECT COUNT(*) FROM \"\(name)\"",
                ) ?? 0
                return TableRow(table: name, count: count)
            }
        }
    }

    // MARK: - CCAPI session recorder

    /// Records every CCAPI HTTP round-trip to a JSONL file so we can
    /// replay a photographer's session against a future adapter for a
    /// camera brand we don't own. See ``CCAPISessionRecorder`` + the
    /// multi-brand roadmap in docs.
    private var recorderSection: some View {
        Section {
            if recorderActive {
                HStack {
                    Image(systemName: "record.circle.fill")
                        .foregroundStyle(.red)
                    Text("Tar opp")
                        .font(.body.weight(.semibold))
                    Spacer()
                    if let url = recorderFileURL {
                        Text(url.lastPathComponent)
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }
                Button(role: .destructive) {
                    Task { await stopRecording() }
                } label: {
                    Label("Stopp + lagre", systemImage: "stop.circle")
                }
            } else {
                Text("Registrerer alle CCAPI-anrop til en JSONL-fil — del med support-teamet for å avdekke kantcases mot kameraer vi ikke eier.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button {
                    Task { await startRecording() }
                } label: {
                    Label("Start opptak", systemImage: "record.circle")
                }
            }
            if let url = recorderFileURL, !recorderActive {
                Button {
                    isShareSheetPresented = true
                } label: {
                    Label("Del loggfil", systemImage: "square.and.arrow.up")
                }
            }
            if let recorderError {
                Label(recorderError, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        } header: {
            Text("Sesjonsopptak (CCAPI)")
        } footer: {
            Text("Loggen havner i Documents/CreatorHubSessions/. Den inneholder HTTP-metode + URI + JSON-body, men aldri bildedata.")
                .font(.caption)
        }
    }

    private func startRecording() async {
        recorderError = nil
        do {
            let url = try await CCAPISessionRecorder.shared.start(label: "debug")
            recorderFileURL = url
            recorderActive = true
        } catch {
            recorderError = "Kunne ikke starte opptak: \(error.localizedDescription)"
        }
    }

    private func stopRecording() async {
        // Preserve the URL across the stop() call so the share sheet
        // can still reach the finalized file.
        let preserved = await CCAPISessionRecorder.shared.currentFileURL
        _ = await CCAPISessionRecorder.shared.stop()
        recorderFileURL = preserved
        recorderActive = false
    }

    // MARK: - Live Set dashboard preview

    /// Manual entry point for the Slice 1 dashboard until it's wired
    /// into the production capture flow. Lets you paste a project ID
    /// + (optional) session ID and present the dashboard as a sheet,
    /// so the surface can be exercised end-to-end against a real
    /// backend before the LiveCaptureView integration lands.
    private var liveSetDashboardSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 4) {
                Text("Project ID")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                TextField("UUID-en til prosjektet", text: $previewProjectId)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Session ID (valgfritt)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                TextField("UUID — la stå tom for å se kun shot-list", text: $previewSessionId)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            Button {
                isDashboardPresented = true
            } label: {
                Label("Vis dekningsgrid", systemImage: "square.grid.3x3")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(previewProjectId.trimmingCharacters(in: .whitespaces).isEmpty)
        } header: {
            Text("Live Set dashboard (Slice 1 preview)")
        } footer: {
            Text("Henter shot-list fra prosjektet + thumbnails fra sesjonen, joiner dem til en dekningsgrid. Krever at du er logget inn (token kommer fra SignInService).")
                .font(.caption)
        }
    }

    /// Build a transient BackendClient from the persisted SignInService
    /// state. Returns nil if not signed in — the dashboard sheet bails
    /// gracefully in that case.
    private func makeBackendClient() -> BackendClient? {
        guard let session = SignInService.shared.session else { return nil }
        return BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"],
        )
    }

    private func refreshRecorderState() async {
        recorderActive = await CCAPISessionRecorder.shared.isActive
        if let url = await CCAPISessionRecorder.shared.currentFileURL {
            recorderFileURL = url
        }
    }
}

/// UIKit share-sheet bridge for Files-app export. Kept minimal so the
/// debug view doesn't need to pull in Core/Share infrastructure.
private struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

// MARK: - Small view helpers

private struct StatChip: View {
    let title: String
    let value: Int
    let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("\(value)")
                .font(.title2.monospacedDigit())
                .foregroundStyle(color)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 14)
        .background(color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct StatusDot: View {
    let status: OutboxMutation.Status
    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 10, height: 10)
            .overlay(
                Text(status.rawValue)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.leading, 14),
                alignment: .trailing,
            )
    }
    private var color: Color {
        switch status {
        case .pending: return .blue
        case .syncing: return .yellow
        case .succeeded: return .green
        case .failed: return .red
        }
    }
}

// MARK: - Models for the panels

private enum SchemaSummary {
    case loading
    case unavailable
    case ok(version: String, tables: [String], dbPath: String)
}

private struct TableRow: Identifiable {
    var id: String { table }
    let table: String
    let count: Int
}

/// Pulls a single column of String values out of a raw SQL statement.
/// Saves writing a fresh Row-iteration loop at each call site.
private extension Database {
    func sqlValues(sql: String) throws -> [String] {
        try Row.fetchAll(self, sql: sql).compactMap { row in
            row[0] as? String ?? (row[0] as? Int64).map(String.init)
        }
    }
}

/// Stub sender for the Debug view: 80% success, 15% transient, 5%
/// permanent. Makes the drain loop visually observable in simulator
/// without a live backend. Replaced by the URLSession-backed sender
/// once the auth bridge lands (task #47).
private struct DebugStubSender: OutboxSender {
    func send(_ mutation: OutboxMutation) async -> OutboxSendOutcome {
        // 100ms simulated latency so the "syncing" state is visible
        // to the eye rather than flashing past in a single frame.
        try? await Task.sleep(for: .milliseconds(100))
        let roll = Double.random(in: 0..<1)
        if roll < 0.80 { return .succeeded }
        if roll < 0.95 { return .failedTransient("simulert nettverksfeil") }
        return .failedPermanent("simulert 422 validation")
    }
}
