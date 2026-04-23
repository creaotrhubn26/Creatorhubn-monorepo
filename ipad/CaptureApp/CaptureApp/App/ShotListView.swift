import SwiftUI
import PencilKit

/// Shot-list surface, scoped to one project. Shows every planned
/// shot as a checkable row, with must-have shots pinned to the top
/// and a progress bar summarising how many must-haves are still
/// outstanding. Taps on a row push to ``ShotDetailView`` where the
/// photographer writes notes or scribbles with Apple Pencil.
///
/// Every mutation goes through ``ShotListStore`` which writes the
/// local row and queues the backend sync atomically — so the UI
/// feels instant (optimistic update) and the sync worker reconciles
/// in the background.
struct ShotListView: View {
    let projectId: String
    let ownerUserId: String

    @State private var list: ShotList?
    @State private var loadError: String?
    @State private var isWorking = false
    @State private var newShotText: String = ""
    @State private var contextSheetOpen = false

    private var store: ShotListStore? {
        do {
            let url = try AppDatabase.defaultDiskURL()
            let db = try AppDatabase.openOnDisk(at: url)
            return ShotListStore(database: db, outbox: Outbox(database: db))
        } catch {
            return nil
        }
    }

    var body: some View {
        Group {
            if let list {
                loaded(list: list)
            } else if let loadError {
                VStack(spacing: 12) {
                    Label("Kunne ikke laste shot list", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text(loadError)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding()
            } else {
                ProgressView().task { await reload() }
            }
        }
        .navigationTitle("Shot list")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    contextSheetOpen = true
                } label: {
                    Image(systemName: "info.circle")
                }
            }
        }
        .sheet(isPresented: $contextSheetOpen) {
            ContextPanelView(
                projectId: projectId,
                ownerUserId: ownerUserId,
            )
        }
    }

    // MARK: - Loaded state

    @ViewBuilder
    private func loaded(list: ShotList) -> some View {
        let shots = list.shots
        let mustHave = shots.filter(isMustHave)
        let regular = shots.filter { !isMustHave($0) }
        let doneMustHave = mustHave.filter { $0.isCompleted == true }.count

        List {
            Section {
                progressCard(
                    done: doneMustHave,
                    total: mustHave.count,
                    allShots: shots.count,
                )
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            if !mustHave.isEmpty {
                Section("Must-have") {
                    ForEach(mustHave) { shot in
                        shotRow(shot, in: list)
                    }
                }
            }
            if !regular.isEmpty {
                Section("Øvrige") {
                    ForEach(regular) { shot in
                        shotRow(shot, in: list)
                    }
                }
            }

            Section("Legg til shot") {
                HStack {
                    TextField("Beskrivelse", text: $newShotText)
                        .textInputAutocapitalization(.sentences)
                    Button {
                        Task { await addShot(to: list) }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                    }
                    .disabled(newShotText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .refreshable { await reload() }
    }

    private func shotRow(_ shot: ShotListItem, in list: ShotList) -> some View {
        NavigationLink {
            ShotDetailView(
                shot: shot,
                list: list,
                onUpdate: { await reload() }
            )
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Button {
                    Task { await toggle(shot: shot, in: list) }
                } label: {
                    Image(systemName: (shot.isCompleted ?? false)
                          ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle((shot.isCompleted ?? false) ? .green : .secondary)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 2) {
                    Text(shot.scene)
                        .font(.body)
                        .strikethrough(shot.isCompleted ?? false)
                    if let description = shot.description {
                        Text(description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    HStack(spacing: 8) {
                        if isMustHave(shot) {
                            tag("Must-have", color: .orange)
                        }
                        if let location = shot.locationName, !location.isEmpty {
                            Label(location, systemImage: "mappin")
                                .labelStyle(.titleAndIcon)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if shot.inkData != nil {
                            Image(systemName: "pencil.tip")
                                .font(.caption2)
                                .foregroundStyle(.purple)
                        }
                        if shot.notes?.isEmpty == false {
                            Image(systemName: "note.text")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func progressCard(done: Int, total: Int, allShots: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Must-have progress")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(done)/\(total == 0 ? 0 : total)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            ProgressView(
                value: Double(done),
                total: Double(max(1, total)),
            )
            Text("\(allShots) shots totalt")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.primary.opacity(0.04))
        )
        .padding(.horizontal)
        .padding(.bottom, 8)
    }

    private func tag(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.vertical, 2)
            .padding(.horizontal, 6)
            .background(Capsule().fill(color.opacity(0.15)))
            .foregroundStyle(color)
    }

    // MARK: - Actions

    private func reload() async {
        guard let store else {
            loadError = "Database ikke tilgjengelig"
            return
        }
        do {
            list = try await store.load(
                projectId: projectId,
                ownerUserId: ownerUserId,
            )
            loadError = nil
        } catch {
            loadError = String(describing: error)
        }
    }

    private func toggle(shot: ShotListItem, in list: ShotList) async {
        guard let store else { return }
        do {
            try await store.toggleCompletion(shotId: shot.id, in: list)
            await reload()
        } catch {
            loadError = String(describing: error)
        }
    }

    private func addShot(to list: ShotList) async {
        guard let store else { return }
        let scene = newShotText.trimmingCharacters(in: .whitespaces)
        guard !scene.isEmpty else { return }
        newShotText = ""
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await store.addShot(to: list, scene: scene)
            await reload()
        } catch {
            loadError = String(describing: error)
        }
    }

    /// Priority tokens the web form emits. Mirrors the backend's
    /// MUST_HAVE_PRIORITIES set in ``capture-projects-service.ts`` so
    /// the iPad view groups and the server counters agree on what
    /// counts as a must-have.
    private func isMustHave(_ shot: ShotListItem) -> Bool {
        let priority = (shot.priority ?? "").lowercased().trimmingCharacters(in: .whitespaces)
        return [
            "must",
            "must-have",
            "must_have",
            "musthave",
            "high",
            "critical",
        ].contains(priority)
    }
}
