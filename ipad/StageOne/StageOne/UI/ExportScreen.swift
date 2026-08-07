import SwiftUI

/// Leveranse: live preview + format/range/oppløsning/fps, ekte eksport
/// (ExportEngine) og historikk = faktiske filer i Documents/exports.
struct ExportScreen: View {
    let document: SceneDocument
    let renderer: StageRenderer

    enum Format: String, CaseIterable { case video = "Video", still = "Still Frame" }
    enum Range: String, CaseIterable { case full = "Full sequence", shot = "Current shot" }
    struct Resolution: Hashable {
        let label: String
        let width: Int
        let height: Int
        let sizeFactor: Double // prototypens estimat-faktor
        static let all = [
            Resolution(label: "4K · 3840×2160", width: 3840, height: 2160, sizeFactor: 1.0),
            Resolution(label: "1080p · 1920×1080", width: 1920, height: 1080, sizeFactor: 0.35),
            Resolution(label: "720p · 1280×720", width: 1280, height: 720, sizeFactor: 0.18),
        ]
    }

    @State private var engine = ExportEngine()
    @State private var format: Format = .video
    @State private var range: Range = .full
    @State private var resolution = Resolution.all[1]
    @State private var fps = 30
    @State private var selectedCameraId: String?
    @State private var selectedShotIndex = 0
    @State private var history: [ExportRecord] = []
    @State private var errorMessage: String?

    private var cameraNodes: [Node] { document.data.nodes.filter { $0.kind == .camera } }

    var body: some View {
        HStack(spacing: 0) {
            previewColumn
            Rectangle().fill(Theme.border).frame(width: Theme.hairline)
            settingsColumn
        }
        .background(Theme.bg)
        .onAppear {
            if selectedCameraId == nil { selectedCameraId = cameraNodes.first?.id }
            history = ExportEngine.listExports()
        }
    }

    // MARK: - Venstre: preview + kamera-velger

    private var previewColumn: some View {
        VStack(alignment: .leading, spacing: 12) {
            InspectorSectionHeader(title: "Preview")
            ZStack {
                if let id = previewCameraId {
                    CameraTileView(document: document, renderer: renderer, cameraNodeId: id, fps: 30)
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: Theme.hairline))

            if format == .still || range == .shot {
                chipRow
            }

            Spacer()
            historySection
        }
        .padding(14)
        .frame(maxWidth: .infinity)
    }

    /// Still: valgt kamera. Video full: kameraet i første shot. Video shot: shotets kamera.
    private var previewCameraId: String? {
        switch format {
        case .still: return selectedCameraId
        case .video:
            let shots = document.data.shots
            guard !shots.isEmpty else { return selectedCameraId }
            let index = range == .shot ? min(selectedShotIndex, shots.count - 1) : 0
            return shots[index].cameraNodeId
        }
    }

