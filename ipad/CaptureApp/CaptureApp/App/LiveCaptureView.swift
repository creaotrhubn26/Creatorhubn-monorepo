import SwiftUI
import UIKit

// MARK: - Root

/// Live tethered-capture surface for iPad. Three first-class states:
/// (a) disconnected — focused connect CTA; (b) connecting — calm progress;
/// (c) connected — hero + filmstrip + shutter. Designed for on-set use:
/// dark background, large touch targets, persistent status glance.
struct LiveCaptureView: View {
    @State private var model = LiveCaptureModel()
    @AppStorage("capture.lastCameraURL") private var lastCameraURL: String = "https://192.168.1.2"
    @State private var isSettingsPresented = false
    @State private var isTunePresented = false
    @State private var viewerAsset: Asset?

    var body: some View {
        ZStack {
            Color.captureBackground.ignoresSafeArea()

            switch model.phase {
            case .disconnected:
                DisconnectedOverlay(
                    defaultURL: lastCameraURL,
                    isConnecting: model.isConnecting,
                    lastError: model.errorMessage,
                    onConnect: { url in
                        lastCameraURL = url.absoluteString
                        Task { await model.connect(to: url) }
                    },
                    onDemo: {
                        Task { await model.connect(to: LiveCaptureModel.demoBaseURL) }
                    },
                    onPickDiscovered: { camera in
                        lastCameraURL = camera.baseURL.absoluteString
                        Task { await model.connect(to: camera.baseURL) }
                    }
                )
            case .connecting:
                ConnectingOverlay(
                    state: model.connectionState,
                    onCancel: { Task { await model.disconnect() } }
                )
            case .connected:
                connectedLayout
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $isSettingsPresented) {
            SettingsSheet(
                currentURL: lastCameraURL,
                device: model.deviceSummary,
                sessionName: model.sessionName,
                onRename: { newName in
                    Task { await model.renameSession(newName) }
                },
                onDisconnect: {
                    isSettingsPresented = false
                    Task { await model.disconnect() }
                }
            )
            .presentationDetents([.medium])
        }
        .fullScreenCover(item: $viewerAsset) { asset in
            AssetViewerScreen(asset: asset) { viewerAsset = nil }
        }
        .sheet(isPresented: $isTunePresented) {
            if let asset = model.focusedAsset {
                TunePanel(
                    initialRecipe: model.recipe(for: asset.id),
                    onChange: { model.tune(assetId: asset.id, recipe: $0) },
                    onReset: { model.resetRecipe(assetId: asset.id) }
                )
                .presentationDetents([.medium, .large])
            }
        }
        .animation(.spring(duration: 0.35, bounce: 0.1), value: model.phase)
    }

    private var connectedLayout: some View {
        VStack(spacing: 0) {
            StatusBar(
                state: model.connectionState,
                device: model.deviceSummary,
                telemetry: model.telemetry,
                pinnedFocus: model.pinnedFocus,
                onTogglePin: { model.pinnedFocus.toggle() },
                onSettings: { isSettingsPresented = true }
            )
            .padding(.horizontal, 24)
            .padding(.vertical, 12)

            Divider().background(Color.captureSeparator)

            ZStack {
                HeroStage(
                    asset: model.focusedAsset,
                    recipe: model.focusedAsset.map { model.recipe(for: $0.id) } ?? .neutral,
                    isTuned: model.focusedAsset.map { model.tunedRecipes[$0.id] != nil } ?? false,
                    showMagic: model.showMagic,
                    onTap: { asset in viewerAsset = asset },
                    onToggleMagic: { model.showMagic.toggle() },
                    onOpenTune: {
                        guard model.focusedAsset?.enhancedKey != nil else { return }
                        isTunePresented = true
                    },
                    onSetRating: { rating in
                        guard let id = model.focusedAsset?.id else { return }
                        Task { await model.setRating(assetId: id, rating: rating) }
                    },
                    onTogglePick: {
                        guard let asset = model.focusedAsset else { return }
                        Task { await model.togglePick(asset: asset) }
                    },
                    onToggleReject: {
                        guard let asset = model.focusedAsset else { return }
                        Task { await model.toggleReject(asset: asset) }
                    }
                )
                ShutterFlashOverlay(trigger: model.shutterFlashToken)
                    .allowsHitTesting(false)
            }
            .frame(maxHeight: .infinity)

            TelemetryFooter(telemetry: model.telemetry)

            VStack(spacing: 0) {
                FilmstripFilterBar(
                    current: model.filmstripFilter,
                    counts: FilmstripFilterBar.Counts(
                        total: model.assets.count,
                        picks: model.assets.filter { $0.flaggedForClient && !$0.rejected }.count,
                        fourPlus: model.assets.filter { $0.rating >= 4 && !$0.rejected }.count
                    ),
                    onSelect: { model.filmstripFilter = $0 }
                )
                FilmstripRail(
                    assets: model.filteredAssets,
                    focusedAssetId: model.focusedAssetId,
                    onSelect: { model.focusedAssetId = $0.id },
                    onDoubleTap: { viewerAsset = $0 }
                )
                .frame(height: 152)
            }
            .background(Color.captureFilmstripBG)
        }
        .overlay(alignment: .bottomTrailing) {
            ShutterButton(
                enabled: model.canShoot,
                isShooting: model.connectionState == .shooting
            ) {
                Task { await model.triggerShutter() }
            }
            .padding(.trailing, 32)
            .padding(.bottom, 176)
        }
        .overlay(alignment: .top) {
            if let err = model.errorMessage, model.phase == .connected {
                ErrorToast(message: err) { model.errorMessage = nil }
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }
}

// MARK: - Disconnected overlay

private struct DisconnectedOverlay: View {
    let defaultURL: String
    let isConnecting: Bool
    let lastError: String?
    let onConnect: (URL) -> Void
    let onDemo: () -> Void
    let onPickDiscovered: (CameraDiscovery.Found) -> Void

    @State private var url: String = ""
    @StateObject private var discovery = CameraDiscovery()
    @FocusState private var urlFocused: Bool

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 12) {
                Image(systemName: "camera.aperture")
                    .font(.system(size: 64, weight: .light))
                    .foregroundStyle(.tint)
                Text("CreatorHub Capture")
                    .font(.largeTitle.weight(.semibold))
                Text("Tethered shoot over Canon CCAPI")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            DiscoveredCamerasSection(
                cameras: discovery.cameras,
                isSearching: discovery.isSearching,
                permissionDenied: discovery.permissionDenied,
                onPick: onPickDiscovered
            )
            .frame(maxWidth: 440)

            VStack(alignment: .leading, spacing: 8) {
                Label("Or enter manually", systemImage: "network")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                TextField("https://192.168.1.2", text: $url)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.captureFieldBG, in: RoundedRectangle(cornerRadius: 10))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .focused($urlFocused)
                    .submitLabel(.go)
                    .onSubmit(connect)
                Text("Join the camera's Access Point first, then paste the URL from MENU → Wi-Fi settings → Camera Control API.")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 440)

            if let lastError {
                VStack(alignment: .leading, spacing: 10) {
                    Label(lastError, systemImage: "exclamationmark.triangle")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.red)
                    Text("Usual causes:")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                    FailureGuideItem(icon: "wifi",             text: "Your Mac or iPad must be on the camera's Access Point.")
                    FailureGuideItem(icon: "camera",           text: "CCAPI must be enabled: MENU → Wi-Fi → Camera Control API.")
                    FailureGuideItem(icon: "network",          text: "The URL must match what the camera's screen shows exactly.")
                }
                .padding(14)
                .background(Color.captureFieldBG, in: RoundedRectangle(cornerRadius: 10))
                .frame(maxWidth: 440)
            }

            Button(action: connect) {
                HStack(spacing: 8) {
                    if isConnecting { ProgressView().controlSize(.small) }
                    Text(isConnecting ? "Connecting…" : "Connect")
                        .font(.body.weight(.semibold))
                }
                .frame(maxWidth: 440, minHeight: 52)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(isConnecting || URL(string: url)?.host == nil)

            #if DEBUG
            Button(action: onDemo) {
                Label("Try demo camera", systemImage: "wand.and.stars")
                    .font(.footnote.weight(.medium))
            }
            .buttonStyle(.bordered)
            .controlSize(.regular)
            .disabled(isConnecting)
            #endif
        }
        .padding(.horizontal, 40)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            url = defaultURL
            discovery.start()
        }
        .onDisappear { discovery.stop() }
    }

    private func connect() {
        guard let resolved = URL(string: url), resolved.host != nil else { return }
        urlFocused = false
        onConnect(resolved)
    }
}

