// LeadgridAgentChatView.swift
//
// Native iPad "Chat med Agent"-flate. Speiler frontend/client/.../
// RoleRoomAgentChatPanel.tsx i Role Room-web, men kjører på Apple-stack
// (SwiftUI + URLSession + SSE-parser i APIClient).
//
// Driver tre tilstander:
//   1. Ingen thread valgt → vis thread-liste (auto-velg sist aktive)
//   2. Thread valgt       → vis melding-historikk + streaming
//   3. Tom thread         → tom-state "Start samtalen …" m/ idé-chips
//
// Streaming-flyt:
//   - User skriver melding + send → optimistisk legg til som user-msg
//   - Lag tom assistant-msg som vi muter mens delta-events tikker inn
//   - Tool_use-events vises som markerte cards (audit-trail)
//   - Done-event flusher endelig text + setter usage-badge
//   - Error-event viser inline-feilmelding + retry-knapp
//
// Backend-eier: backend/server/role-room-agent-threads-routes.ts +
// role-room-agent-stream.ts (eksisterende handleAgentStream).

import SwiftUI

@MainActor
struct LeadgridAgentChatView: View {
    @Environment(AppState.self) private var appState

    /// Optional override — hvis nil, brukes appState.activeProjectId.
    let projectId: String?

    @State private var threads: [AgentThread] = []
    @State private var loadingThreads = true
    @State private var activeThread: AgentThread?
    @State private var messages: [AgentMessage] = []
    @State private var pendingAssistantText: String = ""
    @State private var pendingToolUses: [ToolUseRecord] = []
    @State private var draftMessage: String = ""
    @State private var sending: Bool = false
    @State private var streamingTask: Task<Void, Never>?
    @State private var errorText: String?
    @State private var showThreadList = false
    @State private var renamingThread: AgentThread?
    @State private var renameTitle: String = ""

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    struct ToolUseRecord: Identifiable, Hashable {
        let id: String
        let name: String
        let inputJSON: String
    }

