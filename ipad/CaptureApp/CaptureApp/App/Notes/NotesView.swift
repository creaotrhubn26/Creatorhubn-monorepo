import SwiftUI

/// Full "Notater" surface — contextual field notes. Pinned float to the
/// top; search across body/tags/context. Tap the I dag Notater card to get
/// here. Voice dictation + Claude AI actions land in the next layer.
struct NotesView: View {
    @State private var store = NotesStore.shared
    @State private var query = ""
    @State private var editing: FieldNote?
    @State private var creating = false

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
            ToolbarItem(placement: .primaryAction) {
                Button { creating = true } label: { Image(systemName: "square.and.pencil") }
            }
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
                        .focused($bodyFocused)
                        .overlay(alignment: .topLeading) {
                            if note.body.isEmpty {
                                Text("Skriv et notat… (mic på tastaturet for diktering)")
                                    .foregroundStyle(CHTheme.textMuted).padding(.top, 8).allowsHitTesting(false)
                            }
                        }
                        .listRowBackground(CHTheme.surface)
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
        }
        .chBranded()
    }
}