private struct DiscoveredCamerasSection: View {
    let cameras: [CameraDiscovery.Found]
    let isSearching: Bool
    let permissionDenied: Bool
    let onPick: (CameraDiscovery.Found) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                if isSearching && cameras.isEmpty {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: "wifi")
                        .foregroundStyle(.tint)
                }
                Text(header)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                Spacer()
            }

            if permissionDenied {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "lock.shield")
                        .foregroundStyle(.yellow)
                    Text("Local-network permission was denied. Enable it in Settings → CreatorHub Capture → Local Network to find cameras automatically.")
                        .font(.caption)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(10)
                .background(Color.captureChipBG, in: RoundedRectangle(cornerRadius: 8))
            } else if cameras.isEmpty && isSearching {
                Text("Checking the network for cameras… make sure the camera is on and CCAPI is enabled.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: 8) {
                    ForEach(cameras) { camera in
                        DiscoveredCameraCard(camera: camera, onTap: { onPick(camera) })
                    }
                }
            }
        }
    }

    private var header: String {
        if permissionDenied                { return "Local-network permission needed" }
        if cameras.isEmpty && isSearching  { return "Searching for cameras…" }
        if cameras.isEmpty                 { return "No cameras on the network yet" }
        if cameras.count == 1              { return "1 camera found" }
        return "\(cameras.count) cameras found"
    }
}

