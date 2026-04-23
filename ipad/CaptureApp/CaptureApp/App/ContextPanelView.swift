import SwiftUI

/// Kontekst-panel for ett prosjekt. Viser alt fotografen må vite
/// mid-shoot uten å måtte bytte enhet: klient-info, tidslinje,
/// spesielle ønsker, kontrakt-status, shot-list-progress, teammates,
/// mood-board-lenke.
///
/// Read-only by design — mutations skjer fra web. Telefon/e-post/
/// mood-board er tap-to-open handlinger (tel:, mailto:, http://)
/// så fotografen kan ringe klienten direkte fra iPad uten å bytte
/// app.
///
/// Presentasjons-form: brukes som sheet fra ``LiveCullView`` og
/// ``ShotListView`` (trykk info-ikonet øverst). Standalone-bruk
/// fungerer også; NavigationStack-integrasjon er valgfri.
struct ContextPanelView: View {
    let projectId: String
    let ownerUserId: String

    @State private var snapshot: ContextPanelStore.Snapshot?
    @State private var loadError: String?
    @Environment(\.dismiss) private var dismiss

    private var store: ContextPanelStore? {
        do {
            let url = try AppDatabase.defaultDiskURL()
            let db = try AppDatabase.openOnDisk(at: url)
            return ContextPanelStore(database: db)
        } catch {
            return nil
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let snapshot {
                    content(snapshot)
                } else if let error = loadError {
                    errorView(error)
                } else {
                    ProgressView().task { await reload() }
                }
            }
            .navigationTitle("Kontekst")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lukk") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Task { await reload() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
    }

    // MARK: - Content

    private func content(_ snapshot: ContextPanelStore.Snapshot) -> some View {
        List {
            projectSection(snapshot.project)
            clientSection(snapshot.project)
            if let requests = snapshot.specialRequests {
                specialRequestsSection(requests)
            }
            if let shotList = snapshot.shotList {
                shotListSummary(shotList)
            }
            if !snapshot.contracts.isEmpty {
                contractsSection(snapshot.contracts)
            }
            if !snapshot.teammates.isEmpty {
                teammatesSection(snapshot.teammates)
            }
            if let url = snapshot.moodBoardURL {
                moodBoardRow(url: url)
            }
        }
        .refreshable { await reload() }
    }

    // MARK: - Sections

    private func projectSection(_ project: Project) -> some View {
        Section("Prosjekt") {
            LabeledRow(label: "Tittel", value: project.title)
            if let type = project.projectType {
                LabeledRow(label: "Type", value: type)
            }
            if let eventDate = project.eventDate {
                LabeledRow(
                    label: "Dato",
                    value: eventDate.formatted(
                        .dateTime.weekday(.wide).day().month().hour().minute(),
                    ),
                )
            }
            if let location = project.location {
                LabeledRow(
                    label: "Lokasjon",
                    value: location,
                    systemImage: "mappin.and.ellipse",
                )
            }
        }
    }

    private func clientSection(_ project: Project) -> some View {
        Section("Klient") {
            if let name = project.clientName {
                LabeledRow(label: "Navn", value: name, systemImage: "person")
            }
            if let email = project.clientEmail, !email.isEmpty {
                Link(destination: URL(string: "mailto:\(email)")!) {
                    HStack {
                        Label(email, systemImage: "envelope")
                        Spacer()
                        Image(systemName: "arrow.up.forward")
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
    }

    private func specialRequestsSection(_ requests: String) -> some View {
        Section {
            Text(requests)
                .font(.body)
        } header: {
            Label("Spesielle ønsker", systemImage: "exclamationmark.bubble")
        } footer: {
            Text("Redigeres fra web.")
                .font(.caption2)
        }
    }

    private func shotListSummary(_ shotList: ShotList) -> some View {
        let shots = shotList.shots
        let mustHave = shots.filter { isMustHave($0) }
        let doneMustHave = mustHave.filter { $0.isCompleted == true }.count
        return Section {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Must-have progress")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text("\(doneMustHave)/\(mustHave.count)")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                ProgressView(
                    value: Double(doneMustHave),
                    total: Double(max(1, mustHave.count)),
                )
                Text("\(shots.count) shots totalt")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        } header: {
            Label("Shot list", systemImage: "list.bullet.rectangle")
        }
    }

    private func contractsSection(_ contracts: [Contract]) -> some View {
        Section {
            ForEach(contracts, id: \.id) { contract in
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(contract.clientName)
                            .font(.subheadline)
                        if let email = contract.clientEmail {
                            Text(email)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if let signedAt = contract.signedAt {
                            Text("Signert \(signedAt.formatted(.relative(presentation: .named)))")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    Spacer()
                    ContractStatusBadge(status: contract.status)
                }
            }
        } header: {
            Label("Kontrakter", systemImage: "doc.text")
        } footer: {
            Text("Signer fra iPad med Apple Pencil i Admin-tabben.")
                .font(.caption2)
        }
    }

    private func teammatesSection(_ teammates: [String]) -> some View {
        Section {
            ForEach(teammates, id: \.self) { name in
                Label(name, systemImage: "person.2")
            }
        } header: {
            Label("Teammates", systemImage: "person.3")
        }
    }

    private func moodBoardRow(url: URL) -> some View {
        Section {
            Link(destination: url) {
                HStack {
                    Label("Klientens mood-board", systemImage: "photo.on.rectangle.angled")
                    Spacer()
                    Image(systemName: "arrow.up.forward")
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    // MARK: - Error

    private func errorView(_ error: String) -> some View {
        VStack(spacing: 12) {
            Label("Kunne ikke laste kontekst", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(error)
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Prøv igjen") { Task { await reload() } }
                .buttonStyle(.bordered)
        }
        .padding()
    }

    // MARK: - Actions

    private func reload() async {
        guard let store else {
            loadError = "Database ikke tilgjengelig"
            return
        }
        do {
            snapshot = try await store.load(
                projectId: projectId,
                ownerUserId: ownerUserId,
            )
            if snapshot == nil {
                loadError = "Prosjekt ikke funnet lokalt — ikke synkronisert ennå?"
            } else {
                loadError = nil
            }
        } catch {
            loadError = String(describing: error)
        }
    }

    // Duplicate of ShotListView's helper — extracted locally so the
    // context panel doesn't couple to the ShotList view hierarchy.
    // If we grow a third caller we'll promote this to ShotListItem.
    private func isMustHave(_ shot: ShotListItem) -> Bool {
        let p = (shot.priority ?? "").lowercased().trimmingCharacters(in: .whitespaces)
        return ["must", "must-have", "must_have", "musthave", "high", "critical"]
            .contains(p)
    }
}

// MARK: - Bits

private struct LabeledRow: View {
    let label: String
    let value: String
    var systemImage: String?

    var body: some View {
        HStack {
            if let systemImage {
                Image(systemName: systemImage)
                    .foregroundStyle(.secondary)
                    .frame(width: 20)
            }
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct ContractStatusBadge: View {
    let status: Contract.Status

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.vertical, 3)
            .padding(.horizontal, 8)
            .background(Capsule().fill(color.opacity(0.15)))
            .foregroundStyle(color)
    }

    private var label: String {
        switch status {
        case .draft: return "Kladd"
        case .sent: return "Sendt"
        case .signed: return "Signert ✓"
        case .expired: return "Utløpt"
        }
    }

    private var color: Color {
        switch status {
        case .draft: return .secondary
        case .sent: return .blue
        case .signed: return .green
        case .expired: return .red
        }
    }
}
