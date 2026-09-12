// WatchQuickNoteView.swift
//
// «Hurtignotat» på Apple Watch: diktér et kort besøksnotat rett fra
// håndleddet etter et møte, og få Apple Intelligence-analysen tilbake
// (ryddet tekst + oppgaver + stemning). Analysen kjøres på iPhone (den
// delte TranscriptIntelligence — on-device eller backend); klokka er en
// tynn klient til watchOS 27 gir Foundation Models lokalt.

import SwiftUI

struct WatchQuickNoteView: View {
    @EnvironmentObject private var session: PhoneSession
    @ObservedObject private var store = WatchTranscriptStore.shared

    @State private var text = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("Hurtignotat")
                    .font(.headline)

                // watchOS presenterer diktering/scribble automatisk i TextField.
                TextField("Diktér notat…", text: $text, axis: .vertical)
                    .lineLimit(1...4)
                    .textFieldStyle(.plain)

                Button {
                    let leadId = session.leads.first?.id   // valgfritt lead-anker
                    session.requestTranscriptAnalysis(text: text, leadId: leadId)
                } label: {
                    HStack {
                        Image(systemName: "sparkles")
                        Text("Analyser")
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isAnalyzing)

                if store.isAnalyzing {
                    HStack(spacing: 6) {
                        ProgressView()
                        Text("Analyserer på iPhone…")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                if let result = store.result {
                    resultView(result)
                }
            }
            .padding(.horizontal, 4)
        }
    }

    @ViewBuilder
    private func resultView(_ r: WatchTranscriptResult) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()

            HStack(spacing: 6) {
                Circle()
                    .fill(sentimentColor(r.sentiment))
                    .frame(width: 8, height: 8)
                Text(r.sentiment.capitalized)
                    .font(.caption2)
                Spacer()
                Text(r.source == "onDevice" ? "på enheten" : "sky")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }

            if !r.resolvedText.isEmpty {
                Text(r.resolvedText)
                    .font(.caption2)
                    .foregroundStyle(.primary)
            }

            if !r.actionItems.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(r.actionItems, id: \.self) { item in
                        Label(item, systemImage: "checkmark.circle")
                            .font(.system(size: 11))
                    }
                }
            }

            if let follow = r.followUpDate {
                Label(follow, systemImage: "calendar.badge.clock")
                    .font(.system(size: 11))
                    .foregroundStyle(.orange)
            }
        }
    }

    private func sentimentColor(_ sentiment: String) -> Color {
        switch sentiment.lowercased() {
        case "positiv": return .green
        case "negativ": return .red
        default: return .gray
        }
    }
}
