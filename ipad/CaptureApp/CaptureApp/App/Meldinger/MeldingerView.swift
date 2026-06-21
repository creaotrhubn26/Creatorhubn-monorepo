import SwiftUI
import PhotosUI

/// Native "Meldinger" tab — the photographer's client inbox + chat threads,
/// rebuilt native for a run-and-gun feel instead of the old WebView. Lists
/// every conversation with a last-message preview and drills into a chat
/// thread with bubbles + a compose bar. End-to-end synced against
/// `/api/communication/*`.
@MainActor
@Observable
final class MeldingerModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case error(String)
    }

    private(set) var conversations: [Conversation] = []
    private(set) var phase: Phase = .loading

    func load(force: Bool = false) async {
        if force || conversations.isEmpty {
            phase = conversations.isEmpty ? .loading : phase
        }
        guard let client = DashboardClient.make() else {
            phase = .error(DashboardError.signedOut.localizedDescription)
            return
        }
        do {
            conversations = try await client.listConversations()
            phase = .loaded
        } catch {
            // Keep any already-loaded inbox visible; only flip to the error
            // screen when we have nothing to show.
            if conversations.isEmpty {
                phase = .error((error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription)
            }
        }
    }
}

/// Internal-chat channel inbox (one of the channels inside ``MeldingerView``).
struct InternalChatInbox: View {
    @State private var model = MeldingerModel()

