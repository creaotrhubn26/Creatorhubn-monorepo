import SwiftUI

@MainActor
@Observable
final class TimesheetsModel {
    private(set) var projects: [BackendProjectSummary] = []
    private(set) var period: LocalTimesheetPeriod?
    private(set) var entries: [LocalTimesheetEntry] = []
    private(set) var activeTimer: ActiveTimesheetTimer?
    private(set) var loading = true
    private(set) var working = false
    private(set) var offline = false
    private(set) var errorMessage: String?
    private(set) var notice: String?
    var selectedProjectId = ""
    var activity = "Opptak"
    var note = ""

    private var store: TimesheetStore?
    private var ownerUserId: String?

    init(initialProjectId: String = "") {
        selectedProjectId = initialProjectId
    }

    var canEdit: Bool { period.map { ["draft", "rejected"].contains($0.status) } ?? false }
    var hasUnsyncedEntries: Bool { entries.contains { $0.syncState != .synced } }

    func load() async {
        guard let session = SignInService.shared.session else {
            errorMessage = "Logg inn for å registrere timer."
            loading = false
            return
        }
        ownerUserId = session.userId
        do {
            let database = try AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL())
            let nextStore = TimesheetStore(database: database, ownerUserId: session.userId)
            store = nextStore
            await loadCached()

            let backend = BackendClient(baseURL: session.backendBaseURL, authHeaders: SignInService.shared.authHeaders)
            let response = try await backend.listProjects(limit: 200)
            projects = response.projects
            offline = false
            if selectedProjectId.isEmpty {
                selectedProjectId = activeTimer?.projectId ?? period?.projectId ?? projects.first?.id ?? ""
            }
            if !selectedProjectId.isEmpty { await selectProject(selectedProjectId) }
        } catch {
            offline = Self.isOffline(error)
            if projects.isEmpty, let store {
                let cached = (try? await store.periods()) ?? []
                var seenProjectIds = Set<String>()
                projects = cached.compactMap { period in
                    guard seenProjectIds.insert(period.projectId).inserted else { return nil }
                    return Self.project(from: period)
                }
                if selectedProjectId.isEmpty { selectedProjectId = activeTimer?.projectId ?? cached.first?.projectId ?? "" }
            }
            if period == nil { errorMessage = Self.message(error) }
        }
        loading = false
    }

    func selectProject(_ projectId: String) async {
        selectedProjectId = projectId
        errorMessage = nil
        notice = nil
        guard let project = projects.first(where: { $0.id == projectId }), let store else { return }
        working = true
        defer { working = false }
        do {
            guard let client = DashboardClient.make() else { throw DashboardError.signedOut }
            let list = try await client.timesheets(projectId: projectId)
            let range = Self.currentWeek()
            let current: CaptureTimesheetPeriod
            if let existing = list.periods.first(where: { $0.periodStart <= range.today && $0.periodEnd >= range.today }) {
                current = existing
            } else {
                current = try await client.ensureCurrentTimesheet(
                    projectId: projectId,
                    periodStart: range.start,
                    periodEnd: range.end
                ).period
            }
            try await store.cache(period: current, project: project)
            let detail = try await client.timesheet(projectId: projectId, periodId: current.id)
            try await store.cache(project: project, detail: detail)
            period = try await store.periods().first { $0.id == current.id }
            entries = try await store.entries(periodId: current.id)
            activeTimer = try await store.activeTimer()
            offline = false
        } catch {
            offline = Self.isOffline(error)
            let today = Self.currentWeek().today
            let cached = (try? await store.periods())?.first {
                $0.projectId == projectId && $0.periodStart <= today && $0.periodEnd >= today
            }
            period = cached
            if let cached {
                entries = (try? await store.entries(periodId: cached.id)) ?? []
            } else {
                entries = []
            }
            activeTimer = try? await store.activeTimer()
            if cached == nil {
                errorMessage = offline
                    ? "Koble til nettet én gang for å opprette denne ukens timeliste. Ingen timer er startet."
                    : Self.message(error)
            }
        }
    }

    func startTimer() async {
        guard let period, let store else { return }
        do {
            try await store.startTimer(period: period, activity: activity, note: note)
            activeTimer = try await store.activeTimer()
            notice = "Timeren er lagret på iPaden."
            errorMessage = nil
        } catch { errorMessage = Self.message(error) }
    }

    func stopTimer() async {
        guard let store else { return }
        working = true
        defer { working = false }
        do {
            let stoppedEntry = try await store.stopTimer()
            activeTimer = nil
            selectedProjectId = stoppedEntry.projectId
            if let stoppedPeriod = try await store.periods().first(where: { $0.id == stoppedEntry.periodId }) {
                period = stoppedPeriod
                entries = try await store.entries(periodId: stoppedPeriod.id)
            }
            notice = offline ? "Tiden er lagret på iPaden og synkes når nettet er tilbake." : "Tiden er lagret og sendes til CreatorHub."
            await CaptureSyncCoordinator.shared.flushNow()
            if !offline { await selectProject(stoppedEntry.projectId) }
        } catch { errorMessage = Self.message(error) }
    }

    func discardTimer() async {
        do {
            try await store?.discardActiveTimer()
            activeTimer = nil
            notice = "Timeren ble forkastet."
        } catch { errorMessage = Self.message(error) }
    }

    func addManual(date: Date, activity: String, note: String, minutes: Int, breakMinutes: Int, billable: Bool) async {
        guard let period, let store else { return }
        do {
            _ = try await store.addManual(
                period: period, workDate: Self.day(date), activity: activity,
                note: note, durationMinutes: minutes, breakMinutes: breakMinutes,
                billable: billable
            )
            entries = try await store.entries(periodId: period.id)
            notice = offline ? "Registreringen ligger trygt på iPaden." : "Registreringen sendes til CreatorHub."
            await CaptureSyncCoordinator.shared.flushNow()
            if !offline { await selectProject(selectedProjectId) }
        } catch { errorMessage = Self.message(error) }
    }

    func submit() async {
        guard let period, !hasUnsyncedEntries else {
            errorMessage = "Vent til alle registreringer er synket før du sender inn timelisten."
            return
        }
        working = true
        defer { working = false }
        do {
            guard let client = DashboardClient.make() else { throw DashboardError.signedOut }
            try await client.submitTimesheet(projectId: period.projectId, periodId: period.id, note: nil)
            notice = "Timelisten er sendt til godkjenning."
            await selectProject(period.projectId)
        } catch { errorMessage = Self.message(error) }
    }

    private func loadCached() async {
        guard let store else { return }
        let cached = (try? await store.periods()) ?? []
        activeTimer = try? await store.activeTimer()
        let today = Self.currentWeek().today
        period = activeTimer.flatMap { timer in cached.first { $0.id == timer.periodId } }
            ?? cached.first { $0.periodStart <= today && $0.periodEnd >= today }
        if let period { entries = (try? await store.entries(periodId: period.id)) ?? [] }
    }

    private static func project(from period: LocalTimesheetPeriod) -> BackendProjectSummary {
        BackendProjectSummary(
            id: period.projectId, title: period.projectTitle, clientName: nil,
            eventDate: nil, location: nil, projectType: nil, status: "active",
            shotListSummary: nil, updatedAt: nil
        )
    }

    private static func currentWeek(now: Date = Date()) -> (start: String, end: String, today: String) {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = .current
        let interval = calendar.dateInterval(of: .weekOfYear, for: now)
        let start = interval?.start ?? calendar.startOfDay(for: now)
        let end = calendar.date(byAdding: .day, value: 6, to: start) ?? start
        return (day(start), day(end), day(now))
    }

    private static func day(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func message(_ error: Error) -> String {
        if let backendError = error as? BackendError {
            switch backendError {
            case .unauthorized: return "Økten er utløpt. Logg inn på nytt."
            case .notFound: return "Prosjektet eller timelisten finnes ikke."
            case let .httpStatus(code, _) where (500...599).contains(code):
                return "CreatorHub er midlertidig utilgjengelig (HTTP \(code)). Lokale timer beholdes."
            case let .httpStatus(code, _): return "CreatorHub avviste forespørselen (HTTP \(code))."
            case .decode: return "CreatorHub svarte i et format appen ikke kunne lese."
            case .transport: return "Nettverket er utilgjengelig."
            case .notConfigured: return "CreatorHub-tilkoblingen er ikke konfigurert."
            }
        }
        return (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }

    private static func isOffline(_ error: Error) -> Bool {
        if let backendError = error as? BackendError, case .transport = backendError { return true }
        guard let dashboardError = error as? DashboardError else { return false }
        if case .transport = dashboardError { return true }
        return false
    }
}

struct TimesheetsView: View {
    @State private var model: TimesheetsModel
    @State private var showManual = false
    @State private var confirmDiscard = false
    private let activities = ["Opptak", "Rigging", "Reise", "Assistentarbeid", "Import og backup", "Redigering", "Annet"]

    init(initialProjectId: String = "") {
        _model = State(initialValue: TimesheetsModel(initialProjectId: initialProjectId))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if model.offline { statusBanner("Offline – registreringer lagres trygt på iPaden.", color: CHTheme.warning, icon: "wifi.slash") }
                    if let error = model.errorMessage { statusBanner(error, color: CHTheme.danger, icon: "exclamationmark.triangle") }
                    if let notice = model.notice { statusBanner(notice, color: CHTheme.success, icon: "checkmark.circle") }

                    projectPicker
                    if let timer = model.activeTimer {
                        activeTimerCard(timer)
                    } else if let period = model.period {
                        startCard(period)
                    }
                    summary
                    entriesCard
                }
                .padding()
            }
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Timer")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await model.load() } } label: { Image(systemName: "arrow.clockwise") }
                        .accessibilityLabel("Oppdater timer")
                }
            }
            .task { await model.load() }
            .sheet(isPresented: $showManual) {
                ManualTimeEntrySheet { date, activity, note, minutes, breakMinutes, billable in
                    Task { await model.addManual(date: date, activity: activity, note: note, minutes: minutes, breakMinutes: breakMinutes, billable: billable) }
                }
            }
            .confirmationDialog("Forkast den aktive timeren?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Forkast timer", role: .destructive) { Task { await model.discardTimer() } }
                Button("Avbryt", role: .cancel) {}
            }
        }
        .chBranded()
    }

    private var projectPicker: some View {
        TimesheetCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Prosjekt").font(.caption.weight(.semibold)).foregroundStyle(CHTheme.textMuted)
                if model.projects.isEmpty {
                    Text(model.loading ? "Laster tildelte prosjekter…" : "Ingen tildelte prosjekter")
                        .foregroundStyle(CHTheme.textSecondary)
                } else {
                    Picker("Prosjekt", selection: $model.selectedProjectId) {
                        ForEach(model.projects) { project in Text(project.title).tag(project.id) }
                    }
                    .pickerStyle(.menu)
                    .onChange(of: model.selectedProjectId) { _, value in Task { await model.selectProject(value) } }
                }
            }
        }
    }

    private func startCard(_ period: LocalTimesheetPeriod) -> some View {
        TimesheetCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Klar til å arbeide").font(.headline).foregroundStyle(CHTheme.textPrimary)
                        Text("\(period.periodStart) – \(period.periodEnd)").font(.caption).foregroundStyle(CHTheme.textMuted)
                    }
                    Spacer()
                    TimesheetStatusPill(status: period.status)
                }
                Picker("Aktivitet", selection: $model.activity) {
                    ForEach(activities, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
                TextField("Notat (valgfritt)", text: $model.note, axis: .vertical)
                    .textFieldStyle(.plain).padding(12).background(CHTheme.input, in: RoundedRectangle(cornerRadius: 10))
                HStack {
                    Button { Task { await model.startTimer() } } label: {
                        Label("Start arbeid", systemImage: "play.fill").frame(maxWidth: .infinity).frame(minHeight: 48)
                    }
                    .buttonStyle(.borderedProminent).disabled(!model.canEdit || model.working)
                    Button { showManual = true } label: { Label("Legg inn", systemImage: "plus").frame(minHeight: 48) }
                        .buttonStyle(.bordered).disabled(!model.canEdit || model.working)
                }
            }
        }
    }

    private func activeTimerCard(_ timer: ActiveTimesheetTimer) -> some View {
        TimesheetCard(accented: true) {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let seconds = max(0, Int(context.date.timeIntervalSince(timer.startedAt)))
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Label("Arbeid pågår", systemImage: "record.circle.fill").font(.headline).foregroundStyle(CHTheme.accent)
                        Spacer()
                        Text(Self.clock(seconds)).font(.title.monospacedDigit().bold()).foregroundStyle(CHTheme.textPrimary)
                    }
                    Text(timer.projectTitle).foregroundStyle(CHTheme.textPrimary)
                    Text(timer.activity + (timer.note.map { " · \($0)" } ?? "")).font(.subheadline).foregroundStyle(CHTheme.textSecondary)
                    HStack {
                        Button { Task { await model.stopTimer() } } label: {
                            Label("Stopp og lagre", systemImage: "stop.fill").frame(maxWidth: .infinity).frame(minHeight: 48)
                        }.buttonStyle(.borderedProminent).disabled(model.working)
                        Button(role: .destructive) { confirmDiscard = true } label: { Image(systemName: "trash").frame(width: 48, height: 48) }
                            .buttonStyle(.bordered)
                    }
                }
            }
        }
    }

    @ViewBuilder private var summary: some View {
        if let period = model.period {
            HStack(spacing: 10) {
                metric("Denne uken", Self.hours(period.totalMinutes + model.entries.filter { $0.serverId == nil }.reduce(0) { $0 + $1.netMinutes }), "clock")
                metric("Fakturerbart", Self.hours(period.billableMinutes + model.entries.filter { $0.serverId == nil && $0.billable }.reduce(0) { $0 + $1.netMinutes }), "banknote")
                metric("Registreringer", "\(max(period.entryCount, model.entries.count))", "list.bullet")
            }
        }
    }

    private func metric(_ title: String, _ value: String, _ icon: String) -> some View {
        TimesheetCard {
            VStack(alignment: .leading, spacing: 5) {
                Image(systemName: icon).foregroundStyle(CHTheme.accent)
                Text(value).font(.title3.bold().monospacedDigit()).foregroundStyle(CHTheme.textPrimary)
                Text(title).font(.caption2).foregroundStyle(CHTheme.textMuted)
            }.frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var entriesCard: some View {
        TimesheetCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Registreringer").font(.headline).foregroundStyle(CHTheme.textPrimary)
                    Spacer()
                    if model.hasUnsyncedEntries { Label("Venter på synk", systemImage: "arrow.triangle.2.circlepath").font(.caption).foregroundStyle(CHTheme.warning) }
                }
                if model.entries.isEmpty {
                    Text("Ingen timer registrert denne uken.").foregroundStyle(CHTheme.textMuted)
                } else {
                    ForEach(model.entries) { entry in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: syncIcon(entry.syncState)).foregroundStyle(syncColor(entry.syncState)).frame(width: 20)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(entry.activity).foregroundStyle(CHTheme.textPrimary)
                                Text(entry.workDate + (entry.note.map { " · \($0)" } ?? "")).font(.caption).foregroundStyle(CHTheme.textMuted).lineLimit(2)
                            }
                            Spacer()
                            Text(Self.hours(entry.netMinutes)).font(.subheadline.bold().monospacedDigit()).foregroundStyle(CHTheme.textSecondary)
                        }
                        if entry.id != model.entries.last?.id { Divider().overlay(CHTheme.borderSoft) }
                    }
                }
                if let period = model.period, ["draft", "rejected"].contains(period.status) {
                    Button { Task { await model.submit() } } label: {
                        Label("Send uke til godkjenning", systemImage: "paperplane.fill").frame(maxWidth: .infinity).frame(minHeight: 48)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.entries.isEmpty || model.hasUnsyncedEntries || model.activeTimer != nil || model.working)
                }
                if let note = model.period?.reviewerNote, !note.isEmpty {
                    Label(note, systemImage: "bubble.left.fill").font(.caption).foregroundStyle(CHTheme.warning)
                }
            }
        }
    }

    private func statusBanner(_ text: String, color: Color, icon: String) -> some View {
        Label(text, systemImage: icon).font(.subheadline).foregroundStyle(color)
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }

    private func syncIcon(_ state: TimesheetSyncState) -> String {
        switch state {
        case .synced:
            return "checkmark.icloud.fill"
        case .pending:
            return "arrow.triangle.2.circlepath"
        case .failed:
            return "exclamationmark.icloud.fill"
        }
    }
    private func syncColor(_ state: TimesheetSyncState) -> Color {
        switch state {
        case .synced:
            return CHTheme.success
        case .pending:
            return CHTheme.warning
        case .failed:
            return CHTheme.danger
        }
    }
    private static func hours(_ minutes: Int) -> String { String(format: "%.1f t", Double(minutes) / 60) }
    private static func clock(_ seconds: Int) -> String { String(format: "%02d:%02d:%02d", seconds / 3600, (seconds % 3600) / 60, seconds % 60) }
}

