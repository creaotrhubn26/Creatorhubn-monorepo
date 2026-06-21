import SwiftUI

/// "Meldinger" — the unified multi-channel communication hub, native parity
/// with the web UniversalChatWidget. Channel chips at the top switch between
/// the photographer's channels; each channel is gated by ``ChannelAccess``
/// (intern is always on; Gmail/Google Chat require a Google Workspace
/// connection; Evendi requires a vendor profile). A super_admin sees all.
///
/// Each thread carries the shared CRM context panel (Lag 2) + quick-action
/// menu — quick-reply templates and "Opprett Google Meet" (Lag 3).
struct MeldingerView: View {
    enum Channel: String, CaseIterable, Identifiable {
        case intern, gmail, googleChat, evendi
        var id: String { rawValue }
        var label: String {
            switch self {
            case .intern: return "Chat"
            case .gmail: return "E-post"
            case .googleChat: return "Google Chat"
            case .evendi: return "Evendi"
            }
        }
        var icon: String {
            switch self {
            case .intern: return "bubble.left.and.bubble.right"
            case .gmail: return "envelope"
            case .googleChat: return "bubble.left.and.text.bubble.right"
            case .evendi: return "heart.text.square"
            }
        }
        /// CRM provider key used by the context panel.
        var provider: String {
            switch self {
            case .intern: return "internal-chat"
            case .gmail: return "gmail"
            case .googleChat: return "google-chat"
            case .evendi: return "evendi"
            }
        }
    }

    @State private var access = ChannelAccess()
    @State private var selected: Channel = .intern
    @State private var accessLoaded = false

    /// Internal team (the @creatorhubn.com org) sees every channel even when
    /// not connected, so the tab is discoverable; the channel then shows its
    /// own empty/connect state. (StoredSession carries no role, so we gate on
    /// the verified org email.)
    private var isAdmin: Bool {
        let email = SignInService.shared.session?.email.lowercased() ?? ""
        return email.hasSuffix("@creatorhubn.com")
    }

    private var availableChannels: [Channel] {
        Channel.allCases.filter { channel in
            switch channel {
            case .intern: return true
            case .gmail: return isAdmin || access.emailConnected
            case .googleChat: return isAdmin || access.googleChatConnected
            case .evendi: return isAdmin || access.evendiAvailable
            }
        }
    }

    var body: some View {
        // One NavigationStack at the hub so the system places content below the
        // iPad floating top tab-bar (the channel inboxes are plain content that
        // navigate within this stack — they no longer nest their own stacks).
        NavigationStack {
            VStack(spacing: 0) {
                channelChips
                Divider().overlay(CHTheme.border)
                channelBody
            }
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Meldinger")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            guard !accessLoaded else { return }
            await access.refresh()
            accessLoaded = true
        }
    }

