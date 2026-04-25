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

    private let columns: [GridItem] = [
        GridItem(.adaptive(minimum: 140, maximum: 220), spacing: 12),
    ]

    var body: some View {
        VStack(spacing: 0) {
            summaryBar
            Divider()
            content
        }
        .navigationTitle(model.projectTitle ?? "Live Set")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.refresh() }
        .refreshable { await model.refresh() }
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
