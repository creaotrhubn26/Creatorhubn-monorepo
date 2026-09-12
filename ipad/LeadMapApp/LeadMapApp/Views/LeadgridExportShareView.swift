// LeadgridExportShareView.swift
//
// Eksport-flyt på iPad: velg periode + status-filter, last ned CSV/PDF,
// vis iOS Share-sheet for AirDrop/Mail/Files.

import SwiftUI
import UIKit

struct LeadgridExportShareView: View {
    let api: APIClient
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    @State private var period: String = "30d"
    @State private var status: String = "all"
    @State private var projects: [ProjectListItem] = []
    @State private var projectId: String?
    @State private var projectsLoading = true
    @State private var showAllProjectsWarning = false
    @State private var confirmedAllProjects = false
    @State private var generating = false
    @State private var fileURL: URL?
    @State private var errorText: String?
    @State private var showShare = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Kundeprosjekt") {
                    Picker("Datagrunnlag", selection: projectSelectionBinding) {
                        Text("Alle prosjekter").tag(String?.none)
                        ForEach(projects) { project in
                            Text(project.name).tag(Optional(project.id))
                        }
                    }
                    .disabled(projectsLoading)
                    Text("Velg ett prosjekt for en kundesikker eksport uten data fra andre oppdrag.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if projectId == nil && !projectsLoading {
                        Label(
                            "Alle prosjekter blander data fra flere kundeoppdrag og krever bekreftelse.",
                            systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
                Section("Periode") {
                    Picker("Periode", selection: $period) {
                        Text("7 dager").tag("7d")
                        Text("30 dager").tag("30d")
                        Text("90 dager").tag("90d")
                        Text("Alle").tag("all")
                    }
                    .pickerStyle(.segmented)
                }
                Section("Status-filter") {
                    Picker("Status", selection: $status) {
                        Text("Alle").tag("all")
                        Text("Aktive (ekskl. arkivert)").tag("active")
                        Text("I pipeline").tag("in_pipeline")
                        Text("Kun vunnet").tag("won")
                        Text("Kun tapt").tag("lost")
                    }
                }

                Section {
                    Button {
                        requestGenerate()
                    } label: {
                        HStack {
                            if generating { ProgressView() }
                            else { Label("Last ned CSV", systemImage: "square.and.arrow.down") }
                            Spacer()
                        }
                    }
                    .disabled(generating || projectsLoading)
                }

                if let errorText {
                    Section { Text(errorText).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Eksporter leads")
        .marketingDirectorBackdrop(.reports)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
            .sheet(isPresented: $showShare) {
                if let url = fileURL {
                    ShareSheet(items: [url])
                }
            }
            .task(id: appState.activeOrganizationId) { await loadProjects() }
            .alert("Eksporter alle kundeprosjekter?", isPresented: $showAllProjectsWarning) {
                Button("Avbryt", role: .cancel) {}
                Button("Eksporter alle", role: .destructive) {
                    confirmedAllProjects = true
                    Task { await generate() }
                }
            } message: {
                Text("Filen vil inneholde data fra flere kundeoppdrag. Kontroller mottaker og formål før du deler den.")
            }
        }
    }

    private var projectSelectionBinding: Binding<String?> {
        Binding(
            get: { projectId },
            set: {
                projectId = $0
                confirmedAllProjects = false
            })
    }

    @MainActor
    private func loadProjects() async {
        projectsLoading = true
        defer { projectsLoading = false }
        guard let organizationId = appState.activeOrganizationId else {
            projects = []
            projectId = nil
            return
        }
        projects = (try? await api.fetchProjects(organizationId: organizationId))
            ?? appState.projects
        if let activeProjectId = appState.activeProjectId,
           projects.contains(where: { $0.id == activeProjectId }) {
            projectId = activeProjectId
        } else {
            projectId = projects.first?.id
        }
    }

    private func requestGenerate() {
        if projectId == nil && !confirmedAllProjects {
            showAllProjectsWarning = true
            return
        }
        Task { await generate() }
    }

    private func generate() async {
        generating = true
        errorText = nil
        defer { generating = false }
        do {
            let data = try await api.exportLeadsCsv(
                period: period,
                status: status,
                projectId: projectId)
            let tmpURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("leads-\(period)-\(Date().timeIntervalSince1970).csv")
            try data.write(to: tmpURL)
            await MainActor.run {
                fileURL = tmpURL
                showShare = true
            }
        } catch {
            await MainActor.run {
                errorText = "Eksport feilet: \(error.localizedDescription)"
            }
        }
    }
}

/// UIKit-wrapper for iOS Share-sheet (UIActivityViewController).
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
