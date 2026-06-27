// LeadgridWorkflowRunSheet.swift
//
// Sheet for å manuelt trigge en workflow mot 1 eller flere leads —
// "Kjør nå"-handlingen fra WorkflowDetailSheet (eller fra Lead Detail).
//
// UX-flyt:
//   1. Bruker velger workflow → tap "Kjør nå" → denne sheet-en åpnes
//   2. Søkbar liste over leads (filter: alle / prosjekt / hot / nye)
//   3. Multi-select m/ "Velg alle synlige"-knapp
//   4. Bekreftelse: "Kjør X for N leads?"
//   5. Tap "Kjør" → POST /execute m/ lead_ids → vis progress
//   6. Etter ferdig → kvittering m/ per-lead-status fra
//      fetchWorkflowExecutions(_:) (polles 2x)
//
// Respekterer RBAC: krever permissions.contains("workflows.execute")
// for å vise "Kjør"-knappen aktiv.

import SwiftUI

@MainActor
struct LeadgridWorkflowRunSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    let workflow: LeadgridWorkflow
    /// Forhåndsvalgte lead-ids — typisk fra Lead Detail-flow der
    /// brukeren allerede har én lead i fokus.
    var preselectedLeadIds: Set<String> = []
    var onCompleted: (@MainActor () async -> Void)? = nil

    @State private var query: String = ""
    @State private var filter: Filter = .all
    @State private var selectedLeadIds: Set<String> = []
    @State private var phase: Phase = .picking
    @State private var feedback: String?
    @State private var executionResp: LeadgridWorkflowExecuteResponse?
    @State private var recentExecutions: [LeadgridWorkflowExecution] = []

    enum Phase: Equatable {
        case picking
        case confirming
        case running
        case done
    }

    enum Filter: String, CaseIterable, Identifiable {
        case all = "Alle"
        case project = "Prosjekt"
        case hot = "Hot"
        case unvisited = "Uvisited"
        var id: String { rawValue }
    }

    private var canRun: Bool {
        // Tom permissions-liste = ikke lastet enda → tillat for å unngå
        // false-blokk i offline-bootstrap. Ekte tom = backend returnerte
        // tom liste (sjeldent for autentisert bruker).
        appState.permissions.isEmpty
            || appState.permissions.contains("workflows.execute")
    }

    private var filteredLeads: [LeadModel] {
        let base: [LeadModel] = {
            switch filter {
            case .all: return appState.leads
            case .project:
                guard let pid = appState.activeProjectId else { return [] }
                return appState.leads.filter { $0.projectId == pid }
            case .hot:
                return appState.leads.filter { lead in
                    if let t = lead.leadTemperature?.lowercased(),
                       t == "hot" || t == "ready" { return true }
                    if let s = lead.leadScore, s >= 80 { return true }
                    return false
                }
            case .unvisited:
                return appState.leads.filter { $0.status == .unvisited }
            }
        }()
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty { return base }
        return base.filter {
            $0.name.lowercased().contains(q)
                || ($0.address?.lowercased().contains(q) ?? false)
                || ($0.city?.lowercased().contains(q) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                content
            }
            .navigationTitle(workflow.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { dismiss() }
                }
            }
            .task {
                if !preselectedLeadIds.isEmpty {
                    selectedLeadIds = preselectedLeadIds
                    phase = .confirming
                }
            }
        }
    }

    @ViewBuilder
    private var header: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "bolt.fill")
                    .foregroundStyle(Color.accentColor)
                Text("Trigger: \(workflow.triggerType)")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                Spacer()
                if !selectedLeadIds.isEmpty {
                    Text("\(selectedLeadIds.count) valgt")
                        .font(.callout.bold())
                        .foregroundStyle(Color(red: 0.58, green: 0.20, blue: 0.92))
                }
            }
            if let d = workflow.description, !d.isEmpty {
                Text(d)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .picking:
            pickingView
        case .confirming:
            confirmingView
        case .running:
            runningView
        case .done:
            doneView
        }
    }

    // MARK: Picking

    @ViewBuilder
    private var pickingView: some View {
        VStack(spacing: 8) {
            Picker("Filter", selection: $filter) {
                ForEach(Filter.allCases) { f in
                    Text(f.rawValue).tag(f)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)

            TextField("Søk i leads …", text: $query)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 16)

            HStack {
                Button {
                    let visible = Set(filteredLeads.map { $0.id })
                    if selectedLeadIds.isSuperset(of: visible) {
                        selectedLeadIds.subtract(visible)
                    } else {
                        selectedLeadIds.formUnion(visible)
                    }
                } label: {
                    Text(selectedLeadIds.isSuperset(of: Set(filteredLeads.map { $0.id }))
                         ? "Fjern alle synlige" : "Velg alle synlige")
                        .font(.caption)
                }
                .disabled(filteredLeads.isEmpty)
                Spacer()
                if !selectedLeadIds.isEmpty {
                    Button("Nullstill") { selectedLeadIds.removeAll() }
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 2)

            List {
                ForEach(filteredLeads) { lead in
                    leadRow(lead)
                }
            }
            .listStyle(.plain)

            VStack(spacing: 6) {
                if let feedback {
                    Text(feedback)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Button {
                    phase = .confirming
                } label: {
                    Label("Fortsett (\(selectedLeadIds.count))",
                          systemImage: "arrow.right.circle.fill")
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.58, green: 0.20, blue: 0.92))
                .disabled(selectedLeadIds.isEmpty)
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
        }
    }

    @ViewBuilder
    private func leadRow(_ lead: LeadModel) -> some View {
        let isSelected = selectedLeadIds.contains(lead.id)
        Button {
            if isSelected { selectedLeadIds.remove(lead.id) }
            else { selectedLeadIds.insert(lead.id) }
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: isSelected
                      ? "checkmark.circle.fill"
                      : "circle")
                    .foregroundStyle(isSelected
                        ? Color(red: 0.58, green: 0.20, blue: 0.92)
                        : Color.gray)
                    .font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(lead.name).font(.body)
                    HStack(spacing: 6) {
                        if let score = lead.leadScore {
                            chip("Score \(score)")
                        }
                        if let t = lead.leadTemperature {
                            chip(t.capitalized)
                        }
                        if let city = lead.city {
                            chip(city)
                        }
                    }
                }
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(Color.secondary.opacity(0.15), in: Capsule())
            .foregroundStyle(.secondary)
    }

    // MARK: Confirming

    @ViewBuilder
    private var confirmingView: some View {
        VStack(spacing: 16) {
            Spacer().frame(height: 8)
            VStack(spacing: 12) {
                Image(systemName: "bolt.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Color(red: 0.58, green: 0.20, blue: 0.92))
                Text("Kjør workflow '\(workflow.name)' for \(selectedLeadIds.count) leads?")
                    .font(.headline)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                Text("Hver lead får handlinger som er definert i workflow-en — "
                     + "f.eks. tag, status-bytte, oppgave, eller varsel.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
            }

            if !canRun {
                Label(
                    "Du mangler tillatelsen 'workflows.execute'. Be salgssjef gi tilgang.",
                    systemImage: "lock.fill"
                )
                .font(.caption)
                .foregroundStyle(.orange)
                .padding(.horizontal, 16)
            }

            Spacer()

            VStack(spacing: 10) {
                Button {
                    Task { await execute() }
                } label: {
                    Label("Kjør (\(selectedLeadIds.count))",
                          systemImage: "play.fill")
                        .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.58, green: 0.20, blue: 0.92))
                .disabled(!canRun)

                Button("Tilbake til valg") { phase = .picking }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .padding(16)
        }
    }

    // MARK: Running

    @ViewBuilder
    private var runningView: some View {
        VStack(spacing: 18) {
            Spacer()
            ProgressView()
                .controlSize(.large)
                .tint(Color(red: 0.58, green: 0.20, blue: 0.92))
            Text("Kjører workflow for \(selectedLeadIds.count) leads …")
                .font(.headline)
            Text("Det tar typisk 1-5 sek per lead.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
        }
    }

    // MARK: Done

    @ViewBuilder
    private var doneView: some View {
        VStack(spacing: 0) {
            VStack(spacing: 12) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.green)
                Text("Workflow startet for \(selectedLeadIds.count) leads")
                    .font(.headline)
                    .multilineTextAlignment(.center)
                if let resp = executionResp,
                   let triggered = resp.triggeredAt {
                    Text("Trigget \(triggered)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.top, 16)

            List {
                Section("Siste eksekveringer (\(recentExecutions.count))") {
                    if recentExecutions.isEmpty {
                        Text("Vent et øyeblikk og dra ned for å oppdatere — "
                             + "engine prosesserer i bakgrunnen.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(recentExecutions) { exec in
                            HStack {
                                statusIcon(exec.status)
                                Text(exec.leadId ?? "(uten lead)")
                                    .font(.caption.monospaced())
                                    .lineLimit(1)
                                Spacer()
                                if let dms = exec.durationMs {
                                    Text("\(dms) ms")
                                        .font(.caption2.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .refreshable { await loadRecentExecutions() }
            .frame(maxHeight: .infinity)

            Button("Lukk") { dismiss() }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.58, green: 0.20, blue: 0.92))
                .padding(16)
        }
    }

    private func statusIcon(_ status: String) -> some View {
        let (system, color): (String, Color) = {
            switch status {
            case "completed": return ("checkmark.circle.fill", .green)
            case "failed": return ("xmark.circle.fill", .red)
            case "skipped": return ("forward.fill", .gray)
            case "running", "pending": return ("hourglass", .orange)
            default: return ("circle", .secondary)
            }
        }()
        return Image(systemName: system).foregroundStyle(color)
    }

    // MARK: Actions

    @MainActor
    private func execute() async {
        guard let api = appState.api else {
            feedback = "Ikke innlogget."
            return
        }
        let ids = Array(selectedLeadIds)
        phase = .running
        do {
            let resp = try await api.executeWorkflowBulk(workflow.id, leadIds: ids)
            executionResp = resp
            // Lar engine få et lite forsprang før vi henter executions.
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            await loadRecentExecutions()
            phase = .done
            await onCompleted?()
        } catch {
            feedback = "Kjøring feilet: \(error.localizedDescription)"
            phase = .confirming
        }
    }

    @MainActor
    private func loadRecentExecutions() async {
        guard let api = appState.api else { return }
        do {
            let execs = try await api.fetchWorkflowExecutions(
                workflow.id, limit: max(selectedLeadIds.count, 10),
            )
            recentExecutions = execs
        } catch {
            feedback = "Kunne ikke hente historikk: \(error.localizedDescription)"
        }
    }
}
