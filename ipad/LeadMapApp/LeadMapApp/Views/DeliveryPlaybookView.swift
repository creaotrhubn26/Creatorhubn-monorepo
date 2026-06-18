// DeliveryPlaybookView.swift
//
// Steg-for-steg-utførelse av en playbook (Meta Pixel, GA4, etc.).
// Vises etter at markedsfører har trykt 'Sett i gang' på en
// focus-request, eller når hen åpner en pågående deliverable.
//
// Inneholder:
//   - Header m/ kunde-logo, behov-tittel, fremdrifts-bar
//   - 'Krever fra klient' — checkbox-liste
//   - Steg-for-steg-liste m/ markér-som-ferdig
//   - 'Hvordan verifisere' — siste seksjon

import SwiftUI

struct DeliveryPlaybookView: View {
    let focusRequest: FocusRequestRow
    let existingDeliverableId: String?

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var deliverableId: String?
    @State private var deliverable: DeliverableDetail?
    @State private var isStarting = false
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            content
                .background(
                    BrandedHeroBackground(.backdrop3, darkenFrom: 0.55, darkenTo: 0.97)
                        .ignoresSafeArea()
                )
                .scrollContentBackground(.hidden)
                .navigationTitle(deliverable?.playbookTitle ?? focusRequest.displayNeedLabel)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Lukk") { dismiss() }
                    }
                }
                .task { await loadOrStart() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let d = deliverable {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header(d)
                    if let reqs = d.playbookRequirements, !reqs.isEmpty {
                        requirementsSection(reqs: reqs, progress: d.progressData?.requirements ?? [])
                    }
                    if let steps = d.playbookSteps {
                        stepsSection(steps: steps, progress: d.progressData?.steps ?? [])
                    }
                    if let verif = d.playbookVerification, !verif.isEmpty {
                        verificationSection(verif)
                    }
                }
                .padding(20)
            }
        } else if isStarting || isLoading {
            VStack(spacing: 16) {
                ProgressView().controlSize(.large)
                Text("Henter playbook …")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let err = error {
            ContentUnavailableView(
                "Kunne ikke laste",
                systemImage: "exclamationmark.triangle",
                description: Text(err)
            )
        }
    }

    private func header(_ d: DeliverableDetail) -> some View {
        let stepsDone = (d.progressData?.steps ?? []).filter { $0.status == "done" }.count
        let totalSteps = (d.playbookSteps ?? []).count
        let pct = totalSteps > 0 ? Double(stepsDone) / Double(totalSteps) : 0
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                if let logo = focusRequest.customerLogo, let u = URL(string: logo) {
                    AsyncImage(url: u) { phase in
                        if case .success(let img) = phase {
                            img.resizable().scaledToFit()
                        }
                    }
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                VStack(alignment: .leading) {
                    Text(focusRequest.customerName ?? "")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(d.playbookTitle ?? d.title ?? focusRequest.displayNeedLabel)
                        .font(.title2.weight(.bold))
                }
                Spacer()
            }

            HStack {
                Text("Fremdrift: \(stepsDone)/\(totalSteps)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if let mins = d.playbookMinutes {
                    Label("~\(mins) min", systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let diff = d.playbookDifficulty {
                    Text(diff.capitalized)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(difficultyColor(diff).opacity(0.18),
                                    in: Capsule())
                        .foregroundStyle(difficultyColor(diff))
                }
            }
            ProgressView(value: pct)
                .tint(pct >= 1 ? .green : .accentColor)
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
    }

    private func requirementsSection(
        reqs: [PlaybookRequirement],
        progress: [DeliverableRequirementProgress]
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Vi trenger fra kunden", systemImage: "tray.and.arrow.down")
                .font(.headline)
            ForEach(Array(reqs.enumerated()), id: \.offset) { idx, req in
                let received = progress.indices.contains(idx) ? progress[idx].received : false
                Button {
                    Task { await toggleRequirement(idx: idx, received: !received) }
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: received ? "checkmark.square.fill" : "square")
                            .foregroundStyle(received ? .green : .secondary)
                            .font(.title3)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(req.title)
                                .font(.subheadline.weight(.semibold))
                            Text(req.description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .padding(12)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func stepsSection(
        steps: [PlaybookStep],
        progress: [DeliverableStepProgress]
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Steg-for-steg", systemImage: "list.number")
                .font(.headline)
            ForEach(steps, id: \.step) { step in
                let p = progress.first { $0.step == step.step }
                stepRow(step: step, progress: p)
            }
        }
    }

    private func stepRow(step: PlaybookStep, progress: DeliverableStepProgress?) -> some View {
        let status = progress?.status ?? "pending"
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    Circle()
                        .fill(stepStatusColor(status).opacity(0.20))
                        .frame(width: 36, height: 36)
                    if status == "done" {
                        Image(systemName: "checkmark")
                            .foregroundStyle(.green)
                    } else {
                        Text("\(step.step)")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(stepStatusColor(status))
                    }
                }
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(step.title)
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text("~\(step.estimatedMinutes) min")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Text(step.instructions)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if step.needsClientInput {
                        Label("Trenger input fra klient", systemImage: "person.fill")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.orange)
                    }
                }
            }
            HStack(spacing: 8) {
                Spacer()
                Button {
                    Task { await markStep(step.step, status: "done") }
                } label: {
                    Label(status == "done" ? "Ferdig ✓" : "Markér ferdig",
                          systemImage: "checkmark.circle")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .tint(status == "done" ? .green : .accentColor)
                Button {
                    Task { await markStep(step.step, status: "blocked") }
                } label: {
                    Label("Blokkert", systemImage: "exclamationmark.octagon")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .tint(.orange)
            }
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func verificationSection(_ verif: [PlaybookVerification]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Slik verifiserer du", systemImage: "checkmark.shield")
                .font(.headline)
            ForEach(Array(verif.enumerated()), id: \.offset) { _, v in
                VStack(alignment: .leading, spacing: 4) {
                    Text(v.title)
                        .font(.subheadline.weight(.semibold))
                    Text(v.how)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(12)
                .background(.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    // MARK: - Color helpers

    private func difficultyColor(_ d: String) -> Color {
        switch d {
        case "easy":   return .green
        case "medium": return .orange
        case "hard":   return .red
        default:       return .secondary
        }
    }

    private func stepStatusColor(_ s: String) -> Color {
        switch s {
        case "done":         return .green
        case "in_progress":  return .accentColor
        case "blocked":      return .red
        default:             return .secondary
        }
    }

    // MARK: - Actions

    private func loadOrStart() async {
        guard let api = appState.api else { return }
        if let id = existingDeliverableId {
            deliverableId = id
            isLoading = true
            do {
                let resp = try await api.fetchDeliverable(deliverableId: id)
                deliverable = resp.deliverable
            } catch {
                self.error = String(describing: error)
            }
            isLoading = false
        } else {
            // Først: start deliverable fra focus-request
            isStarting = true
            do {
                let startResp = try await api.startDeliveryFromFocusRequest(
                    focusRequestId: focusRequest.id
                )
                deliverableId = startResp.deliverableId
                let resp = try await api.fetchDeliverable(deliverableId: startResp.deliverableId)
                deliverable = resp.deliverable
            } catch {
                self.error = String(describing: error)
            }
            isStarting = false
        }
    }

    private func markStep(_ stepNumber: Int, status: String) async {
        guard let api = appState.api, let id = deliverableId else { return }
        do {
            let resp = try await api.updateDeliverableStep(
                deliverableId: id, stepNumber: stepNumber,
                status: status, notes: nil
            )
            deliverable = resp.deliverable
        } catch {
            self.error = String(describing: error)
        }
    }

    private func toggleRequirement(idx: Int, received: Bool) async {
        guard let api = appState.api, let id = deliverableId else { return }
        do {
            let resp = try await api.toggleDeliverableRequirement(
                deliverableId: id, requirementIndex: idx, received: received
            )
            deliverable = resp.deliverable
        } catch {
            self.error = String(describing: error)
        }
    }
}
