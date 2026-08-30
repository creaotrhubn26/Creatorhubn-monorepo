import SwiftUI
import PhotosUI

// Assets-flaten (mockup-paritet): alle prosjektets filer i Role Room-
// lagringen — mappe-kort (auto-gruppert på produksjonskontekst), fil-kort
// med thumbnails og TYPE/størrelse-footer, filter, søk, sortering, import
// og sletting (soft delete). Alt KOBLET mot B2 via /storage-API-ene.

@MainActor
final class AssetsState: ObservableObject {
    let project: ProjectSummary
    let manuscript: ManuscriptSummary
    @Published var files: [RoleRoomAPIClient.StorageFileSummary] = []
    @Published var trash: [RoleRoomAPIClient.StorageFileSummary] = []
    @Published var loading = true
    // Brukerstyrte mapper + fargeprøver — persistert i hub-metadataene.
    @Published var userFolders: [UserFolder] = []
    @Published var colorSwatches: [String] = []

    struct UserFolder: Identifiable, Codable {
        var id: String
        var name: String
        var fileIds: [String]
        // Mappefarge (hex) — optional så eksisterende mapper dekoder uendret
        var color: String?
    }

    init(project: ProjectSummary, manuscript: ManuscriptSummary) {
        self.project = project
        self.manuscript = manuscript
    }

    func load() async {
        loading = files.isEmpty
        files = await RoleRoomAPIClient.shared.listStorageFiles(projectId: project.id)
        if let scenes = try? await RoleRoomAPIClient.shared
            .fetchScenes(manuscriptId: manuscript.id) {
            userFolders = HubState.decodeList(scenes.first?.hubAssetFolders)
            colorSwatches = HubState.decodeMoodboard(scenes.first?.hubAssetColors)
        }
        loading = false
    }

    func loadTrash() async {
        trash = await RoleRoomAPIClient.shared.listTrash()
    }

    func persistMeta() {
        let manuscriptId = manuscript.id
        let payload: [String: any Sendable] = [
            "hubAssetFolders": HubState.encodeList(userFolders),
            "hubAssetColors": (try? JSONSerialization.data(withJSONObject: colorSwatches))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]",
        ]
        Task {
            try? await RoleRoomAPIClient.shared.setHubMeta(manuscriptId: manuscriptId,
                                                           fields: payload)
        }
    }

    func folderFor(fileId: String) -> UserFolder? {
        userFolders.first { $0.fileIds.contains(fileId) }
    }

    func move(fileId: String, to folderId: String?) {
        for index in userFolders.indices {
            userFolders[index].fileIds.removeAll { $0 == fileId }
        }
        if let folderId, let index = userFolders.firstIndex(where: { $0.id == folderId }) {
            userFolders[index].fileIds.append(fileId)
        }
        persistMeta()
    }
}

