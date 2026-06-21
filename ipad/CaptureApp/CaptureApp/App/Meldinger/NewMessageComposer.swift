import SwiftUI

/// "Ny melding" — channel-aware compose-new. Internal chat starts a fresh
/// conversation (the backend's `ensureChannelExists` creates the channel from
/// the recipient key on first send); e-post sends a brand-new Gmail message via
/// `/api/communication/email/send`. Google Chat / Evendi don't support
/// photographer-initiated new threads, so the composer is only offered for
/// intern + e-post.
struct NewMessageComposer: View {
    let channel: MeldingerView.Channel
    var onSent: () -> Void = {}

    @Environment(\.dismiss) private var dismiss
    @State private var recipient = ""   // internal: name · email: to-address
    @State private var subject = ""
    @State private var messageBody = ""
    @State private var sending = false
    @State private var errorMessage: String?

    private var isEmail: Bool { channel == .gmail }

    private var canSend: Bool {
        !recipient.trimmingCharacters(in: .whitespaces).isEmpty
            && !messageBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (!isEmail || !subject.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(isEmail ? "Til" : "Mottaker") {
                    TextField(isEmail ? "navn@example.com" : "Klientnavn", text: $recipient)
                        .textInputAutocapitalization(isEmail ? .never : .words)
                        .keyboardType(isEmail ? .emailAddress : .default)
                        .listRowBackground(CHTheme.surface)
                }
                if isEmail {
                    Section("Emne") {
                        TextField("Emne", text: $subject).listRowBackground(CHTheme.surface)
                    }
                }
                Section("Melding") {
                    TextField("Skriv melding…", text: $messageBody, axis: .vertical)
                        .lineLimit(4...10)
                        .listRowBackground(CHTheme.surface)
                }
                if let errorMessage {
                    Text(errorMessage).font(.caption).foregroundStyle(CHTheme.danger)
                        .listRowBackground(CHTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle(isEmail ? "Ny e-post" : "Ny samtale")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(sending ? "Sender…" : "Send") { Task { await send() } }
                        .disabled(!canSend || sending)
                }
            }
        }
        .chBranded()
    }

    private func send() async {
        guard let client = DashboardClient.make() else { errorMessage = "Ikke logget inn"; return }
        sending = true; defer { sending = false }
        do {
            if isEmail {
                try await client.sendEmail(to: recipient, subject: subject, message: messageBody)
            } else {
                // New internal conversation — key the channel off the recipient
                // name; the backend creates it on first send.
                let channelId = "klient-" + recipient.lowercased()
                    .replacingOccurrences(of: " ", with: "-")
                    .filter { $0.isLetter || $0.isNumber || $0 == "-" }
                try await client.sendMessage(channelId: channelId, text: messageBody)
            }
            onSent()
            dismiss()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }
}
