import SwiftUI

/// Phase 2B Lag D + #74: surface the active project's shot list inside
/// the iPad capture flow so the photographer always knows what's left
/// to shoot. Driven by `LiveCaptureModel.selectedProjectDetail.shotList`
/// — populated automatically when a project is picked via
/// `ProjectSelectionView`.
///
/// Visual hierarchy mirrors how Daniel uses it on set:
/// 1. Critical / must-have shots first (red dot).
/// 2. Then high-priority.
/// 3. Then everything else, ordered as the planner intended.
///
/// `isCompleted` flips show as a strikethrough + tick. Taps are pushed
/// to the backend via `LiveCaptureModel.setShotCompletion` so other
/// surfaces (dashboard progress, second iPad) see the same picture.
/// We keep an optimistic override map keyed by shot id so the UI flips
/// instantly; a failed PATCH rolls the override back.
struct ShotListPanel: View {
    @Bindable var model: LiveCaptureModel
    @Environment(\.dismiss) private var dismiss

    /// Local optimistic override — takes precedence over the server's
    /// `isCompleted` until a refresh. Dict (not Set) because taps can
    /// flip either way, including un-ticking a shot the server already
    /// considers completed.
    @State private var localOverrides: [String: Bool] = [:]

    /// Auto-huk-toggelen: lokal busy/feil-tilstand. Selve på/av-verdien
    /// bor på modellen (`shotListAutoCheckEnabled`) så den deles med
    /// Vision-huke-logikken og web-toggelen via backend.
    @State private var autoCheckBusy = false
    @State private var autoCheckError: String?

    /// #9 Presenterer «shot-list fra brief»-arket (FM-generert).
    @State private var showBriefGenerator = false

