// UploadFileSheet.swift
//
// Modal som åpnes når salgssjefen tapper "Last opp" i Filer-tab. Lar
// brukeren laste opp filer til lead'en fra 8 kilder:
//   • iPad-filer (Files-app)
//   • iPad-galleri (Photos)
//   • Ta bilde nå (Camera)
//   • Ta opp video
//   • Scan dokument (VisionKit)
//   • iCloud Drive
//   • Google Drive
//   • Dropbox
//   • OneDrive
//
// Etter valg: progress-overlay + metadata-felt (navn/tags/beskrivelse).
// I prod kobles hver kilde til sin native picker.

import SwiftUI
import UniformTypeIdentifiers

private enum UfBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.06)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.35)
}

struct UploadFileSheet: View {
    // Refaktorert (Pakke 10.1, 2026-07-01) — tar to primitives i stedet
    // for LeadRow, så samme sheet kan brukes fra både Leads-fanen og
    // Kart-fanen (MapLeadMock) uten type-adapter.
    let companyName: String
    let companyColor: Color
    /// Convenience-init som beholder Leads-fanens LeadRow-signatur.
    init(lead: LeadRow) {
        self.companyName = lead.company
        self.companyColor = lead.companyColor
    }
    init(companyName: String, companyColor: Color) {
        self.companyName = companyName
        self.companyColor = companyColor
    }
    @Environment(\.dismiss) private var dismiss
    @State private var stage: Stage = .selectSource
    @State private var selectedSource: UploadSource?
    @State private var fileName: String = ""
    @State private var fileDescription: String = ""
    @State private var tags: Set<String> = []
    @State private var uploadProgress: Double = 0
    @State private var filesPickerPresented: Bool = false

    enum Stage { case selectSource, metadata, uploading, done }