struct AssetsView: View {
    @StateObject private var state: AssetsState
    var storageUsed = 0
    var storageQuota: Int?
    var onNavigate: ((HubDestination) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @State private var typeFilter = "Alle"
    @State private var sortNewestFirst = true
    @State private var folderFilter: String?
    @State private var importPickerItem: PhotosPickerItem?
    @State private var previewImage: UIImage?
    @State private var pendingDeleteId: String?
    @State private var status: String?
    @State private var listMode = false
    @State private var showTrash = false
    @State private var showNewFolder = false
    @State private var newFolderName = ""
    @State private var renameFileId: String?
    @State private var renameDraft = ""
    @State private var newSwatchColor = Color(red: 0.55, green: 0.36, blue: 0.96)

    init(project: ProjectSummary, manuscript: ManuscriptSummary,
         storageUsed: Int = 0, storageQuota: Int? = nil,
         onNavigate: ((HubDestination) -> Void)? = nil) {
        _state = StateObject(wrappedValue: AssetsState(project: project, manuscript: manuscript))
        self.storageUsed = storageUsed
        self.storageQuota = storageQuota
        self.onNavigate = onNavigate
    }

    // «Mapper» = produksjonskonteksten filene ble lastet opp med.
    private static let folders: [(key: String, title: String, icon: String)] = [
        ("storyboard_frame", "Paneler", "rectangle.grid.2x2"),
        ("storyboard_scene", "Ark", "square.grid.3x3.square"),
        ("storyboard_moodboard", "Moodboard", "photo.on.rectangle.angled"),
        ("", "Annet", "folder"),
    ]

    private func folderKey(_ file: RoleRoomAPIClient.StorageFileSummary) -> String {
        let known = Self.folders.dropLast().map(\.key)
        return known.contains(file.entityType ?? "") ? (file.entityType ?? "") : ""
    }

    private var visibleFiles: [RoleRoomAPIClient.StorageFileSummary] {
        state.files
            .filter { file in
                guard let folderFilter else { return true }
                if folderFilter.hasPrefix("uf:") {
                    let folderId = String(folderFilter.dropFirst(3))
                    return state.folderFor(fileId: file.id)?.id == folderId
                }
                // Auto-gruppene viser kun filer som IKKE ligger i brukermappe
                return folderKey(file) == folderFilter
                    && state.folderFor(fileId: file.id) == nil
            }
            .filter {
                switch typeFilter {
                case "Bilder": return $0.isImage
                case "Andre": return !$0.isImage
                default: return true
                }
            }
            .filter {
                searchText.isEmpty
                    || $0.displayName.localizedCaseInsensitiveContains(searchText)
            }
            .sorted { sortNewestFirst ? $0.uploadedAt > $1.uploadedAt
                                      : $0.uploadedAt < $1.uploadedAt }
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
            HubSidebar(projectName: state.project.name,
                       storageUsed: storageUsed, storageQuota: storageQuota,
                       active: .assets) { destination in
                onNavigate?(destination)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Alle filer, bilder og media for produksjonen — lagret i Role Room-skyen.")
                        .font(.system(size: 13)).foregroundStyle(BoardBrand.dim)
                    filterRow
                    if folderFilter == nil && searchText.isEmpty {
                        folderRow
                        swatchRow
                    }
                    if listMode { fileList } else { fileGrid }
                }
                .padding(18)
            }
            }
            .background(BoardBrand.chrome)
            .navigationTitle(folderFilter.flatMap { key -> String? in
                if key.hasPrefix("uf:") {
                    return state.userFolders.first { $0.id == String(key.dropFirst(3)) }?.name
                }
                return Self.folders.first { $0.key == key }?.title
            } ?? "Assets")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                if folderFilter != nil {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Alle") { folderFilter = nil }
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if let status {
                        Text(status).font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
                    }
                    Button { listMode.toggle() } label: {
                        Image(systemName: listMode ? "square.grid.2x2" : "list.bullet")
                    }
                    Button { showNewFolder = true } label: {
                        Label("Ny mappe", systemImage: "folder.badge.plus")
                    }
                    Button {
                        showTrash = true
                        Task { await state.loadTrash() }
                    } label: {
                        Image(systemName: "trash")
                    }
                    PhotosPicker(selection: $importPickerItem, matching: .images) {
                        Label("Importer", systemImage: "square.and.arrow.down")
                    }
                    Button("Lukk") { dismiss() }
                }
            }
            .searchable(text: $searchText, prompt: "Søk i assets")
        }
        .task { await state.load() }
        .onChange(of: importPickerItem) {
            guard let item = importPickerItem else { return }
            importPickerItem = nil
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data),
                      let dataURL = NativeBoardView.jpegDataURL(image, maxSide: 2000, quality: 0.8),
                      let comma = dataURL.firstIndex(of: ","),
                      let jpeg = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]))
                else { return }
                status = "Laster opp…"
                _ = try? await RoleRoomAPIClient.shared.uploadStorageImage(
                    jpegData: jpeg,
                    name: "\(state.project.name) - asset \(state.files.count + 1).jpg",
                    projectId: state.project.id,
                    attachedToEntityType: "storyboard_asset",
                    attachedToEntityId: state.manuscript.id,
                    attachmentNote: "Importert i Assets")
                await state.load()
                status = nil
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { previewImage != nil },
            set: { if !$0 { previewImage = nil } })) {
            ZStack(alignment: .topTrailing) {
                Color.black.ignoresSafeArea()
                if let previewImage {
                    Image(uiImage: previewImage)
                        .resizable().scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                Button {
                    previewImage = nil
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28)).foregroundStyle(.white.opacity(0.8))
                        .padding(20)
                }
            }
        }
        .alert("Ny mappe", isPresented: $showNewFolder) {
            TextField("Mappenavn", text: $newFolderName)
            Button("Opprett") {
                let name = newFolderName.trimmingCharacters(in: .whitespaces)
                newFolderName = ""
                guard !name.isEmpty else { return }
                state.userFolders.append(AssetsState.UserFolder(
                    id: UUID().uuidString, name: name, fileIds: []))
                state.persistMeta()
            }
            Button("Avbryt", role: .cancel) { newFolderName = "" }
        }
        .alert("Omdøp", isPresented: Binding(
            get: { renameFileId != nil },
            set: { if !$0 { renameFileId = nil } })) {
            TextField("Navn", text: $renameDraft)
            Button("Lagre") {
                let name = renameDraft.trimmingCharacters(in: .whitespaces)
                guard let target = renameFileId, !name.isEmpty else { renameFileId = nil; return }
                renameFileId = nil
                if target.hasPrefix("folder:") {
                    let folderId = String(target.dropFirst(7))
                    if let index = state.userFolders.firstIndex(where: { $0.id == folderId }) {
                        state.userFolders[index].name = name
                        state.persistMeta()
                    }
                } else {
                    Task {
                        if await RoleRoomAPIClient.shared.renameStorageFile(
                            fileId: target, displayName: name) {
                            await state.load()
                        }
                    }
                }
            }
            Button("Avbryt", role: .cancel) { renameFileId = nil }
        }
        .sheet(isPresented: $showTrash) {
            NavigationStack {
                List {
                    if state.trash.isEmpty {
                        Text("Papirkurven er tom.").foregroundStyle(.secondary)
                    }
                    ForEach(state.trash) { file in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(file.displayName).font(.subheadline)
                                Text(ByteCountFormatter.string(
                                    fromByteCount: Int64(file.sizeBytes), countStyle: .file))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Gjenopprett") {
                                Task {
                                    if await RoleRoomAPIClient.shared
                                        .restoreStorageFile(fileId: file.id) {
                                        await state.loadTrash()
                                        await state.load()
                                    }
                                }
                            }
                            .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                        }
                    }
                }
                .navigationTitle("Papirkurv")
                .toolbar { ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { showTrash = false }
                } }
            }
            .presentationDetents([.medium, .large])
        }
        .confirmationDialog("Flytte filen til papirkurven?",
                            isPresented: Binding(get: { pendingDeleteId != nil },
                                                 set: { if !$0 { pendingDeleteId = nil } })) {
            Button("Slett", role: .destructive) {
                guard let fileId = pendingDeleteId else { return }
                pendingDeleteId = nil
                Task {
                    if await RoleRoomAPIClient.shared.deleteStorageFile(fileId: fileId) {
                        await state.load()
                    }
                }
            }
        }
    }

    private var filterRow: some View {
        HStack(spacing: 10) {
            Picker("Type", selection: $typeFilter) {
                Text("Alle").tag("Alle")
                Text("Bilder").tag("Bilder")
                Text("Andre").tag("Andre")
            }
            .pickerStyle(.segmented)
            .frame(width: 240)
            Button {
                sortNewestFirst.toggle()
            } label: {
                Label(sortNewestFirst ? "Nyest først" : "Eldst først",
                      systemImage: "arrow.up.arrow.down")
                    .font(.system(size: 12))
                    .foregroundStyle(BoardBrand.dim)
            }
            .buttonStyle(.plain)
            Spacer()
            Text("\(visibleFiles.count) filer")
                .font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
        }
    }

    private var folderRow: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4),
                  spacing: 12) {
            // Brukerstyrte mapper (Ny mappe) — med «…»-meny
            ForEach(state.userFolders) { folder in
                Button { folderFilter = "uf:\(folder.id)" } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "folder.fill")
                                .font(.system(size: 30))
                                .foregroundStyle(folder.color.flatMap { Color(hex: $0) }
                                                 ?? BoardBrand.accent.opacity(0.7))
                            Spacer()
                            Menu {
                                Button("Omdøp") {
                                    renameFileId = "folder:\(folder.id)"
                                    renameDraft = folder.name
                                }
                                Menu("Farge") {
                                    ForEach(folderColors + state.colorSwatches, id: \.self) { hex in
                                        Button {
                                            setFolderColor(folder.id, hex: hex)
                                        } label: {
                                            Label(hex.uppercased(),
                                                  systemImage: folder.color == hex
                                                  ? "checkmark.circle.fill" : "circle.fill")
                                        }
                                    }
                                    if folder.color != nil {
                                        Button("Standard", role: .destructive) {
                                            setFolderColor(folder.id, hex: nil)
                                        }
                                    }
                                }
                                Button("Slett mappe", role: .destructive) {
                                    state.userFolders.removeAll { $0.id == folder.id }
                                    state.persistMeta()
                                }
                            } label: {
                                Image(systemName: "ellipsis")
                                    .foregroundStyle(BoardBrand.dim)
                                    .frame(width: 24, height: 24)
                            }
                        }
                        .frame(minHeight: 70, alignment: .top)
                        Text(folder.name)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                        Text("\(folder.fileIds.count) \(folder.fileIds.count == 1 ? "fil" : "filer")")
                            .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
            ForEach(Self.folders, id: \.key) { folder in
                let count = state.files.filter { folderKey($0) == folder.key }.count
                if count > 0 {
                    Button { folderFilter = folder.key } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            Image(systemName: folder.icon)
                                .font(.system(size: 30))
                                .foregroundStyle(BoardBrand.dim)
                                .frame(maxWidth: .infinity, minHeight: 70)
                            Text(folder.title)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("\(count) \(count == 1 ? "fil" : "filer")")
                                .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // Fargeprøve-kort (mockupens #hex-kort) — prosjektets fargespråk.
    private var swatchRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("FARGER · prosjektets fargespråk — tap legger fargen i penselens nylige farger")
                .font(.system(size: 10, weight: .bold)).kerning(0.5)
                .foregroundStyle(BoardBrand.label)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 6),
                      spacing: 12) {
                ForEach(state.colorSwatches, id: \.self) { hex in
                    VStack(alignment: .trailing, spacing: 0) {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(hex: hex) ?? .gray)
                            .frame(height: 76)
                            .overlay(alignment: .bottomTrailing) {
                                Text(hex.uppercased())
                                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(.white)
                                    .padding(5)
                                    .background(.black.opacity(0.45), in: Capsule())
                                    .padding(5)
                            }
                    }
                    .onTapGesture {
                        // Del med tegneflaten: samme lager som boardets
                        // «nylige farger»-rad (sb.recentColors).
                        var recent = UserDefaults.standard
                            .stringArray(forKey: "sb.recentColors") ?? []
                        recent.removeAll { $0 == hex }
                        recent.insert(hex, at: 0)
                        UserDefaults.standard.set(Array(recent.prefix(8)),
                                                  forKey: "sb.recentColors")
                        status = "\(hex.uppercased()) lagt i penselfargene ✓"
                    }
                    .contextMenu {
                        Button("Slett", role: .destructive) {
                            state.colorSwatches.removeAll { $0 == hex }
                            state.persistMeta()
                        }
                    }
                }
                VStack(spacing: 4) {
                    ColorPicker("", selection: $newSwatchColor, supportsOpacity: false)
                        .labelsHidden()
                    Button {
                        let hex = newSwatchColor.hexString
                        guard !state.colorSwatches.contains(hex) else { return }
                        state.colorSwatches.append(hex)
                        state.persistMeta()
                    } label: {
                        Label("Legg til", systemImage: "plus")
                            .font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                    }
                    .buttonStyle(.plain)
                }
                .frame(height: 76)
            }
        }
    }

    // Listevisning (grid/liste-toggle)
    private var fileList: some View {
        VStack(spacing: 6) {
            ForEach(visibleFiles) { file in
                HStack(spacing: 10) {
                    Group {
                        if file.isImage, let image = FrameImageCache.image(for: file.downloadPath) {
                            Image(uiImage: image).resizable().scaledToFill()
                        } else {
                            Rectangle().fill(Color.white.opacity(0.05))
                                .overlay(Image(systemName: file.isImage ? "photo" : "doc.text")
                                    .font(.system(size: 14)).foregroundStyle(BoardBrand.label))
                        }
                    }
                    .frame(width: 52, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                    Text(file.displayName)
                        .font(.system(size: 12)).foregroundStyle(.white).lineLimit(1)
                    if let folder = state.folderFor(fileId: file.id) {
                        let tint = folder.color.flatMap { Color(hex: $0) } ?? BoardBrand.accent
                        Text(folder.name)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(tint)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(tint.opacity(0.15), in: Capsule())
                    }
                    Spacer()
                    Text(fileTypeLabel(file))
                        .font(.system(size: 9, weight: .bold)).foregroundStyle(BoardBrand.label)
                    Text(ByteCountFormatter.string(fromByteCount: Int64(file.sizeBytes),
                                                   countStyle: .file))
                        .font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                        .frame(width: 64, alignment: .trailing)
                }
                .padding(8)
                .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 9))
                .contextMenu { fileMenu(file) }
                .onTapGesture {
                    if let image = FrameImageCache.image(for: file.downloadPath) {
                        previewImage = image
                    }
                }
            }
        }
    }

    // Faste mappefarger + prosjektets egne fargeprøver i menyen.
    private let folderColors = ["#8b5cf6", "#3bb8c4", "#4caf7d", "#f0c243",
                                "#ef6a6a", "#a06ee0"]

    private func setFolderColor(_ folderId: String, hex: String?) {
        guard let index = state.userFolders.firstIndex(where: { $0.id == folderId }) else { return }
        state.userFolders[index].color = hex
        state.persistMeta()
    }

    @ViewBuilder
    private func fileMenu(_ file: RoleRoomAPIClient.StorageFileSummary) -> some View {
        Button("Omdøp") {
            renameFileId = file.id
            renameDraft = file.displayName
        }
        Menu("Flytt til mappe") {
            ForEach(state.userFolders) { folder in
                Button(folder.name) { state.move(fileId: file.id, to: folder.id) }
            }
            if state.folderFor(fileId: file.id) != nil {
                Button("Ut av mappen", role: .destructive) {
                    state.move(fileId: file.id, to: nil)
                }
            }
        }
        Button("Slett", role: .destructive) { pendingDeleteId = file.id }
    }

    private var fileGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 6),
                  spacing: 12) {
            ForEach(visibleFiles) { file in
                assetCard(file)
            }
        }
    }

    private func assetCard(_ file: RoleRoomAPIClient.StorageFileSummary) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                if file.isImage, let image = FrameImageCache.image(for: file.downloadPath) {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    Rectangle().fill(Color.white.opacity(0.05))
                        .overlay(Image(systemName: file.isImage ? "photo" : "doc.text")
                            .font(.system(size: 26))
                            .foregroundStyle(BoardBrand.label))
                        .task {
                            guard file.isImage,
                                  FrameImageCache.image(for: file.downloadPath) == nil else { return }
                            if let data = await RoleRoomAPIClient.shared
                                .fetchRemoteImageData(path: file.downloadPath),
                               let image = UIImage(data: data) {
                                FrameImageCache.store(image, for: file.downloadPath)
                                state.objectWillChange.send()
                            }
                        }
                }
            }
            .frame(height: 110)
            .clipped()
            VStack(alignment: .leading, spacing: 3) {
                Text(file.displayName)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white).lineLimit(1)
                HStack {
                    Text(fileTypeLabel(file))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(BoardBrand.label)
                    Spacer()
                    Text(ByteCountFormatter.string(fromByteCount: Int64(file.sizeBytes),
                                                   countStyle: .file))
                        .font(.system(size: 9)).foregroundStyle(BoardBrand.dim)
                }
            }
            .padding(8)
            .background(BoardBrand.panel)
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(BoardBrand.border))
        .onTapGesture {
            if let image = FrameImageCache.image(for: file.downloadPath) {
                previewImage = image
            }
        }
        .contextMenu { fileMenu(file) }
    }

    private func fileTypeLabel(_ file: RoleRoomAPIClient.StorageFileSummary) -> String {
        guard let contentType = file.contentType,
              let sub = contentType.split(separator: "/").last else { return "FIL" }
        return String(sub).uppercased()
    }
}
