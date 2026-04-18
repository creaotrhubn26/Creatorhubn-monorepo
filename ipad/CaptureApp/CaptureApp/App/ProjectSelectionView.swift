import SwiftUI

/// Phase 2B Lag D: after sign-in, the photographer chooses which
/// CreatorHub project this iPad session belongs to. Two paths:
/// 1. **Pick existing** — list of recent projects from
///    `/api/capture/projects`. Selecting one means subsequent
///    captures land under that project (shot list visible, deliveries
///    use the project's showcase prefs, sessions show up in the
///    UniversalDashboard project view).
/// 2. **Start simple session** — auto-creates a minimal project on
///    the backend so the workflow stays unified ("everything is
///    always a project" per Daniel's directive). Photographer can
///    flesh out the project later from the web dashboard.
///
/// Selection is published via the closure binding `onSelected` so the
/// parent (LiveCaptureView) can carry the chosen project into the
/// LiveCaptureModel and start the camera flow.
struct ProjectSelectionView: View {
    @Environment(SignInService.self) private var auth
    @Environment(\.dismiss) private var dismiss

    let onSelected: (BackendProjectSummary) -> Void

    @State private var projects: [BackendProjectSummary] = []
    @State private var isLoading: Bool = false
    @State private var loadError: String?

    @State private var isCreatingSimple: Bool = false
    @State private var simpleTitle: String = "Photo session"
    @State private var simpleClient: String = ""
    @State private var simpleEventDate: Date = .now
    @State private var simpleType: String = "photo_session"
    @State private var createError: String?

    var body: some View {
        NavigationStack {
            Group {
                if !auth.isSignedIn {
                    notSignedInView
                } else if isLoading {
                    ProgressView().controlSize(.large)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    ContentUnavailableView(
                        "Couldn't load projects",
                        systemImage: "wifi.exclamationmark",
                        description: Text(loadError),
                    )
                } else {
                    projectList
                }
            }
            .navigationTitle("Choose project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarLeading) {
                    if auth.isSignedIn {
                        Button {
                            Task { await loadProjects() }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                }
            }
            .sheet(isPresented: $isCreatingSimple) { simpleSessionSheet }
        }
        .task { if auth.isSignedIn { await loadProjects() } }
    }

    private var notSignedInView: some View {
        ContentUnavailableView(
            "Sign in to CreatorHub first",
            systemImage: "person.crop.circle.badge.exclamationmark",
            description: Text("Project selection needs your CreatorHub account so the right shot list and delivery target follow each capture."),
        )
    }

    private var projectList: some View {
        List {
            Section {
                Button {
                    isCreatingSimple = true
                } label: {
                    Label("Start simple photo session", systemImage: "camera.aperture")
                        .foregroundStyle(.primary)
                }
                Text("Creates a new minimal project so this session is still tracked under your dashboard. Add details later from the web.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if projects.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No projects yet",
                        systemImage: "folder",
                        description: Text("Create one from the simple session button above, or from the CreatorHub dashboard."),
                    )
                }
            } else {
                Section("Your projects") {
                    ForEach(projects) { project in
                        Button {
                            onSelected(project)
                            dismiss()
                        } label: {
                            ProjectRow(project: project)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await loadProjects() }
    }

    private var simpleSessionSheet: some View {
        NavigationStack {
            Form {
                Section("Project details") {
                    TextField("Title", text: $simpleTitle)
                        .textInputAutocapitalization(.words)
                    TextField("Client (optional)", text: $simpleClient)
                        .textInputAutocapitalization(.words)
                    DatePicker("Event date", selection: $simpleEventDate, displayedComponents: .date)
                    Picker("Type", selection: $simpleType) {
                        Text("Photo session").tag("photo_session")
                        Text("Wedding").tag("wedding")
                        Text("Portrait").tag("portrait")
                        Text("Event").tag("event")
                        Text("Product").tag("product")
                    }
                }
                if let createError {
                    Section {
                        Label(createError, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
                Section {
                    Button {
                        Task { await createSimpleSession() }
                    } label: {
                        Label("Create + start", systemImage: "checkmark.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(simpleTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .navigationTitle("Simple session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { isCreatingSimple = false }
                }
            }
        }
    }

    private func loadProjects() async {
        guard let session = auth.session else { return }
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        let client = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"],
        )
        do {
            let response = try await client.listProjects()
            projects = response.projects
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func createSimpleSession() async {
        guard let session = auth.session else { return }
        createError = nil
        let client = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"],
        )
        let dateString = ISO8601DateFormatter.dateOnly.string(from: simpleEventDate)
        do {
            let created = try await client.createMinimalProject(
                body: BackendCreateMinimalProjectRequest(
                    title: simpleTitle.trimmingCharacters(in: .whitespacesAndNewlines),
                    clientName: simpleClient.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ? nil
                        : simpleClient.trimmingCharacters(in: .whitespacesAndNewlines),
                    eventDate: dateString,
                    location: nil,
                    projectType: simpleType,
                ),
            )
            // Reuse the summary shape so onSelected can be uniform.
            let summary = BackendProjectSummary(
                id: created.id,
                title: created.title,
                clientName: simpleClient.isEmpty ? nil : simpleClient,
                eventDate: dateString,
                location: nil,
                projectType: simpleType,
                status: "active",
                shotListSummary: nil,
                updatedAt: created.createdAt,
            )
            isCreatingSimple = false
            onSelected(summary)
            dismiss()
        } catch {
            createError = error.localizedDescription
        }
    }
}

private struct ProjectRow: View {
    let project: BackendProjectSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(project.title).font(.headline)
                Spacer()
                if let type = project.projectType {
                    Text(type.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(.tint.opacity(0.18), in: Capsule())
                }
            }
            HStack(spacing: 12) {
                if let client = project.clientName, !client.isEmpty {
                    Label(client, systemImage: "person")
                }
                if let date = project.eventDate, !date.isEmpty {
                    Label(date, systemImage: "calendar")
                }
                if let loc = project.location, !loc.isEmpty {
                    Label(loc, systemImage: "mappin.and.ellipse")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            if let sl = project.shotListSummary {
                ProgressView(value: Double(sl.completedShots),
                             total: max(Double(sl.totalShots), 1)) {
                    HStack {
                        Text("Shot list")
                            .font(.caption2.weight(.semibold))
                        Spacer()
                        Text("\(sl.completedShots)/\(sl.totalShots)")
                            .font(.caption2.monospaced())
                    }
                }
                .tint(.green)
                .padding(.top, 2)
            }
        }
        .padding(.vertical, 4)
    }
}

private extension ISO8601DateFormatter {
    nonisolated(unsafe) static let dateOnly: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f
    }()
}