    var body: some View {
        NavigationStack {
            Group {
                if let project = model.selectedProject {
                    if let detail = model.selectedProjectDetail {
                        if detail.shotList.isEmpty {
                            emptyShotList(projectTitle: project.title)
                        } else {
                            shotList(for: detail)
                        }
                    } else {
                        ProgressView("Loading shot list…")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                } else {
                    noProjectSelected
                }
            }
            .navigationTitle(model.selectedProject?.title ?? "Shot list")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if model.selectedProject != nil {
                        Button {
                            showBriefGenerator = true
                        } label: {
                            Label("Fra brief", systemImage: "sparkles")
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            // When the model pulls a fresh detail (after a toggle, or on
            // first load), drop any override the server now agrees with.
            // Overrides whose shot isn't in the incoming list, or whose
            // value still disagrees (e.g. a PATCH still in flight for a
            // concurrent tap) are left intact so the optimistic flip
            // stays visible.
            .onChange(of: model.selectedProjectDetail?.shotList) { _, newList in
                guard let newList else { return }
                for shot in newList {
                    if let override = localOverrides[shot.id],
                       override == (shot.isCompleted ?? false) {
                        localOverrides.removeValue(forKey: shot.id)
                    }
                }
            }
        }
    }

    private var noProjectSelected: some View {
        ContentUnavailableView(
            "No project selected",
            systemImage: "folder.badge.questionmark",
            description: Text("Pick a project from the top bar to see its planned shots here."),
        )
    }

    private func emptyShotList(projectTitle: String) -> some View {
        VStack(spacing: 20) {
            ContentUnavailableView(
                "Ingen planlagte shots",
                systemImage: "checklist",
                description: Text("\(projectTitle) har ingen shot-list ennå. Generer én fra klient-briefen, eller legg til i CreatorHub-planleggeren."),
            )
            Button {
                showBriefGenerator = true
            } label: {
                Label("Generer fra brief", systemImage: "sparkles")
                    .font(.body.weight(.semibold))
                    .padding(.horizontal, 18).padding(.vertical, 11)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
        }
        .sheet(isPresented: $showBriefGenerator) {
            let hasShots = !(model.selectedProjectDetail?.shotList.isEmpty ?? true)
            ShotListFromBriefView(
                onSave: { scenes in try await model.saveShotListFromBrief(scenes, append: hasShots) },
                fetchTimeline: { await model.fetchWeddingTimelineBrief() },
                saveLabel: hasShots ? "Legg til i shot-listen" : "Lagre til prosjektet")
        }
    }

    private func shotList(for detail: BackendProjectDetail) -> some View {
        let sorted = detail.shotList.sorted { lhs, rhs in
            // Sort: must-have (critical) first, then high, then medium/low,
            // tie-break by original order via the indices we encode in id.
            priorityRank(lhs.priority) < priorityRank(rhs.priority)
        }
        return List {
            autoCheckSection
            if let summary = detail.shotListSummary {
                Section {
                    ProgressView(value: Double(summary.completedShots),
                                 total: max(Double(summary.totalShots), 1)) {
                        HStack {
                            Text("Progress").font(.caption.weight(.semibold))
                            Spacer()
                            Text("\(summary.completedShots) of \(summary.totalShots)")
                                .font(.caption.monospaced())
                        }
                    }
                    .tint(.green)
                    if summary.mustHaveShots > 0 {
                        Text("\(summary.completedMustHave) of \(summary.mustHaveShots) must-have shots done")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Section("Shots") {
                ForEach(sorted) { shot in
                    ShotRow(
                        shot: shot,
                        isCompleted: isCompleted(shot),
                        toggle: {
                            toggleCompletion(shot)
                        }
                    )
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    /// Team-styring av auto-huk. Vises øverst i lista. Bindingen skriver
    /// optimistisk til modellen, kaller backend, og ruller tilbake ved feil
    /// (403 → «kun eier kan endre»). Alle på settet ser samme flagg.
    private var autoCheckSection: some View {
        Section {
            Toggle(isOn: Binding(
                get: { model.shotListAutoCheckEnabled },
                set: { setAutoCheck($0) }
            )) {
                VStack(alignment: .leading, spacing: 3) {
                    Label("Auto-huk shots", systemImage: "checklist.checked")
                        .font(.subheadline.weight(.semibold))
                    Text(autoCheckError ?? (model.shotListAutoCheckEnabled
                         ? "Vision huker av shots automatisk når du tar bildet. Gjelder hele teamet."
                         : "Av — hak av manuelt. Slå på for å la Vision gjøre det for teamet."))
                        .font(.caption2)
                        .foregroundStyle(autoCheckError == nil ? Color.secondary : Color.red)
                }
            }
            .tint(.green)
            .disabled(autoCheckBusy)
        }
    }

    private func setAutoCheck(_ enabled: Bool) {
        let previous = model.shotListAutoCheckEnabled
        model.shotListAutoCheckEnabled = enabled   // optimistisk
        autoCheckError = nil
        autoCheckBusy = true
        Task {
            do {
                try await model.setShotListAutoCheck(enabled)
            } catch {
                await MainActor.run {
                    model.shotListAutoCheckEnabled = previous
                    autoCheckError = (error as? ShotAutoCheckError) == .notOwner
                        ? "Kun prosjekteier kan endre dette."
                        : "Kunne ikke lagre — prøv igjen."
                }
            }
            await MainActor.run { autoCheckBusy = false }
        }
    }

    private func isCompleted(_ shot: BackendShotListItem) -> Bool {
        if let override = localOverrides[shot.id] { return override }
        return shot.isCompleted ?? false
    }

    private func toggleCompletion(_ shot: BackendShotListItem) {
        let previous = isCompleted(shot)
        let next = !previous
        localOverrides[shot.id] = next
        Task {
            do {
                try await model.setShotCompletion(shotId: shot.id, isCompleted: next)
            } catch {
                // Server rejected the toggle — roll the optimistic flip
                // back so the UI reflects the authoritative state.
                await MainActor.run {
                    localOverrides[shot.id] = previous
                }
            }
        }
    }

    private func priorityRank(_ priority: String?) -> Int {
        switch priority?.lowercased() {
        case "critical": return 0
        case "high":     return 1
        case "medium":   return 2
        case "low":      return 3
        default:         return 4
        }
    }
}

private struct ShotRow: View {
    let shot: BackendShotListItem
    let isCompleted: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isCompleted ? .green : priorityColor)
                VStack(alignment: .leading, spacing: 4) {
                    Text(shot.scene)
                        .font(.body.weight(.semibold))
                        .strikethrough(isCompleted, color: .secondary)
                        .foregroundStyle(isCompleted ? .secondary : .primary)
                    if let description = shot.description, !description.isEmpty {
                        Text(description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    HStack(spacing: 10) {
                        if isCompleted, let by = shot.completedBy, !by.isEmpty {
                            Label("Ferdig · \(by)", systemImage: "checkmark.seal.fill")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.green)
                        }
                        if let priority = shot.priority, !priority.isEmpty {
                            tag(priority.capitalized, color: priorityColor)
                        }
                        if let type = shot.shotType, !type.isEmpty {
                            tag(type, color: .accentColor)
                        }
                        if let location = shot.locationName, !location.isEmpty {
                            Label(location, systemImage: "mappin.and.ellipse")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if let duration = shot.estimatedDuration {
                            Label("\(duration) min", systemImage: "clock")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func tag(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(color)
            .background(color.opacity(0.15), in: Capsule())
    }

    private var priorityColor: Color {
        switch shot.priority?.lowercased() {
        case "critical": return .red
        case "high":     return .orange
        case "medium":   return .yellow
        case "low":      return .gray
        default:         return .secondary
        }
    }
}
