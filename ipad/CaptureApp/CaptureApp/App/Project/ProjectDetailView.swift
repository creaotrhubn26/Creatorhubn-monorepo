import SwiftUI

/// Native project hub — the center of the loop. Shows where the project stands
/// (status stepper you can advance), the timeline (milestones), the worklog
/// (time entries + add hours), economics, and linked galleries. e2e against
/// `/api/photographer/projects/:id` (+ /milestones, /time, PATCH status).
@MainActor
@Observable
final class ProjectHubModel {
    let projectId: String

    private(set) var detail: ProjectDetail?
    private(set) var timeEntries: [ProjectTimeEntry] = []
    private(set) var galleries: [ProjectGalleryRef] = []
    private(set) var milestones: [ProjectMilestone] = []
    private(set) var loading = true
    private(set) var errorMessage: String?
    var working = false

    init(projectId: String) { self.projectId = projectId }

    func load() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription; loading = false; return
        }
        loading = detail == nil
        errorMessage = nil
        async let detailTask = client.projectDetail(id: projectId)
        async let milestonesTask = client.projectMilestones(id: projectId)
        do {
            let d = try await detailTask
            detail = d.project
            timeEntries = d.timeEntries
            galleries = d.galleries
        } catch {
            if detail == nil {
                errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
            }
        }
        milestones = (try? await milestonesTask) ?? milestones
        loading = false
    }

    func setStatus(_ status: ProjectStatus) async {
        guard let client = DashboardClient.make() else { return }
        working = true; defer { working = false }
        do { try await client.updateProjectStatus(id: projectId, status: status.rawValue); await load() }
        catch { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription }
    }

    func logTime(task: String, hours: Double, rate: Double?) async {
        guard let client = DashboardClient.make() else { return }
        working = true; defer { working = false }
        do {
            try await client.logProjectTime(projectId: projectId, taskDescription: task, hoursSpent: hours, billableHours: hours, rate: rate)
            await load()
        } catch { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription }
    }
}

struct ProjectDetailView: View {
    @State private var model: ProjectHubModel
    private let fallbackTitle: String?
    @State private var showLogTime = false
    private let projectId: String
    @State private var deliverables: ProjectDeliverables

    /// Template inferred from the project type — drives flags, deliverables,
    /// suggested phases and worklog phases.
    private var template: ProjectTemplate { ProjectTemplate.match(model.detail?.projectType) }