private struct TimesheetCard<Content: View>: View {
    var accented = false
    @ViewBuilder let content: Content
    var body: some View {
        content.padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(CHTheme.surfaceSolid, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(accented ? CHTheme.accentBorder : CHTheme.border, lineWidth: 1))
    }
}

private struct TimesheetStatusPill: View {
    let status: String
    var body: some View {
        Text(label).font(.caption2.weight(.bold)).padding(.horizontal, 9).padding(.vertical, 5)
            .foregroundStyle(color).background(color.opacity(0.14), in: Capsule())
    }
    private var label: String {
        switch status {
        case "draft":
            return "Utkast"
        case "submitted":
            return "Sendt inn"
        case "approved":
            return "Godkjent"
        case "rejected":
            return "Sendt tilbake"
        case "locked":
            return "Låst"
        default:
            return status
        }
    }
    private var color: Color {
        switch status {
        case "approved", "locked":
            return CHTheme.success
        case "rejected":
            return CHTheme.danger
        case "submitted":
            return CHTheme.info
        default:
            return CHTheme.warning
        }
    }
}

private struct ManualTimeEntrySheet: View {
    let onSave: (Date, String, String, Int, Int, Bool) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date()
    @State private var activity = "Opptak"
    @State private var note = ""
    @State private var hours = "1"
    @State private var breakMinutes = "0"
    @State private var billable = true
    private let activities = ["Opptak", "Rigging", "Reise", "Assistentarbeid", "Import og backup", "Redigering", "Annet"]

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Dato", selection: $date, displayedComponents: .date)
                Picker("Aktivitet", selection: $activity) { ForEach(activities, id: \.self) { Text($0).tag($0) } }
                TextField("Timer", text: $hours).keyboardType(.decimalPad)
                TextField("Pause i minutter", text: $breakMinutes).keyboardType(.numberPad)
                TextField("Notat", text: $note, axis: .vertical)
                Toggle("Fakturerbar tid", isOn: $billable)
            }
            .scrollContentBackground(.hidden).background(CHTheme.bg)
            .navigationTitle("Legg inn timer")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        onSave(date, activity, note, totalMinutes, Int(breakMinutes) ?? 0, billable)
                        dismiss()
                    }.disabled(totalMinutes <= 0 || (Int(breakMinutes) ?? 0) >= totalMinutes)
                }
            }
        }.chBranded()
    }

    private var totalMinutes: Int {
        let normalized = hours.replacingOccurrences(of: ",", with: ".")
        return Int(((Double(normalized) ?? 0) * 60).rounded())
    }
}
