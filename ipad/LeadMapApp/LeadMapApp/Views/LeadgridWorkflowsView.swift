// LeadgridWorkflowsView.swift
//
// Native iPad-UI for Smart Workflow Builder (#203, mig 0349).
//
// Funksjonalitet:
//   - Liste alle workflows m/ status-pill (aktiv/inaktiv/feilet)
//   - Tap → detail-sheet med trigger + actions + execution-historikk
//   - "+ Lag workflow" → åpne builder
//   - "Templates"-tab — bruk en av 10 forhåndsbygde

import SwiftUI

struct LeadgridWorkflowsView: View {
    let api: APIClient
    @Environment(AppState.self) private var appState
    @State private var workflows: [LeadgridWorkflow] = []
    @State private var templates: [LeadgridWorkflowTemplate] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var selectedTab: Tab = .workflows
    @State private var selectedWorkflow: LeadgridWorkflow?
    @State private var showBuilder = false

    enum Tab: Hashable { case workflows, templates }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if let project = appState.activeLeadgridProject {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(project.name, systemImage: "folder.fill")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)

                        Picker("Visning", selection: $selectedTab) {
                            Text("Mine (\(workflows.count))").tag(Tab.workflows)
                            Text("Templates (\(templates.count))").tag(Tab.templates)
                        }
                        .pickerStyle(.segmented)
                    }
                    .padding()

                    if loading {
                        ProgressView().padding()
                    } else if let errorText {
                        ContentUnavailableView(
                            "Kunne ikke laste workflows",
                            systemImage: "exclamationmark.triangle",
                            description: Text(errorText)
                        )
                    } else if selectedTab == .workflows {
                        workflowsList
                    } else {
                        templatesList
                    }
                } else {
                    ContentUnavailableView(
                        "Velg kundeprosjekt",
                        systemImage: "folder.badge.questionmark",
                        description: Text(
                            "Workflows, templates og historikk vises bare for ett aktivt Leadgrid-kundeprosjekt."
                        )
                    )
                }
            }
            .navigationTitle("Workflows")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    ProjectPicker()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showBuilder = true } label: {
                        Image(systemName: "plus")
                    }
                    .disabled(appState.activeLeadgridProjectId == nil)
                }
            }
            .task(id: appState.activeLeadgridProjectId) {
                selectedWorkflow = nil
                showBuilder = false
                await reload()
            }
            .refreshable { await reload() }
            .sheet(item: $selectedWorkflow) { wf in
                LeadgridWorkflowDetailSheet(workflow: wf, api: api) {
                    await reload()
                }
            }
            .sheet(isPresented: $showBuilder) {
                if let projectId = appState.activeLeadgridProjectId {
                    LeadgridWorkflowBuilderView(
                        api: api,
                        projectId: projectId,
                        templates: templates
                    ) {
                        showBuilder = false
                        Task { await reload() }
                    }
                } else {
                    ContentUnavailableView(
                        "Velg kundeprosjekt",
                        systemImage: "folder.badge.questionmark",
                        description: Text("En workflow kan ikke opprettes uten prosjektkontekst.")
                    )
                }
            }
        }
    }

    @ViewBuilder
    private var workflowsList: some View {
        if workflows.isEmpty {
            ContentUnavailableView(
                "Ingen workflows enda",
                systemImage: "bolt.slash",
                description: Text(
                    "Trykk + for å lage en, eller velg en av \(templates.count) templates."
                )
            )
        } else {
            List {
                ForEach(workflows) { wf in
                    WorkflowRow(workflow: wf)
                        .contentShape(Rectangle())
                        .onTapGesture { selectedWorkflow = wf }
                }
            }
            .listStyle(.insetGrouped)
        }
    }

    @ViewBuilder
    private var templatesList: some View {
        if templates.isEmpty {
            ProgressView()
        } else {
            List {
                ForEach(templates) { tpl in
                    TemplateRow(template: tpl) {
                        await useTemplate(tpl)
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
    }

    private func reload() async {
        workflows = []
        templates = []
        errorText = nil
        guard let projectId = appState.activeLeadgridProjectId else {
            loading = false
            return
        }
        loading = true
        do {
            async let workflowRequest = api.fetchWorkflows(projectId: projectId)
            async let templateRequest = api.fetchWorkflowTemplates(projectId: projectId)
            let (loadedWorkflows, loadedTemplates) = try await (
                workflowRequest,
                templateRequest
            )
            guard appState.activeLeadgridProjectId == projectId else { return }
            workflows = loadedWorkflows.filter { $0.projectId == projectId }
            templates = loadedTemplates
        } catch {
            guard appState.activeLeadgridProjectId == projectId else { return }
            errorText = "Kunne ikke laste: \(error.localizedDescription)"
        }
        if appState.activeLeadgridProjectId == projectId {
            loading = false
        }
    }

    private func useTemplate(_ tpl: LeadgridWorkflowTemplate) async {
        guard let projectId = appState.activeLeadgridProjectId else {
            errorText = "Velg et kundeprosjekt før du bruker en template."
            return
        }
        do {
            _ = try await api.createWorkflowFromTemplate(
                templateKey: tpl.key,
                projectId: projectId
            )
            guard appState.activeLeadgridProjectId == projectId else { return }
            await reload()
            selectedTab = .workflows
        } catch {
            guard appState.activeLeadgridProjectId == projectId else { return }
            errorText = "Klarte ikke å bruke template: \(error.localizedDescription)"
        }
    }
}

// MARK: - WorkflowRow

private struct WorkflowRow: View {
    let workflow: LeadgridWorkflow

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(workflow.name).font(.headline)
                Spacer()
                if !workflow.isActive {
                    badge("Inaktiv", color: .gray)
                } else if workflow.lastErrorAt != nil {
                    badge("Feilet", color: .red)
                } else {
                    badge("Aktiv", color: .green)
                }
            }
            if let d = workflow.description, !d.isEmpty {
                Text(d).font(.caption).foregroundStyle(.secondary).lineLimit(2)
            }
            HStack(spacing: 6) {
                chip("Trigger: \(workflow.triggerType)", systemImage: "bolt.fill")
                chip("Kjørt \(workflow.executionCount)x", systemImage: "play.fill")
                if let last = workflow.lastExecutedAt {
                    Text("Sist: \(formatDateShort(last))")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func chip(_ text: String, systemImage: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: systemImage).font(.caption2)
            Text(text).font(.caption2)
        }
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(Color.accentColor.opacity(0.12), in: Capsule())
    }

    private func badge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.18), in: Capsule())
            .foregroundStyle(color)
    }
}

// MARK: - TemplateRow

private struct TemplateRow: View {
    let template: LeadgridWorkflowTemplate
    let onUse: () async -> Void
    @State private var pending = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(template.name).font(.headline)
                Spacer()
                Text(template.category)
                    .font(.caption2)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.gray.opacity(0.2), in: Capsule())
            }
            Text(template.description).font(.caption).foregroundStyle(.secondary)
            HStack {
                Text("Trigger: \(template.trigger.type)")
                    .font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Text("\(template.actions.count) actions")
                    .font(.caption2).foregroundStyle(.secondary)
                Button {
                    pending = true
                    Task { await onUse(); pending = false }
                } label: {
                    if pending {
                        ProgressView().scaleEffect(0.7)
                    } else {
                        Text("Bruk")
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(pending)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Helpers

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