private struct DiscoveredCameraCard: View {
    let camera: CameraDiscovery.Found
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 14) {
                Image(systemName: "camera.fill")
                    .font(.title2)
                    .foregroundStyle(.tint)
                    .frame(width: 40, height: 40)
                    .background(Color.tint.opacity(0.15), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(camera.displayName)
                        .font(.body.weight(.semibold))
                    HStack(spacing: 6) {
                        if let firmware = camera.firmware {
                            Text("fw \(firmware)").font(.caption2.monospaced())
                        }
                        if let host = camera.baseURL.host {
                            if camera.firmware != nil { Text("·").foregroundStyle(.tertiary) }
                            Text(host).font(.caption2.monospaced())
                        }
                    }
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(12)
            .background(Color.captureFieldBG, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(.tint.opacity(0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

private extension Color {
    static var tint: Color { Color.accentColor }
}

// MARK: - Failure guide helper

private struct FailureGuideItem: View {
    let icon: String
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(.tint)
                .frame(width: 20)
            Text(text)
                .font(.caption)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Connecting overlay (progress ladder)

private struct ConnectingOverlay: View {
    let state: CameraSession.State
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 28) {
            VStack(spacing: 10) {
                ProgressView()
                    .controlSize(.large)
                Text("Connecting to camera")
                    .font(.title3.weight(.semibold))
            }

            VStack(alignment: .leading, spacing: 14) {
                ConnectStep(title: "Discovered capabilities",  level: stepLevel(.discovered))
                ConnectStep(title: "Paired securely",           level: stepLevel(.paired))
                ConnectStep(title: "Ready to shoot",            level: stepLevel(.ready))
            }
            .padding(18)
            .frame(maxWidth: 380, alignment: .leading)
            .background(Color.captureChipBG, in: RoundedRectangle(cornerRadius: 12))

            if case let .error(message) = state {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button(role: .destructive, action: onCancel) {
                Label("Cancel", systemImage: "xmark")
                    .padding(.horizontal, 16).padding(.vertical, 8)
            }
            .buttonStyle(.bordered)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private enum Step { case discovered, paired, ready }

    private func stepLevel(_ step: Step) -> ConnectStep.Level {
        switch (step, state) {
        case (.discovered, .discovering):                         return .inProgress
        case (.discovered, _):                                    return .done
        case (.paired, .discovering):                             return .idle
        case (.paired, .pairing):                                 return .inProgress
        case (.paired, _):                                        return .done
        case (.ready, .discovering), (.ready, .pairing):          return .idle
        case (.ready, .ready), (.ready, .shooting):               return .done
        case (.ready, .reconnecting), (.ready, .error):           return .idle
        default:                                                  return .idle
        }
    }
}

private struct ConnectStep: View {
    enum Level { case idle, inProgress, done, failed }
    let title: String
    let level: Level

    var body: some View {
        HStack(spacing: 14) {
            Group {
                switch level {
                case .idle:
                    Image(systemName: "circle")
                        .foregroundStyle(.tertiary)
                case .inProgress:
                    ProgressView().controlSize(.small)
                case .done:
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                case .failed:
                    Image(systemName: "xmark.octagon.fill")
                        .foregroundStyle(.red)
                }
            }
            .frame(width: 24, height: 24)
            Text(title)
                .font(.callout)
                .foregroundStyle(level == .idle ? .secondary : .primary)
            Spacer()
        }
    }
}

// MARK: - Status bar

private struct StatusBar: View {
    let state: CameraSession.State
    let device: LiveCaptureModel.DeviceSummary?
    let telemetry: CameraTelemetry
    let pinnedFocus: Bool
    let onTogglePin: () -> Void
    let onSettings: () -> Void

    var body: some View {
        HStack(spacing: 16) {
            ConnectionBadge(state: state)

            if let device {
                Divider().frame(height: 18)
                VStack(alignment: .leading, spacing: 0) {
                    Text(device.productName)
                        .font(.subheadline.weight(.semibold))
                    Text("fw \(device.firmware) · \(device.serial)")
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                }
                .lineLimit(1)
            }

            Spacer()

            if let files = telemetry.totalContentsCount {
                Label("\(files) on card", systemImage: "sdcard")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }

            Button(action: onTogglePin) {
                Image(systemName: pinnedFocus ? "pin.fill" : "pin.slash")
                    .font(.body)
                    .frame(width: 36, height: 36)
                    .foregroundStyle(pinnedFocus ? Color.accentColor : .secondary)
                    .background(
                        pinnedFocus
                            ? Color.accentColor.opacity(0.15)
                            : Color.clear,
                        in: Circle()
                    )
            }
            .buttonStyle(.plain)
            .help(pinnedFocus ? "Focus is pinned — new shots won't jump to latest" : "Follow latest")

            Button(action: onSettings) {
                Image(systemName: "gear")
                    .font(.title3)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
        }
    }
}

private struct ConnectionBadge: View {
    let state: CameraSession.State

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
                .overlay(
                    Circle()
                        .stroke(color.opacity(0.4), lineWidth: 8)
                        .scaleEffect(pulsing ? 2 : 1)
                        .opacity(pulsing ? 0 : 1)
                        .animation(
                            pulsing ? .easeOut(duration: 1.2).repeatForever(autoreverses: false) : .default,
                            value: pulsing
                        )
                )
            Text(label)
                .font(.caption.weight(.medium))
                .lineLimit(1)
                .fixedSize()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.captureChipBG, in: Capsule())
    }

    private var pulsing: Bool {
        switch state {
        case .ready, .shooting: return true
        default: return false
        }
    }

    private var label: String {
        switch state {
        case .disconnected:             return "Disconnected"
        case .discovering:              return "Discovering"
        case .pairing:                  return "Pairing"
        case .ready:                    return "Ready"
        case .shooting:                 return "Shooting"
        case let .reconnecting(n):      return "Reconnecting · attempt \(n)"
        case let .error(msg):           return "Error — \(msg)"
        }
    }

    private var color: Color {
        switch state {
        case .disconnected:             return .gray
        case .discovering, .pairing:    return .yellow
        case .ready:                    return .green
        case .shooting:                 return .blue
        case .reconnecting:             return .orange
        case .error:                    return .red
        }
    }
}

// MARK: - Hero stage

private struct HeroStage: View {
    let asset: Asset?
    let recipe: MagicRecipe
    let isTuned: Bool
    let showMagic: Bool
    let onTap: (Asset) -> Void
    let onToggleMagic: () -> Void
    let onOpenTune: () -> Void
    let onSetRating: (Int) -> Void
    let onTogglePick: () -> Void
    let onToggleReject: () -> Void

    var body: some View {
        Group {
            if let asset {
                VStack(spacing: 12) {
                    HeroImage(asset: asset, preferMagic: showMagic)
                        .onTapGesture { onTap(asset) }
                        .padding(.horizontal, 24)
                        .padding(.top, 16)
                        .overlay(alignment: .topTrailing) {
                            if asset.enhancedKey != nil {
                                MagicToggleChip(showMagic: showMagic, action: onToggleMagic)
                                    .padding(.top, 28)
                                    .padding(.trailing, 36)
                            }
                        }

                    // Recipe chips — show exactly what Magic is doing so
                    // the photographer can tune deliberately rather than
                    // trust an opaque preset. Tap to open the slider panel.
                    if asset.enhancedKey != nil, !recipe.displayChips.isEmpty {
                        Button(action: onOpenTune) {
                            RecipeChipsRow(chips: recipe.displayChips, isTuned: isTuned)
                        }
                        .buttonStyle(.plain)
                    }

                    // Selects workflow: star rating + pick/reject actions.
                    // Core value of a tether app — letting the photographer
                    // cull in-camera while shooting continues. Keyboard
                    // shortcuts surface for external-keyboard users.
                    HStack(spacing: 18) {
                        RatingBar(rating: asset.rating, onRate: onSetRating)
                        Divider().frame(height: 20)
                        PickRejectControls(
                            flagged: asset.flaggedForClient,
                            rejected: asset.rejected,
                            onTogglePick: onTogglePick,
                            onToggleReject: onToggleReject
                        )
                    }

                    HStack(spacing: 12) {
                        AssetBadge(text: asset.originalFilename, icon: "photo")
                        if let kind = fileKind(asset.originalFilename) {
                            AssetBadge(text: kind, icon: "rectangle.stack")
                        }
                        if let capturedAt = relativeTime(asset.captureTime) {
                            AssetBadge(text: capturedAt, icon: "clock")
                        }
                        if asset.enhancedKey != nil {
                            Label("Magic", systemImage: "wand.and.stars")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .foregroundStyle(.purple)
                                .background(Color.purple.opacity(0.15), in: Capsule())
                        }
                        AssetStateBadge(state: asset.state)
                    }
                    .padding(.bottom, 16)
                }
            } else {
                EmptyHero()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func fileKind(_ name: String) -> String? {
        let ext = (name as NSString).pathExtension.lowercased()
        switch ext {
        case "cr3", "cr2": return "RAW"
        case "jpg", "jpeg": return "JPEG"
        case "heic": return "HEIC"
        case "mp4", "mov": return "Video"
        default: return ext.isEmpty ? nil : ext.uppercased()
        }
    }

    private func relativeTime(_ date: Date) -> String? {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

private struct HeroImage: View {
    let asset: Asset
    var preferMagic: Bool = true

    @State private var loupePoint: CGPoint?

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.captureChipBG)
            // When we have BOTH original and enhanced, show the comparison
            // slider so the photographer can A/B by dragging the divider
            // rather than tap-toggling through two states. When only one
            // exists (not yet enhanced, or enhancedDisabled via toggle),
            // fall back to the single-image display.
            if preferMagic,
               let originalKey = asset.previewKey,
               let enhancedKey = asset.enhancedKey {
                ComparisonSlider(originalPath: originalKey, enhancedPath: enhancedKey)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(radius: 20, y: 8)
            } else {
            let key = asset.previewKey
            if let key, let image = UIImage(contentsOfFile: key) {
                GeometryReader { geo in
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .shadow(radius: 20, y: 8)
                        .transition(.opacity)
                        .id(key)
                        .overlay {
                            if let loupePoint {
                                FocusLoupe(image: image, containerSize: geo.size, point: loupePoint)
                            }
                        }
                        .gesture(
                            LongPressGesture(minimumDuration: 0.2)
                                .sequenced(before: DragGesture(minimumDistance: 0))
                                .onChanged { value in
                                    switch value {
                                    case .second(true, let drag):
                                        loupePoint = drag?.location
                                    default:
                                        break
                                    }
                                }
                                .onEnded { _ in loupePoint = nil }
                        )
                }
            } else {
                VStack(spacing: 14) {
                    if asset.state == .previewPending {
                        ProgressView()
                            .controlSize(.large)
                        Text("Downloading preview…")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        Image(systemName: "photo.badge.exclamationmark")
                            .font(.system(size: 48))
                            .foregroundStyle(.tertiary)
                        Text("Preview unavailable")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            }
        }
    }
}

/// 100% zoom loupe that follows the finger. Long-press-and-drag anywhere
/// on the hero image to summon it — matches the pro-photography gesture
/// for focus-checking. The loupe offsets its inner image so the pixel
/// directly under the finger is always centered in the circle.
private struct FocusLoupe: View {
    let image: UIImage
    let containerSize: CGSize
    let point: CGPoint

    private static let loupeDiameter: CGFloat = 180
    private static let zoom: CGFloat = 2.5

    var body: some View {
        // Compute image display rect inside the container (aspectFit).
        let imgAspect = image.size.width / max(image.size.height, 1)
        let boxAspect = containerSize.width / max(containerSize.height, 1)
        let displaySize: CGSize
        if imgAspect > boxAspect {
            let w = containerSize.width
            displaySize = CGSize(width: w, height: w / imgAspect)
        } else {
            let h = containerSize.height
            displaySize = CGSize(width: h * imgAspect, height: h)
        }
        let displayOrigin = CGPoint(
            x: (containerSize.width - displaySize.width) / 2,
            y: (containerSize.height - displaySize.height) / 2
        )

        // Pixel position under finger, in display-rect coordinates.
        let localX = max(0, min(displaySize.width, point.x - displayOrigin.x))
        let localY = max(0, min(displaySize.height, point.y - displayOrigin.y))

        // The loupe renders a zoomed copy of the same displayed image and
        // offsets it so (localX, localY) centers in the circle.
        return ZStack {
            Image(uiImage: image)
                .resizable()
                .interpolation(.high)
                .aspectRatio(contentMode: .fit)
                .frame(width: displaySize.width * Self.zoom, height: displaySize.height * Self.zoom)
                .offset(
                    x: -localX * Self.zoom + Self.loupeDiameter / 2,
                    y: -localY * Self.zoom + Self.loupeDiameter / 2
                )
                .frame(width: Self.loupeDiameter, height: Self.loupeDiameter, alignment: .topLeading)
                .clipShape(Circle())
                .overlay(Circle().stroke(.white, lineWidth: 3))
                .overlay(Circle().stroke(.black.opacity(0.3), lineWidth: 1).padding(2))
                .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
                .position(x: clampedX(for: point.x), y: clampedY(for: point.y))
                .allowsHitTesting(false)
        }
    }

    private func clampedX(for x: CGFloat) -> CGFloat {
        min(max(x, Self.loupeDiameter / 2 + 8), containerSize.width - Self.loupeDiameter / 2 - 8)
    }

    private func clampedY(for y: CGFloat) -> CGFloat {
        // Place loupe above finger so it's visible; clamp so it doesn't
        // escape the display bounds.
        let target = y - Self.loupeDiameter / 2 - 20
        return min(max(target, Self.loupeDiameter / 2 + 8), containerSize.height - Self.loupeDiameter / 2 - 8)
    }
}

private struct EmptyHero: View {
    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "camera.aperture")
                .font(.system(size: 96, weight: .ultraLight))
                .foregroundStyle(.tertiary)
            Text("Awaiting first shot")
                .font(.title2.weight(.medium))
            Text("Fire the shutter below or press on your camera to begin.")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Comparison slider

/// Drag-to-reveal before/after viewer. Left half of the divider shows the
/// original preview, right half the enhanced version. Gesture moves the
/// divider anywhere horizontally. Tap the handle to snap to center.
private struct ComparisonSlider: View {
    let originalPath: String
    let enhancedPath: String
    @State private var divider: CGFloat = 0.5
    @State private var isDragging: Bool = false

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                // Base: enhanced image (shown as the "result" side)
                ImageFile(path: enhancedPath)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()

                // Overlay: original, clipped to LEFT portion via mask
                ImageFile(path: originalPath)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                    .mask(alignment: .leading) {
                        HStack(spacing: 0) {
                            Color.white.frame(width: geo.size.width * divider)
                            Color.clear
                        }
                    }

                // Divider line + handle
                let x = geo.size.width * divider
                Rectangle()
                    .fill(.white)
                    .frame(width: 2, height: geo.size.height)
                    .offset(x: x - 1)
                    .shadow(color: .black.opacity(0.5), radius: 3, y: 0)

                Circle()
                    .fill(.white)
                    .frame(width: 40, height: 40)
                    .overlay(
                        Image(systemName: "chevron.left.chevron.right")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.black.opacity(0.7))
                    )
                    .shadow(color: .black.opacity(0.4), radius: 6, y: 2)
                    .scaleEffect(isDragging ? 1.12 : 1)
                    .offset(x: x - 20, y: geo.size.height / 2 - 20)
                    .animation(.easeOut(duration: 0.1), value: isDragging)

                // Labels
                HStack {
                    labelChip("Original", color: .black.opacity(0.6))
                        .padding(.leading, 12)
                    Spacer()
                    labelChip("Magic", color: .purple.opacity(0.8))
                        .padding(.trailing, 12)
                }
                .padding(.top, 12)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture()
                    .onChanged { value in
                        isDragging = true
                        divider = max(0, min(1, value.location.x / geo.size.width))
                    }
                    .onEnded { _ in isDragging = false }
            )
            .onTapGesture(count: 2) {
                withAnimation(.spring) { divider = 0.5 }
            }
        }
    }

    private func labelChip(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(color, in: Capsule())
    }
}

private struct ImageFile: View {
    let path: String
    var body: some View {
        if let img = UIImage(contentsOfFile: path) {
            Image(uiImage: img).resizable().aspectRatio(contentMode: .fit)
        } else {
            Color.captureChipBG
        }
    }
}

// MARK: - Rating + pick/reject controls

/// Five-star rating with tap-to-set and keyboard 1-5. Tap a lit star to
/// clear back to zero. Keyboard shortcuts live on invisible buttons so
/// external-keyboard users can fly without touching the screen.
private struct RatingBar: View {
    let rating: Int
    let onRate: (Int) -> Void

    var body: some View {
        HStack(spacing: 6) {
            ForEach(1...5, id: \.self) { value in
                Button {
                    onRate(rating == value ? 0 : value)
                } label: {
                    Image(systemName: value <= rating ? "star.fill" : "star")
                        .font(.title3)
                        .foregroundStyle(value <= rating ? .yellow : .white.opacity(0.35))
                }
                .buttonStyle(.plain)
                .keyboardShortcut(KeyEquivalent(Character("\(value)")), modifiers: [])
                .accessibilityLabel("Rate \(value) star\(value == 1 ? "" : "s")")
            }
        }
    }
}

private struct PickRejectControls: View {
    let flagged: Bool
    let rejected: Bool
    let onTogglePick: () -> Void
    let onToggleReject: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Button(action: onTogglePick) {
                Label("Pick", systemImage: flagged ? "flag.fill" : "flag")
                    .labelStyle(.iconOnly)
                    .font(.title3)
                    .foregroundStyle(flagged ? .green : .white.opacity(0.35))
                    .frame(width: 36, height: 36)
                    .background(flagged ? Color.green.opacity(0.15) : .clear, in: Circle())
            }
            .buttonStyle(.plain)
            .keyboardShortcut("p", modifiers: [])
            .accessibilityLabel("Flag as pick")

            Button(action: onToggleReject) {
                Label("Reject", systemImage: rejected ? "xmark.seal.fill" : "xmark.seal")
                    .labelStyle(.iconOnly)
                    .font(.title3)
                    .foregroundStyle(rejected ? .red : .white.opacity(0.35))
                    .frame(width: 36, height: 36)
                    .background(rejected ? Color.red.opacity(0.15) : .clear, in: Circle())
            }
            .buttonStyle(.plain)
            .keyboardShortcut("x", modifiers: [])
            .accessibilityLabel("Mark as rejected")
        }
    }
}

// MARK: - Recipe chips + Tune panel

private struct RecipeChipsRow: View {
    let chips: [String]
    let isTuned: Bool

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: isTuned ? "slider.horizontal.3" : "sparkles")
                .font(.caption.weight(.semibold))
                .foregroundStyle(isTuned ? .orange : .purple)
            ForEach(chips, id: \.self) { chip in
                Text(chip)
                    .font(.caption.monospaced())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .foregroundStyle(.secondary)
                    .background(Color.captureChipBG, in: Capsule())
            }
            Text(isTuned ? "Tuned" : "Tune")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .foregroundStyle(isTuned ? .orange : .secondary)
                .overlay(Capsule().stroke(isTuned ? .orange.opacity(0.6) : .secondary.opacity(0.3), lineWidth: 1))
        }
    }
}

struct TunePanel: View {
    let initialRecipe: MagicRecipe
    let onChange: (MagicRecipe) -> Void
    let onReset: () -> Void

    @State private var recipe: MagicRecipe
    @State private var debounce: Task<Void, Never>?
    @Environment(\.dismiss) private var dismiss

    init(initialRecipe: MagicRecipe,
         onChange: @escaping (MagicRecipe) -> Void,
         onReset: @escaping () -> Void) {
        self.initialRecipe = initialRecipe
        self.onChange = onChange
        self.onReset = onReset
        self._recipe = State(initialValue: initialRecipe)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TuneSlider(title: "Warmth", icon: "thermometer.sun",
                               value: $recipe.warmth, range: -1...1,
                               format: { v in
                                let k = Int((v * 700).rounded())
                                return k == 0 ? "neutral" : "\(k > 0 ? "+" : "")\(k)K"
                               })
                    TuneSlider(title: "Skin smoothing", icon: "face.smiling",
                               value: $recipe.skinSmooth, range: 0...1,
                               format: { "\(Int(($0 * 100).rounded()))%" })
                    TuneSlider(title: "Shadow lift", icon: "circle.lefthalf.filled",
                               value: $recipe.shadowLift, range: 0...1,
                               format: { "\(Int(($0 * 100).rounded()))%" })
                    TuneSlider(title: "Contrast", icon: "rectangle.lefthalf.inset.filled",
                               value: $recipe.contrast, range: -1...1,
                               format: signedPercent)
                    TuneSlider(title: "Saturation", icon: "paintpalette",
                               value: $recipe.saturation, range: -1...1,
                               format: signedPercent)
                } header: {
                    Text("Tune this shot")
                } footer: {
                    Text("Changes apply live. Reset restores the auto-selected baseline (portrait, vehicle, food, etc.).")
                }

                Section {
                    Button(role: .destructive) {
                        recipe = initialRecipe
                        onReset()
                    } label: {
                        Label("Reset to baseline", systemImage: "arrow.uturn.backward")
                    }
                }
            }
            .navigationTitle("Magic · Tune")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .onChange(of: recipe) { _, new in
                debounce?.cancel()
                debounce = Task {
                    try? await Task.sleep(for: .milliseconds(120))
                    if !Task.isCancelled { onChange(new) }
                }
            }
        }
    }

    private func signedPercent(_ v: Double) -> String {
        let pct = Int((v * 100).rounded())
        return pct == 0 ? "neutral" : "\(pct > 0 ? "+" : "")\(pct)%"
    }
}

