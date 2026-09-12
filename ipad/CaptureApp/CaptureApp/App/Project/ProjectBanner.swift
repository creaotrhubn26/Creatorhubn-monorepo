import SwiftUI

/// "Denne chatten hører til prosjektet …" — a tappable banner shown at the top
/// of a conversation thread when the conversation is linked to a project (via
/// the CRM context). Tapping opens the native project hub. Renders nothing
/// when the conversation isn't tied to a project, so it's safe to drop into
/// every channel's thread.
struct ProjectBanner: View {
    let conversationId: String
    let provider: String

    @State private var link: ConversationProjectLink?
    @State private var loaded = false

    var body: some View {
        Group {
            if let link {
                NavigationLink {
                    ProjectDetailView(projectId: link.id, title: link.name)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "folder.fill").foregroundStyle(CHTheme.accent)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Prosjekt").font(.caption2).foregroundStyle(CHTheme.textMuted)
                            Text(link.name ?? "Åpne prosjekt").font(.subheadline.weight(.semibold))
                                .foregroundStyle(CHTheme.textPrimary).lineLimit(1)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(CHTheme.textMuted)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(CHTheme.surface)
                    .overlay(Rectangle().fill(CHTheme.accent).frame(width: 3), alignment: .leading)
                }
                .buttonStyle(.plain)
            }
        }
        .task {
            guard !loaded else { return }
            loaded = true
            guard let client = DashboardClient.make() else { return }
            link = try? await client.conversationProject(conversationId: conversationId, provider: provider)
        }
    }
}
