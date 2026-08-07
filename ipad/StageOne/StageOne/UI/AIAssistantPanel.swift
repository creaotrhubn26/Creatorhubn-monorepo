import SwiftUI

/// AI-assistent-panelet i Studio: tekstinstruks → scene-patch (én undo).
struct AIAssistantPanel: View {
    let document: SceneDocument
    let sync: CloudSync

    struct Entry: Identifiable {
        let id = UUID()
        let instruction: String
        let summary: String
        let failed: Bool
    }

    @State private var input = ""
    @State private var busy = false
    @State private var entries: [Entry] = []
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.accent)
                Text("AI Assistant")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.fg)
                Spacer()
                if busy { ProgressView().scaleEffect(0.6) }
            }

            if !sync.isSignedIn {
                Text("Logg inn (konto-knappen øverst) for å bruke assistenten.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
            } else {
                if !entries.isEmpty {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(entries.suffix(4)) { entry in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(entry.instruction)
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundStyle(Theme.muted)
                                    Text(entry.summary)
                                        .font(.system(size: 11))
                                        .foregroundStyle(entry.failed ? .red : Theme.fg)
                                }
                            }
                        }
                    }
                    .frame(maxHeight: 110)
                }

                HStack(spacing: 6) {
                    TextField("F.eks. «dim key light til 40%»", text: $input)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.fg)
                        .focused($focused)
                        .onSubmit(send)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 7)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Theme.raise))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: Theme.hairline))
                    Button(action: send) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(busy || input.trimmingCharacters(in: .whitespaces).isEmpty
                                             ? Theme.muted : Theme.accent)
                    }
                    .buttonStyle(.plain)
                    .disabled(busy || input.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .padding(12)
        .frame(width: 320)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface.opacity(0.95)))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: Theme.hairline))
    }

    private func send() {
        let instruction = input.trimmingCharacters(in: .whitespaces)
        guard !instruction.isEmpty, !busy else { return }
        busy = true
        input = ""
        Task {
            do {
                let patch = try await sync.runAssistant(scene: document.data, instruction: instruction)
                if !patch.isEmpty {
                    document.mutate { ScenePatcher.apply(patch, to: &$0) }
                }
                entries.append(Entry(instruction: instruction, summary: patch.summary, failed: false))
            } catch {
                let message = (error as? LocalizedError)?.errorDescription ?? "Noe gikk galt."
                entries.append(Entry(instruction: instruction, summary: message, failed: true))
            }
            busy = false
        }
    }
}
