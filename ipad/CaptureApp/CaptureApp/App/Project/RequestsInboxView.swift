import SwiftUI

/// "Forespørsler" — the inbound client requests inbox, the entry point of the
/// request→project→timeline→worklog loop. Each request can be turned into a
/// project with one tap (the backend links the submission to the new project
/// and seeds worklog phases), then jumps straight into the project hub.
@MainActor
@Observable
final class RequestsModel {
    private(set) var submissions: [Submission] = []
    private(set) var loading = true
    private(set) var errorMessage: String?
    var working: String?   // id being converted
    var createdProjectId: String?

    var newCount: Int { submissions.filter(\.isNew).count }

    func load() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription; loading = false; return
        }
        loading = submissions.isEmpty
        errorMessage = nil
        do { submissions = try await client.listSubmissions() }
        catch { if submissions.isEmpty { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription } }
        loading = false
    }

    func createProject(from s: Submission) async {
        guard let client = DashboardClient.make() else { return }
        working = s.id; defer { working = nil }
        do {
            let pid = try await client.createProjectFromSubmission(s)
            createdProjectId = pid
            await load()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }
}

struct RequestsInboxView: View {
    @State private var model = RequestsModel()
    @State private var navProjectId: String?

    var body: some View {
        Group {
            if model.loading && model.submissions.isEmpty {
                ProgressView("Laster forespørsler…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let message = model.errorMessage, model.submissions.isEmpty {
                ContentUnavailableView("Kunne ikke laste", systemImage: "tray.and.arrow.down", description: Text(message))
            } else if model.submissions.isEmpty {
                ContentUnavailableView("Ingen forespørsler", systemImage: "tray", description: Text("Nye kundehenvendelser dukker opp her."))
            } else {
                List {
                    ForEach(model.submissions) { s in
                        RequestRow(submission: s, working: model.working == s.id) {
                            Task { await model.createProject(from: s) }
                        }
                        .listRowBackground(CHTheme.surface)
                        .listRowSeparatorTint(CHTheme.border)
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .refreshable { await model.load() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle("Forespørsler")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .navigationDestination(item: $navProjectId) { pid in
            ProjectDetailView(projectId: pid)
        }
        .onChange(of: model.createdProjectId) { _, pid in
            if let pid { navProjectId = pid; model.createdProjectId = nil }
        }
    }
}

private struct RequestRow: View {
    let submission: Submission
    let working: Bool
    let onCreate: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(submission.name ?? "Ukjent").font(.headline).foregroundStyle(CHTheme.textPrimary)
                if submission.isNew {
                    Text("NY").font(.caption2.weight(.bold)).foregroundStyle(CHTheme.bg)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(CHTheme.accent, in: Capsule())
                }
                Spacer()
                if let at = submission.submittedAt {
                    Text(DashboardDate.relative(at)).font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
            }
            HStack(spacing: 12) {
                if let t = submission.projectType { Label(t, systemImage: "camera").font(.caption).foregroundStyle(CHTheme.textSecondary) }
                if let loc = submission.location, !loc.isEmpty { Label(loc, systemImage: "mappin").font(.caption).foregroundStyle(CHTheme.textMuted) }
                if let b = submission.budget { Text("kr \(Int(b))").font(.caption).foregroundStyle(CHTheme.accentSoft) }
            }
            if let msg = submission.message, !msg.isEmpty {
                Text(msg).font(.caption).foregroundStyle(CHTheme.textSecondary).lineLimit(2)
            }
            Button(action: onCreate) {
                HStack {
                    if working { ProgressView().controlSize(.small) }
                    else { Image(systemName: "folder.badge.plus") }
                    Text(working ? "Oppretter…" : "Opprett prosjekt")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(working)
            .padding(.top, 2)
        }
        .padding(.vertical, 4)
    }
}
