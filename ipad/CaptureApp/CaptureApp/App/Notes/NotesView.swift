import SwiftUI
import PhotosUI

/// Full "Notater" surface — contextual field notes. Pinned float to the
/// top; search across body/tags/context. Tap the I dag Notater card to get
/// here. Voice dictation + Claude AI actions land in the next layer.
struct NotesView: View {
    @State private var store = NotesStore.shared
    @State private var query = ""
    @State private var editing: FieldNote?
    @State private var creating = false
    @State private var showVisionTools = false

    private var results: [FieldNote] { store.search(query) }

    var body: some View {
        Group {
            if store.notes.isEmpty {
                ContentUnavailableView {
                    Label("Ingen notater ennå", systemImage: "note.text")
                } description: {
                    Text("Fang en idé, en huskelapp til en shoot, eller en klient-detalj — koblet til riktig prosjekt.")
                } actions: {
                    Button("Nytt notat") { creating = true }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    ForEach(results) { note in
                        Button { editing = note } label: { NoteRow(note: note) }
                            .listRowBackground(CHTheme.surface)
                            .swipeActions(edge: .leading) {
                                Button { store.togglePin(note) } label: {
                                    Label(note.pinned ? "Løsne" : "Fest", systemImage: note.pinned ? "pin.slash" : "pin")
                                }.tint(CHTheme.accent)
                            }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) { store.delete(note) } label: {
                                    Label("Slett", systemImage: "trash")
                                }
                            }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .searchable(text: $query, prompt: "Søk i notater")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle("Notater")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if #available(iOS 18, *) {
                ToolbarItem(placement: .secondaryAction) {
                    Button { showVisionTools = true } label: {
                        Label("Vision-verktøy", systemImage: "text.viewfinder")
                    }
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button { creating = true } label: { Image(systemName: "square.and.pencil") }
            }
        }
        .sheet(isPresented: $showVisionTools) {
            if #available(iOS 18, *) { VisionToolsView() }
        }
        .sheet(item: $editing) { note in
            NoteEditorView(note: note) { store.update($0) } onDelete: { store.delete($0) }
        }
        .sheet(isPresented: $creating) {
            NoteEditorView(note: FieldNote(body: "")) { store.add($0) } onDelete: { _ in }
        }
    }
}

struct NoteRow: View {
    let note: FieldNote
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                if note.pinned {
                    Image(systemName: "pin.fill").font(.caption2).foregroundStyle(CHTheme.accent)
                }
                Text(note.title).font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textPrimary).lineLimit(1)
                Spacer()
                Text(DashboardDate.relative(note.updatedAt.ISO8601Format()))
                    .font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
            if note.body.contains("\n") || note.body.count > note.title.count {
                Text(note.body).font(.caption).foregroundStyle(CHTheme.textSecondary).lineLimit(2)
            }
            HStack(spacing: 8) {
                if note.contextKind != .none {
                    Label(note.contextLabel ?? note.contextKind.label, systemImage: note.contextKind.icon)
                        .font(.caption2).foregroundStyle(CHTheme.accentSoft)
                }
                ForEach(note.tags.prefix(3), id: \.self) { tag in
                    Text("#\(tag)").font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Create / edit a note. Body + pin + context + tags. (Voice + AI actions
/// arrive in the next layer.)
struct NoteEditorView: View {
    @State private var note: FieldNote
    let onSave: (FieldNote) -> Void
    let onDelete: (FieldNote) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var tagText: String
    @FocusState private var bodyFocused: Bool

    // On-device notat-innsikt (Apple Intelligence) + foto-kontekst.
    @State private var ai = NotesIntelligenceFactory.make()
    @State private var aiLoading = false
    @State private var insights: NoteInsights?
    @State private var aiError: String?
    @State private var photoItem: PhotosPickerItem?

    init(note: FieldNote, onSave: @escaping (FieldNote) -> Void, onDelete: @escaping (FieldNote) -> Void) {
        _note = State(initialValue: note)
        self.onSave = onSave
        self.onDelete = onDelete
        _tagText = State(initialValue: note.tags.joined(separator: ", "))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $note.body)
                        .frame(minHeight: 160)
                        .foregroundStyle(CHTheme.textPrimary)
                        .scrollContentBackground(.hidden)
                        .appWritingTools(.complete)
                        .focused($bodyFocused)
                        .overlay(alignment: .topLeading) {
                            if note.body.isEmpty {
                                Text("Skriv et notat… (mic på tastaturet for diktering)")
                                    .foregroundStyle(CHTheme.textMuted).padding(.top, 8).allowsHitTesting(false)
                            }
                        }
                        .listRowBackground(CHTheme.surface)
                }

                // Foto-kontekst + on-device innsikt.
                Section {
                    if let photo = note.photo, !photo.isEmpty {
                        VStack(alignment: .leading, spacing: 3) {
                            Label("Bilde registrert", systemImage: "camera.metering.matrix")
                                .font(.caption.weight(.semibold)).foregroundStyle(CHTheme.accentSoft)
                            Text(photo.summaryLine)
                                .font(.caption2).foregroundStyle(CHTheme.textSecondary)
                        }
                        .listRowBackground(CHTheme.surface)
                    }
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label(note.photo == nil ? "Koble til bilde (EXIF)" : "Bytt bilde",
                              systemImage: "photo.badge.plus")
                    }
                    .listRowBackground(CHTheme.surface)

                    if ai.isAvailable {
                        Button { runInsights() } label: {
                            HStack {
                                Image(systemName: "sparkles")
                                Text(aiLoading ? "Analyserer…" : "Oppsummer + oppgaver")
                                if aiLoading { Spacer(); ProgressView() }
                            }
                        }
                        .disabled(aiLoading || note.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .listRowBackground(CHTheme.surface)
                    } else if let reason = ai.unavailableReason {
                        Label(reason.userMessage, systemImage: "sparkles")
                            .font(.caption).foregroundStyle(CHTheme.textMuted)
                            .listRowBackground(CHTheme.surface)
                    }

                    if let insights {
                        if !insights.summary.isEmpty {
                            Text(insights.summary)
                                .font(.callout).foregroundStyle(CHTheme.textPrimary)
                                .listRowBackground(CHTheme.surface)
                        }
                        ForEach(insights.tasks, id: \.self) { task in
                            Label(task, systemImage: "checkmark.circle")
                                .font(.callout).foregroundStyle(CHTheme.textPrimary)
                                .listRowBackground(CHTheme.surface)
                        }
                        if !insights.tasks.isEmpty {
                            Button("Legg oppgavene i notatet") { appendTasks(insights.tasks) }
                                .font(.caption).foregroundStyle(CHTheme.accent)
                                .listRowBackground(CHTheme.surface)
                        }
                    }
                    if let aiError {
                        Text(aiError).font(.caption).foregroundStyle(.orange)
                            .listRowBackground(CHTheme.surface)
                    }
                } header: {
                    Text("Innsikt (på enheten)")
                }

                Section("Kobling") {
                    Picker("Kontekst", selection: $note.contextKind) {
                        ForEach(FieldNote.ContextKind.allCases, id: \.self) { kind in
                            Label(kind.label, systemImage: kind.icon).tag(kind)
                        }
                    }
                    .listRowBackground(CHTheme.surface)
                    if note.contextKind != .none {
                        TextField("Navn (f.eks. «Nordic Skin»)", text: Binding(
                            get: { note.contextLabel ?? "" }, set: { note.contextLabel = $0 },
                        ))
                        .listRowBackground(CHTheme.surface)
                    }
                }
                Section("Detaljer") {
                    Toggle("Fest øverst", isOn: $note.pinned).tint(CHTheme.accent)
                        .listRowBackground(CHTheme.surface)
                    TextField("Tagger (komma)", text: $tagText)
                        .listRowBackground(CHTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle(note.body.isEmpty ? "Nytt notat" : "Rediger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lagre") {
                        note.tags = tagText.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                        if !note.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { onSave(note) }
                        dismiss()
                    }
                    .disabled(note.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear { if note.body.isEmpty { bodyFocused = true } }
            .onChange(of: photoItem) { _, newItem in
                loadPhotoMetadata(newItem)
            }
        }
        .chBranded()
    }

    /// Kjør on-device oppsummering + oppgave-uttrekk (med evt. foto-EXIF).
    private func runInsights() {
        let body = note.body
        let photo = note.photo
        aiLoading = true
        aiError = nil
        Task {
            do {
                insights = try await ai.insights(for: body, photo: photo)
            } catch let failure as NotesIntelligence.Failure {
                switch failure {
                case .emptyNote: aiError = "Skriv litt tekst først."
                case .unavailable(let reason): aiError = reason.userMessage
                }
            } catch {
                aiError = "Kunne ikke analysere akkurat nå."
            }
            aiLoading = false
        }
    }

    private func appendTasks(_ tasks: [String]) {
        let block = tasks.map { "• \($0)" }.joined(separator: "\n")
        note.body = note.body.isEmpty ? block : note.body + "\n\n" + block
    }

    /// Registrer EXIF (+ evt. filnavn) fra et valgt bilde på notatet.
    private func loadPhotoMetadata(_ item: PhotosPickerItem?) {
        guard let item else { return }
        Task {
            guard let data = try? await item.loadTransferable(type: Data.self) else { return }
            let meta = PhotoMetadataExtractor.extract(from: data, fileName: nil)
            await MainActor.run { note.photo = meta }
        }
    }
}
