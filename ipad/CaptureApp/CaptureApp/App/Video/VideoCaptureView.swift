import AVFoundation
import AVKit
import Foundation
import Observation
import SwiftUI

struct VideoCaptureView: View {
    private enum AuxiliaryPanel: String, Identifiable {
        case sources
        case take
        var id: String { rawValue }
    }

    @State private var model = VideoCaptureModel()
    @State private var auth = SignInService.shared
    @State private var showProjectPicker = false
    @State private var auxiliaryPanel: AuxiliaryPanel?

    var body: some View {
        GeometryReader { proxy in
            let layout = VideoWorkspaceLayout.resolve(size: proxy.size)

            VStack(spacing: 0) {
                header(layout: layout)
                Divider().overlay(CHTheme.border)
                HStack(spacing: 0) {
                    if layout.showsSourceRail {
                        sourceRail
                            .frame(width: layout.sourceRailWidth)
                        Divider().overlay(CHTheme.border)
                    }
                    monitor
                    if layout.showsTakeInspector {
                        Divider().overlay(CHTheme.border)
                        takeInspector.frame(width: layout.takeInspectorWidth)
                    }
                }
                Divider().overlay(CHTheme.border)
                filmstrip
                    .frame(height: layout.filmstripHeight)
            }
            .background(CHTheme.bgDeep)
        }
        .chBranded()
        .sheet(isPresented: $showProjectPicker) {
            ProjectSelectionView { project in model.selectProject(project) }
                .environment(auth)
                .presentationDetents([.large])
        }
        .sheet(item: $auxiliaryPanel) { panel in
            Group {
                switch panel {
                case .sources:
                    sourceRail
                case .take:
                    takeInspector
                }
            }
            .frame(minWidth: 320, minHeight: 420)
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .task { await model.activate() }
        .onDisappear { Task { await model.deactivate() } }
        .alert("Videoopptak", isPresented: errorBinding) {
            Button("OK") { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "Ukjent feil")
        }
    }

    private func header(layout: VideoWorkspaceLayout) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Video")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(CHTheme.textPrimary)
                Text("Monitor · opptak · sikre takes")
                    .font(.caption)
                    .foregroundStyle(CHTheme.textMuted)
            }
            Spacer()
            if !layout.showsSourceRail {
                Button {
                    auxiliaryPanel = .sources
                } label: {
                    Label("Kilder", systemImage: "video.badge.plus")
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("video-sources-panel")
            }
            Button {
                showProjectPicker = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "folder")
                    Text(
                        layout.mode == .compact
                            ? "Prosjekt"
                            : (model.selectedProjectTitle ?? "Velg prosjekt")
                    )
                        .lineLimit(1)
                    Image(systemName: "chevron.down").font(.caption2)
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 13).padding(.vertical, 9)
                .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(CHTheme.border))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("video-project-picker")

            if !layout.showsTakeInspector {
                Button {
                    auxiliaryPanel = .take
                } label: {
                    Label("Take", systemImage: "slider.horizontal.3")
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("video-take-panel")
            }

            Label(model.connectionLabel, systemImage: model.connectionIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(model.monitorReady ? CHTheme.success : CHTheme.textSecondary)
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(CHTheme.surface, in: Capsule())
        }
        .padding(.horizontal, 18).padding(.vertical, 12)
        .background(CHTheme.bg)
    }

    private var sourceRail: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("VIDEOKILDER")
                    .font(.caption2.weight(.bold))
                    .tracking(1.1)
                    .foregroundStyle(CHTheme.textMuted)
                Spacer()
                Button { model.camera.refreshSources() } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.plain)
                .foregroundStyle(CHTheme.textSecondary)
                .accessibilityLabel("Oppdater videokilder")
            }
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(model.camera.sources) { source in
                        Button {
                            Task { await model.selectSource(source.id) }
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: source.isExternal ? "cable.connector" : "ipad")
                                    .frame(width: 22)
                                    .foregroundStyle(model.isLocalSourceSelected(source.id) ? CHTheme.accent : CHTheme.textSecondary)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(source.name).lineLimit(2)
                                        .font(.caption.weight(.semibold))
                                    Text(source.isExternal ? "USB / UVC" : "Innebygd")
                                        .font(.caption2).foregroundStyle(CHTheme.textMuted)
                                }
                                Spacer(minLength: 0)
                                Circle()
                                    .fill(model.isLocalSourceSelected(source.id) ? CHTheme.success : CHTheme.borderStrong)
                                    .frame(width: 7, height: 7)
                            }
                            .foregroundStyle(CHTheme.textPrimary)
                            .padding(10)
                            .background(
                                model.isLocalSourceSelected(source.id) ? CHTheme.accentFill : CHTheme.surface,
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(model.isLocalSourceSelected(source.id) ? CHTheme.accentBorder : CHTheme.borderSoft)
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    if !model.canon.cameras.isEmpty {
                        HStack {
                            Rectangle().fill(CHTheme.borderSoft).frame(height: 1)
                            Text("CANON CCAPI").font(.caption2.weight(.bold)).tracking(1)
                            Rectangle().fill(CHTheme.borderSoft).frame(height: 1)
                        }
                        .foregroundStyle(CHTheme.textMuted)
                        .padding(.vertical, 4)
                    }

                    ForEach(model.canon.cameras) { camera in
                        Button {
                            Task { await model.selectCanonCamera(camera) }
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "camera.aperture")
                                    .frame(width: 22)
                                    .foregroundStyle(model.canon.selectedCameraId == camera.id ? CHTheme.accent : CHTheme.textSecondary)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(camera.displayName).lineLimit(2)
                                        .font(.caption.weight(.semibold))
                                    Text("Direkte CCAPI · lokal Wi-Fi")
                                        .font(.caption2).foregroundStyle(CHTheme.textMuted)
                                }
                                Spacer(minLength: 0)
                                Circle()
                                    .fill(model.canon.selectedCameraId == camera.id ? CHTheme.success : CHTheme.borderStrong)
                                    .frame(width: 7, height: 7)
                            }
                            .foregroundStyle(CHTheme.textPrimary)
                            .padding(10)
                            .background(
                                model.canon.selectedCameraId == camera.id ? CHTheme.accentFill : CHTheme.surface,
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(model.canon.selectedCameraId == camera.id ? CHTheme.accentBorder : CHTheme.borderSoft)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(model.camera.isRecording)
                    }

                    if !model.bridgeDiscovery.sources.isEmpty {
                        HStack {
                            Rectangle().fill(CHTheme.borderSoft).frame(height: 1)
                            Text("BRIDGE").font(.caption2.weight(.bold)).tracking(1)
                            Rectangle().fill(CHTheme.borderSoft).frame(height: 1)
                        }
                        .foregroundStyle(CHTheme.textMuted)
                        .padding(.vertical, 4)
                    }

                    ForEach(model.bridgeDiscovery.sources) { source in
                        Button {
                            Task { await model.selectBridgeSource(source) }
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: source.role == .multiview ? "rectangle.grid.2x2" : "network")
                                    .frame(width: 22)
                                    .foregroundStyle(model.selectedBridgeSourceId == source.id ? CHTheme.accent : CHTheme.textSecondary)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(source.label).lineLimit(2)
                                        .font(.caption.weight(.semibold))
                                    Text("\(source.bridgeName) · \(source.qualityLabel)")
                                        .font(.caption2).foregroundStyle(CHTheme.textMuted)
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 0)
                                Circle()
                                    .fill(model.selectedBridgeSourceId == source.id ? CHTheme.success : CHTheme.borderStrong)
                                    .frame(width: 7, height: 7)
                            }
                            .foregroundStyle(CHTheme.textPrimary)
                            .padding(10)
                            .background(
                                model.selectedBridgeSourceId == source.id ? CHTheme.accentFill : CHTheme.surface,
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(model.selectedBridgeSourceId == source.id ? CHTheme.accentBorder : CHTheme.borderSoft)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(model.camera.isRecording)
                    }
                }
            }
            Spacer(minLength: 0)
            VStack(alignment: .leading, spacing: 5) {
                Label("UVC gir monitor + opptak", systemImage: "checkmark.circle")
                Label("Canon live view går direkte via CCAPI", systemImage: "camera.aperture")
                Label("Bridge-preview går kun på lokalnettet", systemImage: "network")
            }
            .font(.caption2)
            .foregroundStyle(CHTheme.textMuted)
        }
        .padding(14)
        .background(CHTheme.bg)
        .accessibilityIdentifier("video-source-rail")
    }

    private var monitor: some View {
        VStack(spacing: 0) {
            ZStack {
                Color.black
                if let canonFrame = model.canon.frame, model.canon.selectedCameraId != nil {
                    Image(uiImage: canonFrame)
                        .resizable()
                        .scaledToFit()
                        .accessibilityLabel("Canon CCAPI live monitor")
                } else if let player = model.bridgePlayer {
                    VideoPlayer(player: player)
                        .accessibilityLabel("CreatorHub Bridge live monitor")
                } else {
                    VideoPreviewView(controller: model.camera)
                        .accessibilityLabel("Live videomonitor")
                }
                if !model.monitorReady && !model.camera.isRecording {
                    VStack(spacing: 12) {
                        ProgressView().controlSize(.large)
                        Text(model.connectionLabel)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(CHTheme.textSecondary)
                    }
                }
                VStack {
                    HStack {
                        if model.camera.isRecording {
                            Label("REC", systemImage: "circle.fill")
                                .font(.caption.weight(.black))
                                .foregroundStyle(CHTheme.danger)
                                .padding(.horizontal, 10).padding(.vertical, 7)
                                .background(.black.opacity(0.72), in: Capsule())
                        }
                        Spacer()
                        Text(model.activeFormatLabel)
                            .font(.caption.monospaced().weight(.semibold))
                            .foregroundStyle(.white.opacity(0.82))
                            .padding(.horizontal, 10).padding(.vertical, 7)
                            .background(.black.opacity(0.65), in: Capsule())
                    }
                    Spacer()
                }
                .padding(14)
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(14)

            controls
        }
        .background(CHTheme.bgDeep)
    }

    private var controls: some View {
        HStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 2) {
                Text(model.slate.isEmpty ? "Ingen slate" : model.slate)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textPrimary)
                Text("Take \(model.nextTakeNumber)")
                    .font(.caption.monospaced())
                    .foregroundStyle(CHTheme.textMuted)
            }
            Spacer()
            if model.camera.isRecording {
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    Text(model.recordingDurationLabel)
                        .font(.title3.monospacedDigit().weight(.semibold))
                        .foregroundStyle(CHTheme.danger)
                }
            }
            Button {
                Task { await model.toggleRecording() }
            } label: {
                ZStack {
                    Circle()
                        .stroke(.white.opacity(0.9), lineWidth: 4)
                        .frame(width: 64, height: 64)
                    if model.camera.isRecording {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(CHTheme.danger)
                            .frame(width: 27, height: 27)
                    } else {
                        Circle().fill(CHTheme.danger).frame(width: 48, height: 48)
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(!model.canRecord)
            .opacity(model.canRecord || model.camera.isRecording ? 1 : 0.42)
            .accessibilityLabel(model.camera.isRecording ? "Stopp opptak" : "Start opptak")
            .accessibilityIdentifier("video-record-button")
            Spacer()
            Label(model.pendingUploadLabel, systemImage: "icloud.and.arrow.up")
                .font(.caption)
                .foregroundStyle(CHTheme.textMuted)
                .frame(minWidth: 110, alignment: .trailing)
        }
        .padding(.horizontal, 24).padding(.bottom, 16)
    }

    private var takeInspector: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("TAKE")
                    .font(.caption2.weight(.bold)).tracking(1.1)
                    .foregroundStyle(CHTheme.textMuted)
                field("Slate", text: $model.slate, prompt: "A001")
                field("Scene", text: $model.sceneId, prompt: "12")
                field("Shot", text: $model.shotId, prompt: "12A")
                VStack(alignment: .leading, spacing: 6) {
                    Text("Neste take").font(.caption).foregroundStyle(CHTheme.textMuted)
                    Text("\(model.nextTakeNumber)")
                        .font(.title2.monospacedDigit().weight(.bold))
                        .foregroundStyle(CHTheme.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(CHTheme.input, in: RoundedRectangle(cornerRadius: 8))
                }
                Divider().overlay(CHTheme.borderSoft)
                if let selected = model.selectedAsset {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("VALGT TAKE")
                            .font(.caption2.weight(.bold)).tracking(1.1)
                            .foregroundStyle(CHTheme.textMuted)
                        Text("\(selected.slate?.isEmpty == false ? selected.slate! : selected.fileName) · T\(selected.takeNumber)")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(CHTheme.textPrimary)
                            .lineLimit(2)
                        Button {
                            Task { await model.promoteSelectedTake() }
                        } label: {
                            Label(
                                model.isPromoting ? "Sender…" : "Send til Video Room",
                                systemImage: "arrow.up.right.video"
                            )
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(CHTheme.accent)
                        .disabled(selected.captureState != .ready || model.isPromoting)
                        .accessibilityHint(
                            selected.captureState == .ready
                                ? "Oppretter en review-versjon uten å kopiere S3-originalen"
                                : "Take må være ferdig sikret før den kan sendes"
                        )
                        if let promotionMessage = model.promotionMessage {
                            Label(promotionMessage, systemImage: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(CHTheme.success)
                        } else if selected.captureState != .ready {
                            Text("Take må være ferdig lastet opp før den kan sendes til review.")
                                .font(.caption)
                                .foregroundStyle(CHTheme.textMuted)
                        }
                    }
                    Divider().overlay(CHTheme.borderSoft)
                }
                Text("Originalen lagres privat i CreatorHub S3. Stream lager kun avspillingsproxy når den er konfigurert.")
                    .font(.caption)
                    .foregroundStyle(CHTheme.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
        }
        .background(CHTheme.bg)
    }

    private func field(_ label: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.caption).foregroundStyle(CHTheme.textMuted)
            TextField(prompt, text: text)
                .textFieldStyle(.plain)
                .foregroundStyle(CHTheme.textPrimary)
                .padding(10)
                .background(CHTheme.input, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(CHTheme.borderSoft))
        }
    }

    private var filmstrip: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 10) {
                if model.assets.isEmpty {
                    Label("Opptakene vises her", systemImage: "film")
                        .font(.subheadline)
                        .foregroundStyle(CHTheme.textMuted)
                        .padding(.horizontal, 16)
                }
                ForEach(model.assets) { asset in
                    Button {
                        model.selectAsset(asset.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8).fill(Color.black)
                                Image(systemName: "film.fill")
                                    .font(.title2).foregroundStyle(CHTheme.textMuted)
                                VStack {
                                    Spacer()
                                    HStack {
                                        Text("T\(asset.takeNumber)")
                                        Spacer()
                                        Image(systemName: stateIcon(asset.captureState))
                                    }
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(stateColor(asset.captureState))
                                    .padding(6)
                                    .background(.black.opacity(0.72))
                                }
                            }
                            .frame(width: 138, height: 76)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(
                                        model.selectedAssetId == asset.id ? CHTheme.accent : .clear,
                                        lineWidth: 2
                                    )
                            )
                            Text(asset.slate?.isEmpty == false ? asset.slate! : asset.fileName)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(CHTheme.textSecondary)
                                .lineLimit(1)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("Take \(asset.takeNumber), \(asset.captureState.rawValue)")
                    .accessibilityAddTraits(model.selectedAssetId == asset.id ? .isSelected : [])
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
        }
        .background(CHTheme.bg)
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })
    }

    private func stateIcon(_ state: VideoCaptureAsset.CaptureState) -> String {
        switch state {
        case .ready: "checkmark.circle.fill"
        case .failed: "exclamationmark.triangle.fill"
        case .local: "internaldrive"
        default: "arrow.up.circle.fill"
        }
    }

    private func stateColor(_ state: VideoCaptureAsset.CaptureState) -> Color {
        switch state {
        case .ready: CHTheme.success
        case .failed: CHTheme.danger
        case .local: CHTheme.warning
        default: CHTheme.info
        }
    }
}

