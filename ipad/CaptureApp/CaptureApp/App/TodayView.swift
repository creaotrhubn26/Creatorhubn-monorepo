import SwiftUI

/// "I dag" — the photographer's run-and-gun command center. Dark
/// CreatorHub branding (``CHTheme``). One scannable screen that answers
/// "what am I shooting, am I packed, what's the light, what's left to
/// deliver?".
///
/// Sections (top → bottom), matching the design:
///   1. Sync chip
///   2. Dagens shoots — rich cards (time, type, status, gear, deliverables)
///   3. Klar før avreise (packing checklist)  |  Denne uken
///   4. Redigering & levering (gallery stats)  |  Lys & vær (weather + golden hour)
///   5. Motivational quote
///
/// Shoots/week come from ``TodayStore`` (local project mirror); galleries
/// from ``DashboardClient`` (live); weather from Open-Meteo + locally
/// computed golden hour. Packing is device-local.
@MainActor
@Observable
final class TodayEnvModel {
    private(set) var sun: SunTimes?
    private(set) var weather: WeatherNow?
    private let provider: WeatherProvider = OpenMeteoProvider()

    func load() async {
        let coord = await LocationProvider.currentOrFallback()
        sun = SunCalc.times(for: Date(), latitude: coord.latitude, longitude: coord.longitude)
        weather = try? await provider.current(latitude: coord.latitude, longitude: coord.longitude)
    }
}

@MainActor
@Observable
final class TodayRequestsModel {
    private(set) var newCount = 0
    func load() async {
        guard let client = DashboardClient.make() else { return }
        let subs = (try? await client.listSubmissions()) ?? []
        newCount = subs.filter(\.isNew).count
    }
}

@MainActor
@Observable
final class TodayDeliveryModel {
    private(set) var galleries: [GallerySummary] = []
    func load() async {
        guard let client = DashboardClient.make() else { return }
        galleries = (try? await client.listGalleries()) ?? []
    }
    var awaitingSelection: Int { galleries.filter { ($0.status ?? "") == "active" && $0.selectionCount == 0 }.count }
    var readyToDeliver: Int { galleries.filter { $0.selectionCount > 0 && ($0.status ?? "") != "completed" }.count }
    var active: Int { galleries.filter { ($0.status ?? "") == "active" }.count }
}

struct TodayView: View {
    @State private var snapshot: TodayStore.Snapshot?
    @State private var loadError: String?
    @State private var isLoading = false
    @State private var env = TodayEnvModel()
    @State private var delivery = TodayDeliveryModel()
    @State private var packing = PackingChecklist()
    @State private var showPackingSheet = false
    @State private var layout = DashboardLayout()
    @State private var showCustomize = false
    @State private var showCardImport = false
    @State private var showRevisions = false
    @State private var notes = NotesStore.shared
    @State private var quickNote = ""
    @State private var requests = TodayRequestsModel()

    var ownerUserId: String = "dev-owner"