    enum UploadSource: String, CaseIterable, Identifiable, Hashable {
        case files = "iPad-filer"
        case photos = "Galleri"
        case camera = "Ta bilde"
        case video = "Ta opp video"
        case scan = "Skann dokument"
        case icloud = "iCloud Drive"
        case googleDrive = "Google Drive"
        case dropbox = "Dropbox"
        case onedrive = "OneDrive"
        case pasteURL = "Lim inn URL"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .files:       return "folder.fill"
            case .photos:      return "photo.on.rectangle.angled"
            case .camera:      return "camera.fill"
            case .video:       return "video.fill"
            case .scan:        return "doc.viewfinder"
            case .icloud:      return "icloud.fill"
            case .googleDrive: return "tray.fill"
            case .dropbox:     return "shippingbox.fill"
            case .onedrive:    return "cloud.fill"
            case .pasteURL:    return "link"
            }
        }
        var color: Color {
            switch self {
            case .files:       return UfBrand.blue
            case .photos:      return UfBrand.green
            case .camera:      return UfBrand.purple
            case .video:       return UfBrand.red
            case .scan:        return UfBrand.yellow
            case .icloud:      return UfBrand.blue
            case .googleDrive: return UfBrand.green
            case .dropbox:     return UfBrand.blue
            case .onedrive:    return UfBrand.purpleLight
            case .pasteURL:    return UfBrand.orange
            }
        }
        var subtitle: String {
            switch self {
            case .files:       return "Lokale + skylagrede filer via Files-app"
            case .photos:      return "Bilder + videoer fra iPad-galleri"
            case .camera:      return "Ta bilde nå med iPad-kamera"
            case .video:       return "Ta opp og last opp video"
            case .scan:        return "Scan papir-dokumenter (VisionKit)"
            case .icloud:      return "Direkte fra iCloud Drive"
            case .googleDrive: return "Krever Google-tilkobling"
            case .dropbox:     return "Krever Dropbox-tilkobling"
            case .onedrive:    return "Krever Microsoft-tilkobling"
            case .pasteURL:    return "Last ned fra ekstern lenke"
            }
        }
    }

    private let availableTags = ["Tilbud", "Kontrakt", "Faktura", "Befaring", "Foto", "Skisse", "Annet"]

    var body: some View {
        NavigationStack {
            Group {
                switch stage {
                case .selectSource:  sourceSelector
                case .metadata:      metadataForm
                case .uploading:     uploadingView
                case .done:          successView
                }
            }
            .background(UfBrand.bg.ignoresSafeArea())
            .navigationTitle(navTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(stage == .done ? "Ferdig" : "Avbryt") { dismiss() }
                        .foregroundStyle(UfBrand.purpleLight)
                }
                if stage == .metadata {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button { stage = .selectSource } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 11, weight: .semibold))
                                Text("Tilbake")
                                    .font(.system(size: 13, weight: .semibold))
                            }
                            .foregroundStyle(UfBrand.purpleLight)
                        }
                    }
                }
            }
            .toolbarBackground(UfBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .fileImporter(
                isPresented: $filesPickerPresented,
                allowedContentTypes: [.item],
                allowsMultipleSelection: false
            ) { result in
                if case .success(let urls) = result, let url = urls.first {
                    fileName = url.lastPathComponent
                    stage = .metadata
                }
            }
        }
        .macCatalystSheetSize(minWidth: 820, minHeight: 660)
    }

    private var navTitle: String {
        switch stage {
        case .selectSource: return "Last opp fil"
        case .metadata:     return fileName.isEmpty ? "Detaljer" : fileName
        case .uploading:    return "Laster opp…"
        case .done:         return "Ferdig"
        }
    }

    // MARK: Source-velger (3-kolonne grid)

    private var sourceSelector: some View {
        ScrollView {
            VStack(spacing: 16) {
                leadHeader
                pickSourceCard
                sourceGrid
                Color.clear.frame(height: 16)
            }
            .padding(20)
        }
    }

    private var leadHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(companyColor.opacity(0.22))
                Image(systemName: "building.2.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(companyColor)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text("Last opp til")
                    .font(.system(size: 11))
                    .foregroundStyle(UfBrand.textSecondary)
                Text(companyName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
        .padding(12)
        .background(UfBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(UfBrand.stroke, lineWidth: 1))
    }

    private var pickSourceCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 13))
                .foregroundStyle(UfBrand.purpleLight)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 3) {
                Text("Velg kilde")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Text("Du kan laste opp én eller flere filer fra en av kildene under. Filer lagres kryptert i Leadgrid B2-storage.")
                    .font(.system(size: 11))
                    .foregroundStyle(UfBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .padding(12)
        .background(UfBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(UfBrand.purple.opacity(0.30), lineWidth: 1))
    }

    private var sourceGrid: some View {
        let cols = [GridItem(.flexible(), spacing: 10),
                    GridItem(.flexible(), spacing: 10),
                    GridItem(.flexible(), spacing: 10)]
        return VStack(alignment: .leading, spacing: 14) {
            sectionLabel("Fra iPad", icon: "ipad")
            LazyVGrid(columns: cols, spacing: 10) {
                ForEach([UploadSource.files, .photos, .camera, .video, .scan]) { src in
                    sourceTile(src)
                }
            }
            sectionLabel("Fra skyen", icon: "cloud.fill")
            LazyVGrid(columns: cols, spacing: 10) {
                ForEach([UploadSource.icloud, .googleDrive, .dropbox, .onedrive, .pasteURL]) { src in
                    sourceTile(src)
                }
            }
        }
    }

    private func sectionLabel(_ s: String, icon: String) -> some View {
        HStack(spacing: 7) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(UfBrand.purpleLight)
            Text(s)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
            Spacer()
        }
    }

    private func sourceTile(_ src: UploadSource) -> some View {
        Button { selectSource(src) } label: {
            VStack(spacing: 7) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(LinearGradient(
                            colors: [src.color.opacity(0.30), src.color.opacity(0.10)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                    Image(systemName: src.icon)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(src.color)
                }
                .frame(height: 70)
                Text(src.rawValue)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(src.subtitle)
                    .font(.system(size: 9))
                    .foregroundStyle(UfBrand.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: .infinity)
            .padding(10)
            .background(UfBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(UfBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func selectSource(_ src: UploadSource) {
        selectedSource = src
        switch src {
        case .files:
            filesPickerPresented = true
        case .photos:
            fileName = "IMG_\(Int.random(in: 1000...9999)).heic"
            stage = .metadata
        case .camera:
            fileName = "Foto_\(Int.random(in: 1000...9999)).jpg"
            stage = .metadata
        case .video:
            fileName = "Video_\(Int.random(in: 1000...9999)).mov"
            stage = .metadata
        case .scan:
            fileName = "Scan_\(Int.random(in: 1000...9999)).pdf"
            stage = .metadata
        case .icloud, .googleDrive, .dropbox, .onedrive:
            // I prod: åpner cloud picker. Her: mock filnavn
            fileName = "\(src.rawValue.replacingOccurrences(of: " ", with: "_"))_dok.pdf"
            stage = .metadata
        case .pasteURL:
            fileName = "lenke_dokument.pdf"
            stage = .metadata
        }
    }

    // MARK: Metadata-skjema

    private var metadataForm: some View {
        ScrollView {
            VStack(spacing: 14) {
                filePreviewCard
                nameField
                tagsCard
                descriptionField
                Color.clear.frame(height: 90)
            }
            .padding(20)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { uploadBar }
    }

    private var filePreviewCard: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill((selectedSource?.color ?? UfBrand.purple).opacity(0.22))
                Image(systemName: inferIcon(for: fileName))
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(selectedSource?.color ?? UfBrand.purple)
            }
            .frame(width: 60, height: 60)
            VStack(alignment: .leading, spacing: 3) {
                Text(fileName)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                if let src = selectedSource {
                    HStack(spacing: 4) {
                        Image(systemName: src.icon)
                            .font(.system(size: 9))
                        Text("Fra \(src.rawValue)")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(src.color)
                }
            }
            Spacer()
        }
        .padding(14)
        .background(UfBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(UfBrand.stroke, lineWidth: 1))
    }

    private func inferIcon(for name: String) -> String {
        let ext = (name as NSString).pathExtension.lowercased()
        switch ext {
        case "pdf":                return "doc.fill"
        case "doc", "docx":         return "doc.text.fill"
        case "xls", "xlsx":         return "tablecells.fill"
        case "jpg", "jpeg", "png", "heic": return "photo.fill"
        case "mp4", "mov":          return "play.rectangle.fill"
        case "zip":                 return "doc.zipper"
        default:                    return "doc"
        }
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Filnavn")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(UfBrand.textSecondary)
            TextField("", text: $fileName)
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .font(.system(size: 13))
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(UfBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(UfBrand.stroke, lineWidth: 1))
        }
    }

    private var tagsCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Tags")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(UfBrand.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(availableTags, id: \.self) { t in
                        Button {
                            if tags.contains(t) { tags.remove(t) } else { tags.insert(t) }
                        } label: {
                            Text(t)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(tags.contains(t) ? .white : UfBrand.textSecondary)
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(
                                    tags.contains(t)
                                        ? AnyShapeStyle(LinearGradient(
                                            colors: [UfBrand.purple, UfBrand.purpleLight],
                                            startPoint: .leading, endPoint: .trailing
                                        ))
                                        : AnyShapeStyle(UfBrand.cardHi),
                                    in: Capsule()
                                )
                                .overlay(Capsule().stroke(
                                    tags.contains(t) ? Color.clear : UfBrand.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var descriptionField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Beskrivelse (valgfritt)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(UfBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $fileDescription)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .frame(minHeight: 80)
                    .padding(10)
                    .background(UfBrand.card, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(UfBrand.stroke, lineWidth: 1))
                if fileDescription.isEmpty {
                    Text("F.eks. «Endelig tilbud — del 2 inkluderer oppdateringen»")
                        .font(.system(size: 12))
                        .foregroundStyle(UfBrand.textTertiary)
                        .padding(.horizontal, 14).padding(.vertical, 16)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var uploadBar: some View {
        HStack(spacing: 10) {
            Button { stage = .selectSource } label: {
                Text("Tilbake")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(UfBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(UfBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { startUpload() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 13, weight: .bold))
                    Text("Last opp")
                        .font(.system(size: 14, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(colors: [UfBrand.purple, UfBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
            .disabled(fileName.isEmpty)
            .opacity(fileName.isEmpty ? 0.5 : 1)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            UfBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(UfBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    private func startUpload() {
        stage = .uploading
        uploadProgress = 0
        // Mock upload-progress
        Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { timer in
            uploadProgress += 0.04
            if uploadProgress >= 1 {
                timer.invalidate()
                stage = .done
            }
        }
    }

    // MARK: Uploading

    private var uploadingView: some View {
        VStack(spacing: 20) {
            Spacer()
            ZStack {
                Circle()
                    .stroke(UfBrand.stroke, lineWidth: 6)
                    .frame(width: 100, height: 100)
                Circle()
                    .trim(from: 0, to: uploadProgress)
                    .stroke(LinearGradient(
                        colors: [UfBrand.purple, UfBrand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 100, height: 100)
                    .animation(.linear, value: uploadProgress)
                Text("\(Int(uploadProgress * 100)) %")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
            VStack(spacing: 5) {
                Text("Laster opp \(fileName)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Krypterer + lagrer i Leadgrid B2-storage")
                    .font(.system(size: 11))
                    .foregroundStyle(UfBrand.textSecondary)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Done

    private var successView: some View {
        VStack(spacing: 16) {
            Spacer()
            ZStack {
                Circle()
                    .fill(LinearGradient(
                        colors: [UfBrand.green.opacity(0.30), UfBrand.green.opacity(0.10)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    .frame(width: 100, height: 100)
                Image(systemName: "checkmark")
                    .font(.system(size: 40, weight: .bold))
                    .foregroundStyle(UfBrand.green)
            }
            VStack(spacing: 5) {
                Text("Opplastet!")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(fileName) er lagret på \(companyName)")
                    .font(.system(size: 12))
                    .foregroundStyle(UfBrand.textSecondary)
                    .multilineTextAlignment(.center)
            }
            VStack(spacing: 8) {
                Button {
                    // Reset til ny opplasting
                    stage = .selectSource
                    selectedSource = nil
                    fileName = ""
                    fileDescription = ""
                    tags.removeAll()
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 12, weight: .bold))
                        Text("Last opp en til")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(UfBrand.purpleLight)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(UfBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(UfBrand.purple.opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
                Button { dismiss() } label: {
                    Text("Ferdig")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(
                            LinearGradient(colors: [UfBrand.green, UfBrand.green.opacity(0.7)],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 11)
                        )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 40)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
