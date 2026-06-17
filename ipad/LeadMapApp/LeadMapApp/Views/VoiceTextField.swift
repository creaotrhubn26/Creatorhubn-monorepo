// VoiceTextField.swift
//
// TextField med dikterings-knapp som bruker SFSpeechRecognizer for
// trykk-og-snakk transkripsjon. Speech-text appendes til eksisterende
// tekst (ikke overskriver).

import SwiftUI

struct VoiceTextField: View {
    let title: String
    @Binding var text: String
    let lineLimit: ClosedRange<Int>

    @StateObject private var transcriber = VoiceTranscriber()
    @State private var error: String?
    @State private var preRecordingText: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top) {
                TextField(title, text: $text, axis: .vertical)
                    .lineLimit(lineLimit)
                Button {
                    Task { await toggle() }
                } label: {
                    Image(systemName: transcriber.isRecording ? "mic.fill" : "mic")
                        .foregroundStyle(transcriber.isRecording ? .red : .accentColor)
                        .frame(width: 36, height: 36)
                        .background(
                            Circle().fill(
                                transcriber.isRecording
                                    ? Color.red.opacity(0.15)
                                    : Color.accentColor.opacity(0.10),
                            )
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(transcriber.isRecording
                    ? "Stopp diktering" : "Start diktering")
            }
            if transcriber.isRecording {
                HStack(spacing: 6) {
                    Circle().fill(.red).frame(width: 6, height: 6)
                        .modifier(PulseModifier())
                    Text("Lytter… snakk nå")
                        .font(.caption2)
                        .foregroundStyle(.red)
                }
            }
            if let err = error {
                Text(err).font(.caption2).foregroundStyle(.red)
            }
        }
    }

    @MainActor
    private func toggle() async {
        if transcriber.isRecording {
            transcriber.stop()
        } else {
            do {
                try await transcriber.requestPermissions()
                preRecordingText = text
                try transcriber.start { partial in
                    Task { @MainActor in
                        let separator = preRecordingText.isEmpty ? "" : " "
                        text = preRecordingText + separator + partial
                    }
                }
                error = nil
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

private struct PulseModifier: ViewModifier {
    @State private var pulse = false
    func body(content: Content) -> some View {
        content
            .scaleEffect(pulse ? 1.4 : 1.0)
            .opacity(pulse ? 0.3 : 1.0)
            .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)
            .onAppear { pulse = true }
    }
}
