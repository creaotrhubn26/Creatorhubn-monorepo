// UtstyrsregisterSheet.swift — org-eid utstyr utlevert til medlemmer (2026-07-17)
//
// Leder-flate for utstyrsregisteret: nettbrett/telefon/laptop/klær/ID-kort
// registreres på org-en, utleveres til teammedlemmer (backend varsler
// mottakeren), innleveres, og status-endres (tapt/defekt/kassert) — alt via
// de ekte /api/leadgrid/equipment-endepunktene i APIClient.
//
// Demo-modus: 5 mock-rader (én per kind) + toast-only-handlinger merket
// «(demo — lagres ikke)». Ekte modus: API + ærlige tom-tilstander.
//
// Hele flaten er entitlement-gated via .gated(.utstyrsregister).

import SwiftUI

// MARK: - Kind/status-metadata (deles med «Mitt utstyr» i MinProfil)

enum UtstyrKind {
    /// (nøkkel, norsk label, SF-symbol) — samme rekkefølge som filter-chipsene.
    static let all: [(key: String, label: String, icon: String)] = [
        ("nettbrett", "Nettbrett", "ipad"),
        ("telefon", "Telefon", "iphone"),
        ("laptop", "Laptop", "laptopcomputer"),
        ("klaer", "Klær", "tshirt.fill"),
        ("id_kort", "ID-kort", "person.text.rectangle.fill"),
        ("annet", "Annet", "shippingbox.fill"),
    ]

    static func icon(_ kind: String) -> String {
        all.first { $0.key == kind }?.icon ?? "shippingbox.fill"
    }

    static func label(_ kind: String) -> String {
        all.first { $0.key == kind }?.label ?? kind.capitalized
    }
}

enum UtstyrStatus {
    static func label(_ status: String) -> String {
        switch status {
        case "tilgjengelig": return "Tilgjengelig"
        case "utlevert":     return "Utlevert"
        case "tapt":         return "Tapt"
        case "defekt":       return "Defekt"
        case "kassert":      return "Kassert"
        default:             return status.capitalized
        }
    }

    static func color(_ status: String) -> Color {
        switch status {
        case "tilgjengelig": return TBrand.green
        case "utlevert":     return TBrand.purpleLight
        case "tapt":         return TBrand.red
        case "defekt":       return TBrand.orange
        case "kassert":      return TBrand.textTertiary
        default:             return TBrand.textSecondary
        }
    }
}

// MARK: - Hoved-sheet

