import SwiftUI

/// Live Set dashboard — the photographer's at-a-glance view of
/// coverage for the currently-selected project. Each planned shot
/// renders as a tile: captured thumbnail when a photo has been linked,
/// priority-coloured placeholder when the shot still needs shooting.
///
/// Slice 1 scope (this view): static grid + pull-to-refresh. No
/// realtime push, no coverage-check AI, no collage mode yet. See
/// ``LiveSetDashboardModel`` for the joining logic.
struct LiveSetDashboardView: View {
    /// Model is created by the caller so the view can be reused with
    /// different projects/sessions (e.g. one-off "look at yesterday's
    /// coverage" flow) without rebuilding the surface.
    @State var model: LiveSetDashboardModel

    @State private var isCollagePresented: Bool = false

    private let columns: [GridItem] = [
        GridItem(.adaptive(minimum: 140, maximum: 220), spacing: 12)
    ]

    var body: some View {
        VStack(spacing: 0) {
            summaryBar
            if model.coverageCheck != nil || model.coverageCheckState == .running {
                coverageBanner
            }
            Divider()
            content
        }
        .navigationTitle(model.projectTitle ?? "Live Set")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .secondaryAction) {
                Button {
                    isCollagePresented = true
                } label: {
                    Label("Collage", systemImage: "photo.stack")
                }
                .disabled(capturedTiles.isEmpty)
            }
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await model.runCoverageCheck() }
                } label: {
                    if model.coverageCheckState == .running {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("AI-sjekk", systemImage: "sparkles")
                    }
                }
                .disabled(model.tiles.isEmpty || model.coverageCheckState == .running)
            }
        }
        .task {
            // Initial fetch + start the 15-s polling loop. Auto-refresh
            // catches changes a teammate made on a second iPad until
            // backend grows shot-event push (Slice 3.5).
            await model.refresh()
            model.startAutoRefresh()
        }
        .onDisappear { model.stopAutoRefresh() }
        .refreshable { await model.refresh() }
        .sheet(isPresented: $isCollagePresented) {
            NavigationStack {
                LiveSetCollageView(tiles: capturedTiles)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Lukk") { isCollagePresented = false }
                        }
                    }
            }
            .presentationDetents([.large])
        }
    }

    /// Subset of tiles the collage actually has thumbnails for.
    /// Captured-state-only — missing-state tiles have no preview to
    /// show, so excluding them keeps the grid dense + meaningful.
    private var capturedTiles: [CoverageTile] {
        model.tiles.filter { tile in
            if case .captured = tile.state { return true }
            return false
        }
    }

    // MARK: - Summary bar

    @ViewBuilder
    private var summaryBar: some View {
        let summary = model.summary
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(summary.doneCount) av \(summary.total)")
                    .font(.title3.bold())
                    .monospacedDigit()
                Text("skutt")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            // Progress bar — visual representation of done/total.
            ProgressView(
                value: Double(summary.doneCount),
                total: max(Double(summary.total), 1),
            )
            .tint(summary.criticalMissing > 0 ? .red : .green)
            .frame(maxWidth: .infinity)
            // Priority-missing counts. Tapping a chip could later open
            // a filtered list; for Slice 1 it's display-only.
            if summary.criticalMissing > 0 {
                missingChip(count: summary.criticalMissing, label: "kritisk", color: .red)
            }
            if summary.mustHaveMissing > 0 {
                missingChip(count: summary.mustHaveMissing, label: "må-ha", color: .orange)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    // MARK: - AI coverage banner

    @ViewBuilder
    private var coverageBanner: some View {
        if case .failed(let message) = model.coverageCheckState {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(Color.orange.opacity(0.08))
        } else if model.coverageCheckState == .running {
            HStack(spacing: 10) {
                ProgressView().controlSize(.small)
                Text("Claude analyserer dekning…")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
        } else if let result = model.coverageCheck {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: bannerIcon(for: result.status))
                    .foregroundStyle(bannerColor(for: result.status))
                    .font(.body)
                VStack(alignment: .leading, spacing: 4) {
                    Text(bannerHeadline(for: result))
                        .font(.subheadline.weight(.semibold))
                    if !result.summary.isEmpty {
                        Text(result.summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let top = result.topMissing {
                        HStack(spacing: 6) {
                            severityChip(top.severity)
                            Text(top.type)
                                .font(.caption.weight(.semibold))
                            Text("—").font(.caption).foregroundStyle(.secondary)
                            Text(top.reason)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(bannerColor(for: result.status).opacity(0.08))
        }
    }

    private func bannerIcon(for status: CoverageStatus) -> String {
        switch status {
        case .complete: return "checkmark.seal.fill"
        case .gaps:     return "exclamationmark.circle.fill"
        case .critical: return "exclamationmark.triangle.fill"
        }
    }

    private func bannerColor(for status: CoverageStatus) -> Color {
        switch status {
        case .complete: return .green
        case .gaps:     return .orange
        case .critical: return .red
        }
    }

    private func bannerHeadline(for result: CoverageCheckResult) -> String {
        switch result.status {
        case .complete: return "Dekningen er komplett"
        case .gaps:
            let n = result.missingCoverage.count
            return n == 1 ? "1 manglende shot" : "\(n) manglende shots"
        case .critical:
            let n = result.missingCoverage.count
            return n == 1 ? "Kritisk: 1 missende shot" : "Kritisk: \(n) missende shots"
        }
    }

    @ViewBuilder
    private func severityChip(_ severity: CoverageSeverity) -> some View {
        let (label, color): (String, Color) = {
            switch severity {
            case .critical:    return ("kritisk", .red)
            case .recommended: return ("anbefalt", .orange)
            case .niceToHave:  return ("nice-to-have", .secondary)
            }
        }()
        Text(label)
            .font(.caption2.weight(.bold))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Capsule().fill(color.opacity(0.15)))
    }

    @ViewBuilder
    private func missingChip(count: Int, label: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Text("\(count)")
                .font(.footnote.weight(.bold))
                .monospacedDigit()
            Text(label)
                .font(.caption)
        }
        .foregroundStyle(color)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(color.opacity(0.12)),
        )
    }

    // MARK: - Content states

    @ViewBuilder
    private var content: some View {
        switch model.loadState {
        case .idle, .loading where model.tiles.isEmpty:
            loadingState
        case .error(let message) where model.tiles.isEmpty:
            errorState(message: message)
        case .loaded where model.tiles.isEmpty:
            emptyState
        default:
            grid
        }
    }

    @ViewBuilder
    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Laster dekningsoversikt…")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func errorState(message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.largeTitle)
                .foregroundStyle(.orange)
            Text("Kunne ikke laste dekningen")
                .font(.body.weight(.semibold))
            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Prøv igjen") {
                Task { await model.refresh() }
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var emptyState: some View {
        ContentUnavailableView(
            "Ingen planlagte shots",
            systemImage: "checklist",
            description: Text(
                "Dette prosjektet har ingen shot-liste enda. " +
                "Legg til shots i prosjekt-planleggeren på web, " +
                "så dukker de opp her automatisk.",
            ),
        )
    }

    @ViewBuilder
    private var grid: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(model.tiles) { tile in
                    ShotCoverageTile(tile: tile)
                }
            }
            .padding(16)
        }
    }
}
