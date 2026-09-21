import AVFoundation
import AVKit
import Foundation
import ImageIO
import Observation
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

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
    @State private var playbackRequest: VideoPlaybackRequest?
    @AppStorage("capture.lastCameraURL") private var canonAddress = ""
    @State private var referenceImageItem: PhotosPickerItem?
    @State private var referenceImage: UIImage?
    @AppStorage("video.monitor.orientation") private var monitorOrientationRaw = VideoMonitorOrientation.automatic.rawValue
    @AppStorage("video.monitor.guide") private var monitorGuideRaw = VideoFrameGuide.off.rawValue
    @AppStorage("video.monitor.vectorscope") private var showsVectorscope = false
    @AppStorage("video.monitor.overlayOpacity") private var referenceOpacity = 0.5
    @AppStorage("video.monitor.autoSnapshotSeconds") private var autoSnapshotSeconds = 0

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
        .overlay(alignment: .topTrailing) {
            if let confirmation = model.transferConfirmation {
                VideoTransferConfirmationBanner(confirmation: confirmation)
                    .padding(.top, 68)
                    .padding(.trailing, 16)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .allowsHitTesting(false)
            }
        }
        .animation(.easeOut(duration: 0.24), value: model.transferConfirmation?.id)
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
            .presentationDetents(panel == .take ? [.large] : [.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .fullScreenCover(item: $playbackRequest) { request in
            VideoTakePlaybackView(request: request)
        }
        .task { await model.activate() }
        .task(id: autoSnapshotSeconds) { await runAutomaticSnapshots() }
        .onChange(of: referenceImageItem) { _, item in
            Task { await loadReferenceImage(item) }
        }
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
            .layoutPriority(1)
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
                        .frame(
                            maxWidth: layout.mode == .wide ? 200 : 120,
                            alignment: .leading
                        )
                    Image(systemName: "chevron.down").font(.caption2)
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 13).padding(.vertical, 9)
                .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(CHTheme.border))
            }
            .buttonStyle(.plain)
            .layoutPriority(1)
            .accessibilityIdentifier("video-project-picker")

            storageMenu(layout: layout)

            if !layout.showsTakeInspector {
                Button {
                    auxiliaryPanel = .take
                } label: {
                    Label("Take", systemImage: "slider.horizontal.3")
                }
                .buttonStyle(.bordered)
                .fixedSize()
                .layoutPriority(3)
                .accessibilityIdentifier("video-take-panel")
            }

            if layout.mode == .wide {
                Label(model.connectionLabel, systemImage: model.connectionIcon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(model.monitorReady ? CHTheme.success : CHTheme.textSecondary)
                    .lineLimit(1)
                    .frame(maxWidth: 180)
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(CHTheme.surface, in: Capsule())
            } else {
                Image(systemName: model.connectionIcon)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(model.monitorReady ? CHTheme.success : CHTheme.textSecondary)
                    .frame(width: 34, height: 34)
                    .background(CHTheme.surface, in: Circle())
                    .accessibilityLabel(model.connectionLabel)
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 12)
        .background(CHTheme.bg)
    }

    private func storageMenu(layout: VideoWorkspaceLayout) -> some View {
        Menu {
            Section("Lagring for nye opptak") {
                Picker("Lagringssted", selection: $model.captureStoragePolicy) {
                    ForEach(VideoCaptureAsset.StoragePolicy.allCases, id: \.self) { policy in
                        Text(policy.displayName).tag(policy)
                    }
                }
            }
            Section {
                Text(model.storageUsageDetail)
                Text(model.captureStoragePolicy.detail)
            }
        } label: {
            if layout.mode == .compact {
                Image(systemName: "externaldrive.fill")
                    .frame(width: 34, height: 34)
                    .background(CHTheme.surface, in: Circle())
            } else {
                Label(model.localStorageUsedLabel, systemImage: "externaldrive.fill")
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(CHTheme.surface, in: Capsule())
            }
        }
        .foregroundStyle(CHTheme.textSecondary)
        .accessibilityLabel("Lagring")
        .accessibilityValue(model.storageUsageDetail)
        .accessibilityIdentifier("video-storage-menu")
    }

    private var sourceRail: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("VIDEOKILDER")
                    .font(.caption2.weight(.bold))
                    .tracking(1.1)
                    .foregroundStyle(CHTheme.textMuted)
                Spacer()
                Button { model.refreshVideoSources() } label: {
                    if model.canon.isDiscovering {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(CHTheme.textSecondary)
                .disabled(model.isRecording)
                .accessibilityLabel("Oppdater videokilder")
                .accessibilityIdentifier("video-refresh-sources")
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
                        .disabled(model.isRecording)
                    }

                    HStack {
                        Rectangle().fill(CHTheme.borderSoft).frame(height: 1)
                        Text("CANON CCAPI · \(model.canon.cameras.count) FUNNET · \(model.canon.selectedCameraId == nil ? 0 : 1) TILKOBLET")
                            .font(.caption2.weight(.bold)).tracking(0.7)
                        Rectangle().fill(CHTheme.borderSoft).frame(height: 1)
                    }
                    .foregroundStyle(CHTheme.textMuted)
                    .padding(.vertical, 4)

                    canonDiscoveryStatus

                    ForEach(model.canon.cameras) { camera in
                        Button {
                            canonAddress = camera.baseURL.absoluteString
                            Task { await model.selectCanonCamera(camera) }
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "camera.aperture")
                                    .frame(width: 22)
                                    .foregroundStyle(model.canon.selectedCameraId == camera.id ? CHTheme.accent : CHTheme.textSecondary)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(camera.displayName).lineLimit(2)
                                        .font(.caption.weight(.semibold))
                                    Text(
                                        camera.firmware.map { "Direkte CCAPI · FW \($0)" }
                                            ?? "Direkte CCAPI · lokal Wi-Fi"
                                    )
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
                        .disabled(model.isRecording)
                        .accessibilityIdentifier("canon-camera-\(camera.id)")
                    }

                    VStack(alignment: .leading, spacing: 7) {
                        Text("Direkte tilkobling")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(CHTheme.textPrimary)
                        TextField("http://kamera:port", text: $canonAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .font(.caption.monospaced())
                            .padding(.horizontal, 9)
                            .frame(height: 36)
                            .background(CHTheme.bgDeep, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(CHTheme.borderSoft))
                            .accessibilityIdentifier("canon-direct-address")
                        Button {
                            guard let normalized = CCAPICameraAddress.normalize(canonAddress) else { return }
                            canonAddress = normalized.absoluteString
                            Task { await model.connectCanon(address: normalized.absoluteString) }
                        } label: {
                            Label("Koble til", systemImage: "link")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(canonAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isRecording)
                        .accessibilityIdentifier("canon-direct-connect")
                        Text("Bruk adressen som vises på kameraets CCAPI-skjerm.")
                            .font(.caption2)
                            .foregroundStyle(CHTheme.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(10)
                    .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(CHTheme.borderSoft))

                    if model.canon.selectedCameraId != nil {
                        canonControls
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
                        .disabled(model.isRecording)
                    }
                }
            }
            Spacer(minLength: 0)
            VStack(alignment: .leading, spacing: 5) {
                Label("UVC gir monitor + opptak", systemImage: "checkmark.circle")
                Label("Canon live view, REC og klippimport via CCAPI", systemImage: "camera.aperture")
                Label("Bridge-preview går kun på lokalnettet", systemImage: "network")
            }
            .font(.caption2)
            .foregroundStyle(CHTheme.textMuted)
        }
        .padding(14)
        .background(CHTheme.bg)
        .accessibilityIdentifier("video-source-rail")
    }

    @ViewBuilder
    private var canonDiscoveryStatus: some View {
        if model.canon.localNetworkPermissionDenied {
            VStack(alignment: .leading, spacing: 7) {
                Label("Lokalnett er blokkert", systemImage: "wifi.exclamationmark")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(CHTheme.warning)
                Button("Åpne Innstillinger") {
                    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                    UIApplication.shared.open(url)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("canon-open-settings")
            }
        } else if model.canon.isDiscovering {
            Label("Søker på lokalnettet…", systemImage: "wifi")
                .font(.caption2)
                .foregroundStyle(CHTheme.textSecondary)
                .accessibilityIdentifier("canon-discovery-searching")
        } else if model.canon.cameras.isEmpty && model.canon.selectedCameraId == nil {
            Label("Ingen Canon-kilde funnet. Kontroller CCAPI-modus, søk på nytt eller bruk adressen under.", systemImage: "camera.badge.ellipsis")
                .font(.caption2)
                .foregroundStyle(CHTheme.textMuted)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("canon-discovery-empty")
        }
    }

    private var monitor: some View {
        VStack(spacing: 0) {
            ZStack {
                Color.black
                if let canonFrame = model.canon.frame, model.canon.selectedCameraId != nil {
                    VideoMonitorSurface(
                        image: canonFrame,
                        frameID: model.canon.frameSequence,
                        orientation: monitorOrientation,
                        guide: monitorGuide,
                        referenceImage: referenceImage,
                        referenceOpacity: referenceOpacity,
                        showsVectorscope: showsVectorscope,
                        onFocusTap: model.canon.capabilities.canSetAFFrame
                            ? { point in Task { await model.setCanonFocusPoint(point) } }
                            : nil
                    )
                } else if let player = model.bridgePlayer {
                    VideoPlayer(player: player)
                        .accessibilityLabel("CreatorHub Bridge live monitor")
                } else {
                    VideoPreviewView(controller: model.camera)
                        .accessibilityLabel("Live videomonitor")
                }
                if !model.monitorReady && !model.isRecording {
                    VStack(spacing: 12) {
                        ProgressView().controlSize(.large)
                        Text(model.connectionLabel)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(CHTheme.textSecondary)
                    }
                }
                VStack {
                    HStack {
                        if model.isRecording {
                            Label("REC", systemImage: "circle.fill")
                                .font(.caption.weight(.black))
                                .foregroundStyle(CHTheme.danger)
                                .padding(.horizontal, 10).padding(.vertical, 7)
                                .background(.black.opacity(0.72), in: Capsule())
                        }
                        Spacer()
                        if model.canon.selectedCameraId != nil,
                           let battery = model.canon.batteryStatus {
                            Label(battery.label, systemImage: battery.systemImage)
                                .font(.caption.monospacedDigit().weight(.bold))
                                .foregroundStyle(battery.isLow ? CHTheme.danger : .white.opacity(0.9))
                                .padding(.horizontal, 10).padding(.vertical, 7)
                                .background(.black.opacity(0.65), in: Capsule())
                                .accessibilityLabel("Kamerabatteri \(battery.label)")
                                .accessibilityIdentifier("canon-battery-status")
                        }
                        Text(model.activeFormatLabel)
                            .font(.caption.monospaced().weight(.semibold))
                            .foregroundStyle(.white.opacity(0.82))
                            .padding(.horizontal, 10).padding(.vertical, 7)
                            .background(.black.opacity(0.65), in: Capsule())
                    }
                    Spacer()
                }
                .padding(14)

                VStack {
                    Spacer()
                    HStack(spacing: 8) {
                        monitorOrientationMenu
                        monitorGuideMenu
                        Button {
                            showsVectorscope.toggle()
                        } label: {
                            Image(systemName: "scope")
                        }
                        .monitorToolStyle(active: showsVectorscope)
                        .accessibilityLabel(showsVectorscope ? "Skjul vectorscope" : "Vis vectorscope")

                        PhotosPicker(selection: $referenceImageItem, matching: .images) {
                            Image(systemName: "square.on.square")
                        }
                        .monitorToolStyle(active: referenceImage != nil)
                        .accessibilityLabel("Velg bildeoverlay")

                        if referenceImage != nil {
                            Menu {
                                Picker("Overlay-styrke", selection: $referenceOpacity) {
                                    Text("25 %").tag(0.25)
                                    Text("50 %").tag(0.5)
                                    Text("75 %").tag(0.75)
                                }
                                Button("Fjern overlay", role: .destructive) {
                                    referenceImage = nil
                                    referenceImageItem = nil
                                }
                            } label: {
                                Image(systemName: "circle.lefthalf.filled")
                            }
                            .monitorToolStyle(active: true)
                            .accessibilityLabel("Innstillinger for bildeoverlay")
                        }

                        Menu {
                            Button("Av") { autoSnapshotSeconds = 0 }
                            Button("Hvert 5. sekund") { autoSnapshotSeconds = 5 }
                            Button("Hvert 15. sekund") { autoSnapshotSeconds = 15 }
                            Button("Hvert 30. sekund") { autoSnapshotSeconds = 30 }
                        } label: {
                            Image(systemName: autoSnapshotSeconds > 0 ? "camera.badge.clock.fill" : "camera.badge.clock")
                        }
                        .monitorToolStyle(active: autoSnapshotSeconds > 0)
                        .accessibilityLabel("Automatisk lagring av snapshots")

                        Button {
                            model.saveMonitorSnapshot()
                        } label: {
                            Image(systemName: "camera.fill")
                        }
                        .monitorToolStyle(active: false)
                        .disabled(model.canon.frame == nil)
                        .accessibilityLabel("Lagre snapshot nå")
                        Spacer()
                        if let message = model.monitorSnapshotMessage {
                            Text(message)
                                .font(.caption2)
                                .foregroundStyle(.white.opacity(0.82))
                                .lineLimit(1)
                        }
                    }
                    .padding(10)
                    .background(.black.opacity(0.62), in: Capsule())
                    .padding(14)
                }
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
            if model.isRecording {
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
                    if model.isRecording {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(CHTheme.danger)
                            .frame(width: 27, height: 27)
                    } else {
                        Circle().fill(CHTheme.danger).frame(width: 48, height: 48)
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(!model.canRecord && !model.isRecording)
            .opacity(model.canRecord || model.isRecording ? 1 : 0.42)
            .accessibilityLabel(model.isRecording ? "Stopp opptak" : "Start opptak")
            .accessibilityIdentifier("video-record-button")
            Spacer()
            Label(model.pendingUploadLabel, systemImage: "icloud.and.arrow.up")
                .font(.caption)
                .foregroundStyle(CHTheme.textMuted)
                .frame(minWidth: 110, alignment: .trailing)
        }
        .padding(.horizontal, 24).padding(.bottom, 16)
    }

    private var canonControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("KAMERAKONTROLL")
                    .font(.caption2.weight(.bold))
                    .tracking(1)
                    .foregroundStyle(CHTheme.textMuted)
                    .accessibilityIdentifier("canon-controls-title")
                Spacer()
                Button {
                    Task { await model.canon.refreshShootingSettings() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.plain)
                .disabled(model.isRecording)
                .accessibilityLabel("Oppdater Canon-innstillinger")
            }

            if model.canon.capabilities.canRecordMovie {
                Label("Fjernstyrt REC og automatisk klippimport", systemImage: "record.circle")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.success)
            } else {
                Label("REC annonseres ikke i denne kameramodusen", systemImage: "exclamationmark.triangle")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.warning)
            }

            if let battery = model.canon.batteryStatus {
                Label(
                    battery.isLow ? "Lavt kamerabatteri · \(battery.label)" : "Kamerabatteri · \(battery.label)",
                    systemImage: battery.systemImage
                )
                .font(.caption2.weight(battery.isLow ? .bold : .regular))
                .foregroundStyle(battery.isLow ? CHTheme.danger : CHTheme.textSecondary)
                .accessibilityIdentifier("canon-battery-detail")
            }

            Toggle(
                "Live View",
                isOn: Binding(
                    get: { model.canon.isLiveViewEnabled },
                    set: { enabled in Task { await model.canon.setLiveViewEnabled(enabled) } }
                )
            )
            .font(.caption.weight(.semibold))
            .tint(CHTheme.accent)
            .disabled(model.isRecording || model.canon.isImporting)
            .accessibilityHint("Slå av monitorstrømmen for mer stabil fjernstyring")

            if model.canon.capabilities.canDriveFocus || model.canon.capabilities.canAutoFocus {
                VStack(alignment: .leading, spacing: 7) {
                    Text("FOKUS")
                        .font(.caption2.weight(.bold))
                        .tracking(1)
                        .foregroundStyle(CHTheme.textMuted)
                    if model.canon.capabilities.canDriveFocus {
                        HStack(spacing: 5) {
                            ForEach(CCAPIFocusDrive.allCases, id: \.self) { drive in
                                Button {
                                    Task { await model.driveCanonFocus(drive) }
                                } label: {
                                    Image(systemName: drive.rawValue.hasPrefix("near") ? "chevron.left" : "chevron.right")
                                        .font(.caption2.weight(.bold))
                                        .frame(maxWidth: .infinity, minHeight: 30)
                                }
                                .buttonStyle(.bordered)
                                .disabled(model.isRecording)
                                .accessibilityLabel(drive.displayName)
                            }
                        }
                    }
                    if model.canon.capabilities.canAutoFocus {
                        Button {
                            Task { await model.pulseCanonAutoFocus() }
                        } label: {
                            Label("Autofokus", systemImage: "viewfinder")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(model.isRecording || !model.canon.isLiveViewEnabled)
                    }
                }
            }

            ForEach(CCAPIShootingSettingKey.allCases, id: \.self) { key in
                if let setting = model.canon.shootingSettings[key] {
                    if model.canon.capabilities.writableSettings.contains(key) {
                        Menu {
                            ForEach(setting.ability, id: \.self) { value in
                                Button {
                                    Task { await model.updateCanonSetting(key, value: value) }
                                } label: {
                                    if value == setting.value {
                                        Label(value, systemImage: "checkmark")
                                    } else {
                                        Text(value)
                                    }
                                }
                            }
                        } label: {
                            canonSettingLabel(key: key, setting: setting)
                        }
                        .disabled(model.isRecording || model.canon.updatingSetting != nil)
                        .accessibilityIdentifier("canon-setting-\(key.rawValue)")
                    } else {
                        HStack {
                            Text(key.displayName)
                            Spacer()
                            Text(setting.value).font(.caption.monospaced())
                            Image(systemName: "lock.fill").font(.caption2)
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(CHTheme.textSecondary)
                        .padding(.horizontal, 10)
                        .frame(height: 38)
                        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(CHTheme.borderSoft))
                        .accessibilityLabel("\(key.displayName), \(setting.value), skrivebeskyttet")
                    }
                }
            }

            if let message = model.canon.lastImportMessage {
                Label(message, systemImage: model.canon.isImporting ? "arrow.down.circle" : "checkmark.circle")
                    .font(.caption2)
                    .foregroundStyle(model.canon.isImporting ? CHTheme.warning : CHTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(10)
        .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(CHTheme.borderSoft))
    }

    private func canonSettingLabel(
        key: CCAPIShootingSettingKey,
        setting: CCAPIChoiceSetting
    ) -> some View {
        HStack {
            Text(key.displayName)
            Spacer()
            if model.canon.updatingSetting == key {
                ProgressView().controlSize(.small)
            } else {
                Text(setting.value).font(.caption.monospaced())
                Image(systemName: "chevron.up.chevron.down").font(.caption2)
            }
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(CHTheme.textPrimary)
        .padding(.horizontal, 10)
        .frame(height: 38)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(CHTheme.borderSoft))
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
                            Task {
                                playbackRequest = await model.playbackRequest(for: selected)
                            }
                        } label: {
                            Label(
                                FileManager.default.fileExists(atPath: selected.localPath)
                                    ? "Spill av take"
                                    : "Spill av fra CreatorHub",
                                systemImage: "play.fill"
                            )
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(
                            !FileManager.default.fileExists(atPath: selected.localPath)
                                && selected.captureState != .ready
                        )

                        Label(
                            FileManager.default.fileExists(atPath: selected.localPath)
                                ? "Original på iPad" + (selected.captureState == .ready ? " og CreatorHub" : "")
                                : "Original i CreatorHub",
                            systemImage: FileManager.default.fileExists(atPath: selected.localPath)
                                ? "internaldrive.fill"
                                : "icloud.fill"
                        )
                        .font(.caption)
                        .foregroundStyle(CHTheme.textMuted)

                        Text("VURDERING")
                            .font(.caption2.weight(.bold)).tracking(1.1)
                            .foregroundStyle(CHTheme.textMuted)
                            .padding(.top, 4)
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            ForEach(VideoCaptureAsset.TakeStatus.allCases, id: \.self) { status in
                                takeStatusButton(status)
                            }
                        }
                        Button {
                            model.takeCircled.toggle()
                        } label: {
                            Label(
                                model.takeCircled ? "Valgt take" : "Marker som valgt take",
                                systemImage: model.takeCircled ? "circle.inset.filled" : "circle"
                            )
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.bordered)
                        .tint(model.takeCircled ? CHTheme.accent : CHTheme.textSecondary)
                        .accessibilityIdentifier("video-take-circled")

                        takeNoteField(
                            "Kontinuitet",
                            text: $model.continuityNotes,
                            prompt: "Props, garderobe, posisjon…"
                        )
                        takeNoteField(
                            "Performance",
                            text: $model.performanceNotes,
                            prompt: "Timing, energi, beste øyeblikk…"
                        )
                        takeNoteField(
                            "Teknisk",
                            text: $model.technicalNotes,
                            prompt: "Fokus, lyd, eksponering…"
                        )
                        Button {
                            Task { await model.saveSelectedTake() }
                        } label: {
                            Label(
                                model.isSavingTake ? "Lagrer…" : "Lagre take",
                                systemImage: "checkmark.circle"
                            )
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(CHTheme.accent)
                        .disabled(model.isSavingTake)
                        .accessibilityIdentifier("video-save-take")
                        if let takeSaveMessage = model.takeSaveMessage {
                            Label(
                                takeSaveMessage,
                                systemImage: selected.takeMetadataDirty
                                    ? "icloud.slash"
                                    : "checkmark.icloud.fill"
                            )
                            .font(.caption)
                            .foregroundStyle(selected.takeMetadataDirty ? CHTheme.warning : CHTheme.success)
                        }

                        if selected.captureState == .failed {
                            Button {
                                Task { await model.retrySelectedUpload() }
                            } label: {
                                Label(
                                    model.isUploading(selected.id) ? "Prøver igjen…" : "Prøv opplasting igjen",
                                    systemImage: "arrow.clockwise.icloud"
                                )
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(CHTheme.warning)
                            .disabled(model.isUploading(selected.id))
                            .accessibilityIdentifier("video-retry-upload")
                            if let lastError = selected.lastError, !lastError.isEmpty {
                                Text(lastError)
                                    .font(.caption2)
                                    .foregroundStyle(CHTheme.danger)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }

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

    private func takeStatusButton(_ status: VideoCaptureAsset.TakeStatus) -> some View {
        Button {
            model.takeStatus = status
        } label: {
            Label(status.displayName, systemImage: status.systemImage)
                .font(.caption.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
        }
        .buttonStyle(.plain)
        .foregroundStyle(model.takeStatus == status ? takeStatusColor(status) : CHTheme.textSecondary)
        .background(
            model.takeStatus == status ? takeStatusColor(status).opacity(0.16) : CHTheme.surface,
            in: RoundedRectangle(cornerRadius: 8)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(model.takeStatus == status ? takeStatusColor(status) : CHTheme.borderSoft)
        )
        .accessibilityAddTraits(model.takeStatus == status ? .isSelected : [])
        .accessibilityIdentifier("video-take-status-\(status.rawValue)")
    }

    private func takeNoteField(_ label: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.caption).foregroundStyle(CHTheme.textMuted)
            ZStack(alignment: .topLeading) {
                if text.wrappedValue.isEmpty {
                    Text(prompt)
                        .font(.caption)
                        .foregroundStyle(CHTheme.textMuted)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .allowsHitTesting(false)
                }
                TextEditor(text: text)
                    .font(.caption)
                    .foregroundStyle(CHTheme.textPrimary)
                    .scrollContentBackground(.hidden)
                    .padding(5)
                    .frame(minHeight: 70)
            }
            .background(CHTheme.input, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(CHTheme.borderSoft))
        }
    }

    private var filmstrip: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 10) {
                if model.canon.isImporting || model.canon.pendingMovieImportCount > 0 {
                    VStack(alignment: .leading, spacing: 8) {
                        canonImportProgressCard
                        Text(model.canon.lastImportMessage ?? "Kameraklipp oppdaget")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(CHTheme.textSecondary)
                            .lineLimit(1)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(model.canon.lastImportMessage ?? "Kameraklipp lastes inn")
                    .accessibilityValue(canonImportAccessibilityValue)
                    .accessibilityIdentifier("canon-import-progress")
                }
                if model.assets.isEmpty && !model.canon.isImporting && model.canon.pendingMovieImportCount == 0 {
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
                                VideoTakeThumbnailView(asset: asset)
                                VStack {
                                    HStack {
                                        if asset.circled {
                                            Image(systemName: "circle.inset.filled")
                                                .foregroundStyle(CHTheme.accent)
                                        }
                                        Spacer()
                                        Image(systemName: asset.takeStatus.systemImage)
                                            .foregroundStyle(takeStatusColor(asset.takeStatus))
                                    }
                                    .font(.caption.weight(.bold))
                                    .padding(6)
                                    Spacer()
                                    HStack {
                                        Text("T\(asset.takeNumber)")
                                        Spacer()
                                        Image(systemName: stateIcon(asset))
                                    }
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(stateColor(asset))
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
                    .accessibilityIdentifier("video-take-\(asset.id)")
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
        }
        .background(CHTheme.bg)
    }

    private var canonImportProgressCard: some View {
        let progress = model.canon.importProgress
        return VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(progress?.percentCompleted.map { "\($0) %" } ?? "Venter")
                    .font(.caption.weight(.bold).monospacedDigit())
                Spacer()
                Text(formatDuration(progress?.elapsedSeconds ?? 0))
                    .font(.caption2.monospacedDigit())
            }
            if let fraction = progress?.fractionCompleted {
                ProgressView(value: fraction)
                    .tint(CHTheme.accent)
            } else {
                ProgressView()
                    .controlSize(.small)
                    .tint(CHTheme.accent)
            }
            Text(formatTransferBytes(progress))
                .font(.caption2.monospacedDigit())
                .lineLimit(1)
            if let remaining = progress?.estimatedRemainingSeconds {
                Text("ca. \(formatDuration(remaining)) igjen")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(CHTheme.textMuted)
            }
        }
        .foregroundStyle(CHTheme.textPrimary)
        .padding(9)
        .frame(width: 180, height: 76, alignment: .leading)
        .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(CHTheme.borderSoft))
    }

    private func formatTransferBytes(_ progress: CCAPIMediaTransferProgress?) -> String {
        guard let progress else { return "0 B · størrelse ventes" }
        let received = ByteCountFormatter.string(fromByteCount: progress.receivedBytes, countStyle: .file)
        guard let total = progress.totalBytes else { return "\(received) · total ukjent" }
        return "\(received) / \(ByteCountFormatter.string(fromByteCount: total, countStyle: .file))"
    }

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let value = max(0, Int(seconds.rounded()))
        if value >= 3_600 {
            return String(format: "%d:%02d:%02d", value / 3_600, (value % 3_600) / 60, value % 60)
        }
        return String(format: "%02d:%02d", value / 60, value % 60)
    }

    private var canonImportAccessibilityValue: String {
        guard let progress = model.canon.importProgress else {
            return "Venter på filstørrelse"
        }
        var parts = [
            progress.percentCompleted.map { "\($0) prosent" } ?? "Ukjent prosent",
            formatTransferBytes(progress),
            "\(formatDuration(progress.elapsedSeconds)) brukt",
        ]
        if let remaining = progress.estimatedRemainingSeconds {
            parts.append("omtrent \(formatDuration(remaining)) igjen")
        }
        return parts.joined(separator: ", ")
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })
    }

    private func stateIcon(_ asset: VideoCaptureAsset) -> String {
        if asset.storagePolicy == .localOnly, asset.captureState == .local {
            return "internaldrive.fill"
        }
        return switch asset.captureState {
        case .ready: "checkmark.circle.fill"
        case .failed: "exclamationmark.triangle.fill"
        case .local: "internaldrive"
        default: "arrow.up.circle.fill"
        }
    }

    private func stateColor(_ asset: VideoCaptureAsset) -> Color {
        if asset.storagePolicy == .localOnly, asset.captureState == .local {
            return CHTheme.success
        }
        return switch asset.captureState {
        case .ready: CHTheme.success
        case .failed: CHTheme.danger
        case .local: CHTheme.warning
        default: CHTheme.info
        }
    }

    private func takeStatusColor(_ status: VideoCaptureAsset.TakeStatus) -> Color {
        switch status {
        case .unrated: CHTheme.textSecondary
        case .hold: CHTheme.warning
        case .good: CHTheme.success
        case .noGood: CHTheme.danger
        }
    }

    private var monitorOrientation: VideoMonitorOrientation {
        VideoMonitorOrientation(rawValue: monitorOrientationRaw) ?? .automatic
    }

    private var monitorGuide: VideoFrameGuide {
        VideoFrameGuide(rawValue: monitorGuideRaw) ?? .off
    }

    private var monitorOrientationMenu: some View {
        Menu {
            Picker("Monitorretning", selection: $monitorOrientationRaw) {
                ForEach(VideoMonitorOrientation.allCases) { orientation in
                    Text(orientation.label).tag(orientation.rawValue)
                }
            }
        } label: {
            Image(systemName: monitorOrientation.swapsDimensions ? "rectangle.portrait.rotate" : "rectangle.landscape.rotate")
        }
        .monitorToolStyle(active: monitorOrientation != .automatic)
        .accessibilityLabel("Monitorretning: \(monitorOrientation.label)")
    }

    private var monitorGuideMenu: some View {
        Menu {
            Picker("Bildemarkør", selection: $monitorGuideRaw) {
                ForEach(VideoFrameGuide.allCases) { guide in
                    Text(guide.label).tag(guide.rawValue)
                }
            }
        } label: {
            Image(systemName: "viewfinder.rectangular")
        }
        .monitorToolStyle(active: monitorGuide != .off)
        .accessibilityLabel("Bildemarkør: \(monitorGuide.label)")
    }

    private func loadReferenceImage(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data)
            else { throw VideoMonitorInputError.invalidImage }
            referenceImage = image
        } catch {
            model.errorMessage = "Kunne ikke laste overlay-bildet: \(error.localizedDescription)"
        }
    }

    private func runAutomaticSnapshots() async {
        guard autoSnapshotSeconds > 0 else { return }
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(autoSnapshotSeconds))
            guard !Task.isCancelled else { return }
            model.saveMonitorSnapshot(automatic: true)
        }
    }

    private enum VideoMonitorInputError: LocalizedError {
        case invalidImage
        var errorDescription: String? { "Filen er ikke et gyldig bilde." }
    }
}