struct UtstyrsregisterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    @State private var items: [APIClient.EquipmentDTO] = []
    @State private var loading = true
    @State private var loadError: String?

    @State private var kindFilter: String?      // nil = Alle
    @State private var statusFilter: String?    // nil = Alle

    @State private var showCreate = false
    @State private var assignTarget: APIClient.EquipmentDTO?
    @State private var eventsTarget: APIClient.EquipmentDTO?
    @State private var discardTarget: APIClient.EquipmentDTO?

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    private var filtered: [APIClient.EquipmentDTO] {
        items.filter { item in
            (kindFilter == nil || item.kind == kindFilter)
                && (statusFilter == nil || item.status == statusFilter)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                TBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        kindFilterBar
                        statusFilterBar
                        listSection
                        Color.clear.frame(height: 90)
                    }
                    .padding(16)
                }
                // Toast-overlay: gjenbruker Team-fanens NotificationCenter-
                // toast så handlingene får synlig respons OPPÅ sheetet.
                TeamStubToastOverlay()
            }
            .navigationTitle("Utstyrsregister")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { newEquipmentBar }
            .task {
                // Attach er idempotent — sikrer at medlems-pickeren har
                // ekte teammedlemmer selv om Team-fanen ikke er besøkt.
                if !isDemo, let api = appState.api {
                    TeamLiveStore.shared.attach(api: api, appState: appState)
                }
                await load()
            }
            .sheet(isPresented: $showCreate) {
                UtstyrCreateSheet { await load() }
            }
            .sheet(item: $assignTarget) { item in
                UtstyrAssignPickerSheet(item: item) { await load() }
            }
            .sheet(item: $eventsTarget) { item in
                UtstyrEventLogSheet(item: item)
            }
            .confirmationDialog(
                "Kassere «\(discardTarget?.label ?? "")»? Utstyret markeres som kassert og kan ikke utleveres igjen.",
                isPresented: Binding(
                    get: { discardTarget != nil },
                    set: { if !$0 { discardTarget = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Kasser", role: .destructive) {
                    if let item = discardTarget { setStatus(item, "kassert") }
                    discardTarget = nil
                }
                Button("Avbryt", role: .cancel) { discardTarget = nil }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDragIndicator(.visible)
        .gated(.utstyrsregister)
    }

    // MARK: Filter-chips

    private var kindFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                filterChip(label: "Alle", icon: "square.grid.2x2.fill",
                           isActive: kindFilter == nil) { kindFilter = nil }
                ForEach(UtstyrKind.all, id: \.key) { k in
                    filterChip(label: k.label, icon: k.icon,
                               isActive: kindFilter == k.key) {
                        kindFilter = kindFilter == k.key ? nil : k.key
                    }
                }
            }
        }
    }

    private var statusFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                filterChip(label: "Alle statuser", icon: nil,
                           isActive: statusFilter == nil) { statusFilter = nil }
                ForEach(["utlevert", "tilgjengelig", "tapt", "defekt"], id: \.self) { s in
                    filterChip(label: UtstyrStatus.label(s), icon: nil,
                               tint: UtstyrStatus.color(s),
                               isActive: statusFilter == s) {
                        statusFilter = statusFilter == s ? nil : s
                    }
                }
            }
        }
    }

    private func filterChip(
        label: String, icon: String?, tint: Color = TBrand.purple,
        isActive: Bool, action: @escaping () -> Void
    ) -> some View {
        Button {
            withAnimation(.snappy(duration: 0.15)) { action() }
        } label: {
            HStack(spacing: 5) {
                if let icon {
                    Image(systemName: icon)
                        .font(.appScaled(size: 10, weight: .bold))
                }
                Text(label)
                    .font(.appScaled(size: 11, weight: .bold))
                    .fixedSize(horizontal: true, vertical: false)
            }
            .foregroundStyle(isActive ? .white : TBrand.textSecondary)
            .padding(.horizontal, 11).padding(.vertical, 8)
            .background(
                isActive ? AnyShapeStyle(tint) : AnyShapeStyle(TBrand.card),
                in: Capsule()
            )
            .overlay(Capsule().stroke(isActive ? tint.opacity(0.6) : TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Liste

    @ViewBuilder
    private var listSection: some View {
        if loading {
            HStack(spacing: 8) {
                ProgressView().tint(TBrand.purpleLight)
                Text("Laster utstyrsregisteret …")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(TBrand.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 28)
        } else if let feil = loadError {
            Text(feil)
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(.white.opacity(0.55))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
        } else if items.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "shippingbox.fill")
                    .font(.appScaled(size: 26))
                    .foregroundStyle(TBrand.textTertiary)
                Text("Ingen utstyr registrert enda — legg til med + Nytt utstyr")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 28)
        } else if filtered.isEmpty {
            Text("Ingen utstyr matcher filteret")
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(.white.opacity(0.55))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
        } else {
            LazyVStack(spacing: 6) {
                ForEach(filtered) { item in equipmentRow(item) }
            }
        }
    }

    private func equipmentRow(_ item: APIClient.EquipmentDTO) -> some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 9)
                    .fill(UtstyrStatus.color(item.status).opacity(0.18))
                Image(systemName: UtstyrKind.icon(item.kind))
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(UtstyrStatus.color(item.status))
            }
            .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.label)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let sekundaer = secondaryLine(item) {
                    Text(sekundaer)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                        .lineLimit(1)
                }
                if item.status == "utlevert", !item.assignedUserName.isEmpty {
                    Text("til \(item.assignedUserName)\(assignedDateSuffix(item))")
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(TBrand.purpleLight)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 8)

            statusChip(item)
            rowMenu(item)
        }
        .padding(10)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
        .contextMenu { menuContent(item) }
    }

    private func secondaryLine(_ item: APIClient.EquipmentDTO) -> String? {
        var parts: [String] = [UtstyrKind.label(item.kind)]
        if let s = item.serialNumber, !s.isEmpty { parts.append("SN \(s)") }
        if let s = item.size, !s.isEmpty { parts.append("Str. \(s)") }
        return parts.joined(separator: " · ")
    }

    private func assignedDateSuffix(_ item: APIClient.EquipmentDTO) -> String {
        guard let at = item.assignedAt, at.count >= 10 else { return "" }
        return " · \(at.prefix(10))"
    }

    private func statusChip(_ item: APIClient.EquipmentDTO) -> some View {
        Text(UtstyrStatus.label(item.status))
            .font(.appScaled(size: 9, weight: .black))
            .foregroundStyle(UtstyrStatus.color(item.status))
            .padding(.horizontal, 7).padding(.vertical, 4)
            .background(UtstyrStatus.color(item.status).opacity(0.16), in: Capsule())
            .overlay(Capsule().stroke(UtstyrStatus.color(item.status).opacity(0.4), lineWidth: 1))
            .fixedSize()
    }

    private func rowMenu(_ item: APIClient.EquipmentDTO) -> some View {
        Menu {
            menuContent(item)
        } label: {
            Image(systemName: "ellipsis")
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(TBrand.textSecondary)
                .frame(width: 32, height: 32)
                .background(TBrand.cardHi, in: Circle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func menuContent(_ item: APIClient.EquipmentDTO) -> some View {
        if item.status == "tilgjengelig" {
            Button {
                if isDemo {
                    TeamStubActions.toast("Utlevering (demo — lagres ikke)")
                } else {
                    assignTarget = item
                }
            } label: {
                Label("Utlever …", systemImage: "person.badge.plus")
            }
        }
        if item.status == "utlevert" {
            Button {
                returnItem(item)
            } label: {
                Label("Innlever", systemImage: "arrow.uturn.backward.circle.fill")
            }
        }
        if item.status != "kassert" {
            Divider()
            if item.status != "tapt" {
                Button {
                    setStatus(item, "tapt")
                } label: {
                    Label("Marker tapt", systemImage: "questionmark.circle.fill")
                }
            }
            if item.status != "defekt" {
                Button {
                    setStatus(item, "defekt")
                } label: {
                    Label("Marker defekt", systemImage: "exclamationmark.triangle.fill")
                }
            }
            if item.status != "tilgjengelig" && item.status != "utlevert" {
                Button {
                    setStatus(item, "tilgjengelig")
                } label: {
                    Label("Marker tilgjengelig", systemImage: "checkmark.circle.fill")
                }
            }
        }
        Divider()
        Button {
            eventsTarget = item
        } label: {
            Label("Hendelseslogg", systemImage: "clock.arrow.circlepath")
        }
        if item.status != "kassert" {
            Button(role: .destructive) {
                if isDemo {
                    TeamStubActions.toast("Kassering (demo — lagres ikke)")
                } else {
                    discardTarget = item
                }
            } label: {
                Label("Kasser", systemImage: "trash.fill")
            }
        }
    }

    // MARK: «+ Nytt utstyr»-bar

    private var newEquipmentBar: some View {
        Button { showCreate = true } label: {
            HStack(spacing: 7) {
                Image(systemName: "plus.circle.fill")
                    .font(.appScaled(size: 14, weight: .bold))
                Text("Nytt utstyr")
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [TBrand.purple, TBrand.purpleLight],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(TBrand.bg.opacity(0.95)
            .overlay(Rectangle().fill(TBrand.stroke).frame(height: 1), alignment: .top))
    }

    // MARK: Data

    private func load() async {
        if isDemo {
            items = Self.demoRows()
            loading = false
            loadError = nil
            return
        }
        guard let api = appState.api else {
            loading = false
            loadError = "Ikke innlogget — logg inn for å se utstyrsregisteret."
            return
        }
        loading = items.isEmpty
        do {
            items = try await api.fetchEquipment()
            loadError = nil
        } catch {
            // 403 = rolle/entitlement; ellers nettverk.
            loadError = "Fikk ikke lastet utstyrsregisteret — sjekk tilgang eller nettverk."
        }
        loading = false
    }

    private func setStatus(_ item: APIClient.EquipmentDTO, _ status: String) {
        if isDemo {
            TeamStubActions.toast("\(UtstyrStatus.label(status)) (demo — lagres ikke)")
            return
        }
        guard let api = appState.api else { return }
        Task {
            do {
                try await api.updateEquipment(id: item.id, ["status": status])
                TeamStubActions.toast("«\(item.label)» markert \(UtstyrStatus.label(status).lowercased())")
                await load()
            } catch {
                TeamStubActions.toast("Kunne ikke oppdatere status — prøv igjen")
            }
        }
    }

    private func returnItem(_ item: APIClient.EquipmentDTO) {
        if isDemo {
            TeamStubActions.toast("Innlevert (demo — lagres ikke)")
            return
        }
        guard let api = appState.api else { return }
        Task {
            do {
                try await api.returnEquipment(id: item.id)
                TeamStubActions.toast("«\(item.label)» innlevert")
                await load()
            } catch {
                TeamStubActions.toast("Kunne ikke innlevere — prøv igjen")
            }
        }
    }

    /// Demo-rader — én per kind. EquipmentDTO har kun Decodable-init
    /// (lenient dekoding), så mock bygges via JSON i stedet for memberwise.
    private static func demoRows() -> [APIClient.EquipmentDTO] {
        let json = """
        [
          {"id":"demo-1","kind":"nettbrett","label":"iPad Pro 11\\"","serial_number":"DMPXK2LF4","status":"utlevert","assigned_user_id":"demo-u1","assigned_user_name":"Kari Nordmann","assigned_at":"2026-07-02T09:15:00Z","note":""},
          {"id":"demo-2","kind":"telefon","label":"iPhone 15","serial_number":"F2LX93QJN","status":"tilgjengelig","assigned_user_name":"","note":""},
          {"id":"demo-3","kind":"laptop","label":"MacBook Air 13","serial_number":"C02G84KQ","status":"utlevert","assigned_user_id":"demo-u2","assigned_user_name":"Ola Magnussen","assigned_at":"2026-06-20T12:00:00Z","note":""},
          {"id":"demo-4","kind":"klaer","label":"Softshell-jakke m/ logo","size":"L","status":"tilgjengelig","assigned_user_name":"","note":""},
          {"id":"demo-5","kind":"id_kort","label":"ID-kort selger","status":"tapt","assigned_user_name":"","note":"Meldt tapt av Henrik"}
        ]
        """
        return (try? JSONDecoder().decode([APIClient.EquipmentDTO].self, from: Data(json.utf8))) ?? []
    }
}

// MARK: - Opprettelses-sheet

private struct UtstyrCreateSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    var onCreated: () async -> Void

    @State private var kind = "nettbrett"
    @State private var label = ""
    @State private var serialNumber = ""
    @State private var size = ""
    @State private var note = ""
    @State private var saving = false
    @State private var errorMsg: String?

    private var canSave: Bool {
        !label.trimmingCharacters(in: .whitespaces).isEmpty && !saving
    }

    var body: some View {
        NavigationStack {
            ZStack {
                TBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        kindPicker
                        field("Navn/merking *", $label, "F.eks. iPad Pro 11\" #3")
                        field("Serienummer (valgfritt)", $serialNumber, "F.eks. DMPXK2LF4")
                        if kind == "klaer" {
                            field("Størrelse", $size, "F.eks. L")
                        }
                        noteField
                        if let e = errorMsg {
                            Text(e)
                                .font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(TBrand.red)
                        }
                        saveButton
                        Color.clear.frame(height: 20)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Nytt utstyr")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(TBrand.textSecondary)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .preferredColorScheme(.dark)
        .presentationDragIndicator(.visible)
    }

    private var kindPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Type")
                .font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(TBrand.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(UtstyrKind.all, id: \.key) { k in
                        Button {
                            withAnimation(.snappy(duration: 0.15)) { kind = k.key }
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: k.icon)
                                    .font(.appScaled(size: 10, weight: .bold))
                                Text(k.label)
                                    .font(.appScaled(size: 11, weight: .bold))
                                    .fixedSize(horizontal: true, vertical: false)
                            }
                            .foregroundStyle(kind == k.key ? .white : TBrand.textSecondary)
                            .padding(.horizontal, 11).padding(.vertical, 8)
                            .background(
                                kind == k.key ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(TBrand.card),
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(
                                kind == k.key ? TBrand.purple.opacity(0.6) : TBrand.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func field(_ labelText: String, _ text: Binding<String>, _ placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(labelText)
                .font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(TBrand.textSecondary)
            TextField(placeholder, text: text)
                .font(.appScaled(size: 14))
                .foregroundStyle(.white)
                .autocorrectionDisabled()
                .padding(12)
                .background(TBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
        }
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Notat (valgfritt)")
                .font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(TBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $note)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.appScaled(size: 12))
                    .frame(minHeight: 64)
                    .padding(8)
                    .background(TBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
                if note.isEmpty {
                    Text("F.eks. kjøpsdato, tilbehør, tilstand")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(TBrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var saveButton: some View {
        Button { Task { await save() } } label: {
            HStack(spacing: 7) {
                if saving {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "plus.circle.fill")
                        .font(.appScaled(size: 14, weight: .bold))
                }
                Text("Registrer utstyr")
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: canSave
                                ? [TBrand.purple, TBrand.purpleLight]
                                : [TBrand.cardHi, TBrand.cardHi],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(canSave ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!canSave)
    }

    private func save() async {
        if DemoModeManager.isActiveNonisolated {
            TeamStubActions.toast("Utstyr registrert (demo — lagres ikke)")
            dismiss()
            return
        }
        guard let api = appState.api else {
            errorMsg = "Ikke innlogget."
            return
        }
        saving = true
        errorMsg = nil
        do {
            _ = try await api.createEquipment(
                kind: kind,
                label: label.trimmingCharacters(in: .whitespaces),
                serialNumber: serialNumber.trimmingCharacters(in: .whitespaces),
                size: kind == "klaer" ? size.trimmingCharacters(in: .whitespaces) : nil,
                note: note.trimmingCharacters(in: .whitespaces)
            )
            TeamStubActions.toast("«\(label.trimmingCharacters(in: .whitespaces))» registrert")
            await onCreated()
            dismiss()
        } catch {
            errorMsg = "Kunne ikke registrere utstyret — prøv igjen."
        }
        saving = false
    }
}

// MARK: - Medlems-picker for utlevering

private struct UtstyrAssignPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    let item: APIClient.EquipmentDTO
    var onAssigned: () async -> Void

    @State private var assigning = false

    var body: some View {
        NavigationStack {
            ZStack {
                TBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            Image(systemName: UtstyrKind.icon(item.kind))
                                .font(.appScaled(size: 15, weight: .semibold))
                                .foregroundStyle(TBrand.purpleLight)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(item.label)
                                    .font(.appScaled(size: 13, weight: .bold))
                                    .foregroundStyle(.white)
                                Text("Mottakeren varsles i appen når du utleverer")
                                    .font(.appScaled(size: 10))
                                    .foregroundStyle(TBrand.textSecondary)
                            }
                            Spacer()
                        }
                        .padding(12)
                        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))

                        if TeamLiveStore.shared.memberDTOs.isEmpty {
                            Text("Ingen teammedlemmer lastet enda — åpne Team-fanen først, eller sjekk nettverket.")
                                .font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.55))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 20)
                        } else {
                            LazyVStack(spacing: 6) {
                                ForEach(TeamLiveStore.shared.memberDTOs) { dto in
                                    memberRow(dto)
                                }
                            }
                        }
                        Color.clear.frame(height: 20)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Utlever til")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(TBrand.textSecondary)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task {
                if let api = appState.api {
                    TeamLiveStore.shared.attach(api: api, appState: appState)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDragIndicator(.visible)
    }

    private func memberRow(_ dto: SalesTeamMemberDTO) -> some View {
        Button {
            Task { await assign(dto) }
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(TBrand.purple.opacity(0.25))
                    Text(dto.name.split(separator: " ").prefix(2)
                        .map { String($0.prefix(1)) }.joined().uppercased())
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(TBrand.purpleLight)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(dto.name)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(dto.title ?? "Selger")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "person.badge.plus")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(TBrand.purpleLight)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(TBrand.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(TBrand.stroke, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(assigning)
    }

    private func assign(_ dto: SalesTeamMemberDTO) async {
        guard let api = appState.api, !assigning else { return }
        assigning = true
        do {
            try await api.assignEquipment(id: item.id, userId: dto.userId, userName: dto.name)
            TeamStubActions.toast("Utlevert til \(dto.name) — varsles")
            await onAssigned()
            dismiss()
        } catch {
            TeamStubActions.toast("Kunne ikke utlevere — prøv igjen")
        }
        assigning = false
    }
}

// MARK: - Hendelseslogg

private struct UtstyrEventLogSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    let item: APIClient.EquipmentDTO

    @State private var events: [APIClient.EquipmentEventDTO] = []
    @State private var loading = true
    @State private var loadError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                TBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        if loading {
                            HStack(spacing: 8) {
                                ProgressView().tint(TBrand.purpleLight)
                                Text("Laster hendelseslogg …")
                                    .font(.appScaled(size: 11, weight: .semibold))
                                    .foregroundStyle(TBrand.textSecondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 28)
                        } else if let feil = loadError {
                            Text(feil)
                                .font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.55))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 28)
                        } else if events.isEmpty {
                            Text("Ingen hendelser logget enda")
                                .font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.55))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 28)
                        } else {
                            LazyVStack(spacing: 6) {
                                ForEach(events) { e in eventRow(e) }
                            }
                        }
                        Color.clear.frame(height: 20)
                    }
                    .padding(16)
                }
            }
            .navigationTitle(item.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task { await load() }
        }
        .preferredColorScheme(.dark)
        .presentationDragIndicator(.visible)
    }

    private func eventRow(_ e: APIClient.EquipmentEventDTO) -> some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                Circle().fill(eventColor(e.event).opacity(0.2))
                Image(systemName: eventIcon(e.event))
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(eventColor(e.event))
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(eventLabel(e))
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                if !e.actorName.isEmpty {
                    Text("av \(e.actorName)")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                }
                if !e.note.isEmpty {
                    Text(e.note)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textTertiary)
                }
            }
            Spacer()
            if let at = e.createdAt, at.count >= 10 {
                Text(String(at.prefix(10)))
                    .font(.appScaled(size: 10))
                    .foregroundStyle(TBrand.textTertiary)
                    .monospacedDigit()
            }
        }
        .padding(10)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
    }

    private func eventLabel(_ e: APIClient.EquipmentEventDTO) -> String {
        let base: String
        switch e.event {
        case "opprettet", "created":       base = "Registrert"
        case "utlevert", "assigned":       base = "Utlevert"
        case "innlevert", "returned":      base = "Innlevert"
        case "tapt", "lost":               base = "Markert tapt"
        case "defekt", "defective":        base = "Markert defekt"
        case "tilgjengelig", "available":  base = "Markert tilgjengelig"
        case "kassert", "discarded":       base = "Kassert"
        default:                           base = e.event.capitalized
        }
        if !e.subjectUserName.isEmpty {
            return "\(base) — \(e.subjectUserName)"
        }
        return base
    }

    private func eventIcon(_ event: String) -> String {
        switch event {
        case "utlevert", "assigned":      return "person.badge.plus"
        case "innlevert", "returned":     return "arrow.uturn.backward.circle.fill"
        case "tapt", "lost":              return "questionmark.circle.fill"
        case "defekt", "defective":       return "exclamationmark.triangle.fill"
        case "kassert", "discarded":      return "trash.fill"
        case "tilgjengelig", "available": return "checkmark.circle.fill"
        default:                          return "plus.circle.fill"
        }
    }

    private func eventColor(_ event: String) -> Color {
        switch event {
        case "utlevert", "assigned":      return TBrand.purpleLight
        case "innlevert", "returned":     return TBrand.blue
        case "tapt", "lost":              return TBrand.red
        case "defekt", "defective":       return TBrand.orange
        case "kassert", "discarded":      return TBrand.textTertiary
        case "tilgjengelig", "available": return TBrand.green
        default:                          return TBrand.green
        }
    }

    private func load() async {
        // Demo-modus: registeret viser mock-rader — loggen holdes ærlig tom.
        if DemoModeManager.isActiveNonisolated {
            events = []
            loading = false
            return
        }
        guard let api = appState.api else {
            loading = false
            loadError = "Ikke innlogget."
            return
        }
        do {
            events = try await api.fetchEquipmentEvents(id: item.id)
            loadError = nil
        } catch {
            loadError = "Fikk ikke lastet hendelsesloggen — prøv igjen."
        }
        loading = false
    }
}
