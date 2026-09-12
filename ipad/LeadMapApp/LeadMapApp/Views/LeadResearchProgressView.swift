// LeadResearchProgressView.swift
//
// Live-progress under research-fasen. Poller GET /research/:id hvert
// 2.5 sek og oppdaterer steg-listen. Fasene følger backend:
//
//   pending → claude_scan → geocode_competitors → creating_leads → done
//                                                                 | failed
//
// Når 'done' viser vi "Vis X nye leads"-CTA som dismisser og lar
// MapScreen reload'e leads. Hvis 'failed' viser vi feilmelding + tilbake.

import SwiftUI

struct LeadResearchProgressView: View {
    let researchId: String
    let displayName: String

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var status: LeadResearchStatus?
    @State private var error: String?

    private static let pollInterval: UInt64 = 2_500_000_000 // 2.5 s

    private struct PhaseStep: Identifiable {
        let id: String        // phase-key
        let title: String
        let detail: String?
    }

    private let steps: [PhaseStep] = [
        .init(id: "claude_scan",
              title: "Lytter til markedet",
              detail: "Leadgrid scanner bransjen og finner aktørene som er verdt å plotte."),
        .init(id: "geocode_competitors",
              title: "Setter koordinater",
              detail: "Google Places gir oss adresse, telefon og pin-posisjon."),
        .init(id: "creating_leads",
              title: "Tegner pins på gridden",
              detail: "Hver bedrift blir en pin du kan oppsøke."),
        .init(id: "scout_leads",
              title: "Tråler websitene",
              detail: "Identifiserer behov, mangler og styrker per pin (krever markedstilgang)."),
        .init(id: "done",
              title: "Gridden er klar",
              detail: nil),
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                Divider().padding(.vertical, 8)
                progressList
                Spacer()
                bottomBar
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .navigationTitle("Research")
        .salesHierarchyBackdrop(.research)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if status?.isTerminal == true {
                        Button("Lukk") { dismiss() }
                    } else {
                        Button("Kjør i bakgrunn") { dismiss() }
                    }
                }
            }
            .task { await pollUntilDone() }
        }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(displayName).font(.title3.weight(.semibold))

            // Total progress-bar
            ProgressView(value: totalProgress)
                .tint(progressTint)
                .scaleEffect(x: 1, y: 1.5, anchor: .center)

            // Live status-melding m/ pulserende indicator
            HStack(spacing: 8) {
                if status?.isTerminal == false {
                    PulsingDot().frame(width: 8, height: 8)
                }
                if let s = status, let msg = s.phaseMessage {
                    Text(msg)
                        .font(.callout)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .id(msg)
                        .transition(.opacity)
                } else if status?.isTerminal == false {
                    Text("Varmer opp gridden …")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }

            // Subtle ETA-hint per fase
            if let s = status, !s.isTerminal {
                Text(etaHint(for: s.phase))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(.easeInOut(duration: 0.3), value: status?.phaseMessage)
    }

    private var totalProgress: Double {
        guard let s = status else { return 0.05 }
        if s.phase == "failed" { return 0 }
        // 5 sammenlignbare faser (claude_scan → done); pending = 0.05
        let curIdx = phaseIndex(s.phase)
        return Double(curIdx) / 5.0
    }

    private var progressTint: Color {
        guard let s = status else { return .accentColor }
        if s.phase == "failed" { return .orange }
        if s.phase == "done"   { return .green }
        return .accentColor
    }

    private func etaHint(for phase: String) -> String {
        switch phase {
        case "pending":              return "Strømmer på gridden …"
        case "claude_scan":          return "Leadgrid lytter til markedet — typisk 30–60 sekunder"
        case "geocode_competitors":  return "Setter koordinater for hver pin — ~1–2 sek per stk"
        case "creating_leads":       return "Plotter inn pins på gridden"
        case "scout_leads":          return "Tråler hver site — Leadgrid trenger ~10–20 sek per pin"
        default:                     return "Jobber …"
        }
    }

    private var progressList: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(steps) { step in
                stepRow(step: step)
            }
        }
    }

    private func stepRow(step: PhaseStep) -> some View {
        let state = stateFor(step: step)
        return HStack(alignment: .top, spacing: 14) {
            stateIcon(state)
                .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 4) {
                Text(step.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(state == .pending ? .secondary : .primary)
                if let detail = step.detail, state != .pending {
                    Text(detail).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
    }

    private enum StepState { case pending, active, done, failed }

    /// Pulserende indikator (8×8 lilla prikk) — viser "jeg jobber" i header.
    private struct PulsingDot: View {
        @State private var scale: CGFloat = 1.0
        var body: some View {
            Circle()
                .fill(Color.accentColor)
                .scaleEffect(scale)
                .opacity(2 - scale)
                .onAppear {
                    withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
                        scale = 1.8
                    }
                }
        }
    }

    private func stateFor(step: PhaseStep) -> StepState {
        guard let s = status else { return .pending }
        if s.phase == "failed" {
            // Stegene som rakk å starte er aktive; alt etter blir failed
            return phaseIndex(s.phase) >= phaseIndex(step.id) ? .failed : .done
        }
        let curIdx = phaseIndex(s.phase)
        let stepIdx = phaseIndex(step.id)
        if curIdx > stepIdx { return .done }
        if curIdx == stepIdx { return .active }
        return .pending
    }

    private func phaseIndex(_ phase: String) -> Int {
        switch phase {
        case "pending", "brand_kit":      return 0
        case "claude_scan":               return 1
        case "geocode_competitors":       return 2
        case "creating_leads":            return 3
        case "scout_leads":               return 4
        case "done":                      return 5
        case "failed":                    return -1
        default:                          return 0
        }
    }

    @ViewBuilder
    private func stateIcon(_ state: StepState) -> some View {
        switch state {
        case .pending:
            Image(systemName: "circle")
                .foregroundStyle(.tertiary)
        case .active:
            ProgressView()
        case .done:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .failed:
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.orange)
        }
    }

    @ViewBuilder
    private var bottomBar: some View {
        if let s = status, s.phase == "done" {
            VStack(alignment: .leading, spacing: 8) {
                Text("\(s.leadsCreatedCount) nye leads")
                    .font(.title2.weight(.semibold))
                Text("Nye pins er plottet — gå og besøk dem.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button {
                    Task {
                        await appState.refreshAll()
                        dismiss()
                    }
                } label: {
                    Label("Vis gridden", systemImage: "map")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.bottom, 8)
        } else if let s = status, s.phase == "failed" {
            VStack(alignment: .leading, spacing: 8) {
                Label("Gridden falt ut", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                if let msg = s.errorMessage ?? s.phaseMessage {
                    Text(msg).font(.caption).foregroundStyle(.secondary)
                }
                Button("Lukk") { dismiss() }
                    .buttonStyle(.bordered)
            }
            .padding(.bottom, 8)
        }
    }

    // MARK: - Polling

    private func pollUntilDone() async {
        guard let api = appState.api else { return }
        while !Task.isCancelled {
            do {
                let resp = try await api.fetchLeadResearchStatus(researchId: researchId)
                status = resp.research
                if resp.research.isTerminal { break }
            } catch {
                self.error = String(describing: error)
            }
            try? await Task.sleep(nanoseconds: Self.pollInterval)
        }
    }
}
