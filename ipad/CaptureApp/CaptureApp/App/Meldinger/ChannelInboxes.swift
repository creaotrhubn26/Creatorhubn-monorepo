import SwiftUI

// MARK: - Gmail

@MainActor
@Observable
final class GmailInboxModel {
    private(set) var threads: [GmailThread] = []
    private(set) var loading = true
    private(set) var errorMessage: String?
    var search = ""

    func load() async {
        guard let client = DashboardClient.make() else { errorMessage = "Ikke logget inn"; loading = false; return }
        loading = threads.isEmpty
        errorMessage = nil
        do { threads = try await client.listEmailThreads(search: search.isEmpty ? nil : search) }
        catch { if threads.isEmpty { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription } }
        loading = false
    }
}

struct GmailInbox: View {
    @State private var model = GmailInboxModel()

    var body: some View {
        ChannelInboxScaffold(
            title: "Ingen e-poster",
            loading: model.loading && model.threads.isEmpty,
            isEmpty: model.threads.isEmpty,
            errorMessage: model.threads.isEmpty ? model.errorMessage : nil,
            emptyText: "Gmail-tråder dukker opp her når Google Workspace er koblet til.",
            onRefresh: { await model.load() },
        ) {
            ForEach(model.threads) { thread in
                NavigationLink {
                    GmailThreadView(thread: thread)
                } label: {
                    ThreadPreviewRow(
                        title: thread.counterpartName ?? thread.counterpartEmail ?? thread.subject ?? "Ukjent",
                        subtitle: thread.subject,
                        preview: thread.snippet,
                        time: thread.timestamp,
                        unread: thread.unreadCount,
                        badge: thread.hasAttachments ? "paperclip" : nil,
                    )
                }
                .listRowBackground(CHTheme.surface)
                .listRowSeparatorTint(CHTheme.border)
            }
        }
        .searchable(text: $model.search, prompt: "Søk i e-post")
        .onSubmit(of: .search) { Task { await model.load() } }
        .task { await model.load() }
    }
}

@MainActor
@Observable
final class GmailThreadModel {
    let threadId: String
    private(set) var messages: [GmailMessage] = []
    private(set) var loading = true
    private(set) var errorMessage: String?
    var sending = false

    init(threadId: String) { self.threadId = threadId }

    func load() async {
        guard let client = DashboardClient.make() else { return }
        loading = messages.isEmpty
        do { messages = try await client.emailThreadMessages(threadId: threadId) }
        catch { if messages.isEmpty { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription } }
        loading = false
    }

    func reply(_ text: String) async {
        guard let client = DashboardClient.make() else { return }
        sending = true; defer { sending = false }
        do { try await client.replyEmail(threadId: threadId, message: text); await load() }
        catch { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription }
    }
}

struct GmailThreadView: View {
    let thread: GmailThread
    @State private var model: GmailThreadModel
    @State private var draft = ""

    init(thread: GmailThread) {
        self.thread = thread
        _model = State(initialValue: GmailThreadModel(threadId: thread.threadId ?? thread.id))
    }

    var body: some View {
        VStack(spacing: 0) {
            if model.loading && model.messages.isEmpty {
                ProgressView("Laster…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(model.messages) { m in
                            ChannelBubble(
                                text: m.content ?? "",
                                sender: m.senderName ?? m.senderEmail,
                                time: DashboardDate.relative(m.timestamp),
                                fromMe: (m.direction ?? "").lowercased() == "outbound",
                            )
                        }
                    }.padding()
                }
                .refreshable { await model.load() }
            }
            ComposeBar(draft: $draft, sending: model.sending, placeholder: "Svar på e-post…") {
                let t = draft; draft = ""; Task { await model.reply(t) }
            }
        }
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(thread.subject ?? thread.counterpartName ?? "E-post")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { ChatActionsMenu(draft: $draft, clientName: thread.counterpartName) }
            ToolbarItem(placement: .topBarTrailing) {
                CRMSheetButton(conversationId: thread.threadId ?? thread.id, provider: "gmail", hintName: thread.counterpartName)
            }
        }
        .task { await model.load() }
    }
}

// MARK: - Google Chat

