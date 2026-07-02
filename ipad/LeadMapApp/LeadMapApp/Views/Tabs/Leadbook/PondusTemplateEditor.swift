// PondusTemplateEditor.swift
//
// SuperAdmin-editor for Leadgrid Pondus-maler.
//
// Design-mål: enkel, funksjonell editor som lar SuperAdmin fylle inn
// navn/kategori/kind/score + editere steps (legg til / fjern / reorder)
// + editere innvendinger + toggle publisering. Ingen drag-and-drop
// (bruker opp-/ned-knapper for reorder — Swift 6 concurrency-vennlig
// og krever ikke tilleggs-libs).
//
// Rolle-guard: view antar at caller allerede har sjekket
// `appState.isSuperAdmin`; ellers vil backend uansett returnere 403
// på publish/save-mutations.

import SwiftUI

struct PondusTemplateEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    private let store: PondusStore
    /// Nil = ny mal, ellers rediger eksisterende.
    private let existing: PondusTemplateDTO?

    // MARK: - Form state
    @State private var name: String
    @State private var description: String
    @State private var category: String
    @State private var kind: String
    @State private var score: Int
    @State private var steps: [PondusStepDTO]
    @State private var objections: [PondusObjectionDTO]
    @State private var isPublished: Bool
    @State private var isSaving = false
    @State private var errorText: String?

    init(store: PondusStore, existing: PondusTemplateDTO? = nil) {
        self.store = store
        self.existing = existing
        _name = State(initialValue: existing?.name ?? "")
        _description = State(initialValue: existing?.description ?? "")
        _category = State(initialValue: existing?.category ?? PondusCategory.firstContact)
        _kind = State(initialValue: existing?.kind ?? PondusKind.telephone.rawValue)
        _score = State(initialValue: existing?.score ?? 80)
        _steps = State(initialValue: existing?.orderedSteps ?? [])
        _objections = State(initialValue: existing?.objections ?? [])
        _isPublished = State(initialValue: existing?.isPublished ?? false)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Grunndata") {
                    TextField("Mal-navn", text: $name)
                    TextField("Beskrivelse", text: $description, axis: .vertical)
                        .lineLimit(2...4)

                    Picker("Kategori", selection: $category) {
                        Text("Første kontakt").tag(PondusCategory.firstContact)
                        Text("Møteåpning").tag(PondusCategory.meetingOpen)
                        Text("Prisinnvending").tag(PondusCategory.priceObjection)
                        Text("Beslutningstaker").tag(PondusCategory.decisionMaker)
                        Text("Oppfølging").tag(PondusCategory.followUp)
                        Text("Egendefinert").tag(PondusCategory.custom)
                    }

                    Picker("Kanal", selection: $kind) {
                        ForEach(PondusKind.allCases, id: \.rawValue) { k in
                            Text(kindLabel(k)).tag(k.rawValue)
                        }
                    }

                    HStack {
                        Text("Pondus-score")
                        Spacer()
                        Text("\(score)").font(.system(.body, design: .rounded).monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    Slider(value: Binding(
                        get: { Double(score) },
                        set: { score = Int($0.rounded()) }
                    ), in: 0...100, step: 1)
                }

                Section("Steg") {
                    ForEach(Array(steps.enumerated()), id: \.element.id) { idx, step in
                        stepRow(index: idx, step: step)
                    }
                    .onDelete { indices in
                        steps.remove(atOffsets: indices)
                        reindex()
                    }
                    .onMove { source, dest in
                        steps.move(fromOffsets: source, toOffset: dest)
                        reindex()
                    }
                    Button {
                        addStep()
                    } label: {
                        Label("Legg til steg", systemImage: "plus.circle.fill")
                    }
                }

                Section("Innvendinger") {
                    ForEach(Array(objections.enumerated()), id: \.element.id) { idx, obj in
                        objectionRow(index: idx, objection: obj)
                    }
                    .onDelete { indices in
                        objections.remove(atOffsets: indices)
                    }
                    Button {
                        addObjection()
                    } label: {
                        Label("Legg til innvending", systemImage: "shield.fill")
                    }
                }

                Section("Publisering") {
                    Toggle("Publisert (synlig for alle brukere)", isOn: $isPublished)
                    if existing?.isLeadgridGlobal ?? true {
                        Text("Leadgrid-global mal — alle organisasjoner får tilgang når publisert.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Org-lokal mal — kun din egen organisasjon får tilgang.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if let err = errorText {
                    Section {
                        Text(err)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(existing == nil ? "Ny Pondus-mal" : "Rediger mal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Lagre").bold()
                        }
                    }
                    .disabled(isSaving || name.isEmpty)
                }
                #if os(iOS)
                ToolbarItem(placement: .navigationBarLeading) {
                    EditButton()
                }
                #endif
            }
        }
    }

    // MARK: - Rows

    @ViewBuilder
    private func stepRow(index: Int, step: PondusStepDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Steg \(index + 1)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                if index > 0 {
                    Button {
                        steps.swapAt(index, index - 1)
                        reindex()
                    } label: {
                        Image(systemName: "arrow.up.circle").font(.system(size: 18))
                    }.buttonStyle(.plain)
                }
                if index < steps.count - 1 {
                    Button {
                        steps.swapAt(index, index + 1)
                        reindex()
                    } label: {
                        Image(systemName: "arrow.down.circle").font(.system(size: 18))
                    }.buttonStyle(.plain)
                }
            }
            TextField("Steg-tittel (Formål, Åpning …)", text: Binding(
                get: { step.title },
                set: { newTitle in
                    if let idx = steps.firstIndex(where: { $0.id == step.id }) {
                        steps[idx] = PondusStepDTO(
                            id: step.id,
                            title: newTitle,
                            subtitle: step.subtitle,
                            icon: step.icon,
                            prompt: step.prompt,
                            minLength: step.minLength,
                            maxLength: step.maxLength,
                            order: step.order
                        )
                    }
                }
            ))
            TextField("Nøkkel (formal, opening …)", text: Binding(
                get: { step.id },
                set: { newId in
                    if let idx = steps.firstIndex(where: { $0.id == step.id }) {
                        steps[idx] = PondusStepDTO(
                            id: newId,
                            title: step.title,
                            subtitle: step.subtitle,
                            icon: step.icon,
                            prompt: step.prompt,
                            minLength: step.minLength,
                            maxLength: step.maxLength,
                            order: step.order
                        )
                    }
                }
            ))
            .font(.system(size: 12, design: .monospaced))
            .foregroundStyle(.secondary)
            TextField("Prompt / eksempeltekst", text: Binding(
                get: { step.prompt ?? "" },
                set: { newVal in
                    if let idx = steps.firstIndex(where: { $0.id == step.id }) {
                        steps[idx] = PondusStepDTO(
                            id: step.id,
                            title: step.title,
                            subtitle: step.subtitle,
                            icon: step.icon,
                            prompt: newVal,
                            minLength: step.minLength,
                            maxLength: step.maxLength,
                            order: step.order
                        )
                    }
                }
            ), axis: .vertical)
            .lineLimit(2...5)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func objectionRow(index: Int, objection: PondusObjectionDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Innvending \(index + 1)")
                .font(.caption)
                .foregroundStyle(.secondary)
            TextField("Innvending", text: Binding(
                get: { objection.prompt },
                set: { newVal in
                    if let idx = objections.firstIndex(where: { $0.id == objection.id }) {
                        objections[idx] = PondusObjectionDTO(
                            id: objection.id,
                            prompt: newVal,
                            response: objection.response
                        )
                    }
                }
            ))
            TextField("Foreslått svar", text: Binding(
                get: { objection.response },
                set: { newVal in
                    if let idx = objections.firstIndex(where: { $0.id == objection.id }) {
                        objections[idx] = PondusObjectionDTO(
                            id: objection.id,
                            prompt: objection.prompt,
                            response: newVal
                        )
                    }
                }
            ), axis: .vertical)
            .lineLimit(2...4)
        }
        .padding(.vertical, 4)
    }

    // MARK: - Helpers

    private func kindLabel(_ k: PondusKind) -> String {
        switch k {
        case .telephone: return "Telefon"
        case .video: return "Video"
        case .email: return "E-post"
        case .meeting: return "Møte"
        case .field: return "Felt"
        }
    }

    private func addStep() {
        let idx = steps.count
        let key = "step_\(idx + 1)"
        steps.append(PondusStepDTO(
            id: key,
            title: "Nytt steg",
            subtitle: nil,
            icon: "circle.fill",
            prompt: nil,
            minLength: nil,
            maxLength: nil,
            order: idx
        ))
    }

    private func addObjection() {
        objections.append(PondusObjectionDTO(
            id: "obj_\(objections.count + 1)",
            prompt: "Ny innvending",
            response: ""
        ))
    }

    private func reindex() {
        // Rekalkuler order-feltet basert på nåværende rekkefølge.
        for (idx, step) in steps.enumerated() {
            steps[idx] = PondusStepDTO(
                id: step.id,
                title: step.title,
                subtitle: step.subtitle,
                icon: step.icon,
                prompt: step.prompt,
                minLength: step.minLength,
                maxLength: step.maxLength,
                order: idx
            )
        }
    }

    // MARK: - Save

    private func save() async {
        let api = appState.api
        isSaving = true
        defer { isSaving = false }
        errorText = nil

        // Reindex før lagring
        reindex()

        if let existing {
            let payload = UpdatePondusTemplatePayload(
                name: name,
                description: description.isEmpty ? nil : description,
                category: category,
                kind: kind,
                score: score,
                steps: steps,
                objections: objections
            )
            guard let updated = await store.update(id: existing.id, payload, api: api) else {
                errorText = store.lastError ?? "Kunne ikke lagre mal."
                return
            }
            // Toggle publisering hvis endret
            if updated.isPublished != isPublished {
                _ = await store.publish(id: existing.id, published: isPublished, api: api)
            }
            dismiss()
        } else {
            let payload = CreatePondusTemplatePayload(
                name: name,
                description: description.isEmpty ? nil : description,
                category: category,
                kind: kind,
                score: score,
                steps: steps,
                objections: objections,
                orgId: nil // Leadgrid-global som default (SuperAdmin-editor)
            )
            guard let created = await store.create(payload, api: api) else {
                errorText = store.lastError ?? "Kunne ikke opprette mal."
                return
            }
            if isPublished {
                _ = await store.publish(id: created.id, published: true, api: api)
            }
            dismiss()
        }
    }
}
