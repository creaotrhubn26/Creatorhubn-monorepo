import SwiftUI
import UniformTypeIdentifiers

/// Memory-card import flow: pick → review → import + back up to B2 → cull.
struct CardImportView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model = CardImportModel()
    @State private var showFileImporter = false
    @State private var showProjectPicker = false
    @State private var cullSessionId: UUID?

    var body: some View {
        NavigationStack {
            content
                .padding()
                .navigationTitle("Importer fra minnekort")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Lukk") { dismiss() }
                    }
                }
                .fileImporter(
                    isPresented: $showFileImporter,
                    allowedContentTypes: [.folder, .image, .rawImage],
                    allowsMultipleSelection: true,
                ) { result in
                    model.handlePick(result)
                }
                .sheet(isPresented: $showProjectPicker) {
                    ProjectSelectionView { project in
                        showProjectPicker = false
                        Task { await model.runImport(project: project) }
                    }
                }
                .navigationDestination(item: $cullSessionId) { sessionId in
                    if let owner = model.ownerUserId {
                        LiveCullView(sessionId: sessionId, ownerUserId: owner)
                    }
                }
        }
    }

    @ViewBuilder private var content: some View {
        switch model.phase {
        case .picking: pickingView
        case .review: reviewView
        case .importing: progressView(title: "Importerer fra kort …")
        case .backingUp: progressView(title: "Sikkerhetskopierer til skyen …")
        case .done: doneView
        case .failed(let message): failedView(message)
        }
    }

    // MARK: - Pick

    private var pickingView: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "sdcard")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)
            Text("Importer bilder fra minnekort")
                .font(.title2.bold())
            Text("Koble til kortleseren, velg så kortet (eller DCIM-mappen). Vi parer RAW + JPEG, hopper over det du allerede har, kobler til prosjekt og sikkerhetskopierer originalene til skyen (B2).")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button {
                showFileImporter = true
            } label: {
                Label("Velg fra minnekort", systemImage: "folder")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 40)
            Spacer()
        }
    }

    // MARK: - Review

    private var reviewView: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Klar til import")
                .font(.title2.bold())

            VStack(spacing: 0) {
                statRow("Bilder/serier", "\(model.groups.count)")
                Divider()
                statRow("Med RAW", "\(model.rawCount)")
                Divider()
                statRow("Med JPEG", "\(model.jpegCount)")
                Divider()
                statRow("Total størrelse", Self.bytes(model.totalBytes))
            }
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 6) {
                Text("Navn på økt")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("Økt-navn", text: $model.sessionName)
                    .textFieldStyle(.roundedBorder)
            }

            Text("Duplikater (samme fil importert før) hoppes automatisk over.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()

            Button {
                showProjectPicker = true
            } label: {
                Label("Velg prosjekt og start backup", systemImage: "arrow.up.to.line")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
        }
    }

    // MARK: - Progress

    private func progressView(title: String) -> some View {
        VStack(spacing: 20) {
            Spacer()
            ProgressView(value: model.fractionComplete)
                .progressViewStyle(.linear)
                .padding(.horizontal)
            Text(title).font(.headline)
            if model.progressTotal > 0 {
                Text("\(model.progressDone) av \(model.progressTotal)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if !model.statusLine.isEmpty {
                Text(model.statusLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
        }
    }

    // MARK: - Done

    private var doneView: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
            Text("Importert og sikkerhetskopiert")
                .font(.title2.bold())
            VStack(spacing: 4) {
                Text("\(model.groups.count - model.duplicateCount) importert til skyen (B2).")
                if model.duplicateCount > 0 {
                    Text("\(model.duplicateCount) hoppet over (allerede inne).")
                        .foregroundStyle(.secondary)
                }
            }
            .font(.callout)
            .multilineTextAlignment(.center)

            Spacer()

            if model.importedSessionId != nil {
                Button {
                    cullSessionId = model.importedSessionId
                } label: {
                    Label("Start cull", systemImage: "checkmark.circle")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
            }
            Text("Du kan også redigere bildene i Redigering-fanen.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Ferdig") { dismiss() }
                .padding(.top, 4)
        }
    }

    // MARK: - Failed

    private func failedView(_ message: String) -> some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.orange)
            Text("Noe gikk galt")
                .font(.title3.bold())
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Spacer()
            Button("Prøv igjen") { model.reset() }
                .buttonStyle(.borderedProminent)
            Button("Lukk") { dismiss() }
                .padding(.top, 4)
        }
    }

    // MARK: - Helpers

    private func statRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).fontWeight(.semibold)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }

    private static func bytes(_ count: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: count, countStyle: .file)
    }
}