    private var store: TodayStore? {
        do {
            let url = try AppDatabase.defaultDiskURL()
            let db = try AppDatabase.openOnDisk(at: url)
            return TodayStore(database: db)
        } catch { return nil }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    syncStatusRow
                    if layout.columns == 2 {
                        LazyVGrid(
                            columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                            alignment: .leading,
                            spacing: 18,
                        ) {
                            ForEach(layout.visibleSections, id: \.self) { sectionView(for: $0) }
                        }
                    } else {
                        ForEach(layout.visibleSections, id: \.self) { sectionView(for: $0) }
                    }
                }
                .padding(20)
            }
            .frame(maxWidth: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("I dag")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showCustomize = true } label: {
                        Label("Tilpass", systemImage: "slider.horizontal.3")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button { showCardImport = true } label: {
                        Label("Importer fra minnekort", systemImage: "sdcard")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button { showRevisions = true } label: {
                        Label("Revisjoner", systemImage: "arrow.triangle.2.circlepath")
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button { Task { await loadAll() } } label: {
                        if isLoading { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }
                    .disabled(isLoading)
                }
            }
            .task { await loadAll() }
            .sheet(isPresented: $showPackingSheet) {
                PackingSheet(packing: packing)
            }
            .sheet(isPresented: $showCustomize) {
                CustomizeTodaySheet(layout: layout)
            }
            .sheet(isPresented: $showCardImport) {
                CardImportView()
            }
            .sheet(isPresented: $showRevisions) {
                RevisionsEntryView()
            }
        }
    }

    // MARK: - Sync

    private var syncStatusRow: some View {
        HStack(spacing: 8) {
            Circle().fill(snapshot?.lastSyncAt != nil ? CHTheme.success : CHTheme.accent)
                .frame(width: 8, height: 8)
            Text(snapshot?.lastSyncAt.map { "Synket \($0.formatted(.dateTime.hour().minute())) fra CreatorHub" }
                 ?? "Ingen sync ennå — dra for å hente fra CreatorHub")
                .font(.caption)
                .foregroundStyle(CHTheme.textMuted)
            Spacer()
        }
    }

    // MARK: - Dagens shoots

    private var todaysSection: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 14) {
                cardHeader("Dagens shoots", systemImage: "camera.aperture")
                if let error = loadError {
                    Text(error).font(.caption).foregroundStyle(CHTheme.danger)
                } else if let shoots = snapshot?.todaysShoots, !shoots.isEmpty {
                    ForEach(Array(shoots.enumerated()), id: \.element.id) { idx, project in
                        if idx > 0 { Divider().overlay(CHTheme.border) }
                        NavigationLink {
                            ShotListView(projectId: project.id, ownerUserId: ownerUserId)
                        } label: {
                            TodayShootRow(project: project)
                        }
                        .buttonStyle(.plain)
                    }
                } else if snapshot != nil {
                    emptyInline(icon: "sun.max", title: "Ingen jobber i dag", detail: "Nyt pausen ☕")
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
        }
    }

    // MARK: - Klar før avreise

    private var packingCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                cardHeader("Klar før avreise", systemImage: "bag")
                ForEach(packing.items.prefix(7)) { item in
                    Button { packing.toggle(item) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: item.packed ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(item.packed ? CHTheme.accent : CHTheme.textMuted)
                            Text(item.name)
                                .font(.subheadline)
                                .foregroundStyle(item.packed ? CHTheme.textSecondary : CHTheme.textPrimary)
                                .strikethrough(item.packed, color: CHTheme.textMuted)
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
                Button { showPackingSheet = true } label: {
                    HStack {
                        Text("Vis full pakkeliste (\(packing.packedCount)/\(packing.total))")
                        Spacer()
                        Image(systemName: "chevron.right")
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(CHTheme.accent)
                }
                .padding(.top, 2)
            }
        }
    }

    // MARK: - Denne uken

    private var weekCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                cardHeader("Denne uken", systemImage: "calendar")
                if let upcoming = snapshot?.upcomingWeek, !upcoming.isEmpty {
                    ForEach(Array(upcoming.prefix(4).enumerated()), id: \.element.id) { idx, project in
                        if idx > 0 { Divider().overlay(CHTheme.border) }
                        WeekRow(project: project)
                    }
                } else {
                    emptyInline(icon: "calendar.badge.plus", title: "Ingenting booket", detail: "de neste 7 dagene")
                }
            }
        }
    }

    // MARK: - Redigering & levering

    private var deliveryCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                cardHeader("Redigering & levering", systemImage: "tray.full")
                DeliveryRow(icon: "wand.and.stars", label: "Gallerier som venter på klientvalg", value: delivery.awaitingSelection, tint: CHTheme.warning)
                DeliveryRow(icon: "shippingbox", label: "Klare til levering", value: delivery.readyToDeliver, tint: CHTheme.success)
                DeliveryRow(icon: "photo.stack", label: "Aktive gallerier", value: delivery.active, tint: CHTheme.info)
            }
        }
    }

    // MARK: - Lys & vær

    private var weatherCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    cardHeader("Lys & vær", systemImage: "sun.haze")
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(CHTheme.textMuted)
                }
                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        if let w = env.weather {
                            HStack(spacing: 8) {
                                Image(systemName: w.symbol).foregroundStyle(CHTheme.accent)
                                Text("\(Int(w.temperatureC.rounded()))°")
                                    .font(.title.bold()).foregroundStyle(CHTheme.textPrimary)
                            }
                            Text(w.condition).font(.caption).foregroundStyle(CHTheme.textSecondary)
                        } else {
                            ProgressView()
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text("GOLDEN HOUR").font(.caption2.weight(.semibold)).foregroundStyle(CHTheme.textMuted)
                        if let s = env.sun, let gs = s.goldenStart, let ge = s.goldenEnd {
                            Text("\(time(gs)) – \(time(ge))")
                                .font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.accentSoft)
                        } else {
                            Text("—").foregroundStyle(CHTheme.textMuted)
                        }
                        if let sunset = env.sun?.sunset {
                            Text("Solnedgang \(time(sunset))").font(.caption2).foregroundStyle(CHTheme.textMuted)
                        }
                    }
                }
            }
        }
    }

    private func time(_ date: Date) -> String { date.formatted(.dateTime.hour().minute()) }

    // MARK: - Quote

    /// Inbound requests — entry point of the loop. Shows the new-request count
    /// and opens the Forespørsler inbox where each becomes a project.
    private var foresporslerCard: some View {
        NavigationLink {
            RequestsInboxView()
        } label: {
            CHCard {
                HStack(spacing: 14) {
                    Image(systemName: "tray.and.arrow.down.fill")
                        .font(.title2).foregroundStyle(CHTheme.accent)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Forespørsler").font(.headline).foregroundStyle(CHTheme.textPrimary)
                        Text(requests.newCount > 0 ? "\(requests.newCount) nye henvendelser å følge opp" : "Ingen nye henvendelser")
                            .font(.caption).foregroundStyle(CHTheme.textSecondary)
                    }
                    Spacer()
                    if requests.newCount > 0 {
                        Text("\(requests.newCount)").font(.subheadline.weight(.bold)).foregroundStyle(CHTheme.bg)
                            .padding(.horizontal, 9).padding(.vertical, 4).background(CHTheme.accent, in: Capsule())
                    }
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(CHTheme.textMuted)
                }
            }
        }
        .buttonStyle(.plain)
    }

    /// Contextual notes — quick capture inline + recent/pinned, tap into
    /// the full Notater surface. (Voice + Claude actions land next layer.)
    private var notaterCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    cardHeader("Notater", systemImage: "note.text")
                    Spacer()
                    NavigationLink { NotesView() } label: {
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(CHTheme.textMuted)
                    }
                }
                // Quick capture
                HStack(spacing: 8) {
                    Image(systemName: "square.and.pencil").foregroundStyle(CHTheme.accent)
                    TextField("Nytt notat…", text: $quickNote, axis: .vertical)
                        .foregroundStyle(CHTheme.textPrimary)
                        .lineLimit(1...3)
                        .onSubmit(submitQuickNote)
                    if !quickNote.trimmingCharacters(in: .whitespaces).isEmpty {
                        Button(action: submitQuickNote) {
                            Image(systemName: "arrow.up.circle.fill").foregroundStyle(CHTheme.accent)
                        }
                    }
                }
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 10).fill(CHTheme.surfaceElevated))

                if notes.notes.isEmpty {
                    Text("Fang ideer, huskelapper og klient-detaljer — koblet til riktig shoot.")
                        .font(.caption).foregroundStyle(CHTheme.textMuted)
                } else {
                    ForEach(notes.recent(3)) { note in
                        HStack(spacing: 8) {
                            Image(systemName: note.pinned ? "pin.fill" : "circle.fill")
                                .font(.system(size: note.pinned ? 10 : 5))
                                .foregroundStyle(note.pinned ? CHTheme.accent : CHTheme.textMuted)
                            Text(note.title).font(.caption).foregroundStyle(CHTheme.textSecondary).lineLimit(1)
                            Spacer()
                            if note.contextKind != .none {
                                Image(systemName: note.contextKind.icon).font(.caption2).foregroundStyle(CHTheme.accentSoft)
                            }
                        }
                    }
                    NavigationLink { NotesView() } label: {
                        Text("Se alle notater (\(notes.notes.count))")
                            .font(.caption.weight(.semibold)).foregroundStyle(CHTheme.accent)
                    }
                    .padding(.top, 2)
                }
            }
        }
    }

    private func submitQuickNote() {
        let stamp = Date().formatted(.dateTime.hour().minute())
        notes.quickAdd(quickNote, captureContext: stamp)
        quickNote = ""
    }

    /// Map a user-arranged section to its card. Order + visibility come
    /// from ``DashboardLayout`` so the photographer's arrangement (saved
    /// locally) drives the screen.
    @ViewBuilder
    private func sectionView(for section: DashboardSection) -> some View {
        switch section {
        case .foresporsler: foresporslerCard
        case .dagensShoots: todaysSection
        case .klarForAvreise: packingCard
        case .denneUken: weekCard
        case .redigeringLevering: deliveryCard
        case .lysVaer:
            NavigationLink { LysVaerDetailView() } label: { weatherCard }
                .buttonStyle(.plain)
        case .notater: notaterCard
        }
    }

    // MARK: - Helpers

    private func cardHeader(_ title: String, systemImage: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage).foregroundStyle(CHTheme.accent)
            Text(title).font(.headline).foregroundStyle(CHTheme.textPrimary)
        }
    }

    private func emptyInline(icon: String, title: String, detail: String?) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.title3).foregroundStyle(CHTheme.textMuted)
            Text(title).font(.subheadline).foregroundStyle(CHTheme.textSecondary)
            if let detail { Text(detail).font(.caption).foregroundStyle(CHTheme.textMuted) }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
    }

    private func loadAll() async {
        isLoading = true
        defer { isLoading = false }
        async let envTask: Void = env.load()
        async let deliveryTask: Void = delivery.load()
        async let requestsTask: Void = requests.load()
        if let store {
            do { snapshot = try await store.load(ownerUserId: ownerUserId); loadError = nil } catch { loadError = String(describing: error) }
        } else {
            loadError = "Database ikke tilgjengelig"
        }
        _ = await (envTask, deliveryTask, requestsTask)
    }
}

