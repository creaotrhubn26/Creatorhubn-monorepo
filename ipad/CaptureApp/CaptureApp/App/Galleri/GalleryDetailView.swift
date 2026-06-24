import SwiftUI

@MainActor
@Observable
final class GalleryDetailModel {
    let galleryId: String

    private(set) var detail: GalleryDetail?
    private(set) var images: [GalleryImage] = []
    private(set) var comments: [GalleryComment] = []
    private(set) var selections: [GallerySelection] = []
    private(set) var loading = true
    private(set) var errorMessage: String?
    var working = false

    init(galleryId: String) { self.galleryId = galleryId }

    func loadAll() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription
            loading = false
            return
        }
        loading = detail == nil
        errorMessage = nil
        async let detailTask = client.galleryDetail(id: galleryId)
        async let activityTask = client.galleryActivity(id: galleryId)
        do {
            let (d, a) = try await (detailTask, activityTask)
            detail = d.gallery
            images = d.images
            comments = a.comments
            selections = a.selections
        } catch {
            if detail == nil {
                errorMessage = (error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription
            }
        }
        loading = false
    }

    func respond(to comment: GalleryComment, text: String) async {
        guard let client = DashboardClient.make() else { return }
        working = true
        defer { working = false }
        do {
            try await client.respondToComment(
                galleryId: galleryId,
                commentId: comment.id,
                response: text.isEmpty ? nil : text,
            )
            await loadAll()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }

    func markComplete() async {
        guard let client = DashboardClient.make() else { return }
        working = true
        defer { working = false }
        do {
            try await client.markGalleryComplete(galleryId: galleryId)
            await loadAll()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }
}

struct GalleryDetailView: View {
    @State private var model: GalleryDetailModel
    private let summary: GallerySummary

    @State private var respondingTo: GalleryComment?
    @State private var responseText: String = ""

    init(galleryId: String, summary: GallerySummary) {
        _model = State(initialValue: GalleryDetailModel(galleryId: galleryId))
        self.summary = summary
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                if model.loading && model.detail == nil {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if let message = model.errorMessage, model.detail == nil {
                    ContentUnavailableView("Kunne ikke laste", systemImage: "exclamationmark.icloud", description: Text(message))
                } else {
                    if !selectionsAndFavorites.isEmpty { selectionsSection }
                    if !model.comments.isEmpty { commentsSection }
                    if !model.images.isEmpty { imagesSection }
                }
            }
            .padding()
        }
        .frame(maxWidth: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(summary.clientName ?? summary.projectTitle ?? "Galleri")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.loadAll() }
        .refreshable { await model.loadAll() }
        .alert("Svar til klient", isPresented: respondingBinding) {
            TextField("Skriv et svar…", text: $responseText)
            Button("Marker som løst") {
                if let comment = respondingTo {
                    let text = responseText
                    Task { await model.respond(to: comment, text: text) }
                }
                responseText = ""
            }
            Button("Avbryt", role: .cancel) { responseText = "" }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                if let project = summary.projectTitle {
                    Text(project).font(.title3.bold())
                }
                Spacer()
                StatusPill(status: model.detail?.status ?? summary.status)
            }
            if let email = summary.clientEmail {
                Label(email, systemImage: "envelope")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 16) {
                Label("\(model.detail?.imageCount ?? summary.imageCount)", systemImage: "photo")
                Label("\(model.detail?.favoriteCount ?? summary.favoriteCount)", systemImage: "heart.fill").foregroundStyle(.pink)
                Label("\(model.detail?.selectionCount ?? summary.selectionCount)", systemImage: "checkmark.circle").foregroundStyle(.green)
                Label("\(model.detail?.commentCount ?? summary.commentCount)", systemImage: "bubble.left")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            HStack {
                if let share = summary.shareUrl, let url = URL(string: share) {
                    ShareLink(item: url) {
                        Label("Del med klient", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.bordered)
                }
                Spacer()
                if (model.detail?.status ?? summary.status)?.lowercased() != "completed" {
                    Button {
                        Task { await model.markComplete() }
                    } label: {
                        Label("Marker fullført", systemImage: "checkmark.seal")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.working)
                }
            }
        }
    }

    // MARK: - Selections / favorites

    private var selectionsAndFavorites: [GallerySelection] { model.selections }

    private var selectionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Klientvalg", count: selectionsAndFavorites.count)
            LazyVGrid(columns: gridColumns, spacing: 10) {
                ForEach(selectionsAndFavorites) { selection in
                    ZStack(alignment: .topTrailing) {
                        Thumbnail(urlString: selection.imageThumbnail)
                        Image(systemName: selection.selectionType == "favorite" ? "heart.fill" : "checkmark.circle.fill")
                            .foregroundStyle(selection.selectionType == "favorite" ? .pink : .green)
                            .padding(6)
                            .background(.ultraThinMaterial, in: Circle())
                            .padding(6)
                    }
                }
            }
        }
    }

    // MARK: - Comments

    private var commentsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Kommentarer", count: model.comments.count)
            ForEach(model.comments) { comment in
                CommentRow(comment: comment) {
                    respondingTo = comment
                    responseText = comment.photographerResponse ?? ""
                }
            }
        }
    }

    // MARK: - Images

    private var imagesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Bilder", count: model.images.count)
            LazyVGrid(columns: gridColumns, spacing: 10) {
                ForEach(model.images) { image in
                    Thumbnail(urlString: image.thumbnailUrl)
                }
            }
        }
    }

    private var gridColumns: [GridItem] {
        [GridItem(.adaptive(minimum: 100), spacing: 10)]
    }

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title).font(.headline).foregroundStyle(CHTheme.textPrimary)
            Text("\(count)").font(.subheadline).foregroundStyle(CHTheme.textMuted)
            Spacer()
        }
    }

    private var respondingBinding: Binding<Bool> {
        Binding(
            get: { respondingTo != nil },
            set: { if !$0 { respondingTo = nil } },
        )
    }
}

private struct CommentRow: View {
    let comment: GalleryComment
    let onRespond: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Thumbnail(urlString: comment.imageThumbnail, size: 52)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(comment.clientName ?? comment.clientEmail ?? "Klient")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    if (comment.status ?? "").lowercased() == "resolved" {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                    }
                    Text(DashboardDate.relative(comment.createdAt))
                        .font(.caption2).foregroundStyle(.tertiary)
                }
                if let text = comment.comment {
                    Text(text).font(.subheadline)
                }
                if let reply = comment.photographerResponse, !reply.isEmpty {
                    Text("Du: \(reply)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.accentColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                }
                Button(action: onRespond) {
                    Label((comment.status ?? "").lowercased() == "resolved" ? "Rediger svar" : "Svar",
                          systemImage: "arrowshape.turn.up.left")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(.vertical, 6)
    }
}

/// Network thumbnail with a placeholder + rounded corners.
private struct Thumbnail: View {
    let urlString: String?
    var size: CGFloat?

    var body: some View {
        AsyncImage(url: urlString.flatMap(URL.init(string:))) { phase in
            switch phase {
            case let .success(image):
                image.resizable().scaledToFill()
            case .empty:
                ProgressView()
            default:
                Image(systemName: "photo")
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(width: size, height: size ?? nil)
        .frame(minHeight: size == nil ? 100 : nil)
        .frame(maxWidth: size == nil ? .infinity : nil)
        .aspectRatio(size == nil ? 1 : nil, contentMode: .fill)
        .background(Color(uiColor: .secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