    @ViewBuilder
    private var chipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                if format == .still {
                    ForEach(cameraNodes) { node in
                        chip(node.name, selected: selectedCameraId == node.id) {
                            selectedCameraId = node.id
                        }
                    }
                } else {
                    ForEach(Array(document.data.shots.enumerated()), id: \.element.id) { index, shot in
                        chip(shot.name, selected: selectedShotIndex == index) {
                            selectedShotIndex = index
                        }
                    }
                }
            }
        }
    }

    private func chip(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 11, weight: selected ? .semibold : .regular))
                .foregroundStyle(selected ? Theme.fg : Theme.muted)
                .padding(.horizontal, 11)
                .padding(.vertical, 6)
                .background(Capsule().fill(selected ? Theme.accent.opacity(0.35) : Theme.raise))
                .overlay(Capsule().stroke(selected ? Theme.accent.opacity(0.5) : Theme.border,
                                          lineWidth: Theme.hairline))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Historikk

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            InspectorSectionHeader(title: "Session history")
            if history.isEmpty {
                Text("Ingen eksporter enda — ferdige filer dukker opp her.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
                    .padding(.vertical, 8)
            } else {
                ScrollView {
                    VStack(spacing: 6) {
                        ForEach(history.prefix(8)) { record in
                            historyRow(record)
                        }
                    }
                }
                .frame(maxHeight: 220)
            }
        }
    }

    private func historyRow(_ record: ExportRecord) -> some View {
        HStack(spacing: 10) {
            Image(systemName: record.name.hasSuffix(".mp4") ? "film" : "photo")
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted)
            VStack(alignment: .leading, spacing: 1) {
                Text(record.name)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.fg)
                    .lineLimit(1)
                Text("\(ByteCountFormatter.string(fromByteCount: Int64(record.sizeBytes), countStyle: .file)) · \(record.date.formatted(date: .abbreviated, time: .shortened))")
                    .font(Theme.mono(10))
                    .foregroundStyle(Theme.muted)
            }
            Spacer()
            ShareLink(item: record.url) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.accent)
            }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: Theme.hairline))
    }

    // MARK: - Høyre: innstillinger + kjør

    private var settingsColumn: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                InspectorSectionHeader(title: "Export settings")

                labeled("Format") {
                    SegmentPicker(options: Format.allCases.map(\.rawValue), selection: format.rawValue) { sel in
                        format = Format(rawValue: sel) ?? .video
                    }
                    HStack(spacing: 6) {
                        Text("USDZ Scene")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.muted)
                        Text("Kommer")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(Theme.muted)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Theme.raise))
                    }
                }

                if format == .video {
                    labeled("Range") {
                        SegmentPicker(options: Range.allCases.map(\.rawValue), selection: range.rawValue) { sel in
                            range = Range(rawValue: sel) ?? .full
                        }
                    }
                }

                labeled("Resolution") {
                    VStack(spacing: 4) {
                        ForEach(Resolution.all, id: \.self) { res in
                            chip(res.label, selected: resolution == res) { resolution = res }
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }

                if format == .video {
                    labeled("Frame rate") {
                        SegmentPicker(options: ["24", "30", "60"], selection: String(fps)) { sel in
                            fps = Int(sel) ?? 30
                        }
                    }
                }

                HStack {
                    Text("Estimated size")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                    Spacer()
                    Text("≈ \(estimateMB) MB")
                        .font(Theme.mono(12))
                        .foregroundStyle(Theme.fg)
                }

                if engine.isExporting {
                    VStack(spacing: 6) {
                        ProgressView(value: engine.progress)
                            .tint(Theme.accent)
                        HStack {
                            Text("\(Int(engine.progress * 100))%")
                                .font(Theme.mono(11))
                                .foregroundStyle(Theme.muted)
                            Spacer()
                            Button("Avbryt") { engine.cancel() }
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.muted)
                        }
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 11))
                        .foregroundStyle(.red)
                }

                Button {
                    runExport()
                } label: {
                    Text(engine.isExporting ? "Exporting…" : "Export")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.fg)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(RoundedRectangle(cornerRadius: 10)
                            .fill(Theme.accent.opacity(engine.isExporting ? 0.15 : 0.35)))
                        .overlay(RoundedRectangle(cornerRadius: 10)
                            .stroke(Theme.accent.opacity(0.6), lineWidth: Theme.hairline))
                }
                .buttonStyle(.plain)
                .disabled(engine.isExporting)
            }
            .padding(14)
        }
        .frame(width: 320)
        .background(Theme.surface)
    }

    private func labeled(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12))
                .foregroundStyle(Theme.muted)
            content()
        }
    }

    /// Prototypens heuristikk: px-faktor · fps/30 · sek · 25 MB (video); faktor·8+2 (still).
    private var estimateMB: Int {
        switch format {
        case .video:
            let secs = range == .full
                ? document.data.shots.reduce(0) { $0 + $1.durationSec }
                : document.data.shots.indices.contains(selectedShotIndex)
                    ? document.data.shots[selectedShotIndex].durationSec : 0
            return Int((resolution.sizeFactor * Double(fps) / 30 * secs * 25).rounded())
        case .still:
            return Int((resolution.sizeFactor * 8 + 2).rounded())
        }
    }

    private func runExport() {
        errorMessage = nil
        let scene = document.data
        switch format {
        case .still:
            guard let camId = selectedCameraId else { return }
            do {
                _ = try engine.exportStill(scene: scene, cameraNodeId: camId,
                                           width: resolution.width, height: resolution.height,
                                           renderer: renderer)
                history = ExportEngine.listExports()
            } catch {
                errorMessage = "Eksport feilet: \(error)"
            }
        case .video:
            let shots: [Shot]
            let label: String
            if range == .full {
                shots = scene.shots
                label = "Sequence"
            } else {
                guard scene.shots.indices.contains(selectedShotIndex) else { return }
                shots = [scene.shots[selectedShotIndex]]
                label = scene.shots[selectedShotIndex].name.replacingOccurrences(of: " ", with: "")
            }
            guard !shots.isEmpty else { return }
            Task {
                do {
                    _ = try await engine.exportVideo(scene: scene, shots: shots,
                                                     width: resolution.width, height: resolution.height,
                                                     fps: fps, renderer: renderer, label: label)
                    history = ExportEngine.listExports()
                } catch ExportError.cancelled {
                    history = ExportEngine.listExports()
                } catch {
                    errorMessage = "Eksport feilet: \(error)"
                }
            }
        }
    }
}
