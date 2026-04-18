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
/// `isCompleted` flips show as a strikethrough + tick. The completion
/// state is local-only for now; pushing back to `shot_lists.shots[]`
/// is the next iteration (task #74 follow-up).
struct ShotListPanel: View {
    @Bindable var model: LiveCaptureModel
    @Environment(\.dismiss) private var dismiss

    @State private var locallyCompleted: Set<String> = []

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
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
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
        ContentUnavailableView(
            "No planned shots",
            systemImage: "checklist",
            description: Text("\(projectTitle) doesn't have a shot list yet. Add one from the CreatorHub project planner."),
        )
    }

    private func shotList(for detail: BackendProjectDetail) -> some View {
        let sorted = detail.shotList.sorted { lhs, rhs in
            // Sort: must-have (critical) first, then high, then medium/low,
            // tie-break by original order via the indices we encode in id.
            priorityRank(lhs.priority) < priorityRank(rhs.priority)
        }
        return List {
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

    private func isCompleted(_ shot: BackendShotListItem) -> Bool {
        if locallyCompleted.contains(shot.id) { return true }
        return shot.isCompleted ?? false
    }

    private func toggleCompletion(_ shot: BackendShotListItem) {
        if locallyCompleted.contains(shot.id) {
            locallyCompleted.remove(shot.id)
        } else {
            locallyCompleted.insert(shot.id)
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