private struct MonitorToolModifier: ViewModifier {
    let active: Bool

    func body(content: Content) -> some View {
        content
            .font(.caption.weight(.semibold))
            .foregroundStyle(active ? CHTheme.accent : .white.opacity(0.88))
            .frame(width: 34, height: 34)
            .background(active ? CHTheme.accentFill : .white.opacity(0.1), in: Circle())
            .overlay(Circle().stroke(active ? CHTheme.accentBorder : .white.opacity(0.16)))
    }
}

private extension View {
    func monitorToolStyle(active: Bool) -> some View {
        modifier(MonitorToolModifier(active: active))
    }
}

private struct VideoTakeThumbnailView: View {
    let asset: VideoCaptureAsset
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "film.fill")
                    .font(.title2)
                    .foregroundStyle(CHTheme.textMuted)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .task(id: asset.localPath) {
            image = await VideoThumbnailRenderer.render(
                fileURL: URL(fileURLWithPath: asset.localPath)
            )
        }
    }
}

private enum VideoThumbnailRenderer {
    static func render(fileURL: URL) async -> UIImage? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        let data = await Task.detached(priority: .utility) { () -> Data? in
            let asset = AVURLAsset(url: fileURL)
            let generator = AVAssetImageGenerator(asset: asset)
            generator.appliesPreferredTrackTransform = true
            generator.maximumSize = CGSize(width: 480, height: 270)
            guard let image = try? generator.copyCGImage(at: .zero, actualTime: nil) else { return nil }
            let data = NSMutableData()
            guard let destination = CGImageDestinationCreateWithData(
                data,
                UTType.jpeg.identifier as CFString,
                1,
                nil
            ) else { return nil }
            CGImageDestinationAddImage(destination, image, [
                kCGImageDestinationLossyCompressionQuality: 0.78
            ] as CFDictionary)
            guard CGImageDestinationFinalize(destination) else { return nil }
            return data as Data
        }.value
        return data.flatMap(UIImage.init(data:))
    }
}