private struct TuneSlider: View {
    let title: String
    let icon: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let format: (Double) -> String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label(title, systemImage: icon).font(.callout)
                Spacer()
                Text(format(value))
                    .font(.footnote.monospaced())
                    .foregroundStyle(.secondary)
            }
            Slider(value: $value, in: range)
        }
        .padding(.vertical, 2)
    }
}

private struct MagicToggleChip: View {
    let showMagic: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: showMagic ? "wand.and.stars" : "photo")
                    .font(.footnote.weight(.semibold))
                Text(showMagic ? "Magic" : "Original")
                    .font(.footnote.weight(.semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                (showMagic ? Color.purple : Color.black.opacity(0.6)).gradient,
                in: Capsule()
            )
            .overlay(Capsule().stroke(.white.opacity(0.2), lineWidth: 1))
            .shadow(radius: 8, y: 3)
        }
        .buttonStyle(PressableScale())
    }
}

private struct AssetBadge: View {
    let text: String
    let icon: String

    var body: some View {
        Label(text, systemImage: icon)
            .font(.caption.monospaced())
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundStyle(.secondary)
            .background(Color.captureChipBG, in: Capsule())
    }
}

private struct AssetStateBadge: View {
    let state: AssetState

    var body: some View {
        Label(title, systemImage: icon)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundStyle(color)
            .background(color.opacity(0.15), in: Capsule())
    }