    private var resolvedProjectId: String? {
        projectId ?? appState.activeProjectId
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            if resolvedProjectId == nil {
                emptyProjectState
            } else if loadingThreads {
                Spacer()
                ProgressView()
                    .controlSize(.large)
                    .tint(Self.brandPurple)
                Spacer()
            } else if activeThread == nil {
                emptyThreadState
            } else {
                chatBody
            }
        }
        .background(Color(.systemBackground))
        .task { await loadThreads() }
        .sheet(isPresented: $showThreadList) {
            threadListSheet
        }
        .sheet(item: $renamingThread) { thread in
            renameSheet(for: thread)
        }
    }

    // MARK: - Header

    @ViewBuilder
    private var header: some View {
        HStack(spacing: 8) {
            Button {
                showThreadList = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "sidebar.left")
                    if let title = activeThread?.displayTitle {
                        Text(title)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    } else {
                        Text("Samtaler")
                    }
                }
                .font(.callout.weight(.medium))
            }
            .buttonStyle(.borderless)
            .foregroundStyle(Self.brandPurple)

            Spacer()

            if let usage = lastAssistantUsage {
                Text("\(usage.inputTokens + usage.outputTokens) tokens")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
            }

            Button {
                Task { await startNewThread() }
            } label: {
                Image(systemName: "plus.bubble.fill")
                    .foregroundStyle(Self.brandPurple)
            }
            .buttonStyle(.borderless)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.regularMaterial)
    }

    // MARK: - Empty states

    @ViewBuilder
    private var emptyProjectState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "bubble.left.and.exclamationmark.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Velg et prosjekt først")
                .font(.headline)
            Text("Agent-chatten er knyttet til ett prosjekt — velg eller opprett "
                 + "ett før du starter samtalen.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    @ViewBuilder
    private var emptyThreadState: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "sparkles.rectangle.stack")
                .font(.system(size: 56))
                .foregroundStyle(Self.brandPurple)
            Text("Start samtalen")
                .font(.title3.bold())
            Text("Spør Agenten om dette prosjektet — den kjenner brief, "
                 + "tidslinjen og rollene.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            VStack(spacing: 8) {
                ForEach(starterPrompts, id: \.self) { prompt in
                    Button {
                        draftMessage = prompt
                        Task { await startNewThread(initialMessage: prompt) }
                    } label: {
                        HStack {
                            Image(systemName: "lightbulb.fill")
                                .foregroundStyle(.yellow)
                            Text(prompt)
                                .multilineTextAlignment(.leading)
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.secondarySystemBackground),
                                     in: RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            Spacer()
        }
    }

    private let starterPrompts = [
        "Gi meg et sammendrag av prosjektets status",
        "Hvilke leads bør jeg ringe i dag?",
        "Foreslå en plan for neste 2 uker",
    ]

    // MARK: - Chat body

    @ViewBuilder
    private var chatBody: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(messages) { msg in
                        MessageBubble(message: msg)
                            .id(msg.id)
                    }
                    if sending {
                        StreamingAssistantBubble(
                            text: pendingAssistantText,
                            toolUses: pendingToolUses,
                        )
                        .id("streaming")
                    }
                    if let err = errorText {
                        ErrorRow(text: err, onRetry: { Task { await retryLast() } })
                            .id("error")
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 14)
            }
            .onChange(of: messages.count) { _, _ in
                scrollToBottom(proxy: proxy)
            }
            .onChange(of: pendingAssistantText) { _, _ in
                if sending { proxy.scrollTo("streaming", anchor: .bottom) }
            }
        }
        .background(Color(.systemBackground))
        composer
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        if let last = messages.last {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }

    @ViewBuilder
    private var composer: some View {
        VStack(spacing: 0) {
            Divider()
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Spør Agenten …", text: $draftMessage, axis: .vertical)
                    .lineLimit(1...6)
                    .textFieldStyle(.roundedBorder)
                    .submitLabel(.send)
                Button {
                    Task { await sendDraft() }
                } label: {
                    if sending {
                        ProgressView()
                            .controlSize(.small)
                            .tint(Self.brandPurple)
                            .padding(8)
                            .background(Color(.secondarySystemBackground), in: Circle())
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundStyle(
                                draftMessage.trimmingCharacters(in: .whitespaces).isEmpty
                                    ? Color.gray.opacity(0.4)
                                    : Self.brandPurple
                            )
                    }
                }
                .disabled(sending || draftMessage.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(.regularMaterial)
        }
    }

    // MARK: - Thread list

    @ViewBuilder
    private var threadListSheet: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        showThreadList = false
                        Task { await startNewThread() }
                    } label: {
                        Label("Ny samtale", systemImage: "plus.bubble.fill")
                            .foregroundStyle(Self.brandPurple)
                    }
                }
                Section("Aktive samtaler") {
                    if threads.isEmpty {
                        Text("Ingen samtaler enda. Tap '+' for å starte.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(threads) { thread in
                            threadRow(thread)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Samtaler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { showThreadList = false }
                }
            }
        }
    }

    @ViewBuilder
    private func threadRow(_ thread: AgentThread) -> some View {
        Button {
            showThreadList = false
            Task { await select(thread) }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(thread.displayTitle)
                        .font(.body)
                        .foregroundStyle(.primary)
                    Text(shortDate(thread.lastActiveAt))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if thread.id == activeThread?.id {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Self.brandPurple)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task { await archive(thread) }
            } label: {
                Label("Arkiver", systemImage: "archivebox")
            }
            Button {
                renamingThread = thread
                renameTitle = thread.displayTitle
            } label: {
                Label("Endre tittel", systemImage: "pencil")
            }
            .tint(.blue)
        }
    }

    @ViewBuilder
    private func renameSheet(for thread: AgentThread) -> some View {
        NavigationStack {
            Form {
                Section("Tittel") {
                    TextField("Tittel", text: $renameTitle)
                }
            }
            .navigationTitle("Endre tittel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { renamingThread = nil }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lagre") {
                        Task {
                            await rename(thread: thread, to: renameTitle)
                            renamingThread = nil
                        }
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private var lastAssistantUsage: AgentUsage? {
        // Vi har ikke usage på meldinger fra GET-detail (kun done-event).
        // Vises kun rett etter streaming — slettes når threadet bytter.
        nil
    }

    private func shortDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) {
            let df = DateFormatter()
            df.locale = Locale(identifier: "nb_NO")
            df.dateStyle = .short
            df.timeStyle = .short
            return df.string(from: d)
        }
        return iso
    }

    // MARK: - Actions

    @MainActor
    private func loadThreads() async {
        guard let api = appState.api, let pid = resolvedProjectId else {
            loadingThreads = false
            return
        }
        loadingThreads = true
        defer { loadingThreads = false }
        do {
            let list = try await api.fetchAgentThreads(projectId: pid)
            threads = list
            // Auto-velg sist aktive thread om vi har én.
            if activeThread == nil, let first = list.first {
                await select(first)
            }
        } catch {
            errorText = "Kunne ikke laste samtaler: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func select(_ thread: AgentThread) async {
        // Cancel any in-flight stream when bytte
        streamingTask?.cancel()
        streamingTask = nil
        sending = false
        pendingAssistantText = ""
        pendingToolUses = []
        errorText = nil
        activeThread = thread

        guard let api = appState.api else { return }
        do {
            let detail = try await api.fetchAgentThread(thread.id)
            messages = detail.messages
        } catch {
            errorText = "Kunne ikke laste meldinger: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func startNewThread(initialMessage: String? = nil) async {
        guard let api = appState.api, let pid = resolvedProjectId else { return }
        errorText = nil
        do {
            let thread = try await api.createAgentThread(
                projectId: pid,
                title: initialMessage?.prefix(60).trimmingCharacters(in: .whitespaces),
            )
            threads.insert(thread, at: 0)
            await select(thread)
            if let msg = initialMessage, !msg.isEmpty {
                draftMessage = msg
                await sendDraft()
            }
        } catch {
            errorText = "Kunne ikke opprette samtale: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func archive(_ thread: AgentThread) async {
        guard let api = appState.api else { return }
        do {
            try await api.archiveAgentThread(thread.id)
            threads.removeAll(where: { $0.id == thread.id })
            if activeThread?.id == thread.id {
                activeThread = nil
                messages = []
            }
        } catch {
            errorText = "Kunne ikke arkivere: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func rename(thread: AgentThread, to title: String) async {
        guard let api = appState.api else { return }
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        do {
            try await api.renameAgentThread(thread.id, title: trimmed)
            // Optimistisk oppdater lokal
            if let idx = threads.firstIndex(where: { $0.id == thread.id }) {
                let t = threads[idx]
                threads[idx] = AgentThread(
                    id: t.id,
                    projectId: t.projectId,
                    userId: t.userId,
                    title: trimmed,
                    createdAt: t.createdAt,
                    lastActiveAt: t.lastActiveAt,
                    archivedAt: t.archivedAt,
                )
                if activeThread?.id == t.id {
                    activeThread = threads[idx]
                }
            }
        } catch {
            errorText = "Kunne ikke endre tittel: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func sendDraft() async {
        let trimmed = draftMessage.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        guard let thread = activeThread else {
            await startNewThread(initialMessage: trimmed)
            return
        }
        guard let api = appState.api else { return }

        errorText = nil
        draftMessage = ""

        // Optimistisk: legg til user-msg lokalt
        let userMsg = AgentMessage(
            id: "local-\(UUID().uuidString)",
            threadId: thread.id,
            role: "user",
            text: trimmed,
            createdAt: ISO8601DateFormatter().string(from: Date()),
        )
        messages.append(userMsg)
        pendingAssistantText = ""
        pendingToolUses = []
        sending = true

        streamingTask?.cancel()
        let stream = api.streamAgentMessage(
            threadId: thread.id,
            content: trimmed,
        )
        streamingTask = Task { @MainActor in
            do {
                for try await event in stream {
                    if Task.isCancelled { break }
                    switch event {
                    case .start:
                        // Reset i tilfelle av re-try.
                        pendingAssistantText = ""
                    case .delta(let text):
                        pendingAssistantText += text
                    case .toolUse(let id, let name, let inputJSON):
                        pendingToolUses.append(
                            ToolUseRecord(id: id, name: name, inputJSON: inputJSON)
                        )
                    case .done:
                        finalizeAssistant()
                    case .error(let msg):
                        errorText = msg
                        finalizeAssistant()
                    case .unknown:
                        break
                    }
                }
                // Stream-end uten done — flush hva vi har.
                if sending {
                    finalizeAssistant()
                }
            } catch {
                errorText = "Streaming-feil: \(error.localizedDescription)"
                finalizeAssistant()
            }
        }
    }

    @MainActor
    private func finalizeAssistant() {
        guard sending else { return }
        let text = pendingAssistantText
        if !text.isEmpty {
            let asst = AgentMessage(
                id: "local-\(UUID().uuidString)",
                threadId: activeThread?.id ?? "",
                role: "assistant",
                text: text,
                createdAt: ISO8601DateFormatter().string(from: Date()),
            )
            messages.append(asst)
        }
        pendingAssistantText = ""
        pendingToolUses = []
        sending = false
        streamingTask = nil
    }

    @MainActor
    private func retryLast() async {
        // Finn siste user-msg og send den igjen.
        guard let lastUser = messages.last(where: { $0.role == "user" }) else { return }
        errorText = nil
        draftMessage = lastUser.text
        // Drop duplikat siden sendDraft inserter ny.
        messages.removeAll(where: { $0.id == lastUser.id })
        await sendDraft()
    }
}

// MARK: - Bubbles

@MainActor
private struct MessageBubble: View {
    let message: AgentMessage

    private var isUser: Bool { message.role == "user" }
    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if !isUser {
                Image(systemName: "sparkles")
                    .font(.callout)
                    .foregroundStyle(Self.brandPurple)
                    .frame(width: 28, height: 28)
                    .background(Self.brandPurple.opacity(0.15), in: Circle())
            } else {
                Spacer()
            }
            VStack(alignment: isUser ? .trailing : .leading, spacing: 2) {
                Text(message.text)
                    .font(.body)
                    .textSelection(.enabled)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(
                        isUser
                            ? Self.brandPurple
                            : Color(.secondarySystemBackground),
                        in: RoundedRectangle(cornerRadius: 14)
                    )
                    .foregroundStyle(isUser ? .white : .primary)
                    .frame(maxWidth: 520, alignment: isUser ? .trailing : .leading)
            }
            if isUser {
                Image(systemName: "person.fill")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .frame(width: 28, height: 28)
                    .background(Color.secondary.opacity(0.15), in: Circle())
            } else {
                Spacer()
            }
        }
    }
}

@MainActor
private struct StreamingAssistantBubble: View {
    let text: String
    let toolUses: [LeadgridAgentChatView.ToolUseRecord]

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "sparkles")
                .font(.callout)
                .foregroundStyle(Self.brandPurple)
                .frame(width: 28, height: 28)
                .background(Self.brandPurple.opacity(0.15), in: Circle())

            VStack(alignment: .leading, spacing: 6) {
                if !text.isEmpty {
                    Text(text)
                        .font(.body)
                        .textSelection(.enabled)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .background(Color(.secondarySystemBackground),
                                     in: RoundedRectangle(cornerRadius: 14))
                        .frame(maxWidth: 520, alignment: .leading)
                } else {
                    // Typing-indicator når tekst ikke har begynt å streame
                    HStack(spacing: 4) {
                        ForEach(0..<3, id: \.self) { i in
                            Circle()
                                .frame(width: 6, height: 6)
                                .foregroundStyle(Self.brandPurple.opacity(0.5))
                                .scaleEffect(typingScale(i))
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color(.secondarySystemBackground),
                                 in: RoundedRectangle(cornerRadius: 14))
                }
                ForEach(toolUses) { tool in
                    toolUseCard(tool)
                }
            }
            Spacer()
        }
    }

    @ViewBuilder
    private func toolUseCard(_ tool: LeadgridAgentChatView.ToolUseRecord) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "wrench.and.screwdriver.fill")
                    .font(.caption)
                    .foregroundStyle(.orange)
                Text("Agenten foreslår: \(tool.name)")
                    .font(.caption.bold())
                Spacer()
            }
            if !tool.inputJSON.isEmpty && tool.inputJSON != "{}" {
                Text(tool.inputJSON)
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(6)
            }
        }
        .padding(8)
        .background(Color.orange.opacity(0.10),
                     in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.orange.opacity(0.30), lineWidth: 0.5)
        )
    }

    @State private var typingPhase: CGFloat = 0
    private func typingScale(_ i: Int) -> CGFloat {
        let base: CGFloat = 0.7
        let amp: CGFloat = 0.6
        return base + amp * abs(sin((typingPhase + CGFloat(i) * 0.3) * .pi))
    }
}

@MainActor
private struct ErrorRow: View {
    let text: String
    let onRetry: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            VStack(alignment: .leading, spacing: 2) {
                Text("Noe gikk galt")
                    .font(.caption.bold())
                Text(text)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Prøv igjen") { onRetry() }
                .font(.caption.bold())
                .buttonStyle(.bordered)
                .controlSize(.small)
        }
        .padding(10)
        .background(Color.red.opacity(0.08),
                     in: RoundedRectangle(cornerRadius: 10))
    }
}
