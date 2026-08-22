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
    @Published var loading = true

    init(project: ProjectSummary, manuscript: ManuscriptSummary) {
        self.project = project
        self.manuscript = manuscript
    }

    func load() async {
        loading = files.isEmpty
        files = await RoleRoomAPIClient.shared.listStorageFiles(projectId: project.id)
        loading = false
    }
}

struct AssetsView: View {
    @StateObject private var state: AssetsState
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @State private var typeFilter = "Alle"
    @State private var sortNewestFirst = true
    @State private var folderFilter: String?
    @State private var importPickerItem: PhotosPickerItem?
    @State private var previewImage: UIImage?
    @State private var pendingDeleteId: String?
    @State private var status: String?

    init(project: ProjectSummary, manuscript: ManuscriptSummary) {
        _state = StateObject(wrappedValue: AssetsState(project: project, manuscript: manuscript))
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
            .filter { folderFilter == nil || folderKey($0) == folderFilter }
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
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Alle filer, bilder og media for produksjonen — lagret i Role Room-skyen.")
                        .font(.system(size: 13)).foregroundStyle(BoardBrand.dim)
                    filterRow
                    if folderFilter == nil && searchText.isEmpty {
                        folderRow
                    }
                    fileGrid
                }
                .padding(18)
            }
            .background(BoardBrand.chrome)
            .navigationTitle(folderFilter.flatMap { key in
                Self.folders.first { $0.key == key }?.title
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
                                  FrameImageCache.images[file.downloadPath] == nil else { return }
                            if let data = await RoleRoomAPIClient.shared
                                .fetchRemoteImageData(path: file.downloadPath),
                               let image = UIImage(data: data) {
                                FrameImageCache.images[file.downloadPath] = image
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
        .contextMenu {
            Button(role: .destructive) {
                pendingDeleteId = file.id
            } label: {
                Label("Slett", systemImage: "trash")
            }
        }
    }

    private func fileTypeLabel(_ file: RoleRoomAPIClient.StorageFileSummary) -> String {
        guard let contentType = file.contentType,
              let sub = contentType.split(separator: "/").last else { return "FIL" }
        return String(sub).uppercased()
    }
}