    private var title: String {
        switch state {
        case .anticipated:      return "Anticipated"
        case .previewPending:   return "Downloading"
        case .previewReady:     return "Preview ready"
        case .fullPending:      return "Fetching full"
        case .fullReady:        return "Full ready"
        case .rawPending:       return "Fetching RAW"
        case .rawReady:         return "RAW ready"
        case .syncPending:      return "Sync queued"
        case .syncInProgress:   return "Syncing"
        case .syncComplete:     return "Synced"
        case .verified:         return "Verified"
        case .failedTransient:  return "Retry pending"
        case .failedPermanent:  return "Failed"
        }
    }

    private var icon: String {
        switch state {
        case .anticipated:                          return "clock"
        case .previewPending, .fullPending, .rawPending:
                                                    return "arrow.down.circle"
        case .previewReady:                         return "checkmark.circle"
        case .fullReady, .rawReady:                 return "square.and.arrow.down"
        case .syncPending, .syncInProgress:         return "icloud.and.arrow.up"
        case .syncComplete, .verified:              return "checkmark.seal.fill"
        case .failedTransient:                      return "arrow.triangle.2.circlepath"
        case .failedPermanent:                      return "xmark.octagon"
        }
    }

    private var color: Color {
        switch state {
        case .anticipated, .previewPending, .fullPending, .rawPending:
                                                    return .orange
        case .previewReady, .fullReady, .rawReady:  return .green
        case .syncPending, .syncInProgress:         return .blue
        case .syncComplete, .verified:              return .green
        case .failedTransient:                      return .yellow
        case .failedPermanent:                      return .red
        }
    }
}

// MARK: - Filmstrip

private struct FilmstripFilterBar: View {
    struct Counts { let total: Int; let picks: Int; let fourPlus: Int }
    let current: LiveCaptureModel.FilmstripFilter
    let counts: Counts
    let onSelect: (LiveCaptureModel.FilmstripFilter) -> Void

    var body: some View {
        HStack(spacing: 8) {
            chip(for: .all, count: counts.total)
            chip(for: .picks, count: counts.picks)
            chip(for: .fourPlus, count: counts.fourPlus)
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.top, 10)
        .padding(.bottom, 2)
    }

    private func chip(for filter: LiveCaptureModel.FilmstripFilter, count: Int) -> some View {
        Button {
            onSelect(filter)
        } label: {
            HStack(spacing: 6) {
                Text(filter.rawValue).font(.caption.weight(.medium))
                Text("\(count)")
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 6).padding(.vertical, 1)
                    .background(.white.opacity(0.1), in: Capsule())
            }
            .foregroundStyle(current == filter ? .white : .secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                current == filter ? Color.accentColor : .white.opacity(0.06),
                in: Capsule()
            )
        }
        .buttonStyle(.plain)
    }
}