struct VideoPlaybackRequest: Identifiable {
    let id: String
    let takeNumber: Int
    let url: URL
}

enum VideoLocalOriginalRetention {
    enum Failure: LocalizedError, Equatable {
        case uploadNotVerified
        case unmanagedFile

        var errorDescription: String? {
            switch self {
            case .uploadNotVerified: "Originalen kan ikke frigjøres før CreatorHub har verifisert opplastingen."
            case .unmanagedFile: "CreatorHub vil ikke slette en fil utenfor appens opptaksmappe."
            }
        }
    }

    @discardableResult
    static func releaseVerifiedOriginal(
        for asset: VideoCaptureAsset,
        managedRoot: URL,
        fileManager: FileManager = .default
    ) throws -> Bool {
        guard asset.captureState == .ready else { throw Failure.uploadNotVerified }
        let root = managedRoot.standardizedFileURL.resolvingSymlinksInPath()
        let file = URL(fileURLWithPath: asset.localPath)
            .standardizedFileURL
            .resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.path + "/") else { throw Failure.unmanagedFile }
        guard fileManager.fileExists(atPath: file.path) else { return false }
        try fileManager.removeItem(at: file)
        return true
    }
}

private struct VideoTakePlaybackView: View {
    let request: VideoPlaybackRequest
    @Environment(\.dismiss) private var dismiss
    @State private var player: AVPlayer

