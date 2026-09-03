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
    @State private var pendingToolUses: [AgentToolUse] = []
    @State private var draftMessage: String = ""
    @State private var sending: Bool = false
    @State private var streamingTask: Task<Void, Never>?
    @State private var errorText: String?
    @State private var showThreadList = false
    @State private var renamingThread: AgentThread?
    @State private var renameTitle: String = ""
    @State private var consentState: ConsentState = .checking
    @State private var selectedTool: AgentToolUse?
    @State private var executingToolID: String?
    @State private var toolResults: [String: LeadgridAgentSkillResult] = [:]

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    private enum ConsentState: Equatable {
        case checking
        case required
        case granted
        case failed(String)
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
            } else if consentState == .checking {
                Spacer()
                ProgressView("Kontrollerer AI-samtykke …")
                    .controlSize(.large)
                    .tint(Self.brandPurple)
                Spacer()
            } else if consentState != .granted {
                consentView
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
        .task(id: resolvedProjectId) { await prepareAgent() }
        .sheet(isPresented: $showThreadList) {
            threadListSheet
        }
        .sheet(item: $renamingThread) { thread in
            renameSheet(for: thread)
        }
        .sheet(item: $selectedTool) { tool in
            AgentSkillConfirmationSheet(
                tool: tool,
                leadName: leadName(in: tool),
                isExecuting: executingToolID == tool.id,
                onCancel: { selectedTool = nil },
                onConfirm: { Task { await execute(tool) } }
            )
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
            .disabled(consentState != .granted)

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
            .disabled(consentState != .granted)
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
                .font(.appScaled(size: 48))
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
                .font(.appScaled(size: 56))
                .foregroundStyle(Self.brandPurple)
            Text("Start samtalen")
                .font(.title3.bold())
            Text("Spør Agenten om leads i det aktive prosjektet. Alle forslag "
                 + "må bekreftes før Leadgrid gjør noe.")
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
        "Sjekk datakvaliteten i prosjektet",
        "Hvilke leads bør jeg følge opp i dag?",
        "Synkroniser ventende offline-handlinger",
    ]

    @ViewBuilder
    private var consentView: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "hand.raised.fill")
                .font(.appScaled(size: 48))
                .foregroundStyle(Self.brandPurple)
            Text("Samtykke før Agenten brukes")
                .font(.title3.bold())
            Text("Agenten sender meldingen din og pseudonymiserte lead-navn, status og "
                 + "oppfølgingsmetadata til Anthropic. Telefonnumre og e-postadresser "
                 + "sendes ikke. Du kan trekke samtykket tilbake i prosjektets AI-innstillinger.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 520)
            if case .failed(let message) = consentState {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
            Button {
                Task { await grantConsent() }
            } label: {
                Label("Jeg samtykker og vil aktivere Agenten", systemImage: "checkmark.shield.fill")
                    .font(.headline)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .tint(Self.brandPurple)
            .accessibilityIdentifier("agent-consent-confirm")
            Spacer()
        }
        .padding(24)
    }

    // MARK: - Chat body

    @ViewBuilder
    private var chatBody: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(messages) { msg in
                        MessageBubble(
                            message: msg,
                            toolResults: toolResults,
                            executingToolID: executingToolID,
                            onToolTap: { tool in
                                guard toolResults[tool.id] == nil,
                                      executingToolID == nil else { return }
                                selectedTool = tool
                            }
                        )
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
                            .font(.appScaled(size: 32))
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
    private func prepareAgent() async {
        streamingTask?.cancel()
        activeThread = nil
        messages = []
        threads = []
        toolResults = [:]
        errorText = nil
        #if DEBUG
        if ProcessInfo.processInfo.environment["QA_TOUR"] == "agent-skills" {
            let thread = AgentThread(
                id: "qa-agent-thread",
                projectId: "qa-agent-project",
                userId: "qa-user",
                title: "Agent QA",
                createdAt: "2026-09-03T10:00:00Z",
                lastActiveAt: "2026-09-03T10:00:00Z",
                archivedAt: nil
            )
            let proposal = AgentToolUse(
                id: "qa-agent-data-quality",
                name: LeadgridAgentSkill.dataQuality.rawValue,
                inputJSON: #"{"limit":25}"#
            )
            threads = [thread]
            activeThread = thread
            messages = [
                AgentMessage(
                    id: "qa-agent-message",
                    threadId: thread.id,
                    role: "assistant",
                    text: "Jeg foreslår en lokal datakvalitetskontroll.",
                    response: AgentMessageResponse(toolUses: [proposal]),
                    createdAt: "2026-09-03T10:00:00Z"
                ),
            ]
            consentState = .granted
            loadingThreads = false
            return
        }
        #endif
        guard let api = appState.api, let projectId = resolvedProjectId else {
            loadingThreads = false
            consentState = .required
            return
        }
        consentState = .checking
        loadingThreads = true
        do {
            let consent = try await api.fetchAgentAIConsent(projectId: projectId)
            guard consent?.scope == "full_context", consent?.revokedAt == nil else {
                consentState = .required
                loadingThreads = false
                return
            }
            consentState = .granted
            await loadThreads()
        } catch {
            consentState = .failed("Kunne ikke kontrollere samtykket: \(error.localizedDescription)")
            loadingThreads = false
        }
    }

    @MainActor
    private func grantConsent() async {
        guard let api = appState.api, let projectId = resolvedProjectId else { return }
        consentState = .checking
        do {
            _ = try await api.grantAgentAIConsent(projectId: projectId)
            consentState = .granted
            await loadThreads()
        } catch {
            consentState = .failed("Samtykket kunne ikke lagres: \(error.localizedDescription)")
        }
    }

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
        let stream = await api.streamAgentMessage(
            threadId: thread.id,
            content: trimmed,
            requiredScope: "full_context",
            organizationId: appState.activeOrganizationId,
            leads: agentLeadContext,
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
                            AgentToolUse(id: id, name: name, inputJSON: inputJSON)
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
        if !text.isEmpty || !pendingToolUses.isEmpty {
            let asst = AgentMessage(
                id: "local-\(UUID().uuidString)",
                threadId: activeThread?.id ?? "",
                role: "assistant",
                text: text,
                response: AgentMessageResponse(toolUses: pendingToolUses),
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

    private var agentLeadContext: [AgentLeadContext] {
        let formatter = ISO8601DateFormatter()
        return appState.leads.prefix(100).map { lead in
            AgentLeadContext(
                id: lead.id,
                name: lead.name,
                status: lead.status.rawValue,
                hasPhone: lead.phone?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false,
                hasEmail: lead.email?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false,
                hasWebsite: lead.websiteUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false,
                nextFollowUpAt: lead.nextFollowUpAt.map(formatter.string(from:)),
                lastVisitAt: lead.lastVisitAt.map(formatter.string(from:))
            )
        }
    }

    private func leadName(in tool: AgentToolUse) -> String? {
        guard let object = try? JSONSerialization.jsonObject(with: Data(tool.inputJSON.utf8)) as? [String: Any],
              let leadId = object["lead_id"] as? String else { return nil }
        return appState.leads.first(where: { $0.id == leadId })?.name
    }

    @MainActor
    private func execute(_ tool: AgentToolUse) async {
        #if DEBUG
        if ProcessInfo.processInfo.environment["QA_TOUR"] == "agent-skills" {
            executingToolID = tool.id
            await Task.yield()
            toolResults[tool.id] = .init(
                state: .completed,
                title: "Datakvalitet kontrollert",
                detail: "QA-verifisering fullført uten endringer."
            )
            executingToolID = nil
            selectedTool = nil
            return
        }
        #endif
        guard toolResults[tool.id] == nil,
              executingToolID == nil,
              let api = appState.api,
              let organizationId = appState.activeOrganizationId,
              let projectId = resolvedProjectId else { return }
        let skill = LeadgridAgentSkill(rawValue: tool.name)
        if skill?.isWrite == true,
           LeadgridAgentExecutionStore.contains(organizationId: organizationId, toolID: tool.id) {
            toolResults[tool.id] = .init(
                state: .completed,
                title: "Allerede utført",
                detail: "Denne agenthandlingen er allerede behandlet på denne iPaden."
            )
            selectedTool = nil
            return
        }
        executingToolID = tool.id
        let result = await LeadgridAgentSkillExecutor(
            api: api,
            organizationId: organizationId,
            projectId: projectId,
            leads: appState.leads
        ).execute(tool)
        toolResults[tool.id] = result
        executingToolID = nil
        selectedTool = nil
        if skill?.isWrite == true, result.state == .completed || result.state == .queued {
            LeadgridAgentExecutionStore.markExecuted(
                organizationId: organizationId,
                toolID: tool.id
            )
        }
        if result.state == .completed, skill?.isWrite == true,
           skill != .syncOfflineActions {
            await appState.refreshAll()
        }
    }
}

// MARK: - Bubbles

@MainActor
private struct MessageBubble: View {
    let message: AgentMessage
    let toolResults: [String: LeadgridAgentSkillResult]
    let executingToolID: String?
    let onToolTap: (AgentToolUse) -> Void

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
                if !message.text.isEmpty {
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
                if !isUser {
                    ForEach(message.response?.toolUses ?? []) { tool in
                        AgentToolActionCard(
                            tool: tool,
                            result: toolResults[tool.id],
                            isExecuting: executingToolID == tool.id,
                            enabled: toolResults[tool.id] == nil && executingToolID == nil,
                            onTap: { onToolTap(tool) }
                        )
                    }
                }
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
    let toolUses: [AgentToolUse]

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
                    AgentToolActionCard(
                        tool: tool,
                        result: nil,
                        isExecuting: false,
                        enabled: false,
                        onTap: {}
                    )
                }
            }
            Spacer()
        }
    }

    @State private var typingPhase: CGFloat = 0
    private func typingScale(_ i: Int) -> CGFloat {
        let base: CGFloat = 0.7
        let amp: CGFloat = 0.6
        return base + amp * abs(sin((typingPhase + CGFloat(i) * 0.3) * .pi))
    }
}

@MainActor
private struct AgentToolActionCard: View {
    let tool: AgentToolUse
    let result: LeadgridAgentSkillResult?
    let isExecuting: Bool
    let enabled: Bool
    let onTap: () -> Void

    private var skill: LeadgridAgentSkill? { LeadgridAgentSkill(rawValue: tool.name) }

    private var tint: Color {
        guard let result else { return .orange }
        switch result.state {
        case .completed: return .green
        case .queued: return .blue
        case .failed: return .red
        }
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 7) {
                    if isExecuting {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: result == nil ? "sparkles" : statusIcon)
                            .foregroundStyle(tint)
                    }
                    Text(result?.title ?? skill?.title ?? "Ukjent agenthandling")
                        .font(.caption.bold())
                    Spacer()
                    if result == nil {
                        Text(skill?.isWrite == true ? "Krever bekreftelse" : "Kjør analyse")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(tint)
                        Image(systemName: "chevron.right")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
                if let result {
                    Text(result.detail)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                } else if skill == nil {
                    Text("Oppdater appen før dette forslaget kan brukes.")
                        .font(.caption2)
                        .foregroundStyle(.red)
                }
            }
            .padding(10)
            .frame(maxWidth: 520, alignment: .leading)
            .background(tint.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(tint.opacity(0.35), lineWidth: 0.7)
            )
        }
        .buttonStyle(.plain)
        .disabled(!enabled || skill == nil)
        .accessibilityIdentifier("agent-skill-\(tool.name)")
    }

    private var statusIcon: String {
        switch result?.state {
        case .completed: return "checkmark.circle.fill"
        case .queued: return "tray.and.arrow.down.fill"
        case .failed: return "exclamationmark.triangle.fill"
        case nil: return "sparkles"
        }
    }
}