    init(projectId: String, title: String? = nil) {
        self.projectId = projectId
        _model = State(initialValue: ProjectHubModel(projectId: projectId))
        self.fallbackTitle = title
        // Seeded once; the template refines once detail loads but the default
        // deliverables cover the common case.
        _deliverables = State(initialValue: ProjectDeliverables(projectId: projectId, template: .generic))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if model.loading && model.detail == nil {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if let message = model.errorMessage, model.detail == nil {
                    ContentUnavailableView("Kunne ikke laste prosjektet", systemImage: "folder.badge.questionmark", description: Text(message))
                } else {
                    header
                    templateCard
                    statusStepper
                    economics
                    timelineSection
                    worklogSection
                    deliverablesSection
                    if !model.galleries.isEmpty { galleriesSection }
                }
            }
            .padding()
        }
        .frame(maxWidth: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(model.detail?.title ?? fallbackTitle ?? "Prosjekt")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await model.load()
            // Re-seed the deliverables checklist from the real type's template.
            deliverables = ProjectDeliverables(projectId: projectId, template: template)
        }
        .refreshable { await model.load() }
        .sheet(isPresented: $showLogTime) {
            LogTimeSheet(phases: template.worklogPhases) { task, hours, rate in
                Task { await model.logTime(task: task, hours: hours, rate: rate) }
            }
        }
    }

    // MARK: - Template (type + complexity flags)

    private var templateCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Label(template.displayName, systemImage: "square.grid.2x2")
                        .font(.headline).foregroundStyle(CHTheme.textPrimary)
                    Spacer()
                }
                if !template.flags.isEmpty {
                    FlowChips(flags: template.flags)
                }
            }
        }
    }

    // MARK: - Deliverables

    private var deliverablesSection: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Leveranser").font(.headline).foregroundStyle(CHTheme.textPrimary)
                    Spacer()
                    Text("\(deliverables.doneCount)/\(deliverables.items.count)")
                        .font(.caption.monospacedDigit()).foregroundStyle(CHTheme.textMuted)
                }
                ForEach(deliverables.items) { item in
                    Button { deliverables.toggle(item) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: item.done ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(item.done ? CHTheme.success : CHTheme.textMuted)
                            Text(item.id)
                                .font(.subheadline)
                                .foregroundStyle(item.done ? CHTheme.textMuted : CHTheme.textPrimary)
                                .strikethrough(item.done, color: CHTheme.textMuted)
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let client = model.detail?.clientName {
                Label(client, systemImage: "person.crop.circle").foregroundStyle(CHTheme.textSecondary)
            }
            HStack(spacing: 14) {
                if let type = model.detail?.projectType, !type.isEmpty {
                    Text(type).font(.caption).foregroundStyle(CHTheme.textMuted)
                }
                if let loc = model.detail?.location, !loc.isEmpty {
                    Label(loc, systemImage: "mappin.and.ellipse").font(.caption).foregroundStyle(CHTheme.textMuted)
                }
                if let date = model.detail?.eventDate {
                    Label(DashboardDate.shortDate(date), systemImage: "calendar").font(.caption).foregroundStyle(CHTheme.textMuted)
                }
            }
        }
    }

    // MARK: - Status stepper

    private var statusStepper: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Status").font(.headline).foregroundStyle(CHTheme.textPrimary)
                let current = ProjectStatus.from(model.detail?.status)
                HStack(spacing: 6) {
                    ForEach(Array(ProjectStatus.allCases.enumerated()), id: \.element) { idx, s in
                        let reached = current.map { ProjectStatus.allCases.firstIndex(of: $0)! >= idx } ?? false
                        VStack(spacing: 4) {
                            Circle()
                                .fill(reached ? CHTheme.accent : CHTheme.surfaceElevated)
                                .frame(width: 12, height: 12)
                                .overlay(Circle().stroke(CHTheme.border, lineWidth: 1))
                            Text(s.label).font(.caption2)
                                .foregroundStyle(reached ? CHTheme.accent : CHTheme.textMuted)
                                .lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                // Advance to next status
                if let current, let next = nextStatus(after: current) {
                    Button {
                        Task { await model.setStatus(next) }
                    } label: {
                        Label("Flytt til «\(next.label)»", systemImage: "arrow.right.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.working)
                }
            }
        }
    }

    private func nextStatus(after s: ProjectStatus) -> ProjectStatus? {
        let all = ProjectStatus.allCases
        guard let i = all.firstIndex(of: s), i + 1 < all.count else { return nil }
        return all[i + 1]
    }

    // MARK: - Economics

    private var economics: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Økonomi").font(.headline).foregroundStyle(CHTheme.textPrimary)
                HStack {
                    metric("Pris", kr(model.detail?.servicePriceGross))
                    Divider().frame(height: 32).overlay(CHTheme.border)
                    metric("Timer", String(format: "%.1f", model.detail?.trackedHours ?? 0))
                    Divider().frame(height: 32).overlay(CHTheme.border)
                    metric("Margin", model.detail?.marginPct.map { String(format: "%.0f%%", $0) } ?? "—")
                }
            }
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.subheadline.bold().monospacedDigit()).foregroundStyle(CHTheme.textPrimary)
            Text(label).font(.caption2).foregroundStyle(CHTheme.textMuted)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Timeline

    @ViewBuilder
    private var timelineSection: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Timeline").font(.headline).foregroundStyle(CHTheme.textPrimary)
                if model.milestones.isEmpty {
                    // No backend milestones yet → show the type's suggested phases.
                    Text("Anbefalte faser for \(template.displayName.lowercased())")
                        .font(.caption).foregroundStyle(CHTheme.textMuted)
                    ForEach(Array(template.phases.enumerated()), id: \.offset) { idx, phase in
                        HStack(alignment: .top, spacing: 10) {
                            Text("\(idx + 1)").font(.caption2.weight(.bold)).foregroundStyle(CHTheme.accent)
                                .frame(width: 18, height: 18).background(CHTheme.accent.opacity(0.15), in: Circle())
                            Text(phase).font(.subheadline).foregroundStyle(CHTheme.textSecondary)
                            Spacer()
                        }
                    }
                } else {
                    ForEach(model.milestones) { m in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: (m.status ?? "").lowercased().contains("complet") || (m.status ?? "").lowercased().contains("done") ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle((m.status ?? "").lowercased().contains("complet") ? CHTheme.success : CHTheme.textMuted)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(m.title ?? "Milepæl").font(.subheadline).foregroundStyle(CHTheme.textPrimary)
                                if let due = m.dueDate {
                                    Text(DashboardDate.shortDate(due)).font(.caption2).foregroundStyle(CHTheme.textMuted)
                                }
                            }
                            Spacer()
                            if m.progress > 0 && m.progress < 100 {
                                Text("\(Int(m.progress))%").font(.caption2).foregroundStyle(CHTheme.accentSoft)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Worklog

    private var worklogSection: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Worklog").font(.headline).foregroundStyle(CHTheme.textPrimary)
                    Spacer()
                    Button { showLogTime = true } label: { Label("Logg timer", systemImage: "plus") }
                        .font(.caption).buttonStyle(.bordered)
                }
                if model.timeEntries.isEmpty {
                    Text("Ingen timer logget ennå.").font(.caption).foregroundStyle(CHTheme.textMuted)
                } else {
                    ForEach(model.timeEntries) { t in
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(t.taskDescription ?? "Arbeid").font(.subheadline).foregroundStyle(CHTheme.textPrimary)
                                if let d = t.dateWorked { Text(DashboardDate.relative(d)).font(.caption2).foregroundStyle(CHTheme.textMuted) }
                            }
                            Spacer()
                            Text(String(format: "%.1f t", t.billableHours))
                                .font(.subheadline.monospacedDigit()).foregroundStyle(CHTheme.accentSoft)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Galleries

    private var galleriesSection: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Gallerier").font(.headline).foregroundStyle(CHTheme.textPrimary)
                ForEach(model.galleries) { g in
                    HStack {
                        Image(systemName: "photo.on.rectangle").foregroundStyle(CHTheme.accent)
                        Text(g.title ?? "Galleri").foregroundStyle(CHTheme.textSecondary)
                        Spacer()
                        StatusPill(status: g.status)
                    }
                }
            }
        }
    }

    private func kr(_ v: Double?) -> String {
        guard let v else { return "—" }
        return "kr \(Int(v.rounded()))"
    }
}