    init(request: VideoPlaybackRequest) {
        self.request = request
        _player = State(initialValue: AVPlayer(url: request.url))
    }

    var body: some View {
        NavigationStack {
            VideoPlayer(player: player)
                .background(Color.black)
                .navigationTitle("Take \(request.takeNumber)")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Ferdig") { dismiss() }
                    }
                }
                .onAppear { player.play() }
                .onDisappear { player.pause() }
        }
        .chBranded()
    }
}

struct VideoTransferConfirmation: Equatable {
    enum Stage: Equatable {
        case storedLocally
        case storedLocallyOnly
        case securedInCreatorHub
        case uploadFailed
    }

    let id = UUID()
    let fileName: String
    let stage: Stage
    let storageSummary: String?
    let localCopyReleased: Bool
    let localReleaseFailed: Bool

    init(
        fileName: String,
        stage: Stage,
        storageSummary: String? = nil,
        localCopyReleased: Bool = false,
        localReleaseFailed: Bool = false
    ) {
        self.fileName = fileName
        self.stage = stage
        self.storageSummary = storageSummary
        self.localCopyReleased = localCopyReleased
        self.localReleaseFailed = localReleaseFailed
    }

    var title: String {
        switch stage {
        case .storedLocally, .storedLocallyOnly: "Lagret på iPaden"
        case .securedInCreatorHub: "Sikret i CreatorHub"
        case .uploadFailed: "Ikke lastet opp ennå"
        }
    }