// MARK: - Card chrome

/// Rounded dark surface card — the consistent CreatorHub container.
struct CHCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(CHTheme.surface)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(CHTheme.border, lineWidth: 1)),
            )
    }
}

// MARK: - Rows

private struct TodayShootRow: View {
    let project: Project

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 2) {
                if let date = project.eventDate {
                    Text(date.formatted(.dateTime.hour().minute()))
                        .font(.title3.weight(.bold).monospacedDigit())
                        .foregroundStyle(CHTheme.textPrimary)
                }
            }
            .frame(width: 64, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(project.title).font(.headline).foregroundStyle(CHTheme.textPrimary)
                    if let type = project.projectType, !type.isEmpty {
                        Text(type).font(.caption).foregroundStyle(CHTheme.textMuted)
                    }
                }
                if let location = project.location, !location.isEmpty {
                    Label(location, systemImage: "mappin.and.ellipse")
                        .font(.caption).foregroundStyle(CHTheme.textSecondary)
                }
                if project.totalShots > 0 || project.mustHaveShots > 0 {
                    Text(deliverableText).font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 8) {
                ShootStatusPill(status: project.status)
                HStack(spacing: 10) {
                    ForEach(gearIcons, id: \.self) { icon in
                        Image(systemName: icon).font(.caption).foregroundStyle(CHTheme.textMuted)
                    }
                    Image(systemName: "chevron.right").font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
            }
        }
        .padding(.vertical, 8)
    }

    private var deliverableText: String {
        if project.mustHaveShots > 0 {
            return "\(project.completedMustHave)/\(project.mustHaveShots) must-have shots"
        }
        return "Ca. \(project.totalShots) leveranser"
    }

    /// Gear hints from the project type — video/run-and-gun gets a mic, etc.
    private var gearIcons: [String] {
        let t = (project.projectType ?? "").lowercased()
        if t.contains("video") || t.contains("film") || t.contains("run") {
            return ["camera", "video", "mic"]
        }
        return ["camera", "bolt", "camera.aperture"]
    }
}