struct VideoWorkspaceLayout: Equatable {
    enum Mode: Equatable { case compact, standard, wide }

    let mode: Mode
    let sourceRailWidth: CGFloat
    let takeInspectorWidth: CGFloat
    let filmstripHeight: CGFloat

    var showsSourceRail: Bool { mode != .compact }
    var showsTakeInspector: Bool { mode == .wide }

    static func resolve(size: CGSize) -> Self {
        let mode: Mode = if size.width >= 980 {
            .wide
        } else if size.width >= 700 {
            .standard
        } else {
            .compact
        }
        return Self(
            mode: mode,
            sourceRailWidth: size.width >= 1_100 ? 220 : 180,
            takeInspectorWidth: size.width >= 1_200 ? 300 : 270,
            filmstripHeight: size.height < 650 ? 104 : 126
        )
    }
}

@MainActor
@Observable
final class VideoCaptureModel {
    let camera = VideoCameraController()
    let canon = CCAPILiveViewController()
    let bridgeDiscovery = CreatorHubBridgeDiscovery()
    private var store: VideoCaptureStore?
    private var activeUploads: Set<String> = []

    var selectedProjectId: String?
    var selectedProjectTitle: String?
    var assets: [VideoCaptureAsset] = []
    var slate = ""
    var sceneId = ""
    var shotId = ""
    var nextTakeNumber = 1
    var selectedAssetId: String?
    var recordingStartedAt: Date?
    var errorMessage: String?
    var promotionMessage: String?
    var isPromoting = false
    var selectedBridgeSourceId: String?
    var bridgePlayer: AVPlayer?