@MainActor
@Observable
final class GoogleChatInboxModel {
    private(set) var spaces: [GoogleChatSpace] = []
    private(set) var loading = true
    private(set) var errorMessage: String?

    func load() async {
        guard let client = DashboardClient.make() else { errorMessage = "Ikke logget inn"; loading = false; return }
        loading = spaces.isEmpty
        do { spaces = try await client.listGoogleChatSpaces() }
        catch { if spaces.isEmpty { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription } }
        loading = false
    }
}

struct GoogleChatInbox: View {
    @State private var model = GoogleChatInboxModel()

    var body: some View {
        ChannelInboxScaffold(
            title: "Ingen rom",
            loading: model.loading && model.spaces.isEmpty,
            isEmpty: model.spaces.isEmpty,
            errorMessage: model.spaces.isEmpty ? model.errorMessage : nil,
            emptyText: "Google Chat-rom dukker opp her når Google Workspace er koblet til.",
            onRefresh: { await model.load() },
        ) {
            ForEach(model.spaces) { space in
                NavigationLink {
                    GoogleChatThreadView(space: space)
                } label: {
                    ThreadPreviewRow(title: space.name ?? "Rom", subtitle: nil, preview: space.description, time: nil, unread: 0, badge: nil)
                }
                .listRowBackground(CHTheme.surface)
                .listRowSeparatorTint(CHTheme.border)
            }
        }
        .task { await model.load() }
    }
}

@MainActor
@Observable
final class GoogleChatThreadModel {
    let space: String
    private(set) var messages: [GoogleChatMsg] = []
    private(set) var loading = true
    var sending = false

    init(space: String) { self.space = space }

    func load() async {
        guard let client = DashboardClient.make() else { return }
        loading = messages.isEmpty
        messages = (try? await client.googleChatMessages(space: space)) ?? messages
        loading = false
    }

    func send(_ text: String) async {
        guard let client = DashboardClient.make() else { return }
        sending = true; defer { sending = false }
        try? await client.sendGoogleChat(space: space, message: text)
        await load()
    }
}

struct GoogleChatThreadView: View {
    let space: GoogleChatSpace
    @State private var model: GoogleChatThreadModel
    @State private var draft = ""

    init(space: GoogleChatSpace) {
        self.space = space
        _model = State(initialValue: GoogleChatThreadModel(space: space.id))
    }

    var body: some View {
        VStack(spacing: 0) {
            if model.loading && model.messages.isEmpty {
                ProgressView("Laster…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(model.messages) { m in
                            ChannelBubble(text: m.content ?? "", sender: m.senderName, time: DashboardDate.relative(m.timestamp), fromMe: false)
                        }
                    }.padding()
                }
                .refreshable { await model.load() }
            }
            ComposeBar(draft: $draft, sending: model.sending) {
                let t = draft; draft = ""; Task { await model.send(t) }
            }
        }
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(space.name ?? "Rom")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { ChatActionsMenu(draft: $draft, clientName: space.name) }
            ToolbarItem(placement: .topBarTrailing) {
                CRMSheetButton(conversationId: space.id, provider: "google-chat", hintName: space.name)
            }
        }
        .task { await model.load() }
    }
}

// MARK: - Evendi

@MainActor
@Observable
final class EvendiInboxModel {
    private(set) var conversations: [EvendiConversation] = []
    private(set) var loading = true
    private(set) var errorMessage: String?

    func load() async {
        guard let client = DashboardClient.make() else { errorMessage = "Ikke logget inn"; loading = false; return }
        loading = conversations.isEmpty
        do { conversations = try await client.listEvendiConversations() }
        catch let e as DashboardError {
            if conversations.isEmpty {
                switch e {
                case .notFound, .unauthorized:
                    errorMessage = "Ingen Evendi-vendorprofil er koblet til denne kontoen."
                default: errorMessage = e.localizedDescription
                }
            }
        } catch { if conversations.isEmpty { errorMessage = error.localizedDescription } }
        loading = false
    }
}

struct EvendiInbox: View {
    @State private var model = EvendiInboxModel()

