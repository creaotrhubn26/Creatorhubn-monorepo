import SwiftUI

/// Native "Galleri" tab — the photographer's client galleries (showcase
/// admin), rebuilt native for a run-and-gun feel instead of the old
/// WebView. Lists every gallery with live engagement counts and drills
/// into a detail with the client's selections + comments. End-to-end
/// synced against `/api/photographer/galleries`.
@MainActor
@Observable
final class GalleriModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case error(String)
    }

    private(set) var galleries: [GallerySummary] = []
    private(set) var phase: Phase = .loading

    func load(force: Bool = false) async {
        if force || galleries.isEmpty { phase = galleries.isEmpty ? .loading : phase }
        guard let client = DashboardClient.make() else {
            phase = .error(DashboardError.signedOut.localizedDescription)
            return
        }
        do {
            let result = try await client.listGalleries()
            galleries = result
            phase = .loaded
        } catch {
            // Keep any already-loaded list visible; only flip to the
            // error screen when we have nothing to show.
            if galleries.isEmpty {
                phase = .error((error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription)
            }
        }
    }
}

struct GalleriView: View {
    @State private var model = GalleriModel()

    var body: some View {
        NavigationStack {
            Group {
                switch model.phase {
                case .loading where model.galleries.isEmpty:
                    ProgressView("Laster gallerier…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case let .error(message) where model.galleries.isEmpty:
                    ContentUnavailableView {
                        Label("Kunne ikke laste gallerier", systemImage: "exclamationmark.icloud")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Prøv igjen") { Task { await model.load(force: true) } }
                            .buttonStyle(.borderedProminent)
                    }
                default:
                    if model.galleries.isEmpty {
                        ContentUnavailableView(
                            "Ingen gallerier ennå",
                            systemImage: "photo.on.rectangle.angled",
                            description: Text("Gallerier du deler med klienter dukker opp her."),
                        )
                    } else {
                        list
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Galleri")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await model.load(force: true) }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .navigationDestination(for: GallerySummary.self) { gallery in
                GalleryDetailView(galleryId: gallery.id, summary: gallery)
            }
        }
        .task { await model.load() }
    }

    private var list: some View {
        List {
            ForEach(model.galleries) { gallery in
                NavigationLink(value: gallery) {
                    GalleryRow(gallery: gallery)
                }
                .listRowBackground(CHTheme.surface)
                .listRowSeparatorTint(CHTheme.border)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await model.load(force: true) }
    }
}

/// One gallery card — client + project up top, status pill, and the live
/// engagement counts (images / favorites / selections / comments / paid).
private struct GalleryRow: View {
    let gallery: GallerySummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(gallery.clientName ?? gallery.projectTitle ?? "Uten navn")
                        .font(.headline)
                        .foregroundStyle(CHTheme.textPrimary)
                    if let project = gallery.projectTitle, gallery.clientName != nil {
                        Text(project)
                            .font(.subheadline)
                            .foregroundStyle(CHTheme.textSecondary)
                    }
                }
                Spacer()
                StatusPill(status: gallery.status)
            }

            HStack(spacing: 16) {
                Stat(icon: "photo", value: gallery.imageCount)
                Stat(icon: "heart.fill", value: gallery.favoriteCount, tint: .pink)
                Stat(icon: "checkmark.circle", value: gallery.selectionCount, tint: CHTheme.success)
                Stat(icon: "bubble.left", value: gallery.commentCount)
                if gallery.paidCount > 0 {
                    Stat(icon: "creditcard", value: gallery.paidCount, tint: CHTheme.info)
                }
            }
            .font(.caption)

            if let created = gallery.createdAt {
                Text("Opprettet \(DashboardDate.relative(created))")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct Stat: View {
    let icon: String
    let value: Int
    var tint: Color = CHTheme.textSecondary

    var body: some View {
        Label("\(value)", systemImage: icon)
            .labelStyle(.titleAndIcon)
            .foregroundStyle(value > 0 ? tint : CHTheme.textMuted)
    }
}

struct StatusPill: View {
    let status: String?

    private var label: String {
        switch (status ?? "").lowercased() {
        case "active": return "Aktiv"
        case "completed": return "Fullført"
        case "archived": return "Arkivert"
        case "": return "—"
        default: return status ?? "—"
        }
    }

    private var color: Color {
        switch (status ?? "").lowercased() {
        case "active": return .green
        case "completed": return .blue
        case "archived": return .gray
        default: return .secondary
        }
    }

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}