    private var channelChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(availableChannels) { channel in
                    let isOn = selected == channel
                    Button { selected = channel } label: {
                        Label(channel.label, systemImage: channel.icon)
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(isOn ? CHTheme.accent.opacity(0.18) : CHTheme.surface, in: Capsule())
                            .foregroundStyle(isOn ? CHTheme.accent : CHTheme.textSecondary)
                            .overlay(Capsule().stroke(isOn ? CHTheme.accent.opacity(0.5) : CHTheme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    @ViewBuilder
    private var channelBody: some View {
        switch selected {
        case .intern: InternalChatInbox()
        case .gmail: GmailInbox()
        case .googleChat: GoogleChatInbox()
        case .evendi: EvendiInbox()
        }
    }
}

// MARK: - Shared thread actions (Lag 2 + 3)

/// Toolbar button that opens the CRM context panel for a conversation.
struct CRMSheetButton: View {
    let conversationId: String
    let provider: String
    var hintName: String?
    @State private var showing = false

    var body: some View {
        Button { showing = true } label: { Image(systemName: "person.crop.circle.badge.questionmark") }
            .sheet(isPresented: $showing) {
                NavigationStack {
                    CRMContextPanel(conversationId: conversationId, provider: provider, hintName: hintName)
                        .navigationTitle("Kunde")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Lukk") { showing = false } } }
                }
                .chBranded()
            }
    }
}

/// Quick-reply templates + "Opprett Google Meet" — fills the compose draft.
struct ChatActionsMenu: View {
    @Binding var draft: String
    var clientName: String?
    @State private var creatingMeet = false

    private static let templates: [String] = [
        "Hei! Takk for meldingen – jeg svarer så fort jeg kan.",
        "Da er vi i gang – gleder meg til shooten! 📸",
        "Bildene er klare for gjennomgang i galleriet ditt.",
        "Sender deg et tilbud i løpet av dagen.",
        "Er på vei – beregner å være der om ca. 15 min.",
        "Tusen takk for i dag, det var en flott shoot!",
    ]

    var body: some View {
        Menu {
            Menu("Hurtigsvar") {
                ForEach(Self.templates, id: \.self) { t in
                    Button(t) { draft = draft.isEmpty ? t : draft + "\n" + t }
                }
            }
            Button {
                Task { await makeMeet() }
            } label: {
                Label(creatingMeet ? "Oppretter Meet…" : "Opprett Google Meet", systemImage: "video")
            }
            .disabled(creatingMeet)
        } label: {
            Image(systemName: "plus.circle")
        }
    }

    private func makeMeet() async {
        guard let client = DashboardClient.make() else { return }
        creatingMeet = true
        defer { creatingMeet = false }
        let title = clientName.map { "Møte med \($0)" } ?? "CreatorHub-møte"
        if let result = try? await client.createMeet(title: title, clientName: clientName),
           let link = result.meetLink {
            let line = "La oss ta en prat på Google Meet: \(link)"
            draft = draft.isEmpty ? line : draft + "\n" + line
        }
    }
}

/// Shared compose bar used by the channel thread views.
struct ComposeBar: View {
    @Binding var draft: String
    let sending: Bool
    var placeholder: String = "Skriv en melding…"
    let onSend: () -> Void

    private var canSend: Bool { !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField(placeholder, text: $draft, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...5)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 20))
                .foregroundStyle(CHTheme.textPrimary)
            Button(action: onSend) {
                Group {
                    if sending { ProgressView().tint(CHTheme.bg) }
                    else { Image(systemName: "arrow.up").font(.headline.weight(.bold)) }
                }
                .frame(width: 38, height: 38)
                .foregroundStyle(CHTheme.bg)
                .background(canSend ? CHTheme.accent : CHTheme.textMuted, in: Circle())
            }
            .disabled(!canSend || sending)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(CHTheme.surface.overlay(CHTheme.border.frame(height: 0.5), alignment: .top).ignoresSafeArea(edges: .bottom))
    }
}

// MARK: - Generic channel scaffolding

/// A simple left/right chat bubble for the channel threads.
struct ChannelBubble: View {
    let text: String
    let sender: String?
    let time: String?
    let fromMe: Bool

    var body: some View {
        HStack {
            if fromMe { Spacer(minLength: 48) }
            VStack(alignment: fromMe ? .trailing : .leading, spacing: 3) {
                if !fromMe, let sender, !sender.isEmpty {
                    Text(sender).font(.caption2.weight(.semibold)).foregroundStyle(CHTheme.textMuted)
                }
                Text(text.isEmpty ? "—" : text)
                    .font(.body)
                    .foregroundStyle(fromMe ? CHTheme.bg : CHTheme.textPrimary)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(fromMe ? CHTheme.accent : CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 16))
                if let time, !time.isEmpty {
                    Text(time).font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
            }
            if !fromMe { Spacer(minLength: 48) }
        }
    }
}

/// Reusable inbox scaffold (loading/error/empty + list) to keep the channel
/// inboxes consistent with Galleri/Meldinger.
struct ChannelInboxScaffold<Row: View>: View {
    let title: String
    let loading: Bool
    let isEmpty: Bool
    let errorMessage: String?
    let emptyText: String
    let onRefresh: () async -> Void
    @ViewBuilder var rows: () -> Row

    var body: some View {
        Group {
            if loading {
                ProgressView("Laster…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage {
                ContentUnavailableView {
                    Label("Kunne ikke laste", systemImage: "exclamationmark.bubble")
                } description: { Text(errorMessage) } actions: {
                    Button("Prøv igjen") { Task { await onRefresh() } }.buttonStyle(.borderedProminent)
                }
            } else if isEmpty {
                ContentUnavailableView(title, systemImage: "bubble.left.and.bubble.right", description: Text(emptyText))
            } else {
                List { rows() }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                    .refreshable { await onRefresh() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
    }
}
