import SwiftUI

/// Single square tile in the Live Set dashboard grid. Two visual
/// states: **captured** (preview thumbnail + rating stars) or
/// **missing** (description placeholder with priority ring).
///
/// Kept intentionally small-and-dumb — all tile state comes from
/// ``CoverageTile`` so the parent grid can diff cheaply when the
/// model refreshes.
struct ShotCoverageTile: View {
    let tile: CoverageTile

    var body: some View {
        ZStack {
            content
            priorityRing
        }
        .aspectRatio(1, contentMode: .fit)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(backgroundFill),
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch tile.state {
        case .captured(let previewUrl, let rating, let isFlagged, let isRejected):
            capturedContent(
                previewUrl: previewUrl,
                rating: rating,
                isFlagged: isFlagged,
                isRejected: isRejected,
            )
        case .missing(let isCompleted):
            missingContent(isCompleted: isCompleted)
        }
    }

    @ViewBuilder
    private func capturedContent(
        previewUrl: String?,
        rating: Int,
        isFlagged: Bool,
        isRejected: Bool,
    ) -> some View {
        ZStack(alignment: .bottom) {
            thumbnail(previewUrl: previewUrl)
                .overlay(
                    // Rejected shots get a diagonal strike so they're
                    // visually demoted without pulling them out of the
                    // plan — the photographer still sees "yes that slot
                    // is filled", just with a ghost treatment.
                    rejectedOverlay(isRejected: isRejected),
                )
            // Bottom gradient makes the rating + scene label readable
            // on any thumbnail brightness.
            LinearGradient(
                colors: [.black.opacity(0.0), .black.opacity(0.7)],
                startPoint: .center, endPoint: .bottom,
            )
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .center, spacing: 4) {
                    ratingStars(rating: rating)
                    Spacer(minLength: 0)
                    if isFlagged {
                        Image(systemName: "flag.fill")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }
                }
                Text(tile.scene)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
        }
    }

    @ViewBuilder
    private func missingContent(isCompleted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: isCompleted
                      ? "checkmark.circle.fill"
                      : priorityIcon)
                    .font(.caption)
                    .foregroundStyle(isCompleted ? .green : priorityIconColor)
                Text(tile.scene)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                Spacer(minLength: 0)
            }
            if let description = tile.description, !description.isEmpty {
                Text(description)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            Spacer(minLength: 0)
            if isCompleted {
                Text("Markert ferdig")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private func thumbnail(previewUrl: String?) -> some View {
        if let previewUrl, let url = URL(string: previewUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    Image(systemName: "photo.badge.exclamationmark")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                @unknown default:
                    EmptyView()
                }
            }
        } else {
            Image(systemName: "photo")
                .font(.title2)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private func rejectedOverlay(isRejected: Bool) -> some View {
        if isRejected {
            Rectangle()
                .fill(.black.opacity(0.35))
                .overlay(
                    Image(systemName: "xmark")
                        .font(.system(size: 44, weight: .bold))
                        .foregroundStyle(.white.opacity(0.6)),
                )
        }
    }

    // MARK: - Priority ring (critical highlight)

    /// Red ring around critical shots that haven't been captured yet —
    /// the photographer's at-a-glance "don't leave the set until these
    /// are done" signal.
    @ViewBuilder
    private var priorityRing: some View {
        if case .missing(let isCompleted) = tile.state,
           !isCompleted,
           tile.priority == .critical {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(.red, lineWidth: 2.5)
        } else if case .missing(let isCompleted) = tile.state,
                  !isCompleted,
                  tile.priority == .mustHave || tile.priority == .high {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(.orange.opacity(0.7), lineWidth: 1.5)
        }
    }

    // MARK: - Rating stars

    @ViewBuilder
    private func ratingStars(rating: Int) -> some View {
        if rating > 0 {
            HStack(spacing: 1) {
                ForEach(0..<min(rating, 5), id: \.self) { _ in
                    Image(systemName: "star.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(.yellow)
                }
            }
        }
    }

    // MARK: - Visual helpers

    private var priorityIcon: String {
        switch tile.priority {
        case .critical:            return "exclamationmark.triangle.fill"
        case .mustHave, .high:     return "exclamationmark.circle.fill"
        case .medium, .low:        return "circle"
        case .unknown:             return "circle"
        }
    }

    private var priorityIconColor: Color {
        switch tile.priority {
        case .critical:            return .red
        case .mustHave, .high:     return .orange
        case .medium:              return .blue
        case .low, .unknown:       return .secondary
        }
    }

    private var backgroundFill: Color {
        switch tile.state {
        case .captured: return .black
        case .missing:  return Color(uiColor: .secondarySystemBackground)
        }
    }

    private var accessibilityLabel: String {
        switch tile.state {
        case .captured(_, let rating, _, _):
            return "\(tile.scene), skutt, \(rating) stjerner"
        case .missing(let isCompleted):
            let priorityWord: String = {
                switch tile.priority {
                case .critical: return "kritisk"
                case .mustHave, .high: return "må-ha"
                default: return ""
                }
            }()
            return "\(tile.scene), " +
                (isCompleted ? "markert ferdig" : "mangler\(priorityWord.isEmpty ? "" : ", \(priorityWord)")")
        }
    }
}