private struct ShootStatusPill: View {
    let status: String
    private var label: String {
        switch status.lowercased() {
        case "confirmed", "bekreftet", "active": return "Bekreftet"
        case "in_progress", "on_the_way", "på vei": return "På vei"
        case "completed", "done", "fullført": return "Fullført"
        case "draft", "planning": return "Planlegges"
        default: return status.isEmpty ? "—" : status.capitalized
        }
    }
    private var color: Color {
        switch status.lowercased() {
        case "confirmed", "bekreftet", "active": return CHTheme.success
        case "in_progress", "on_the_way", "på vei": return CHTheme.warning
        case "completed", "done", "fullført": return CHTheme.info
        default: return CHTheme.textMuted
        }
    }
    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.18), in: Capsule())
            .foregroundStyle(color)
    }
}

private struct WeekRow: View {
    let project: Project
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                if let date = project.eventDate {
                    Text(date.formatted(.dateTime.weekday(.abbreviated)))
                        .font(.caption2.weight(.semibold)).foregroundStyle(CHTheme.textMuted)
                    Text(date.formatted(.dateTime.day().month(.abbreviated)))
                        .font(.subheadline.bold()).foregroundStyle(CHTheme.textPrimary)
                }
            }
            .frame(width: 56, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(project.title).font(.subheadline).foregroundStyle(CHTheme.textPrimary).lineLimit(1)
                HStack(spacing: 6) {
                    if let date = project.eventDate {
                        Text(date.formatted(.dateTime.hour().minute()))
                    }
                    if let loc = project.location, !loc.isEmpty {
                        Text("· \(loc)").lineLimit(1)
                    }
                }
                .font(.caption).foregroundStyle(CHTheme.textMuted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(CHTheme.textMuted)
        }
        .padding(.vertical, 6)
    }
}

