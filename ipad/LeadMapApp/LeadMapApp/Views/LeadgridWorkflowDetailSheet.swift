// LeadgridWorkflowDetailSheet.swift
//
// Detail-sheet for én workflow — viser trigger, conditions, actions,
// eksekverings-historikk, og toggles aktiv/inaktiv. Lar bruker manuelt
// kjøre dry-run (test) eller execute.

import SwiftUI

struct LeadgridWorkflowDetailSheet: View {
    let workflow: LeadgridWorkflow
    let api: APIClient
    let onUpdate: () async -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var executions: [LeadgridWorkflowExecution] = []
    @State private var loadingExec = true
    @State private var isActive: Bool
    @State private var actionPending = false
    @State private var feedback: String?
    @State private var runSheetOpen = false

    init(
        workflow: LeadgridWorkflow,
        api: APIClient,
        onUpdate: @escaping () async -> Void,
    ) {
        self.workflow = workflow
        self.api = api
        self.onUpdate = onUpdate
        _isActive = State(initialValue: workflow.isActive)
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Status") {
                    Toggle("Aktiv", isOn: $isActive)
                        .onChange(of: isActive) { _, newValue in
                            Task { await setActive(newValue) }
                        }
                    if let last = workflow.lastExecutedAt {
                        labeled("Sist kjørt", value: formatDateShort(last))
                    }
                    if let err = workflow.lastErrorMessage {
                        labeled("Siste feil", value: err)
                            .foregroundStyle(.red)
                    }
                    labeled(
                        "Eksekveringer totalt",
                        value: "\(workflow.executionCount)"
                    )
                }

                Section("Trigger") {
                    Text(workflow.triggerType).font(.body)
                }

                if let feedback {
                    Section {
                        Text(feedback).foregroundStyle(.secondary)
                    }
                }

                Section("Handlinger") {
                    Button {
                        Task { await runTest() }
                    } label: {
                        Label("Test (dry-run)", systemImage: "play.circle")
                    }
                    .disabled(actionPending)
                    Button {
                        runSheetOpen = true
                    } label: {
                        Label("Kjør nå (velg leads)", systemImage: "bolt.fill")
                    }
                    .disabled(!isActive)
                    Button {
                        Task { await runExecute() }
                    } label: {
                        Label("Kjør én gang (uten lead)",
                              systemImage: "play.rectangle.fill")
                            .font(.caption)
                    }
                    .disabled(actionPending || !isActive)
                }

                Section("Eksekverings-historikk") {
                    if loadingExec {
                        ProgressView()
                    } else if executions.isEmpty {
                        Text("Ingen eksekveringer enda.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(executions) { e in
                            ExecutionRow(execution: e)
                        }
                    }
                }
            }
            .navigationTitle(workflow.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { dismiss() }
                }
            }
            .task { await loadExecutions() }
            .sheet(isPresented: $runSheetOpen) {
                LeadgridWorkflowRunSheet(
                    workflow: workflow,
                    onCompleted: {
                        await loadExecutions()
                        await onUpdate()
                    }
                )
            }
        }
    }

    private func labeled(_ label: String, value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).multilineTextAlignment(.trailing)
        }
    }

    private func loadExecutions() async {
        loadingExec = true
        do {
            executions = try await api.fetchWorkflowExecutions(workflow.id)
        } catch {
            feedback = "Kunne ikke laste historikk: \(error.localizedDescription)"
        }
        loadingExec = false
    }

    private func setActive(_ value: Bool) async {
        actionPending = true
        defer { actionPending = false }
        do {
            try await api.setWorkflowActive(workflow.id, active: value)
            await onUpdate()
        } catch {
            feedback = "Klarte ikke å endre status: \(error.localizedDescription)"
            isActive = workflow.isActive
        }
    }

    private func runTest() async {
        actionPending = true
        defer { actionPending = false }
        do {
            let result = try await api.testWorkflow(workflow.id)
            feedback =
                "Test ferdig (\(result.status)) — \(result.actionsExecuted.count) actions."
            await loadExecutions()
        } catch {
            feedback = "Test feilet: \(error.localizedDescription)"
        }
    }

    private func runExecute() async {
        actionPending = true
        defer { actionPending = false }
        do {
            try await api.executeWorkflow(workflow.id, leadId: nil)
            feedback = "Workflow startet — sjekk historikk om noen sekunder."
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            await loadExecutions()
            await onUpdate()
        } catch {
            feedback = "Execute feilet: \(error.localizedDescription)"
        }
    }
}

private struct ExecutionRow: View {
    let execution: LeadgridWorkflowExecution

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                statusChip(execution.status)
                Text(formatDateShort(execution.startedAt))
                    .font(.caption).foregroundStyle(.secondary)
                Spacer()
                if let d = execution.durationMs {
                    Text("\(d) ms")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
            if let err = execution.errorMessage {
                Text(err).font(.caption).foregroundStyle(.red).lineLimit(3)
            }
            if !execution.actionsExecuted.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(execution.actionsExecuted, id: \.index) { a in
                            Text("\(a.type):\(a.status)")
                                .font(.caption2)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(colorForResultStatus(a.status).opacity(0.18), in: Capsule())
                                .foregroundStyle(colorForResultStatus(a.status))
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func statusChip(_ s: String) -> some View {
        Text(s)
            .font(.caption.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(colorForExecStatus(s).opacity(0.18), in: Capsule())
            .foregroundStyle(colorForExecStatus(s))
    }
}

private func colorForExecStatus(_ s: String) -> Color {
    switch s {
    case "completed": return .green
    case "failed": return .red
    case "skipped": return .gray
    case "dry_run": return .blue
    case "running", "pending": return .orange
    default: return .secondary
    }
}

private func colorForResultStatus(_ s: String) -> Color {
    switch s {
    case "ok": return .green
    case "error": return .red
    case "deferred": return .orange
    case "skipped": return .gray
    default: return .secondary
    }
}

private func formatDateShort(_ iso: String) -> String {
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