private struct FilmstripRail: View {
    let assets: [Asset]
    let focusedAssetId: UUID?
    let onSelect: (Asset) -> Void
    let onDoubleTap: (Asset) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(assets) { asset in
                        FilmstripTile(
                            asset: asset,
                            isFocused: asset.id == focusedAssetId
                        )
                        .onTapGesture { onSelect(asset) }
                        .onTapGesture(count: 2) { onDoubleTap(asset) }
                        .id(asset.id)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 16)
            }
            .onChange(of: assets.count) { _, _ in
                if let last = assets.last?.id {
                    withAnimation(.spring) { proxy.scrollTo(last, anchor: .trailing) }
                }
            }
            .onChange(of: focusedAssetId) { _, new in
                if let new {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        proxy.scrollTo(new, anchor: .center)
                    }
                }
            }
        }
    }
}

private struct FilmstripTile: View {
    let asset: Asset
    let isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topTrailing) {
                Group {
                    if let key = asset.previewKey, let image = UIImage(contentsOfFile: key) {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } else if asset.state == .previewPending {
                        ZStack {
                            Color.captureChipBG
                            ProgressView().controlSize(.mini)
                        }
                    } else {
                        ZStack {
                            Color.captureChipBG
                            Image(systemName: "photo")
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
                .frame(width: 156, height: 104)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .opacity(asset.rejected ? 0.35 : 1)
                .overlay {
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(
                            overlayColor,
                            lineWidth: isFocused ? 2.5 : (asset.flaggedForClient ? 2 : 1)
                        )
                }

                // Top-right: error, enhanced, or reject marker
                if asset.state == .failedTransient || asset.state == .failedPermanent {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.white, .red)
                        .padding(6)
                } else if asset.rejected {
                    Image(systemName: "xmark.seal.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white, .red)
                        .padding(4)
                        .background(.red.opacity(0.85), in: Circle())
                        .padding(6)
                } else if asset.enhancedKey != nil {
                    Image(systemName: "wand.and.stars")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white, .purple)
                        .padding(4)
                        .background(.purple.opacity(0.85), in: Circle())
                        .padding(6)
                }
            }
            .overlay(alignment: .bottomLeading) {
                if asset.flaggedForClient {
                    Image(systemName: "flag.fill")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(4)
                        .background(.green, in: Circle())
                        .padding(6)
                }
            }
            .overlay(alignment: .bottom) {
                if asset.rating > 0 {
                    HStack(spacing: 1) {
                        ForEach(0..<asset.rating, id: \.self) { _ in
                            Image(systemName: "star.fill")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(.yellow)
                        }
                    }
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(.black.opacity(0.55), in: Capsule())
                    .padding(.bottom, 6)
                }
            }

            Text(asset.originalFilename)
                .font(.caption2.monospaced())
                .lineLimit(1)
                .truncationMode(.middle)
                .foregroundStyle(isFocused ? .primary : .secondary)
        }
        .frame(width: 156)
    }

    private var overlayColor: Color {
        if isFocused                 { return .accentColor }
        if asset.rejected            { return .red.opacity(0.6) }
        if asset.flaggedForClient    { return .green.opacity(0.7) }
        return .white.opacity(0.08)
    }
}

// MARK: - Shutter flash overlay

/// Brief white flash on the hero area when a new asset lands. Mimics the
/// physical camera's capture feedback so the photographer knows the shot
/// reached the app, not just the card. Driven by a token on the model
/// that changes each time assets.count increases.
private struct ShutterFlashOverlay: View {
    let trigger: UUID?
    @State private var opacity: Double = 0

    var body: some View {
        Color.white
            .opacity(opacity)
            .onChange(of: trigger) { _, _ in
                opacity = 0.85
                withAnimation(.easeOut(duration: 0.45)) { opacity = 0 }
            }
    }
}

// MARK: - Telemetry footer

private struct TelemetryFooter: View {
    let telemetry: CameraTelemetry

    var body: some View {
        if telemetry.isEmpty { EmptyView() }
        else {
            HStack(spacing: 20) {
                if let battery = telemetry.batteryLevel {
                    TelemetryChip(icon: batteryIcon(for: battery), text: batteryLabel(for: battery), color: batteryColor(for: battery))
                }
                if let lens = telemetry.lensName {
                    TelemetryChip(icon: "camera.circle", text: lens, color: .secondary)
                }
                if let aperture = telemetry.apertureValue {
                    TelemetryChip(icon: "circle.lefthalf.filled", text: aperture, color: .primary)
                }
                if let shutter = telemetry.shutterSpeed {
                    TelemetryChip(icon: "clock", text: shutter, color: .primary)
                }
                if let iso = telemetry.isoValue {
                    TelemetryChip(icon: "s.square", text: "ISO \(iso)", color: .primary)
                }
                Spacer(minLength: 0)
                if let free = telemetry.freeSpaceBytes {
                    TelemetryChip(icon: "externaldrive", text: formatBytes(free) + " free", color: .secondary)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 10)
            .background(Color.captureChipBG.opacity(0.6))
            .overlay(Rectangle().frame(height: 0.5).foregroundStyle(Color.captureSeparator), alignment: .top)
        }
    }

    private func batteryIcon(for level: String) -> String {
        if let pct = Int(level) {
            if pct >= 75 { return "battery.100" }
            if pct >= 50 { return "battery.75" }
            if pct >= 25 { return "battery.50" }
            if pct >= 10 { return "battery.25" }
            return "battery.0"
        }
        switch level.lowercased() {
        case "full":   return "battery.100"
        case "half":   return "battery.50"
        case "low":    return "battery.25"
        case "empty":  return "battery.0"
        default:       return "battery.75"
        }
    }

    private func batteryLabel(for level: String) -> String {
        if Int(level) != nil { return "\(level)%" }
        return level.capitalized
    }

    private func batteryColor(for level: String) -> Color {
        if let pct = Int(level) {
            if pct >= 20 { return .primary }
            return .red
        }
        switch level.lowercased() {
        case "low", "empty": return .red
        default:             return .primary
        }
    }

    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useGB, .useMB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

private struct TelemetryChip: View {
    let icon: String
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.caption.weight(.medium))
            Text(text)
                .font(.caption.weight(.medium))
                .lineLimit(1)
        }
        .foregroundStyle(color)
    }
}

// MARK: - Shutter

private struct ShutterButton: View {
    let enabled: Bool
    let isShooting: Bool
    let onTap: () -> Void

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            onTap()
        } label: {
            ZStack {
                Circle()
                    .fill(enabled ? Color.accentColor : Color.gray.opacity(0.35))
                    .frame(width: 88, height: 88)
                    .shadow(color: .black.opacity(0.4), radius: 18, y: 6)
                Circle()
                    .stroke(.white.opacity(0.25), lineWidth: 4)
                    .frame(width: 70, height: 70)
                if isShooting {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "camera.shutter.button.fill")
                        .font(.system(size: 32, weight: .medium))
                        .foregroundStyle(.white)
                }
            }
        }
        .buttonStyle(PressableScale())
        .disabled(!enabled)
        .keyboardShortcut(.return, modifiers: [])
    }
}

private struct PressableScale: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .animation(.interactiveSpring(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - Error toast

private struct ErrorToast: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text(message)
                .font(.footnote)
                .lineLimit(2)
            Spacer(minLength: 8)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.yellow.opacity(0.4), lineWidth: 1))
        .frame(maxWidth: 480)
        .padding(.horizontal, 24)
    }
}

// MARK: - Settings sheet

private struct SettingsSheet: View {
    let currentURL: String
    let device: LiveCaptureModel.DeviceSummary?
    let sessionName: String
    let onRename: (String) -> Void
    let onDisconnect: () -> Void

