import SwiftUI

/// Konto-sheet: pairing-kode-innlogging / innlogget-tilstand m/ synk-handlinger.
struct AccountSheet: View {
    let document: SceneDocument
    let sync: CloudSync
    @Environment(\.dismiss) private var dismiss

    @State private var code = ""
    @State private var busy = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text(sync.isSignedIn ? "Konto" : "Logg inn")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.fg)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(Theme.raise))
                }
                .buttonStyle(.plain)
            }

            if sync.isSignedIn {
                signedInContent
            } else {
                signInContent
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12))
                    .foregroundStyle(.red)
            }
            Spacer()
        }
        .padding(22)
        .frame(width: 420, height: 380)
        .background(Theme.surface)
        .presentationDetents([.medium])
    }

    private var signInContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Skriv inn 8-tegns pairing-koden fra Role Room-web (samme som Leadgrid-iPad-pairing).")
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted)
            TextField("XXXX-XXXX", text: $code)
                .font(Theme.mono(20))
                .foregroundStyle(Theme.fg)
                .multilineTextAlignment(.center)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 10).fill(Theme.raise))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: Theme.hairline))
            Button {
                Task { await doSignIn() }
            } label: {
                Text(busy ? "Logger inn…" : "Logg inn")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.fg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Theme.accent.opacity(busy ? 0.15 : 0.35)))
            }
            .buttonStyle(.plain)
            .disabled(busy || code.count < 8)
        }
    }

    private var signedInContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "person.crop.circle.badge.checkmark")
                    .font(.system(size: 22))
                    .foregroundStyle(Theme.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text(sync.email ?? "Innlogget")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.fg)
                    Text(syncStatusText)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.muted)
                }
            }
            HStack(spacing: 8) {
                actionButton("Lagre til sky nå", icon: "icloud.and.arrow.up") {
                    await sync.push(scene: document.data)
                }
                actionButton("Hent fra sky", icon: "icloud.and.arrow.down") {
                    if let remote = await sync.pullIfNewer(localSavedAt: nil) {
                        document.mutate { $0 = remote }
                    }
                }
            }
            Button("Logg ut") {
                sync.signOut()
            }
            .font(.system(size: 13))
            .foregroundStyle(.red.opacity(0.85))
            .padding(.top, 8)
        }
    }

    private var syncStatusText: String {
        switch sync.status {
        case .syncing: return "Synkroniserer…"
        case .error(let message): return message
        case .idle:
            if let last = sync.lastSync {
                return "Sist synket \(last.formatted(date: .omitted, time: .standard))"
            }
            return "Klar til synk"
        case .signedOut: return ""
        }
    }

    private func actionButton(_ label: String, icon: String,
                              action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            Label(label, systemImage: icon)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.fg)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(RoundedRectangle(cornerRadius: 9).fill(Theme.raise))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(Theme.border, lineWidth: Theme.hairline))
        }
        .buttonStyle(.plain)
        .disabled(sync.status == .syncing)
    }

    private func doSignIn() async {
        busy = true
        errorMessage = nil
        do {
            try await sync.signIn(shortCode: code)
            // pull etter innlogging: sky-scene nyere enn lokal fil?
            if let remote = await sync.pullIfNewer(localSavedAt: RootView.localSceneSavedAt()) {
                document.mutate { $0 = remote }
            } else {
                await sync.push(scene: document.data)
            }
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Innlogging feilet."
        }
        busy = false
    }
}