    init() {
        selectedProjectId = UserDefaults.standard.string(forKey: "video.selectedProjectId")
        selectedProjectTitle = UserDefaults.standard.string(forKey: "video.selectedProjectTitle")
        do {
            store = try VideoCaptureStore(database: AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL()))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var canRecord: Bool {
        SignInService.shared.session != nil
            && selectedProjectId != nil
            && selectedBridgeSourceId == nil
            && canon.selectedCameraId == nil
            && camera.isReady
            && !camera.isRecording
    }

    var connectionLabel: String {
        if canon.selectedCameraId != nil {
            switch canon.phase {
            case .idle: return "Canon frakoblet"
            case .connecting: return "Kobler til Canon"
            case .waitingForFrame: return "Venter på Canon live view"
            case .ready: return "Canon live view klar"
            case .failed(let message): return message
            }
        }
        if selectedBridgeSourceId != nil {
            return selectedBridgeSource == nil ? "Bridge-kilden forsvant" : "Bridge monitor klar"
        }
        return switch camera.phase {
        case .idle: "Ikke startet"
        case .requestingPermission: "Venter på tilgang"
        case .configuring: "Kobler til"
        case .ready: "Monitor klar"
        case .recording: "Opptak pågår"
        case .failed(let message): message
        }
    }

    var connectionIcon: String {
        if canon.selectedCameraId != nil {
            return canon.isReady ? "camera.aperture" : "circle.dotted"
        }
        if selectedBridgeSourceId != nil {
            return selectedBridgeSource == nil ? "exclamationmark.triangle.fill" : "network"
        }
        return switch camera.phase {
        case .ready, .recording: "circle.fill"
        case .failed: "exclamationmark.triangle.fill"
        default: "circle.dotted"
        }
    }

    var activeFormatLabel: String {
        if canon.selectedCameraId != nil { return "CANON CCAPI" }
        if let selectedBridgeSource {
            return selectedBridgeSource.role == .multiview ? "BRIDGE MULTIVIEW" : "BRIDGE CAMERA"
        }
        return camera.sources.first(where: { $0.id == camera.selectedSourceId })?.isExternal == true
            ? "UVC" : "iPad"
    }

    var selectedBridgeSource: CreatorHubBridgeDiscovery.Source? {
        bridgeDiscovery.sources.first { $0.id == selectedBridgeSourceId }
    }

    var monitorReady: Bool {
        if canon.selectedCameraId != nil { return canon.isReady }
        return selectedBridgeSourceId == nil ? camera.isReady : selectedBridgeSource != nil
    }

    var recordingDurationLabel: String {
        guard let recordingStartedAt else { return "00:00" }
        let seconds = max(0, Int(Date().timeIntervalSince(recordingStartedAt)))
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }

    var pendingUploadLabel: String {
        let count = assets.filter { ![.ready].contains($0.captureState) }.count
        if assets.isEmpty { return "Ingen opptak" }
        return count == 0 ? "Alt er sikret" : "\(count) venter"
    }

    var selectedAsset: VideoCaptureAsset? {
        assets.first { $0.id == selectedAssetId }
    }

    func activate() async {
        canon.startDiscovery()
        bridgeDiscovery.start()
        await reload()
        await camera.start()
        await resumePendingUploads()
    }

    func deactivate() async {
        bridgePlayer?.pause()
        bridgePlayer = nil
        selectedBridgeSourceId = nil
        bridgeDiscovery.stop()
        await canon.stop()
        if !camera.isRecording { await camera.stop() }
    }

    func selectProject(_ project: BackendProjectSummary) {
        selectedProjectId = project.id
        selectedProjectTitle = project.title
        UserDefaults.standard.set(project.id, forKey: "video.selectedProjectId")
        UserDefaults.standard.set(project.title, forKey: "video.selectedProjectTitle")
        Task {
            await updateNextTakeNumber()
            await reload()
        }
    }

    func selectSource(_ id: String) async {
        guard !camera.isRecording else { return }
        await canon.stop()
        canon.startDiscovery()
        bridgePlayer?.pause()
        bridgePlayer = nil
        selectedBridgeSourceId = nil
        if camera.selectedSourceId == id {
            await camera.start()
        } else {
            await camera.selectSource(id: id)
        }
    }

    func isLocalSourceSelected(_ id: String) -> Bool {
        selectedBridgeSourceId == nil && camera.selectedSourceId == id
    }

    func selectBridgeSource(_ source: CreatorHubBridgeDiscovery.Source) async {
        guard !camera.isRecording else { return }
        await canon.stop()
        canon.startDiscovery()
        await camera.stop()
        bridgePlayer?.pause()
        selectedBridgeSourceId = source.id
        let player = AVPlayer(url: source.playbackURL)
        player.automaticallyWaitsToMinimizeStalling = true
        bridgePlayer = player
        player.play()
    }

    func selectCanonCamera(_ source: CameraDiscovery.Found) async {
        guard !camera.isRecording else { return }
        bridgePlayer?.pause()
        bridgePlayer = nil
        selectedBridgeSourceId = nil
        await camera.stop()
        await canon.select(source)
    }

    func selectAsset(_ id: String) {
        selectedAssetId = id
        promotionMessage = nil
    }

    func promoteSelectedTake() async {
        guard !isPromoting,
              let selectedAsset,
              selectedAsset.captureState == .ready,
              let projectId = selectedProjectId,
              let session = SignInService.shared.session
        else { return }
        isPromoting = true
        promotionMessage = nil
        defer { isPromoting = false }
        do {
            let backend = BackendClient(
                baseURL: session.backendBaseURL,
                authHeaders: SignInService.shared.authHeaders
            )
            let response = try await backend.promoteVideoCaptureAsset(
                projectId: projectId,
                assetId: selectedAsset.id
            )
            promotionMessage = response.created
                ? "\(response.version.versionLabel ?? "Versjonen") er klar i Video Room."
                : "Denne taken finnes allerede i Video Room."
        } catch {
            errorMessage = "Kunne ikke sende taken til Video Room: \(error.localizedDescription)"
        }
    }

    func toggleRecording() async {
        if camera.isRecording {
            camera.stopRecording()
            return
        }
        guard selectedProjectId != nil else {
            errorMessage = "Velg et CreatorHub-prosjekt før du starter opptak."
            return
        }
        recordingStartedAt = Date()
        do {
            let recording = try await camera.record()
            recordingStartedAt = nil
            try await register(recording)
        } catch {
            recordingStartedAt = nil
            errorMessage = error.localizedDescription
        }
    }

    private func register(_ recording: VideoCameraController.Recording) async throws {
        guard let session = SignInService.shared.session,
              let projectId = selectedProjectId,
              let store
        else { throw RegistrationFailure.missingProjectOrSession }
        let values = try recording.fileURL.resourceValues(forKeys: [.fileSizeKey])
        guard let rawSize = values.fileSize, rawSize > 0 else { throw RegistrationFailure.emptyFile }
        let takeNumber = try await store.nextTakeNumber(
            ownerUserId: session.userId,
            projectId: projectId,
            slate: slate.nilIfBlank
        )
        let now = Date()
        let asset = VideoCaptureAsset(
            id: UUID().uuidString.lowercased(),
            ownerUserId: session.userId,
            projectId: projectId,
            localPath: recording.fileURL.path,
            fileName: recording.fileURL.lastPathComponent,
            contentType: "video/quicktime",
            sizeBytes: Int64(rawSize),
            checksumSha256: nil,
            sourceType: recording.sourceType,
            cameraName: recording.cameraName,
            durationMs: recording.durationMs,
            frameRate: recording.frameRate,
            width: recording.width,
            height: recording.height,
            recordedAt: recording.recordedAt,
            captureState: .local,
            streamState: "pending",
            uploadObjectId: nil,
            streamUid: nil,
            lastError: nil,
            sceneId: sceneId.nilIfBlank,
            shotId: shotId.nilIfBlank,
            slate: slate.nilIfBlank,
            takeNumber: takeNumber,
            takeStatus: "unrated",
            circled: false,
            createdAt: now,
            updatedAt: now
        )
        try await store.save(asset)
        await reload()
        await upload(asset)
        await updateNextTakeNumber()
    }

    private func resumePendingUploads() async {
        guard let session = SignInService.shared.session, let store else { return }
        do {
            for asset in try await store.pending(ownerUserId: session.userId)
            where FileManager.default.fileExists(atPath: asset.localPath) {
                await upload(asset)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func upload(_ asset: VideoCaptureAsset) async {
        guard !activeUploads.contains(asset.id),
              let session = SignInService.shared.session,
              let store
        else { return }
        activeUploads.insert(asset.id)
        defer { activeUploads.remove(asset.id) }
        let backend = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: SignInService.shared.authHeaders
        )
        do {
            try await VideoCaptureUploader(backend: backend, store: store).upload(asset)
        } catch {
            try? await store.updateState(
                id: asset.id,
                ownerUserId: asset.ownerUserId,
                state: .failed,
                error: error.localizedDescription
            )
            errorMessage = "Opptaket ligger trygt på iPaden, men opplastingen stoppet: \(error.localizedDescription)"
        }
        await reload()
    }

    private func reload() async {
        guard let session = SignInService.shared.session, let store else { return }
        do {
            assets = try await store.list(ownerUserId: session.userId, projectId: selectedProjectId)
            if selectedAssetId == nil || !assets.contains(where: { $0.id == selectedAssetId }) {
                selectedAssetId = assets.first?.id
            }
            await updateNextTakeNumber()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func updateNextTakeNumber() async {
        guard let session = SignInService.shared.session,
              let projectId = selectedProjectId,
              let store
        else { nextTakeNumber = 1; return }
        nextTakeNumber = (try? await store.nextTakeNumber(
            ownerUserId: session.userId,
            projectId: projectId,
            slate: slate.nilIfBlank
        )) ?? 1
    }

    enum RegistrationFailure: LocalizedError {
        case missingProjectOrSession
        case emptyFile

        var errorDescription: String? {
            switch self {
            case .missingProjectOrSession: "Velg prosjekt og logg inn før opptak."
            case .emptyFile: "Kameraet opprettet en tom opptaksfil."
            }
        }
    }
}

private extension String {
    var nilIfBlank: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
