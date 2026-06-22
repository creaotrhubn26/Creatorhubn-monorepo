import SwiftUI

// MARK: - List

@MainActor
@Observable
final class EditingJobsModel {
    /// When set, only jobs for this project are shown.
    let projectId: String?
    private(set) var jobs: [EditingJob] = []
    private(set) var loading = true
    var errorMessage: String?

    init(projectId: String?) { self.projectId = projectId }

    func load() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription; loading = false; return
        }
        loading = jobs.isEmpty
        errorMessage = nil
        do {
            var all = try await client.listEditingJobs()
            if let projectId { all = all.filter { $0.projectId == projectId } }
            jobs = all
        } catch {
            if jobs.isEmpty { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription }
        }
        loading = false
    }

    var open: [EditingJob] { jobs.filter(\.isOpen) }
    var closed: [EditingJob] { jobs.filter { !$0.isOpen } }
    var needsAction: Int { jobs.filter(\.canApprove).count }
}

struct EditingJobsView: View {
    @State private var model: EditingJobsModel

    init(projectId: String? = nil) {
        _model = State(initialValue: EditingJobsModel(projectId: projectId))
    }

    var body: some View {
        Group {
            if model.loading && model.jobs.isEmpty {
                ProgressView("Laster oppdrag…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let message = model.errorMessage, model.jobs.isEmpty {
                ContentUnavailableView("Kunne ikke laste", systemImage: "tray", description: Text(message))
            } else if model.jobs.isEmpty {
                ContentUnavailableView("Ingen oppdrag ennå", systemImage: "paperplane",
                                       description: Text("Send et prosjekt til en ekstern redigerer for å starte."))
            } else {
                List {
                    if !model.open.isEmpty {
                        Section("Aktive") {
                            ForEach(model.open) { jobRow($0) }
                        }
                    }
                    if !model.closed.isEmpty {
                        Section("Fullført") {
                            ForEach(model.closed) { jobRow($0) }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle("Redigeringsoppdrag")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
    }

    private func jobRow(_ job: EditingJob) -> some View {
        NavigationLink {
            EditingJobDetailView(jobId: job.id) { Task { await model.load() } }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(job.projectTitle ?? "Oppdrag").font(.headline).foregroundStyle(CHTheme.textPrimary).lineLimit(1)
                    Spacer()
                    StatusChip(status: job.status)
                }
                HStack(spacing: 10) {
                    if let v = job.vendorName { Label(v, systemImage: "person.crop.square").font(.caption).foregroundStyle(CHTheme.textSecondary) }
                    if job.amountKr > 0 { Text("\(job.amountKr) kr").font(.caption).foregroundStyle(CHTheme.accentSoft) }
                    if job.canApprove {
                        Label("Trenger handling", systemImage: "exclamationmark.circle.fill")
                            .font(.caption2).foregroundStyle(CHTheme.warning)
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .listRowBackground(CHTheme.surface)
    }
}

struct StatusChip: View {
    let status: String
    var body: some View {
        Text(JobStatusUI.label(status))
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(JobStatusUI.color(status).opacity(0.18), in: Capsule())
            .foregroundStyle(JobStatusUI.color(status))
    }
}

// MARK: - Detail

@MainActor
@Observable
final class EditingJobDetailModel {
    let jobId: String
    private(set) var detail: EditingJobDetail?
    private(set) var messages: [JobMessage] = []
    private(set) var canMessage = false
    private(set) var loading = true
    var busy = false
    var errorMessage: String?

    init(jobId: String) { self.jobId = jobId }

    var job: EditingJob? { detail?.job }
    var sourceFiles: [EditingJobFileRef] { (detail?.files ?? []).filter(\.isSource) }
    var deliveryFiles: [EditingJobFileRef] { (detail?.files ?? []).filter { !$0.isSource } }

    func load() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription; loading = false; return
        }
        loading = detail == nil
        do {
            detail = try await client.editingJobDetail(id: jobId)
            let m = try await client.jobMessages(id: jobId)
            messages = m.messages; canMessage = m.canMessage
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
        loading = false
    }

    func approve() async { await run { try await $0.approveJob(id: self.jobId) } }
    func requestRevision(note: String) async { await run { try await $0.requestRevision(id: self.jobId, note: note.isEmpty ? nil : note) } }
    func cancel() async { await run { try await $0.cancelJob(id: self.jobId) } }

    /// Returns a Stripe checkout URL when the chosen method needs the browser.
    func pay(method: String) async -> URL? {
        guard let client = DashboardClient.make() else { return nil }
        busy = true; defer { busy = false }
        do {
            let result = try await client.payJob(id: jobId, method: method)
            await load()
            if let u = result.checkoutUrl { return URL(string: u) }
        } catch { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription }
        return nil
    }

    func send(message: String) async {
        guard let client = DashboardClient.make() else { return }
        do { _ = try await client.sendJobMessage(id: jobId, body: message); await reloadMessages(client) }
        catch { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription }
    }

    private func reloadMessages(_ client: DashboardClient) async {
        if let m = try? await client.jobMessages(id: jobId) { messages = m.messages; canMessage = m.canMessage }
    }

    private func run(_ action: @escaping (DashboardClient) async throws -> Void) async {
        guard let client = DashboardClient.make() else { return }
        busy = true; defer { busy = false }
        do { try await action(client); await load() }
        catch { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription }
    }
}

struct EditingJobDetailView: View {
    @State private var model: EditingJobDetailModel
    @State private var draft = ""
    @State private var showRevision = false
    @State private var revisionNote = ""
    @Environment(\.openURL) private var openURL
    let onChange: () -> Void

    init(jobId: String, onChange: @escaping () -> Void = {}) {
        _model = State(initialValue: EditingJobDetailModel(jobId: jobId))
        self.onChange = onChange
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let job = model.job {
                    headerCard(job)
                    pipeline(job)
                    actionsCard(job)
                    filesCard
                    if model.canMessage { messagesCard }
                } else if model.loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                } else if let msg = model.errorMessage {
                    ContentUnavailableView("Kunne ikke laste", systemImage: "tray", description: Text(msg))
                }
            }
            .padding(16)
        }
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle("Oppdrag")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .sheet(isPresented: $showRevision) { revisionSheet }
    }

    private func headerCard(_ job: EditingJob) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(job.projectTitle ?? "Oppdrag").font(.title3.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                StatusChip(status: job.status)
            }
            if let v = job.vendorName { Label(v, systemImage: "person.crop.square").font(.subheadline).foregroundStyle(CHTheme.textSecondary) }
            if !job.requestedServices.isEmpty {
                Text(job.requestedServices.joined(separator: " · ")).font(.caption).foregroundStyle(CHTheme.textMuted)
            }
            HStack(spacing: 14) {
                if job.amountKr > 0 { Text("\(job.amountKr) kr").font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.accentSoft) }
                if let ps = job.paymentStatus, ps == "held" { Label("Betalt (escrow)", systemImage: "lock.shield").font(.caption).foregroundStyle(CHTheme.success) }
                if job.maxRevisions > 0 { Text("Revisjoner \(job.revisionsUsed)/\(job.maxRevisions)").font(.caption).foregroundStyle(CHTheme.textMuted) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private func pipeline(_ job: EditingJob) -> some View {
        let steps = ["Sendt", "Pågår", "Levert", "Godkjent"]
        let current = JobStatusUI.pipelineIndex(job.status)
        return HStack(spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.offset) { idx, label in
                let done = current >= idx && current >= 0
                VStack(spacing: 4) {
                    Circle().fill(done ? CHTheme.accent : CHTheme.border)
                        .frame(width: 12, height: 12)
                    Text(label).font(.caption2).foregroundStyle(done ? CHTheme.textPrimary : CHTheme.textMuted)
                }
                if idx < steps.count - 1 {
                    Rectangle().fill(current > idx && current >= 0 ? CHTheme.accent : CHTheme.border)
                        .frame(height: 2).frame(maxWidth: .infinity)
                        .offset(y: -8)
                }
            }
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder
    private func actionsCard(_ job: EditingJob) -> some View {
        if job.isOpen {
            VStack(spacing: 10) {
                if let msg = model.errorMessage { Text(msg).font(.caption).foregroundStyle(CHTheme.warning) }
                if job.needsPayment {
                    Button { Task { if let url = await model.pay(method: "stripe") { openURL(url) }; onChange() } } label: {
                        Label("Betal med kort", systemImage: "creditcard").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large).tint(CHTheme.accent).disabled(model.busy)
                    Button { Task { _ = await model.pay(method: "invoice"); onChange() } } label: {
                        Label("Be om faktura", systemImage: "doc.text").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered).controlSize(.large).tint(CHTheme.accent).disabled(model.busy)
                }
                if job.canApprove {
                    Button { Task { await model.approve(); onChange() } } label: {
                        Label("Godkjenn leveranse", systemImage: "checkmark.seal").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large).tint(CHTheme.success).disabled(model.busy)
                }
                if job.canRequestRevision {
                    Button { showRevision = true } label: {
                        Label("Be om revisjon", systemImage: "arrow.uturn.backward").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered).controlSize(.large).tint(CHTheme.warning).disabled(model.busy)
                }
                if job.status == "requested" || job.status == "in_progress" {
                    Button(role: .destructive) { Task { await model.cancel(); onChange() } } label: {
                        Label("Avbryt oppdrag", systemImage: "xmark.circle").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered).controlSize(.large).disabled(model.busy)
                }
            }
            .padding(14)
            .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private var filesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            fileGroup("Kildefiler (sendt)", model.sourceFiles, icon: "tray.and.arrow.up")
            fileGroup("Leveranse", model.deliveryFiles, icon: "tray.and.arrow.down")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder
    private func fileGroup(_ title: String, _ files: [EditingJobFileRef], icon: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("\(title) · \(files.count)", systemImage: icon).font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
            if files.isEmpty {
                Text("Ingen ennå.").font(.caption).foregroundStyle(CHTheme.textMuted)
            } else {
                ForEach(files.prefix(8)) { f in
                    HStack {
                        Text(f.fileName ?? "fil").font(.caption).foregroundStyle(CHTheme.textSecondary).lineLimit(1)
                        Spacer()
                        Text(f.transferStatus ?? "").font(.caption2).foregroundStyle(CHTheme.textMuted)
                    }
                }
                if files.count > 8 { Text("+ \(files.count - 8) til").font(.caption2).foregroundStyle(CHTheme.textMuted) }
            }
        }
    }

    private var messagesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Meldinger med redigereren").font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
            if model.messages.isEmpty {
                Text("Ingen meldinger ennå.").font(.caption).foregroundStyle(CHTheme.textMuted)
            } else {
                ForEach(model.messages) { m in
                    HStack {
                        if m.fromPhotographer { Spacer(minLength: 40) }
                        Text(m.body ?? "")
                            .font(.callout)
                            .foregroundStyle(m.fromPhotographer ? .white : CHTheme.textPrimary)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(m.fromPhotographer ? CHTheme.accent : CHTheme.surfaceElevated,
                                        in: RoundedRectangle(cornerRadius: 12))
                        if !m.fromPhotographer { Spacer(minLength: 40) }
                    }
                }
            }
            HStack(spacing: 8) {
                TextField("Skriv en melding…", text: $draft, axis: .vertical).lineLimit(1...4)
                    .textFieldStyle(.roundedBorder)
                Button { let t = draft; draft = ""; Task { await model.send(message: t) } } label: {
                    Image(systemName: "paperplane.fill")
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .tint(CHTheme.accent)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private var revisionSheet: some View {
        NavigationStack {
            Form {
                Section("Hva skal endres?") {
                    TextField("Beskriv revisjonen…", text: $revisionNote, axis: .vertical).lineLimit(3...8)
                        .listRowBackground(CHTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Be om revisjon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Avbryt") { showRevision = false } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Send") {
                        let note = revisionNote; showRevision = false; revisionNote = ""
                        Task { await model.requestRevision(note: note); onChange() }
                    }
                }
            }
        }
        .chBranded()
    }
}
