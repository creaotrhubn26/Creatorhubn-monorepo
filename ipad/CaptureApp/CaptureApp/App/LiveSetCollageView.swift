import SwiftUI
import UIKit

/// Pinterest-style review of every captured tile in the current
/// dashboard. Filter chips at the top, asymmetric grid below, and a
/// share toolbar action that renders the visible collage to PDF for
/// AirDrop / Mail / Files / iMessage to the client.
///
/// Slice 3 scope: filters, fullscreen viewer, PDF export. Per-tile
/// editing (re-rate, flag, reject) lands when we have a write-back
/// path beyond the existing /assets/:id review endpoint.
struct LiveSetCollageView: View {
    let tiles: [CoverageTile]

    @State private var filter: Filter = .all
    @State private var viewerTile: CoverageTile?
    @State private var pdfShareURL: URL?
    @State private var isPDFShareSheetPresented: Bool = false
    @State private var isRendering: Bool = false

    enum Filter: String, CaseIterable, Identifiable {
        case all = "Alle"
        case picks = "Picks (★)"
        case top = "≥ 4★"
        case flagged = "Flagget"
        var id: String { rawValue }
    }

    private let columns: [GridItem] = [
        GridItem(.adaptive(minimum: 120, maximum: 200), spacing: 8)
    ]

    var body: some View {
        VStack(spacing: 0) {
            filterBar
            Divider()
            content
        }
        .navigationTitle("Collage")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await renderAndShare() }
                } label: {
                    if isRendering {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("Del som PDF", systemImage: "square.and.arrow.up")
                    }
                }
                .disabled(isRendering || filteredTiles.isEmpty)
            }
        }
        .fullScreenCover(item: $viewerTile) { tile in
            CollageImageViewer(tile: tile) { viewerTile = nil }
        }
        .sheet(isPresented: $isPDFShareSheetPresented) {
            if let url = pdfShareURL {
                CollageActivityShareSheet(items: [url])
            }
        }
    }

    // MARK: - Filter bar

    @ViewBuilder
    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Filter.allCases) { f in
                    let count = tiles(matching: f).count
                    Button {
                        filter = f
                    } label: {
                        HStack(spacing: 6) {
                            Text(f.rawValue)
                                .font(.callout.weight(.medium))
                            Text("\(count)")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule().fill(
                                filter == f
                                    ? Color.accentColor.opacity(0.18)
                                    : Color(uiColor: .secondarySystemBackground),
                            ),
                        )
                        .overlay(
                            Capsule().stroke(
                                filter == f ? Color.accentColor.opacity(0.6) : Color.clear,
                                lineWidth: 1,
                            ),
                        )
                        .foregroundStyle(filter == f ? Color.accentColor : .primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    // MARK: - Grid

    @ViewBuilder
    private var content: some View {
        if filteredTiles.isEmpty {
            ContentUnavailableView(
                "Ingen bilder i utvalget",
                systemImage: "photo.on.rectangle.angled",
                description: Text("Ingen tiles matcher filteret \"\(filter.rawValue)\". Bytt til Alle for å se hele opptaket."),
            )
        } else {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(filteredTiles) { tile in
                        Button { viewerTile = tile } label: {
                            CollageThumbnail(tile: tile)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
    }

    // MARK: - Filtering

    private var filteredTiles: [CoverageTile] {
        tiles(matching: filter)
    }

    /// Filter logic also exposed to count-bubbles in the chips. Keeps
    /// the chip text honest about what each filter would yield.
    private func tiles(matching filter: Filter) -> [CoverageTile] {
        tiles.filter { tile in
            guard case .captured(_, let rating, let isFlagged, let isRejected) = tile.state else {
                return false
            }
            if isRejected { return false }
            switch filter {
            case .all:     return true
            case .picks:   return rating > 0
            case .top:     return rating >= 4
            case .flagged: return isFlagged
            }
        }
    }

    // MARK: - PDF render + share

    @MainActor
    private func renderAndShare() async {
        isRendering = true
        defer { isRendering = false }
        guard let url = await CollagePDFRenderer.render(
            tiles: filteredTiles,
            filterLabel: filter.rawValue,
        ) else { return }
        pdfShareURL = url
        isPDFShareSheetPresented = true
    }
}

// MARK: - Single thumbnail used by the grid

private struct CollageThumbnail: View {
    let tile: CoverageTile

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            thumbnail
            // Subtle darkened band along the bottom for the rating
            // overlay so it stays legible on bright photos.
            if rating > 0 || isFlagged {
                LinearGradient(
                    colors: [.black.opacity(0.0), .black.opacity(0.55)],
                    startPoint: .center, endPoint: .bottom,
                )
                HStack(spacing: 4) {
                    if rating > 0 {
                        ratingStars
                    }
                    Spacer(minLength: 0)
                    if isFlagged {
                        Image(systemName: "flag.fill")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }
                }
                .padding(.horizontal, 6)
                .padding(.bottom, 6)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .background(Color.black)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    @ViewBuilder
    private var thumbnail: some View {
        if let urlString = previewUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    Image(systemName: "photo.badge.exclamationmark")
                        .foregroundStyle(.secondary)
                @unknown default: EmptyView()
                }
            }
        } else {
            Image(systemName: "photo")
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private var ratingStars: some View {
        HStack(spacing: 1) {
            ForEach(0..<min(rating, 5), id: \.self) { _ in
                Image(systemName: "star.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(.yellow)
            }
        }
    }

    private var rating: Int {
        if case .captured(_, let r, _, _) = tile.state { return r }
        return 0
    }
    private var isFlagged: Bool {
        if case .captured(_, _, let f, _) = tile.state { return f }
        return false
    }
    private var previewUrl: String? {
        if case .captured(let u, _, _, _) = tile.state { return u }
        return nil
    }
}

// MARK: - Fullscreen viewer

private struct CollageImageViewer: View {
    let tile: CoverageTile
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if case .captured(let urlString, _, _, _) = tile.state,
               let urlString,
               let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit()
                    case .failure:
                        Image(systemName: "photo.badge.exclamationmark")
                            .font(.largeTitle)
                            .foregroundStyle(.white.opacity(0.6))
                    case .empty:
                        ProgressView().tint(.white)
                    @unknown default:
                        EmptyView()
                    }
                }
            }
            VStack {
                HStack {
                    Spacer()
                    Button("Lukk") { onDismiss() }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(.black.opacity(0.5), in: Capsule())
                        .padding(16)
                }
                Spacer()
                Text(tile.scene)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.bottom, 32)
            }
        }
    }
}

// MARK: - UIKit share-sheet bridge

private struct CollageActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
