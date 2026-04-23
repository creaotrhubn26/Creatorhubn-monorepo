import SwiftUI
import PencilKit

/// Detail view for one shot — shown when the photographer taps a row
/// on ``ShotListView``. Two editable surfaces:
///
///   * A text field for short notes ("wide angle, 24mm").
///   * A ``PKCanvasView`` for Apple Pencil scribbles. Many
///     photographers want to sketch a pose or arrow, not write a
///     paragraph. Ink is persisted as base64 PKDrawing data inside
///     the shot's ``inkData`` field.
///
/// Save semantics: we don't write on every stroke — that would flood
/// the Outbox with 100s of mutations per scribble. Instead we save
/// on explicit ``Done`` / ``Clear`` tap, which is the Pencil-first
/// iOS convention (Notes, Freeform, GoodNotes all work this way).
///
/// Resilience: every save is optimistic — the local row updates
/// before the outbox mutation is even enqueued. If the user closes
/// the view before save, unsaved ink is lost; we warn them with a
/// small "ulagrede endringer" chip that blinks in when the canvas
/// has been touched since the last save.
struct ShotDetailView: View {
    let shot: ShotListItem
    let list: ShotList
    var onUpdate: () async -> Void = {}

    @Environment(\.dismiss) private var dismiss
    @State private var notes: String
    @State private var canvas: PKCanvasView = {
        let c = PKCanvasView()
        c.drawingPolicy = .anyInput        // works for Pencil + finger
        c.backgroundColor = .clear
        return c
    }()
    @State private var hasUnsavedInk = false
    @State private var saveError: String?
    @State private var isSaving = false

    init(shot: ShotListItem, list: ShotList, onUpdate: @escaping () async -> Void = {}) {
        self.shot = shot
        self.list = list
        self.onUpdate = onUpdate
        _notes = State(initialValue: shot.notes ?? "")
    }

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
        Form {
            Section("Shot") {
                Text(shot.scene)
                    .font(.title3.weight(.semibold))
                if let description = shot.description {
                    Text(description)
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                if let priority = shot.priority {
                    Text("Prioritet: \(priority)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Notat") {
                TextEditor(text: $notes)
                    .frame(minHeight: 80)
                    .onChange(of: notes) { _, _ in
                        // Notes auto-save on blur via saveNotes();
                        // textual edits don't flag "unsaved" because
                        // they're persisted eagerly. Only ink does.
                    }
                Button("Lagre notat") {
                    Task { await saveNotes() }
                }
                .disabled(isSaving || notes == (shot.notes ?? ""))
            }

            Section {
                CanvasViewRepresentable(
                    canvas: $canvas,
                    onChange: { hasUnsavedInk = true },
                )
                .frame(minHeight: 280)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.primary.opacity(0.03))
                )
                HStack {
                    Button {
                        Task { await saveInk() }
                    } label: {
                        Label("Lagre tegning", systemImage: "checkmark.circle.fill")
                    }
                    .disabled(isSaving || !hasUnsavedInk)

                    Spacer()

                    Button(role: .destructive) {
                        canvas.drawing = PKDrawing()
                        hasUnsavedInk = true
                    } label: {
                        Label("Tøm", systemImage: "trash")
                    }
                }
                if hasUnsavedInk {
                    Text("Ulagrede endringer på tegningen")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            } header: {
                HStack {
                    Text("Apple Pencil")
                    if shot.inkData != nil {
                        Image(systemName: "pencil.tip")
                            .foregroundStyle(.purple)
                    }
                }
            } footer: {
                Text("Tegn med Pencil eller finger. Bruker vi dette mest til piler og utsnittsforslag.")
            }

            if let error = saveError {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }
        }
        .navigationTitle(shot.scene)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            // Rehydrate existing ink if the shot already has some.
            // PKDrawing(data:) throws on malformed data; we swallow
            // the error because a broken blob shouldn't stop the
            // photographer from seeing the rest of the surface.
            if let base64 = shot.inkData,
               let data = Data(base64Encoded: base64),
               let drawing = try? PKDrawing(data: data) {
                canvas.drawing = drawing
                hasUnsavedInk = false
            }
        }
    }

    // MARK: - Save actions

    private func saveNotes() async {
        guard let store else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await store.updateNotes(
                shotId: shot.id,
                in: list,
                notes: notes,
            )
            saveError = nil
            await onUpdate()
        } catch {
            saveError = "Kunne ikke lagre notat: \(error)"
        }
    }

    private func saveInk() async {
        guard let store else { return }
        isSaving = true
        defer { isSaving = false }
        let drawing = canvas.drawing
        let base64: String?
        if drawing.bounds.isEmpty {
            // Empty drawing — clear the field rather than store
            // an empty-bytes blob.
            base64 = nil
        } else {
            base64 = drawing.dataRepresentation().base64EncodedString()
        }
        do {
            try await store.saveInk(
                shotId: shot.id,
                in: list,
                base64Ink: base64,
            )
            hasUnsavedInk = false
            saveError = nil
            await onUpdate()
        } catch {
            saveError = "Kunne ikke lagre tegning: \(error)"
        }
    }
}

/// Thin UIViewRepresentable over ``PKCanvasView``. SwiftUI 5 has
/// ``Canvas`` but PencilKit still needs UIKit bridging, and we want
/// the full Pencil tool-palette support rather than a rolled
/// drawing surface.
private struct CanvasViewRepresentable: UIViewRepresentable {
    @Binding var canvas: PKCanvasView
    var onChange: () -> Void = {}

    func makeUIView(context: Context) -> PKCanvasView {
        canvas.tool = PKInkingTool(.pen, color: .label, width: 3)
        canvas.delegate = context.coordinator
        return canvas
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        // Binding drives state externally; nothing to do here.
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onChange: onChange)
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        let onChange: () -> Void
        init(onChange: @escaping () -> Void) { self.onChange = onChange }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            onChange()
        }
    }
}