private struct LogTimeSheet: View {
    var phases: [String] = []
    let onSave: (String, Double, Double?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var task = ""
    @State private var hours = ""
    @State private var rate = ""

    private var canSave: Bool {
        !task.trimmingCharacters(in: .whitespaces).isEmpty && (Double(hours.replacingOccurrences(of: ",", with: ".")) ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                if !phases.isEmpty {
                    Section("Fase") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(phases, id: \.self) { p in
                                    Button { task = p } label: {
                                        Text(p).font(.caption.weight(.semibold))
                                            .padding(.horizontal, 12).padding(.vertical, 7)
                                            .background(task == p ? CHTheme.accent.opacity(0.2) : CHTheme.surfaceElevated, in: Capsule())
                                            .foregroundStyle(task == p ? CHTheme.accent : CHTheme.textSecondary)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .listRowBackground(CHTheme.surface)
                    }
                }
                Section("Oppgave") {
                    TextField("Hva jobbet du med?", text: $task).listRowBackground(CHTheme.surface)
                }
                Section("Timer") {
                    TextField("f.eks. 2.5", text: $hours).keyboardType(.decimalPad).listRowBackground(CHTheme.surface)
                }
                Section("Timepris (valgfritt)") {
                    TextField("kr/time", text: $rate).keyboardType(.numberPad).listRowBackground(CHTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Logg timer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lagre") {
                        let h = Double(hours.replacingOccurrences(of: ",", with: ".")) ?? 0
                        let r = Double(rate.replacingOccurrences(of: ",", with: "."))
                        onSave(task, h, r)
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
        }
        .chBranded()
    }
}

/// Wrapping chips for the project's complexity flags.
private struct FlowChips: View {
    let flags: [ProjectComplexityFlag]

    var body: some View {
        // Simple wrapping layout: two rows of chips via a flexible grid.
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(flags, id: \.self) { flag in
                Label(flag.label, systemImage: flag.icon)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(CHTheme.accent.opacity(0.12), in: Capsule())
                    .foregroundStyle(CHTheme.accentSoft)
            }
        }
    }
}