private struct DeliveryRow: View {
    let icon: String
    let label: String
    let value: Int
    let tint: Color
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(tint).frame(width: 22)
            Text(label).font(.subheadline).foregroundStyle(CHTheme.textSecondary)
            Spacer()
            Text("\(value)")
                .font(.subheadline.bold().monospacedDigit())
                .foregroundStyle(value > 0 ? CHTheme.textPrimary : CHTheme.textMuted)
        }
    }
}

// MARK: - Packing sheet

private struct PackingSheet: View {
    @Bindable var packing: PackingChecklist
    @Environment(\.dismiss) private var dismiss
    @State private var newItem = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(packing.items) { item in
                        Button { packing.toggle(item) } label: {
                            HStack {
                                Image(systemName: item.packed ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(item.packed ? CHTheme.accent : CHTheme.textMuted)
                                Text(item.name).foregroundStyle(CHTheme.textPrimary)
                                Spacer()
                            }
                        }
                        .listRowBackground(CHTheme.surface)
                    }
                    .onDelete { idx in idx.map { packing.items[$0] }.forEach(packing.remove) }
                }
                Section {
                    HStack {
                        TextField("Legg til utstyr…", text: $newItem)
                            .foregroundStyle(CHTheme.textPrimary)
                        Button("Legg til") { packing.add(newItem); newItem = "" }
                            .disabled(newItem.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    .listRowBackground(CHTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Pakkeliste")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Nullstill") { packing.resetPacked() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                }
            }
        }
        .chBranded()
    }
}

/// "Tilpass min dag" — drag to reorder cards + toggle visibility. The
/// arrangement persists via ``DashboardLayout``.
private struct CustomizeTodaySheet: View {
    @Bindable var layout: DashboardLayout
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Visning") {
                    Picker("Kolonner", selection: $layout.columns) {
                        Text("Én kolonne").tag(1)
                        Text("To kolonner").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(CHTheme.surface)
                }
                Section {
                    ForEach(layout.entries) { entry in
                        HStack(spacing: 12) {
                            Image(systemName: entry.section.icon)
                                .foregroundStyle(CHTheme.accent).frame(width: 26)
                            Text(entry.section.title).foregroundStyle(CHTheme.textPrimary)
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { entry.visible },
                                set: { layout.setVisible(entry.section, $0) },
                            ))
                            .labelsHidden()
                            .tint(CHTheme.accent)
                        }
                        .listRowBackground(CHTheme.surface)
                    }
                    .onMove { layout.move(from: $0, to: $1) }
                } header: {
                    Text("Dra for å endre rekkefølge · skru kort av/på")
                } footer: {
                    Text("Oppsettet huskes til neste gang du åpner appen.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Tilpass min dag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Nullstill") { layout.resetToDefault() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                }
            }
        }
        .chBranded()
    }
}