    var detail: String {
        let status = switch stage {
        case .storedLocally:
            "\(fileName) er lagret trygt på iPaden · opplasting fortsetter i bakgrunnen"
        case .storedLocallyOnly:
            "\(fileName) beholdes kun lokalt etter ditt valg"
        case .securedInCreatorHub:
            if localReleaseFailed {
                "\(fileName) er lastet opp og verifisert · lokal original kunne ikke frigjøres"
            } else if localCopyReleased {
                "\(fileName) er lastet opp og verifisert · lokal original er frigitt"
            } else {
                "\(fileName) er lastet opp og verifisert"
            }
        case .uploadFailed:
            "\(fileName) ligger trygt på iPaden og prøves igjen senere"
        }
        return storageSummary.map { "\(status) · \($0)" } ?? status
    }

    var icon: String {
        switch stage {
        case .storedLocally, .storedLocallyOnly: "internaldrive.fill"
        case .securedInCreatorHub: "checkmark.icloud.fill"
        case .uploadFailed: "icloud.slash.fill"
        }
    }

    var tint: Color {
        switch stage {
        case .storedLocally: CHTheme.info
        case .storedLocallyOnly: CHTheme.success
        case .securedInCreatorHub: CHTheme.success
        case .uploadFailed: CHTheme.warning
        }
    }
}

