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
                    onTap: { asset in viewerAsset = asset }
                )
                ShutterFlashOverlay(trigger: model.shutterFlashToken)
                    .allowsHitTesting(false)
            }
            .frame(maxHeight: .infinity)

            TelemetryFooter(telemetry: model.telemetry)

            FilmstripRail(
                assets: model.assets,
                focusedAssetId: model.focusedAssetId,
                onSelect: { model.focusedAssetId = $0.id },
                onDoubleTap: { viewerAsset = $0 }
            )
            .frame(height: 152)
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

    @State private var url: String = ""
    @FocusState private var urlFocused: Bool

    var body: some View {
        VStack(spacing: 28) {
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

            VStack(alignment: .leading, spacing: 8) {
                Label("Camera URL", systemImage: "network")
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
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            url = defaultURL
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { urlFocused = true }
        }
    }

    private func connect() {
        guard let resolved = URL(string: url), resolved.host != nil else { return }
        urlFocused = false
        onConnect(resolved)
    }
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
    let onTap: (Asset) -> Void

    var body: some View {
        Group {
            if let asset {
                VStack(spacing: 16) {
                    HeroImage(asset: asset)
                        .onTapGesture { onTap(asset) }
                        .padding(.horizontal, 24)
                        .padding(.top, 24)

                    HStack(spacing: 16) {
                        AssetBadge(text: asset.originalFilename, icon: "photo")
                        if let kind = fileKind(asset.originalFilename) {
                            AssetBadge(text: kind, icon: "rectangle.stack")
                        }
                        if let capturedAt = relativeTime(asset.captureTime) {
                            AssetBadge(text: capturedAt, icon: "clock")
                        }
                        AssetStateBadge(state: asset.state)
                    }
                    .padding(.bottom, 24)
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

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.captureChipBG)
            if let key = asset.previewKey, let image = UIImage(contentsOfFile: key) {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(radius: 20, y: 8)
                    .transition(.opacity)
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
                .overlay {
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(isFocused ? Color.accentColor : .white.opacity(0.08), lineWidth: isFocused ? 2 : 1)
                }

                if asset.state == .failedTransient || asset.state == .failedPermanent {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.white, .red)
                        .padding(6)
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
    let onDisconnect: () -> Void

    var body: some View {
        NavigationStack {
            List {
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
        }
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
    private var downloadDirectory: URL?
    private var forwardingTasks: [Task<Void, Never>] = []
    #if DEBUG
    /// Retained while Demo Mode is active so its MockURLProtocol handler
    /// stays installed. Cleared on teardown.
    private var demoFake: FakeCanonCamera?
    #endif

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

            try await camera.start()

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
        downloadDirectory = nil
        deviceSummary = nil
        #if DEBUG
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