    var body: some View {
        ChannelInboxScaffold(
            title: "Ingen Evendi-samtaler",
            loading: model.loading && model.conversations.isEmpty,
            isEmpty: model.conversations.isEmpty,
            errorMessage: model.conversations.isEmpty ? model.errorMessage : nil,
            emptyText: "Brudepar-samtaler fra Evendi dukker opp her.",
            onRefresh: { await model.load() },
        ) {
            ForEach(model.conversations) { conv in
                NavigationLink {
                    EvendiThreadView(conversation: conv)
                } label: {
                    ThreadPreviewRow(
                        title: conv.coupleName ?? "Brudepar",
                        subtitle: nil,
                        preview: conv.lastMessage,
                        time: conv.lastMessageAt,
                        unread: conv.vendorUnreadCount ?? 0,
                        badge: nil,
                    )
                }
                .listRowBackground(CHTheme.surface)
                .listRowSeparatorTint(CHTheme.border)
            }
        }
        .task { await model.load() }
    }
}

@MainActor
@Observable
final class EvendiThreadModel {
    let conversationId: String
    private(set) var messages: [EvendiMessage] = []
    private(set) var loading = true
    var sending = false

    init(conversationId: String) { self.conversationId = conversationId }

    func load() async {
        guard let client = DashboardClient.make() else { return }
        loading = messages.isEmpty
        messages = (try? await client.evendiMessages(conversationId: conversationId)) ?? messages
        loading = false
    }

    func send(_ text: String) async {
        guard let client = DashboardClient.make() else { return }
        sending = true; defer { sending = false }
        try? await client.sendEvendi(conversationId: conversationId, message: text)
        await load()
    }
}

struct EvendiThreadView: View {
    let conversation: EvendiConversation
    @State private var model: EvendiThreadModel
    @State private var draft = ""

    init(conversation: EvendiConversation) {
        self.conversation = conversation
        _model = State(initialValue: EvendiThreadModel(conversationId: conversation.id))
    }

    var body: some View {
        VStack(spacing: 0) {
            if model.loading && model.messages.isEmpty {
                ProgressView("Laster…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(model.messages) { m in
                            ChannelBubble(
                                text: m.body ?? "",
                                sender: m.senderType == "vendor" ? nil : conversation.coupleName,
                                time: DashboardDate.relative(m.createdAt),
                                fromMe: m.senderType == "vendor",
                            )
                        }
                    }.padding()
                }
                .refreshable { await model.load() }
            }
            ComposeBar(draft: $draft, sending: model.sending) {
                let t = draft; draft = ""; Task { await model.send(t) }
            }
        }
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(conversation.coupleName ?? "Brudepar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { ChatActionsMenu(draft: $draft, clientName: conversation.coupleName) }
            ToolbarItem(placement: .topBarTrailing) {
                CRMSheetButton(conversationId: conversation.id, provider: "evendi", hintName: conversation.coupleName)
            }
        }
        .task { await model.load() }
    }
}

// MARK: - Shared preview row

struct ThreadPreviewRow: View {
    let title: String
    let subtitle: String?
    let preview: String?
    let time: String?
    let unread: Int
    let badge: String?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(initials).font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.accent)
                .frame(width: 40, height: 40).background(CHTheme.accent.opacity(0.14), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title).font(.headline).foregroundStyle(CHTheme.textPrimary).lineLimit(1)
                    if let badge { Image(systemName: badge).font(.caption2).foregroundStyle(CHTheme.textMuted) }
                    Spacer()
                    if let time { let r = DashboardDate.relative(time); if !r.isEmpty { Text(r).font(.caption2).foregroundStyle(CHTheme.textMuted) } }
                }
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle).font(.subheadline).foregroundStyle(CHTheme.textSecondary).lineLimit(1)
                }
                if let preview, !preview.isEmpty {
                    Text(preview).font(.caption).foregroundStyle(CHTheme.textMuted).lineLimit(2)
                }
            }
            if unread > 0 {
                Text("\(unread)").font(.caption2.weight(.bold)).foregroundStyle(CHTheme.bg)
                    .padding(.horizontal, 7).padding(.vertical, 3).background(CHTheme.accent, in: Capsule())
            }
        }
        .padding(.vertical, 4)
    }

    private var initials: String {
        let parts = title.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init)
        return parts.joined().uppercased().isEmpty ? "?" : parts.joined().uppercased()
    }
}
