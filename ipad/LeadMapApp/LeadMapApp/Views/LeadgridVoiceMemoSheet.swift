// LeadgridVoiceMemoSheet.swift
//
// Native iPad voice-memo recorder for Leadgrid leads. Selger trykker «Voice memo»
// fra IntelligencePanel/FollowUpQueue etter besøk → spiller inn samtale →
// upload til backend (Whisper) → Claude ekstraherer action items, beslutninger,
// neste steg, temaer → vises tilbake i sheet'et.
//
// State-flyt: idle → recording → uploading → processing (polling 3s × max 30) → done/failed

import SwiftUI

struct LeadgridVoiceMemoSheet: View {
    let api: APIClient
    let leadId: String
    let leadName: String
    @Environment(\.dismiss) private var dismiss

    @State private var recorder = AudioRecorder()
    @State private var phase: Phase = .idle
    @State private var meetingNoteId: String?
    @State private var note: MeetingNote?
    @State private var errorText: String?
    @State private var pollTask: Task<Void, Never>?

    enum Phase {
        case idle
        case recording
        case uploading
        case processing
        case done
        case failed
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text(leadName).font(.headline)

                switch phase {
                case .idle:       idleView
                case .recording:  recordingView
                case .uploading:  uploadingView
                case .processing: processingView
                case .done:       doneView
                case .failed:     failedView
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Voice memo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") {
                        recorder.cancelRecording()
                        pollTask?.cancel()
                        dismiss()
                    }
                }
            }
        }
    }

    // MARK: - Phase views

    @ViewBuilder
    private var idleView: some View {
        Image(systemName: "mic.circle.fill")
            .font(.system(size: 100))
            .foregroundStyle(.purple)
        Text("Trykk for å spille inn samtalen.\nClaude lager action items automatisk.")
            .multilineTextAlignment(.center)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        Button {
            Task { await startRecording() }
        } label: {
            Label("Start opptak", systemImage: "record.circle")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .buttonStyle(.borderedProminent)
        .tint(.red)
        if let errorText {
            Text(errorText).foregroundStyle(.red).font(.caption)
        }
    }

    @ViewBuilder
    private var recordingView: some View {
        Image(systemName: "waveform.circle.fill")
            .font(.system(size: 100))
            .foregroundStyle(.red)
            .symbolEffect(.pulse, options: .repeating)
        Text(formatDuration(recorder.currentDuration))
            .font(.system(size: 48, weight: .bold).monospacedDigit())
        HStack(spacing: 14) {
            Button {
                recorder.cancelRecording()
                phase = .idle
            } label: {
                Label("Avbryt", systemImage: "xmark")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.bordered)

            Button {
                Task { await stopAndUpload() }
            } label: {
                Label("Stopp + analyser", systemImage: "stop.circle.fill")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
        }
    }

    @ViewBuilder
    private var uploadingView: some View {
        Image(systemName: "icloud.and.arrow.up")
            .font(.system(size: 80))
            .foregroundStyle(.blue)
        Text("Laster opp...").font(.headline)
        ProgressView()
    }

    @ViewBuilder
    private var processingView: some View {
        Image(systemName: "sparkles")
            .font(.system(size: 80))
            .foregroundStyle(.purple)
            .symbolEffect(.variableColor, options: .repeating)
        Text("Claude analyserer...").font(.headline)
        Text("Whisper transkriberer lyden og Claude lager action items.")
            .font(.caption)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        ProgressView()
    }

    @ViewBuilder
    private var doneView: some View {
        if let n = note {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let summary = n.summary, !summary.isEmpty {
                        section(title: "Sammendrag", systemImage: "doc.text") {
                            Text(summary).font(.subheadline)
                        }
                    }
                    if let items = n.actionItems, !items.isEmpty {
                        section(title: "Action items", systemImage: "checklist") {
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(items, id: \.title) { item in
                                    HStack(spacing: 8) {
                                        Image(systemName: priorityIcon(item.priority))
                                            .foregroundStyle(priorityColor(item.priority))
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(item.title).font(.subheadline)
                                            if let due = item.dueDate {
                                                Text("Frist: \(due)").font(.caption).foregroundStyle(.secondary)
                                            }
                                            if let assignee = item.assignee {
                                                Text("Ansvarlig: \(assignee)").font(.caption2).foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if let decisions = n.decisions, !decisions.isEmpty {
                        section(title: "Beslutninger", systemImage: "checkmark.seal") {
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(decisions, id: \.decision) { d in
                                    HStack(alignment: .top, spacing: 6) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.green)
                                            .font(.caption)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(d.decision).font(.subheadline)
                                            if let owner = d.owner {
                                                Text("Eier: \(owner)").font(.caption2).foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if let steps = n.nextSteps, !steps.isEmpty {
                        section(title: "Neste steg", systemImage: "arrow.forward") {
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(steps, id: \.step) { step in
                                    HStack(alignment: .top, spacing: 6) {
                                        Image(systemName: "arrow.right.circle")
                                            .foregroundStyle(.blue)
                                            .font(.caption)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(step.step).font(.subheadline)
                                            if let deadline = step.deadline {
                                                Text("Frist: \(deadline)").font(.caption2).foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if let topics = n.topics, !topics.isEmpty {
                        section(title: "Temaer", systemImage: "bubble.left.and.bubble.right") {
                            FlowLayout(spacing: 6) {
                                ForEach(topics, id: \.topic) { topic in
                                    Text(topic.topic)
                                        .font(.caption)
                                        .padding(.horizontal, 8).padding(.vertical, 4)
                                        .background(sentimentColor(topic.sentiment).opacity(0.2), in: Capsule())
                                        .foregroundStyle(sentimentColor(topic.sentiment))
                                }
                            }
                        }
                    }
                    if let transcript = n.transcript, !transcript.isEmpty {
                        section(title: "Transkripsjon", systemImage: "text.quote") {
                            Text(transcript)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let conf = n.confidence {
                        Text("Konfidens: \(Int(conf * 100))%")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        Button("Ferdig") { dismiss() }
            .buttonStyle(.borderedProminent)
    }

    @ViewBuilder
    private var failedView: some View {
        Image(systemName: "exclamationmark.triangle.fill")
            .font(.system(size: 80))
            .foregroundStyle(.red)
        Text("Noe gikk galt").font(.headline)
        if let err = errorText {
            Text(err).font(.caption).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        Button("Prøv igjen") {
            errorText = nil
            phase = .idle
        }
        .buttonStyle(.borderedProminent)
    }

    // MARK: - Section helper

    @ViewBuilder
    private func section<Content: View>(
        title: String,
        systemImage: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            content()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Formatters

    private func formatDuration(_ s: TimeInterval) -> String {
        let mins = Int(s) / 60
        let secs = Int(s) % 60
        return String(format: "%d:%02d", mins, secs)
    }

    private func priorityIcon(_ p: String?) -> String {
        switch p {
        case "high":   return "exclamationmark.circle.fill"
        case "medium": return "circle.fill"
        default:       return "circle"
        }
    }

    private func priorityColor(_ p: String?) -> Color {
        switch p {
        case "high":   return .red
        case "medium": return .orange
        default:       return .gray
        }
    }

    private func sentimentColor(_ s: String?) -> Color {
        switch s {
        case "positive": return .green
        case "negative": return .red
        default:         return .blue
        }
    }

    // MARK: - Actions

    @MainActor
    private func startRecording() async {
        errorText = nil
        if await recorder.startRecording() {
            phase = .recording
        } else {
            errorText = recorder.errorMessage ?? "Kunne ikke starte opptak"
        }
    }

    @MainActor
    private func stopAndUpload() async {
        guard let (data, duration) = recorder.stopRecording() else {
            errorText = "Opptak feilet"
            phase = .failed
            return
        }
        phase = .uploading
        do {
            let upload = try await api.uploadVoiceMemo(
                leadId: leadId,
                audioData: data,
                durationSeconds: Int(duration)
            )
            meetingNoteId = upload.meetingNoteId
            phase = .processing
            startPolling()
        } catch {
            errorText = "Upload feilet: \(error.localizedDescription)"
            phase = .failed
        }
    }

    private func startPolling() {
        pollTask?.cancel()
        let api = self.api
        let noteId = meetingNoteId
        pollTask = Task { @MainActor in
            guard let noteId else { return }
            var tries = 0
            while !Task.isCancelled && tries < 30 {  // max 90s
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                tries += 1
                do {
                    let n = try await api.fetchMeetingNote(noteId)
                    if n.processingStatus == "completed" {
                        self.note = n
                        self.phase = .done
                        return
                    }
                    if n.processingStatus == "failed" {
                        self.errorText = n.errorMessage ?? "Prosessering feilet"
                        self.phase = .failed
                        return
                    }
                } catch {
                    // Continue polling — transient error
                }
            }
            if phase == .processing {
                self.errorText = "Tar lengre tid enn forventet. Sjekk lead-detalj senere."
                self.phase = .failed
            }
        }
    }
}

// MARK: - FlowLayout (simple tag-wrapping layout)

/// Layout som plasserer subviews fra venstre til høyre og wrapper til ny rad
/// når radlengde overstiger tilgjengelig bredde. Brukes for tag-chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0
        var totalH: CGFloat = 0
        var rowMaxH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > width && x > 0 {
                totalH += rowMaxH + spacing
                rowMaxH = 0
                x = 0
            }
            x += s.width + spacing
            rowMaxH = max(rowMaxH, s.height)
        }
        return CGSize(width: width.isFinite ? width : x, height: totalH + rowMaxH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowMaxH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > bounds.maxX && x > bounds.minX {
                x = bounds.minX
                y += rowMaxH + spacing
                rowMaxH = 0
            }
            v.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += s.width + spacing
            rowMaxH = max(rowMaxH, s.height)
        }
    }
}