    @State private var editingName: String = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Session") {
                    TextField("Session name", text: $editingName)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)
                        .onSubmit { commitRename() }
                    Button {
                        commitRename()
                    } label: {
                        Label("Rename", systemImage: "pencil")
                    }
                    .disabled(editingName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                              || editingName == sessionName)
                }

                Section("Camera") {
                    if let device {
                        LabeledContent("Model", value: device.productName)
                        LabeledContent("Firmware", value: device.firmware)
                        LabeledContent("Serial", value: device.serial)
                        LabeledContent("MAC", value: device.mac ?? "—")
                    } else {
                        Text("No device info available").foregroundStyle(.secondary)
                    }
                    LabeledContent("URL", value: currentURL)
                        .font(.caption.monospaced())
                }

                Section {
                    Button(role: .destructive, action: onDisconnect) {
                        Label("Disconnect camera", systemImage: "link.badge.minus")
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { editingName = sessionName }
        }
    }

    private func commitRename() {
        let trimmed = editingName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != sessionName else { return }
        onRename(trimmed)
    }
}

// MARK: - Full-screen asset viewer

private struct AssetViewerScreen: View {
    let asset: Asset
    let onClose: () -> Void

    @State private var scale: CGFloat = 1
    @State private var offset: CGSize = .zero

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let key = asset.previewKey, let image = UIImage(contentsOfFile: key) {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .scaleEffect(scale)
                    .offset(offset)
                    .gesture(
                        MagnificationGesture()
                            .onChanged { scale = max(1, $0) }
                            .onEnded { _ in
                                withAnimation(.spring) {
                                    if scale < 1.1 { scale = 1; offset = .zero }
                                }
                            }
                    )
                    .simultaneousGesture(
                        DragGesture()
                            .onChanged { if scale > 1 { offset = $0.translation } }
                            .onEnded { _ in if scale <= 1 { withAnimation(.spring) { offset = .zero } } }
                    )
            } else {
                Text("Preview unavailable")
                    .foregroundStyle(.secondary)
            }

            VStack {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(asset.originalFilename)
                            .font(.headline.monospaced())
                        Text(asset.captureTime.formatted(date: .abbreviated, time: .standard))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title)
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(.white, .white.opacity(0.25))
                    }
                }
                .padding()
                .background(.ultraThinMaterial)
                Spacer()
            }
        }
        .onTapGesture(count: 2) {
            withAnimation(.spring) {
                scale = scale > 1 ? 1 : 2
                offset = .zero
            }
        }
    }
}

// MARK: - Model

@Observable
@MainActor
final class LiveCaptureModel {
    enum Phase: Equatable { case disconnected, connecting, connected }

    struct DeviceSummary: Equatable {
        var productName: String
        var firmware: String
        var serial: String
        var mac: String?
    }

    var connectionState: CameraSession.State = .disconnected {
        didSet { refreshPhase() }
    }
    var assets: [Asset] = [] {
        didSet {
            // Follow latest unless the user has pinned focus to a specific
            // asset. Pinning is a UX affordance for reviewing while shooting
            // continues — without it every new capture would steal focus.
            let newCaptureArrived = assets.count > oldValue.count
            if !pinnedFocus {
                if focusedAssetId == nil || !assets.contains(where: { $0.id == focusedAssetId }) {
                    focusedAssetId = assets.last?.id
                } else if newCaptureArrived, let last = assets.last?.id {
                    focusedAssetId = last
                }
            }
            if newCaptureArrived { shutterFlashToken = UUID() }
        }
    }
    var errorMessage: String?
    var isConnecting: Bool = false
    var phase: Phase = .disconnected
    var deviceSummary: DeviceSummary?
    var telemetry: CameraTelemetry = .empty
    var focusedAssetId: UUID?
    var pinnedFocus: Bool = false
    var sessionName: String = "Live shoot"
    /// Token that changes every time a new asset lands. Views bind to it
    /// to trigger the shutter-fired flash animation.
    var shutterFlashToken: UUID?

    var focusedAsset: Asset? {
        guard let focusedAssetId else { return assets.last }
        return assets.first { $0.id == focusedAssetId } ?? assets.last
    }

    var canShoot: Bool {
        switch connectionState {
        case .ready, .shooting: return true
        default:                return false
        }
    }

    private var cameraSession: CameraSession?
    private var client: CCAPIClient?
    private var store: SessionStore?
    private var currentSessionId: UUID?
    private var downloadDirectory: URL?
    private var forwardingTasks: [Task<Void, Never>] = []
    #if DEBUG
    /// Retained while Demo Mode is active so its MockURLProtocol handler
    /// stays installed. Cleared on teardown.
    private var demoFake: FakeCanonCamera?
    private var magicPipeline: MagicPipeline?
    #endif

    /// Controls whether the hero + filmstrip tile prefer the Magic
    /// preview when one is available. Off = always show original.
    /// Toggled from the hero badge. Persists for the connected session.
    var showMagic: Bool = true

    /// Per-asset tuned recipes. Nil means "use the pipeline's auto-detected
    /// baseline". When the photographer drags a slider we set this and the
    /// pipeline re-runs with the new values, overwriting the enhanced bytes.
    var tunedRecipes: [UUID: MagicRecipe] = [:]

    /// Recipe currently in effect for an asset: tuned if set, else the
    /// auto-detected baseline from the pipeline, else neutral.
    func recipe(for assetId: UUID) -> MagicRecipe {
        if let tuned = tunedRecipes[assetId] { return tuned }
        #if DEBUG
        if let baseline = magicPipeline?.baselineRecipes[assetId] { return baseline }
        #endif
        return .neutral
    }

    func tune(assetId: UUID, recipe: MagicRecipe) {
        tunedRecipes[assetId] = recipe
        #if DEBUG
        guard let sourcePath = assets.first(where: { $0.id == assetId })?.previewKey
        else { return }
        magicPipeline?.retune(assetId: assetId, recipe: recipe, sourcePath: sourcePath)
        #endif
    }

    func resetRecipe(assetId: UUID) {
        tunedRecipes.removeValue(forKey: assetId)
        #if DEBUG
        guard let sourcePath = assets.first(where: { $0.id == assetId })?.previewKey,
              let baseline = magicPipeline?.baselineRecipes[assetId]
        else { return }
        magicPipeline?.retune(assetId: assetId, recipe: baseline, sourcePath: sourcePath)
        #endif
    }

    /// Selects filter applied to the filmstrip. The source array stays
    /// complete so ratings/flags from currently-hidden assets still persist.
    var filmstripFilter: FilmstripFilter = .all

    enum FilmstripFilter: String, CaseIterable, Equatable {
        case all     = "All"
        case picks   = "Picks"
        case fourPlus = "4★ and up"
    }

    var filteredAssets: [Asset] {
        switch filmstripFilter {
        case .all:     return assets
        case .picks:   return assets.filter { $0.flaggedForClient && !$0.rejected }
        case .fourPlus: return assets.filter { $0.rating >= 4 && !$0.rejected }
        }
    }

    private let actorUserId = "local-photographer"

    /// URL that triggers in-process Demo Mode. Keeps the fake swap isolated
    /// to a single well-known host — any other URL goes to the real
    /// insecure-trust session path.
    static let demoBaseURL = URL(string: "https://camera.demo")!