    var body: some View {
        Group {
            switch model.phase {
            case .loading where model.conversations.isEmpty:
                ProgressView("Laster meldinger…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case let .error(message) where model.conversations.isEmpty:
                ContentUnavailableView {
                    Label("Kunne ikke laste meldinger", systemImage: "exclamationmark.bubble")
                } description: {
                    Text(message)
                } actions: {
                    Button("Prøv igjen") { Task { await model.load(force: true) } }
                        .buttonStyle(.borderedProminent)
                }
            default:
                if model.conversations.isEmpty {
                    ContentUnavailableView(
                        "Ingen samtaler ennå",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text("Når en klient skriver til deg dukker samtalen opp her."),
                    )
                } else {
                    inbox
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationDestination(for: Conversation.self) { conversation in
            ChatThreadView(conversation: conversation)
        }
        .task { await model.load() }
    }

    private var inbox: some View {
        List {
            ForEach(model.conversations) { conversation in
                NavigationLink(value: conversation) {
                    ConversationRow(conversation: conversation)
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

/// One inbox row — client/space name, last-message preview + relative time.
private struct ConversationRow: View {
    let conversation: Conversation

    private var title: String {
        conversation.name
            ?? conversation.customerName
            ?? "Uten navn"
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Avatar(name: title)
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(CHTheme.textPrimary)
                        .lineLimit(1)
                    Spacer()
                    if let updated = conversation.updatedAt {
                        let relative = DashboardDate.relative(updated)
                        if !relative.isEmpty {
                            Text(relative)
                                .font(.caption2)
                                .foregroundStyle(CHTheme.textMuted)
                        }
                    }
                }
                Text(conversation.lastMessage?.isEmpty == false
                    ? conversation.lastMessage!
                    : "Ingen meldinger ennå")
                    .font(.subheadline)
                    .foregroundStyle(conversation.lastMessage?.isEmpty == false
                        ? CHTheme.textSecondary
                        : CHTheme.textMuted)
                    .lineLimit(2)
                if let provider = conversation.provider, !provider.isEmpty {
                    ProviderTag(provider: provider)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Circular initials avatar — keeps the inbox scannable without remote images.
private struct Avatar: View {
    let name: String

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        let chars = parts.compactMap { $0.first }.map(String.init)
        let joined = chars.joined().uppercased()
        return joined.isEmpty ? "?" : joined
    }

    var body: some View {
        Text(initials)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(CHTheme.accent)
            .frame(width: 40, height: 40)
            .background(CHTheme.accent.opacity(0.14), in: Circle())
    }
}

private struct ProviderTag: View {
    let provider: String

    private var label: String {
        switch provider.lowercased() {
        case "internal-chat", "chat": return "Chat"
        case "google-chat": return "Google Chat"
        case "gmail", "email": return "E-post"
        case "evendi": return "Evendi"
        default: return provider
        }
    }

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(CHTheme.surfaceElevated, in: Capsule())
            .foregroundStyle(CHTheme.textSecondary)
    }
}

// MARK: - Thread

@MainActor
@Observable
final class ChatThreadModel {
    let channelId: String

    private(set) var messages: [ChatMessage] = []
    private(set) var loading = true
    private(set) var errorMessage: String?
    var sending = false
    /// Attachments staged for the next send + an in-flight upload flag.
    private(set) var pendingAttachments: [MessageAttachment] = []
    private(set) var uploading = false

    init(channelId: String) { self.channelId = channelId }

    /// Upload a picked file and stage it for the next send.
    func attach(data: Data, filename: String, mimeType: String) async {
        guard let client = DashboardClient.make() else { return }
        uploading = true
        defer { uploading = false }
        do {
            let att = try await client.uploadAttachment(data: data, filename: filename, mimeType: mimeType)
            pendingAttachments.append(att)
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }

    func removePending(_ att: MessageAttachment) {
        pendingAttachments.removeAll { $0.id == att.id }
    }

    func load() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription
            loading = false
            return
        }
        loading = messages.isEmpty
        errorMessage = nil
        do {
            messages = try await client.messages(channelId: channelId)
        } catch {
            if messages.isEmpty {
                errorMessage = (error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription
            }
        }
        loading = false
    }

    /// Send, then reload the thread so the persisted message (with its real
    /// id/timestamp) shows up.
    func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        // Allow sending with only attachments (no text).
        guard !trimmed.isEmpty || !pendingAttachments.isEmpty else { return }
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription
            return
        }
        let atts = pendingAttachments
        sending = true
        defer { sending = false }
        do {
            try await client.sendMessage(channelId: channelId, text: trimmed, attachments: atts)
            pendingAttachments = []
            await load()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription
                ?? error.localizedDescription
        }
    }
}

struct ChatThreadView: View {
    @State private var model: ChatThreadModel
    private let conversation: Conversation
    @State private var draft: String = ""
    @FocusState private var composeFocused: Bool
    @State private var photoItem: PhotosPickerItem?

    init(conversation: Conversation) {
        self.conversation = conversation
        _model = State(initialValue: ChatThreadModel(channelId: conversation.channelId ?? conversation.id))
    }

    private var title: String {
        conversation.name ?? conversation.customerName ?? "Samtale"
    }

    var body: some View {
        VStack(spacing: 0) {
            messageList
            composeBar
        }
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { ChatActionsMenu(draft: $draft, clientName: title) }
            ToolbarItem(placement: .topBarTrailing) {
                CRMSheetButton(
                    conversationId: conversation.channelId ?? conversation.id,
                    provider: "internal-chat",
                    hintName: title,
                )
            }
        }
        .task { await model.load() }
    }

    @ViewBuilder
    private var messageList: some View {
        if model.loading && model.messages.isEmpty {
            ProgressView("Laster samtale…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let message = model.errorMessage, model.messages.isEmpty {
            ContentUnavailableView(
                "Kunne ikke laste samtalen",
                systemImage: "exclamationmark.bubble",
                description: Text(message),
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if model.messages.isEmpty {
            ContentUnavailableView(
                "Ingen meldinger ennå",
                systemImage: "bubble.left.and.bubble.right",
                description: Text("Skriv den første meldingen nedenfor."),
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(model.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .refreshable { await model.load() }
                .onChange(of: model.messages.count) { _, _ in
                    if let last = model.messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
                .onAppear {
                    if let last = model.messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var composeBar: some View {
        VStack(spacing: 8) {
            // Staged attachments (uploaded, awaiting send)
            if !model.pendingAttachments.isEmpty || model.uploading {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(model.pendingAttachments) { att in
                            HStack(spacing: 6) {
                                Image(systemName: "paperclip").font(.caption2)
                                Text(att.filename).font(.caption2).lineLimit(1)
                                Button { model.removePending(att) } label: { Image(systemName: "xmark.circle.fill").font(.caption2) }
                            }
                            .padding(.horizontal, 8).padding(.vertical, 5)
                            .background(CHTheme.surfaceElevated, in: Capsule())
                            .foregroundStyle(CHTheme.textSecondary)
                        }
                        if model.uploading {
                            HStack(spacing: 6) { ProgressView().controlSize(.mini); Text("Laster opp…").font(.caption2) }
                                .padding(.horizontal, 8).padding(.vertical, 5)
                                .background(CHTheme.surfaceElevated, in: Capsule())
                                .foregroundStyle(CHTheme.textMuted)
                        }
                    }
                    .padding(.horizontal, 12)
                }
            }
            HStack(alignment: .bottom, spacing: 10) {
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Image(systemName: "paperclip")
                        .font(.headline)
                        .foregroundStyle(CHTheme.textSecondary)
                        .frame(width: 38, height: 38)
                }
                TextField("Skriv en melding…", text: $draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...5)
                    .focused($composeFocused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 20))
                    .foregroundStyle(CHTheme.textPrimary)

                Button {
                    let text = draft
                    draft = ""
                    Task { await model.send(text) }
                } label: {
                    Group {
                        if model.sending {
                            ProgressView().tint(CHTheme.bg)
                        } else {
                            Image(systemName: "arrow.up").font(.headline.weight(.bold))
                        }
                    }
                    .frame(width: 38, height: 38)
                    .foregroundStyle(CHTheme.bg)
                    .background(canSend ? CHTheme.accent : CHTheme.textMuted, in: Circle())
                }
                .disabled(!canSend || model.sending)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            CHTheme.surface
                .overlay(CHTheme.border.frame(height: 0.5), alignment: .top)
                .ignoresSafeArea(edges: .bottom),
        )
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task {
                if let data = try? await newItem.loadTransferable(type: Data.self) {
                    let name = "bilde-\(Int(Date().timeIntervalSince1970)).jpg"
                    await model.attach(data: data, filename: name, mimeType: "image/jpeg")
                }
                photoItem = nil
            }
        }
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !model.pendingAttachments.isEmpty
    }
}

/// One chat bubble — right-aligned amber for the photographer, left-aligned
/// dark surface for the client.
private struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.fromMe { Spacer(minLength: 48) }
            VStack(alignment: message.fromMe ? .trailing : .leading, spacing: 3) {
                if !message.fromMe, let sender = message.senderName, !sender.isEmpty {
                    Text(sender)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(CHTheme.textMuted)
                }
                if let text = message.text, !text.isEmpty {
                    Text(text)
                        .font(.body)
                        .foregroundStyle(message.fromMe ? CHTheme.bg : CHTheme.textPrimary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(
                            message.fromMe ? CHTheme.accent : CHTheme.surfaceElevated,
                            in: RoundedRectangle(cornerRadius: 16),
                        )
                }
                ForEach(message.attachments) { att in
                    Link(destination: URL(string: att.downloadUrl) ?? URL(string: "https://creatorhubn.com")!) {
                        HStack(spacing: 6) {
                            Image(systemName: att.mimeType.hasPrefix("image") ? "photo" : "paperclip")
                            Text(att.filename).lineLimit(1)
                        }
                        .font(.caption)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(message.fromMe ? CHTheme.accent.opacity(0.85) : CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(message.fromMe ? CHTheme.bg : CHTheme.accentSoft)
                    }
                }
                let relative = DashboardDate.relative(message.timestamp)
                if !relative.isEmpty {
                    Text(relative)
                        .font(.caption2)
                        .foregroundStyle(CHTheme.textMuted)
                }
            }
            if !message.fromMe { Spacer(minLength: 48) }
        }
    }
}
