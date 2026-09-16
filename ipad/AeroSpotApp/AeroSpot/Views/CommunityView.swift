// CommunityView.swift — delt feed av spotting-bilder. Se andres fangster,
// lik, og del dine egne fra loggboken. Offentlig lesing; posting krever
// innlogging.

import SwiftUI

@MainActor
@Observable
final class CommunityStore {
    private(set) var posts: [CommunityPost] = []
    private(set) var loading = true
    var likedIds: Set<String> = []

    func load(airport: String?) async {
        loading = true
        posts = await AeroSpotAPI.communityFeed(airport: airport)
        loading = false
    }

    func toggleLike(_ post: CommunityPost) async {
        // Optimistisk
        let wasLiked = likedIds.contains(post.id)
        if wasLiked { likedIds.remove(post.id) } else { likedIds.insert(post.id) }
        if let idx = posts.firstIndex(where: { $0.id == post.id }) {
            posts[idx].likes += wasLiked ? -1 : 1
        }
        let result = await AeroSpotAPI.toggleLike(postId: post.id)
        if result == nil {
            // rull tilbake ved feil (f.eks. uinnlogget)
            if wasLiked { likedIds.insert(post.id) } else { likedIds.remove(post.id) }
            if let idx = posts.firstIndex(where: { $0.id == post.id }) {
                posts[idx].likes += wasLiked ? 1 : -1
            }
        }
    }
}

struct CommunityView: View {
    @Environment(AppModel.self) private var model
    @State private var store = CommunityStore()
    @State private var scope: Scope = .airport

    enum Scope: String, CaseIterable { case airport = "Her", global = "Overalt" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.spacingLG) {
                Picker("", selection: $scope) {
                    ForEach(Scope.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                if store.loading {
                    ProgressView().tint(Theme.textSecondary)
                        .frame(maxWidth: .infinity).padding(Theme.spacingXL)
                } else if store.posts.isEmpty {
                    EmptyStateView(
                        title: "Ingen delinger ennå",
                        message: "Bli den første — del et bilde fra loggboken din."
                    )
                } else {
                    ForEach(store.posts) { post in
                        CommunityCard(post: post, liked: store.likedIds.contains(post.id)) {
                            Task { await store.toggleLike(post) }
                        }
                    }
                }
            }
            .padding(Theme.spacingLG)
        }
        .background(Theme.background)
        .navigationTitle("Community")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: scope) {
            await store.load(airport: scope == .airport ? model.activeAirport.icao : nil)
        }
    }
}

private struct CommunityCard: View {
    let post: CommunityPost
    let liked: Bool
    let onLike: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            if let thumb = post.thumbData, let image = decodeDataURL(thumb) {
                Image(uiImage: image)
                    .resizable().scaledToFill()
                    .frame(height: 220).frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
            }
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Theme.spacingSM) {
                        Text(post.aircraftType ?? post.registration ?? "Ukjent fly")
                            .font(.headline)
                            .foregroundStyle(Theme.textPrimary)
                        if let rarity = post.rarity { RareBadge(rarity: rarity) }
                    }
                    Text([post.registration, post.airportIcao, post.spotName]
                        .compactMap { $0 }.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Button(action: onLike) {
                    HStack(spacing: 4) {
                        Image(systemName: liked ? "heart.fill" : "heart")
                        Text("\(post.likes)")
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(liked ? Theme.danger : Theme.textSecondary)
                }
            }
            if let caption = post.caption, !caption.isEmpty {
                Text(caption)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textPrimary)
            }
            Text("\(post.userName) · \(relativeTime(post.createdAtIso))")
                .font(.caption2)
                .foregroundStyle(Theme.textTertiary)
        }
        .card()
    }

    private func decodeDataURL(_ s: String) -> UIImage? {
        guard let comma = s.firstIndex(of: ","),
              let data = Data(base64Encoded: String(s[s.index(after: comma)...]))
        else { return nil }
        return UIImage(data: data)
    }

    private func relativeTime(_ iso: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: iso) else { return "" }
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "nb_NO")
        return f.localizedString(for: date, relativeTo: Date())
    }
}