private struct VideoTransferConfirmationBanner: View {
    let confirmation: VideoTransferConfirmation

    var body: some View {
        HStack(alignment: .top, spacing: 11) {
            Image(systemName: confirmation.icon)
                .font(.title3.weight(.semibold))
                .foregroundStyle(confirmation.tint)
            VStack(alignment: .leading, spacing: 3) {
                Text(confirmation.title)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(CHTheme.textPrimary)
                Text(confirmation.detail)
                    .font(.caption)
                    .foregroundStyle(CHTheme.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: 420, alignment: .leading)
        .background(CHTheme.surfaceElevated.opacity(0.98), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(confirmation.tint.opacity(0.42), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.35), radius: 14, y: 6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(confirmation.title)
        .accessibilityValue(confirmation.detail)
        .accessibilityAddTraits(.isStaticText)
        .accessibilityIdentifier("video-transfer-confirmation")
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
        let mode: Mode = if size.width >= 1_180 && size.height >= 760 {
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
    private static let storagePolicyDefaultsKey = "video.capture.storagePolicy"
    let camera = VideoCameraController()
    let canon = CCAPILiveViewController()
    let bridgeDiscovery = CreatorHubBridgeDiscovery()
    private var store: VideoCaptureStore?
    private var activeUploads: Set<String> = []
    private var canonMediaImportTask: Task<Void, Never>?
    private var transferConfirmationTask: Task<Void, Never>?

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
    var takeStatus: VideoCaptureAsset.TakeStatus = .unrated
    var takeCircled = false
    var continuityNotes = ""
    var performanceNotes = ""
    var technicalNotes = ""
    var isSavingTake = false
    var takeSaveMessage: String?
    var monitorSnapshotMessage: String?
    fileprivate var transferConfirmation: VideoTransferConfirmation?
    var captureStoragePolicy: VideoCaptureAsset.StoragePolicy {
        didSet {
            UserDefaults.standard.set(
                captureStoragePolicy.rawValue,
                forKey: Self.storagePolicyDefaultsKey
            )
        }
    }
    var localStorageUsedBytes: Int64 = 0
    var deviceStorageAvailableBytes: Int64?
    var selectedBridgeSourceId: String?
    var bridgePlayer: AVPlayer?
    private var takeDraftAssetId: String?

    init() {
        captureStoragePolicy = UserDefaults.standard.string(forKey: Self.storagePolicyDefaultsKey)
            .flatMap(VideoCaptureAsset.StoragePolicy.init(rawValue:))
            ?? .keepLocalAndCloud
        selectedProjectId = UserDefaults.standard.string(forKey: "video.selectedProjectId")
        selectedProjectTitle = UserDefaults.standard.string(forKey: "video.selectedProjectTitle")
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--canon-hardware-smoke") {
            SignInService.shared.setInMemoryDemoSession(
                userId: "ccapi-hardware-smoke",
                backendBaseURL: URL(string: "https://capture-hardware-smoke.invalid")!,
                displayName: "Canon Hardware Smoke"
            )
            selectedProjectId = "ccapi-hardware-smoke"
            selectedProjectTitle = "Canon Hardware Smoke"
        }
        #endif
        do {
            store = try VideoCaptureStore(database: AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL()))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var canRecord: Bool {
        guard SignInService.shared.session != nil,
              selectedProjectId != nil,
              selectedBridgeSourceId == nil,
              !isRecording
        else { return false }
        if canon.selectedCameraId != nil { return canon.canRecordMovie }
        return camera.isReady
    }

    var isRecording: Bool {
        camera.isRecording || canon.isRecording
    }

    var connectionLabel: String {
        if canon.selectedCameraId != nil {
            if canon.isImporting { return "Henter Canon-klipp" }
            if canon.isRecording { return "Canon-opptak pågår" }
            switch canon.phase {
            case .idle: return "Canon frakoblet"
            case .connecting: return "Kobler til Canon"
            case .reconnecting(let attempt): return "Kobler til Canon igjen · forsøk \(attempt)"
            case .waitingForFrame: return "Venter på Canon live view"
            case .controlOnly: return "Canon-kontroll · Live View av"
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
        let count = assets.filter {
            $0.storagePolicy != .localOnly && $0.captureState != .ready
        }.count
        if assets.isEmpty { return "Ingen opptak" }
        if assets.allSatisfy({ $0.storagePolicy == .localOnly }) { return "Kun lokalt" }
        return count == 0 ? "Alt er sikret" : "\(count) venter"
    }

    var localStorageUsedLabel: String {
        "\(Self.formatBytes(localStorageUsedBytes)) lokalt"
    }

    var storageUsageDetail: String {
        let used = "Videoopptak bruker \(Self.formatBytes(localStorageUsedBytes)) på iPaden"
        guard let deviceStorageAvailableBytes else { return used }
        return "\(used) · \(Self.formatBytes(deviceStorageAvailableBytes)) ledig"
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
        await syncPendingTakeMetadata()
        await reload()
        startCanonMediaImportLoop()
    }

    func deactivate() async {
        canonMediaImportTask?.cancel()
        canonMediaImportTask = nil
        transferConfirmationTask?.cancel()
        transferConfirmationTask = nil
        bridgePlayer?.pause()
        bridgePlayer = nil
        selectedBridgeSourceId = nil
        bridgeDiscovery.stop()
        if canon.isRecording {
            do {
                let recording = try await canon.stopMovieRecording()
                try await register(recording)
            } catch {
                errorMessage = "Canon-opptaket ble stoppet, men klippet kunne ikke sikres: \(error.localizedDescription)"
            }
        }
        await canon.stop()
        if !camera.isRecording { await camera.stop() }
    }

    private func startCanonMediaImportLoop() {
        canonMediaImportTask?.cancel()
        canonMediaImportTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                if self.selectedProjectId != nil, self.canon.pendingMovieImportCount > 0 {
                    do {
                        if let recording = try await self.canon.importNextDetectedMovie() {
                            try await self.register(recording)
                        }
                    } catch {
                        self.errorMessage = "Kameraklippet ble oppdaget, men kunne ikke hentes ennå: \(error.localizedDescription)"
                        try? await Task.sleep(for: .seconds(3))
                    }
                } else {
                    try? await Task.sleep(for: .milliseconds(350))
                }
            }
        }
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

    func refreshVideoSources() {
        guard !isRecording else { return }
        camera.refreshSources()
        canon.refreshDiscovery()
        bridgeDiscovery.stop()
        bridgeDiscovery.start()
    }

    func connectCanon(address: String) async {
        guard !isRecording else { return }
        bridgePlayer?.pause()
        bridgePlayer = nil
        selectedBridgeSourceId = nil
        await camera.stop()
        do {
            try await canon.connectManually(address: address)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func selectSource(_ id: String) async {
        guard !isRecording else { return }
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
        guard !isRecording else { return }
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
        guard !isRecording else { return }
        bridgePlayer?.pause()
        bridgePlayer = nil
        selectedBridgeSourceId = nil
        await camera.stop()
        await canon.select(source)
    }

    func updateCanonSetting(_ key: CCAPIShootingSettingKey, value: String) async {
        do {
            try await canon.updateShootingSetting(key, value: value)
        } catch {
            errorMessage = "Kameraet avviste \(key.displayName.lowercased()): \(error.localizedDescription)"
        }
    }

    func driveCanonFocus(_ drive: CCAPIFocusDrive) async {
        do {
            try await canon.driveFocus(drive)
        } catch {
            errorMessage = "Kameraet kunne ikke flytte fokus: \(error.localizedDescription)"
        }
    }

    func pulseCanonAutoFocus() async {
        do {
            try await canon.setAutoFocus(true)
            try? await Task.sleep(for: .milliseconds(450))
            try await canon.setAutoFocus(false)
        } catch {
            try? await canon.setAutoFocus(false)
            errorMessage = "Kameraet kunne ikke starte autofokus: \(error.localizedDescription)"
        }
    }

    func setCanonFocusPoint(_ point: CGPoint) async {
        do {
            try await canon.setFocusPoint(
                normalizedX: point.x,
                normalizedY: point.y
            )
        } catch {
            errorMessage = "Kameraet kunne ikke flytte AF-punktet: \(error.localizedDescription)"
        }
    }

    func saveMonitorSnapshot(automatic: Bool = false) {
        guard canon.isReady, canon.isLiveViewEnabled, let image = canon.frame else {
            if !automatic { errorMessage = "Snapshot krever et aktivt Canon Live View-bilde." }
            return
        }
        do {
            let url = try VideoSnapshotStore.save(
                image: image,
                projectId: selectedProjectId,
                cameraName: canon.selectedCamera?.displayName
            )
            monitorSnapshotMessage = automatic ? "Auto-snapshot lagret" : "Lagret · \(url.lastPathComponent)"
        } catch {
            if !automatic {
                errorMessage = "Kunne ikke lagre snapshot: \(error.localizedDescription)"
            }
        }
    }

    func selectAsset(_ id: String) {
        selectedAssetId = id
        promotionMessage = nil
        takeSaveMessage = nil
        if let asset = assets.first(where: { $0.id == id }) {
            loadTakeDraft(asset)
        }
    }

    func isUploading(_ assetId: String) -> Bool {
        activeUploads.contains(assetId)
    }

    func retrySelectedUpload() async {
        guard let selectedAsset, selectedAsset.captureState == .failed else { return }
        guard FileManager.default.fileExists(atPath: selectedAsset.localPath) else {
            errorMessage = "Originalfilen finnes ikke lenger på iPaden, så opplastingen kan ikke fortsette."
            return
        }
        await upload(selectedAsset)
    }

    func saveSelectedTake() async {
        guard !isSavingTake,
              let selectedAsset,
              let store
        else { return }
        isSavingTake = true
        takeSaveMessage = nil
        defer { isSavingTake = false }
        do {
            guard let updated = try await store.updateTakeMetadata(
                id: selectedAsset.id,
                ownerUserId: selectedAsset.ownerUserId,
                status: takeStatus,
                circled: takeCircled,
                continuityNotes: continuityNotes.nilIfBlank,
                performanceNotes: performanceNotes.nilIfBlank,
                technicalNotes: technicalNotes.nilIfBlank
            ) else {
                throw TakeBoardFailure.takeMissing
            }
            replaceAsset(updated)
            if await syncTakeMetadata(updated) {
                takeSaveMessage = "Lagret og synkronisert"
            } else {
                takeSaveMessage = "Lagret på iPaden · synkroniseres automatisk"
            }
        } catch {
            errorMessage = "Kunne ikke lagre taken: \(error.localizedDescription)"
        }
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

    func playbackRequest(for asset: VideoCaptureAsset) async -> VideoPlaybackRequest? {
        if FileManager.default.fileExists(atPath: asset.localPath) {
            return VideoPlaybackRequest(
                id: asset.id,
                takeNumber: asset.takeNumber,
                url: URL(fileURLWithPath: asset.localPath)
            )
        }
        guard asset.captureState == .ready,
              let session = SignInService.shared.session
        else {
            errorMessage = "Originalen er ikke tilgjengelig lokalt eller ferdig sikret i CreatorHub."
            return nil
        }
        do {
            let backend = BackendClient(
                baseURL: session.backendBaseURL,
                authHeaders: SignInService.shared.authHeaders
            )
            let response = try await backend.fetchVideoCaptureAsset(
                projectId: asset.projectId,
                assetId: asset.id
            )
            guard let rawURL = response.playbackUrl,
                  let url = URL(string: rawURL)
            else {
                throw PlaybackFailure.cloudOriginalUnavailable
            }
            return VideoPlaybackRequest(id: asset.id, takeNumber: asset.takeNumber, url: url)
        } catch {
            errorMessage = "Kunne ikke åpne originalen fra CreatorHub: \(error.localizedDescription)"
            return nil
        }
    }

    func toggleRecording() async {
        if canon.selectedCameraId != nil {
            await toggleCanonRecording()
            return
        }
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

    private func toggleCanonRecording() async {
        guard selectedProjectId != nil else {
            errorMessage = "Velg et CreatorHub-prosjekt før du starter opptak."
            return
        }
        do {
            if canon.isRecording {
                let recording = try await canon.stopMovieRecording()
                recordingStartedAt = nil
                try await register(recording)
                await updateNextTakeNumber()
            } else {
                try await canon.startMovieRecording()
                recordingStartedAt = Date()
            }
        } catch {
            recordingStartedAt = nil
            errorMessage = error.localizedDescription
        }
    }

    private func register(_ recording: CapturedVideoRecording) async throws {
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
            contentType: UTType(filenameExtension: recording.fileURL.pathExtension)?.preferredMIMEType
                ?? "application/octet-stream",
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
            takeStatus: .unrated,
            circled: false,
            storagePolicy: captureStoragePolicy,
            createdAt: now,
            updatedAt: now
        )
        try await store.save(asset)
        await reload()
        showTransferConfirmation(
            fileName: asset.fileName,
            stage: asset.storagePolicy == .localOnly ? .storedLocallyOnly : .storedLocally,
            storageSummary: localStorageUsedLabel
        )
        await updateNextTakeNumber()
        if asset.storagePolicy != .localOnly {
            Task { [weak self] in
                await self?.upload(asset)
            }
        }
    }

    private func showTransferConfirmation(
        fileName: String,
        stage: VideoTransferConfirmation.Stage,
        storageSummary: String? = nil,
        localCopyReleased: Bool = false,
        localReleaseFailed: Bool = false
    ) {
        transferConfirmationTask?.cancel()
        let confirmation = VideoTransferConfirmation(
            fileName: fileName,
            stage: stage,
            storageSummary: storageSummary,
            localCopyReleased: localCopyReleased,
            localReleaseFailed: localReleaseFailed
        )
        transferConfirmation = confirmation
        transferConfirmationTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(stage == .uploadFailed ? 8 : 5))
            guard !Task.isCancelled, self?.transferConfirmation?.id == confirmation.id else { return }
            self?.transferConfirmation = nil
            self?.transferConfirmationTask = nil
        }
    }

    private func resumePendingUploads() async {
        guard let session = SignInService.shared.session, let store else { return }
        do {
            for asset in try await store.pending(ownerUserId: session.userId)
            where asset.storagePolicy != .localOnly
                && FileManager.default.fileExists(atPath: asset.localPath) {
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
            var localCopyReleased = false
            var localReleaseFailed = false
            if let latest = try? await store.asset(id: asset.id, ownerUserId: asset.ownerUserId) {
                if latest.takeMetadataDirty { _ = await syncTakeMetadata(latest) }
                if latest.storagePolicy == .creatorHubOnly {
                    do {
                        localCopyReleased = try VideoLocalOriginalRetention.releaseVerifiedOriginal(
                            for: latest,
                            managedRoot: CapturedVideoRecording.recordingsDirectory()
                        )
                    } catch {
                        localReleaseFailed = true
                    }
                }
            }
            await reload()
            showTransferConfirmation(
                fileName: asset.fileName,
                stage: .securedInCreatorHub,
                storageSummary: localStorageUsedLabel,
                localCopyReleased: localCopyReleased,
                localReleaseFailed: localReleaseFailed
            )
        } catch {
            try? await store.updateState(
                id: asset.id,
                ownerUserId: asset.ownerUserId,
                state: .failed,
                error: error.localizedDescription
            )
            await reload()
            showTransferConfirmation(
                fileName: asset.fileName,
                stage: .uploadFailed,
                storageSummary: localStorageUsedLabel
            )
        }
    }

    private func reload() async {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--video-take-demo") {
            let fixture = Self.takeBoardFixture
            assets = [fixture]
            selectedAssetId = fixture.id
            if takeDraftAssetId != fixture.id { loadTakeDraft(fixture) }
            refreshStorageUsage(for: assets)
            return
        }
        #endif
        guard let session = SignInService.shared.session, let store else { return }
        do {
            assets = try await store.list(ownerUserId: session.userId, projectId: selectedProjectId)
            refreshStorageUsage(for: try await store.list(ownerUserId: session.userId))
            if selectedAssetId == nil || !assets.contains(where: { $0.id == selectedAssetId }) {
                selectedAssetId = assets.first?.id
            }
            if let selectedAsset, takeDraftAssetId != selectedAsset.id {
                loadTakeDraft(selectedAsset)
            }
            await updateNextTakeNumber()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshStorageUsage(for allAssets: [VideoCaptureAsset]) {
        var seenPaths = Set<String>()
        localStorageUsedBytes = allAssets.reduce(into: Int64(0)) { total, asset in
            guard seenPaths.insert(asset.localPath).inserted else { return }
            let url = URL(fileURLWithPath: asset.localPath)
            guard let values = try? url.resourceValues(forKeys: [
                .isRegularFileKey,
                .fileSizeKey,
                .fileAllocatedSizeKey,
                .totalFileAllocatedSizeKey,
            ]), values.isRegularFile == true else { return }
            total += Int64(values.totalFileAllocatedSize ?? values.fileAllocatedSize ?? values.fileSize ?? 0)
        }
        let documents = try? FileManager.default.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        deviceStorageAvailableBytes = (try? documents?.resourceValues(
            forKeys: [.volumeAvailableCapacityForImportantUsageKey]
        ))?.volumeAvailableCapacityForImportantUsage
    }

    private static func formatBytes(_ bytes: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: max(0, bytes), countStyle: .file)
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

    private func loadTakeDraft(_ asset: VideoCaptureAsset) {
        takeDraftAssetId = asset.id
        takeStatus = asset.takeStatus
        takeCircled = asset.circled
        continuityNotes = asset.continuityNotes ?? ""
        performanceNotes = asset.performanceNotes ?? ""
        technicalNotes = asset.technicalNotes ?? ""
    }

    private func replaceAsset(_ asset: VideoCaptureAsset) {
        guard let index = assets.firstIndex(where: { $0.id == asset.id }) else { return }
        assets[index] = asset
    }

    private func syncTakeMetadata(_ asset: VideoCaptureAsset) async -> Bool {
        guard asset.takeMetadataDirty,
              asset.captureState != .local,
              asset.captureState != .hashing,
              let session = SignInService.shared.session,
              let store
        else { return false }
        let backend = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: SignInService.shared.authHeaders
        )
        do {
            _ = try await backend.updateVideoCaptureTake(
                projectId: asset.projectId,
                assetId: asset.id,
                body: BackendVideoCaptureTakePatch(
                    status: asset.takeStatus.rawValue,
                    circled: asset.circled,
                    continuityNotes: asset.continuityNotes,
                    performanceNotes: asset.performanceNotes,
                    technicalNotes: asset.technicalNotes
                )
            )
            try await store.markTakeMetadataSynced(
                id: asset.id,
                ownerUserId: asset.ownerUserId
            )
            if var synced = try await store.asset(id: asset.id, ownerUserId: asset.ownerUserId) {
                synced.takeMetadataDirty = false
                replaceAsset(synced)
            }
            return true
        } catch {
            // Metadata stays dirty and is retried after upload/app activation.
            return false
        }
    }

    private func syncPendingTakeMetadata() async {
        guard let session = SignInService.shared.session, let store else { return }
        guard let pending = try? await store.pendingTakeMetadata(ownerUserId: session.userId) else { return }
        for asset in pending {
            _ = await syncTakeMetadata(asset)
        }
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

    enum TakeBoardFailure: LocalizedError {
        case takeMissing

        var errorDescription: String? { "Taken finnes ikke lenger i den lokale databasen." }
    }

    enum PlaybackFailure: LocalizedError {
        case cloudOriginalUnavailable

        var errorDescription: String? {
            "CreatorHub har originalen, men kunne ikke opprette en sikker avspillingslenke."
        }
    }

    #if DEBUG
    private static var takeBoardFixture: VideoCaptureAsset {
        let recordedAt = Date(timeIntervalSince1970: 1_789_812_000)
        return VideoCaptureAsset(
            id: "00000000-0000-4000-8000-000000000099",
            ownerUserId: "capture-ui-test",
            projectId: "capture-ui-test",
            localPath: "/tmp/creatorhub-video-take-demo.mov",
            fileName: "A001_T03.mov",
            contentType: "video/quicktime",
            sizeBytes: 12_500_000,
            checksumSha256: String(repeating: "a", count: 64),
            sourceType: .uvc,
            cameraName: "CreatorHub QA Camera",
            durationMs: 12_000,
            frameRate: 25,
            width: 1920,
            height: 1080,
            recordedAt: recordedAt,
            captureState: .ready,
            streamState: "ready",
            uploadObjectId: "capture-ui-test",
            streamUid: nil,
            lastError: nil,
            sceneId: "12",
            shotId: "12A",
            slate: "A001",
            takeNumber: 3,
            takeStatus: .good,
            circled: true,
            continuityNotes: "Glass i venstre hånd",
            performanceNotes: "Beste timing i siste replikk",
            technicalNotes: "Ren fokus og lyd",
            takeMetadataDirty: false,
            createdAt: recordedAt,
            updatedAt: recordedAt
        )
    }
    #endif
}

private extension String {
    var nilIfBlank: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
