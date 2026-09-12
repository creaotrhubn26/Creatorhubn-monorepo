import SwiftUI
import UniformTypeIdentifiers

/// Entry: pick a project, then show its revisions.
struct RevisionsEntryView: View {
    @State private var project: BackendProjectSummary?

    var body: some View {
        if let project {
            RevisionsView(model: RevisionsModel(project: project))
        } else {
            ProjectSelectionView { project = $0 }
        }
    }
}

struct RevisionsView: View {
    @Environment(\.dismiss) private var dismiss
    @State var model: RevisionsModel
    @State private var showFileImporter = false
    @State private var cullSessionId: UUID?

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Revisjoner")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Lukk") { dismiss() } }
                }
                .fileImporter(
                    isPresented: $showFileImporter,
                    allowedContentTypes: [.folder, .image, .rawImage],
                    allowsMultipleSelection: true,
                ) { result in
                    model.addCard(result)
                }
                .navigationDestination(item: $cullSessionId) { sessionId in
                    if let owner = model.ownerUserId {
                        LiveCullView(sessionId: sessionId, ownerUserId: owner)
                    }
                }
                .task { await model.load() }
        }
    }

    @ViewBuilder private var content: some View {
        if model.loading {
            ProgressView("Henter revisjoner …")
        } else {
            List {
                if let message = model.statusMessage {
                    Section { Text(message).font(.callout) }
                }
                if let error = model.errorMessage {
                    Section { Text(error).font(.callout).foregroundStyle(.red) }
                }

                revisionsSection
                cardSection
                if model.imported { deliverSection }
            }
        }
    }

    private var revisionsSection: some View {
        Section("Kunden ønsker endringer (\(model.openRevisions.count))") {
            if model.openRevisions.isEmpty {
                Text("Ingen åpne revisjoner for dette prosjektet.")
                    .foregroundStyle(.secondary)
            }
            ForEach(model.openRevisions) { revision in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: model.isFound(revision) ? "checkmark.circle.fill" : "circle.dashed")
                        .foregroundStyle(model.isFound(revision) ? .green : .secondary)
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(revision.originalFilename).font(.subheadline.weight(.semibold))
                        if !revision.note.isEmpty {
                            Text(revision.note).font(.callout).foregroundStyle(.secondary)
                        }
                        if revision.status == "in_progress" {
                            Text("Under arbeid").font(.caption2).foregroundStyle(.orange)
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private var cardSection: some View {
        Section("Hent originalene fra minnekort") {
            if model.cardsScanned > 0 {
                LabeledContent("Funnet", value: "\(model.foundCount) av \(model.openRevisions.count)")
                if model.missingCount > 0 {
                    Text("\(model.missingCount) mangler — sett inn neste kort og søk igjen.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Button {
                showFileImporter = true
            } label: {
                Label(model.cardsScanned == 0 ? "Koble til minnekort" : "Legg til nytt kort", systemImage: "sdcard")
            }
            .disabled(model.working || model.openRevisions.isEmpty)

            if model.foundCount > 0, !model.imported {
                Button {
                    Task { await model.importAndStage() }
                } label: {
                    if model.working {
                        ProgressView()
                    } else {
                        Label("Importer \(model.foundCount) og rediger", systemImage: "wand.and.stars")
                    }
                }
                .disabled(model.working)
            }
        }
    }

    private var deliverSection: some View {
        Section("Ferdig redigert?") {
            Text("Rediger bildene i Redigering-fanen (de ligger øverst), velg så:")
                .font(.caption)
                .foregroundStyle(.secondary)
            if let sessionId = model.importedSessionId {
                Button {
                    cullSessionId = sessionId
                } label: {
                    Label("Marker/cull bildene", systemImage: "checkmark.circle")
                }
            }
            Button {
                Task { await model.finish(deliver: true) }
            } label: {
                Label("Lever revidert til kunde", systemImage: "paperplane")
            }
            .disabled(model.working)
            Button {
                Task { await model.finish(deliver: false) }
            } label: {
                Label("Lagre kun på iPad", systemImage: "internaldrive")
            }
            .disabled(model.working)
        }
    }
}