    func connect(to baseURL: URL) async {
        guard cameraSession == nil else { return }
        isConnecting = true
        errorMessage = nil
        refreshPhase()

        let urlSession = Self.makeSession(for: baseURL, retain: { [weak self] fake in
            #if DEBUG
            self?.demoFake = fake
            #endif
        })
        let client = CCAPIClient(baseURL: baseURL, session: urlSession)
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("capture-live", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)

        do {
            let adapter = try CCAPIAdapter(
                baseURL: baseURL,
                adapterId: "live-\(baseURL.host ?? "")",
                client: client,
                downloadDirectory: tempDir,
                enumerateOnStart: false
            )
            let store = try SessionStore(database: AppDatabase.inMemory())
            let dbSession = try await store.createSession(
                name: "Live shoot",
                clientId: nil,
                ownerUserId: actorUserId
            )
            let camera = CameraSession(
                sessionId: dbSession.id,
                actorUserId: actorUserId,
                adapter: adapter,
                store: store
            )

            self.client = client
            self.store = store
            self.cameraSession = camera
            self.downloadDirectory = tempDir
            self.currentSessionId = dbSession.id
            self.sessionName = dbSession.name

            try await camera.start()

            #if DEBUG
            // Run the demo enhancer for every DEBUG connection — lets us
            // validate the Enhanced UX flow with real cameras too, before
            // the backend-driven enhancer loop is wired up. Won't ship to
            // release builds.
            let enhancer = MagicPipeline(store: store, outputDirectory: tempDir.appendingPathComponent("enhanced"))
            enhancer.start(sessionId: dbSession.id)
            self.magicPipeline = enhancer
            #endif

            // Fetch static device info in parallel; tolerate failure
            // (device-info endpoint is always supported but good to be safe).
            Task { [weak self] in
                if let info = try? await client.deviceInformation() {
                    await MainActor.run {
                        self?.deviceSummary = DeviceSummary(
                            productName: info.productname,
                            firmware: info.firmwareversion ?? "—",
                            serial: info.serialnumber,
                            mac: info.macaddress
                        )
                    }
                }
            }

            let stateStream = camera.stateChanges
            let stateTask = Task { [weak self] in
                for await state in stateStream {
                    await MainActor.run { self?.connectionState = state }
                }
            }
            let assetsStream = store.assetsStream(sessionId: dbSession.id)
            let assetsTask = Task { [weak self] in
                for await assets in assetsStream {
                    await MainActor.run { self?.assets = assets }
                }
            }
            let telemetryStream = camera.telemetryUpdates
            let telemetryTask = Task { [weak self] in
                for await diff in telemetryStream {
                    await MainActor.run { self?.mergeTelemetry(diff) }
                }
            }
            forwardingTasks = [stateTask, assetsTask, telemetryTask]

            isConnecting = false
            refreshPhase()
        } catch {
            isConnecting = false
            errorMessage = "Couldn't reach camera: \(error.localizedDescription)"
            await teardown()
        }
    }

    func disconnect() async {
        await teardown()
    }

    func triggerShutter() async {
        guard let client else { return }
        do {
            try await client.triggerManualShutter(af: false)
        } catch {
            errorMessage = "Shutter failed: \(error.localizedDescription)"
        }
    }

    func setRating(assetId: UUID, rating: Int) async {
        guard let store else { return }
        do {
            try await store.updateAssetLabels(id: assetId, rating: rating)
        } catch {
            errorMessage = "Rating failed: \(error.localizedDescription)"
        }
    }

    func togglePick(asset: Asset) async {
        guard let store else { return }
        do {
            try await store.updateAssetLabels(
                id: asset.id,
                flaggedForClient: !asset.flaggedForClient
            )
        } catch {
            errorMessage = "Flag failed: \(error.localizedDescription)"
        }
    }

    func toggleReject(asset: Asset) async {
        guard let store else { return }
        do {
            try await store.updateAssetLabels(
                id: asset.id,
                rejected: !asset.rejected
            )
        } catch {
            errorMessage = "Reject failed: \(error.localizedDescription)"
        }
    }

    func renameSession(_ newName: String) async {
        guard let store, let sessionId = currentSessionId else { return }
        do {
            try await store.renameSession(id: sessionId, name: newName)
            sessionName = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        } catch {
            errorMessage = "Rename failed: \(error.localizedDescription)"
        }
    }

    private func teardown() async {
        if let cameraSession {
            await cameraSession.stop()
        }
        for task in forwardingTasks { task.cancel() }
        forwardingTasks.removeAll()
        if let downloadDirectory {
            try? FileManager.default.removeItem(at: downloadDirectory)
        }
        cameraSession = nil
        client = nil
        store = nil
        currentSessionId = nil
        sessionName = "Live shoot"
        downloadDirectory = nil
        deviceSummary = nil
        #if DEBUG
        magicPipeline?.stop()
        magicPipeline = nil
        demoFake = nil
        MockURLProtocol.handler = nil
        #endif
        telemetry = .empty
        pinnedFocus = false
        shutterFlashToken = nil
        assets = []
        focusedAssetId = nil
        connectionState = .disconnected
        refreshPhase()
    }

    private func refreshPhase() {
        if cameraSession == nil, !isConnecting {
            phase = .disconnected
        } else if isConnecting || connectionState == .discovering || connectionState == .pairing {
            phase = .connecting
        } else {
            phase = .connected
        }
    }

    /// Build a URLSession suited to `baseURL`:
    ///   - `camera.demo` → in-process fake (DEBUG builds only).
    ///   - anything else → real URLSession with a scoped self-signed cert trust.
    #if DEBUG
    private static func makeSession(for baseURL: URL, retain: (FakeCanonCamera) -> Void) -> URLSession {
        if baseURL.host == "camera.demo" {
            let fake = FakeCanonCamera(initialAssetCount: 0)
            fake.install()
            retain(fake)
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        return CCAPIClient.makeInsecureSession(trustingHostOf: baseURL)
    }
    #else
    private static func makeSession(for baseURL: URL, retain: (Void) -> Void) -> URLSession {
        CCAPIClient.makeInsecureSession(trustingHostOf: baseURL)
    }
    #endif

    /// Merge a partial telemetry diff into the accumulated snapshot — only
    /// non-nil fields overwrite existing values so last-known state persists
    /// across polls where Canon reports nothing new.
    private func mergeTelemetry(_ diff: CameraTelemetry) {
        if let v = diff.batteryLevel       { telemetry.batteryLevel = v }
        if let v = diff.apertureValue      { telemetry.apertureValue = v }
        if let v = diff.shutterSpeed       { telemetry.shutterSpeed = v }
        if let v = diff.isoValue           { telemetry.isoValue = v }
        if let v = diff.lensName           { telemetry.lensName = v }
        if let v = diff.freeSpaceBytes     { telemetry.freeSpaceBytes = v }
        if let v = diff.totalContentsCount { telemetry.totalContentsCount = v }
    }
}

// MARK: - Palette

private extension Color {
    static let captureBackground      = Color(red: 0.07, green: 0.08, blue: 0.10)
    static let captureFilmstripBG     = Color(red: 0.10, green: 0.11, blue: 0.13)
    static let captureChipBG          = Color.white.opacity(0.07)
    static let captureFieldBG         = Color.white.opacity(0.10)
    static let captureSeparator       = Color.white.opacity(0.12)
}