@MainActor
private struct AgentSkillConfirmationSheet: View {
    let tool: AgentToolUse
    let leadName: String?
    let isExecuting: Bool
    let onCancel: () -> Void
    let onConfirm: () -> Void

    private var skill: LeadgridAgentSkill? { LeadgridAgentSkill(rawValue: tool.name) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Forslag") {
                    LabeledContent("Handling", value: skill?.title ?? tool.name)
                    if let leadName { LabeledContent("Lead", value: leadName) }
                    LabeledContent(
                        "Type",
                        value: skill?.isWrite == true ? "Kan endre Leadgrid" : "Kun analyse"
                    )
                }
                Section("Hva skjer") {
                    Text(skill?.isWrite == true
                         ? "Handlingen kjøres først etter at du trykker Bekreft. Ved nettverksbrudd lagres støttede skrivehandlinger i den tenant-avgrensede offline-køen."
                         : "Analysen leser bare dataene i det aktive prosjektet og gjør ingen endringer.")
                        .font(.callout)
                }
                Section("Detaljer fra Agenten") {
                    Text(tool.inputJSON)
                        .font(.caption.monospaced())
                        .textSelection(.enabled)
                }
            }
            .navigationTitle("Bekreft agenthandling")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt", action: onCancel).disabled(isExecuting)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Bekreft", action: onConfirm)
                        .fontWeight(.semibold)
                        .disabled(isExecuting || skill == nil)
                        .accessibilityIdentifier("agent-skill-confirm")
                }
            }
        }
        .interactiveDismissDisabled(isExecuting)
        .presentationDetents([.medium, .large])
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
